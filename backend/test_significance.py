"""
Tests for the statistical significance layer (backend/significance.py).

The point of these tests is not that the numbers are pretty: it is that each
test detects what it claims to detect and, just as importantly, REFUSES to
detect what is not there.

Run from the repo root:  pytest backend -q
"""
import sys
import os
import numpy as np
import pandas as pd

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from backend.significance import (
    annualized_sharpe,
    bootstrap_sharpe_difference,
    compute_significance,
    deflated_sharpe_ratio,
    edge_statistics,
    predictive_power,
    probability_of_backtest_overfitting,
)


def _series(mu, sigma, n=2000, seed=0):
    rng = np.random.default_rng(seed)
    idx = pd.date_range("2010-01-01", periods=n, freq="B")
    return pd.Series(rng.normal(mu, sigma, n), index=idx)


# ============================================================================
# Sharpe difference: the interval must contain zero when nothing differs
# ============================================================================

def test_bootstrap_interval_covers_zero_for_identical_processes():
    a = _series(0.0004, 0.01, seed=1)
    b = _series(0.0004, 0.01, seed=2)
    out = bootstrap_sharpe_difference(a.values, b.values, risk_free_rate=0.0)
    assert out is not None
    assert out["ci_low"] < 0 < out["ci_high"], out
    assert not out["significant"]
    assert out["p_value"] > 0.10


def test_bootstrap_detects_a_large_real_gap():
    """A Sharpe of ~1.6 against ~0 over 2000 days must come out significant."""
    a = _series(0.001, 0.01, seed=3)     # ~1.6 annualized
    b = _series(0.0, 0.01, seed=4)       # ~0
    out = bootstrap_sharpe_difference(a.values, b.values, risk_free_rate=0.0)
    assert out["difference"] > 1.0
    assert out["ci_low"] > 0, out
    assert out["significant"]


def test_bootstrap_is_deterministic():
    """Two identical runs must give the exact same interval (fixed seed)."""
    a, b = _series(0.0006, 0.01, seed=5), _series(0.0002, 0.011, seed=6)
    first = bootstrap_sharpe_difference(a.values, b.values, risk_free_rate=0.0)
    second = bootstrap_sharpe_difference(a.values, b.values, risk_free_rate=0.0)
    assert first == second


def test_bootstrap_returns_none_on_short_series():
    assert bootstrap_sharpe_difference(np.zeros(20), np.zeros(20), 0.0) is None


# ============================================================================
# PBO: pure noise must overfit, a genuinely dominant strategy must not
# ============================================================================

def test_pbo_is_high_when_candidates_are_pure_noise():
    """
    Identical-by-construction candidates: whichever wins in-sample is a coin
    flip out-of-sample, so PBO must land around 0.5.
    """
    rng = np.random.default_rng(11)
    idx = pd.date_range("2010-01-01", periods=2500, freq="B")
    df = pd.DataFrame({f"s{i}": rng.normal(0.0003, 0.01, 2500) for i in range(6)}, index=idx)
    out = probability_of_backtest_overfitting(df, risk_free_rate=0.0)
    assert out is not None
    assert out["n_combinations"] == 12870
    assert 0.30 < out["pbo"] < 0.70, out["pbo"]


def test_pbo_is_low_when_one_candidate_genuinely_dominates():
    rng = np.random.default_rng(12)
    idx = pd.date_range("2010-01-01", periods=2500, freq="B")
    data = {f"s{i}": rng.normal(0.0001, 0.01, 2500) for i in range(5)}
    data["winner"] = rng.normal(0.0012, 0.01, 2500)     # persistent edge
    out = probability_of_backtest_overfitting(pd.DataFrame(data, index=idx), risk_free_rate=0.0)
    assert out["pbo"] < 0.10, out["pbo"]
    assert out["in_sample_winner_share"]["winner"] > 0.9


def test_pbo_returns_none_on_short_history():
    idx = pd.date_range("2020-01-01", periods=100, freq="B")
    df = pd.DataFrame({"a": np.zeros(100), "b": np.zeros(100)}, index=idx)
    assert probability_of_backtest_overfitting(df, 0.0) is None


# ============================================================================
# Deflated Sharpe
# ============================================================================

def test_dsr_falls_when_more_trials_are_declared():
    r = _series(0.0005, 0.01, n=2500, seed=21).values
    trials = [0.02, 0.05, 0.03, 0.04]
    few = deflated_sharpe_ratio(r, 0.0, trials, n_trials=2)
    many = deflated_sharpe_ratio(r, 0.0, trials, n_trials=500)
    assert few["dsr"] >= many["dsr"]
    assert many["threshold_sharpe"] > few["threshold_sharpe"]


def test_dsr_penalises_negative_skew():
    """Same Sharpe, fat left tail: the deflated ratio must be lower."""
    rng = np.random.default_rng(22)
    n = 2500
    clean = rng.normal(0.0005, 0.01, n)
    crash = rng.random(n) < 0.02
    skewed = np.where(crash, rng.normal(-0.05, 0.01, n), rng.normal(0.0015, 0.008, n))
    skewed = skewed * (clean.std() / skewed.std())
    skewed = skewed - skewed.mean() + clean.mean()      # match mean AND variance
    trials = [0.05, 0.05]
    a = deflated_sharpe_ratio(clean, 0.0, trials, 2)
    b = deflated_sharpe_ratio(skewed, 0.0, trials, 2)
    assert abs(a["observed_sharpe"] - b["observed_sharpe"]) < 0.05   # same Sharpe
    assert b["dsr"] < a["dsr"], (a, b)


# ============================================================================
# Predictive power: the ceiling is the point of the whole exercise
# ============================================================================

def test_ceiling_is_zero_when_noise_swamps_the_signal():
    """
    Realized Sharpes whose dispersion equals the sampling error of a 63-day
    Sharpe: no correlation is observable, and the ceiling must say so.
    """
    rng = np.random.default_rng(31)
    predicted = rng.normal(0.8, 0.5, 80)
    realized = rng.normal(0.8, 2.0, 80)          # sd ~ the noise of a 63d Sharpe
    out = predictive_power(predicted, realized, holding_days=63)
    assert out["noise_sd"] > 1.8
    assert out["rho_ceiling"] < 0.25, out
    assert out["n"] == 80


def test_ceiling_rises_with_a_longer_holding_window():
    """
    Same data, longer measurement window: the sampling error shrinks with
    1/sqrt(window), so a dispersion that was entirely noise at 21 days becomes
    mostly signal at 3 years.
    """
    rng = np.random.default_rng(32)
    predicted = rng.normal(0.8, 1.0, 200)
    realized = predicted + rng.normal(0, 0.3, 200)      # sd ~1.05, well above 0.58
    short = predictive_power(predicted, realized, holding_days=21)     # noise ~3.5
    long = predictive_power(predicted, realized, holding_days=756)     # noise ~0.58
    assert long["noise_sd"] < short["noise_sd"]
    assert short["rho_ceiling"] == 0.0
    assert long["rho_ceiling"] > 0.5, long


def test_predictive_power_handles_ties():
    """Capped Sharpes create ties; scipy must still return a finite rho."""
    predicted = [5.0] * 10 + [1.0] * 10
    realized = [5.0] * 10 + [0.5] * 10
    out = predictive_power(predicted, realized, holding_days=63)
    assert out is not None and np.isfinite(out["rho"])


def test_edge_statistics_t_stat():
    edges = [0.5] * 40 + [-0.5] * 40
    out = edge_statistics(edges)
    assert abs(out["mean"]) < 1e-9
    assert abs(out["t_stat"]) < 1e-6
    assert out["hit_rate"] == 0.5


# ============================================================================
# Orchestration
# ============================================================================

def test_compute_significance_end_to_end():
    methods = {
        "Alpha": _series(0.0006, 0.01, n=1500, seed=41),
        "Beta": _series(0.0003, 0.012, n=1500, seed=42),
    }
    bench = _series(0.0002, 0.011, n=1500, seed=43)
    out = compute_significance(methods, bench, "Equal Weight", risk_free_rate=0.01)
    assert out["available"]
    assert out["n_observations"] == 1500
    # one comparison per method vs benchmark + the top-two head-to-head
    assert len(out["sharpe_comparisons"]) == 3
    assert out["pbo"]["n_candidates"] == 3        # 2 methods + benchmark
    assert set(out["deflated_sharpe"]) == {"Alpha", "Beta"}


def test_compute_significance_refuses_short_history():
    methods = {"A": _series(0.0005, 0.01, n=50, seed=51)}
    bench = _series(0.0005, 0.01, n=50, seed=52)
    out = compute_significance(methods, bench, "Equal Weight", 0.0)
    assert out["available"] is False and out["reason"]


def test_annualized_sharpe_matches_manual_computation():
    r = _series(0.0005, 0.01, n=1000, seed=61).values
    expected = (r - 0.02 / 252).mean() / (r - 0.02 / 252).std(ddof=1) * np.sqrt(252)
    assert abs(annualized_sharpe(r, 0.02) - expected) < 1e-9
