# 📊 BestAllocation — Récap Complet pour Entretien

## 🎯 Vision d'ensemble (Le Pitch)

**BestAllocation** est une application web fullstack de **comparaison de stratégies d'allocation de portefeuille**. L'utilisateur entre des tickers financiers (actions, ETFs, cryptos), et le système :

1. Récupère les données historiques de marché (Tiingo API, avec fallback Yahoo Finance)
2. Exécute un **backtest Walk-Forward réaliste** pour **3 stratégies d'optimisation** (HRP, GMV, MVO)
3. Calcule **16+ métriques de performance** (Sharpe, Sortino, Max Drawdown, Alpha, Beta, Omega…)
4. Affiche les résultats dans une **interface React interactive** avec 9 types de graphiques

> **En une phrase :** *"C'est un outil qui compare 3 méthodes d'allocation de portefeuille via un backtest réaliste Walk-Forward, pour déterminer laquelle aurait été la meilleure stratégie historiquement."*

---

## 🏗️ Architecture Technique

```
┌──────────────────────────┐            ┌──────────────────────────────────┐
│       FRONTEND           │    HTTP    │           BACKEND                │
│    React 19 + TypeScript │◄──────────►│       Python + FastAPI           │
│    Vite (build tool)     │    JSON    │                                  │
│    Recharts (graphiques) │            │  main.py ─── CORS, Rate Limit   │
│    MUI v6 (composants)   │            │    └── routes.py ─── Endpoints  │
│    Axios (HTTP client)   │            │          ├── jobs.py (async)     │
│                          │            │          ├── optimization.py     │
│    Port: 5173 (dev)      │            │          ├── backtester.py       │
│                          │            │          ├── metrics.py          │
│                          │            │          ├── data_provider.py    │
│                          │            │          └── config.py           │
└──────────────────────────┘            └──────────────────────────────────┘
                                               │
                                    ┌──────────┴──────────┐
                                    │   Sources de données │
                                    │  • Tiingo API (prix) │
                                    │  • FRED API (taux RF)│
                                    │  • yfinance (fallback)│
                                    └─────────────────────┘
```

### Stack technique détaillée

| Couche | Technologie | Rôle |
|--------|------------|------|
| **Frontend** | React 19 + TypeScript + Vite | SPA interactive |
| **UI Library** | Material UI (MUI) v6 | Composants, thème dark |
| **Graphiques** | Recharts | Tous les charts |
| **Backend** | FastAPI (Python 3.11) | API REST, orchestration |
| **Optimisation** | PyPortfolioOpt, SciPy, CVXPY | Solveurs |
| **Données** | Tiingo (primaire), FRED (taux RF), yfinance (fallback) | Données de marché |
| **Cache** | joblib.Memory + diskcache | Cache disque, refresh quotidien |
| **Déploiement** | Docker multi-stage, Render | Production |

---

## 📡 API Backend — Pattern Asynchrone

### Architecture du Job System

Le backend utilise un **pattern async job** pour les calculs longs :

```
POST /api/compare/start  →  Crée un job + retourne {job_id}
                                    ↓
                          Background task démarre
                          (ThreadPoolExecutor pour parallélisme)
                                    ↓
GET /api/jobs/{job_id}   ←  Polling du frontend (progress %)
                                    ↓
                          Quand status = "completed" → résultats
```

### Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/compare/start` | Lance le backtest (rate-limited : 5 req/min/IP) |
| `GET` | `/api/jobs/{job_id}` | Poll le statut du job (0-100%) |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/version` | Version, méthodes supportées |

### Rate Limiting

- IP-based, uniquement sur `POST /api/compare/start`
- 5 requêtes par fenêtre de 60 secondes
- Max 1000 IPs trackées (évite les fuites mémoire)

### Exécution parallèle des stratégies

```python
with ThreadPoolExecutor(max_workers=min(N_methods, 4)) as executor:
    futures = {executor.submit(_run_strategy, method, ...): method
               for method in ["hrp", "gmv", "mvo"]}
```

Les 3 stratégies sont calculées **en parallèle** puis les résultats sont triés par Sortino Ratio décroissant.

### Payload de requête (`CompareRequest`)

```json
{
  "tickers": ["AAPL", "MSFT", "GOOGL", "BND"],
  "benchmark_type": "custom",
  "benchmark_ticker": "SPY",
  "training_window": 252,
  "rebalancing_window": 21,
  "min_weight": 0.05,
  "max_weight": 0.40,
  "transaction_cost_bps": 10,
  "enable_volatility_scaling": false,
  "target_volatility": 0.12
}
```

---

## 📥 Récupération des Données — `data_provider.py`

### Sources de données (par priorité)

| Source | Données | Fallback |
|--------|---------|----------|
| **Tiingo API** | Prix adj. (Close + Open) | → yfinance |
| **FRED API** | Taux sans risque (série `DTB3` = T-Bill 3 mois) | → 4.5% constant |
| **Yahoo Finance** | Fallback si Tiingo échoue | — |

### Détection automatique crypto

Le système détecte automatiquement les tickers crypto grâce à un pattern matching :

```python
_CRYPTO_BASES = {"btc", "eth", "sol", "ada", "dot", ...}  # ~35 cryptos
_CRYPTO_QUOTES = {"usd", "eur", "usdt", "usdc", ...}

def is_crypto_ticker(ticker):
    return base in _CRYPTO_BASES and quote in _CRYPTO_QUOTES
    # "btcusd" → True, "AAPL" → False
```

**Conséquence :** Le facteur d'annualisation s'adapte automatiquement :
- **Stocks** : 252 jours de trading/an
- **Crypto** : 365 jours/an (marché 24/7)

### Système de cache

```python
memory = joblib.Memory(cache_dir)  # Cache disque avec invalidation manuelle
```

Les données de prix, le taux sans risque, et la frontière efficiente sont cachés. Le cache est invalidé quotidiennement pour le taux RF (clé = date du jour).

### Alignement des données

Quand on mélange plusieurs tickers, le système :
1. Identifie le **ticker limitant** (celui avec le moins d'historique)
2. Aligne toutes les séries à la date de début commune
3. Forward-fill les trous, supprime les NaN résiduels
4. Vérifie un minimum de **60 jours de données**

---

## 🧮 Les 3 Stratégies d'Optimisation — `optimization.py`

C'est le **cœur mathématique** du projet.

---

### Stratégie 1 : HRP (Hierarchical Risk Parity)

> **Référence :** López de Prado, M. (2016) — *"Building Diversified Portfolios that Outperform Out-of-Sample"*

#### Concept
HRP utilise le **clustering hiérarchique (ML non-supervisé)** pour structurer le portefeuille. Contrairement au MVO, elle **n'a pas besoin d'estimer les rendements attendus**, ce qui élimine une source majeure d'erreur.

#### Les 4 étapes de l'algorithme

**Étape 1 — Matrice de distance de corrélation**

On transforme les corrélations en distances. Plus deux actifs sont corrélés, plus la distance est faible :

$$d_{ij} = \sqrt{\frac{1}{2}(1 - \rho_{ij})}$$

où $\rho_{ij}$ est la corrélation de Pearson entre les rendements des actifs $i$ et $j$.

> [!NOTE]
> Propriétés : $d_{ij} = 0 \iff \rho_{ij} = 1$ (parfaitement corrélés), $d_{ij} = 1 \iff \rho_{ij} = -1$ (parfaitement anti-corrélés).

**Étape 2 — Clustering hiérarchique (Linkage de Ward)**

On applique le clustering agglomératif de Ward sur la matrice de distances condensée. Cela construit un **dendrogramme** (arbre binaire) regroupant les actifs similaires.

Le critère de Ward minimise la **variance intra-cluster** à chaque fusion :

$$\Delta(A,B) = \frac{n_A \cdot n_B}{n_A + n_B} \| \bar{d}_A - \bar{d}_B \|^2$$

**Étape 3 — Quasi-Diagonalisation**

On réordonne la matrice de covariance selon l'ordre des feuilles du dendrogramme → les actifs similaires sont adjacents, la matrice devient quasi-diagonale.

**Étape 4 — Bisection récursive (allocation par variance inverse)**

On parcourt le dendrogramme de la racine vers les feuilles. À chaque nœud :

$$\alpha = 1 - \frac{\text{Var}(\text{cluster gauche})}{\text{Var}(\text{cluster gauche}) + \text{Var}(\text{cluster droit})}$$

$$w_{\text{gauche}} \mathrel{*}= \alpha, \quad w_{\text{droit}} \mathrel{*}= (1 - \alpha)$$

La variance de chaque cluster utilise les poids de **variance inverse (IVP)** :

$$w_i^{IVP} = \frac{1/\sigma_i^2}{\sum_j 1/\sigma_j^2}, \quad \text{Var}(\text{cluster}) = (\mathbf{w}^{IVP})^T \Sigma_{\text{cluster}} \, \mathbf{w}^{IVP}$$

> [!IMPORTANT]
> Détail d'implémentation : les contraintes de bornes (min/max weight) ne sont **PAS** appliquées à HRP pour respecter la structure de bisection récursive de López de Prado. C'est un choix délibéré.

#### Avantages
- ✅ Pas d'estimation des rendements
- ✅ Pas d'inversion de matrice (stable numériquement)
- ✅ Plus stable out-of-sample que MVO classique
- ✅ Respecte la structure hiérarchique des corrélations

---

### Stratégie 2 : GMV (Global Minimum Variance)

#### Concept
Trouve le portefeuille qui a la **plus faible volatilité possible**, sans considérer les rendements. Approche la plus conservatrice.

#### Formulation mathématique

$$\min_{\mathbf{w}} \quad \mathbf{w}^T \Sigma \mathbf{w}$$

sous les contraintes :
$$\sum_{i=1}^{N} w_i = 1, \quad w_{\min} \leq w_i \leq w_{\max} \quad \forall i$$

où $\Sigma$ est la matrice de covariance shrinkée (Ledoit-Wolf).

#### Covariance Shrinkage (Ledoit-Wolf)

La matrice de covariance empirique $S$ est régularisée :

$$\Sigma_{\text{shrunk}} = \delta \cdot F + (1-\delta) \cdot S$$

| Symbole | Signification |
|---------|--------------|
| $F$ | Cible structurée (modèle à facteur unique) |
| $S$ | Matrice de covariance échantillonnée |
| $\delta$ | Intensité optimale (calculée analytiquement) |

> **Référence :** Ledoit, O. & Wolf, M. (2004) — *"Honey, I Shrunk the Sample Covariance Matrix"*

**Garanties :**
- ✅ Matrice positive semi-définie (inversible)
- ✅ Condition number réduit
- ✅ $\delta$ optimal sans paramètre à tuner

#### Solution analytique (sans bornes)

$$\mathbf{w}^* = \frac{\Sigma^{-1} \mathbf{1}}{\mathbf{1}^T \Sigma^{-1} \mathbf{1}}$$

En pratique, le **solveur convexe CVXPY** est utilisé pour respecter les box constraints.

---

### Stratégie 3 : MVO (Mean-Variance Optimization / Max Sharpe)

> **Référence :** Markowitz, H. (1952) — *"Portfolio Selection"*

#### Concept
Maximise le **ratio de Sharpe** (rendement excédentaire / risque). C'est l'approche la plus ambitieuse mais aussi la plus sensible aux erreurs.

#### Formulation mathématique

$$\max_{\mathbf{w}} \quad \frac{\boldsymbol{\mu}^T \mathbf{w} - r_f}{\sqrt{\mathbf{w}^T \Sigma \mathbf{w}}}$$

sous les contraintes :
$$\sum_{i=1}^{N} w_i = 1, \quad w_{\min} \leq w_i \leq w_{\max}$$

#### ⚠️ Le problème du MVO classique

Le MVO classique est un **"maximisateur d'erreur"** (Michaud, 1989) : les erreurs dans $\boldsymbol{\mu}$ produisent des allocations **extrêmes et instables**. Notre implémentation intègre **6 techniques de robustification**.

---

#### 🛡️ Les 6 Techniques de Robustification du MVO

##### 1. Rendements EMA (Exponential Moving Average)

**Problème :** La moyenne simple $\bar{r} = \frac{1}{T}\sum r_t$ accorde le même poids à des observations d'il y a 5 ans.

**Solution :**

$$\mu_{\text{EMA}} = \frac{\sum_{t=0}^{T-1} w_t \cdot r_t}{\sum_{t=0}^{T-1} w_t}, \quad w_t = e^{-\lambda t}, \quad \lambda = \frac{2}{\text{span} + 1}$$

Le `span` est dynamique : `span = max(60, len(training_data) / 2)`

---

##### 2. James-Stein Shrinkage sur les rendements

**Fondement :** L'estimateur de James-Stein (1961) prouve qu'on peut **toujours** réduire l'erreur quadratique moyenne en "shrinkant" vers une cible commune.

**Formule :**

$$\mu_{\text{shrunk}} = \lambda \cdot \bar{\mu} + (1-\lambda) \cdot \mu_{\text{EMA}}$$

où $\bar{\mu}$ = **grand mean** (moyenne de tous les rendements attendus).

**Calcul data-driven de $\lambda$ :**

$$\lambda_{\text{JS}} = \max\left(0, \; 1 - \frac{p-2}{\sum_i (\mu_i - \bar{\mu})^2}\right)$$

- Forte dispersion (signal clair) → $\lambda$ petit → conserve les estimations
- Faible dispersion (bruit) → $\lambda$ grand → shrink vers la moyenne
- Fallback à `RETURN_SHRINKAGE_INTENSITY = 0.5` si données insuffisantes

| $\lambda$ | Comportement |
|---|---|
| 0.0 | Rendements bruts (agressif, overfitting) |
| **0.5** | **Défaut** — Équilibre signal/bruit |
| 1.0 | Tous les actifs ont même rendement attendu → revient à GMV |

---

##### 3. Ledoit-Wolf Covariance Shrinkage

Identique à GMV. Garantit $\Sigma$ bien conditionnée et inversible.

---

##### 4. Stratégie Cash automatique (Go-to-Cash)

$$\text{Si } \max(\boldsymbol{\mu}) < r_f \Longrightarrow \mathbf{w} = \mathbf{0} \quad \text{(100% cash)}$$

Évite de forcer des positions longues dans un marché baissier généralisé. Le cash génère des intérêts au taux $r_f$.

---

##### 5. Fallback en cascade

```
max_sharpe() → si échec solveur → Go-to-Cash → si erreur technique → Equal-Weight (1/N)
```

Chaque fallback est tracé : `fallback_used=True, fallback_reason="MVO Solver Failed → Cash"`

---

##### 6. Contraintes de bornes (Box Constraints)

$$w_{\min} \leq w_i \leq w_{\max}$$

| Mode | $w_{\min}$ | $w_{\max}$ | Effet |
|------|-----------|-----------|-------|
| Unconstrained | 0% | 100% | Positions extrêmes possibles |
| **Diversified** | **5%** | **40%** | **Recommandé** — force diversification |

---

#### Contrôle de qualité : Condition Number

$$\kappa(\Sigma) = \frac{\lambda_{\max}}{\lambda_{\min}}$$

Warning si $\kappa > 1000$ → matrice mal conditionnée.

---

## 🔁 Le Backtest Walk-Forward — `backtester.py`

### Principe fondamental

Le Walk-Forward simule une **utilisation en temps réel** de la stratégie. À aucun moment on n'utilise de données futures.

```
|═══════ Training ═══════|══ Holding ══|
        252 jours            21 jours    → Rebalance
                             |═══════ Training ═══════|══ Holding ══|
                                     252 jours            21 jours    → ...
```

### Modèle d'exécution réaliste (pas de look-ahead bias)

| Étape | Jour | Donnée utilisée | Justification |
|-------|------|----------------|---------------|
| **Optimisation** | $T$ | $\text{Close}(T\text{-}252 \dots T\text{-}1)$ | Données strictement passées |
| **Décision** | $T$ | $\text{Close}(T)$ | Prix de clôture connu |
| **Exécution** | $T+1$ | $\text{Open}(T+1)$ | Ordre overnight → exécuté à l'ouverture |
| **Valorisation** | $T+1\dots$ | $\text{Close}(\text{jour})$ | Mark-to-market |

> [!IMPORTANT]
> Exécuter au Close(T) serait du look-ahead bias : on utiliserait un prix qu'on vient de découvrir. En réalité, on place un ordre **après** avoir vu le Close, exécuté au prochain Open.

### Conversion poids → actions (Share-based)

$$n_i = \left\lfloor \frac{w_i \times V_{\text{net}}}{P_i^{\text{open}}} \right\rfloor$$

L'excédent non investi reste en **cash**. C'est plus réaliste que de raisonner en poids fractionnaires.

### Turnover Smoothing (lissage exponentiel)

Pour réduire le turnover et les coûts de transaction :

$$w_{\text{smoothed}} = (1 - \alpha) \times w_{\text{new}} + \alpha \times w_{\text{old}}, \quad \alpha = 0.25$$

> Détail important : le lissage ne renormalise **pas** les poids à 1. Si le MVO passe en mode cash ($w = 0$), le lissage le permet progressivement.

### Coûts de transaction

$$\text{Turnover} = \sum_{i=1}^{N} |w_i^{\text{new}} - w_i^{\text{old}}|$$

$$\text{Coût} = \frac{\text{Turnover}}{2} \times \frac{\text{cost\_bps}}{10\,000} \times V_{\text{portfolio}}$$

(Division par 2 : chaque dollar vendu est racheté → pas de double comptage)

### Cash accrual

$$\text{Cash}_{t+1} = \text{Cash}_t \times \left(1 + \frac{r_f}{252}\right)$$

Le taux sans risque peut être un **scalaire constant** ou une **série temporelle** (FRED historique).

### Volatility Scaling (optionnel, désactivé par défaut)

$$\text{scale} = \min\left(1, \frac{\sigma_{\text{target}}}{\sigma_{\text{réalisée}}}\right)$$

$$w_i^{\text{scaled}} = w_i \times \text{scale}, \quad \text{cash} = 1 - \sum w_i^{\text{scaled}}$$

Pas de levier ($\text{scale} \leq 1$). Paramètres : `target_volatility=0.12`, `lookback=63 jours`.

### Benchmark

Deux types :
- **Equal-Weight (1/N)** : Rebalancé périodiquement, share-based
- **Custom** (ex: SPY) : Buy-and-hold, normalisé à 1.0

### Analyse de l'Overfitting

À chaque période, on compare :
- **Predicted Sharpe** (in-sample, sur la fenêtre d'entraînement, poids constants)
- **Realized Sharpe** (out-of-sample, sur la fenêtre de holding, equity curve réelle)

La corrélation de Spearman entre les deux séries mesure la capacité prédictive :

| Corrélation | Interprétation |
|-------------|----------------|
| > 0.5 | Robuste |
| 0.3 – 0.5 | Modéré |
| 0.1 – 0.3 | Faible |
| < 0.1 | Overfitting probable |

---

## 📊 Les Métriques de Performance — `metrics.py`

### Tableau complet

| Métrique | Formule | Interprétation |
|----------|---------|----------------|
| **Total Return** | $(V_f / V_0) - 1$ | Performance brute |
| **CAGR** | $(V_f / V_0)^{252/T} - 1$ | Croissance annuelle composée |
| **Volatilité** | $\sigma_d \times \sqrt{252}$ | Risque total annualisé |
| **Sharpe** | $\frac{\overline{r-r_f}}{\sigma(r-r_f)} \times \sqrt{252}$ | Rendement / risque |
| **Sortino** | $\frac{\overline{r-r_f} \times 252}{\text{DD}_\text{ann}}$ | Rendement / risque baissier |
| **MDD** | $\max_t \frac{\text{Peak}_t - V_t}{\text{Peak}_t}$ | Pire perte depuis un pic |
| **Calmar** | $\text{CAGR} / |\text{MDD}|$ | Rendement / drawdown max |
| **Alpha** | $\text{CAGR}_p - (r_f + \beta(\text{CAGR}_b - r_f))$ | Surperf. vs CAPM |
| **Beta** | $\frac{\text{Cov}(r_p, r_b)}{\text{Var}(r_b)}$ | Sensibilité au marché |
| **Omega** | $\frac{\sum \max(r-r_f, 0)}{\sum \max(r_f-r, 0)}$ | Ratio gains/pertes |
| **Win Rate** | $\frac{\text{nb jours positifs}}{\text{nb jours total}}$ | Fréquence de gain |
| **Avg Win / Loss** | $\overline{r^+}$ / $\overline{r^-}$ | Gain/perte moyen(ne) |
| **Max Gain / Loss** | $\max(r_t)$ / $\min(r_t)$ | Extrêmes journaliers |
| **Skewness** | 3ème moment standardisé | Asymétrie des rendements |
| **Kurtosis** | 4ème moment - 3 (excès) | Queues de distribution |
| **Turnover ann.** | $\frac{\sum \text{turnover events}}{\text{années}}$ | Rotation du portefeuille |

### Détail des formules clés

**Sortino — Downside Deviation :**

$$\text{DD} = \sqrt{\frac{1}{T}\sum_{t=1}^{T} [\min(r_t - r_{f,d}, 0)]^2} \times \sqrt{252}$$

Seuls les rendements **en dessous** du seuil comptent. Un actif volatile à la hausse n'est pas pénalisé.

**Risk Contribution par actif :**

$$\text{MCR}_i = \frac{(\Sigma \mathbf{w})_i}{\sigma_p}, \quad \text{RC}_i = w_i \times \text{MCR}_i, \quad \text{RC\%}_i = \frac{\text{RC}_i}{\sigma_p}$$

La somme des $\text{RC\%}$ = 100%. Permet d'identifier quel actif apporte le plus de risque.

**Correlation Matrix** : calculée sur les rendements, réordonnée par **clustering hiérarchique** (linkage moyen sur `1-corr`) pour une heatmap plus lisible.

---

## 🖥️ Frontend — Architecture React

### Composants de visualisation (9 charts)

| Composant | Type | Ce qu'il affiche |
|-----------|------|------------------|
| **ComparisonChart** | Line chart | Equity curves des 3 stratégies + benchmark (évolution de 1€) |
| **DrawdownChart** | Area chart | Drawdowns (%) dans le temps pour chaque stratégie |
| **AllocationHistoryChart** | Stacked area | Évolution des poids dans le temps par actif |
| **EfficientFrontierChart** | Scatter | Position risque/rendement : actifs individuels, cloud Monte Carlo (500 pts), courbe CLA |
| **CorrelationHeatmap** | Heatmap | Matrice de corrélation entre actifs (ordonnée par clustering) |
| **RiskContributionChart** | Bar chart | Contribution au risque par actif pour chaque stratégie |
| **MonthlyReturnsTable** | Heatmap | Rendements mensuels (année × mois), code couleur vert/rouge |
| **ReturnsDistributionChart** | Histogramme | Distribution des rendements quotidiens (test de normalité visuel) |
| **OverfittingChart** | Scatter | Predicted vs Realized Sharpe par période (diagnostic d'overfitting) |

### Composants structurels

| Composant | Rôle |
|-----------|------|
| **Sidebar** | Formulaire de saisie (tickers, paramètres, bouton Optimize) |
| **MetricsTable** | Tableau comparatif des métriques pour les 3 stratégies |
| **WeightsTable** | Poids actuels de chaque stratégie |
| **App** | Layout principal, gestion d'état, orchestration API |

### Flux de données

```
Sidebar (saisie) → App.tsx → POST /api/compare/start
                                       ↓
                              Backend lance le job
                                       ↓
                    App.tsx poll GET /api/jobs/{id} toutes les 2s
                                       ↓
                           Quand "completed" → met à jour le state
                                       ↓
                    Tous les composants se re-rendent avec les données
```

### Thème & Design
- **Dark mode** personnalisé via MUI `createTheme`
- Palette sombre avec accents colorés par stratégie
- Interface responsive

---

## 🐳 Déploiement

### Docker multi-stage

```dockerfile
# Stage 1: Build Frontend (node:20-alpine)
RUN npm ci && npm run build   # → /app/frontend/dist/

# Stage 2: Python Backend (python:3.11-slim)
RUN pip install -r requirements.txt
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
CMD uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

En production, **FastAPI sert directement le frontend** compilé (pas de serveur Node). Catch-all `/{path}` → `index.html` pour le routing SPA.

### Variables d'environnement

| Variable | Usage |
|----------|-------|
| `TIINGO_API_KEY` | Données de marché |
| `FRED_API_KEY` | Taux sans risque (Fed) |
| `PORT` | Port serveur (8000 par défaut) |
| `JOBLIB_CACHE_DIR` | Répertoire de cache |
| `ALLOWED_ORIGINS` | CORS (défaut : `*`) |

---

## ⚙️ Paramètres configurables — `config.py`

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `DEFAULT_TRAINING_WINDOW` | 252 | ≈ 1 an de bourse |
| `DEFAULT_REBALANCING_WINDOW` | 21 | ≈ 1 mois |
| `DEFAULT_RISK_FREE_RATE` | 4.5% | Fallback si FRED échoue |
| `DEFAULT_TRANSACTION_COST_BPS` | 10 | 0.10% par trade |
| `RETURN_SHRINKAGE_INTENSITY` | 0.5 | James-Stein (MVO) |
| `COV_CONDITION_THRESHOLD` | 1000 | Alerte matrice mal conditionnée |
| `MONTE_CARLO_SIMULATIONS` | 500 | Points sur la frontière efficiente |
| `TURNOVER_SMOOTHING_FACTOR` | 0.25 | Lissage des poids |
| `TARGET_VOLATILITY` | 12% | Vol cible (scaling, désactivé par défaut) |
| `EXTREME_RETURN_THRESHOLD` | 20% | Alerte data quality |
| `MIN_DATA_POINTS` | 60 | Minimum de jours de données |

---

## ⚠️ Limitations connues

| Limitation | Impact |
|-----------|--------|
| Pas de slippage | Exécution exacte au prix Open (simplifié) |
| Pas de market impact | Valide pour portefeuilles modestes |
| Long-only ($w_i \geq 0$) | Pas de vente à découvert |
| Corrélations non-stationnaires | Changent en période de crise |
| Estimation des rendements (MVO) | Mitigée mais pas éliminée |
| Performances passées | Ne garantissent pas l'avenir |
| Survivorship bias | Seuls les tickers existants sont testables |

---

## 📚 Références académiques

| Auteur | Année | Contribution |
|--------|-------|-------------|
| Markowitz | 1952 | Théorie moderne du portefeuille (Mean-Variance) |
| James & Stein | 1961 | Estimateurs à rétrécissement (shrinkage) |
| Sharpe | 1966 | Ratio de Sharpe |
| Michaud | 1989 | MVO comme "error maximizer" |
| Ledoit & Wolf | 2004 | Shrinkage de la matrice de covariance |
| López de Prado | 2016 | HRP (Hierarchical Risk Parity) |

---

## 🎤 Cheat Sheet pour Entretien

### Le pitch (30 secondes)
> "J'ai développé une appli fullstack React/FastAPI qui compare 3 stratégies d'allocation de portefeuille — HRP, GMV et MVO — via un backtest Walk-Forward réaliste. Le backend Python fait l'optimisation, le backtesting et le calcul de métriques, le frontend React affiche 9 types de visualisations interactives."

### Questions techniques fréquentes et réponses

**Q: Pourquoi 3 stratégies et pas une seule ?**
> Chacune a une philosophie différente : HRP utilise le clustering (pas de rendements attendus), GMV minimise le risque pur, MVO maximise le Sharpe. Les comparer permet de voir laquelle aurait été la meilleure historiquement.

**Q: Qu'est-ce qui rend ton backtest réaliste ?**
> Exécution à l'Open(T+1) et non au Close(T) (pas de look-ahead), conversion en nombre entier d'actions (pas de fractions), coûts de transaction sur le turnover, intérêts sur le cash, drift naturel entre rebalancements.

**Q: Pourquoi le MVO est problématique et comment tu le corriges ?**
> Le MVO est un "maximisateur d'erreur" (Michaud 1989) — les erreurs d'estimation des rendements sont amplifiées. Je le corrige avec 6 techniques : EMA pour les rendements, James-Stein shrinkage, Ledoit-Wolf pour la covariance, go-to-cash si marché baissier, fallback en cascade si le solveur échoue, et box constraints pour forcer la diversification.

**Q: Comment fonctionne HRP exactement ?**
> 4 étapes : (1) transformer les corrélations en distances, (2) clustering de Ward pour créer un dendrogramme, (3) réordonner la matrice de covariance, (4) bisection récursive avec allocation par variance inverse. L'avantage est qu'on n'inverse jamais la matrice et qu'on n'a pas besoin d'estimer les rendements.

**Q: Comment tu gères les données ?**
> Tiingo API en priorité (données ajustées dividendes/splits), FRED pour le taux sans risque (T-Bill 3 mois), cache disque via joblib pour éviter les appels redondants, détection automatique crypto vs actions pour adapter le facteur d'annualisation (365 vs 252).

**Q: C'est quoi le Ledoit-Wolf shrinkage ?**
> C'est une technique pour régulariser la matrice de covariance échantillonnée. On la "mélange" avec une matrice cible structurée. L'intensité optimale est calculée analytiquement — pas de paramètre à tuner. Ça garantit que la matrice est inversible et bien conditionnée.

**Q: Comment tu détectes l'overfitting ?**
> À chaque période Walk-Forward, je calcule le Sharpe "prédit" (in-sample, poids constants) et le Sharpe "réalisé" (out-of-sample, equity curve réelle). La corrélation de Spearman entre les deux séries mesure si la stratégie a une vraie capacité prédictive.
