# 📊 BestAllocation

> **Walk-Forward portfolio allocation comparator — HRP vs Min-CVaR vs MVO.**

BestAllocation is a full-stack web application that compares three portfolio allocation strategies on real market data using a realistic walk-forward backtest. Enter a list of tickers (stocks, ETFs, crypto), and it tells you — with honest, point-in-time methodology — which allocation approach would have served you best, and how confident you should be in that answer.

## 🎯 What it does

1. Fetches historical adjusted prices from the **Tiingo API** (single data source, cached on disk) and the risk-free rate from **FRED** (3-month T-Bill, falls back to a constant 4.5% if unavailable).
2. Runs a **walk-forward backtest** for the three strategies in parallel: optimize on a rolling training window (default 252 days), hold for a rebalancing window (default 63 days), repeat — using only data available at each decision point.
3. Computes **16+ performance metrics** (Sharpe, Sortino, Max Drawdown, Calmar, Omega, alpha/beta vs your chosen benchmark…), **historical stress tests**, a **rolling Sharpe**, and an **overfitting diagnostic**.
4. Displays everything in an interactive React dashboard, including a rebalancer that converts your actual holdings into concrete trade instructions.

## 🧠 The three strategies

### 1. HRP — Hierarchical Risk Parity
*López de Prado (2016).* Clusters assets by correlation distance (Ward linkage), quasi-diagonalizes the covariance matrix, then allocates by recursive bisection with inverse-variance weights. Needs **no expected-return estimates and no matrix inversion** — its main robustness argument. Note: weight bounds are deliberately NOT applied to HRP (they would break the recursive bisection structure).

### 2. Min-CVaR — Conditional Value at Risk
*Rockafellar & Uryasev (2000).* Minimizes the **expected loss on the worst (1−β)% of days** (default β = 95%), solved as a linear program on the historical daily returns via `EfficientCVaR.min_cvar()` (PyPortfolioOpt/CVXPY). Unlike variance, CVaR is a **coherent risk measure** (Artzner et al., 1999) and captures tail asymmetry — our test suite proves it diverges from min-variance on skewed returns.
⚠️ *Statistical caveat: at 95% on a 252-day window, the tail estimate rests on ~13 observations — allocations can shift when a single extreme day enters/leaves the window.*

### 3. MVO — Mean-Variance Optimization (Max Sharpe)
*Markowitz (1952).* Maximizes the Sharpe ratio. Classic MVO is an "error maximizer" (Michaud, 1989), so this implementation is robustified with:
- **EMA expected returns** (recency-weighted, dynamic span),
- **James-Stein-style shrinkage** of expected returns towards the grand mean (fixed intensity λ = 0.5),
- **Ledoit-Wolf covariance shrinkage** (2004),
- **Go-to-Cash** when every expected return is below the risk-free rate,
- **Graceful fallback to cash** if the convex solver fails,
- **Box constraints** (min/max weight per asset).

### Benchmark
Either **Equal Weight (1/N)** — rebalanced on the same schedule and paying the **same transaction costs** as the strategies — or a **custom ticker** (e.g. SPY, buy-and-hold, shown gross). Strategy alpha/beta are measured against the benchmark you selected.

## 🔬 Backtest realism (what makes the numbers trustworthy)

| Aspect | Implementation |
|---|---|
| No look-ahead | Optimize on Close data up to T, decide at T, **execute at Open(T+1)** |
| Prices | Dividend/split-adjusted Close (valuation) and Open (execution) |
| Transaction costs | Charged per side on traded value (default 10 bps), including initial deployment — for strategies **and** the EW benchmark |
| Cash | Earns the **historical** FRED T-Bill rate (time series, not a constant), accrued daily |
| Turnover smoothing | New weights blended 75/25 with previous ones (reduces churn; deliberately not renormalized so strategies can glide to cash) |
| Mixed calendars | Crypto (24/7) and stocks (5d/week) are intersected on common trading days — no stale forward-filled weekend prices polluting correlations |
| Annualization | Auto-detected: 252 (stocks) or 365 (crypto-only portfolios) |
| Full-resolution analytics | Stress tests and rolling Sharpe are computed server-side on the daily curve; the UI only receives downsampled curves for display |

**Honesty features:** survivorship-bias warning on every run, per-period `fallback` flags when an optimizer failed, cash periods excluded from the overfitting statistics, and an overfitting diagnostic that is explicitly labeled as a heuristic rank-IC (not a formal PBO/Deflated-Sharpe test).

## 🏗️ Architecture

```
frontend/  React 19 + TypeScript + Vite + MUI v6 + Recharts (SPA)
backend/   Python 3.11 + FastAPI
  ├── main.py                 # app entry, CORS, IP rate limiting (XFF-aware)
  ├── app/api/routes.py       # endpoints, job orchestration, parallel strategy runs
  ├── app/core/schemas.py     # Pydantic request/response models (single source of API defaults)
  ├── app/services/jobs.py    # in-memory async job manager (TTL, thread-safe)
  ├── optimization.py         # HRP, Min-CVaR, MVO + shrinkage
  ├── backtester.py           # walk-forward engine, benchmarks
  ├── metrics.py              # performance metrics, stress tests, rolling Sharpe
  ├── data_provider.py        # Tiingo + FRED fetching, joblib disk cache
  └── config.py               # constants (stress scenarios, shrinkage intensity…)
```

The API is asynchronous: `POST /api/compare/start` returns a `job_id`; the frontend polls `GET /api/jobs/{job_id}` for progress (0-100%) and results. `GET /api/health` and `GET /api/version` are available for monitoring. Rate limiting: 5 comparisons/min/IP.

**Known single points of failure (by design, for a personal tool):** Tiingo is the only price source — there is **no secondary provider**; the joblib disk cache mitigates repeat queries. The job store and rate limiter are in-process (single instance; use Redis if you ever scale horizontally).

## 🚀 Getting started

### Prerequisites
- Python 3.11+ · Node.js 18+ · a free [Tiingo API key](https://api.tiingo.com/) (required) · a [FRED API key](https://fred.stlouisfed.org/docs/api/api_key.html) (optional — falls back to 4.5%)

### Run locally

```bash
git clone https://github.com/Vlinter/BestAllocation.git
cd BestAllocation

# Backend — note: run from the REPO ROOT (the app uses absolute imports)
python -m venv .venv
.venv\Scripts\activate            # Windows  (source .venv/bin/activate on Unix)
pip install -r backend/requirements.txt
echo TIINGO_API_KEY=your_key_here > backend/.env
python -m uvicorn backend.main:app --reload --port 8000

# Frontend (second terminal)
cd frontend
npm install
npm run dev                        # → http://localhost:5173
```

### Tests

```bash
pip install -r backend/requirements-dev.txt
pytest backend -q                  # offline — no API keys needed
```

The suite includes a discriminating tail-risk test: on variance-matched but negatively-skewed synthetic returns, the Min-CVaR optimizer must diverge from closed-form min-variance (it does: ~63/37 vs 50/50). CI runs the backend tests and the frontend type-check/build on every PR.

### Docker / production

```bash
docker build -t bestallocation .
docker run -p 8000:8000 -e TIINGO_API_KEY=your_key bestallocation
```

Multi-stage build: the React app is compiled and served directly by FastAPI (SPA catch-all). Environment variables:

| Variable | Required | Purpose |
|---|---|---|
| `TIINGO_API_KEY` | ✅ | Market data |
| `FRED_API_KEY` | – | Historical risk-free rate (fallback: 4.5% constant) |
| `ALLOWED_ORIGINS` | prod | CORS — set to your exact domain(s), default `*` |
| `PORT` | – | Server port (default 8000) |
| `JOBLIB_CACHE_DIR` | – | Disk cache location |

## ⚠️ Limitations

- **No slippage / market impact** — execution exactly at next open; fine for liquid ETFs and modest sizes.
- **Fractional shares** — quantities are continuous (divisibility assumption; realistic for ETFs/funds, not for a single BRK.A).
- **Long-only**, no leverage.
- **Survivorship bias** — you pick today's tickers; delisted assets aren't in the universe.
- **CVaR small-sample tail** — ~13 tail observations at 95%/252d (see above).
- **Overfitting diagnostic is a heuristic** — a Spearman rank-IC on predicted vs realized Sharpe per period, not Bailey & López de Prado's PBO/CSCV nor the Deflated Sharpe Ratio; with few rebalances the correlation is noisy.
- Past performance ≠ future results. This is a research tool, not financial advice.

## 📚 References

- Markowitz (1952) — *Portfolio Selection*
- James & Stein (1961) — *Estimation with Quadratic Loss*
- Sharpe (1966) — *Mutual Fund Performance*
- Michaud (1989) — *The Markowitz Optimization Enigma*
- Artzner, Delbaen, Eber, Heath (1999) — *Coherent Measures of Risk*
- Rockafellar & Uryasev (2000) — *Optimization of Conditional Value-at-Risk*
- Ledoit & Wolf (2004) — *Honey, I Shrunk the Sample Covariance Matrix*
- López de Prado (2016) — *Building Diversified Portfolios that Outperform Out-of-Sample*
