# 📊 BestAllocation

> **Walk-Forward portfolio allocation comparator — HRP vs Min-CVaR vs MVO.**

BestAllocation is a full-stack web application that compares three portfolio allocation strategies on real market data using a realistic walk-forward backtest. Enter a list of tickers (stocks, ETFs, crypto), and it tells you — with honest, point-in-time methodology — which allocation approach would have served you best, and how confident you should be in that answer.

## 🎯 What it does

1. Fetches historical adjusted prices from the **Tiingo API** (single data source, cached on disk) and the risk-free rate from **FRED** (3-month T-Bill, falls back to a constant 4.5% if unavailable).
2. Runs a **walk-forward backtest** for the three strategies in parallel: optimize on a rolling training window (default 252 days), hold for a rebalancing window (default 63 days), repeat — using only data available at each decision point.
3. Computes **16+ performance metrics** (Sharpe, Sortino, Max Drawdown, Calmar, Omega, alpha/beta vs your chosen benchmark…), **historical stress tests**, a **rolling Sharpe**, and a **statistical significance suite** — bootstrap confidence intervals on every Sharpe gap, Probability of Backtest Overfitting, and Deflated Sharpe Ratio.
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
- **Go-to-Cash** when no portfolio *admissible under your weight bounds* beats the risk-free rate — the bar is the best reachable return, not the best single asset, because a 25% cap forces you to hold at least four names,
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
| Full-resolution analytics | Stress tests, rolling Sharpe and the monthly return distribution are computed server-side on the daily curve; the UI only receives downsampled curves for display |

**Honesty features:** survivorship-bias warning on every run, per-period `fallback` flags when an optimizer failed, cash periods excluded from the predictive-power statistics, a confidence interval on every Sharpe gap (see below), and a dashboard that prints **"inconclusive"** when the data does not support a winner — which, on most universes, is what it prints.

## 📐 Statistical validation — does the winner actually win?

A ranking without error bars is a coin toss with decimals. Once the three strategies and the benchmark have run, the backend computes four tests on the **full-resolution daily returns** — never on the downsampled display curves (`backend/significance.py`):

| Test | The question it answers | Method |
|---|---|---|
| **Bootstrap CI on the Sharpe gap** | Is the gap between two strategies real, or inside the noise? | Circular block bootstrap, 21-day blocks, 1 000 resamples. Both series are resampled with the **same** blocks so their correlation survives. Fixed seed: identical inputs give identical intervals. |
| **PBO** — Probability of Backtest Overfitting | Would my podium hold on other years? | CSCV (Bailey, Borwein, López de Prado & Zhu, 2016): 16 splits → 12 870 train/test combinations, vectorised through per-block sufficient statistics. |
| **Deflated Sharpe Ratio** | Does this strategy really beat cash, given that I compared several candidates? | Bailey & López de Prado (2014), correcting for the number of trials, skew and kurtosis. |
| **Rank-IC + detectability ceiling** | Does the in-sample Sharpe predict the next one? | Spearman rank-IC, reported **with the ceiling** implied by the sampling error of a Sharpe estimated over a single holding window (Lo, 2002). |

**What the tests say on the default universe** (6 ETFs, 2006-2026, 77 rebalances):

- All three strategies beat cash credibly — **DSR between 98.8% and 99.8%**.
- **None of them beats the others, or 1/N, at the 5% level.** Every confidence interval crosses zero; the best candidate (MVO − Equal Weight) is **+0.225** Sharpe with a CI of **[−0.02, +0.48]**, p = 0.074.
- **PBO = 36%**: one time in three, the strategy that won on half the history would have landed in the bottom half of the other.

The rank-IC used to be the *only* overfitting diagnostic. It is now reported with its ceiling — which turns out to be **nil** on 63-day windows: an annualized Sharpe estimated over one holding period carries a sampling error of ≈ ±2.0, while the observed dispersion across periods is 1.86-1.99. A ρ near zero was never evidence of overfitting; it was evidence that the test could not resolve anything.

## 🏗️ Architecture

```
frontend/  React 19 + TypeScript + Vite + MUI v7 + Recharts (SPA)
backend/   Python 3.11 + FastAPI
  ├── main.py                 # app entry, CORS, IP rate limiting (XFF-aware)
  ├── app/api/routes.py       # endpoints, job orchestration, parallel strategy runs
  ├── app/core/schemas.py     # Pydantic request/response models (single source of API defaults)
  ├── app/services/jobs.py    # in-memory async job manager (TTL, thread-safe)
  ├── optimization.py         # HRP, Min-CVaR, MVO + shrinkage
  ├── backtester.py           # walk-forward engine, benchmarks
  ├── metrics.py              # performance metrics, stress tests, rolling Sharpe
  ├── significance.py         # bootstrap CIs, PBO/CSCV, Deflated Sharpe, rank-IC ceiling
  ├── data_provider.py        # Tiingo + FRED fetching, joblib disk cache
  └── config.py               # constants (stress scenarios, shrinkage, bootstrap settings…)
```

The API is asynchronous: `POST /api/compare/start` returns a `job_id`; the frontend polls `GET /api/jobs/{job_id}` for progress (0-100%) and results. `GET /api/health` and `GET /api/version` are available for monitoring. Rate limiting: 5 comparisons/min/IP.

**Known single points of failure (by design, for a personal tool):** Tiingo is the only price source — there is **no secondary provider**; the joblib disk cache mitigates repeat queries. The job store and rate limiter are in-process (single instance; use Redis if you ever scale horizontally).

## 🚀 Getting started

### Prerequisites
- Python 3.11–3.13 · Node.js 18+ · a free [Tiingo API key](https://api.tiingo.com/) (required) · a [FRED API key](https://fred.stlouisfed.org/docs/api/api_key.html) (optional — falls back to 4.5%)

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
pytest backend -q                  # backend — offline, no API keys needed
```

```bash
cd frontend && npm test            # frontend components (vitest + testing-library)
```

**70 backend tests + 29 frontend component tests**, all offline. A few carry most of the weight:

- a discriminating tail-risk test — on variance-matched but negatively-skewed synthetic returns, the Min-CVaR optimizer must diverge from closed-form min-variance (it does: ~63/37 vs 50/50);
- the significance suite is tested **in both directions**: each measure must detect the effect it claims to detect *and* refuse to detect one that is not there (a bootstrap CI must cover zero on two identical series, the PBO must approach 50% on pure noise, the DSR must collapse when the number of trials grows);
- the static-file handler is tested against real traversal payloads (`../`, percent-encoded separators, absurd paths), with a guard asserting the decoy file is genuinely reachable — otherwise those tests would pass vacuously;
- on the frontend, the rebalancer is pinned against sizing trades from a stale universe (it once summed holdings for tickers it no longer displayed), the sidebar against sending a request the schema will reject, and `describeApiError` against ever returning something React cannot render.

CI runs the backend tests, the frontend type-check/build, the component tests and the lint on every PR — all four blocking.

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
| `TRUST_PROXY` | prod | Set to `1` **only** behind a proxy that rewrites `X-Forwarded-For` (Render, nginx). Off, the rate limiter keys on the socket peer; on, a direct client could spoof the header and get a fresh bucket per request |
| `PORT` | – | Server port (default 8000) |
| `JOBLIB_CACHE_DIR` | – | Disk cache location |
| `JOBLIB_CACHE_LIMIT` | – | Cache size cap, trimmed LRU at startup (default `500M`) |

## ⚠️ Limitations

- **No slippage / market impact** — execution exactly at next open; fine for liquid ETFs and modest sizes.
- **Fractional shares** — quantities are continuous (divisibility assumption; realistic for ETFs/funds, not for a single BRK.A).
- **Long-only**, no leverage.
- **Survivorship bias** — you pick today's tickers; delisted assets aren't in the universe.
- **CVaR small-sample tail** — ~13 tail observations at 95%/252d (see above).
- **The significance tests have their own small-sample limits** — with the default 252/63 windows a 20-year backtest yields 77 periods, so the PBO uses 16 splits and the bootstrap intervals stay wide. They are honest about uncertainty, not a substitute for more data.
- **The rank-IC is not measurable on short holding windows** — reported with its ceiling precisely for that reason; read the ceiling before reading the ρ.
- Past performance ≠ future results. This is a research tool, not financial advice.

## 📚 References

- Markowitz (1952) — *Portfolio Selection*
- James & Stein (1961) — *Estimation with Quadratic Loss*
- Sharpe (1966) — *Mutual Fund Performance*
- Michaud (1989) — *The Markowitz Optimization Enigma*
- Artzner, Delbaen, Eber, Heath (1999) — *Coherent Measures of Risk*
- Rockafellar & Uryasev (2000) — *Optimization of Conditional Value-at-Risk*
- Politis & Romano (1992) — *A Circular Block-Resampling Procedure for Stationary Data*
- Lo (2002) — *The Statistics of Sharpe Ratios*
- Ledoit & Wolf (2004) — *Honey, I Shrunk the Sample Covariance Matrix*
- Bailey & López de Prado (2014) — *The Deflated Sharpe Ratio*
- Bailey, Borwein, López de Prado & Zhu (2016) — *The Probability of Backtest Overfitting*
- López de Prado (2016) — *Building Diversified Portfolios that Outperform Out-of-Sample*
