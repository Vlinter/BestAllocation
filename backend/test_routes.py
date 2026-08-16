"""
Job-orchestration tests (pytest, offline — synthetic data).

Run from the repo root:  pytest backend -q
"""
import os
import sys

import numpy as np
import pandas as pd
import pytest
from fastapi import HTTPException

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from backend.app.api.routes import _run_strategy, downsample_curve
from backend.app.core.schemas import CompareRequest


def _tiny_market(n_days=80):
    dates = pd.date_range("2022-01-03", periods=n_days, freq="B")
    rng = np.random.default_rng(3)
    close = pd.DataFrame(
        {t: 100 * np.cumprod(1 + rng.normal(0.0003, 0.01, n_days))
         for t in ("AAA", "BBB")},
        index=dates,
    )
    return close, close.shift(1).bfill()


def test_actionable_rejection_reaches_the_caller():
    """
    `walk_forward_backtest` raises HTTPException(400, "Not enough data...").
    `_run_strategy` used to swallow it with every other exception and return
    None, so all three methods came back empty and the user got a generic
    "Could not generate results for any method" — the one sentence explaining
    how to fix the request was lost.
    """
    close, opens = _tiny_market(80)
    request = CompareRequest(tickers=["AAA", "BBB"], training_window=252)

    with pytest.raises(HTTPException) as excinfo:
        _run_strategy(
            "hrp", close, opens, request,
            risk_free_rate=0.03, rf_metrics=0.03, trading_days_per_year=252,
            cvar_alpha=0.05, benchmark_returns=None, progress_callback=None,
        )

    assert excinfo.value.status_code == 400
    assert "Not enough data" in str(excinfo.value.detail)


def test_unexpected_failures_still_degrade_gracefully():
    """A method that blows up for another reason must not abort the whole job."""
    close, opens = _tiny_market(400)
    request = CompareRequest(tickers=["AAA", "BBB"], training_window=100)

    # An unknown method falls through optimize_with_fallback to equal weight,
    # so this must produce a result rather than raise.
    outcome = _run_strategy(
        "not-a-method", close, opens, request,
        risk_free_rate=0.03, rf_metrics=0.03, trading_days_per_year=252,
        cvar_alpha=0.05, benchmark_returns=None, progress_callback=None,
    )
    assert outcome is not None


# ============================================================================
# Display downsampling
# ============================================================================

def test_downsample_always_keeps_the_last_point():
    """
    `int(i * step)` never reaches len-1, so the chart used to stop up to `step`
    points before the backtest did — the equity curve ended nine trading days
    early on a 20-year run and disagreed with the metrics table by ~10 points
    of total return.
    """
    curve = [{"date": float(i), "value": 1.0 + i} for i in range(4814)]
    shown = downsample_curve(curve, 500)

    assert shown[0] == curve[0]
    assert shown[-1] == curve[-1]
    assert len(shown) <= 501
    # Still monotonically ordered, no duplicates
    dates = [p["date"] for p in shown]
    assert dates == sorted(dates)
    assert len(set(dates)) == len(dates)


def test_downsample_leaves_short_curves_untouched():
    curve = [{"date": float(i), "value": 1.0} for i in range(120)]
    assert downsample_curve(curve, 500) is curve
    assert downsample_curve([], 500) == []
