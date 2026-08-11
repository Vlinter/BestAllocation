"""
Statistical significance of a strategy comparison.

The per-period "predicted vs realized Sharpe" rank-IC that used to be the only
overfitting diagnostic is, on a 63-day holding window, mathematically incapable
of detecting anything: the sampling error of an annualized Sharpe estimated on
63 daily observations is ~±2.0 (Lo, 2002), while the cross-period dispersion of
realized Sharpes is of the same magnitude. The measured correlation is therefore
attenuated to ~0 whatever the model does. This module keeps that statistic but
reports its *detectability ceiling* alongside, and adds the three tests that do
answer the question a comparator raises:

  1. Is the winner actually a winner?   -> block-bootstrap CI on the Sharpe gap
  2. Is the podium a selection artifact? -> PBO via CSCV (Bailey et al., 2016)
  3. Does this Sharpe survive the number of trials, the skew and the fat tails?
                                         -> Deflated Sharpe Ratio (Bailey &
                                            Lopez de Prado, 2014)
  4. Does the optimizer add anything over 1/N? -> per-period edge vs the
     benchmark, which removes the common market regime and cuts the estimation
     noise by a factor 2-3.

References
----------
Lo, A. (2002). The Statistics of Sharpe Ratios. Financial Analysts Journal.
Bailey, D. & Lopez de Prado, M. (2014). The Deflated Sharpe Ratio. JPM.
Bailey, Borwein, Lopez de Prado & Zhu (2016). The Probability of Backtest
    Overfitting. Journal of Computational Finance.
Politis & Romano (1994). The Stationary Bootstrap. JASA.
Ledoit & Wolf (2008). Robust performance hypothesis testing with the Sharpe
    ratio. Journal of Empirical Finance.  (The studentized test this module
    approximates with a percentile interval.)
"""

from itertools import combinations
from typing import Dict, List, Optional, Sequence

import logging
import math
import numpy as np
import pandas as pd
from scipy.stats import kurtosis, norm, skew, spearmanr

from .config import (
    BOOTSTRAP_BLOCK_LENGTH, BOOTSTRAP_RESAMPLES, BOOTSTRAP_SEED,
    PBO_SPLITS, TRADING_DAYS_PER_YEAR,
)

logger = logging.getLogger(__name__)

EULER_MASCHERONI = 0.5772156649015329


# ============================================================================
# Building block
# ============================================================================

def annualized_sharpe(returns: np.ndarray, risk_free_rate: float,
                      annualization_factor: int = TRADING_DAYS_PER_YEAR) -> float:
    """Annualized Sharpe on excess returns (same convention as metrics.py)."""
    if len(returns) < 3:
        return 0.0
    excess = np.asarray(returns, dtype=float) - risk_free_rate / annualization_factor
    sd = excess.std(ddof=1)
    if sd < 1e-12:
        return 0.0
    return float(excess.mean() / sd * math.sqrt(annualization_factor))


def _circular_block_indices(n: int, block_length: int, rng: np.random.Generator) -> np.ndarray:
    """Politis-Romano circular block bootstrap index vector of length n."""
    n_blocks = int(math.ceil(n / block_length))
    starts = rng.integers(0, n, size=n_blocks)
    offsets = np.arange(block_length)
    idx = (starts[:, None] + offsets[None, :]).reshape(-1) % n
    return idx[:n]


# ============================================================================
# 1. Is the gap real?  Block bootstrap on the Sharpe difference
# ============================================================================

def bootstrap_sharpe_difference(
    returns_a: np.ndarray,
    returns_b: np.ndarray,
    risk_free_rate: float,
    annualization_factor: int = TRADING_DAYS_PER_YEAR,
    n_resamples: int = BOOTSTRAP_RESAMPLES,
    block_length: int = BOOTSTRAP_BLOCK_LENGTH,
    seed: int = BOOTSTRAP_SEED,
) -> Optional[Dict[str, float]]:
    """
    95% confidence interval for Sharpe(a) - Sharpe(b).

    Both series are resampled with the SAME block indices, so the (strong)
    cross-correlation between two strategies run on the same assets is
    preserved -- otherwise the interval would be far too wide.

    Deterministic: the seed is fixed so two identical runs give identical
    intervals (a comparator whose confidence bounds jitter is unusable).
    """
    a = np.asarray(returns_a, dtype=float)
    b = np.asarray(returns_b, dtype=float)
    n = min(len(a), len(b))
    if n < 60:
        return None
    a, b = a[-n:], b[-n:]

    observed = annualized_sharpe(a, risk_free_rate, annualization_factor) - \
               annualized_sharpe(b, risk_free_rate, annualization_factor)

    rng = np.random.default_rng(seed)
    diffs = np.empty(n_resamples, dtype=float)
    for i in range(n_resamples):
        idx = _circular_block_indices(n, block_length, rng)
        diffs[i] = annualized_sharpe(a[idx], risk_free_rate, annualization_factor) - \
                   annualized_sharpe(b[idx], risk_free_rate, annualization_factor)

    lo, hi = np.percentile(diffs, [2.5, 97.5])
    # Two-sided percentile p-value (equivalent to inverting the interval).
    p_value = 2.0 * min(float((diffs <= 0).mean()), float((diffs >= 0).mean()))
    return {
        "difference": round(observed, 4),
        "ci_low": round(float(lo), 4),
        "ci_high": round(float(hi), 4),
        "p_value": round(min(1.0, p_value), 4),
        "significant": bool(lo > 0 or hi < 0),
    }


# ============================================================================
# 2. Is the podium a selection artifact?  PBO via CSCV
# ============================================================================

def probability_of_backtest_overfitting(
    returns: pd.DataFrame,
    risk_free_rate: float,
    annualization_factor: int = TRADING_DAYS_PER_YEAR,
    n_splits: int = PBO_SPLITS,
) -> Optional[Dict]:
    """
    Combinatorially Symmetric Cross-Validation (Bailey et al., 2016).

    Cut the timeline into `n_splits` contiguous blocks; for each of the
    C(n_splits, n_splits/2) ways of choosing half of them as in-sample, pick the
    candidate with the best in-sample Sharpe and look at where it ranks
    out-of-sample. PBO is the share of splits where the in-sample winner lands
    below the out-of-sample median -- i.e. the probability that "the strategy
    that won the backtest" is the wrong pick.

    Caveat surfaced to the caller via `n_candidates`: PBO is designed for large
    trial counts. With 4 candidates the out-of-sample rank is coarse (4 levels),
    so read the number as an order of magnitude, not a precise probability.
    """
    df = returns.dropna()
    n, k = len(df), df.shape[1]
    if k < 2 or n < n_splits * 20:
        return None
    if n_splits % 2 != 0:
        n_splits -= 1

    blocks = np.array_split(np.arange(n), n_splits)
    values = df.values
    rf_d = risk_free_rate / annualization_factor
    excess = values - rf_d

    # Per-block sufficient statistics -> every combination is then a matrix product.
    b_n = np.array([len(b) for b in blocks], dtype=float)                    # (S,)
    b_s1 = np.array([excess[b].sum(axis=0) for b in blocks])                 # (S, k)
    b_s2 = np.array([(excess[b] ** 2).sum(axis=0) for b in blocks])          # (S, k)

    combos = list(combinations(range(n_splits), n_splits // 2))
    sel = np.zeros((len(combos), n_splits), dtype=float)
    for i, c in enumerate(combos):
        sel[i, list(c)] = 1.0
    comp = 1.0 - sel

    def sharpes(mask: np.ndarray) -> np.ndarray:
        cnt = mask @ b_n                                                     # (C,)
        s1 = mask @ b_s1                                                     # (C, k)
        s2 = mask @ b_s2
        mean = s1 / cnt[:, None]
        var = s2 / cnt[:, None] - mean ** 2
        var = np.maximum(var, 1e-18)
        return mean / np.sqrt(var) * math.sqrt(annualization_factor)

    is_sr, oos_sr = sharpes(sel), sharpes(comp)
    winners = is_sr.argmax(axis=1)
    rows = np.arange(len(combos))
    # Rank of the in-sample winner among out-of-sample results: 1 = worst.
    rank = (oos_sr <= oos_sr[rows, winners][:, None]).sum(axis=1)
    omega = rank / (k + 1.0)
    logits = np.log(omega / (1.0 - omega))
    pbo = float((omega <= 0.5).mean())

    names = list(df.columns)
    share = {names[j]: round(float((winners == j).mean()), 4) for j in range(k)}
    return {
        "pbo": round(pbo, 4),
        "logit_mean": round(float(logits.mean()), 4),
        "n_combinations": len(combos),
        "n_candidates": k,
        "n_splits": n_splits,
        "in_sample_winner_share": share,
    }


# ============================================================================
# 3. Does the Sharpe survive the number of trials?  Deflated Sharpe Ratio
# ============================================================================

def deflated_sharpe_ratio(
    returns: np.ndarray,
    risk_free_rate: float,
    trial_sharpes_daily: Sequence[float],
    n_trials: int,
    annualization_factor: int = TRADING_DAYS_PER_YEAR,
) -> Optional[Dict[str, float]]:
    """
    Probability that the true Sharpe is > 0 once corrected for (a) the number of
    configurations tried, (b) the skew and (c) the fat tails of the return
    distribution. Above 0.95 the track record is credible.
    """
    r = np.asarray(returns, dtype=float)
    T = len(r)
    if T < 100:
        return None
    excess = r - risk_free_rate / annualization_factor
    sd = excess.std(ddof=1)
    if sd < 1e-12:
        return None

    sr_d = float(excess.mean() / sd)                     # per-period Sharpe
    g3 = float(skew(r))
    g4 = float(kurtosis(r, fisher=False))                # non-excess kurtosis

    var_trials = float(np.var(trial_sharpes_daily, ddof=1)) if len(trial_sharpes_daily) > 1 else 0.0
    if n_trials > 1 and var_trials > 0:
        sr0 = math.sqrt(var_trials) * (
            (1 - EULER_MASCHERONI) * norm.ppf(1 - 1.0 / n_trials)
            + EULER_MASCHERONI * norm.ppf(1 - 1.0 / (n_trials * math.e))
        )
    else:
        sr0 = 0.0

    denom = 1.0 - g3 * sr_d + (g4 - 1.0) / 4.0 * sr_d ** 2
    if denom <= 0:
        return None
    dsr = float(norm.cdf((sr_d - sr0) * math.sqrt(T - 1) / math.sqrt(denom)))

    # What the non-normality correction is actually worth here. Both moments enter
    # the denominator scaled by the PER-PERIOD Sharpe, so on daily data (sr_d ~ 0.04)
    # the adjustment is second-order; it only bites on coarser frequencies or on
    # genuinely high-Sharpe series. Reporting it keeps the claim honest in both
    # directions: the correction is applied, and it is usually negligible.
    dsr_normal = float(norm.cdf((sr_d - sr0) * math.sqrt(T - 1)))
    return {
        "dsr": round(dsr, 4),
        "threshold_sharpe": round(sr0 * math.sqrt(annualization_factor), 4),
        "observed_sharpe": round(sr_d * math.sqrt(annualization_factor), 4),
        "n_trials": n_trials,
        # Excess kurtosis, to match the convention used everywhere else in the app
        # (metrics.calculate_metrics); the formula above uses the non-excess form.
        "skewness": round(g3, 4),
        "kurtosis": round(g4 - 3.0, 4),
        # Percentage points of DSR attributable to skew + fat tails (negative = the
        # correction lowered the verdict).
        "tail_adjustment": round((dsr - dsr_normal) * 100, 4),
    }


# ============================================================================
# 4. Predictive power of the in-sample Sharpe, and its detectability ceiling
# ============================================================================

def predictive_power(
    predicted: Sequence[float],
    realized: Sequence[float],
    holding_days: int,
    annualization_factor: int = TRADING_DAYS_PER_YEAR,
) -> Optional[Dict[str, float]]:
    """
    Spearman rank-IC between the in-sample Sharpe announced at each rebalance
    and the Sharpe actually realized over the holding period -- WITH the piece
    of information that makes it readable: how much of the realized dispersion
    can possibly be signal.

    An annualized Sharpe estimated over `holding_days` observations carries a
    sampling error of sqrt(af) * sqrt((1 + S_d^2/2)/holding_days) (Lo, 2002).
    When that error matches the observed dispersion, the correlation is
    attenuated to zero by construction and the test proves nothing. The
    `rho_ceiling` field is the largest correlation observable *even if the model
    were perfect*; compare |rho| to it, never to 1.
    """
    p = np.asarray(predicted, dtype=float)
    r = np.asarray(realized, dtype=float)
    n = len(p)
    if n < 8 or len(r) != n:
        return None

    rho, p_value = spearmanr(p, r)          # scipy handles ties (mid-ranks)
    if np.isnan(rho):
        rho, p_value = 0.0, 1.0

    var_realized = float(r.var(ddof=1))
    sr_daily = float(r.mean()) / math.sqrt(annualization_factor)
    noise_sd = math.sqrt(annualization_factor) * math.sqrt(
        (1.0 + sr_daily ** 2 / 2.0) / max(holding_days, 2)
    )
    signal_var = max(var_realized - noise_sd ** 2, 0.0)
    signal_share = signal_var / var_realized if var_realized > 1e-12 else 0.0

    return {
        "rho": round(float(rho), 4),
        "p_value": round(float(p_value), 4),
        "n": n,
        "predicted_sd": round(float(p.std(ddof=1)), 4),
        "realized_sd": round(math.sqrt(var_realized), 4),
        "noise_sd": round(noise_sd, 4),
        "signal_share": round(signal_share, 4),
        "rho_ceiling": round(math.sqrt(signal_share), 4),
    }


def edge_statistics(edges: Sequence[float]) -> Optional[Dict[str, float]]:
    """
    Per-period edge over the benchmark (strategy Sharpe minus benchmark Sharpe
    on the same window). Subtracting the benchmark removes the market regime,
    which is the dominant variance component -- this is where the signal that
    the raw levels drown becomes measurable.
    """
    e = np.asarray(edges, dtype=float)
    n = len(e)
    if n < 8:
        return None
    sd = float(e.std(ddof=1))
    t_stat = float(e.mean() / (sd / math.sqrt(n))) if sd > 1e-12 else 0.0
    return {
        "mean": round(float(e.mean()), 4),
        "sd": round(sd, 4),
        "t_stat": round(t_stat, 4),
        "hit_rate": round(float((e > 0).mean()), 4),
        "n": n,
    }


# ============================================================================
# Orchestration
# ============================================================================

def compute_significance(
    method_returns: Dict[str, pd.Series],
    benchmark_returns: pd.Series,
    benchmark_name: str,
    risk_free_rate: float,
    annualization_factor: int = TRADING_DAYS_PER_YEAR,
) -> Dict:
    """
    Cross-strategy statistics: they need every curve at once, so this runs in
    the job orchestrator once all methods are done, not inside a single run.
    """
    frame = pd.DataFrame(dict(method_returns))
    frame[benchmark_name] = benchmark_returns
    frame = frame.dropna()
    if len(frame) < 120:
        return {"available": False, "reason": "Historique trop court pour des tests de significativité."}

    names = list(method_returns.keys())
    rf = risk_free_rate

    # --- Sharpe gaps vs the benchmark, and between the top two strategies
    comparisons: List[Dict] = []
    for m in names:
        res = bootstrap_sharpe_difference(
            frame[m].values, frame[benchmark_name].values, rf, annualization_factor
        )
        if res:
            res.update({"a": m, "b": benchmark_name})
            comparisons.append(res)

    ranked = sorted(
        names, key=lambda m: annualized_sharpe(frame[m].values, rf, annualization_factor), reverse=True
    )
    if len(ranked) >= 2:
        res = bootstrap_sharpe_difference(
            frame[ranked[0]].values, frame[ranked[1]].values, rf, annualization_factor
        )
        if res:
            res.update({"a": ranked[0], "b": ranked[1]})
            comparisons.append(res)

    # --- PBO over every candidate the user actually sees, benchmark included
    pbo = probability_of_backtest_overfitting(frame, rf, annualization_factor)

    # --- Deflated Sharpe: the trial universe is the set of candidates compared
    trial_sharpes_daily = [
        annualized_sharpe(frame[c].values, rf, annualization_factor) / math.sqrt(annualization_factor)
        for c in frame.columns
    ]
    dsr = {}
    for m in names:
        out = deflated_sharpe_ratio(
            frame[m].values, rf, trial_sharpes_daily, len(frame.columns), annualization_factor
        )
        if out:
            dsr[m] = out

    return {
        "available": True,
        "benchmark_name": benchmark_name,
        "n_observations": int(len(frame)),
        "sharpe_comparisons": comparisons,
        "pbo": pbo,
        "deflated_sharpe": dsr,
        "bootstrap": {
            "resamples": BOOTSTRAP_RESAMPLES,
            "block_length": BOOTSTRAP_BLOCK_LENGTH,
        },
    }
