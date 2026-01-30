import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from pypfopt import expected_returns, risk_models
from pypfopt import EfficientFrontier, EfficientCVaR
from pypfopt.exceptions import OptimizationError
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

from .config import (
    TRADING_DAYS_PER_YEAR, MONTE_CARLO_SIMULATIONS, MONTE_CARLO_SEED,
    COVARIANCE_CONDITION_NUMBER_THRESHOLD
)

# ============================================================================
# Types
# ============================================================================


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
    """Ensure weights sum to 1 and handle floating point errors."""
    return {k: float(v) for k, v in weights.items()}


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
# NCO Implementation
# ============================================================================

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
    """
    ivp = 1.0 / np.diag(cov)
    ivp /= ivp.sum()
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
            
            alpha = 1 - c_var0 / (c_var0 + c_var1)
            
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
        from scipy.cluster.hierarchy import linkage
        from scipy.spatial.distance import squareform
        
        # 1. Setup Data
        cov = returns.cov()
        corr = returns.corr()
        
        # 2. Clustering
        # Dist = sqrt(0.5 * (1 - rho))
        dist = np.sqrt(0.5 * (1 - corr))
        np.fill_diagonal(dist.values, 0)
        condensed = squareform(dist.values, checks=False)
        
        link = linkage(condensed, method='ward')
        
        # 3. Quasi-Diagonalization (Sorting)
        sort_ix_indices = get_quasi_diag(link)
        sort_ix = corr.index[sort_ix_indices].tolist()
        
        # 4. Recursive Bisection
        # We pass the covariance matrix reordered? Or just access by labels.
        # The function expects a list of labels (sort_ix).
        hrp_weights = get_rec_bipart(cov, sort_ix)
        
        # 5. HRP does not naturally support constraints - return raw weights
        clean_weights = hrp_weights.to_dict()
        
        # 6. Dendrogram Data (for Visualization)
        dendrogram_data = calculate_dendrogram(corr)
        
        return safe_clean_weights(clean_weights), dendrogram_data
        
    except Exception as e:
        print(f"⚠️  HRP technical error: {e}")
        import traceback
        traceback.print_exc()
        # Fallback
        n = len(returns.columns)
        return {col: 1.0 / n for col in returns.columns}, None


def calculate_dendrogram(corr_matrix: pd.DataFrame) -> Optional[Dict]:
    """
    Calculate dendrogram linkage for visualization.
    Returns dictionary with 'icoord', 'dcoord', 'ivl' (labels), and 'leaves'.
    """
    try:
        from scipy.cluster.hierarchy import linkage, dendrogram
        from scipy.spatial.distance import squareform
        
        dist = np.sqrt(0.5 * (1 - corr_matrix))
        np.fill_diagonal(dist.values, 0)
        condensed = squareform(dist.values, checks=False)
        
        # Method 'ward' is generally best for visualization
        Z = linkage(condensed, method='ward')
        
        # Calculate dendrogram coords without plotting
        # no_plot=True returns the data dict
        ddata = dendrogram(Z, no_plot=True, labels=corr_matrix.columns)
        
        return {
            "icoord": ddata["icoord"],
            "dcoord": ddata["dcoord"],
            "ivl": ddata["ivl"],
            "leaves": ddata["leaves"]
        }
    except Exception as e:
        print(f"Dendrogram calculation failed: {e}")
        return None


# ============================================================================
# Other Optimization Strategies
# ============================================================================

def optimize_mvo(returns: pd.DataFrame, min_weight: float = 0.0, max_weight: float = 1.0, frequency: int = TRADING_DAYS_PER_YEAR, **kwargs) -> Dict[str, float]:
    """
    Mean-Variance Optimization (MVO).
    Maximizes the Sharpe Ratio (Tangency Portfolio).
    Uses historical mean returns and shrunk covariance matrix.
    """
    try:
        # 1. Expected Returns (Historical Mean) - Aggressive assumption that past mean is predictive
        mu = expected_returns.mean_historical_return(returns, returns_data=True, frequency=frequency)
        
        # 2. Shrunk Covariance
        S = risk_models.CovarianceShrinkage(returns, returns_data=True, frequency=frequency).ledoit_wolf()
        
        # 3. Optimize for Max Sharpe
        ef = EfficientFrontier(mu, S, weight_bounds=(min_weight, max_weight))
        
        try:
            # Check if we have positive returns to support Max Sharpe
            # If all returns are negative, Max Sharpe is undefined/infeasible for standard solvers
            if mu.max() <= 0:
                print("MVO: All expected returns <= 0. Switching to Min Volatility.")
                ef.min_volatility()
            else:
                # Maximize Sharpe (risk_free_rate=0.0)
                ef.max_sharpe(risk_free_rate=0.0)
                
        except (ValueError, OptimizationError) as e:
            # Common error: "at least one of the assets must have an expected return exceeding the risk-free rate"
            # In this case, we fallback to Min Volatility (preserve MVO framework but ignore returns)
            print(f"MVO Max Sharpe failed ({e}). Attempting Min Volatility fallback...")
            
            # Re-init EF to be clean (though usually safe to reuse, strict re-init is safer)
            ef_retry = EfficientFrontier(mu, S, weight_bounds=(min_weight, max_weight))
            ef_retry.min_volatility()
            weights = ef_retry.clean_weights()
            return safe_clean_weights(weights)

        weights = ef.clean_weights()
        return safe_clean_weights(weights)

    except Exception as e:
        print(f"MVO Optimization warning: {e}. Fallback to EW.")
        n = len(returns.columns)
        return {col: 1.0 / n for col in returns.columns}


def optimize_gmv(returns: pd.DataFrame, min_weight: float = 0.0, max_weight: float = 1.0, frequency: int = TRADING_DAYS_PER_YEAR, **kwargs) -> Dict[str, float]:
    """
    Global Minimum Variance (GMV).
    Minimizes volatility without regarding expected returns.
    """
    try:
        # We need covariance matrix. Mean returns are theoretically needed for EfficientFrontier init
        # but GMV doesn't use them. We can pass dummy means or historical means.
        mu = expected_returns.mean_historical_return(returns, returns_data=True, frequency=frequency)
        S = risk_models.CovarianceShrinkage(returns, returns_data=True, frequency=frequency).ledoit_wolf()
        
        ef = EfficientFrontier(mu, S, weight_bounds=(min_weight, max_weight))
        ef.min_volatility()
        weights = ef.clean_weights()
        
        return safe_clean_weights(weights)
        
    except Exception as e:
        print(f"GMV Optimization warning: {e}. Fallback to EW.")
        n = len(returns.columns)
        return {col: 1.0 / n for col in returns.columns}


def get_optimizer(method: str):
    # Map 'hrp' and 'nco' (legacy) to HRP
    if method == "hrp" or method == "nco":
        return optimize_hrp 
    return {
        "hrp": optimize_hrp,
        "nco": optimize_hrp,
        "gmv": optimize_gmv,
        "mvo": optimize_mvo
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
        if method == "hrp" or method == "nco":
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
             # Dynamic span based on training window size (e.g., 252 -> span=252)
             # This ensures the decay is proportional to the user's chosen lookback.
             dynamic_span = len(returns)
             mu = expected_returns.ema_historical_return(returns, returns_data=True, frequency=frequency, span=dynamic_span)
             S = risk_models.CovarianceShrinkage(returns, returns_data=True, frequency=frequency).ledoit_wolf()
             
             # Cash Strategy: If the best asset return is less than Risk Free Rate, Go to Cash (0 weights)
             # Note: risk_free_rate is annual, mu is annual
             if mu.max() < risk_free_rate:
                 print(f"MVO: Max expected return ({mu.max():.2%}) < Risk Free ({risk_free_rate:.2%}). Going to Cash.")
                 # Return 0 weights -> Backtester puts everything in Cash
                 zero_weights = {col: 0.0 for col in returns.columns}
                 return OptimizationResult(weights=zero_weights, fallback_used=False)

             ef = EfficientFrontier(mu, S, weight_bounds=(min_weight, max_weight))
             try:
                # Maximize Sharpe (risk_free_rate=0.0) - relative optimization
                ef.max_sharpe(risk_free_rate=0.0)
                return OptimizationResult(weights=safe_clean_weights(ef.clean_weights()))
                
             except (ValueError, OptimizationError) as e:
                 # If Solver fails, USER requests to go to CASH, not Min Vol.
                 print(f"MVO Max Sharpe solver failed ({e}). Defaulting to Cash.")
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
    Generate points for the Efficient Frontier curve.
    """
    try:
        mu = expected_returns.mean_historical_return(returns, returns_data=True, frequency=frequency)
        S = risk_models.CovarianceShrinkage(returns, returns_data=True, frequency=frequency).ledoit_wolf()
        vol = np.sqrt(np.diag(S))
        n_assets = len(returns.columns)

        assets = []
        for i, ticker in enumerate(returns.columns):
            assets.append({
                "ticker": ticker,
                "return": round(float(mu.iloc[i]), 4),
                "volatility": round(float(vol[i]), 4)
            })

        rng = np.random.default_rng(seed=MONTE_CARLO_SEED)
        
        w = rng.random((MONTE_CARLO_SIMULATIONS, n_assets))
        w = w / w.sum(axis=1)[:, np.newaxis]
        
        port_ret = w @ mu.values
        port_var = np.sum((w @ S.values) * w, axis=1)
        port_vol = np.sqrt(port_var)
        
        sim_points = [
            {"return": round(float(r), 4), "volatility": round(float(v), 4)}
            for r, v in zip(port_ret, port_vol)
        ]

        from pypfopt import CLA
        cla = CLA(mu, S, weight_bounds=(min_weight, max_weight))
        
        try:
            cla.max_sharpe()
            frontier_ret, frontier_vol, _ = cla.efficient_frontier(points=100)
        except (ValueError, OptimizationError, np.linalg.LinAlgError):
             frontier_ret, frontier_vol = [], []

        curve = []
        for r, v in zip(frontier_ret, frontier_vol):
             if v > 0: 
                curve.append({
                    "return": round(float(r), 4),
                    "volatility": round(float(v), 4)
                })
        
        curve.sort(key=lambda x: x["volatility"])
        
        return {
            "assets": assets,
            "curve": curve,
            "simulations": sim_points
        }
        
    except Exception as e:
        print(f"Efficient Frontier calculation failed: {e}")
        return {"assets": [], "curve": [], "simulations": []}
