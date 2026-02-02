from pydantic import BaseModel, Field, model_validator
from typing import List, Dict, Literal, Optional, Any

# ============================================================================
# Pydantic Models
# ============================================================================

class OptimizationRequest(BaseModel):
    tickers: List[str] = Field(..., description="List of ticker symbols", min_length=2)
    start_date: Optional[str] = Field(default=None, description="Start date (YYYY-MM-DD) or None for earliest")
    end_date: Optional[str] = Field(default=None, description="End date (YYYY-MM-DD) or None for today")
    method: Literal["nco", "gmv", "mvo"] = Field(default="nco")
    training_window: int = Field(default=252, ge=60, le=1260)
    rebalancing_window: int = Field(default=21, ge=5, le=126)
    transaction_cost_bps: float = Field(default=10, ge=0, le=100, description="Transaction cost in basis points")


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


class ModelParams(BaseModel):
    """Model transparency: parameters used by each optimization method."""
    # covariance_estimator: Optional[str] = None  # Removed for MDR simplified params
    # confidence_level: Optional[str] = None     # Removed for GMV
    linkage_method: Optional[str] = None         # For NCO (using KMeans)


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


class CompareRequest(BaseModel):
    tickers: List[str] = Field(..., min_length=2)
    start_date: Optional[str] = Field(default=None)
    end_date: Optional[str] = Field(default=None)
    training_window: int = Field(default=252, ge=60, le=1260)
    rebalancing_window: int = Field(default=21, ge=5, le=126)
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
    # cvar_confidence removed/ignored for GMV
    
    @model_validator(mode='after')
    def validate_weight_constraints(self):
        """Ensure weight constraints are feasible."""
        if self.min_weight > self.max_weight:
            raise ValueError('min_weight cannot exceed max_weight')
        # Check feasibility: n * min_weight must be <= 1 and n * max_weight >= 1
        # We can't check exact n here, but we can warn if min_weight > 0.5 (impossible for n>=2)
        if self.min_weight > 0.5:
            raise ValueError('min_weight > 50% is infeasible for 2+ assets')
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

