"""
Walk-forward backtester integration tests (pytest, offline — synthetic data).

Run from the repo root:  pytest backend -q
"""
import sys
import os
import numpy as np
import pandas as pd
import pytest

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
    b0, _to0, _c0 = get_equal_weight_benchmark(prices, 252, tickers, 21, transaction_cost_bps=0.0)
    b50, _to50, _c50 = get_equal_weight_benchmark(prices, 252, tickers, 21, transaction_cost_bps=50.0)
    assert b50[-1]["value"] < b0[-1]["value"]
    # Initial deployment cost: first value already reflects 50bps
    assert b50[0]["value"] < b0[0]["value"] + 1e-12


def test_cash_flag_fires_on_exposure_not_on_a_zero_sum():
    """
    The go-to-cash returns all-zero weights, but turnover smoothing blends 25%
    of the previous allocation back in, so `sum(weights) < 0.001` needed five
    consecutive risk-off signals and never fired in practice — leaving
    mostly-cash periods, whose realised Sharpe is pinned at the +/-5 cap, in the
    predictive-power sample. The flag now tracks the actual exposure.
    """
    from backend.backtester import smooth_weights
    from backend.config import CASH_MODE_MAX_EXPOSURE, TURNOVER_SMOOTHING_FACTOR

    # One go-to-cash decision after a fully invested period.
    weights = {"AAA": 0.5, "BBB": 0.5}
    exposures = []
    for _ in range(5):
        weights = smooth_weights({"AAA": 0.0, "BBB": 0.0}, weights)
        exposures.append(sum(weights.values()))

    # The glide is geometric in the smoothing factor, never a step to zero.
    assert exposures[0] == pytest.approx(TURNOVER_SMOOTHING_FACTOR)
    assert all(e > 0 for e in exposures)

    # 25% invested after one signal is still a real portfolio and stays in the
    # sample; from the second signal on (6.25%) the Sharpe is cash-driven.
    flagged = [e < CASH_MODE_MAX_EXPOSURE for e in exposures]
    assert flagged == [False, True, True, True, True]

    # The old `< 0.001` test needed all five consecutive risk-off signals —
    # roughly 15 months at a quarterly cadence, which is why it never fired.
    assert [e < 0.001 for e in exposures] == [False, False, False, False, True]


def test_cash_flag_spares_a_capped_but_real_portfolio():
    """
    With a 25% weight cap, "one asset at the cap and nothing else" is an
    exposure of exactly 0.25 — a real portfolio, not a cash position. The
    threshold must sit below that cluster.
    """
    from backend.config import CASH_MODE_MAX_EXPOSURE
    assert CASH_MODE_MAX_EXPOSURE < 0.25


def test_overfitting_entries_expose_their_exposure():
    """The exclusion has to be auditable from the payload, not just trusted."""
    prices, opens = _make_market()
    (_ec, _ah, _rd, _cw, _tc, _to, overfit, *_rest) = _run("mvo", prices, opens)

    assert overfit, "expected at least one rebalance"
    for entry in overfit:
        assert "invested_weight" in entry
        assert 0.0 <= entry["invested_weight"] <= 1.0 + 1e-9
        # The flag and the exposure must tell the same story.
        assert entry["is_cash"] == (entry["invested_weight"] < 0.20)


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


def test_monthly_returns_use_month_end_values_not_sampled_points():
    """
    The distribution card bins these. Computing them from the 500-point display
    curve instead of the full one distorts every tail statistic it shows, so the
    function must (a) key on calendar month ends and (b) be unaffected by how
    many intra-month points the curve carries.
    """
    from backend.metrics import calculate_monthly_returns

    # Three months, deliberately uneven daily sampling inside each one.
    idx = (list(pd.date_range("2020-01-01", "2020-01-31", freq="D"))
           + list(pd.date_range("2020-02-01", "2020-02-29", freq="2D"))
           + list(pd.date_range("2020-03-01", "2020-03-31", freq="D")))
    values = np.linspace(1.0, 1.30, len(idx))
    curve = [{"date": float(pd.Timestamp(d).value // 10**6), "value": float(v)}
             for d, v in zip(idx, values)]

    rets = calculate_monthly_returns(curve)
    assert len(rets) == 2                      # 3 month ends -> 2 returns

    # Reproduce from the month-end values themselves
    s = pd.Series(values, index=pd.DatetimeIndex(idx))
    expected = s.resample("ME").last().pct_change().dropna()
    assert [r["value"] for r in rets] == [round(e, 6) for e in expected]

    # The period end travels with the value: the histogram labels its bars from
    # it, and deriving the label client-side is what drifted the boundaries.
    assert [pd.Timestamp(r["date"], unit="ms") for r in rets] == list(expected.index)

    # Dropping every other point must not change the month-end anchors that survive
    thinned = curve[::2]
    thin_rets = calculate_monthly_returns(thinned)
    assert len(thin_rets) == 2

    assert calculate_monthly_returns([]) == []
    assert calculate_monthly_returns(curve[:1]) == []


def test_yearly_returns_are_calendar_years_not_first_to_last_sample():
    """
    The histogram's yearly mode used to measure first-sampled-point of a year to
    last-sampled-point, so it silently dropped the start of January and the end
    of December. Anchoring on calendar year ends is the whole point.
    """
    from backend.metrics import calculate_yearly_returns

    idx = pd.date_range("2020-01-01", "2022-12-31", freq="D")
    # +10% in 2021, -10% in 2022, measured on the 31 Dec closes exactly.
    values = []
    for d in idx:
        if d.year == 2020:
            values.append(100.0)
        elif d.year == 2021:
            values.append(100.0 if d.month < 12 or d.day < 31 else 110.0)
        else:
            values.append(110.0 if d.month < 12 or d.day < 31 else 99.0)
    curve = [{"date": float(pd.Timestamp(d).value // 10**6), "value": v}
             for d, v in zip(idx, values)]

    rets = calculate_yearly_returns(curve)
    assert len(rets) == 2                      # 3 year ends -> 2 returns
    assert rets[0]["value"] == pytest.approx(0.10)
    assert rets[1]["value"] == pytest.approx(-0.10)
    assert [pd.Timestamp(r["date"], unit="ms").year for r in rets] == [2021, 2022]


def test_equal_weight_benchmark_reports_the_costs_it_charges():
    """
    The benchmark pays the same costs as the strategies — but the figure was
    never returned, so the comparison table showed 0.00% for the line that was
    in fact the most expensive on the board.
    """
    from backend.backtester import get_equal_weight_benchmark

    dates = pd.date_range("2020-01-01", periods=400, freq="B")
    rng = np.random.default_rng(11)
    prices = pd.DataFrame(
        {t: 100 * np.cumprod(1 + rng.normal(0.0004, 0.011, len(dates)))
         for t in ("AAA", "BBB", "CCC")},
        index=dates,
    )

    cols = list(prices.columns)

    # A window longer than the sample means no rebalance: the only cost is the
    # initial deployment, exactly 10 bps of the starting 1.0.
    _, _, deploy_only = get_equal_weight_benchmark(prices, 100, cols, 10_000, 10.0)
    assert deploy_only == pytest.approx(0.001)

    free, _, free_costs = get_equal_weight_benchmark(prices, 100, cols, 21, 0.0)
    paid, _, paid_costs = get_equal_weight_benchmark(prices, 100, cols, 21, 10.0)

    assert free_costs == 0.0
    assert paid_costs > deploy_only          # rebalances add to the deployment

    # The reported figure is the sum of nominal costs; the terminal gap is those
    # same costs compounded forward, so they agree in size, not to the cent.
    terminal_gap = free[-1]["value"] - paid[-1]["value"]
    assert terminal_gap > 0
    assert 0.5 < terminal_gap / paid_costs < 2.0


def test_equal_weight_benchmark_starts_where_the_strategies_start():
    """
    The benchmark used to open one close earlier than the strategies, earning a
    day of market return they never had and carrying one extra point.
    """
    from backend.backtester import get_equal_weight_benchmark

    dates = pd.date_range("2020-01-01", periods=300, freq="B")
    rng = np.random.default_rng(12)
    prices = pd.DataFrame(
        {t: 100 * np.cumprod(1 + rng.normal(0.0004, 0.011, len(dates)))
         for t in ("AAA", "BBB")},
        index=dates,
    )
    offset = 100
    curve, _, _ = get_equal_weight_benchmark(prices, offset, list(prices.columns), 21, 0.0)

    # First valued close is the one AFTER the decision date, as for a strategy
    # that decides at `offset` and holds from the next session onwards.
    assert pd.Timestamp(curve[0]["date"], unit="ms") == dates[offset + 1]
    assert len(curve) == len(dates) - offset - 1
