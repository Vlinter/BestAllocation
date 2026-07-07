"""
Test suite for portfolio optimization algorithms (pytest).
Tests HRP, CVaR, and MVO for mathematical correctness.
All tests use optimize_with_fallback() which is the production entrypoint.

Run from the repo root:  pytest backend -q
"""
import sys
import os
import pandas as pd
import numpy as np

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from backend.optimization import optimize_hrp, optimize_with_fallback, shrink_expected_returns
from backend.config import RETURN_SHRINKAGE_INTENSITY


def _gaussian_universe(seed=42, n=500):
    np.random.seed(seed)
    dates = pd.date_range("2020-01-01", periods=n)
    return pd.DataFrame({
        'A': np.random.normal(0.0005, 0.01, n),
        'B': np.random.normal(0.0005, 0.02, n),
        'C': np.random.normal(0.0005, 0.03, n)
    }, index=dates)


def test_hrp_basic():
    """HRP produces valid weights that sum to 1, favoring low-vol assets."""
    df = _gaussian_universe()
    weights, dendrogram = optimize_hrp(df)

    assert abs(sum(weights.values()) - 1.0) < 1e-6
    assert all(w >= 0 for w in weights.values())
    # Inverse variance principle: lower-vol asset gets more weight
    assert weights['A'] > weights['C']
    # Dendrogram data for the frontend chart
    assert dendrogram is not None
    assert "icoord" in dendrogram and "ivl" in dendrogram


def test_cvar_valid_weights():
    """CVaR gives valid portfolio weights summing to 1."""
    df = _gaussian_universe()
    result = optimize_with_fallback(df, method="cvar", risk_free_rate=0.04)
    assert abs(sum(result.weights.values()) - 1.0) < 1e-6


def test_cvar_diverges_from_minvar_on_skewed_returns():
    """
    THE discriminating CVaR test. Under Gaussian returns, min-CVaR and
    min-variance coincide, so Gaussian tests cannot prove tail-risk capture.
    Here: two assets with (near) IDENTICAL variance, but B is heavily
    negatively skewed (rare crashes). A true CVaR optimizer must underweight
    B; a min-variance optimizer is indifferent (~50/50).
    """
    from pypfopt import risk_models

    np.random.seed(7)
    n = 1000
    crash = np.random.random(n) < 0.03
    ret_b = np.where(crash,
                     np.random.normal(-0.045, 0.01, n),
                     np.random.normal(0.002, 0.008, n))    # fat left tail
    ret_a = np.random.normal(0.0005, ret_b.std(), n)       # Gaussian, matched variance
    df = pd.DataFrame({"A": ret_a, "B": ret_b},
                      index=pd.date_range("2018-01-01", periods=n, freq="B"))

    # Sanity: variances actually matched, skews actually different
    assert abs(df['A'].std() - df['B'].std()) / df['B'].std() < 0.05
    assert df['B'].skew() < -1.5 and df['A'].skew() > -0.5

    result = optimize_with_fallback(df, method="cvar", risk_free_rate=0.04)
    w_cvar = result.weights
    assert not result.fallback_used

    # Closed-form min-variance with Ledoit-Wolf for comparison
    S = risk_models.CovarianceShrinkage(df, returns_data=True).ledoit_wolf()
    Sinv = np.linalg.inv(S.values)
    ones = np.ones(2)
    w_mv = Sinv @ ones / (ones @ Sinv @ ones)

    assert abs(w_mv[0] - 0.5) < 0.10, f"min-variance should be ~50/50, got {w_mv}"
    assert w_cvar["A"] > 0.60, f"CVaR must underweight the fat-tailed asset: {w_cvar}"

    # And the CVaR-optimal portfolio must have a better (less negative) CVaR95
    def cvar95(w):
        pr = df.values @ np.array([w[0], w[1]])
        tail = np.sort(pr)[: int(0.05 * n)]
        return tail.mean()

    assert cvar95([w_cvar["A"], w_cvar["B"]]) >= cvar95(w_mv) - 1e-9


def test_james_stein_constant_shrinkage():
    """shrink_expected_returns applies the fixed 0.5 blend towards the grand mean."""
    mu = pd.Series([0.08, 0.12, 0.05, 0.15, 0.10], index=list("ABCDE"))
    shrunk = shrink_expected_returns(mu)
    lam = RETURN_SHRINKAGE_INTENSITY
    expected = lam * mu.mean() + (1 - lam) * mu
    pd.testing.assert_series_equal(shrunk, expected)
    # Ordering preserved, dispersion reduced
    assert shrunk.idxmax() == mu.idxmax() and shrunk.idxmin() == mu.idxmin()
    assert shrunk.std() < mu.std()
    # Explicit override still works
    pd.testing.assert_series_equal(shrink_expected_returns(mu, 0.0), mu)
    assert (shrink_expected_returns(mu, 1.0) - mu.mean()).abs().max() < 1e-12


def test_mvo_max_sharpe():
    """MVO produces valid weights (fully invested or cash)."""
    np.random.seed(42)
    n = 500
    dates = pd.date_range("2020-01-01", periods=n)
    df = pd.DataFrame({
        'A': np.random.normal(0.001, 0.01, n),   # best Sharpe by construction
        'B': np.random.normal(0.0005, 0.02, n),
        'C': np.random.normal(0.0003, 0.015, n)
    }, index=dates)

    result = optimize_with_fallback(df, method="mvo", risk_free_rate=0.04)
    total = sum(result.weights.values())
    assert total < 0.01 or abs(total - 1.0) < 1e-6


def test_mvo_constraints():
    """MVO respects min/max weight constraints."""
    np.random.seed(42)
    n = 500
    dates = pd.date_range("2020-01-01", periods=n)
    df = pd.DataFrame({
        'A': np.random.normal(0.002, 0.01, n),
        'B': np.random.normal(0.0001, 0.02, n),
    }, index=dates)

    min_w, max_w = 0.2, 0.8
    result = optimize_with_fallback(df, method="mvo", min_weight=min_w, max_weight=max_w, risk_free_rate=0.04)
    if sum(result.weights.values()) > 0.01:  # not in cash mode
        for t, w in result.weights.items():
            assert min_w - 0.001 <= w <= max_w + 0.001, f"{t}: {w}"


def test_mvo_cash_fallback():
    """MVO goes to cash when all expected returns are below the risk-free rate."""
    np.random.seed(42)
    n = 500
    dates = pd.date_range("2020-01-01", periods=n)
    df = pd.DataFrame({
        'A': np.random.normal(-0.002, 0.01, n),
        'B': np.random.normal(-0.001, 0.02, n),
    }, index=dates)

    result = optimize_with_fallback(df, method="mvo", risk_free_rate=0.05)
    assert sum(result.weights.values()) < 0.01, "should be 100% cash"


def test_cvar_constraints():
    """CVaR respects min/max weight constraints."""
    np.random.seed(42)
    n = 500
    dates = pd.date_range("2020-01-01", periods=n)
    df = pd.DataFrame({
        'A': np.random.normal(0.0005, 0.005, n),
        'B': np.random.normal(0.0005, 0.05, n),
    }, index=dates)

    min_w, max_w = 0.2, 0.8
    result = optimize_with_fallback(df, method="cvar", min_weight=min_w, max_weight=max_w, risk_free_rate=0.04)
    for t, w in result.weights.items():
        assert min_w - 0.001 <= w <= max_w + 0.001, f"{t}: {w}"


def test_weights_sum_to_one_all_methods():
    """All methods produce weights summing to 1 (or 0 in cash mode)."""
    np.random.seed(42)
    n = 300
    dates = pd.date_range("2020-01-01", periods=n)
    df = pd.DataFrame({
        'SPY': np.random.normal(0.0005, 0.012, n),
        'TLT': np.random.normal(0.0002, 0.008, n),
        'GLD': np.random.normal(0.0003, 0.010, n),
    }, index=dates)

    for method in ["hrp", "cvar", "mvo"]:
        result = optimize_with_fallback(df, method=method, risk_free_rate=0.04)
        total = sum(result.weights.values())
        assert total < 0.01 or abs(total - 1.0) < 1e-6, f"{method}: {total}"
