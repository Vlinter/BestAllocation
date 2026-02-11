import sys
import os
import pandas as pd
import numpy as np


# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from backend.metrics import calculate_metrics
from backend.optimization import optimize_hrp, optimize_with_fallback

def test_metrics_math():
    """Test mathematical correctness of metrics."""
    # Create synthetic daily returns: +1% every day
    # Annualized return should be roughly (1.01^252 - 1)
    dates = pd.date_range("2023-01-01", periods=252, freq="B")
    values = [1.0 * (1.01 ** i) for i in range(len(dates))]
    equity_curve = pd.Series(values, index=dates)
    
    metrics = calculate_metrics(equity_curve, risk_free_rate=0.0)
    
    # Volatility should be near 0 (constant growth)
    assert metrics.volatility < 0.0001
    
    # Sharpe should be massive (high return, near-zero vol)
    assert metrics.sharpe_ratio > 100
    
    # Max drawdown should be 0 (never went down)
    assert metrics.max_drawdown == 0


def test_metrics_downside():
    """Test metrics with a known drawdown."""
    dates = pd.date_range("2023-01-01", periods=10, freq="B")
    values = [100, 105, 110, 90, 95, 100, 110, 120, 130, 125] 
    # Peak is 110 (idx 2), drop to 90 (idx 3). Drawdown = (90-110)/110 = -18.18%
    # Then peak 130, drop 125.
    equity_curve = pd.Series(values, index=dates)
    
    metrics = calculate_metrics(equity_curve, risk_free_rate=0.0)
    
    # Drawdown verification
    assert abs(metrics.max_drawdown - 0.1818) < 0.01
    
    # Sortino should be reasonable (not infinite, not zero)
    assert metrics.sortino_ratio != 0
    print(f"Sortino Ratio: {metrics.sortino_ratio}")


def test_omega_ratio_edge_case():
    """Test Omega ratio with all positive returns (no losses)."""
    dates = pd.date_range("2023-01-01", periods=100, freq="B")
    # All positive returns - equity goes up every day
    values = [1.0 * (1.001 ** i) for i in range(len(dates))]
    equity_curve = pd.Series(values, index=dates)
    
    metrics = calculate_metrics(equity_curve, risk_free_rate=0.0)
    
    # Omega should be very high (999) since no losses
    assert metrics.omega_ratio >= 100, f"Expected high omega, got {metrics.omega_ratio}"
    print(f"Omega Ratio (no losses): {metrics.omega_ratio}")


def test_gmv_optimization():
    """Verify GMV optimization minimizes variance."""
    # Create 3 assets with different volatilities
    np.random.seed(42)
    n = 500
    dates = pd.date_range("2020-01-01", periods=n)
    
    # A: Low vol
    ret_a = np.random.normal(0.0005, 0.01, n)
    
    # B: Medium vol
    ret_b = np.random.normal(0.0005, 0.02, n)
    
    # C: High vol
    ret_c = np.random.normal(0.0005, 0.03, n)
    
    df = pd.DataFrame({'A': ret_a, 'B': ret_b, 'C': ret_c}, index=dates)
    
    result = optimize_with_fallback(df, method="gmv", risk_free_rate=0.04)
    weights = result.weights
    
    print(f"GMV Weights: {weights}")
    
    # Asset A (lowest vol) should have highest weight
    assert weights['A'] > weights['B'], "Lower vol asset should have higher weight"
    assert weights['B'] > weights['C'], "Lower vol asset should have higher weight"
    
    # HRP Check
    weights_hrp, _ = optimize_hrp(df)
    print(f"HRP Weights: {weights_hrp}")
    assert sum(weights_hrp.values()) > 0.99




if __name__ == "__main__":
    # minimal runner
    try:
        test_metrics_math()
        print("✓ test_metrics_math passed")
        
        test_metrics_downside()
        print("✓ test_metrics_downside passed")
        
        test_omega_ratio_edge_case()
        print("✓ test_omega_ratio_edge_case passed")
        
        test_gmv_optimization()
        print("✓ test_gmv_optimization passed")
        
        print("\n🎉 ALL TESTS PASSED")
    except AssertionError as e:
        print(f"❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
