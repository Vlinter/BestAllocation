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

## 🎯 Réalisme du Backtest

Notre backtest implémente un **modèle d'exécution réaliste** qui élimine le biais de look-ahead :

| Étape | Jour | Source de Prix |
|-------|------|----------------|
| **Optimisation** | T | Close(T-252 à T-1) — données passées uniquement |
| **Décision** | T | Basée sur le Close(T) connu |
| **Exécution** | **T+1** | **Open(T+1)** — prix d'ouverture du lendemain |
| **Valorisation** | T+1... | Close(jour) — valeurs de fin de journée |

**Pourquoi c'est important :**
- ❌ **Mauvais:** Exécuter au Close(T) = on utilise un prix qu'on vient de découvrir (impossible en réalité)
- ✅ **Correct:** Exécuter à l'Open(T+1) = on place l'ordre overnight, exécuté à l'ouverture

**Données utilisées:**
- **Adj Close** (prix ajusté de clôture) : pour l'optimisation et la valorisation du portefeuille
- **Adj Open** (prix ajusté d'ouverture) : pour l'exécution des trades

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

> [!CAUTION]
> Le MVO classique est connu comme un "maximisateur d'erreur" : les petites erreurs d'estimation dans les rendements attendus (μ) peuvent produire des allocations extrêmes et instables. Notre implémentation intègre **6 techniques de robustification** pour pallier ce problème.

---

#### Formulation Mathématique

**Problème d'optimisation:**
```
max   (μ'w - rf) / √(w'Σw)     ← Ratio de Sharpe
s.t.  Σw = 1                   ← Contrainte de budget
      min_weight ≤ w ≤ max_weight
```

Où:
- `μ` = vecteur des rendements attendus (après shrinkage)
- `Σ` = matrice de covariance (après shrinkage Ledoit-Wolf)
- `rf` = taux sans risque annuel
- `w` = vecteur des poids à optimiser

---

#### 🛡️ Techniques de Robustification Implémentées

##### 1. Rendements Attendus par EMA (Exponential Moving Average)

**Problème:** La moyenne arithmétique simple accorde le même poids à toutes les observations, même celles très anciennes qui peuvent être moins pertinentes.

**Solution:** Nous utilisons une moyenne mobile exponentielle qui donne plus de poids aux données récentes :

```
μ_EMA = Σ(wt × rt) / Σ(wt)

où wt = exp(-decay × t) et span = taille de la fenêtre d'entraînement
```

**Implémentation:** `expected_returns.ema_historical_return(returns, span=dynamic_span)`

Le span est dynamiquement ajusté à la taille de la fenêtre d'entraînement (ex: 252 jours), assurant que le decay est proportionnel au lookback choisi par l'utilisateur.

---

##### 2. James-Stein Shrinkage sur les Rendements

**Problème:** Les estimations des rendements moyens par actif sont extrêmement bruitées. L'estimateur de Stein prouve qu'on peut toujours réduire l'erreur quadratique moyenne en "shrinkant" vers une cible commune.

**Solution:** Shrinkage vers la moyenne globale (grand mean) :

```
μ_shrunk = λ × μ_grand_mean + (1-λ) × μ_sample

où:
- μ_grand_mean = moyenne de tous les rendements attendus
- λ = RETURN_SHRINKAGE_INTENSITY = 0.5 (paramètre configurable)
```

**Effet:**
| λ | Comportement |
|---|-------------|
| 0.0 | Utilise les rendements bruts (agressif, overfitting) |
| 0.5 | **Défaut** - Équilibre entre signal et réduction du bruit |
| 1.0 | Tous les actifs ont le même rendement attendu (très conservateur) |

**Code:** `shrink_expected_returns(mu_raw)` dans `optimization.py`

---

##### 3. Ledoit-Wolf Covariance Shrinkage

**Problème:** La matrice de covariance échantillonnée est souvent singulière ou mal conditionnée, surtout quand le nombre d'actifs (N) approche le nombre d'observations (T).

**Solution:** Shrinkage de Ledoit-Wolf vers une cible structurée :

```
Σ_shrunk = δ × F + (1-δ) × S

où:
- F = cible structurée (single-factor model)
- S = matrice échantillonnée
- δ = intensité de shrinkage optimale (calculée analytiquement)
```

**Avantages:**
- ✅ Garantit une matrice positive semi-définie
- ✅ Améliore le ratio condition_number
- ✅ δ optimal calculé automatiquement (pas de paramètre à tuner)

**Implémentation:** `risk_models.CovarianceShrinkage(...).ledoit_wolf()`

**Référence:** Ledoit, O., & Wolf, M. (2004). *"Honey, I Shrunk the Sample Covariance Matrix"*

---

##### 4. Stratégie Cash (Go-to-Cash)

**Problème:** Si tous les actifs ont un rendement attendu inférieur au taux sans risque, forcer une allocation à 100% invested n'a pas de sens économique.

**Solution:** 

```python
if max(μ) < risk_free_rate:
    weights = {asset: 0.0 for asset in assets}  # → 100% Cash
```

**Comportement:**
- Les poids retournent à 0 → le backtester alloue 100% au cash
- Le cash génère des intérêts au taux `rf`
- Cette décision est loggée pour transparence

**Pourquoi c'est important:** Évite de forcer des positions longues dans un marché baissier généralisé.

---

##### 5. Fallback Gracieux en Cas d'Échec du Solver

**Problème:** L'optimiseur convexe (CVXPY/ECOS) peut échouer si le problème est mal posé ou numériquement instable.

**Solution:** Cascade de fallbacks :

```
1. max_sharpe() → Tente d'abord l'optimisation Sharpe standard
   ↓ (si échec)
2. Go-to-Cash → Retourne des poids à 0 (conservateur)
   ↓ (si autre erreur technique)
3. Equal-Weight → Fallback ultime (1/N)
```

**Métadonnées retournées:**
```python
OptimizationResult(
    weights=...,
    fallback_used=True/False,
    fallback_reason="MVO Solver Failed: ... → Cash"
)
```

---

##### 6. Contraintes de Poids (Box Constraints)

**Problème:** Le MVO non contraint peut produire des positions extrêmes (100% dans un actif).

**Solution:** Contraintes min/max intégrées dans le solveur :

```
weight_bounds = (min_weight, max_weight)
```

| Mode | min_weight | max_weight | Effet |
|------|-----------|-----------|-------|
| Unconstrained | 0% | 100% | Positions extrêmes possibles |
| **Diversified** | 5% | 40% | **Recommandé** - Force la diversification |
| Equal-ish | 10% | 30% | Encore plus contraint |

> [!TIP]
> Pour une utilisation robuste, nous recommandons le mode **"Diversified"** (min=5%, max=40%) qui force une diversification minimale et limite les positions extrêmes.

---

#### 📊 Contrôle de Qualité

**Vérification du Condition Number:**
```python
eigenvalues = np.linalg.eigvalsh(Σ)
condition_number = max(eigenvalues) / min(eigenvalues)

if condition_number > 1000:
    logger.warning("Matrice mal conditionnée")
```

---

#### ⚙️ Paramètres Configurables

| Paramètre | Valeur Défaut | Fichier |
|-----------|---------------|---------|
| `RETURN_SHRINKAGE_INTENSITY` | 0.5 | `config.py` |
| `COVARIANCE_CONDITION_NUMBER_THRESHOLD` | 1000 | `config.py` |
| `DEFAULT_RISK_FREE_RATE` | 4.5% | `config.py` |

---

#### 🔬 Résumé: Pourquoi Notre MVO est Robuste

| Problème Classique | Notre Solution |
|-------------------|----------------|
| Rendements historiques bruités | EMA + James-Stein Shrinkage (λ=0.5) |
| Matrice de covariance instable | Ledoit-Wolf Shrinkage |
| Positions extrêmes | Contraintes min/max (mode Diversified) |
| Marché baissier généralisé | Stratégie Cash automatique |
| Échec numérique du solver | Fallback gracieux → Cash → EW |
| Condition number élevé | Monitoring + warning |

**Avantages finaux du MVO robuste:**
- ✅ Optimise directement le ratio de Sharpe (ce qu'on veut maximiser)
- ✅ Estimation des rendements régularisée (moins d'overfitting)
- ✅ Allocation stable et interprétable
- ✅ Comportement défensif en conditions adverses

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
4. **Estimation des rendements (MVO):** Bien que mitigée par EMA et James-Stein shrinkage, reste une source d'incertitude inhérente à toute prévision
5. **Corrélations non-stationnaires:** Les corrélations entre actifs changent dans le temps, surtout en période de crise

---

## 📚 Références

- López de Prado, M. (2018). *Advances in Financial Machine Learning*
- Markowitz, H. (1952). *Portfolio Selection*
- Sharpe, W. (1966). *Mutual Fund Performance*
- Ledoit, O., & Wolf, M. (2004). *Honey, I Shrunk the Sample Covariance Matrix*
- James, W., & Stein, C. (1961). *Estimation with Quadratic Loss* (Shrinkage Estimators)
- PyPortfolioOpt Documentation: https://pyportfolioopt.readthedocs.io/
