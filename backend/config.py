"""
Configuration constants for the Portfolio Optimizer.
Centralizes magic numbers and default values.

Note: user-facing request defaults (training window, rebalancing window,
transaction costs, CVaR confidence) live in app/core/schemas.py — the Pydantic
schema is the single source of truth for API defaults.
"""

# ============================================================================
# Trading Calendar
# ============================================================================
TRADING_DAYS_PER_YEAR = 252

# ============================================================================
# Optimization Bounds
# ============================================================================
COVARIANCE_CONDITION_NUMBER_THRESHOLD = 1000  # Warning if exceeded

# ============================================================================
# Monte Carlo Simulation
# ============================================================================
MONTE_CARLO_SIMULATIONS = 500  # Points on the efficient frontier cloud

# ============================================================================
# Quant Enhancements
# ============================================================================

# Return Shrinkage (James-Stein style) for MVO expected returns
# 0.0 = raw sample means (aggressive/overfitting), 1.0 = grand mean (no signal)
# 0.5 is a balanced fixed intensity — see shrink_expected_returns() docstring
# for why a data-driven intensity is not used.
RETURN_SHRINKAGE_INTENSITY = 0.5

# Turnover Smoothing
# 0.0 = no smoothing (full rebalance), 1.0 = no change (never rebalance)
TURNOVER_SMOOTHING_FACTOR = 0.25

# Volatility Scaling (Adaptive Exposure)
# Reduces exposure when realized vol > target (goes to cash)
TARGET_VOLATILITY = 0.12  # 12% = moderate balanced portfolio
VOLATILITY_LOOKBACK = 63  # 3 months rolling window for vol estimation

# ============================================================================
# Analytics
# ============================================================================

# Rolling Sharpe window (trading days) — computed server-side on the
# full-resolution equity curve (see metrics.calculate_rolling_sharpe).
ROLLING_SHARPE_WINDOW = 252

# Historical stress-test windows. Computed server-side on the full-resolution
# equity curve (see metrics.calculate_stress_tests) because these windows are
# short and intra-period drawdowns need daily granularity.
STRESS_SCENARIOS = [
    {"name": "GFC 2008", "start": "2008-09-15", "end": "2009-03-09",
     "description": "Global Financial Crisis"},
    {"name": "Taper Tantrum", "start": "2013-05-22", "end": "2013-09-05",
     "description": "Fed tapering shock"},
    {"name": "China Deval 2015", "start": "2015-08-10", "end": "2015-08-25",
     "description": "Yuan devaluation selloff"},
    {"name": "Q4 2018", "start": "2018-10-01", "end": "2018-12-24",
     "description": "Fed tightening selloff"},
    {"name": "COVID Crash", "start": "2020-02-19", "end": "2020-03-23",
     "description": "Pandemic market selloff"},
    {"name": "2022 Rate Hikes", "start": "2022-01-03", "end": "2022-10-12",
     "description": "Aggressive Fed rate hiking"},
]
