from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Union, Optional
from datetime import datetime
import pandas as pd
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

# Import from new structure
from ..core.schemas import (
    PerformanceMetrics,
    CurrentAllocation, CompareRequest, CompareResponse, MethodResult, ModelParams
)
from ..services.jobs import job_manager

# Import from original backend root (still there until fully moved)
# We need to fix imports in these files or move them too. 
# For now, we assume we can import them from parent (backend)
# BUT backend is not a package unless we run from root.
# We will use absolute imports assuming the app is run from root.

from backend.data_provider import fetch_price_data, get_risk_free_rate, fetch_risk_free_rate_history
from backend.metrics import (
    calculate_metrics, calculate_drawdown_curve, calculate_correlation_matrix,
    infer_trading_frequency, calculate_stress_tests, calculate_rolling_sharpe,
    calculate_monthly_returns, calculate_yearly_returns
)
from backend.backtester import walk_forward_backtest, get_custom_benchmark, get_equal_weight_benchmark
from backend.optimization import calculate_efficient_frontier
from backend.strategies import STRATEGY_IDS, display_name, get_strategy
from backend.significance import (
    annualized_sharpe, compute_significance, edge_statistics, predictive_power
)

router = APIRouter()
logger = logging.getLogger(__name__)


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

def downsample_curve(curve_data: list, max_points: int = 500) -> list:
    """
    Downsample a time series curve to reduce JSON payload size.

    The LAST point is always kept. `int(i * step)` for i < max_points never
    reaches len-1, so the displayed curve used to stop up to `step` points
    early: on a 20-year backtest the equity chart ended nine trading days
    before the backtest did, showing +332.40% where the metrics table — built
    on the full curve — said +342.27%. Two numbers for the same quantity, side
    by side on the same tab.

    May return max_points + 1 entries; the payload saving is unaffected.
    """
    if not curve_data or len(curve_data) <= max_points:
        return curve_data

    step = len(curve_data) / max_points
    indices = sorted({int(i * step) for i in range(max_points)} | {len(curve_data) - 1})
    return [curve_data[i] for i in indices]


# Model parameters helper — the values live in the strategy registry.
def get_model_params(method: str) -> ModelParams:
    strategy = get_strategy(method)
    return ModelParams(**strategy.params) if strategy else ModelParams()


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
        "methods": list(STRATEGY_IDS),
        "features": ["walk_forward", "transaction_costs", "volatility_scaling"]
    }

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get the current status of a job."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return sanitize_nan(job)

# Strategy Runner Logic
def _run_strategy(
    method: str,
    prices: pd.DataFrame,
    open_prices: pd.DataFrame,
    request: CompareRequest,
    risk_free_rate: Union[float, pd.Series],
    rf_metrics: float,
    trading_days_per_year: int,
    cvar_alpha: float,
    benchmark_returns: Optional[pd.Series],
    progress_callback
) -> Optional[tuple]:
    """
    Run one strategy end-to-end.

    risk_free_rate: scalar or full FRED series, used INSIDE the backtest
                    (cash accrual, go-to-cash decisions).
    rf_metrics:     single scalar (mean of the series over the backtest window),
                    used for ALL performance metrics — the same value is used for
                    the benchmark metrics so Sharpe ratios are directly comparable.
    benchmark_returns: daily returns of the benchmark the USER selected
                    (custom ticker or equal-weight), so alpha/beta are measured
                    against what is actually displayed as "Benchmark".

    Returns (MethodResult, full-resolution daily returns). The second element
    never goes to the client — it feeds the cross-strategy significance tests,
    which must NOT run on the downsampled display curves.
    """
    try:
        (equity_curve, allocation_history, rebalance_dates,
         current_weights, total_costs, annualized_turnover_pct, overfitting_metrics,
         risk_contributions, dendrogram_data_comp) = walk_forward_backtest(
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

        performance_metrics = calculate_metrics(
            equity_series, rf_metrics, total_costs,
            len(rebalance_dates), annualized_turnover_pct,
            benchmark_returns=benchmark_returns,
            annualization_factor=trading_days_per_year
        )

        # Full-resolution analytics — MUST be computed before downsampling:
        # crisis windows and rolling Sharpe need daily granularity.
        stress_tests = calculate_stress_tests(equity_curve)
        rolling_sharpe = calculate_rolling_sharpe(
            equity_curve, risk_free_rate=rf_metrics,
            annualization_factor=trading_days_per_year
        )
        # The returns-distribution card bins these and the performance histogram
        # labels one bar per period; deriving either client-side from the
        # 500-point display curve distorted every statistic they show.
        monthly_returns = calculate_monthly_returns(equity_curve)
        yearly_returns = calculate_yearly_returns(equity_curve)

        # --- Per-period edge over the benchmark -----------------------------
        # The raw predicted/realized Sharpe levels share the market regime,
        # which dominates their variance; the difference against the benchmark
        # on the SAME window removes it and is what the diagnostic reports.
        if benchmark_returns is not None and len(benchmark_returns) > 10:
            bounds = [pd.Timestamp(d) for d in rebalance_dates] + [equity_series.index[-1]]
            for i, entry in enumerate(overfitting_metrics):
                # The strategy's realized Sharpe is measured on the closes from
                # the execution day (T+1) onwards, so its first RETURN is that
                # of T+2. `.iloc[1:]` drops the same leading day on the
                # benchmark: without it the two Sharpes would not cover the
                # same days, and on a 63-day window one day is enough to move
                # the edge by more than its own standard error.
                block = benchmark_returns[
                    (benchmark_returns.index > bounds[i]) & (benchmark_returns.index <= bounds[i + 1])
                ].iloc[1:]
                bench_sharpe = annualized_sharpe(
                    block.values, rf_metrics, trading_days_per_year
                ) if len(block) >= 3 else 0.0
                entry["realized_sharpe_benchmark"] = round(float(bench_sharpe), 4)
                entry["predicted_edge"] = round(
                    float(entry["predicted_sharpe"] - entry.get("predicted_sharpe_ew", 0.0)), 4)
                entry["realized_edge"] = round(float(entry["realized_sharpe"] - bench_sharpe), 4)

        # Cash periods carry degenerate (0, 0) placeholders: excluded, as always.
        usable = [e for e in overfitting_metrics if not e.get("is_cash")]
        power = predictive_power(
            [e["predicted_sharpe"] for e in usable],
            [e["realized_sharpe"] for e in usable],
            holding_days=request.rebalancing_window,
            annualization_factor=trading_days_per_year,
        ) if usable else None
        edges = edge_statistics([e.get("realized_edge", 0.0) for e in usable]) if usable else None

        # Fallbacks are already flagged per period in allocation_history; count
        # them so the dashboard can say so instead of leaving the information
        # buried in the shading of the allocation chart.
        n_fallbacks = sum(1 for a in allocation_history if a.get("_fallback"))
        last_was_fallback = bool(allocation_history and allocation_history[-1].get("_fallback"))

        current_alloc = CurrentAllocation(
            date=datetime.now().strftime("%Y-%m-%d"),
            weights=current_weights or {},
            risk_contributions=risk_contributions or {},
            method=method,
            fallback_used=last_was_fallback,
            fallback_reason=(
                f"The optimizer failed on this rebalance and defaulted to cash "
                f"({n_fallbacks} of {len(allocation_history)} rebalances over the backtest)."
                if last_was_fallback else None
            ),
            dendrogram_data=dendrogram_data_comp
        )

        method_params = get_model_params(method)

        # Downsample for network payload efficiency (display only)
        equity_curve_payload = downsample_curve(equity_curve, 500)
        drawdown_curve_payload = downsample_curve(drawdown_curve, 500)
        rolling_sharpe_payload = downsample_curve(rolling_sharpe, 500)

        result = MethodResult(
            method=method,
            method_name=display_name(method),
            equity_curve=equity_curve_payload,
            drawdown_curve=drawdown_curve_payload,
            performance_metrics=performance_metrics,
            current_allocation=current_alloc,
            allocation_history=allocation_history,
            overfitting_metrics=overfitting_metrics,
            method_params=method_params,
            stress_tests=stress_tests,
            rolling_sharpe=rolling_sharpe_payload,
            monthly_returns=monthly_returns,
            yearly_returns=yearly_returns,
            predictive_power=power,
            edge_stats=edges,
        )
        return result, equity_series.pct_change().dropna()
    except HTTPException:
        # Actionable, user-facing rejections ("Not enough data. Need at least N
        # points.") must survive: swallowing them here left the caller with
        # three empty results and a generic "could not generate results for any
        # method", hiding the one sentence that says how to fix the request.
        raise
    except Exception as e:
        logger.error(f"Error in method {method}: {e}", exc_info=True)
        return None

def run_comparison_job(job_id: str, request: CompareRequest):
    """Background task to run the comparison logic."""
    try:
        job_manager.update_job(job_id, 5, "Fetching Historical Market Data...", status="processing")

        # 1. Setup & Data Fetching
        rf_rate_current = get_risk_free_rate()
        risk_free_rate_series = fetch_risk_free_rate_history(request.start_date, request.end_date)
        backtest_rf_input = risk_free_rate_series if not risk_free_rate_series.empty else rf_rate_current

        tickers = list(request.tickers)  # already normalized (upper/strip) by the schema

        end_date = request.end_date if request.end_date else datetime.now().strftime("%Y-%m-%d")
        start_date = request.start_date

        prices, open_prices, ticker_start_dates, limiting_ticker = fetch_price_data(tickers, start_date, end_date)

        trading_days_per_year = infer_trading_frequency(prices.index)

        # Unified risk-free scalar for ALL performance metrics (strategies AND
        # benchmark): mean of the historical T-Bill series over the actual
        # backtest window. Using different rates (e.g. today's rate for the
        # benchmark, a long-run mean for strategies) would skew Sharpe comparisons.
        bt_index = prices.index[min(request.training_window, max(len(prices.index) - 1, 0)):]
        if isinstance(backtest_rf_input, pd.Series) and len(bt_index) > 0:
            rf_window = backtest_rf_input.loc[
                (backtest_rf_input.index >= bt_index[0]) & (backtest_rf_input.index <= bt_index[-1])
            ]
            rf_metrics = float(rf_window.mean()) if not rf_window.empty else float(rf_rate_current)
        else:
            rf_metrics = float(backtest_rf_input) if not isinstance(backtest_rf_input, pd.Series) else float(rf_rate_current)

        job_manager.update_job(job_id, 12, "Building Benchmark...")

        # 2. Benchmark FIRST — the per-strategy alpha/beta must be measured
        # against the benchmark the user actually selected and sees on screen.
        benchmark_curve = None
        benchmark_name = "Equal Weight"
        bench_turnover = 0.0
        # A custom benchmark is a reference index, shown gross by convention, so
        # it genuinely has no costs. The equal-weight one is a traded strategy
        # and pays exactly what the strategies pay — reporting 0 for it made the
        # most expensive line on the board look free.
        bench_costs = 0.0
        bench_rebalances = 0
        if request.benchmark_type == "custom" and request.benchmark_ticker:
            benchmark_curve, benchmark_name = get_custom_benchmark(
                prices, request.training_window, request.benchmark_ticker
            )
        if not benchmark_curve:
            benchmark_curve, bench_turnover, bench_costs = get_equal_weight_benchmark(
                prices, request.training_window, tickers,
                request.rebalancing_window, request.transaction_cost_bps
            )
            benchmark_name = "Equal Weight"
            if benchmark_curve and request.rebalancing_window > 0:
                # Same schedule as the strategies: one deployment plus one
                # rebalance per completed window.
                bench_rebalances = 1 + (len(benchmark_curve) - 1) // request.rebalancing_window

        benchmark_series = pd.Series(
            [b["value"] for b in benchmark_curve],
            index=pd.to_datetime([b["date"] for b in benchmark_curve], unit="ms")
        )
        benchmark_returns = benchmark_series.pct_change().dropna()

        job_manager.update_job(job_id, 15, "Preparing Backtest Engine...")

        cvar_alpha = 1.0 - request.cvar_confidence
        methods_to_run = list(STRATEGY_IDS)
        method_results = []
        method_returns = {}   # full-resolution daily returns, for the significance tests

        # 3. Parallel Execution
        total_methods = len(methods_to_run)

        job_manager.update_job(job_id, 15, f"Running {', '.join([m.upper() for m in methods_to_run])} in parallel...")

        method_progress = {m: 0.0 for m in methods_to_run}
        first_rejection: Optional[HTTPException] = None

        def make_progress_callback(method_name):
            def callback(p):
                method_progress[method_name] = p
                total_p = sum(method_progress.values()) / total_methods
                current_progress = 15 + (total_p * 70)
                job_manager.update_job(
                    job_id,
                    int(current_progress),
                    f"Optimizing ({int(total_p * 100)}%)"
                )
            return callback

        with ThreadPoolExecutor(max_workers=min(total_methods, 4)) as executor:
            future_to_method = {
                executor.submit(
                    _run_strategy,
                    method,
                    prices,
                    open_prices,
                    request,
                    backtest_rf_input,
                    rf_metrics,
                    trading_days_per_year,
                    cvar_alpha,
                    benchmark_returns,
                    make_progress_callback(method)
                ): method
                for method in methods_to_run
            }

            for future in as_completed(future_to_method):
                method = future_to_method[future]
                try:
                    outcome = future.result()
                    if outcome:
                        result, daily_returns = outcome
                        method_results.append(result)
                        method_returns[result.method_name] = daily_returns
                except HTTPException as exc:
                    # All three methods hit the same wall (too little history,
                    # unusable tickers), so keep the first message and re-raise
                    # it below rather than reporting "no results".
                    logger.warning(f"Strategy {method} rejected: {exc.detail}")
                    if first_rejection is None:
                        first_rejection = exc
                except Exception as exc:
                    logger.error(f"Strategy {method} generated an exception: {exc}", exc_info=True)

                # Make sure this method is marked 100% complete internally
                method_progress[method] = 1.0
                total_p = sum(method_progress.values()) / total_methods
                current_progress = 15 + (total_p * 70)
                job_manager.update_job(job_id, int(current_progress), f"Completed {display_name(method)}...")

        if not method_results:
            if first_rejection is not None:
                raise first_rejection
            raise ValueError("Could not generate results for any method")

        benchmark_metrics = calculate_metrics(
            benchmark_series, rf_metrics,
            bench_costs, bench_rebalances, bench_turnover,
            annualization_factor=trading_days_per_year
        )
        
        # 3. Post-Processing
        job_manager.update_job(job_id, 84, "Testing statistical significance...")

        # Cross-strategy tests: bootstrap CI on the Sharpe gaps, PBO (CSCV) and
        # Deflated Sharpe. They need every candidate at once and full-resolution
        # daily returns, hence here rather than inside a single strategy run.
        significance = None
        try:
            significance = compute_significance(
                method_returns=method_returns,
                benchmark_returns=benchmark_returns,
                benchmark_name=benchmark_name,
                risk_free_rate=rf_metrics,
                annualization_factor=trading_days_per_year,
            )
        except Exception as exc:
            logger.warning(f"Significance tests failed: {exc}", exc_info=True)

        job_manager.update_job(job_id, 88, "Calculating Correlation Matrix...")
        
        method_results.sort(key=lambda x: x.performance_metrics.sortino_ratio, reverse=True)
        
        # Collect bias/caveat warnings
        data_warnings = []
        data_warnings.append(
            "Survivorship Bias: Tickers selected today may not represent the full investment universe "
            "available historically. Delisted or failed assets are excluded — past performance is overstated."
        )
        if request.min_weight > 0 or request.max_weight < 1:
            data_warnings.append(
                "HRP ignores min/max weight constraints by design (López de Prado, 2016). "
                "The recursive bisection naturally produces diversified weights. "
                "Constraints only apply to CVaR and MVO."
            )
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
            benchmark_curve=downsample_curve(benchmark_curve, 500) if benchmark_curve else [],
            benchmark_metrics=benchmark_metrics or PerformanceMetrics(
                sharpe_ratio=0, sortino_ratio=0, max_drawdown=0, cagr=0,
                total_return=0, volatility=0, calmar_ratio=0,
                total_transaction_costs=0, num_rebalances=0, annualized_turnover=0
            ),
            benchmark_name=benchmark_name,
            tickers=tickers,
            risk_free_rate=round(rf_metrics, 4),
            data_start_date=prices.index[0].strftime("%Y-%m-%d"),
            data_end_date=prices.index[-1].strftime("%Y-%m-%d"),
            ticker_start_dates=ticker_start_dates,
            limiting_ticker=limiting_ticker,
            correlation_matrix=correlation_matrix,
            efficient_frontier_data=efficient_frontier_data,
            warnings=data_warnings,
            significance=significance,
            benchmark_stress_tests=calculate_stress_tests(benchmark_curve),
        )

        job_manager.update_job(job_id, 100, "Optimization Complete", status="completed",
                               result=sanitize_nan(response.model_dump()))

    except HTTPException as e:
        # Intentional, user-actionable messages (bad tickers, not enough data...)
        logger.warning(f"Job {job_id} rejected: {e.detail}")
        job_manager.update_job(job_id, 0, "Failed", status="failed", error=str(e.detail))
    except ValueError as e:
        # Our own validation errors — safe to show
        logger.warning(f"Job {job_id} invalid: {e}")
        job_manager.update_job(job_id, 0, "Failed", status="failed", error=str(e))
    except Exception as e:
        # Unexpected internal errors: full detail in server logs only,
        # generic message to the client (no paths, no stack fragments).
        logger.error(f"Job {job_id} failed: {e}", exc_info=True)
        job_manager.update_job(
            job_id, 0, "Failed", status="failed",
            error="Internal error during computation. Please try again or adjust your parameters."
        )


@router.post("/compare/start")
async def start_compare_job(request: CompareRequest, background_tasks: BackgroundTasks):
    """Start the comparison job in background and return job_id."""
    job_id = job_manager.create_job()
    background_tasks.add_task(run_comparison_job, job_id, request)
    return {"job_id": job_id}
