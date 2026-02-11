import numpy as np
import pandas as pd
import logging
from typing import Dict, List, Tuple, Optional
from pypfopt import expected_returns, risk_models, objective_functions
from pypfopt import EfficientFrontier
from pypfopt.exceptions import OptimizationError

from .config import (
    TRADING_DAYS_PER_YEAR,
    COVARIANCE_CONDITION_NUMBER_THRESHOLD, RETURN_SHRINKAGE_INTENSITY,
    MVO_L2_GAMMA
)

# Configure module logger
logger = logging.getLogger(__name__)

# ============================================================================
# Types
# ============================================================================


# ============================================================================
# James-Stein Shrinkage for Expected Returns
# ============================================================================

def shrink_expected_returns(mu: pd.Series, shrinkage_intensity: float = RETURN_SHRINKAGE_INTENSITY) -> pd.Series:
    """
    Apply James-Stein shrinkage towards the grand mean.
    
    This is a key technique used by professional quants to reduce estimation
    error in expected returns. The sample mean is notoriously noisy, and
    shrinking towards a common prior (grand mean) reduces overfitting.
    
    Formula: μ_shrunk = λ × grand_mean + (1-λ) × sample_mean
    
    Args:
        mu: Sample mean returns (annualized)
        shrinkage_intensity: 0.0 = raw sample mean, 1.0 = grand mean only
    
    Returns:
        Shrunk expected returns
    """
    if len(mu) < 2:
        return mu
    
    grand_mean = mu.mean()
    shrunk = shrinkage_intensity * grand_mean + (1 - shrinkage_intensity) * mu
    
    return shrunk


class OptimizationResult:
    """Result of an optimization with metadata."""
    def __init__(self, weights: Dict[str, float], fallback_used: bool = False, 
                 fallback_reason: Optional[str] = None, constraints_clipped: bool = False,
                 constraint_distortion: float = 0.0, dendrogram_data: Optional[Dict] = None):
        self.weights = weights
        self.fallback_used = fallback_used
        self.fallback_reason = fallback_reason
        self.constraints_clipped = constraints_clipped
        self.constraint_distortion = constraint_distortion
        self.dendrogram_data = dendrogram_data  # Kept for compatibility, though NCO uses clusters

# ============================================================================
# Helper Functions
# ============================================================================

def safe_clean_weights(weights: Dict[str, float]) -> Dict[str, float]:
    """Ensure weights sum to 1, sanitize NaN/Inf, handle floating point errors."""
    import math
    cleaned = {}
    for k, v in weights.items():
        fv = float(v)
        if math.isnan(fv) or math.isinf(fv):
            fv = 0.0
        cleaned[k] = fv
    total = sum(cleaned.values())
    if total > 0:
        cleaned = {k: v / total for k, v in cleaned.items()}
    else:
        # All weights are zero/NaN — fall back to equal weight
        n = len(cleaned)
        cleaned = {k: 1.0 / n for k in cleaned}
    return cleaned


def apply_weight_constraints(weights: Dict[str, float], min_weight: float, max_weight: float) -> Tuple[Dict[str, float], bool]:
    """
    Apply min/max constraints by clipping and renormalizing.
    Returns the clipped weights and a flag indicating if clipping was necessary.
    """
    clipped = False
    for k, v in weights.items():
        if v < min_weight or v > max_weight:
            clipped = True
            break
    
    if not clipped:
        return weights, False
    
    # Clip weights
    clipped_weights = {k: max(min_weight, min(max_weight, v)) for k, v in weights.items()}
    
    # Renormalize to sum to 1
    total = sum(clipped_weights.values())
    if total > 0:
        clipped_weights = {k: v / total for k, v in clipped_weights.items()}
    
    return clipped_weights, True


def check_covariance_quality(cov_matrix: pd.DataFrame) -> Optional[str]:
    """Check if covariance matrix is well-conditioned."""
    try:
        eigenvalues = np.linalg.eigvalsh(cov_matrix.values)
        if eigenvalues.min() <= 0:
            return "Covariance matrix is not positive definite"
        condition_number = eigenvalues.max() / eigenvalues.min()
        if condition_number > COVARIANCE_CONDITION_NUMBER_THRESHOLD:
            return f"Covariance matrix is ill-conditioned (condition number: {condition_number:.0f})"
    except np.linalg.LinAlgError:
        pass
    return None

# ============================================================================
# HRP Implementation
# ============================================================================

def get_quasi_diag(link):
    """
    Sort diagonal elements of the covariance matrix based on the hierarchical structure.
    """
    link = link.astype(int)
    sort_ix = pd.Series([link[-1, 0], link[-1, 1]])
    num = link[-1, 3] # number of original items

    while sort_ix.max() >= num:
        sort_ix.index = range(0, sort_ix.shape[0] * 2, 2) # make space
        df0 = sort_ix[sort_ix >= num] # find clusters
        i = df0.index
        j = df0.values - num
        sort_ix[i] = link[j, 0] # replace with left child
        df0 = pd.Series(link[j, 1], index=i + 1)
        sort_ix = pd.concat([sort_ix, df0], verify_integrity=True) # append right child
        sort_ix = sort_ix.sort_index() # re-sort
        sort_ix.index = range(sort_ix.shape[0]) # re-index

    return sort_ix.tolist()


def get_allocations(cov):
    """
    Calculate Inverse Variance Portfolio (IVP) weights.
    Handles zero-variance assets by assigning them near-zero weight.
    """
    diag = np.diag(cov).copy()
    # Replace zero/near-zero variances with a large value so 1/diag → ~0 weight
    diag[diag < 1e-12] = 1e12
    ivp = 1.0 / diag
    total = ivp.sum()
    if total > 0:
        ivp /= total
    else:
        ivp = np.ones(len(diag)) / len(diag)
    return ivp


def get_cluster_var(cov, c_items):
    """
    Calculate the variance of a cluster.
    """
    cov_slice = cov.loc[c_items, c_items]
    w = get_allocations(cov_slice) # Use MinVar (Inverse Variance) for intra-cluster
    return (w @ cov_slice @ w).item()


def get_rec_bipart(cov, sort_ix):
    """
    Recursive Bisection: Compute HRP weights.
    Handles zero-variance clusters gracefully.
    """
    w = pd.Series(1.0, index=sort_ix)
    c_items = [sort_ix] # initialize with all items
    
    while len(c_items) > 0:
        c_items = [i[j:k] for i in c_items for j, k in ((0, len(i) // 2), (len(i) // 2, len(i))) if len(i) > 1]
        
        for i in range(0, len(c_items), 2):
            c_items0 = c_items[i] # left cluster
            c_items1 = c_items[i + 1] # right cluster
            
            c_var0 = get_cluster_var(cov, c_items0)
            c_var1 = get_cluster_var(cov, c_items1)
            
            denom = c_var0 + c_var1
            if denom < 1e-16 or np.isnan(denom):
                alpha = 0.5  # Equal split if both clusters have ~zero variance
            else:
                alpha = 1 - c_var0 / denom
            
            # Clamp alpha to [0, 1] for safety
            alpha = max(0.0, min(1.0, alpha))
            
            w[c_items0] *= alpha
            w[c_items1] *= 1 - alpha
            
    return w


def optimize_hrp(returns: pd.DataFrame, min_weight: float = 0.0, max_weight: float = 1.0, **kwargs) -> Tuple[Dict[str, float], Optional[Dict]]:
    """
    Hierarchical Risk Parity (HRP).
    
    1. Clustering: Build a hierarchical tree.
    2. Quasi-Diagonalization: Sort the matrix.
    3. Recursive Bisection: Allocate weights.
    """
    try:
        from scipy.cluster.hierarchy import linkage, dendrogram as scipy_dendrogram
        from scipy.spatial.distance import squareform
        
        # 1. Setup Data
        cov = returns.cov()
        corr = returns.corr()
        
        # Sanitize: handle zero-variance assets (e.g. crypto with constant price
        # from forward-fill beyond available data). These produce NaN correlations.
        # Replace NaN with 0.0 (= max distance, uncorrelated) and clip to [-1, 1].
        if corr.isna().any().any():
            logger.info(f"HRP: Filling {corr.isna().sum().sum()} NaN correlations (zero-variance assets)")
            corr = corr.fillna(0.0)
            cov = cov.fillna(0.0)
        corr = corr.clip(-1.0, 1.0)
        
        # 2. Clustering (computed ONCE, reused for both allocation and visualization)
        dist = np.sqrt(0.5 * (1 - corr))
        np.fill_diagonal(dist.values, 0)
        condensed = squareform(dist.values, checks=False)
        link = linkage(condensed, method='ward')
        
        # 3. Quasi-Diagonalization (Sorting)
        sort_ix_indices = get_quasi_diag(link)
        sort_ix = corr.index[sort_ix_indices].tolist()
        
        # 4. Recursive Bisection
        hrp_weights = get_rec_bipart(cov, sort_ix)
        clean_weights = hrp_weights.to_dict()
        
        # 5. Dendrogram Data (reuse the SAME linkage — no double computation)
        try:
            ddata = scipy_dendrogram(link, no_plot=True, labels=corr.columns.tolist())
            dendrogram_data = {
                "icoord": ddata["icoord"],
                "dcoord": ddata["dcoord"],
                "ivl": ddata["ivl"],
                "leaves": ddata["leaves"]
            }
        except Exception:
            dendrogram_data = None
        
        return safe_clean_weights(clean_weights), dendrogram_data
        
    except Exception as e:
        logger.warning(f"HRP technical error: {e}")
        n = len(returns.columns)
        return {col: 1.0 / n for col in returns.columns}, None




# ============================================================================
# Optimizer Dispatch
# ============================================================================

def get_optimizer(method: str):
    """Return the optimizer function for the given method."""
    return {
        "hrp": optimize_hrp,
        "gmv": None,  # GMV handled inline in optimize_with_fallback
        "mvo": None,  # MVO handled inline in optimize_with_fallback
    }.get(method, optimize_hrp)


def optimize_with_fallback(
    returns: pd.DataFrame,
    method: str,
    min_weight: float = 0.0,
    max_weight: float = 1.0,
    risk_free_rate: float = 0.02,
    alpha: float = 0.05,
    frequency: int = TRADING_DAYS_PER_YEAR,
    **kwargs
) -> OptimizationResult:
    """
    Run optimization with detailed result tracking.
    """
    n = len(returns.columns)
    equal_weights = {col: 1.0 / n for col in returns.columns}
    
    try:
        if method == "hrp":
            # Call HRP - HRP does not use min/max weight constraints
            weights, dendrogram_data = optimize_hrp(
                returns, 
                min_weight=min_weight, 
                max_weight=max_weight,
                frequency=frequency
            )
            
            return OptimizationResult(
                weights=weights,
                fallback_used=False,
                constraints_clipped=False,
                dendrogram_data=dendrogram_data
            )
            

        elif method == "mvo":
             # Use Exponential Moving Average (EMA) for expected returns
             dynamic_span = len(returns)
             mu_raw = expected_returns.ema_historical_return(returns, returns_data=True, frequency=frequency, span=dynamic_span)
             
             # Apply James-Stein shrinkage to reduce estimation error
             mu = shrink_expected_returns(mu_raw)
             
             S = risk_models.CovarianceShrinkage(returns, returns_data=True, frequency=frequency).ledoit_wolf()
             
             # Cash Strategy: If the best asset return < Risk Free Rate, go to Cash
             if mu.max() < risk_free_rate:
                 logger.info(f"MVO: Max expected return ({mu.max():.2%}) < Risk Free ({risk_free_rate:.2%}). Going to Cash.")
                 zero_weights = {col: 0.0 for col in returns.columns}
                 return OptimizationResult(weights=zero_weights, fallback_used=False)

             ef = EfficientFrontier(mu, S, weight_bounds=(min_weight, max_weight))
             # L2 Regularization: penalize concentrated weights for better diversification
             ef.add_objective(objective_functions.L2_reg, gamma=MVO_L2_GAMMA)
             try:
                ef.max_sharpe(risk_free_rate=risk_free_rate)
                return OptimizationResult(weights=safe_clean_weights(ef.clean_weights()))
                
             except (ValueError, OptimizationError) as e:
                 logger.warning(f"MVO Max Sharpe solver failed ({e}). Defaulting to Cash.")
                 zero_weights = {col: 0.0 for col in returns.columns}
                 return OptimizationResult(
                    weights=zero_weights, 
                    fallback_used=True, 
                    fallback_reason=f"MVO Solver Failed: {e} -> Cash"
                 )
            
        elif method == "gmv":
            mu = expected_returns.mean_historical_return(returns, returns_data=True, frequency=frequency)
            S = risk_models.CovarianceShrinkage(returns, returns_data=True, frequency=frequency).ledoit_wolf()
            
            ef = EfficientFrontier(mu, S, weight_bounds=(min_weight, max_weight))
            ef.min_volatility()
            return OptimizationResult(weights=safe_clean_weights(ef.clean_weights()))
        
        else:
            return OptimizationResult(
                weights=equal_weights,
                fallback_used=True,
                fallback_reason=f"Unknown method: {method}"
            )
            
    except Exception as e:
        return OptimizationResult(
            weights=equal_weights,
            fallback_used=True,
            fallback_reason=str(e)
        )


from .data_provider import memory

@memory.cache
def calculate_efficient_frontier(returns: pd.DataFrame, min_weight: float = 0.0, max_weight: float = 1.0, frequency: int = TRADING_DAYS_PER_YEAR) -> Dict:
    """
    Generate the Efficient Frontier curve (CLA) and Monte Carlo simulations (Cloud).
    """
    try:
        mu = expected_returns.mean_historical_return(returns, returns_data=True, frequency=frequency)
        S = risk_models.CovarianceShrinkage(returns, returns_data=True, frequency=frequency).ledoit_wolf()
        vol = np.sqrt(np.diag(S))

        # Individual asset positions
        assets = []
        for i, ticker in enumerate(returns.columns):
            assets.append({
                "ticker": ticker,
                "return": round(float(mu.iloc[i]), 4),
                "volatility": round(float(vol[i]), 4)
            })

        # 1. Monte Carlo Simulations (The "Cloud")
        num_simulations = 2000
        simulations = []
        n_assets = len(mu)
        
        # Vectorized simulation for speed
        w = np.random.random((num_simulations, n_assets))
        w = (w.T / w.sum(axis=1)).T  # Normalize weights to sum to 1
        
        # Calculate return and volatility for clean arrays
        port_ret = np.dot(w, mu)
        port_vol = np.sqrt(np.diag(np.dot(w, np.dot(S, w.T))))
        
        for r, v in zip(port_ret, port_vol):
             simulations.append({
                "return": round(float(r), 4),
                "volatility": round(float(v), 4)
            })

        # 2. Exact Efficient Frontier via CLA (The "Line")
        curve = []
        try:
            from pypfopt import CLA
            cla = CLA(mu, S, weight_bounds=(min_weight, max_weight))
            # Note: We don't call max_sharpe() here to avoid solver issues crashing the whole chart
            # efficient_frontier() uses its own logic to trace the curve
            frontier_ret, frontier_vol, _ = cla.efficient_frontier(points=100)
            
            for r, v in zip(frontier_ret, frontier_vol):
                 if v > 0: 
                    curve.append({
                        "return": round(float(r), 4),
                        "volatility": round(float(v), 4)
                    })
            curve.sort(key=lambda x: x["volatility"])
            
        except Exception as e:
            logger.warning(f"CLA frontier generation failed: {e}. Returning simulations only.")

        return {
            "assets": assets,
            "curve": curve,
            "simulations": simulations
        }
        
    except Exception as e:
        logger.warning(f"Efficient Frontier calculation failed completely: {e}")
        return {"assets": [], "curve": [], "simulations": []}
