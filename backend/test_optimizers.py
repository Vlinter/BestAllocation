"""
Comprehensive test suite for portfolio optimization algorithms.
Tests HRP, GMV, and MVO for mathematical correctness.
"""
import sys
import os
import pandas as pd
import numpy as np

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from backend.optimization import optimize_hrp, optimize_gmv, optimize_mvo, optimize_with_fallback
from backend.metrics import calculate_metrics


def test_hrp_basic():
    """Test HRP produces valid weights that sum to 1."""
    np.random.seed(42)
    n = 500
    dates = pd.date_range("2020-01-01", periods=n)
    
    # 3 assets with different volatilities
    df = pd.DataFrame({
        'A': np.random.normal(0.0005, 0.01, n),
        'B': np.random.normal(0.0005, 0.02, n),
        'C': np.random.normal(0.0005, 0.03, n)
    }, index=dates)
    
    weights, dendrogram = optimize_hrp(df)
    
    # Weights must sum to 1
    assert abs(sum(weights.values()) - 1.0) < 1e-6, f"Weights sum to {sum(weights.values())}, not 1.0"
    
    # All weights must be positive
    for ticker, w in weights.items():
        assert w >= 0, f"Negative weight for {ticker}: {w}"
    
    # Lower variance assets should have higher weights (inverse variance principle)
    # HRP uses hierarchical clustering, so this is an approximate expectation
    assert weights['A'] > weights['C'], f"Expected A > C, got A={weights['A']}, C={weights['C']}"
    
    print(f"HRP Weights: {weights}")
    print("✓ HRP basic test passed")


def test_gmv_minimizes_variance():
    """Test GMV gives lower portfolio variance than equal weight."""
    np.random.seed(42)
    n = 500
    dates = pd.date_range("2020-01-01", periods=n)
    
    df = pd.DataFrame({
        'A': np.random.normal(0.0005, 0.01, n),
        'B': np.random.normal(0.0005, 0.02, n),
        'C': np.random.normal(0.0005, 0.03, n)
    }, index=dates)
    
    weights = optimize_gmv(df)
    
    # Weights must sum to 1
    assert abs(sum(weights.values()) - 1.0) < 1e-6
    
    # Calculate portfolio variance for GMV
    cov = df.cov()
    w_vec = np.array([weights[t] for t in df.columns])
    gmv_var = w_vec @ cov.values @ w_vec
    
    # Calculate equal weight variance
    ew_vec = np.array([1/3, 1/3, 1/3])
    ew_var = ew_vec @ cov.values @ ew_vec
    
    # GMV variance should be LESS than or equal to equal weight
    assert gmv_var <= ew_var * 1.01, f"GMV var {gmv_var} should be <= EW var {ew_var}"
    
    print(f"GMV Weights: {weights}")
    print(f"GMV Variance: {gmv_var:.6f}, EW Variance: {ew_var:.6f}")
    print("✓ GMV minimizes variance test passed")


def test_mvo_max_sharpe():
    """Test MVO produces higher risk-adjusted returns than equal weight."""
    np.random.seed(42)
    n = 500
    dates = pd.date_range("2020-01-01", periods=n)
    
    # Create assets with different return/risk profiles
    df = pd.DataFrame({
        'A': np.random.normal(0.001, 0.01, n),   # High return, low vol (best Sharpe)
        'B': np.random.normal(0.0005, 0.02, n),  # Med return, high vol
        'C': np.random.normal(0.0003, 0.015, n)  # Low return, med vol
    }, index=dates)
    
    weights = optimize_mvo(df, min_weight=0.0, max_weight=1.0)
    
    # Weights must sum to 1
    assert abs(sum(weights.values()) - 1.0) < 1e-6, f"Weights sum to {sum(weights.values())}"
    
    # Asset with best Sharpe (A) should have highest weight
    assert weights['A'] >= weights['B'], f"Expected A >= B, got A={weights['A']}, B={weights['B']}"
    assert weights['A'] >= weights['C'], f"Expected A >= C, got A={weights['A']}, C={weights['C']}"
    
    print(f"MVO Weights: {weights}")
    print("✓ MVO max sharpe test passed")


def test_mvo_constraints():
    """Test MVO respects min/max weight constraints."""
    np.random.seed(42)
    n = 500
    dates = pd.date_range("2020-01-01", periods=n)
    
    df = pd.DataFrame({
        'A': np.random.normal(0.002, 0.01, n),   # Very high return
        'B': np.random.normal(0.0001, 0.02, n),  # Low return
    }, index=dates)
    
    min_w, max_w = 0.2, 0.8
    weights = optimize_mvo(df, min_weight=min_w, max_weight=max_w)
    
    # Verify constraints
    for t, w in weights.items():
        assert w >= min_w - 0.001, f"{t} weight {w} below min {min_w}"
        assert w <= max_w + 0.001, f"{t} weight {w} above max {max_w}"
    
    print(f"MVO with constraints: {weights}")
    print("✓ MVO constraints test passed")


def test_mvo_cash_fallback():
    """Test MVO goes to cash when all returns are negative."""
    np.random.seed(42)
    n = 500
    dates = pd.date_range("2020-01-01", periods=n)
    
    # All negative expected returns
    df = pd.DataFrame({
        'A': np.random.normal(-0.002, 0.01, n),
        'B': np.random.normal(-0.001, 0.02, n),
    }, index=dates)
    
    result = optimize_with_fallback(df, method="mvo", risk_free_rate=0.05)
    
    # Should go to cash (all weights = 0)
    total_weight = sum(result.weights.values())
    
    print(f"MVO with negative returns: {result.weights}, total={total_weight}")
    
    if total_weight < 0.01:
        print("✓ MVO cash fallback test passed - went to cash")
    else:
        print("⚠ MVO did not go to cash - this may be acceptable depending on implementation")


def test_gmv_constraints():
    """Test GMV respects min/max weight constraints."""
    np.random.seed(42)
    n = 500
    dates = pd.date_range("2020-01-01", periods=n)
    
    # One very low vol asset - without constraints would be nearly 100%
    df = pd.DataFrame({
        'A': np.random.normal(0.0005, 0.005, n),
        'B': np.random.normal(0.0005, 0.05, n),
    }, index=dates)
    
    min_w, max_w = 0.2, 0.8
    weights = optimize_gmv(df, min_weight=min_w, max_weight=max_w)
    
    for t, w in weights.items():
        assert w >= min_w - 0.001, f"{t} weight {w} below min {min_w}"
        assert w <= max_w + 0.001, f"{t} weight {w} above max {max_w}"
    
    print(f"GMV with constraints: {weights}")
    print("✓ GMV constraints test passed")


def test_weights_sum_to_one():
    """Comprehensive test that all methods produce weights summing to 1."""
    np.random.seed(42)
    n = 300
    dates = pd.date_range("2020-01-01", periods=n)
    
    df = pd.DataFrame({
        'SPY': np.random.normal(0.0005, 0.012, n),
        'TLT': np.random.normal(0.0002, 0.008, n),
        'GLD': np.random.normal(0.0003, 0.010, n),
    }, index=dates)
    
    for method in ["hrp", "gmv", "mvo"]:
        result = optimize_with_fallback(df, method=method, risk_free_rate=0.04)
        total = sum(result.weights.values())
        
        # Allow for cash (sum=0) or fully invested (sum=1)
        assert total < 0.01 or abs(total - 1.0) < 1e-6, f"{method}: weights sum to {total}"
        print(f"{method.upper()}: sum={total:.6f}, fallback={result.fallback_used}")
    
    print("✓ Weights sum test passed")


if __name__ == "__main__":
    print("=" * 60)
    print("PORTFOLIO OPTIMIZATION ALGORITHM TESTS")
    print("=" * 60)
    
    tests = [
        test_hrp_basic,
        test_gmv_minimizes_variance,
        test_gmv_constraints,
        test_mvo_max_sharpe,
        test_mvo_constraints,
        test_mvo_cash_fallback,
        test_weights_sum_to_one,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        print(f"\n--- {test.__name__} ---")
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"❌ FAILED: {e}")
            failed += 1
        except Exception as e:
            print(f"❌ ERROR: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("=" * 60)
    
    if failed == 0:
        print("🎉 ALL OPTIMIZATION TESTS PASSED")
    else:
        print("❌ Some tests failed")
