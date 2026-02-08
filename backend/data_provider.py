import pandas as pd
import requests
from typing import List, Optional, Tuple, Dict
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

# FRED API - for Treasury rates (risk-free rate)
FRED_API_KEY = os.environ.get("FRED_API_KEY", "38f9d5b857b45bead3fc3de623332e1a")
FRED_BASE_URL = "https://api.stlouisfed.org/fred"

# Rate limiting
RATE_LIMIT_DELAY = 0.2  # 200ms between calls

# ============================================================================
# Caching Configuration
# ============================================================================

# Use environment variable for cache dir, or default based on context
# Docker uses /app/.cache/joblib (created in Dockerfile)
# Local development uses __cache__ relative to this file
CACHE_DIR = os.environ.get(
    "JOBLIB_CACHE_DIR", 
    os.path.join(os.path.dirname(__file__), "__cache__")
)
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


def fetch_ticker_history(ticker: str, start_date: str, end_date: str) -> Tuple[pd.Series, pd.Series]:
    """
    Fetch historical adjusted close AND open prices for a single ticker from Tiingo.
    Returns: (adjClose series, adjOpen series) with datetime index.
    
    For realistic backtesting:
    - adjClose: Used for optimization and end-of-day valuation
    - adjOpen: Used for trade execution at T+1
    """
    endpoint = f"/tiingo/daily/{ticker}/prices"
    params = {
        "startDate": start_date,
        "endDate": end_date,
        "resampleFreq": "daily"
    }
    
    empty_series = pd.Series(dtype=float)
    
    try:
        data = tiingo_request(endpoint, params)
        
        if not data or not isinstance(data, list):
            print(f"No data for {ticker}")
            return empty_series, empty_series
        
        # Create DataFrame from results
        df = pd.DataFrame(data)
        
        if df.empty or "date" not in df.columns:
            print(f"Invalid data format for {ticker}")
            return empty_series, empty_series
        
        # Parse date and set as index
        df["date"] = pd.to_datetime(df["date"]).dt.tz_localize(None)
        df = df.set_index("date")
        
        # Rate limiting
        time.sleep(RATE_LIMIT_DELAY)
        
        # Extract adjusted close (required)
        if "adjClose" in df.columns:
            adj_close = df["adjClose"]
        elif "close" in df.columns:
            adj_close = df["close"]
        else:
            print(f"No close price column for {ticker}")
            return empty_series, empty_series
        
        # Extract adjusted open (for T+1 execution)
        if "adjOpen" in df.columns:
            adj_open = df["adjOpen"]
        elif "open" in df.columns:
            adj_open = df["open"]
        else:
            # Fallback: use adjClose for open (slight approximation, log warning)
            print(f"Warning: No open price for {ticker}, using adjClose as fallback")
            adj_open = adj_close
        
        return adj_close, adj_open
        
    except Exception as e:
        print(f"Error fetching {ticker}: {e}")
        return empty_series, empty_series


# ============================================================================
# Dynamic Risk-Free Rate from Treasury (FRED API)
# ============================================================================

def fetch_fred_series(series_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None) -> pd.Series:
    """
    Fetch a data series from FRED API.
    """
    params = {
        "series_id": series_id,
        "api_key": FRED_API_KEY,
        "file_type": "json"
    }
    
    if start_date:
        params["observation_start"] = start_date
    if end_date:
        params["observation_end"] = end_date
    
    try:
        url = f"{FRED_BASE_URL}/series/observations"
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if "observations" not in data:
            print(f"No observations for FRED series {series_id}")
            return pd.Series(dtype=float)
        
        observations = data["observations"]
        if not observations:
            return pd.Series(dtype=float)
        
        # Convert to Series
        dates = [obs["date"] for obs in observations]
        values = [float(obs["value"]) if obs["value"] != "." else None for obs in observations]
        
        series = pd.Series(values, index=pd.to_datetime(dates))
        series = series.dropna()
        
        return series
        
    except Exception as e:
        print(f"Error fetching FRED series {series_id}: {e}")
        return pd.Series(dtype=float)


@memory.cache
def get_risk_free_rate() -> float:
    """
    Get current 3-Month Treasury Bill rate from FRED.
    DTB3 = 3-Month Treasury Bill Secondary Market Rate
    Returns annualized rate as decimal.
    """
    try:
        # Fetch last 30 days to ensure we get a recent value
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        series = fetch_fred_series("DTB3", start_date, end_date)
        
        if not series.empty:
            # DTB3 is already in percentage (e.g., 4.5 = 4.5%), convert to decimal
            rate = series.iloc[-1] / 100
            print(f"Current T-Bill rate from FRED: {rate:.4f}")
            return float(rate)
    except Exception as e:
        print(f"Error fetching risk-free rate: {e}")
    
    # Fallback to reasonable default
    print("Using default risk-free rate: 4.5%")
    return 0.045


@memory.cache  
def fetch_risk_free_rate_history(start_date: Optional[str] = None, end_date: Optional[str] = None) -> pd.Series:
    """
    Fetch historical 3-Month Treasury Bill rates from FRED.
    Returns Series of daily annualized rates as decimals (e.g. 0.045).
    """
    if start_date is None:
        start_date = "2010-01-01"
    if end_date is None:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    series = fetch_fred_series("DTB3", start_date, end_date)
    
    if series.empty:
        print("Warning: Could not fetch T-Bill history from FRED. Using constant rate.")
        dates = pd.date_range(start=start_date, end=end_date, freq="B")
        return pd.Series(0.045, index=dates)
    
    # Convert percentage to decimal
    return series / 100.0


# ============================================================================
# Data Fetching
# ============================================================================

@memory.cache
def fetch_price_data(tickers: List[str], start_date: Optional[str], end_date: Optional[str]) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, str], Optional[str]]:
    """
    Fetch adjusted close AND open prices from Tiingo API.
    
    Returns:
        - close_prices: DataFrame of adjusted close prices (for optimization & valuation)
        - open_prices: DataFrame of adjusted open prices (for T+1 execution)
        - ticker_start_dates: Dict mapping ticker to first available date
        - limiting_ticker: The ticker that limits the common date range
    """
    try:
        # Default date range if not specified
        if end_date is None:
            end_date = datetime.now().strftime("%Y-%m-%d")
        if start_date is None:
            # Fetch maximum available history (since 1990)
            start_date = "1990-01-01"
        
        # Fetch data for each ticker
        all_close_data = {}
        all_open_data = {}
        ticker_start_dates = {}
        
        print(f"Fetching data for {len(tickers)} tickers from Tiingo...")
        
        for ticker in tickers:
            print(f"  Fetching {ticker}...")
            close_series, open_series = fetch_ticker_history(ticker, start_date, end_date)
            
            if not close_series.empty:
                all_close_data[ticker] = close_series
                all_open_data[ticker] = open_series
                first_valid = close_series.first_valid_index()
                if first_valid is not None:
                    ticker_start_dates[ticker] = first_valid.strftime("%Y-%m-%d")
                else:
                    ticker_start_dates[ticker] = "N/A"
            else:
                ticker_start_dates[ticker] = "N/A"
        
        # Check if we got any data
        if not all_close_data:
            raise HTTPException(status_code=400, detail=f"No data found for tickers: {tickers}")
        
        # Check which tickers failed
        failed_tickers = [t for t in tickers if t not in all_close_data]
        if failed_tickers:
            raise HTTPException(status_code=400, detail=f"No data found for tickers: {failed_tickers}")
        
        # Combine into DataFrames
        close_prices = pd.DataFrame(all_close_data)
        open_prices = pd.DataFrame(all_open_data)
        
        # Force column names to uppercase
        close_prices.columns = [str(col).strip().upper() for col in close_prices.columns]
        open_prices.columns = [str(col).strip().upper() for col in open_prices.columns]
        
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
            close_prices = close_prices[close_prices.index >= latest_start_date]
            open_prices = open_prices[open_prices.index >= latest_start_date]
        
        # Forward fill missing values and drop any remaining NaN
        close_prices = close_prices.ffill().dropna()
        open_prices = open_prices.ffill().dropna()
        
        # Align indices (ensure both have same dates)
        common_index = close_prices.index.intersection(open_prices.index)
        close_prices = close_prices.loc[common_index]
        open_prices = open_prices.loc[common_index]
        
        # Filter by end_date if specified
        if end_date:
            close_prices = close_prices[close_prices.index <= end_date]
            open_prices = open_prices[open_prices.index <= end_date]
        
        if len(close_prices) < 60:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient data: only {len(close_prices)} days available (limiting ticker: {limiting_ticker})"
            )
        
        print(f"Successfully fetched {len(close_prices)} days of close+open data for {len(tickers)} tickers")
        
        return close_prices, open_prices, ticker_start_dates, limiting_ticker
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching data: {str(e)}")
