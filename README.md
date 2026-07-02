# 📊 BestAllocation

> **Institutional-grade Walk-Forward Analysis and Portfolio Optimization platform.**

BestAllocation is a full-stack web application that empowers quantitative investors and portfolio managers to dynamically compare advanced asset allocation algorithms using historical market data. By running realistic walk-forward backtests, it helps determine which portfolio optimization strategy would have performed best historically.

## 🎯 Overview

The platform uses a rigorous **Walk-Forward methodology** to backtest trading strategies, avoiding look-ahead bias and simulating real-world portfolio rebalancing. It compares multiple state-of-the-art optimization methods against a benchmark to identify the most robust risk-adjusted returns.

Users simply input financial tickers (stocks, ETFs, cryptos), and the system:
1. Fetches historical market data (Tiingo API with fallback to Yahoo Finance).
2. Executes a realistic Walk-Forward backtest for 3 optimization strategies in parallel.
3. Calculates 16+ performance metrics (Sharpe, Sortino, Max Drawdown, Alpha, Beta, Omega, etc.).
4. Displays the results in an interactive React UI with multiple charts and analytics.

---

## ✨ Key Features

- **Realistic Walk-Forward Backtesting**: Dynamically trains and rebalances the portfolio over rolling windows, avoiding look-ahead bias by simulating execution at the next day's open price.
- **Parallel Processing**: Heavily optimized asynchronous backend engine (FastAPI + ThreadPoolExecutor) that runs multiple optimization algorithms concurrently for rapid feedback.
- **Transaction Costs & Constraints**: Accurately models real-world trading by incorporating transaction costs (in basis points), minimum/maximum weight boundaries, and cash accrual.
- **Deep Analytics**: Provides comprehensive statistics including Sharpe, Sortino, Calmar, Max Drawdown, Skewness, Kurtosis, and Alpha/Beta against benchmarks.
- **Interactive UI**: A highly responsive Single Page Application (SPA) featuring 9 types of charts (Equity Curve, Drawdown, Efficient Frontier, Allocation History, Correlation Heatmaps, etc.).

---

## 🧠 Optimization Strategies Supported

### 1. HRP (Hierarchical Risk Parity)
Uses graph theory and machine learning (hierarchical clustering) to allocate risk without requiring expected return estimates or covariance matrix inversion. It groups correlated assets and allocates capital based on inverse variance, resulting in a highly stable portfolio.

### 2. CVaR (Conditional Value at Risk)
Focuses entirely on minimizing portfolio volatility based on the covariance matrix without considering expected returns, making it highly robust to estimation errors.

### 3. MVO (Mean-Variance Optimization / Max Sharpe)
The classic Markowitz model aiming to maximize the Sharpe ratio. 
> [!CAUTION]
> Classic MVO is known as an "error maximizer". Our implementation integrates **6 robustness techniques** to solve this:
> - **EMA Expected Returns**: Exponential Moving Average to weight recent data more heavily.
> - **James-Stein Shrinkage**: Shrinks individual asset returns towards the grand mean to reduce noise.
> - **Ledoit-Wolf Covariance Shrinkage**: Guarantees a well-conditioned, positive semi-definite matrix.
> - **Go-to-Cash Strategy**: Automatically allocates to cash if all expected returns are below the risk-free rate.
> - **Graceful Fallbacks**: Cascades to Cash or Equal-Weight if the convex solver fails.
> - **Box Constraints**: Enforces a minimum (e.g., 5%) and maximum (e.g., 40%) weight to ensure diversification.

### 4. Equal Weight (Benchmark)
A naive 1/N allocation strategy used as a baseline for performance comparison.

---

## 🏗️ Architecture

BestAllocation is built with a modern, decoupled architecture:

- **Frontend (React 19 + TypeScript + Vite)**: Uses Material UI (MUI v6) for components and Recharts for data visualization.
- **Backend (Python 3.11 + FastAPI)**: Handles data ingestion, mathematical vectorization (NumPy/Pandas, PyPortfolioOpt, CVXPY), and parallelized backtesting. It uses an async job pattern for long-running calculations to keep the UI responsive.
- **Data Sources**: Tiingo API (Primary for prices), FRED API (Risk-free rates), yfinance (Fallback).

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended for the frontend)
- Python 3.10+ (for the backend)
- A [Tiingo API Key](https://api.tiingo.com/) (for historical market data)

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/BestAllocation.git
   cd BestAllocation
   ```

2. **Backend Setup:**
   Navigate to the `backend/` directory, set up your environment variables, install dependencies, and run the FastAPI server:
   ```bash
   cd backend
   python -m venv venv
   source venv/Scripts/activate  # On Windows
   pip install -r requirements.txt
   
   # Create a .env file and add your TIINGO_API_KEY
   echo TIINGO_API_KEY=your_api_key_here > .env
   
   # Start the server
   python -m uvicorn main:app --reload --port 8000
   ```

3. **Frontend Setup:**
   Navigate to the `frontend/` directory, install Node modules, and start the Vite development server:
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

4. **Access the application:**
   Open your browser and navigate to `http://localhost:5173`.

---

## ⚠️ Disclaimer
*This project is for research and educational purposes only. It does not constitute financial advice. Past performance is not indicative of future results.*
