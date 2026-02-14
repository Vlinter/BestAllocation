import numpy as np
import pandas as pd
import math
from typing import List, Dict
from scipy.stats import skew, kurtosis as kurt
from backend.app.core.schemas import PerformanceMetrics
from .config import TRADING_DAYS_PER_YEAR, MIN_POINTS_FOR_RELIABLE_SHARPE


def safe_float(val, default=0.0) -> float:
    """Convert to float, replacing NaN/Inf with default."""
    try:
        fv = float(val)
        if math.isnan(fv) or math.isinf(fv):
            return default
        return fv
    except (TypeError, ValueError):
        return default

# ============================================================================
# Performance Metrics
# ============================================================================


def infer_trading_frequency(dates: pd.DatetimeIndex) -> int:
    """
    Infer annualization factor based on data frequency.
    Returns 365 for Crypto (avg gap < 1.4 days), 252 for Stocks.
    """
    if len(dates) < 3:
        return TRADING_DAYS_PER_YEAR
    
    # Calculate average number of days between points
    # dates must be sorted
    deltas = dates.diff().dropna()
    avg_delta_days = deltas.days.to_numpy().mean()
    
    # Stocks: ~1.44 days (5/7 trading days + holidays)
    # Crypto: ~1.00 days
    if avg_delta_days < 1.4:
        # It's likely 24/7 market
        return 365
    else:
        # It's likely business days only
        return TRADING_DAYS_PER_YEAR


def calculate_metrics(equity_curve: pd.Series, risk_free_rate: float, 
                     total_costs: float = 0, num_rebalances: int = 0,
                     annualized_turnover: float = 0.0,
                     benchmark_returns: pd.Series = None,
                     annualization_factor: int = TRADING_DAYS_PER_YEAR) -> PerformanceMetrics:
    """
    Calculate comprehensive performance metrics using dynamic annualization.
    """
    returns = equity_curve.pct_change().dropna()
    
    if len(returns) < 2:
        return PerformanceMetrics(
            sharpe_ratio=0, sortino_ratio=0, max_drawdown=0, cagr=0,
            total_return=0, volatility=0, calmar_ratio=0,
            total_transaction_costs=total_costs, num_rebalances=num_rebalances,
            annualized_turnover=annualized_turnover
        )
    
    trading_days = annualization_factor
    years = len(equity_curve) / trading_days
    
    total_return = (equity_curve.iloc[-1] / equity_curve.iloc[0]) - 1
    cagr = (equity_curve.iloc[-1] / equity_curve.iloc[0]) ** (1 / max(years, 0.01)) - 1 if years > 0 else 0
    volatility = returns.std() * np.sqrt(trading_days)
    
    # Calculate Excess Returns using Daily RF approximation
    daily_rf = risk_free_rate / trading_days
    excess_returns = returns - daily_rf
    
    # Sharpe Ratio: Use excess returns std for both numerator and denominator (modern practice)
    excess_std = excess_returns.std()
    sharpe_ratio = (excess_returns.mean() / excess_std) * np.sqrt(trading_days) if excess_std > 0 else 0
    
    # Sortino Ratio
    diff_vs_target = returns - daily_rf
    downside_diff = np.minimum(diff_vs_target, 0)
    downside_sq = downside_diff ** 2
    downside_variance = downside_sq.mean()
    downside_dev = np.sqrt(downside_variance) * np.sqrt(trading_days)
    sortino_ratio = (excess_returns.mean() * trading_days) / downside_dev if downside_dev > 1e-9 else 0.0
    
    cumulative = (1 + returns).cumprod()
    rolling_max = cumulative.expanding().max()
    drawdowns = (cumulative - rolling_max) / rolling_max
    max_drawdown = abs(drawdowns.min())
    
    calmar_ratio = cagr / max_drawdown if max_drawdown > 0 else 0
    
    skewness = float(skew(returns)) if len(returns) > 3 else 0.0
    kurtosis_val = float(kurt(returns)) if len(returns) > 3 else 0.0
    
    # Win rate
    winning_returns = returns[returns > 0]
    losing_returns = returns[returns < 0]
    win_rate = len(winning_returns) / len(returns) if len(returns) > 0 else 0.0
    avg_win = winning_returns.mean() if len(winning_returns) > 0 else 0.0
    avg_loss = abs(losing_returns.mean()) if len(losing_returns) > 0 else 0.0
    max_gain = returns.max() if len(returns) > 0 else 0.0
    max_loss = abs(returns.min()) if len(returns) > 0 else 0.0
    
    # Omega ratio
    threshold = risk_free_rate / trading_days
    gains = returns[returns > threshold] - threshold
    losses = threshold - returns[returns <= threshold]
    # Handle edge case: if no losses, omega is effectively infinite
    if losses.sum() > 1e-10:
        omega_ratio = gains.sum() / losses.sum()
    else:
        omega_ratio = 999.0 if gains.sum() > 0 else 1.0
    
    # Alpha and Beta (CAPM)
    alpha = 0.0
    beta = 0.0
    if benchmark_returns is not None and len(benchmark_returns) > 10:
        common_idx = returns.index.intersection(benchmark_returns.index)
        if len(common_idx) > 10:
            port_ret = returns.loc[common_idx]
            bench_ret = benchmark_returns.loc[common_idx]
            
            covariance = np.cov(port_ret, bench_ret)[0, 1]
            bench_variance = np.var(bench_ret, ddof=1)
            if bench_variance > 1e-10:
                beta = covariance / bench_variance
            
            # Use dynamic trading_days for bench CAGR too
            bench_cagr = (1 + bench_ret).prod() ** (trading_days / len(bench_ret)) - 1
            alpha = cagr - (risk_free_rate + beta * (bench_cagr - risk_free_rate))
    
    return PerformanceMetrics(
        sharpe_ratio=round(safe_float(sharpe_ratio), 4),
        sortino_ratio=round(safe_float(sortino_ratio), 4),
        max_drawdown=round(safe_float(max_drawdown), 4),
        cagr=round(safe_float(cagr), 4),
        total_return=round(safe_float(total_return), 4),
        volatility=round(safe_float(volatility), 4),
        calmar_ratio=round(safe_float(calmar_ratio), 4),
        total_transaction_costs=round(safe_float(total_costs), 4),
        num_rebalances=num_rebalances,
        skewness=round(safe_float(skewness), 4),
        kurtosis=round(safe_float(kurtosis_val), 4),
        win_rate=round(safe_float(win_rate), 4),
        avg_win=round(safe_float(avg_win), 6),
        avg_loss=round(safe_float(avg_loss), 6),
        max_gain=round(safe_float(max_gain), 4),
        max_loss=round(safe_float(max_loss), 4),
        omega_ratio=round(safe_float(omega_ratio), 4),
        annualized_turnover=round(safe_float(annualized_turnover), 4),
        alpha=round(safe_float(alpha), 4),
        beta=round(safe_float(beta), 4)
    )

def calculate_risk_contributions(weights: Dict[str, float], cov_matrix: pd.DataFrame) -> Dict[str, float]:
    """
    Calculate Marginal Risk Contribution (MRC) for each asset.
    MRC_i = weight_i * (Sigma * weight)_i / Portfolio_Vol
    
    The sum of MRCs equals the Portfolio Volatility.
    We return the *percentage* contribution (MRC_i / Portfolio_Vol).
    """
    try:
        tickers = list(weights.keys())
        w = np.array([weights[t] for t in tickers])
        
        # Ensure cov_matrix is aligned with tickers
        cov = cov_matrix.loc[tickers, tickers].values
        
        # Portfolio Variance = w.T * Sigma * w
        port_var = np.dot(w.T, np.dot(cov, w))
        port_vol = np.sqrt(port_var)
        
        if port_vol < 1e-9:
            return {t: 0.0 for t in tickers}
            
        # Marginal Contribution to Risk = (Sigma * w) / port_vol
        mcr = np.dot(cov, w) / port_vol
        
        # Risk Contribution = w * MCR
        rc = w * mcr
        
        # Percentage Contribution = RC / port_vol
        # Note: sum(rc) should be port_vol. So sum(pct_rc) should be 1.0
        pct_rc = rc / port_vol
        
        return {tickers[i]: float(pct_rc[i]) for i in range(len(tickers))}
        
    except Exception as e:
        print(f"Error calculating risk contributions: {e}")
        # Fallback to equal risk
        n = len(weights)
        return {t: 1.0/n for t in weights}


def calculate_drawdown_curve(equity_curve: List[Dict]) -> List[Dict[str, float]]:
    """Calculate drawdown at each point."""
    values = [p["value"] for p in equity_curve]
    dates = [p["date"] for p in equity_curve]
    
    drawdowns = []
    if not values:
        return []
        
    peak = values[0]
    for i, val in enumerate(values):
        if val > peak:
            peak = val
        dd = (val - peak) / peak if peak > 0 else 0
        drawdowns.append({"date": dates[i], "value": round(dd * 100, 2)})  # As percentage
    return drawdowns





def calculate_correlation_matrix(prices: pd.DataFrame) -> dict:
    """
    Calculate correlation matrix and order tickers by hierarchical clustering
    for a cleaner heatmap visualization.
    
    Returns:
        dict with 'tickers' (ordered list) and 'matrix' (2D list of correlations)
    """
    from scipy.cluster.hierarchy import linkage, leaves_list
    from scipy.spatial.distance import squareform
    
    # Calculate returns
    returns = prices.pct_change().dropna()
    
    if len(returns) < 10:
        return {"tickers": list(prices.columns), "matrix": []}
    
    # Calculate correlation matrix
    corr_matrix = returns.corr()
    tickers = list(corr_matrix.columns)
    n = len(tickers)
    
    if n < 2:
        return {"tickers": tickers, "matrix": [[1.0]]}
    
    # Convert correlation to distance for clustering (1 - corr)
    # Handle NaN values
    corr_values = corr_matrix.fillna(0).values
    np.fill_diagonal(corr_values, 1)  # Ensure diagonal is 1
    
    # Distance = 1 - correlation (0 for perfect correlation, 2 for perfect anti-correlation)
    distance_matrix = 1 - corr_values
    np.fill_diagonal(distance_matrix, 0)  # Diagonal should be 0 distance
    
    # Make sure it's symmetric and positive
    distance_matrix = (distance_matrix + distance_matrix.T) / 2
    distance_matrix = np.clip(distance_matrix, 0, 2)
    
    try:
        # Convert to condensed form for linkage
        condensed = squareform(distance_matrix)
        
        # Hierarchical clustering using Ward's method
        linkage_matrix = linkage(condensed, method='average')
        
        # Get optimal leaf order
        order = leaves_list(linkage_matrix)
        
        # Reorder tickers and matrix
        ordered_tickers = [tickers[i] for i in order]
        ordered_matrix = [[round(float(corr_values[i][j]), 3) for j in order] for i in order]
    except Exception as e:
        print(f"Clustering failed: {e}, returning unordered matrix")
        ordered_tickers = tickers
        ordered_matrix = [[round(float(corr_values[i][j]), 3) for j in range(n)] for i in range(n)]
    
    return {
        "tickers": ordered_tickers,
        "matrix": ordered_matrix
    }
