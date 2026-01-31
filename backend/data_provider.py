import pandas as pd
import requests
from typing import List, Optional, Tuple
from fastapi import HTTPException
from datetime import datetime, timedelta
import os
from joblib import Memory
import time

# ============================================================================
# API Configuration
# ============================================================================

# Tiingo API - set via environment variable for security, with fallback
TIINGO_API_KEY = os.environ.get("TIINGO_API_KEY", "54ca10d47b712bee420fba733caf5eca073742cd")
TIINGO_BASE_URL = "https://api.tiingo.com"

# Rate limiting: Tiingo free tier has generous limits but we add small delay
RATE_LIMIT_DELAY = 0.2  # 200ms between calls

# ============================================================================
# Caching Configuration
# ============================================================================

CACHE_DIR = os.path.join(os.path.dirname(__file__), "__cache__")
memory = Memory(CACHE_DIR, verbose=0)

# ============================================================================
# Tiingo API Helper Functions
# ============================================================================

def tiingo_request(endpoint: str, params: dict = None) -> dict | list:
    """Make a request to Tiingo API."""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Token {TIINGO_API_KEY}"
    }
    
    if params is None:
        params = {}
    
    url = f"{TIINGO_BASE_URL}{endpoint}"
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Tiingo API error: {e}")
        raise HTTPException(status_code=500, detail=f"Data provider error: {str(e)}")


def fetch_ticker_history(ticker: str, start_date: str, end_date: str) -> pd.Series:
    """
    Fetch historical adjusted close prices for a single ticker from Tiingo.
    Returns a Series with datetime index and close prices.
    """
    endpoint = f"/tiingo/daily/{ticker}/prices"
    params = {
        "startDate": start_date,
        "endDate": end_date,
        "resampleFreq": "daily"
    }
    
    try:
        data = tiingo_request(endpoint, params)
        
        if not data or not isinstance(data, list):
            print(f"No data for {ticker}")
            return pd.Series(dtype=float)
        
        # Create DataFrame from results
        df = pd.DataFrame(data)
        
        if df.empty or "date" not in df.columns:
            print(f"Invalid data format for {ticker}")
            return pd.Series(dtype=float)
        
        # Parse date and set as index
        df["date"] = pd.to_datetime(df["date"]).dt.tz_localize(None)
        df = df.set_index("date")
        
        # Rate limiting
        time.sleep(RATE_LIMIT_DELAY)
        
        # Use adjusted close (adjClose) for accurate backtesting
        if "adjClose" in df.columns:
            return df["adjClose"]
        elif "close" in df.columns:
            return df["close"]
        else:
            print(f"No close price column for {ticker}")
            return pd.Series(dtype=float)
        
    except Exception as e:
        print(f"Error fetching {ticker}: {e}")
        return pd.Series(dtype=float)


# ============================================================================
# Dynamic Risk-Free Rate from Treasury
# ============================================================================

@memory.cache
def get_risk_free_rate() -> float:
    """
    Get current risk-free rate.
    Uses a reasonable default.
    """
    return 0.045  # 4.5%


@memory.cache  
def fetch_risk_free_rate_history(start_date: Optional[str] = None, end_date: Optional[str] = None) -> pd.Series:
    """
    Fetch historical risk-free rates.
    Returns Series of daily annualized rates as decimals (e.g. 0.045).
    """
    if start_date is None:
        start_date = "2010-01-01"
    if end_date is None:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    dates = pd.date_range(start=start_date, end=end_date, freq="B")
    return pd.Series(0.045, index=dates)


# ============================================================================
# Data Fetching
# ============================================================================

@memory.cache
def fetch_price_data(tickers: List[str], start_date: Optional[str], end_date: Optional[str]) -> Tuple[pd.DataFrame, dict, Optional[str]]:
    """
    Fetch adjusted close prices from Tiingo API.
    Returns: (prices DataFrame, ticker_start_dates dict, limiting_ticker str)
    """
    try:
        # Default date range if not specified
        if end_date is None:
            end_date = datetime.now().strftime("%Y-%m-%d")
        if start_date is None:
            start_date = (datetime.now() - timedelta(days=3650)).strftime("%Y-%m-%d")
        
        # Fetch data for each ticker
        all_data = {}
        ticker_start_dates = {}
        
        print(f"Fetching data for {len(tickers)} tickers from Tiingo...")
        
        for ticker in tickers:
            print(f"  Fetching {ticker}...")
            series = fetch_ticker_history(ticker, start_date, end_date)
            
            if not series.empty:
                all_data[ticker] = series
                first_valid = series.first_valid_index()
                if first_valid is not None:
                    ticker_start_dates[ticker] = first_valid.strftime("%Y-%m-%d")
                else:
                    ticker_start_dates[ticker] = "N/A"
            else:
                ticker_start_dates[ticker] = "N/A"
        
        # Check if we got any data
        if not all_data:
            raise HTTPException(status_code=400, detail=f"No data found for tickers: {tickers}")
        
        # Check which tickers failed
        failed_tickers = [t for t in tickers if t not in all_data]
        if failed_tickers:
            raise HTTPException(status_code=400, detail=f"No data found for tickers: {failed_tickers}")
        
        # Combine into DataFrame
        data = pd.DataFrame(all_data)
        
        # Force column names to uppercase
        data.columns = [str(col).strip().upper() for col in data.columns]
        
        # Find the limiting ticker (starts latest)
        limiting_ticker = None
        latest_start = None
        for ticker, date_str in ticker_start_dates.items():
            if date_str != "N/A":
                if latest_start is None or date_str > latest_start:
                    latest_start = date_str
                    limiting_ticker = ticker
        
        # Only keep data from the date when ALL tickers have data
        if latest_start:
            latest_start_date = pd.to_datetime(latest_start)
            data = data[data.index >= latest_start_date]
        
        # Forward fill missing values and drop any remaining NaN
        data = data.ffill().dropna()
        
        # Filter by end_date if specified
        if end_date:
            data = data[data.index <= end_date]
        
        if len(data) < 60:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient data: only {len(data)} days available (limiting ticker: {limiting_ticker})"
            )
        
        print(f"Successfully fetched {len(data)} days of data for {len(tickers)} tickers")
        
        return data, ticker_start_dates, limiting_ticker
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching data: {str(e)}")
