# BestAllocation

**BestAllocation** is an institutional-grade Walk-Forward Analysis and Portfolio Optimization platform. It empowers quantitative investors and portfolio managers to dynamically compare advanced asset allocation algorithms using historical market data.

## Overview

The platform uses a rigorous Walk-Forward methodology to backtest trading strategies, avoiding look-ahead bias and simulating real-world portfolio rebalancing. It compares multiple state-of-the-art optimization methods against a benchmark to identify the most robust risk-adjusted returns.

### Core Methodologies Supported
- **HRP (Hierarchical Risk Parity)**: Uses graph theory and machine learning (hierarchical clustering) to allocate risk without requiring expected return estimates or covariance matrix inversion.
- **GMV (Global Minimum Variance)**: Focuses entirely on minimizing portfolio volatility based on the covariance matrix.
- **MVO (Mean-Variance Optimization)**: The classic Markowitz model aiming to maximize the Sharpe ratio, balanced with specific risk and return constraints.
- **Equal Weight (Benchmark)**: A naive allocation strategy used as a baseline for performance comparison.

## Architecture

BestAllocation is built with a modern, decoupled architecture:

- **Backend**: A high-performance Python server built with **FastAPI**. It handles data ingestion (via Tiingo API), mathematical vectorization (NumPy/Pandas), parallelized backtesting, and quantitative metrics calculations.
- **Frontend**: A highly responsive Single Page Application (SPA) built with **React** and **Vite**. It features interactive charting and analytics to visualize equity curves, drawdowns, risk contributions, and efficient frontiers.

## Features

- **Walk-Forward Backtesting**: Dynamically trains and rebalances the portfolio over rolling windows.
- **Parallel Processing**: Heavily optimized engine that runs multiple optimization algorithms concurrently for rapid feedback.
- **Transaction Costs & Constraints**: Accurately models real-world trading by incorporating basis points costs and min/max weight boundaries.
- **Deep Analytics**: Provides comprehensive statistics including Sharpe, Sortino, Calmar, Max Drawdown, Skewness, Kurtosis, and Alpha/Beta against benchmarks.
- **Volatility Scaling**: Optional mechanism to target a specific annualized volatility.

## Getting Started

### Prerequisites
- Node.js (for the frontend)
- Python 3.10+ (for the backend)
- A Tiingo API Key (for historical market data)

### Local Development

1. **Backend**:
   Navigate to the root directory, install dependencies (e.g., via `pip install -r requirements.txt`), and run the FastAPI server:
   ```bash
   python -m uvicorn backend.main:app --reload --port 8000
   ```

2. **Frontend**:
   Navigate to the `frontend/` directory, install Node modules, and start the Vite development server:
   ```bash
   npm install
   npm run dev
   ```

## Disclaimer
*This project is for research and educational purposes only. It does not constitute financial advice. Past performance is not indicative of future results.*
