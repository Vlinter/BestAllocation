"""
Metrics correctness tests (pytest).

Run from the repo root:  pytest backend -q
"""
import sys
import os
import pandas as pd
import numpy as np

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from backend.metrics import calculate_metrics


def test_metrics_math():
    """Constant +1%/day growth: near-zero vol, huge Sharpe, zero drawdown."""
    dates = pd.date_range("2023-01-01", periods=252, freq="B")
    values = [1.0 * (1.01 ** i) for i in range(len(dates))]
    equity_curve = pd.Series(values, index=dates)

    metrics = calculate_metrics(equity_curve, risk_free_rate=0.0)

    assert metrics.volatility < 0.0001
    assert metrics.sharpe_ratio > 100
    assert metrics.max_drawdown == 0


def test_metrics_downside():
    """Known drawdown path: peak 110 -> trough 90 = 18.18% max drawdown."""
    dates = pd.date_range("2023-01-01", periods=10, freq="B")
    values = [100, 105, 110, 90, 95, 100, 110, 120, 130, 125]
    equity_curve = pd.Series(values, index=dates)

    metrics = calculate_metrics(equity_curve, risk_free_rate=0.0)

    assert abs(metrics.max_drawdown - 0.1818) < 0.01
    assert metrics.sortino_ratio != 0


def test_omega_ratio_no_losses():
    """All-positive returns: Omega capped at 999 (effectively infinite)."""
    dates = pd.date_range("2023-01-01", periods=100, freq="B")
    values = [1.0 * (1.001 ** i) for i in range(len(dates))]
    equity_curve = pd.Series(values, index=dates)

    metrics = calculate_metrics(equity_curve, risk_free_rate=0.0)
    assert metrics.omega_ratio >= 100


def test_alpha_beta_identity():
    """
    A portfolio IDENTICAL to its benchmark must have beta ~= 1 and alpha ~= 0.
    This is the invariant the previous CAGR-based alpha violated (compounding
    injected a spurious ~sigma^2/2 term).
    """
    np.random.seed(5)
    dates = pd.date_range("2019-01-01", periods=756, freq="B")
    rets = np.random.normal(0.0006, 0.015, len(dates))
    equity = pd.Series(np.cumprod(1 + rets), index=dates)
    bench_returns = equity.pct_change().dropna()

    m = calculate_metrics(equity, risk_free_rate=0.03, benchmark_returns=bench_returns)
    assert abs(m.beta - 1.0) < 1e-6
    assert abs(m.alpha) < 1e-6


def test_alpha_scales_with_excess_return():
    """A portfolio = benchmark + constant daily edge must show that edge as alpha."""
    np.random.seed(6)
    dates = pd.date_range("2019-01-01", periods=756, freq="B")
    bench_rets = pd.Series(np.random.normal(0.0004, 0.012, len(dates)), index=dates)
    edge = 0.0002  # 2bp/day ~= 5.04%/year
    port_rets = bench_rets + edge
    equity = pd.Series(np.cumprod(1 + port_rets), index=dates)

    m = calculate_metrics(equity, risk_free_rate=0.03, benchmark_returns=bench_rets)
    assert abs(m.beta - 1.0) < 0.01
    assert abs(m.alpha - edge * 252) < 0.005, f"alpha={m.alpha}, expected ~{edge * 252}"
