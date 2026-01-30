import yfinance as yf
import pandas as pd
from typing import List, Optional, Tuple
from fastapi import HTTPException
from datetime import datetime
import os
import time
from joblib import Memory


def download_with_retry(tickers, max_retries=3, **kwargs):
    """
    Wrapper for yf.download with retry logic for cloud environments.
    Yahoo Finance sometimes blocks cloud server IPs.
    """
    for attempt in range(max_retries):
        try:
            data = yf.download(tickers, **kwargs)
            if not data.empty:
                return data
            # If empty, wait and retry
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # Exponential backoff: 1s, 2s, 4s
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
    
    # Final attempt without catching
    return yf.download(tickers, **kwargs)

# ============================================================================
# Caching Configuration
# ============================================================================

CACHE_DIR = os.path.join(os.path.dirname(__file__), "__cache__")
memory = Memory(CACHE_DIR, verbose=0)

# ============================================================================
# Dynamic Risk-Free Rate from Treasury
# ============================================================================

# Cache risk free rate for 1 hour to avoid spamming Yahoo
@memory.cache
def get_risk_free_rate() -> float:
    """
    Fetch current 13-week T-Bill rate (^IRX) from Yahoo Finance.
    Returns annualized rate as decimal.
    """
    try:
        irx = yf.Ticker("^IRX")
        hist = irx.history(period="5d")
        if not hist.empty:
            # ^IRX is quoted as percentage, convert to decimal
            rate = hist["Close"].iloc[-1] / 100
            if pd.isna(rate):
                return 0.045
            return float(rate)
    except Exception as e:
        print(f"Warning: Could not fetch Risk Free Rate ({e}), using default 4.5%")
    # Fallback to reasonable default
@memory.cache
def fetch_risk_free_rate_history(start_date: Optional[str] = None, end_date: Optional[str] = None) -> pd.Series:
    """
    Fetch historical 13-week T-Bill rate (^IRX) from Yahoo Finance.
    Returns Series of daily annualized rates as decimals (e.g. 0.045).
    """
    try:
        # T-Bill ^IRX
        ticker = "^IRX"
        if start_date is None:
            data = download_with_retry(ticker, period="max", progress=False, auto_adjust=True)
        else:
            data = download_with_retry(ticker, start=start_date, end=end_date, progress=False, auto_adjust=True)
            
        if data.empty:
            print("Warning: Could not fetch ^IRX history. Returning empty Series.")
            return pd.Series(dtype=float)
            
        # Handle columns
        if isinstance(data.columns, pd.MultiIndex):
            if "Close" in data.columns.get_level_values(0):
               prices = data["Close"]
            else:
               prices = data.iloc[:, 0] # Fallback
        elif "Close" in data.columns:
            prices = data["Close"]
        else:
            prices = data.iloc[:, 0]
            
        # Clean series
        if isinstance(prices, pd.DataFrame):
             # Extract Series if it's still a DF (e.g. single column DF)
             prices = prices.iloc[:, 0]
             
        prices = pd.to_numeric(prices, errors='coerce').ffill().dropna()
        
        # ^IRX is percentage (e.g., 4.5 means 4.5%), convert to decimal 0.045
        return prices / 100.0
        
    except Exception as e:
        print(f"Error fetching Risk Free Rate History: {e}")
        return pd.Series(dtype=float)


# ============================================================================
# Data Fetching
# ============================================================================

@memory.cache
def fetch_price_data(tickers: List[str], start_date: Optional[str], end_date: Optional[str]) -> Tuple[pd.DataFrame, dict, Optional[str]]:
    """
    Fetch adjusted close prices. If start_date is None, fetch all available history.
    Returns: (prices DataFrame, ticker_start_dates dict, limiting_ticker str)
    """
    try:
        # Use "max" period if no start date specified
        if start_date is None:
            data = download_with_retry(tickers, period="max", progress=False, auto_adjust=True)
        else:
            end = end_date if end_date else datetime.now().strftime("%Y-%m-%d")
            data = download_with_retry(tickers, start=start_date, end=end, progress=False, auto_adjust=True)
        
        if data.empty:
            raise HTTPException(status_code=400, detail=f"No data found for tickers: {tickers}")
        
        # Handle multi-level columns from yfinance
        if isinstance(data.columns, pd.MultiIndex):
            # Get Close prices only
            if "Close" in data.columns.get_level_values(0):
                data = data["Close"]
            else:
                # If only one level is present but it's MultiIndex, or obscure structure
                # Try validation
                pass

        # If we downloaded a single ticker, yfinance might descend to Series or different shape
        # Ensure we have a DataFrame with columns = tickers
        if isinstance(data, pd.Series):
             data = data.to_frame(name=tickers[0])
        
        # Clean columns if they are still MultiIndex or tuple
        if isinstance(data.columns, pd.MultiIndex):
             # Try to just get the ticker symbol level
             # usually level 1 is ticker in (Price, Ticker) structure
             data.columns = data.columns.get_level_values(-1)

        # Force column names to be simple strings
        data.columns = [str(col).strip().upper() for col in data.columns]
        
        # Ensure all requested tickers are present or filtered
        # It's possible some tickers failed. We proceed with what we have.
        
        # Convert all columns to numeric
        for col in data.columns:
            data[col] = pd.to_numeric(data[col], errors='coerce')
        
        # Track first valid date per ticker BEFORE any cleaning
        ticker_start_dates = {}
        for col in data.columns:
            first_valid = data[col].first_valid_index()
            if first_valid is not None:
                ticker_start_dates[col] = first_valid.strftime("%Y-%m-%d")
            else:
                ticker_start_dates[col] = "N/A"
        
        # Find the limiting ticker (the one that starts latest)
        limiting_ticker = None
        latest_start = None
        latest_start_date = None
        for ticker, date_str in ticker_start_dates.items():
            if date_str != "N/A":
                if latest_start is None or date_str > latest_start:
                    latest_start = date_str
                    limiting_ticker = ticker
        
        # IMPORTANT: Only keep data from the date when ALL tickers have data
        # This is the date of the LATEST starting ticker
        if latest_start:
            latest_start_date = pd.to_datetime(latest_start)
            data = data[data.index >= latest_start_date]
        
        # Now do ffill for any occasional missing values (weekends, holidays)
        data = data.ffill().dropna()
        
        # Filter by end_date if specified
        if end_date:
            data = data[data.index <= end_date]
        
        if len(data) < 60:
            raise HTTPException(status_code=400, detail=f"Insufficient data: only {len(data)} days available (limiting ticker: {limiting_ticker})")
        
        return data, ticker_start_dates, limiting_ticker
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching data: {str(e)}")
