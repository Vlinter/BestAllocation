import pandas as pd
from typing import Tuple, List, Dict, Optional, Union
import numpy as np
from fastapi import HTTPException


from .optimization import get_optimizer, optimize_with_fallback, OptimizationResult
from .config import (
    TRADING_DAYS_PER_YEAR, TURNOVER_SMOOTHING_FACTOR,
    TARGET_VOLATILITY, VOLATILITY_LOOKBACK, ENABLE_VOLATILITY_SCALING
)
# Import the new helper
from .metrics import infer_trading_frequency


# ============================================================================
# Quant Enhancement Functions
# ============================================================================

def smooth_weights(
    new_weights: Dict[str, float],
    old_weights: Dict[str, float],
    smoothing_factor: float = TURNOVER_SMOOTHING_FACTOR
) -> Dict[str, float]:
    """
    Apply exponential smoothing to reduce turnover.
    
    Formula: smoothed = (1 - α) × new + α × old
    
    Args:
        new_weights: Target weights from optimizer
        old_weights: Previous period weights
        smoothing_factor: 0.0 = full rebalance, 1.0 = no change
    
    Returns:
        Smoothed weights that reduce trading
    """
    if not old_weights or smoothing_factor <= 0:
        return new_weights
    
    tickers = set(new_weights.keys()) | set(old_weights.keys())
    smoothed = {}
    
    for t in tickers:
        new_w = new_weights.get(t, 0.0)
        old_w = old_weights.get(t, 0.0)
        smoothed[t] = (1 - smoothing_factor) * new_w + smoothing_factor * old_w
    
    # Do NOT renormalize here. 
    # If new_weights sum to 0 (Cash) and old_weights sum to 1, 
    # the result should sum to (0.3) -> 30% invested, 70% cash.
    # Renormalizing would force it back to 100% invested (preventing exit to cash).
    
    return smoothed


def apply_volatility_scaling(
    weights: Dict[str, float],
    returns: pd.DataFrame,
    target_vol: float = TARGET_VOLATILITY,
    lookback: int = VOLATILITY_LOOKBACK,
    trading_days: int = TRADING_DAYS_PER_YEAR
) -> Tuple[Dict[str, float], float]:
    """
    Scale portfolio weights to target a specific volatility.
    
    When realized volatility > target, reduce exposure (increase cash).
    When realized volatility < target, maintain full exposure (but don't lever).
    
    Args:
        weights: Target weights from optimizer
        returns: Historical returns for vol estimation
        target_vol: Annualized target volatility (e.g., 0.10 = 10%)
        lookback: Days for rolling vol estimation
        trading_days: Annualization factor
    
    Returns:
        (scaled_weights, cash_allocation)
    """
    if not weights or sum(weights.values()) < 0.001:
        return weights, 0.0
    
    # Use recent returns for vol estimation
    recent_returns = returns.iloc[-lookback:] if len(returns) >= lookback else returns
    
    if recent_returns.empty:
        return weights, 0.0
    
    # Calculate portfolio volatility with current weights
    w_vec = np.array([weights.get(col, 0.0) for col in recent_returns.columns])
    port_returns = recent_returns.values @ w_vec
    
    # Annualized volatility
    realized_vol = np.std(port_returns) * np.sqrt(trading_days)
    
    if realized_vol < 1e-6:
        return weights, 0.0
    
    # Calculate scaling factor (cap at 1.0 - no leverage)
    scale = min(1.0, target_vol / realized_vol)
    
    # Scale down weights
    scaled_weights = {k: v * scale for k, v in weights.items()}
    cash_allocation = 1.0 - sum(scaled_weights.values())
    
    if scale < 1.0:
        print(f"Vol Scaling: Realized vol {realized_vol:.1%} > Target {target_vol:.1%}. Scale={scale:.2f}, Cash={cash_allocation:.1%}")
    
    return scaled_weights, max(0.0, cash_allocation)


# ============================================================================
# Walk-Forward Analysis Engine (Share-Based / Realistic)
# ============================================================================

def calculate_portfolio_sharpe_weights(returns: pd.DataFrame, weights: Dict[str, float], annualization_factor: int = TRADING_DAYS_PER_YEAR) -> float:
    """
    Calculate annualized Sharpe ratio for a CONSTANT WEIGHT portfolio (rebalanced daily).
    Used primarily for the 'Predicted' (In-Sample) metric.
    """
    if returns.empty:
        return 0.0
    
    # Vectorized calculation
    # returns: T x N, weights: N
    # port_ret: T
    
    # Align weights to columns
    w_vec = np.array([weights.get(col, 0.0) for col in returns.columns])
    
    port_returns = returns.values @ w_vec
    
    mean = np.mean(port_returns)
    std = np.std(port_returns)
    
    if std > 1e-6:
        sharpe = (mean / std) * np.sqrt(annualization_factor)
        return max(min(sharpe, 20.0), -20.0)
    return 0.0


def calculate_realized_sharpe_shares(portfolio_values: List[float], annualization_factor: int = TRADING_DAYS_PER_YEAR) -> float:
    """
    Calculate realized Sharpe from the actual equity curve section.
    """
    if len(portfolio_values) < 2:
        return 0.0
    
    series = pd.Series(portfolio_values)
    rets = series.pct_change().dropna()
    
    mean = rets.mean()
    std = rets.std()
    
    # Increase threshold to avoid noise-induced infinity during Cash periods
    if std > 1e-6:
        sharpe = (mean / std) * np.sqrt(annualization_factor)
        # Cap Sharpe at 20 to prevent chart scaling issues (Cash artifacts)
        return max(min(sharpe, 20.0), -20.0)
    return 0.0


def walk_forward_backtest(
    prices: pd.DataFrame,
    open_prices: pd.DataFrame,  # NEW: Open prices for T+1 execution
    method: str,
    training_window: int,
    rebalancing_window: int,
    risk_free_rate: Union[float, pd.Series],
    transaction_cost_bps: float,
    min_weight: float = 0.0,
    max_weight: float = 1.0,
    cvar_alpha: float = 0.05,
    enable_volatility_scaling: bool = False,
    target_volatility: float = 0.12,
    progress_callback = None # Optional callback(float) 0-1
) -> Tuple[List[Dict], List[Dict], List[Dict], List[str], Dict, float, float, List[Dict], Dict, float, Optional[Dict]]:
    """
    Execute a Walk-Forward Backtest using Share-Based Logic (Realistic).
    
    REALISTIC EXECUTION MODEL:
    - Optimization: Uses Close prices up to day T (point-in-time, no look-ahead)
    - Execution: Trades at Open of day T+1 (realistic, can't execute at price just discovered)
    - Valuation: Uses Close prices for end-of-day portfolio value
    
    This eliminates the subtle look-ahead bias present in most backtests.
    """
    tickers = list(prices.columns)
    optimizer = get_optimizer(method)
    
    # Ensure prices are numeric and handle NaNs
    prices_clean = prices.apply(pd.to_numeric, errors='coerce').ffill().dropna()
    open_prices_clean = open_prices.apply(pd.to_numeric, errors='coerce').ffill().dropna()
    
    # Align indices
    common_idx = prices_clean.index.intersection(open_prices_clean.index)
    prices_clean = prices_clean.loc[common_idx]
    open_prices_clean = open_prices_clean.loc[common_idx]
    
    if len(prices_clean) < training_window + 1:
        raise HTTPException(status_code=400, detail=f"Not enough data. Need at least {training_window + 1} points.")

    # Infer trading frequency (Crypto vs Stocks)
    # Use the full index for best detection
    trading_days_per_year = infer_trading_frequency(prices_clean.index)
    if trading_days_per_year == 365:
        print("Detected Crypto/24-7 market data. Using 365 days for annualization.")
    
    returns = prices_clean.pct_change().iloc[1:] # Drop first NaN
    
    # Storage
    equity_curve = []
    allocation_history = []
    rebalance_dates = []
    overfitting_metrics = [] # Predicted (IS) vs Realized (OOS) Sharpe
    
    # Initial State
    # Start with an arbitrary cash amount, e.g., 1.0 (Unit Value)
    portfolio_value = 1.0 
    current_shares = {t: 0.0 for t in tickers}
    cash_balance = 0.0
    
    total_transaction_costs = 0.0
    total_turnover = 0.0
    transaction_cost_pct = transaction_cost_bps / 10000.0
    
    # Indices
    dates = prices_clean.index
    
    # We will step through time blocks of size 'rebalancing_window'
    # Start index is training_window.
    # Note: 'returns' index `i` corresponds to price change from `i` to `i+1`.
    # We align via dates.
    
    current_idx = training_window
    
    # Initial Optimization
    # We optimized using data UP TO start_date.
    
    final_risk_contributions = {}
    last_weights = {}
    latest_dendrogram_data = None

    while current_idx < len(dates):
        # 1. Period Setup
        current_date = dates[current_idx]
        
        # training_returns: [current_idx - train_win : current_idx]
        # (This is strict "point-in-time", using only past data)
        train_returns = returns.loc[:current_date].iloc[-training_window-1:-1]
        if train_returns.empty:
             # Should not happen given check above
             current_idx += rebalancing_window
             continue

        # 2. RUN OPTIMIZATION
        try:
            # Determine applicable RF rate for this rebalance decision
            if isinstance(risk_free_rate, pd.Series):
                # Use the rate known at current_date
                current_rf_annual = float(risk_free_rate.asof(current_date))
                if pd.isna(current_rf_annual):
                    current_rf_annual = 0.04 # Fallback
            else:
                current_rf_annual = float(risk_free_rate)

            # Detect MVO-specific "Risk Off" condition or other logic
            opt_result = optimize_with_fallback(
                train_returns, 
                method=method,
                risk_free_rate=current_rf_annual,
                min_weight=min_weight,
                max_weight=max_weight,
                alpha=cvar_alpha,
                frequency=trading_days_per_year
            )
            target_weights = opt_result.weights
            fallback_flag = opt_result.fallback_used
            if opt_result.dendrogram_data:
                latest_dendrogram_data = opt_result.dendrogram_data
        except Exception as e:
            print(f"Optimization failed at {current_date}: {e}, using EW")
            target_weights = {t: 1.0/len(tickers) for t in tickers}
            fallback_flag = True

        # =================================================================
        # QUANT ENHANCEMENTS: Apply smoothing and volatility scaling
        # =================================================================
        
        # 2a. Turnover Smoothing - Reduce trading by blending with previous weights
        if last_weights:
            target_weights = smooth_weights(target_weights, last_weights)
        
        # 2b. Volatility Scaling - Reduce exposure in high volatility regimes
        if enable_volatility_scaling and sum(target_weights.values()) > 0.001:
            target_weights, vol_cash = apply_volatility_scaling(
                target_weights, 
                train_returns,
                target_vol=target_volatility,
                trading_days=trading_days_per_year
            )
            # vol_cash is tracked implicitly (sum of weights < 1)

        last_weights = target_weights

        # 3. REBALANCE PORTFOLIO
        # REALISTIC EXECUTION: Execute at Open of T+1 (not Close of T)
        # This eliminates look-ahead bias - we can't trade at a price we just discovered
        execution_idx = min(current_idx + 1, len(dates) - 1)
        execution_date = dates[execution_idx]
        prices_at_execution = open_prices_clean.iloc[execution_idx]  # Open of T+1
        
        # For valuation before trade, use Close of T (current holdings value)
        prices_at_valuation = prices_clean.iloc[current_idx]  # Close of T
        
        # Calculate Value of current holdings at Close(T) + Cash
        value_held_shares = sum(current_shares.get(t, 0.0) * prices_at_valuation.get(t, 0.0) for t in tickers)
        value_before_trade = value_held_shares + cash_balance
        
        # On first step, we start with 1.0 total equity
        if current_idx == training_window:
            value_before_trade = 1.0
            cash_balance = 0.0
            
        # Target Value per asset (based on pre-trade value)
        target_values = {t: value_before_trade * target_weights.get(t, 0.0) for t in tickers}
        
        # Calculate Turnover based on execution prices (Open T+1)
        turnover_value = 0.0
        for t in tickers:
            # Current value at execution prices
            current_val_t = current_shares.get(t, 0.0) * prices_at_execution.get(t, 0.0)
            target_val_t = target_values.get(t, 0.0)
            turnover_value += abs(target_val_t - current_val_t)
            
        # Transaction Cost (applied to value)
        cost = turnover_value * transaction_cost_pct
        total_transaction_costs += cost
        total_turnover += turnover_value
        
        # Net Investment Value (Value - Cost)
        net_value = value_before_trade - cost
        
        # Determine New Shares based on execution prices (Open T+1)
        new_shares = {}
        invested_value = 0.0
        for t in tickers:
            p = prices_at_execution.get(t)  # Open of T+1
            w = target_weights.get(t, 0.0)
            val_to_invest = net_value * w
            if p > 0:
                new_shares[t] = val_to_invest / p
            else:
                new_shares[t] = 0.0
            invested_value += val_to_invest
        
        current_shares = new_shares
        
        # Remaining goes to cash
        cash_balance = max(0.0, net_value - invested_value)
        
        # Store Allocation (record the decision date, not execution date)
        alloc_entry = {"date": current_date.strftime("%Y-%m-%d")}
        alloc_entry.update({t: round(float(target_weights.get(t, 0.0)), 4) for t in tickers})
        if fallback_flag:
            alloc_entry["_fallback"] = True
            
        allocation_history.append(alloc_entry)
        rebalance_dates.append(current_date.strftime("%Y-%m-%d"))

        # 4. WALK FORWARD (HOLDING PERIOD)
        # Start from execution day (T+1) since that's when we actually hold the new positions
        next_rebalance_idx = min(current_idx + rebalancing_window, len(dates))
        holding_start_idx = execution_idx  # Start from T+1 where we executed
        
        # Set static daily rate if using flat rate
        static_daily_rf = 0.0
        if not isinstance(risk_free_rate, pd.Series):
             static_daily_rf = risk_free_rate / trading_days_per_year if trading_days_per_year > 0 else 0.0
        
        period_values = []
        for d_idx in range(holding_start_idx, next_rebalance_idx):
            d_date = dates[d_idx]
            d_prices = prices_clean.iloc[d_idx]  # Close prices for valuation
            
            # Portfolio Value = Sum(Shares * Price) + Cash
            # Note: This naturally handles "drift"
            day_val_shares = sum(current_shares[t] * d_prices[t] for t in tickers)
            
            # Accrue interest on cash daily
            if d_idx > current_idx: # Apply interest for overnight hold
                 # Determine daily rate
                 if isinstance(risk_free_rate, pd.Series):
                     d_rf_annual = float(risk_free_rate.asof(d_date))
                     if pd.isna(d_rf_annual): d_rf_annual = 0.04
                     daily_rf_rate = d_rf_annual / trading_days_per_year if trading_days_per_year > 0 else 0.0
                 else:
                     daily_rf_rate = static_daily_rf
                     
                 cash_balance *= (1 + daily_rf_rate)
                 
            day_val = day_val_shares + cash_balance
            
            equity_curve.append({
                "date": float(d_date.timestamp() * 1000),
                "value": round(float(day_val), 6)
            })
            period_values.append(day_val)
        
        # 5. OVERFITTING METRICS
        # Predicted Sharpe (Optimizer's Expectation) vs Realized (Next Period)
        
        # Check if we are in Cash mode (sum of weights close to 0)
        is_cash_mode = sum(target_weights.values()) < 0.001
        
        if is_cash_mode:
            # In Cash mode, Predicted Sharpe is 0 (Risk free excess return = 0)
            # Realized Sharpe is technically infinite/undefined due to 0 vol, but we map it to 0
            predicted_sharpe = 0.0
            realized_sharpe = 0.0
        else:
            predicted_sharpe = calculate_portfolio_sharpe_weights(train_returns, target_weights, annualization_factor=trading_days_per_year)
            realized_sharpe = calculate_realized_sharpe_shares(period_values, annualization_factor=trading_days_per_year)
        
        overfitting_metrics.append({
            "date": current_date.strftime("%Y-%m-%d"),
            "predicted_sharpe": round(float(predicted_sharpe), 4),
            "realized_sharpe": round(float(realized_sharpe), 4)
        })

        # Advance
        current_idx = next_rebalance_idx
        
        # Report Progress
        if progress_callback:
            # Current progress within this method (0 to 1)
            pct_complete = (current_idx - training_window) / (len(dates) - training_window)
            progress_callback(max(0.0, min(1.0, pct_complete)))

    # Final Risk Contributions
    from .metrics import calculate_risk_contributions
    training_window_returns = returns.iloc[-training_window:]
    if not training_window_returns.empty:
        cov_matrix = training_window_returns.cov()
        final_risk_contributions = calculate_risk_contributions(last_weights, cov_matrix)

    # Generate Equal Weight Benchmark (reusing the logic or function)
    benchmark_values, benchmark_turnover = get_equal_weight_benchmark(prices_clean, training_window, tickers, rebalancing_window)

    # Cast all weight/contribution values to native Python float for JSON serialization
    clean_weights = {k: float(v) for k, v in last_weights.items()} if last_weights else {}
    clean_risk_contributions = {k: float(v) for k, v in final_risk_contributions.items()} if final_risk_contributions else {}

    return (equity_curve, benchmark_values, allocation_history, 
            rebalance_dates, clean_weights, total_transaction_costs, total_turnover, 
            overfitting_metrics, clean_risk_contributions, benchmark_turnover, latest_dendrogram_data)


def get_equal_weight_benchmark(
    prices: pd.DataFrame, 
    start_offset: int, 
    tickers: List[str],
    rebalancing_window: int = 21
) -> Tuple[List[Dict], float]:
    """
    Generate Equal Weight (1/N) benchmark with periodic rebalancing and DRIFT.
    "Honest" Equal Weight.
    Returns (benchmark_curve, annualized_turnover_pct)
    """
    benchmark_values = []
    
    # Work with clean data
    prices_clean = prices.apply(pd.to_numeric, errors='coerce').ffill().dropna()
    dates = prices_clean.index
    
    if start_offset >= len(dates):
        return [], 0.0

    # Initial Setup
    value = 1.0 # Indexed to 1.0
    
    # We simulate effectively 'Share-based' but can be simplified:
    # At rebalance, we reset weights to 1/N.
    # Between rebalances, we apply actual daily returns.
    
    current_idx = start_offset
    
    returns = prices_clean.pct_change()
    
    # Current "Weights" in value terms (amounts invested per asset)
    # Start: 1.0 split N ways
    # Calculate Annualized Turnover
    # Years logic
    trading_days = infer_trading_frequency(dates)
    years = (len(dates) - start_offset) / trading_days
    
    # We tracked DOLLAR turnover. We need to normalize it.
    # However, since portfolio value grows, dollar turnover is not comparable.
    # The correct way is to sum (Turnover$ / Value$) at each rebalance.
    
    # Let's fix the loop logic instead of post-processing.
    # We need to restart the loop logic above to track pct turnover.
    # Re-writing loop logic:
    
    n = len(tickers)
    current_amounts = {t: value / n for t in tickers}
    day_counter = 0
    total_turnover_pct = 0.0
    
    benchmark_values = [] # reset
    
    for i in range(start_offset, len(dates)):
        d_date = dates[i]
        
        # Check rebalance
        if day_counter >= rebalancing_window:
            total_val = sum(current_amounts.values())
            target_amount_per_asset = total_val / n
            
            # Calculate Turnover PCT: (Sum(|Target - Current_i|) / TotalVal) -> This is 2x turnover (buy+sell)
            # We usually report one-sided turnover (sells / AUM).
            # So we divide by 2 * TotalVal?
            # Standard: Turnover = Sum(|w_new - w_old|) / 2.
            # Here: Sum(|TargetAmt - CurrentAmt|) returns dollar diff sum.
            # Div by TotalVal gives Sum(|TargetW - CurrentW|).
            # So: (SumAbsDiff / TotalVal) / 2
            
            diff_sum = sum(abs(target_amount_per_asset - current_amounts[t]) for t in tickers)
            if total_val > 0:
                turnover_pct_event = (diff_sum / total_val) / 2.0
                total_turnover_pct += turnover_pct_event
            
            # Execute Rebalance
            current_amounts = {t: target_amount_per_asset for t in tickers}
            day_counter = 0
            
        # Apply Daily Return
        daily_rets = returns.iloc[i] 
        total_val_today = 0.0
        
        for t in tickers:
            r = daily_rets.get(t, 0.0)
            if pd.isna(r): r = 0.0
            
            current_amounts[t] *= (1 + r)
            total_val_today += current_amounts[t]
            
        benchmark_values.append({
            "date": float(d_date.timestamp() * 1000),
            "value": round(float(total_val_today), 6)
        })
        
        day_counter += 1

    annualized_turnover = total_turnover_pct / max(years, 0.01)
    
    return benchmark_values, annualized_turnover



def get_custom_benchmark(
    prices: pd.DataFrame,
    start_offset: int,
    benchmark_ticker: str
) -> Tuple[List[Dict], str]:
    """
    Fetch and return a custom benchmark ticker (e.g., SPY).
    Aligns benchmark data with portfolio dates.
    Uses Tiingo first (reliable), falls back to yfinance (unreliable on cloud).
    """
    benchmark_values = []
    # Import locally to avoid circular imports if any (though currently safe)
    # or rely on top-level import if added. 
    # To be safe and clean, I will assume I added the import at top, 
    # but I can also import inside here for safety.
    from .data_provider import fetch_ticker_history
    
    try:
        portfolio_dates = prices.index[start_offset:]
        if len(portfolio_dates) == 0:
             return [], benchmark_ticker

        start_d = portfolio_dates[0].strftime("%Y-%m-%d")
        end_d = portfolio_dates[-1].strftime("%Y-%m-%d")
        
        ticker = benchmark_ticker.strip().upper()
        
        # 1. Try Tiingo
        bench_prices, _ = fetch_ticker_history(ticker, start_d, end_d)
        
        if bench_prices.empty:
            print(f"Could not fetch benchmark data for {ticker} from Tiingo.")
            return [], benchmark_ticker
            
        # Clean
        bench_prices = pd.to_numeric(bench_prices, errors='coerce').ffill().bfill()
        
        # Reindex to portfolio dates
        bench_prices = bench_prices.reindex(portfolio_dates, method='ffill').bfill()
        
        # Normalize to 1.0 start
        if len(bench_prices) > 0:
            start_price = bench_prices.iloc[0]
            if start_price > 0:
                normalized = bench_prices / start_price
                
                for date, val in normalized.items():
                    benchmark_values.append({
                        "date": float(date.timestamp() * 1000),
                        "value": round(float(val), 6)
                    })
                    
        return benchmark_values, ticker
        
    except Exception as e:
        print(f"Error fetching custom benchmark {benchmark_ticker}: {e}")
        return [], benchmark_ticker


