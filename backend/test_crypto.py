"""End-to-end test: mix crypto + ETFs in fetch_price_data."""
import sys
sys.path.insert(0, ".")

from backend.data_provider import fetch_price_data

# Mix crypto + ETFs
tickers = ["SPY", "GLD", "btcusd"]
print(f"=== Testing mixed portfolio: {tickers} ===\n")

try:
    close, open_, start_dates, limiting = fetch_price_data(tickers, "2024-01-01", "2024-06-01")
    print(f"\nResult:")
    print(f"  Shape: {close.shape}")
    print(f"  Columns: {list(close.columns)}")
    print(f"  Date range: {close.index[0].date()} to {close.index[-1].date()}")
    print(f"  Total days: {len(close)}")
    print(f"  Limiting ticker: {limiting}")
    print(f"  Start dates: {start_dates}")
    print(f"\n  NaN count per column:")
    print(f"    {close.isna().sum().to_dict()}")
    print(f"\n  First 5 rows:")
    print(close.head())
    print(f"\n  Last 5 rows:")
    print(close.tail())
    print(f"\n  SUCCESS - Mixed portfolio works!")
except Exception as e:
    print(f"\n  FAILED: {e}")
    import traceback
    traceback.print_exc()
