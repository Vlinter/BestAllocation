"""
Configuration constants for the Portfolio Optimizer.
Centralizes magic numbers and default values.
"""

# ============================================================================
# Trading Calendar
# ============================================================================
TRADING_DAYS_PER_YEAR = 252
TRADING_DAYS_PER_QUARTER = 63
TRADING_DAYS_PER_MONTH = 21
TRADING_DAYS_PER_WEEK = 5

# ============================================================================
# Default Parameters
# ============================================================================
DEFAULT_RISK_FREE_RATE = 0.045  # 4.5% fallback
DEFAULT_TRAINING_WINDOW = 252   # 1 year
DEFAULT_REBALANCING_WINDOW = 21  # Monthly
DEFAULT_TRANSACTION_COST_BPS = 10

# ============================================================================
# Optimization Bounds
# ============================================================================
MIN_DATA_POINTS = 60  # Minimum trading days required
COVARIANCE_CONDITION_NUMBER_THRESHOLD = 1000  # Warning if exceeded
MIN_ASSETS_FOR_DIVERSIFICATION = 2

# ============================================================================
# CVaR Parameters
# ============================================================================
DEFAULT_CVAR_CONFIDENCE = 0.95  # 95% confidence level

# ============================================================================
# Monte Carlo Simulation
# ============================================================================
MONTE_CARLO_SIMULATIONS = 2000
MONTE_CARLO_SEED = 42  # For reproducibility

# ============================================================================
# Overfitting Analysis
# ============================================================================
SPEARMAN_ROBUST_THRESHOLD = 0.5
SPEARMAN_MODERATE_THRESHOLD = 0.3
SPEARMAN_WEAK_THRESHOLD = 0.1
MIN_POINTS_FOR_RELIABLE_SHARPE = 60

# ============================================================================
# Data Quality
# ============================================================================
EXTREME_RETURN_THRESHOLD = 0.20  # 20% daily return = suspicious
STALE_PRICE_DAYS = 5  # Same price for 5+ days = suspicious

# ============================================================================
# Quant Enhancements
# ============================================================================

# Return Shrinkage (James-Stein) for MVO
# 0.0 = use raw sample mean (aggressive/overfitting), 1.0 = use grand mean (conservative)
# 0.5 is a balanced default - reduces estimation error while preserving signal
RETURN_SHRINKAGE_INTENSITY = 0.5

# Turnover Smoothing
# 0.0 = no smoothing (full rebalance), 1.0 = no change (never rebalance)
# 0.25 provides ~20% turnover reduction without lagging too much
TURNOVER_SMOOTHING_FACTOR = 0.25

# Volatility Scaling (Adaptive Exposure)
# Reduces exposure when realized vol > target (goes to cash)
# DISABLED by default: can confuse users who expect 100% invested
TARGET_VOLATILITY = 0.12  # 12% = moderate balanced portfolio
VOLATILITY_LOOKBACK = 63  # 3 months rolling window for vol estimation
ENABLE_VOLATILITY_SCALING = False  # Set to True for risk-parity style behavior
