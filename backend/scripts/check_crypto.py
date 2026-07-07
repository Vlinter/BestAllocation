"""Manual end-to-end check: mixed crypto + ETF fetch through fetch_price_data.

NOT a pytest test — it performs REAL Tiingo API calls (needs TIINGO_API_KEY).
Run manually from the repo root:

    python backend/scripts/check_crypto.py
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend.data_provider import fetch_price_data


def main():
    tickers = ["SPY", "GLD", "BTCUSD"]
    print(f"=== Checking mixed portfolio: {tickers} ===\n")

    try:
        close, open_, start_dates, limiting = fetch_price_data(tickers, "2024-01-01", "2024-06-01")
        print("Result:")
        print(f"  Shape: {close.shape}")
        print(f"  Columns: {list(close.columns)}")
        print(f"  Date range: {close.index[0].date()} to {close.index[-1].date()}")
        print(f"  Total days: {len(close)}")
        print(f"  Limiting ticker: {limiting}")
        print(f"  Start dates: {start_dates}")
        weekend_rows = int((close.index.dayofweek >= 5).sum())
        print(f"  Weekend rows (should be 0 — calendars are intersected): {weekend_rows}")
        print(f"  NaN count per column: {close.isna().sum().to_dict()}")
        print("\n  SUCCESS - Mixed portfolio works!")
    except Exception as e:
        print(f"\n  FAILED: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
