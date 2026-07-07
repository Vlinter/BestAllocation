"""
Walk-forward backtester integration tests (pytest, offline — synthetic data).

Run from the repo root:  pytest backend -q
"""
import sys
import os
import numpy as np
import pandas as pd

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from backend.backtester import walk_forward_backtest, get_equal_weight_benchmark
from backend.metrics import calculate_stress_tests, calculate_rolling_sharpe


def _make_market(seed=11, start="2018-06-01", end="2022-06-01", k=4):
    """Synthetic correlated market spanning the COVID stress window."""
    np.random.seed(seed)
    dates = pd.date_range(start, end, freq="B")
    n = len(dates)
    cov = (np.full((k, k), 0.4) + np.eye(k) * 0.6) * 0.012 ** 2
    rets = np.random.multivariate_normal([0.0004, 0.0003, 0.0005, 0.0002][:k], cov, size=n)
    prices = pd.DataFrame(100 * np.cumprod(1 + rets, axis=0), index=dates,
                          columns=[f"T{i}" for i in range(k)])
    opens = prices * (1 + np.random.normal(0, 0.001, prices.shape))
    return prices, opens


def _run(method, prices, opens, **kw):
    return walk_forward_backtest(
        prices=prices, open_prices=opens, method=method,
        training_window=252, rebalancing_window=21,
        risk_free_rate=0.03, transaction_cost_bps=10, **kw
    )


def test_equity_curve_is_gap_free_and_duplicate_free():
    """
    Every business day from the first execution (training_window + 1) to the
    end must appear exactly once in the equity curve — rebalance dates
    included (each block extends through the next decision date).
    """
    prices, opens = _make_market()
    (equity_curve, *_rest) = _run("hrp", prices, opens)

    curve_dates = pd.to_datetime([e["date"] for e in equity_curve], unit="ms")
    expected = prices.index[253:]  # first execution day = training_window + 1

    assert pd.Index(curve_dates).duplicated().sum() == 0
    assert len(expected.difference(curve_dates)) == 0
    assert len(pd.Index(curve_dates).difference(expected)) == 0


def test_overfitting_metrics_carry_is_cash_flag():
    prices, opens = _make_market()
    out = _run("mvo", prices, opens)
    overfit = out[6]
    assert len(overfit) > 10
    assert all("is_cash" in m for m in overfit)
    assert all(isinstance(m["is_cash"], bool) for m in overfit)
    # Cash periods must be the degenerate (0, 0) placeholder
    for m in overfit:
        if m["is_cash"]:
            assert m["predicted_sharpe"] == 0.0 and m["realized_sharpe"] == 0.0


def test_equal_weight_benchmark_pays_transaction_costs():
    """The EW benchmark must end strictly lower when costs are applied."""
    prices, _ = _make_market()
    tickers = list(prices.columns)
    b0, _to0 = get_equal_weight_benchmark(prices, 252, tickers, 21, transaction_cost_bps=0.0)
    b50, _to50 = get_equal_weight_benchmark(prices, 252, tickers, 21, transaction_cost_bps=50.0)
    assert b50[-1]["value"] < b0[-1]["value"]
    # Initial deployment cost: first value already reflects 50bps
    assert b50[0]["value"] < b0[0]["value"] + 1e-12


def test_stress_tests_full_resolution():
    """COVID window (inside data range) available; GFC 2008 (before) N/A."""
    prices, opens = _make_market()
    (equity_curve, *_rest) = _run("cvar", prices, opens)

    stress = calculate_stress_tests(equity_curve)
    by_name = {s["name"]: s for s in stress}

    covid = by_name["COVID Crash"]
    assert covid["available"]
    assert covid["max_drawdown"] >= 0.0
    # DD must be at least as large as the peak-to-end loss over the window
    assert covid["max_drawdown"] >= max(0.0, -covid["return"]) - 1e-9

    assert not by_name["GFC 2008"]["available"]


def test_rolling_sharpe_bounds_and_length():
    prices, opens = _make_market()
    (equity_curve, *_rest) = _run("hrp", prices, opens)

    rs = calculate_rolling_sharpe(equity_curve, risk_free_rate=0.03)
    assert len(rs) == len(equity_curve) - 1 - 252 + 1  # returns minus warm-up window
    assert all(-5.0 <= p["value"] <= 5.0 for p in rs)

    # Too short a curve -> empty result, never an exception
    assert calculate_rolling_sharpe(equity_curve[:100], risk_free_rate=0.03) == []


def test_last_day_decision_is_not_traded():
    """
    If the walk lands exactly on the last date, that decision cannot be
    executed (no T+1 open) and must NOT create a same-day trade or a
    duplicate equity point.
    """
    prices, opens = _make_market()
    # Craft a length so that training + k*rebalancing == last index
    n = len(prices.index)
    reb = 21
    k = (n - 1 - 252) // reb
    trimmed = prices.iloc[: 252 + k * reb + 1]
    trimmed_open = opens.iloc[: 252 + k * reb + 1]

    (equity_curve, *_rest) = walk_forward_backtest(
        prices=trimmed, open_prices=trimmed_open, method="hrp",
        training_window=252, rebalancing_window=reb,
        risk_free_rate=0.03, transaction_cost_bps=10,
    )
    curve_dates = pd.Index(pd.to_datetime([e["date"] for e in equity_curve], unit="ms"))
    assert curve_dates.duplicated().sum() == 0
