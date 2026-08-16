import re

from pydantic import BaseModel, Field, model_validator, field_validator
from typing import List, Dict, Literal, Optional, Any
from datetime import datetime as dt

# Every ticker that reaches the data provider is interpolated into a Tiingo URL
# path (`/tiingo/daily/{ticker}/prices`), and `requests` does not collapse '..'
# segments — so an unvalidated ticker reaches a different endpoint of the API
# carrying our own token. One pattern, applied to every ticker-shaped field.
TICKER_PATTERN = re.compile(r'[A-Z0-9.\-]{1,12}')


def normalize_ticker(raw: str, field: str = "ticker") -> str:
    """Strip/upper-case a ticker and reject anything that is not one."""
    cleaned = str(raw).strip().upper()
    if not TICKER_PATTERN.fullmatch(cleaned):
        raise ValueError(
            f"Invalid {field}: '{raw}' (expected 1-12 chars: letters, digits, '.', '-')"
        )
    return cleaned

# ============================================================================
# Pydantic Models
# ============================================================================

class PerformanceMetrics(BaseModel):
    sharpe_ratio: float
    sortino_ratio: float
    max_drawdown: float
    cagr: float
    total_return: float
    volatility: float
    calmar_ratio: float
    total_transaction_costs: float
    num_rebalances: int
    # New metrics
    skewness: float = 0.0
    kurtosis: float = 0.0
    win_rate: float = 0.0
    avg_win: float = 0.0
    avg_loss: float = 0.0
    max_gain: float = 0.0
    max_loss: float = 0.0
    omega_ratio: float = 0.0
    # Turnover metric
    annualized_turnover: float = 0.0
    # Risk-adjusted performance vs benchmark
    alpha: float = 0.0  # Jensen's Alpha (excess return vs benchmark)
    beta: float = 0.0   # Market sensitivity


class CurrentAllocation(BaseModel):
    date: str
    weights: Dict[str, float]
    risk_contributions: Dict[str, float] = {}
    method: str
    constraints_clipped: bool = False  # True if HRP weights were clipped to meet constraints
    fallback_used: bool = False  # True if optimization failed and fell back to Equal Weight
    fallback_reason: Optional[str] = None  # Reason for fallback if used
    dendrogram_data: Optional[Dict[str, Any]] = None  # HRP hierarchical clustering structure


class OptimizationResponse(BaseModel):
    equity_curve: List[Dict[str, float]]
    benchmark_curve: List[Dict[str, float]]
    drawdown_curve: List[Dict[str, float]]

    performance_metrics: PerformanceMetrics
    benchmark_metrics: PerformanceMetrics
    allocation_history: List[Dict]
    rebalance_dates: List[str]
    current_allocation: CurrentAllocation
    tickers: List[str]
    method: str
    risk_free_rate: float
    data_start_date: str
    data_end_date: str


class OverfittingMetric(BaseModel):
    date: str
    predicted_sharpe: float
    realized_sharpe: float
    # True when the strategy sat in cash for the period. Both Sharpes are then
    # degenerate (0, 0) placeholders and must be EXCLUDED from predictive-power
    # statistics (Spearman / regression) by consumers.
    is_cash: bool = False
    # Same-window Sharpe of the naive 1/N portfolio (in-sample) and of the
    # displayed benchmark (out-of-sample). The differences below are the
    # low-noise version of the diagnostic: subtracting the benchmark removes
    # the market regime that dominates raw Sharpe levels.
    predicted_sharpe_ew: float = 0.0
    realized_sharpe_benchmark: float = 0.0
    predicted_edge: float = 0.0
    realized_edge: float = 0.0


class PredictivePower(BaseModel):
    """Rank-IC of the in-sample Sharpe, WITH its detectability ceiling."""
    rho: float
    p_value: float
    n: int
    predicted_sd: float
    realized_sd: float
    noise_sd: float        # sampling error of a Sharpe over one holding window
    signal_share: float    # share of realized variance that can be signal
    rho_ceiling: float     # max |rho| observable even with a perfect model


class EdgeStatistics(BaseModel):
    """Per-period edge over the benchmark: mean, t-stat, hit rate."""
    mean: float
    sd: float
    t_stat: float
    hit_rate: float
    n: int


class SharpeComparison(BaseModel):
    a: str
    b: str
    difference: float
    ci_low: float
    ci_high: float
    p_value: float
    significant: bool


class PBOResult(BaseModel):
    pbo: float
    logit_mean: float
    n_combinations: int
    n_candidates: int
    n_splits: int
    in_sample_winner_share: Dict[str, float] = {}


class DeflatedSharpe(BaseModel):
    dsr: float
    threshold_sharpe: float
    observed_sharpe: float
    n_trials: int
    skewness: float = 0.0          # of the daily returns
    kurtosis: float = 0.0          # excess, same convention as PerformanceMetrics
    tail_adjustment: float = 0.0   # DSR points attributable to skew + fat tails


class SignificanceReport(BaseModel):
    """
    Cross-strategy statistics: computed once every method has run, because
    they compare candidates against each other and against the benchmark.
    """
    available: bool = False
    reason: Optional[str] = None
    benchmark_name: Optional[str] = None
    n_observations: int = 0
    sharpe_comparisons: List[SharpeComparison] = []
    pbo: Optional[PBOResult] = None
    deflated_sharpe: Dict[str, DeflatedSharpe] = {}
    bootstrap: Dict[str, int] = {}


class ModelParams(BaseModel):
    """Model transparency: parameters used by each optimization method."""
    linkage_method: Optional[str] = None  # For HRP


class MethodResult(BaseModel):
    method: str
    method_name: str
    equity_curve: List[Dict[str, float]]
    drawdown_curve: List[Dict[str, float]]
    performance_metrics: PerformanceMetrics
    current_allocation: CurrentAllocation
    allocation_history: List[Dict]

    overfitting_metrics: List[OverfittingMetric] = []
    method_params: Optional[ModelParams] = None  # Transparency (renamed from model_params)
    # Computed server-side on the FULL-resolution equity curve (the client only
    # receives downsampled curves, which must never be used for these):
    stress_tests: List[Dict[str, Any]] = []       # per historical crisis window
    rolling_sharpe: List[Dict[str, float]] = []   # rolling annualized Sharpe (display-downsampled)
    # Calendar-period returns of the FULL curve, as {date, value}: the
    # distribution card bins the monthly ones and the performance histogram
    # labels one bar per period. Both used to rebuild these from the
    # downsampled display curve, which drifted the period boundaries and
    # collapsed the dispersion (-26% on the monthly standard deviation).
    monthly_returns: List[Dict[str, float]] = []
    yearly_returns: List[Dict[str, float]] = []
    # Statistics of the predicted-vs-realized diagnostic (see significance.py).
    predictive_power: Optional[PredictivePower] = None
    edge_stats: Optional[EdgeStatistics] = None


class CompareRequest(BaseModel):
    tickers: List[str] = Field(..., min_length=2, max_length=30)
    start_date: Optional[str] = Field(default=None)
    end_date: Optional[str] = Field(default=None)
    training_window: int = Field(default=252, ge=60, le=1260)
    rebalancing_window: int = Field(default=63, ge=5, le=126)
    transaction_cost_bps: float = Field(default=10, ge=0, le=100)
    min_weight: float = Field(default=0.0, ge=0.0, le=0.5, description="Minimum weight per asset (0-50%)")
    max_weight: float = Field(default=1.0, ge=0.1, le=1.0, description="Maximum weight per asset (10-100%)")
    # Benchmark options
    benchmark_type: Literal["equal_weight", "custom"] = Field(default="equal_weight", description="Type of benchmark")
    benchmark_ticker: Optional[str] = Field(default=None, description="Custom benchmark ticker (e.g., SPY)")
    # Volatility Scaling (Quant Enhancement)
    enable_volatility_scaling: bool = Field(default=False, description="Enable adaptive volatility targeting")
    target_volatility: float = Field(default=0.12, ge=0.05, le=0.30, description="Target annualized volatility (5-30%)")
    # CVaR confidence level
    cvar_confidence: float = Field(default=0.95, ge=0.5, le=0.99, description="CVaR confidence level")

    @field_validator('tickers', mode='after')
    @classmethod
    def validate_tickers(cls, v):
        """Normalize (strip/upper) and reject malformed tickers before they
        reach the data provider (path segments, abuse, junk input)."""
        cleaned = [normalize_ticker(t) for t in v]
        if len(set(cleaned)) != len(cleaned):
            raise ValueError("Duplicate tickers in request")
        return cleaned

    @field_validator('benchmark_ticker', mode='after')
    @classmethod
    def validate_benchmark_ticker(cls, v):
        """Same gate as `tickers`: this one also ends up in a Tiingo URL path."""
        if v is None or not str(v).strip():
            return None
        return normalize_ticker(v, field="benchmark_ticker")

    @field_validator('start_date', 'end_date', mode='before')
    @classmethod
    def validate_date_format(cls, v):
        if v is not None:
            try:
                dt.strptime(v, "%Y-%m-%d")
            except ValueError:
                raise ValueError(f"Invalid date format: '{v}'. Expected YYYY-MM-DD")
        return v

    @model_validator(mode='after')
    def validate_constraints(self):
        """Ensure weight constraints are feasible and dates are ordered."""
        if self.min_weight > self.max_weight:
            raise ValueError('min_weight cannot exceed max_weight')
        # Check feasibility: n * min_weight must be <= 1 and n * max_weight >= 1
        # We can't check exact n here, but we can warn if min_weight > 0.5 (impossible for n>=2)
        if self.min_weight > 0.5:
            raise ValueError('min_weight > 50% is infeasible for 2+ assets')
        if self.start_date and self.end_date and self.start_date >= self.end_date:
            raise ValueError('start_date must be strictly before end_date')
        return self


class CompareResponse(BaseModel):
    methods: List[MethodResult]
    benchmark_curve: List[Dict[str, float]]
    benchmark_metrics: PerformanceMetrics
    benchmark_name: str = "Equal Weight"  # Display name for the benchmark
    tickers: List[str]
    risk_free_rate: float
    data_start_date: str
    data_end_date: str
    # New fields for data source info
    ticker_start_dates: Dict[str, str] = {}
    limiting_ticker: Optional[str] = None
    # Correlation matrix for heatmap (ordered tickers and matrix values)
    correlation_matrix: Optional[Dict[str, Any]] = None
    efficient_frontier_data: Optional[Dict[str, Any]] = None
    # Warnings for data quality or optimization issues
    warnings: List[str] = []
    # Bootstrap CIs on Sharpe gaps, PBO and Deflated Sharpe (cross-strategy)
    significance: Optional[SignificanceReport] = None
