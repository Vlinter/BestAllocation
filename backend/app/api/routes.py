from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Union, Optional
from datetime import datetime
import pandas as pd
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

# Import from new structure
from ..core.schemas import (
    OptimizationRequest, OptimizationResponse, PerformanceMetrics, 
    CurrentAllocation, CompareRequest, CompareResponse, MethodResult, ModelParams
)
from ..core.config import TARGET_VOLATILITY, ENABLE_VOLATILITY_SCALING
from ..services.jobs import job_manager

# Import from original backend root (still there until fully moved)
# We need to fix imports in these files or move them too. 
# For now, we assume we can import them from parent (backend)
# BUT backend is not a package unless we run from root.
# We will use absolute imports assuming the app is run from root.

from backend.data_provider import fetch_price_data, get_risk_free_rate, fetch_risk_free_rate_history
from backend.metrics import calculate_metrics, calculate_drawdown_curve, calculate_correlation_matrix, infer_trading_frequency
from backend.backtester import walk_forward_backtest, get_custom_benchmark, get_equal_weight_benchmark
from backend.optimization import calculate_efficient_frontier

router = APIRouter()
logger = logging.getLogger(__name__)

METHOD_NAMES = {
    "hrp": "HRP (Hierarchical Risk Parity)",
    "gmv": "GMV (Global Minimum Variance)",
    "mvo": "MVO (Mean-Variance Max Sharpe)"
}

def sanitize_nan(obj):
    """Recursively replace NaN/Inf floats with None in a nested structure."""
    import math
    if isinstance(obj, dict):
        return {k: sanitize_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_nan(item) for item in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    return obj

# Model parameters helper
def get_model_params(method: str) -> ModelParams:
    if method == "mvo":
        return ModelParams()
    elif method == "gmv":
        return ModelParams()
    elif method == "hrp":
        return ModelParams(linkage_method="Ward Linkage")
    return ModelParams()


@router.get("/health")
async def health():
    return {
        "status": "healthy", 
        "timestamp": datetime.now().isoformat()
    }

@router.get("/version")
async def version():
    return {
        "version": "2.4.0-refactored",
        "methods": ["hrp", "gmv", "mvo"],
        "features": ["walk_forward", "transaction_costs", "volatility_scaling"]
    }

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get the current status of a job."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return sanitize_nan(job)

# Strategy Runner Logic (Extracted from main.py)
def _run_strategy(
    method: str,
    prices: pd.DataFrame,
    open_prices: pd.DataFrame,
    request: CompareRequest,
    risk_free_rate: Union[float, pd.Series],
    trading_days_per_year: int,
    cvar_alpha: float,
    job_id: str,
    progress_callback
) -> Optional[MethodResult]:
    try:
        (equity_curve, bench_curve, allocation_history, rebalance_dates, 
         current_weights, total_costs, total_turnover, overfitting_metrics,
         risk_contributions, bench_turnover_val, dendrogram_data_comp) = walk_forward_backtest(
            prices=prices,
            open_prices=open_prices,
            method=method,
            training_window=request.training_window,
            rebalancing_window=request.rebalancing_window,
            risk_free_rate=risk_free_rate,
            transaction_cost_bps=request.transaction_cost_bps,
            min_weight=request.min_weight,
            max_weight=request.max_weight,
            cvar_alpha=cvar_alpha,
            enable_volatility_scaling=request.enable_volatility_scaling,
            target_volatility=request.target_volatility,
            progress_callback=progress_callback
        )
        
        if not equity_curve:
            return None
        
        drawdown_curve = calculate_drawdown_curve(equity_curve)
        
        equity_series = pd.Series(
            [e["value"] for e in equity_curve],
            index=pd.to_datetime([e["date"] for e in equity_curve], unit="ms")
        )
        
        years = len(equity_curve) / trading_days_per_year
        annualized_turnover = total_turnover / max(years, 0.01)
        
        # Benchmark for metrics
        benchmark_series = pd.Series(
             [b["value"] for b in bench_curve],
             index=pd.to_datetime([b["date"] for b in bench_curve], unit="ms")
        )
        benchmark_returns = benchmark_series.pct_change().dropna()
        
        rf_scalar = float(risk_free_rate.mean()) if isinstance(risk_free_rate, pd.Series) else float(risk_free_rate)
        
        performance_metrics = calculate_metrics(
            equity_series, rf_scalar, total_costs, 
            len(rebalance_dates), annualized_turnover,
            benchmark_returns=benchmark_returns,
            annualization_factor=trading_days_per_year
        )
        
        current_alloc = CurrentAllocation(
            date=datetime.now().strftime("%Y-%m-%d"),
            weights=current_weights or {},
            risk_contributions=risk_contributions or {},
            method=method,
            dendrogram_data=dendrogram_data_comp
        )
        
        method_params = get_model_params(method)
        
        return MethodResult(
            method=method,
            method_name=METHOD_NAMES.get(method, method),
            equity_curve=equity_curve,
            drawdown_curve=drawdown_curve,
            performance_metrics=performance_metrics,
            current_allocation=current_alloc,
            allocation_history=allocation_history,
            overfitting_metrics=overfitting_metrics,
            method_params=method_params
        )
    except Exception as e:
        print(f"Error in method {method}: {e}")
        return None

def run_comparison_job(job_id: str, request: CompareRequest):
    """Background task to run the comparison logic."""
    try:
        job_manager.update_job(job_id, 5, "Fetching Historical Market Data...", status="processing")
        
        # 1. Setup & Data Fetching
        rf_rate_current = get_risk_free_rate()
        risk_free_rate_series = fetch_risk_free_rate_history(request.start_date, request.end_date)
        backtest_rf_input = risk_free_rate_series if not risk_free_rate_series.empty else rf_rate_current

        tickers = [t.strip().upper() for t in request.tickers]
        
        if len(tickers) < 2:
            raise ValueError("At least 2 tickers required")
        
        end_date = request.end_date if request.end_date else datetime.now().strftime("%Y-%m-%d")
        start_date = request.start_date
        
        prices, open_prices, ticker_start_dates, limiting_ticker = fetch_price_data(tickers, start_date, end_date)
        
        trading_days_per_year = infer_trading_frequency(prices.index)
        
        job_manager.update_job(job_id, 15, "Preparing Backtest Engine...")
        
        cvar_alpha = 0.05 
        methods_to_run = ["hrp", "gmv", "mvo"]
        method_results = []
        benchmark_curve = None
        benchmark_metrics = None
        benchmark_name = "Equal Weight"
        
        # 2. Parallel Execution
        total_methods = len(methods_to_run)
        progress_per_method = 70 // total_methods
        completed_methods = 0
        
        job_manager.update_job(job_id, 15, f"Running {', '.join([m.upper() for m in methods_to_run])} in parallel...")
        
        noop_callback = lambda p: None
        
        with ThreadPoolExecutor(max_workers=min(total_methods, 4)) as executor:
            future_to_method = {
                executor.submit(
                    _run_strategy,
                    method, 
                    prices,
                    open_prices,
                    request, 
                    backtest_rf_input, 
                    trading_days_per_year, 
                    cvar_alpha, 
                    job_id, 
                    noop_callback
                ): method 
                for method in methods_to_run
            }
            
            for future in as_completed(future_to_method):
                method = future_to_method[future]
                try:
                    result = future.result()
                    if result:
                        method_results.append(result)
                except Exception as exc:
                    print(f"Strategy {method} generated an exception: {exc}")
                
                completed_methods += 1
                current_progress = 15 + (completed_methods * progress_per_method)
                job_manager.update_job(job_id, int(current_progress), f"Completed {METHOD_NAMES.get(method, method)}...")

        # Benchmark Logic
        if method_results:
            if request.benchmark_type == "custom" and request.benchmark_ticker:
                benchmark_curve, benchmark_name = get_custom_benchmark(
                    prices, request.training_window, request.benchmark_ticker
                )
            
            if not benchmark_curve:
                benchmark_curve, bench_turnover = get_equal_weight_benchmark(
                    prices, request.training_window, request.tickers, request.rebalancing_window
                )
                benchmark_name = "Equal Weight"
            else:
                bench_turnover = 0.0
            
            benchmark_series = pd.Series(
                [b["value"] for b in benchmark_curve],
                index=pd.to_datetime([b["date"] for b in benchmark_curve], unit="ms")
            )
            
            benchmark_metrics = calculate_metrics(
                benchmark_series, rf_rate_current, 
                0, 0, bench_turnover, 
                annualization_factor=trading_days_per_year
            )
        
        if not method_results:
            raise ValueError("Could not generate results for any method")
        
        # 3. Post-Processing
        job_manager.update_job(job_id, 85, "Calculating Correlation Matrix...")
        
        method_results.sort(key=lambda x: x.performance_metrics.sortino_ratio, reverse=True)
        correlation_matrix = calculate_correlation_matrix(prices)

        job_manager.update_job(job_id, 90, "Calculating Efficient Frontier (CLA)...")
        efficient_frontier_data = calculate_efficient_frontier(
            prices.pct_change().dropna(),
            min_weight=0.0,
            max_weight=1.0,
            frequency=trading_days_per_year
        )

        job_manager.update_job(job_id, 98, "Finalizing Results...")
        
        response = CompareResponse(
            methods=method_results,
            benchmark_curve=benchmark_curve or [],
            benchmark_metrics=benchmark_metrics or calculate_metrics(pd.Series([1.0]), rf_rate_current, 0, 0, 0),
            benchmark_name=benchmark_name,
            tickers=tickers,
            risk_free_rate=round(rf_rate_current, 4),
            data_start_date=prices.index[0].strftime("%Y-%m-%d"),
            data_end_date=prices.index[-1].strftime("%Y-%m-%d"),
            ticker_start_dates=ticker_start_dates,
            limiting_ticker=limiting_ticker,
            correlation_matrix=correlation_matrix,
            efficient_frontier_data=efficient_frontier_data
        )
        
        job_manager.update_job(job_id, 100, "Optimization Complete", status="completed", result=sanitize_nan(response.dict()))

    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        job_manager.update_job(job_id, 0, "Failed", status="failed", error=str(e))


@router.post("/compare/start")
async def start_compare_job(request: CompareRequest, background_tasks: BackgroundTasks):
    """Start the comparison job in background and return job_id."""
    job_id = job_manager.create_job()
    background_tasks.add_task(run_comparison_job, job_id, request)
    return {"job_id": job_id}
