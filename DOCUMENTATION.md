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

### 2. Min-CVaR (Conditional Value at Risk)

**Source:** Rockafellar, R.T. & Uryasev, S. (2000) - "Optimization of Conditional Value-at-Risk"

**Principe:** Minimise la **CVaR** (Expected Shortfall) du portefeuille : la perte moyenne
subie sur les pires (1−β)% des jours (β = niveau de confiance, 95% par défaut,
réglable dans l'UI). C'est une optimisation du **risque de queue**, plus fine que la
variance car elle capture l'asymétrie des rendements.

**Formule (programme linéaire de Rockafellar-Uryasev):**
```
min   ζ + 1/((1-β)T) × Σ max(-w'rₜ - ζ, 0)
s.t.  Σw = 1
      min_weight ≤ w ≤ max_weight
```

Où:
- `w` = vecteur des poids, `rₜ` = rendements du jour t (données historiques brutes)
- `ζ` = la VaR au niveau β (variable d'optimisation auxiliaire)
- `β` = niveau de confiance (0.95 par défaut)

**Implémentation:** `EfficientCVaR(mu, returns, beta=β).min_cvar()` de PyPortfolioOpt
(solveur convexe CVXPY). Contrairement au MVO, l'optimiseur travaille directement sur
les rendements historiques journaliers — pas sur une matrice de covariance.

**Avantages:** CVaR est une mesure de risque **cohérente** (Artzner et al., 1999),
contrairement à la VaR. N'utilise pas les estimations de rendements attendus.

> [!WARNING]
> À 95% sur une fenêtre de 252 jours, la CVaR n'est estimée que sur ~13 jours extrêmes.
> L'estimation de queue est donc sensible aux outliers : l'allocation peut bouger
> sensiblement quand un jour extrême entre ou sort de la fenêtre glissante.
> Utiliser une fenêtre d'entraînement ≥ 252 jours.

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

**Solution:** Shrinkage vers la moyenne globale (grand mean), à intensité **fixe** :

```
μ_shrunk = λ × μ_grand_mean + (1-λ) × μ_sample

où:
- μ_grand_mean = moyenne de tous les rendements attendus
- λ = RETURN_SHRINKAGE_INTENSITY = 0.5 (constante, config.py)
```

> [!NOTE]
> Pourquoi λ fixe et pas l'intensité data-driven de James-Stein ? La formule
> data-driven exige la variance d'échantillonnage des moyennes ; sur ~1 an de
> données quotidiennes, ce bruit domine tellement la dispersion transversale des
> rendements attendus que λ tendrait vers 1 (tout le signal serait jeté).
> λ = 0.5 garde la moitié du signal tout en réduisant nettement l'erreur d'estimation.

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

**Formule:** estimée par régression sur les rendements quotidiens arithmétiques
(l'intercept OLS annualisé) :
```
Alpha = [mean(r_p - rf_d) - β × mean(r_b - rf_d)] × 252
```
Utiliser des rendements arithmétiques (et non des CAGR composés) garde l'alpha
cohérent avec le beta estimé en quotidien — injecter des CAGR dans la droite du
CAPM gonflerait l'alpha d'environ σ²/2 (variance drag).

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

## 🔬 Tests de Significativité

**Fichier:** `backend/significance.py` — calculés une fois les 3 stratégies terminées, sur les rendements
quotidiens **pleine résolution** (jamais sur les courbes sous-échantillonnées d'affichage).

> [!IMPORTANT]
> Un classement sans barres d'erreur est un tirage au sort avec des décimales. Ces quatre tests
> répondent à la seule question qui compte : **l'écart observé dépasse-t-il la précision de l'instrument ?**

---

### 1. Intervalle de confiance sur l'écart de Sharpe (bootstrap par blocs circulaires)

**Problème:** le Sharpe est une statistique bruitée. Comparer 0,79 et 0,66 sans marge d'erreur n'a pas de sens.

**Méthode:** ré-échantillonnage par **blocs circulaires** de 21 séances (Politis & Romano, 1992), 1 000 tirages.

```
Pour b = 1..1000:
    tirer des blocs de 21 jours (avec rebouclage) jusqu'à couvrir T jours
    appliquer les MÊMES indices aux deux séries
    ΔSharpe_b = Sharpe(série A) − Sharpe(série B)
IC 95% = [percentile_2.5(ΔSharpe), percentile_97.5(ΔSharpe)]
```

**Deux points d'implémentation qui changent le résultat:**
- **Blocs, pas jours isolés:** les rendements sont autocorrélés et la volatilité arrive en grappes.
  Tirer jour par jour casserait cette structure et donnerait un intervalle trop étroit — donc trop optimiste.
- **Mêmes blocs pour les deux séries:** les stratégies vivent les mêmes krachs. Les ré-échantillonner
  indépendamment détruirait leur corrélation et gonflerait artificiellement la variance de l'écart.

**Graine fixe:** deux exécutions sur les mêmes données donnent le même intervalle.

**Lecture:** si l'intervalle **contient zéro**, « aucune différence » reste une explication possible → non concluant.

---

### 2. PBO — Probability of Backtest Overfitting (CSCV)

**Source:** Bailey, Borwein, López de Prado & Zhu (2016) — *The Probability of Backtest Overfitting*

**Question:** si je n'avais eu que la moitié de l'historique pour désigner un gagnant, ce gagnant tiendrait-il
sur l'autre moitié ?

**Méthode (Combinatorially Symmetric Cross-Validation):**
```
1. Découper la série en S = 16 blocs de taille égale
2. Pour chacune des C(16, 8) = 12 870 combinaisons:
       IS  = les 8 blocs choisis        OOS = les 8 blocs restants
       n*  = stratégie de meilleur Sharpe en IS
       ω   = rang relatif de n* dans le classement OOS  ∈ [0, 1]
       λ   = logit(ω)
3. PBO = P(λ ≤ 0) = fraction des cas où le gagnant IS finit sous la médiane OOS
```

**Implémentation:** les 12 870 combinaisons sont vectorisées via des **statistiques suffisantes par bloc**
(somme et somme des carrés par bloc), ce qui évite de recalculer les Sharpe à chaque combinaison.

**Lecture:** `50%` = choisir le gagnant d'un backtest ne vaut pas mieux qu'un tirage au sort ·
`< 25%` = sélection robuste · `0%` = le gagnant est un vrai gagnant.

---

### 3. Deflated Sharpe Ratio

**Source:** Bailey & López de Prado (2014) — *The Deflated Sharpe Ratio*

**Problème:** si l'on compare assez de stratégies, la meilleure aura l'air brillante par pure chance.
Le Sharpe observé doit être corrigé du **nombre d'essais**.

```
SR₀ = E[max Sharpe sous H₀] ≈ σ_SR · [ (1−γ)·Φ⁻¹(1 − 1/N) + γ·Φ⁻¹(1 − 1/(N·e)) ]

DSR = Φ ( (SR − SR₀) · √(T−1)  /  √(1 − γ₃·SR + (γ₄−1)/4 · SR²) )
```

Où `N` = nombre d'essais, `γ` = constante d'Euler-Mascheroni, `γ₃` = asymétrie, `γ₄` = kurtosis,
`T` = nombre d'observations.

**Ce que la formule corrige:** le nombre de candidats comparés, l'asymétrie négative et l'épaisseur des queues —
trois raisons pour lesquelles un Sharpe brut flatte la réalité.

**Lecture:** probabilité que le vrai Sharpe soit > 0. Au-dessus de **95%**, crédible.

> [!NOTE]
> **Ce que la correction de queue vaut réellement.** L'asymétrie et le kurtosis entrent au dénominateur
> multipliés par le Sharpe **par période**. Sur des données quotidiennes ce Sharpe vaut ~0,04, donc la
> correction est du second ordre. L'interface affiche désormais son montant à côté de chaque DSR
> (`tail_adjustment`, en points de pourcentage) pour que le lecteur voie à la fois qu'elle est appliquée
> **et** qu'elle est ici négligeable — sur l'univers par défaut : −0,045 pt (HRP), −0,036 pt (Min-CVaR),
> −0,056 pt (MVO). Le MVO écope de la plus forte, ce qui est cohérent avec son profil de queue
> (asymétrie −1,30, kurtosis 20,1). La correction ne devient déterminante que sur des fréquences plus
> grossières (mensuel) ou pour une stratégie à Sharpe élevé.

---

### 4. Pouvoir prédictif et son plafond de détectabilité

**Le rank-IC de Spearman est conservé, mais il n'est plus affiché seul.**

Un ratio de Sharpe annualisé estimé sur une seule fenêtre de détention de 63 jours porte une erreur
d'échantillonnage de (Lo, 2002) :

```
σ(SR_annualisé) ≈ √( (1 + SR²/2) / n_périodes )  × √(252/63)  ≈  ±2,0
```

Or la dispersion observée des Sharpe réalisés d'une période à l'autre est de **1,86 à 1,99**. La part de signal
est donc nulle : **la corrélation est mécaniquement atténuée vers 0 quoi que fasse le modèle.**

Le backend renvoie donc, à côté du ρ, le **plafond** `ρ_max` atteignable compte tenu de ce bruit.
Quand le plafond est nul, l'interface affiche **« Non mesurable »** au lieu de « Overfitting ».

> [!WARNING]
> Un ρ ≈ 0 n'était pas une preuve de sur-apprentissage — c'était la preuve que le test ne pouvait
> rien résoudre. C'est la raison pour laquelle le score composite « Reliability » (pondérations
> 20/15/15/15/15/10/10 inventées) a été supprimé.

---

### 5. L'avantage sur le benchmark (`edge_statistics`)

**Reformulation la plus utile:** au lieu de comparer des *niveaux* de Sharpe, on mesure l'**écart** avec le
benchmark sur exactement la même fenêtre.

**Pourquoi:** quand le marché s'effondre, toutes les stratégies souffrent ensemble. Ce régime commun est la
principale source de bruit. Le soustraire fait tomber la dispersion de ~1,9 à **0,6-1,0** — deux à trois fois
moins de bruit, donc un test bien plus sensible.

**Sortie:** moyenne de l'avantage, écart-type, statistique `t` et `p` (test de Student apparié).
Règle du pouce : `|t| > 2` pour commencer à y croire.

---

### Ce que les tests disent sur l'univers par défaut

*6 ETF (QQQ, VGK, VWO, GLD, SLV, TLT), 2006-2026, 77 rebalancements:*

| Résultat | Valeur | Lecture |
|----------|--------|---------|
| DSR des 3 stratégies | 98,8% à 99,8% | ✅ Elles battent réellement le cash |
| Meilleur écart (MVO − 1/N) | +0,225 · IC [−0,02 ; +0,48] · p = 0,074 | ❌ Non significatif |
| MVO − HRP | +0,133 · p = 0,39 | ❌ Impossible à départager |
| PBO | 36% | ⚠️ 1 fois sur 3, le champion se serait trompé |
| Plafond du rank-IC | ~0 | — Non mesurable à 63 jours |

**Conclusion honnête:** les trois stratégies créent de la valeur par rapport au cash, aucune ne se distingue
statistiquement des autres ni du simple équipondéré. Le choix doit donc se faire sur ce qui se mesure sans
ambiguïté — perte maximale, rotation, frais — et non sur la première place du podium.

---

## 🔧 Paramètres Utilisateur

| Paramètre | Description | Défaut |
|-----------|-------------|--------|
| Training Window | Jours de données pour l'optimisation | 252 |
| Rebalancing Window | Jours entre chaque rebalancement | 63 (trimestriel) |
| Min Weight | Poids minimum par actif | 0% |
| Max Weight | Poids maximum par actif | 100% (UI : 25%) |
| Transaction Cost | Coût en bps par trade (par jambe) | 10 |
| CVaR Confidence | Niveau de confiance β du Min-CVaR | 95% |

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
├── main.py                # Entrée FastAPI, CORS, rate limiting
├── app/
│   ├── api/routes.py      # Endpoints, orchestration des jobs
│   ├── core/schemas.py    # Modèles Pydantic (source unique des défauts API)
│   └── services/jobs.py   # Job manager asynchrone en mémoire
├── optimization.py        # Algorithmes HRP, Min-CVaR, MVO
├── backtester.py          # Moteur walk-forward + benchmarks
├── metrics.py             # Métriques, stress tests, rolling Sharpe
├── significance.py        # Bootstrap, PBO/CSCV, Deflated Sharpe, plafond du rank-IC
├── config.py              # Constantes
└── data_provider.py       # Données (Tiingo + FRED, cache joblib)

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
| Overfitting Chart | Predicted vs Realized Sharpe, avec le plafond de détectabilité |
| Significance Card | Intervalles de confiance sur les écarts de Sharpe, PBO, DSR |

---

## ⚠️ Limitations

1. **Pas de slippage:** Exécution exactement au prix d'ouverture de T+1 (pas d'écart d'exécution modélisé)
2. **Pas de market impact:** Valable pour des portefeuilles de taille modeste
3. **Actions fractionnaires:** Les quantités sont continues (hypothèse de divisibilité parfaite — réaliste pour ETF/fonds, pas pour un titre à très gros nominal)
4. **Données historiques:** Les performances passées ne garantissent pas l'avenir
5. **Estimation des rendements (MVO):** Bien que mitigée par EMA et James-Stein shrinkage, reste une source d'incertitude inhérente à toute prévision
6. **CVaR à petit échantillon:** ~13 observations de queue à 95%/252 jours — estimation instable (voir la section Min-CVaR)
7. **Corrélations non-stationnaires:** Les corrélations entre actifs changent dans le temps, surtout en période de crise
8. **Biais de survivance:** Seuls les tickers existants aujourd'hui sont testables
9. **Tests de significativité en petit échantillon:** avec les fenêtres par défaut (252/63), 20 ans d'historique ne donnent que 77 périodes. Le PBO tourne sur 16 splits et les intervalles de bootstrap restent larges — les tests sont honnêtes sur l'incertitude, ils ne la suppriment pas
10. **Rank-IC non mesurable sur fenêtre courte:** le pouvoir prédictif du Sharpe in-sample est rapporté avec son plafond de détectabilité, qui est nul à 63 jours (voir la section « Tests de significativité ») — lire le plafond avant de lire le ρ

---

## 📚 Références

- López de Prado, M. (2018). *Advances in Financial Machine Learning*
- Markowitz, H. (1952). *Portfolio Selection*
- Sharpe, W. (1966). *Mutual Fund Performance*
- Rockafellar, R.T., & Uryasev, S. (2000). *Optimization of Conditional Value-at-Risk*
- Artzner, P., Delbaen, F., Eber, J.-M., & Heath, D. (1999). *Coherent Measures of Risk*
- Ledoit, O., & Wolf, M. (2004). *Honey, I Shrunk the Sample Covariance Matrix*
- James, W., & Stein, C. (1961). *Estimation with Quadratic Loss* (Shrinkage Estimators)
- Politis, D., & Romano, J. (1992). *A Circular Block-Resampling Procedure for Stationary Data*
- Lo, A. (2002). *The Statistics of Sharpe Ratios* (erreur d'échantillonnage du Sharpe)
- Bailey, D., & López de Prado, M. (2014). *The Deflated Sharpe Ratio*
- Bailey, D., Borwein, J., López de Prado, M., & Zhu, Q. (2016). *The Probability of Backtest Overfitting*
- PyPortfolioOpt Documentation: https://pyportfolioopt.readthedocs.io/
