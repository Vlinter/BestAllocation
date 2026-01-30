"""
Full-Stack Quant Portfolio Optimization API
============================================
Institutional-grade Walk-Forward Analysis with HRP, Min CVaR, and Mean-Variance optimization.
Features: Transaction costs, Dynamic risk-free rate, Full historical data
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from datetime import datetime
from typing import Optional, Union
from pathlib import Path
import pandas as pd
import os

# Import modular components

from .schemas import (
    OptimizationRequest, OptimizationResponse, PerformanceMetrics, 
    CurrentAllocation, CompareRequest, CompareResponse, MethodResult, ModelParams
)
from .data_provider import fetch_price_data, get_risk_free_rate, fetch_risk_free_rate_history
from .metrics import calculate_metrics, calculate_drawdown_curve, calculate_correlation_matrix, infer_trading_frequency
from .backtester import walk_forward_backtest, get_custom_benchmark, get_equal_weight_benchmark

# ============================================================================
# FastAPI App Configuration
# ============================================================================

app = FastAPI(
    title="Quant Portfolio Optimizer",
    description="Institutional-grade Walk-Forward Analysis API",
    version="2.3.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


METHOD_NAMES = {
    "hrp": "HRP (Hierarchical Risk Parity)",
    "gmv": "GMV (Global Minimum Variance)",
    "mvo": "MVO (Mean-Variance Max Sharpe)"
}

# Model parameters for transparency
def get_model_params(method: str) -> ModelParams:
    """Return the parameters used by each optimization method."""
    if method == "mvo":
        return ModelParams() # MVO uses mean returns and shrinkage
    elif method == "gmv":
        return ModelParams() # GMV is parameter-free in this context (min vol)
    elif method == "hrp":
        return ModelParams(linkage_method="Ward Linkage")
    return ModelParams()


# ============================================================================
# API Endpoints
# ============================================================================

# API root moved to /api for production (frontend served at /)


@app.get("/health")
async def health():
    rf_rate = get_risk_free_rate()
    return {"status": "healthy", "current_risk_free_rate": rf_rate}


@app.post("/optimize", response_model=OptimizationResponse)
async def optimize_portfolio(request: OptimizationRequest):
    """Run Walk-Forward Analysis with transaction costs and dynamic risk-free rate."""
    
    # Get dynamic risk-free rate from Treasury
    rf_rate_current = get_risk_free_rate()
    # Fetch full history for backtest accuracy
    risk_free_rate_series = fetch_risk_free_rate_history(request.start_date, request.end_date)
    risk_free_rate = risk_free_rate_series if not risk_free_rate_series.empty else rf_rate_current
    
    # Clean tickers
    tickers = [t.strip().upper() for t in request.tickers]
    if len(tickers) < 2:
        raise HTTPException(status_code=400, detail="At least 2 tickers required")
    
    # Determine dates
    end_date = request.end_date if request.end_date else datetime.now().strftime("%Y-%m-%d")
    start_date = request.start_date  # Can be None for full history
    
    # Fetch data
    prices, ticker_start_dates, limiting_ticker = fetch_price_data(tickers, start_date, end_date)
    
    # Infer Frequency
    trading_days_per_year = infer_trading_frequency(prices.index)

    # Run backtest
    (equity_curve, benchmark_curve, allocation_history, rebalance_dates, 
     current_weights, total_costs, total_turnover, _, risk_contributions, benchmark_turnover, dendrogram_data) = walk_forward_backtest(
        prices=prices,
        method=request.method,
        training_window=request.training_window,
        rebalancing_window=request.rebalancing_window,
        risk_free_rate=risk_free_rate,
        transaction_cost_bps=request.transaction_cost_bps
    )
    
    if not equity_curve:
        raise HTTPException(status_code=400, detail="Could not generate backtest results")
    
    # Calculate additional curves
    drawdown_curve = calculate_drawdown_curve(equity_curve)

    
    # Calculate annualized turnover
    years = len(equity_curve) / trading_days_per_year
    annualized_turnover = total_turnover / max(years, 0.01)
    
    # Metrics
    equity_series = pd.Series(
        [e["value"] for e in equity_curve],
        index=pd.to_datetime([e["date"] for e in equity_curve], unit="ms")
    )
    
    benchmark_series = pd.Series(
        [b["value"] for b in benchmark_curve],
        index=pd.to_datetime([b["date"] for b in benchmark_curve], unit="ms")
    )
    
    performance_metrics = calculate_metrics(equity_series, rf_rate_current, total_costs, len(rebalance_dates), annualized_turnover, annualization_factor=trading_days_per_year)
    benchmark_metrics = calculate_metrics(benchmark_series, rf_rate_current, 0, 0, benchmark_turnover, annualization_factor=trading_days_per_year)
    
    # Current allocation for today's recommendation
    current_alloc = CurrentAllocation(
        date=datetime.now().strftime("%Y-%m-%d"),
        weights=current_weights or {},
        risk_contributions=risk_contributions or {},
        method=request.method,
        dendrogram_data=dendrogram_data
    )
    
    return OptimizationResponse(
        equity_curve=equity_curve,
        benchmark_curve=benchmark_curve,
        drawdown_curve=drawdown_curve,

        performance_metrics=performance_metrics,
        benchmark_metrics=benchmark_metrics,
        allocation_history=allocation_history,
        rebalance_dates=rebalance_dates,
        current_allocation=current_alloc,
        tickers=tickers,
        method=request.method,
        risk_free_rate=round(rf_rate_current, 4),
        data_start_date=prices.index[0].strftime("%Y-%m-%d"),
        data_end_date=prices.index[-1].strftime("%Y-%m-%d")
    )


# ============================================================================
# Job System for Asynchronous Processing
# ============================================================================

import uuid
import uuid
from fastapi import BackgroundTasks
from concurrent.futures import ThreadPoolExecutor, as_completed

# Simple in-memory job store
# Structure: job_id -> { "status": str, "progress": int, "message": str, "result": dict, "error": str }
jobs = {}

def update_job(job_id: str, progress: int, message: str):
    """Update job progress safely."""
    if job_id in jobs:
        jobs[job_id]["progress"] = progress
        jobs[job_id]["message"] = message

def _run_strategy(
    method: str,
    prices: pd.DataFrame,
    request: CompareRequest,
    risk_free_rate: Union[float, pd.Series],
    trading_days_per_year: int,
    cvar_alpha: float,
    job_id: str,
    progress_callback
) -> Optional[MethodResult]:
    """Helper to run a single strategy and return formatted results."""
    try:
        (equity_curve, bench_curve, allocation_history, rebalance_dates, 
         current_weights, total_costs, total_turnover, overfitting_metrics,
         risk_contributions, bench_turnover_val, dendrogram_data_comp) = walk_forward_backtest(
            prices=prices,
            method=method,
            training_window=request.training_window,
            rebalancing_window=request.rebalancing_window,
            risk_free_rate=risk_free_rate,
            transaction_cost_bps=request.transaction_cost_bps,
            min_weight=request.min_weight,
            max_weight=request.max_weight,
            cvar_alpha=cvar_alpha,
            progress_callback=progress_callback
        )
        
        if not equity_curve:
            return None
        
        # Metrics Calculation
        drawdown_curve = calculate_drawdown_curve(equity_curve)

        
        equity_series = pd.Series(
            [e["value"] for e in equity_curve],
            index=pd.to_datetime([e["date"] for e in equity_curve], unit="ms")
        )
        
        years = len(equity_curve) / trading_days_per_year
        annualized_turnover = total_turnover / max(years, 0.01)
        
        # Note: Benchmark returns are needed for Alpha/Beta. 
        # We calculate them later in the main loop or pass them in?
        # For simplicity, calculate metrics without benchmark first, or handle it in main loop.
        # Actually, performance_metrics needs benchmark_returns for full stats.
        # But `walk_forward_backtest` returns `bench_curve`. We can use that.
        
        benchmark_series = pd.Series(
             [b["value"] for b in bench_curve],
             index=pd.to_datetime([b["date"] for b in bench_curve], unit="ms")
        )
        benchmark_returns = benchmark_series.pct_change().dropna()
        
        # Derive scalar RF for metrics (Approximate using mean or current)
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
        jobs[job_id]["status"] = "processing"
        update_job(job_id, 5, "Fetching Historical Market Data...")
        
        # 1. Setup & Data Fetching
        rf_rate_current = get_risk_free_rate()
        risk_free_rate_series = fetch_risk_free_rate_history(request.start_date, request.end_date)
        backtest_rf_input = risk_free_rate_series if not risk_free_rate_series.empty else rf_rate_current

        tickers = [t.strip().upper() for t in request.tickers]
        
        if len(tickers) < 2:
            raise ValueError("At least 2 tickers required")
        
        end_date = request.end_date if request.end_date else datetime.now().strftime("%Y-%m-%d")
        start_date = request.start_date
        
        prices, ticker_start_dates, limiting_ticker = fetch_price_data(tickers, start_date, end_date)
        
        # Infer Frequency
        trading_days_per_year = infer_trading_frequency(prices.index)
        
        update_job(job_id, 15, "Preparing Backtest Engine...")
        
        # CVaR alpha - Ignored for GMV
        cvar_alpha = 0.05 
        
        methods_to_run = ["hrp", "gmv", "mvo"]
        method_results = []
        benchmark_curve = None
        benchmark_metrics = None
        benchmark_name = "Equal Weight"
        
        # 2. Run Methods Parallel (Progress 15% -> 85%)
        total_methods = len(methods_to_run)
        # Calculate progress increment per method
        progress_per_method = 70 // total_methods
        completed_methods = 0
        
        update_job(job_id, 15, f"Running {', '.join([m.upper() for m in methods_to_run])} in parallel...")
        
        # No-op callback for inner progress to avoid racing/jitter in the main progress bar
        # (Inner methods run on threads, updating a shared var would be messy without a lock)
        noop_callback = lambda p: None
        
        with ThreadPoolExecutor(max_workers=min(total_methods, 4)) as executor:
            future_to_method = {
                executor.submit(
                    _run_strategy,
                    method, 
                    prices, 
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
                
                # Update progress
                completed_methods += 1
                current_progress = 15 + (completed_methods * progress_per_method)
                update_job(job_id, int(current_progress), f"Completed {METHOD_NAMES.get(method, method)}...")

        # Benchmark Logic (Runs once we have results, or parallelize too? Fast enough to run here)
        if method_results:
             # Just use the first result to get the benchmark curve if available?
             # _run_strategy calculates metrics but doesn't return the raw benchmark curve object conveniently 
             # attached to MethodResult (it's in the tuple but MethodResult structure is fixed).
             # We need to re-generate it to be safe and consistent.
             
            if request.benchmark_type == "custom" and request.benchmark_ticker:
                benchmark_curve, benchmark_name = get_custom_benchmark(
                    prices, request.training_window, request.benchmark_ticker
                )
            
            if not benchmark_curve:
                # Use Equal Weight
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
        
        # 3. Post-Processing & Efficient Frontier (85% -> 99%)
        update_job(job_id, 85, "Calculating Correlation Matrix...")
        
        # Sort results
        method_results.sort(key=lambda x: x.performance_metrics.sortino_ratio, reverse=True)
        
        correlation_matrix = calculate_correlation_matrix(prices)

        update_job(job_id, 90, "Running Monte Carlo Simulations (2,000 runs)...")
        from .optimization import calculate_efficient_frontier
        efficient_frontier_data = calculate_efficient_frontier(
            prices.pct_change().dropna(),
            min_weight=request.min_weight,
            max_weight=request.max_weight,
            frequency=trading_days_per_year
        )

        update_job(job_id, 98, "Finalizing Results...")
        
        # Construct Final Response
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
        
        jobs[job_id]["result"] = response.dict()
        jobs[job_id]["status"] = "completed"
        jobs[job_id]["progress"] = 100
        jobs[job_id]["message"] = "Optimization Complete"

    except Exception as e:
        print(f"Job failed: {e}")
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)
        jobs[job_id]["message"] = "Failed"


@app.post("/compare/start")
async def start_compare_job(request: CompareRequest, background_tasks: BackgroundTasks):
    """Start the comparison job in background and return job_id."""
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "queued",
        "progress": 0,
        "message": "Initializing...",
        "result": None,
        "error": None
    }
    background_tasks.add_task(run_comparison_job, job_id, request)
    return {"job_id": job_id}


@app.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get the current status of a job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs[job_id]
    # We return a subset or the full job object (excluding result if it's huge, but here result is fine)
    # Actually, let's keep result separate to keep polling light? 
    # No, for simplicity let's return everything, frontend can grab result when status=completed.
    
    return job


@app.get("/health")
async def health_check():
    """Health check endpoint for Railway."""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


# Serve frontend static files in production
# Check if frontend/dist exists (production build)
FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"

if FRONTEND_DIR.exists():
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")
    
    # Catch-all route for SPA - must be last!
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve the React SPA for all non-API routes."""
        # If it's an API route, this won't match (API routes defined above)
        file_path = FRONTEND_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        # Return index.html for SPA routing
        return FileResponse(FRONTEND_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
