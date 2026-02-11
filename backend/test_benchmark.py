import requests
import time
import json

URL = "http://localhost:8000/optimize"

payload = {
  "tickers": ["SPY", "TLT", "GLD"],
  "start_date": "2020-01-01",
  "end_date": "2023-01-01",
  "method": "hrp",
  "rebalancing_window": 21,
  "training_window": 252,
  "transaction_cost_bps": 10
}

def run_benchmark():
    print("--- Benchmark Start ---")
    
    # 1. First Run (Cold Cache)
    start_time = time.time()
    try:
        response = requests.post(URL, json=payload)
        response.raise_for_status()
    except Exception as e:
        print(f"Request failed: {e}")
        return

    duration_cold = time.time() - start_time
    print(f"Cold Run Duration: {duration_cold:.4f}s")
    
    # 2. Second Run (Warm Cache)
    start_time = time.time()
    response = requests.post(URL, json=payload)
    duration_warm = time.time() - start_time
    print(f"Warm Run Duration: {duration_warm:.4f}s")
    
    if duration_warm < duration_cold * 0.5:
        print("SUCCESS: Caching is working effectively!")
    else:
        print("WARNING: Caching might not be effective or overhead is high.")

if __name__ == "__main__":
    run_benchmark()
