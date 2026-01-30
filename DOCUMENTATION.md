# 📊 Portfolio Optimization System - Documentation Complète

## 🎯 Objectif du Projet

Ce système permet de **comparer 3 stratégies d'allocation de portefeuille** en utilisant un backtest réaliste de type Walk-Forward. L'utilisateur entre des tickers (actions, ETFs, cryptos), et le système calcule les poids optimaux selon différentes méthodes, simule leur performance historique, et affiche des métriques pour évaluer quelle stratégie aurait été la meilleure.

---

## 🔄 Architecture du Système

```
┌─────────────────┐         ┌─────────────────┐
│    Frontend     │  HTTP   │    Backend      │
│    (React)      │◄───────►│    (FastAPI)    │
│                 │         │                 │
│  - Sidebar      │         │  - Optimization │
│  - Charts       │         │  - Backtesting  │
│  - Tables       │         │  - Metrics      │
└─────────────────┘         └─────────────────┘
```

---

## 📈 Les 3 Stratégies d'Optimisation

### 1. HRP (Hierarchical Risk Parity)

**Source:** López de Prado, M. (2016) - "Building Diversified Portfolios that Outperform Out-of-Sample"

**Principe:** Utilise le clustering hiérarchique pour regrouper les actifs corrélés, puis alloue le capital en fonction de la variance inverse de chaque cluster.

**Étapes:**
1. **Clustering:** Calcul de la distance de corrélation: `d = √(0.5 × (1 - ρ))`
2. **Linkage:** Algorithme de Ward pour créer l'arbre hiérarchique
3. **Quasi-Diagonalisation:** Réordonnancement de la matrice de covariance
4. **Bisection Récursive:** Allocation via variance inverse

**Formule de bisection:**
```
α = 1 - Var(cluster_gauche) / (Var(cluster_gauche) + Var(cluster_droite))
w_gauche *= α
w_droite *= (1 - α)
```

**Avantages:** Ne nécessite pas d'estimation des rendements attendus, plus stable.

---

### 2. GMV (Global Minimum Variance)

**Principe:** Minimise la variance totale du portefeuille sans considérer les rendements.

**Formule:**
```
min   w'Σw
s.t.  Σw = 1
      min_weight ≤ w ≤ max_weight
```

Où:
- `w` = vecteur des poids
- `Σ` = matrice de covariance (shrinkage Ledoit-Wolf)

**Implémentation:** Utilise PyPortfolioOpt avec covariance shrinkée.

**Avantages:** Robuste car n'utilise pas les estimations de rendements (souvent peu fiables).

---

### 3. MVO (Mean-Variance Optimization / Max Sharpe)

**Principe:** Maximise le ratio de Sharpe (rendement ajusté du risque).

**Formule:**
```
max   (μ'w - rf) / √(w'Σw)
s.t.  Σw = 1
      min_weight ≤ w ≤ max_weight
```

Où:
- `μ` = vecteur des rendements attendus (EMA historique)
- `rf` = taux sans risque

**Stratégie Cash:** Si `max(μ) < rf`, le portefeuille passe en cash (w = 0).

**Avantages:** Optimise directement ce qu'on veut maximiser (rendement/risque).

---

## 🔁 Walk-Forward Backtest

### Principe

Le backtest "Walk-Forward" simule ce qui se serait passé si on avait utilisé la stratégie en temps réel:

```
|--------Training--------|--Holding--|
         252 jours         21 jours   → Rebalance
                          |--------Training--------|--Holding--|
                                   252 jours         21 jours   → ...
```

### Étapes à chaque rebalancement

1. **Optimization:** Calculer les poids optimaux sur la fenêtre d'entraînement
2. **Conversion en shares:** Transformer les poids en nombre d'actions
3. **Calcul du turnover:** `Σ|w_new - w_old|`
4. **Coûts de transaction:** `turnover × transaction_cost_bps / 10000`
5. **Holding:** Laisser le portefeuille dériver jusqu'au prochain rebalancement

### Réalisme du Backtest

- ✅ **Share-based:** Conversion en actions réelles (pas juste des poids)
- ✅ **Point-in-time:** Utilise uniquement les données passées
- ✅ **Transaction costs:** Coûts réalistes sur le turnover
- ✅ **Cash accrual:** Le cash génère des intérêts au taux RF
- ✅ **Drift naturel:** Les poids dérivent entre les rebalancements

---

## 📊 Métriques de Performance

### Sharpe Ratio

**Formule:**
```
Sharpe = (mean(r - rf_daily) / std(r - rf_daily)) × √252
```

Où `rf_daily = rf_annual / 252`

**Interprétation:**
- < 0.5: Mauvais
- 0.5 - 1.0: Acceptable
- 1.0 - 2.0: Bon
- > 2.0: Excellent

---

### Sortino Ratio

**Formule:**
```
Sortino = mean(r - rf_daily) × 252 / Downside_Deviation

Downside_Deviation = √(mean(min(r - rf_daily, 0)²)) × √252
```

**Différence avec Sharpe:** Ne pénalise que la volatilité négative (downside).

---

### Maximum Drawdown

**Formule:**
```
Drawdown_t = (Peak_t - Value_t) / Peak_t
Max_Drawdown = max(Drawdown_t)
```

**Interprétation:** La pire perte depuis un pic. Un MDD de 20% signifie qu'à un moment, on a perdu 20% par rapport au plus haut précédent.

---

### CAGR (Compound Annual Growth Rate)

**Formule:**
```
CAGR = (Value_final / Value_initial)^(1/years) - 1
```

**Interprétation:** Le taux de croissance annuel composé.

---

### Calmar Ratio

**Formule:**
```
Calmar = CAGR / Max_Drawdown
```

**Interprétation:** Rendement par unité de drawdown. Plus c'est élevé, mieux c'est.

---

### Alpha (Jensen's Alpha)

**Formule:**
```
Alpha = CAGR_portfolio - (rf + β × (CAGR_benchmark - rf))
```

**Interprétation:** Le rendement EXCÉDENTAIRE par rapport à ce que prédit le CAPM.
- Alpha > 0: On a battu le marché ajusté du risque
- Alpha = 0: Performance conforme au risque pris
- Alpha < 0: Sous-performance

---

### Beta

**Formule:**
```
β = Cov(r_portfolio, r_benchmark) / Var(r_benchmark)
```

**Interprétation:** Sensibilité au marché.
- β = 1: Se comporte comme le benchmark
- β > 1: Plus volatil que le benchmark
- β < 1: Moins volatil que le benchmark

---

### Omega Ratio

**Formule:**
```
Omega = Σ(gains au-dessus du seuil) / Σ(pertes en-dessous du seuil)
```

Seuil = rf_daily

**Interprétation:** Ratio gains/pertes. Plus c'est élevé, mieux c'est.

---

### Turnover Annualisé

**Formule:**
```
Turnover_event = Σ|w_new - w_old| / 2
Turnover_annual = Σ(Turnover_events) / years
```

**Interprétation:** Combien du portefeuille est "retourné" par an. Un turnover de 100% signifie qu'on a remplacé l'intégralité du portefeuille en moyenne chaque année.

---

## 🔧 Paramètres Utilisateur

| Paramètre | Description | Défaut |
|-----------|-------------|--------|
| Training Window | Jours de données pour l'optimisation | 252 |
| Rebalancing Window | Jours entre chaque rebalancement | 21 |
| Min Weight | Poids minimum par actif | 0% |
| Max Weight | Poids maximum par actif | 100% |
| Transaction Cost | Coût en bps par trade | 10 |

---

## 📐 Formules Mathématiques Résumées

### Rendement d'un portefeuille
```
r_portfolio = Σ(w_i × r_i)
```

### Variance d'un portefeuille
```
σ²_portfolio = w'Σw = ΣΣ(w_i × w_j × σ_ij)
```

### Covariance Shrinkage (Ledoit-Wolf)
```
Σ_shrunk = δ × F + (1-δ) × S
```
Où F = cible structurée, S = échantillon, δ = intensité optimale

### Distance de corrélation (HRP)
```
d_ij = √(0.5 × (1 - ρ_ij))
```

---

## 📁 Structure des Fichiers

```
backend/
├── main.py           # API FastAPI, endpoints
├── optimization.py   # HRP, GMV, MVO algorithms
├── backtester.py     # Walk-forward engine
├── metrics.py        # Performance calculations
├── config.py         # Constants
├── schemas.py        # Pydantic models
└── data_provider.py  # Data fetching (yfinance)

frontend/
├── App.tsx           # Main application
├── components/       # UI components
│   ├── Sidebar.tsx
│   ├── ComparisonChart.tsx
│   ├── AllocationHistoryChart.tsx
│   └── ...
├── api/client.ts     # Backend API calls
└── theme.ts          # Dark theme styling
```

---

## 🎨 Visualisations

| Graphique | Utilité |
|-----------|---------|
| Equity Curve | Compare l'évolution de 1$ investi |
| Drawdown Chart | Visualise les pertes depuis les pics |
| Efficient Frontier | Position risque/rendement des actifs |
| Allocation History | Évolution des poids dans le temps |
| Correlation Heatmap | Dépendances entre actifs |
| Risk Contribution | Qui apporte le risque |
| Monthly Returns | Saisonnalité des performances |
| Returns Distribution | Forme des rendements (normalité) |
| Overfitting Chart | Predicted vs Realized Sharpe |

---

## ⚠️ Limitations

1. **Pas de slippage:** On assume une exécution au prix de clôture
2. **Pas de market impact:** Valable pour des portefeuilles de taille modeste
3. **Données historiques:** Les performances passées ne garantissent pas l'avenir
4. **Estimation des rendements (MVO):** Source d'erreur principale

---

## 📚 Références

- López de Prado, M. (2018). *Advances in Financial Machine Learning*
- Markowitz, H. (1952). *Portfolio Selection*
- Sharpe, W. (1966). *Mutual Fund Performance*
- Ledoit, O., & Wolf, M. (2004). *Honey, I Shrunk the Sample Covariance Matrix*
