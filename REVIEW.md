# Revue produit — BestAllocation comme outil réel d'allocation

> **STATUT (2026-07-07) : corrigé.** Tous les points 🔴 (R1-R7) et 🟠 (I1, I3-I7)
> ci-dessous ont été traités sur la branche `fix/review-roadmap`, avec tests de
> non-régression (pytest 20/20, dont un test discriminant CVaR-vs-min-variance sur
> rendements asymétriques) et CI GitHub Actions. I2 (CVaR ~13 obs de queue) est une
> limite intrinsèque, désormais documentée dans le README et DOCUMENTATION.md.
> Ce document est conservé comme trace d'audit ; les détails ci-dessous décrivent
> l'état AVANT correction.

**Date :** 2026-07-06
**Angle :** est-ce que je peux **me fier aux chiffres affichés** et utiliser ce site pour mes propres décisions d'allocation ? Où sont les erreurs, qu'est-ce qui est réellement bon, et quelles améliorations apporteraient le plus de valeur ?
**Méthode :** lecture intégrale du backend et des composants frontend qui calculent des chiffres, exécution des suites de tests (7/7 et 4/4 passés), et 4 scripts de vérification empirique (James-Stein, CVaR vs min-variance sur rendements asymétriques, biais alpha CAGR, contamination week-end des portefeuilles mixtes crypto+actions).

> Note : `recap_projet_bestallocation.md` a été supprimé à ta demande. Cette revue remplace la précédente version de `REVIEW.md` (qui était orientée préparation d'entretien).

---

## Verdict express

**Le cœur est fiable.** Le moteur de backtest walk-forward est correct et honnête (aucun look-ahead — vérifié ligne à ligne), le Min-CVaR est un vrai optimiseur de risque de queue (prouvé empiriquement), le HRP est fidèle à López de Prado, et les métriques principales (Sharpe, Sortino, MDD, CAGR, Calmar, Omega) sont justes. **Tu peux te fier aux courbes d'equity, aux drawdowns, et au tableau de métriques principal.**

**Mais plusieurs chiffres affichés sont actuellement faux ou trompeurs**, et c'est là que tu dois faire attention avant de t'en servir pour décider :
1. le **Stress Test** et le **Rolling Sharpe** sont calculés sur des courbes sous-échantillonnées → drawdowns de crise sous-estimés et Sharpe roulant gonflé sur les longs backtests ;
2. l'**Alpha/Beta** est toujours calculé contre l'équipondéré même quand tu choisis SPY comme benchmark, et avec une formule biaisée (~+1,3 pt) ;
3. le **slider CVaR Confidence ne fait rien** (la valeur n'est jamais transmise au backend) ;
4. le **James-Stein du MVO est un no-op** en pratique — le MVO utilise des rendements EMA bruts, contrairement à ce que la doc promet ;
5. les **portefeuilles mixtes crypto+actions** ont des corrélations diluées (fausse diversification) ;
6. le diagnostic d'**overfitting est contaminé** par les périodes cash du MVO.

Aucun de ces problèmes n'est difficile à corriger. Le détail, avec preuves et corrections, ci-dessous.

---

## 🔴 Faux ou trompeur — chiffres affichés à ne pas croire en l'état

### R1. Stress Tests calculés sur la courbe downsamplée → drawdowns de crise sous-estimés, scénarios « N/A » à tort
- **Fichiers :** `frontend/src/components/StressTestCard.tsx:45-63` + `backend/app/api/routes.py:160` (`downsample_curve(equity_curve, 500)`).
- Le backend envoie au frontend une courbe d'equity **limitée à 500 points**. Sur un backtest de 15 ans (~3 800 jours), ça fait ~1 point tous les 7-8 jours de bourse. Le StressTestCard filtre ensuite ces points sur des fenêtres de crise courtes :
  - « China Deval 2015 » (11 jours de bourse) → 1-2 points échantillonnés → affiché **N/A** alors que les données existent ;
  - « COVID Crash » (23 jours) → ~3 points → le max drawdown intra-crise est calculé sur 3 valeurs → **systématiquement sous-estimé** (le vrai creux tombe presque toujours entre deux points échantillonnés).
- **Pourquoi c'est grave pour toi :** c'est précisément le tableau que tu regarderas pour juger la résistance d'une stratégie en crise, et il est optimiste par construction sur les longs historiques.
- **Correction :** calculer les stress tests **côté backend** sur la courbe pleine résolution (comme c'est déjà fait pour `calculate_drawdown_curve`) et envoyer les résultats agrégés ; ou envoyer une courbe dédiée non-downsamplée pour ces fenêtres. Le pattern existe déjà dans le code (le drawdown est calculé full-res puis downsamplé pour l'affichage — c'est le bon modèle à répliquer).

### R2. Rolling Sharpe faussé sur les longs backtests (même cause)
- **Fichier :** `frontend/src/components/RollingSharpeChart.tsx:40-59`.
- Le composant calcule des rendements entre points **consécutifs de la courbe downsamplée** en les traitant comme quotidiens : annualisation `×√252` (ligne 47) et fenêtre de « 252 » points (ligne 49). Si la courbe est downsamplée à 1 point/7 jours : chaque rendement est un rendement 7 jours → le Sharpe est **gonflé d'un facteur ≈ √7 ≈ 2,6×**, et la « fenêtre 1 an » couvre en réalité ~7 ans.
- Sur un backtest court (< 2 ans, pas de downsampling), le chart est correct — c'est ce qui rend le bug sournois : il apparaît exactement quand tu utilises « Full History ».
- **Correction :** même remède que R1 (calcul backend full-res), ou au minimum inférer le pas réel entre points (`(date[i]-date[i-1])` en jours) et annualiser par `√(365/pas_moyen)` avec une fenêtre exprimée en temps calendaire.

### R3. Alpha/Beta : toujours contre l'équipondéré, même quand tu choisis un benchmark custom — et formule biaisée
- **Fichiers :** `backend/app/api/routes.py:105-147` et `backend/metrics.py:121-137`.
- **Problème 1 — mauvais benchmark :** dans `_run_strategy`, les `benchmark_returns` passés à `calculate_metrics` viennent de `bench_curve`, qui est **toujours** l'équipondéré généré par `walk_forward_backtest` (ligne 474 du backtester). Le benchmark custom (ex. SPY) n'est utilisé que pour la courbe affichée et ses propres métriques (`routes.py:262-284`). Résultat : si tu sélectionnes SPY, le tooltip dit « Alpha : excess return vs benchmark » (`ComparisonTable.tsx:41-42`) mais le chiffre est un alpha **vs 1/N**. Tu compareras mentalement à SPY un chiffre qui ne parle pas de SPY.
- **Problème 2 — formule :** l'alpha injecte des **CAGR composés** dans la formule CAPM (`alpha = cagr - (rf + beta·(bench_cagr - rf))`) alors que le beta est estimé sur rendements quotidiens arithmétiques. Vérifié numériquement : sur un portefeuille à 25 % de vol, l'écart vs l'alpha arithmétique classique est **≈ +1,3 point de pourcentage** (le variance drag ≈ σ²/2 gonfle l'alpha des stratégies volatiles).
- **Problème 3 — cohérence du taux sans risque :** les métriques des stratégies utilisent la **moyenne du taux FRED historique** (`routes.py:140`) mais celles du benchmark utilisent le **taux actuel** (`routes.py:281`, `rf_rate_current` ≈ 4-5 % vs moyenne 2010-2026 nettement plus basse). Les Sharpe stratégie vs benchmark ne sont donc **pas comparables à taux égal** — le benchmark est pénalisé.
- **Correction :** (a) passer la courbe benchmark réellement sélectionnée à `calculate_metrics` dans `_run_strategy` (ou déplacer le calcul alpha/beta après le choix du benchmark) ; (b) estimer α/β par régression OLS sur rendements excédentaires quotidiens (`r_p - rf = α + β(r_b - rf)`, α annualisé ×252) ; (c) utiliser le **même** `rf_scalar` (moyenne de la série sur la période du backtest) partout.

### R4. Le slider « CVaR Confidence » ne fait rien
- **Fichiers :** `frontend/src/components/Sidebar.tsx:115` (envoie `cvar_confidence`) → `frontend/src/hooks/useOptimization.ts:57-70` (**le champ est perdu** en reconstruisant la requête) → `api/client.ts:6-21` (absent de l'interface).
- Le backend reçoit donc toujours le défaut 0,95 (`routes.py:202`). Tu peux bouger le curseur de 50 % à 99 % : l'allocation CVaR ne changera jamais. En tant qu'utilisateur, tu crois tester la sensibilité au niveau de confiance alors que tu relances le même calcul.
- **Correction (~4 lignes) :** ajouter `cvarConfidence` à `OptimizationParams` et `CompareRequest`, et le transmettre : `cvar_confidence: params.cvarConfidence`.

### R5. James-Stein : le shrinkage des rendements du MVO est un no-op en pratique
- **Fichier :** `backend/optimization.py:27-67` (`shrink_expected_returns`).
- La formule codée `λ = max(0, 1 - (p-2)/Σ(μᵢ-μ̄)²)` omet le terme de variance d'échantillonnage du James-Stein classique. Comme `μ` est en rendements **annualisés** (dispersion typique ~0,006), `(p-2)/dispersion` explose et λ est clampé à **0**. Vérifié empiriquement :
  ```
  μ réalistes [0.08, 0.12, 0.05, 0.15, 0.10] → λ=0.000 → AUCUN shrinkage
  μ quasi identiques (bruit pur)             → λ=0.000 → AUCUN shrinkage  (l'inverse de l'intention !)
  μ extrêmes [2.0, -1.5, 3.0, -2.0, 1.0]     → λ=0.842 → shrinkage massif (l'inverse aussi)
  ```
  Le fallback `RETURN_SHRINKAGE_INTENSITY = 0.5` n'est atteint que si la dispersion est < 1e-10 — jamais en pratique.
- **Conséquence concrète pour toi :** le MVO optimise sur des rendements EMA **bruts**, donc il « chasse » les gagnants récents plus agressivement que prévu. Ses allocations sont plus instables et plus exposées à l'overfitting que ce que la doc in-app promet (« we shrink expected returns towards the global mean », `DocumentationPage.tsx:988`). C'est probablement une des raisons pour lesquelles le MVO alterne souvent avec le mode cash.
- **Correction :** le plus simple et honnête est de forcer `shrinkage_intensity=RETURN_SHRINKAGE_INTENSITY` (0,5 constant) et de supprimer la branche « data-driven » bancale. Version rigoureuse : vraie formule JS sur moyennes quotidiennes avec terme de variance `σ̄²/T`, puis annualisation. Dans les deux cas, corriger le commentaire inversé (lignes 55-58).

### R6. Diagnostic d'overfitting contaminé par les périodes cash → ρ et « Reliability Score » non fiables pour le MVO
- **Fichiers :** `backend/backtester.py:439-443`, `frontend/src/components/OverfittingChart.tsx:33-57`, `ModelHealthCards.tsx:20-88`.
- Chaque période où le MVO est en cash est enregistrée comme le point **(0, 0)** (prédit=réalisé=0). Un MVO qui passe 40 % du temps en cash accumule un paquet de points identiques parfaitement « prédits » → la corrélation de Spearman et le Reliability Score sont **artificiellement gonflés**, précisément pour la stratégie dont tu veux surveiller l'overfitting. S'ajoutent : Spearman frontend sans correction des ex æquo (formule `6Σd²/n(n²-1)` invalide en présence de ties, or les (0,0) et le cap ±5 en créent), et un échantillon de ~12-36 paires seulement avec les fenêtres par défaut (252/63) — un ρ sur 12 points est du bruit.
- **Le « Reliability Score » de ModelHealthCards est une composite maison** (pondérations 20/15/15/15/15/10/10 arbitraires) — utilisable comme heuristique, mais rien d'établi : ne prends pas ses seuils (« Reliable ≥ 65 ») comme une vérité.
- **Correction :** exclure les périodes cash du calcul (les afficher à part : « X périodes en cash »), afficher n à côté de ρ, et utiliser une implémentation de Spearman avec gestion des ties (rangs moyens).

### R7. Portefeuilles mixtes crypto + actions : corrélations diluées → fausse diversification
- **Fichiers :** `backend/data_provider.py:404-433` (union d'index + `ffill().dropna()`), `backend/metrics.py:28-48`.
- Quand tu mélanges `btcusd` et des actions, l'index de dates devient l'union : les **week-ends survivent** avec des prix actions figés au vendredi (ffill). Vérifié en répliquant le pipeline exact : **29 % des lignes sont des week-ends à rendement action = 0**, et la corrélation mesurée entre un actif corrélé à 0,91 au BTC tombe à **0,77**.
- **Conséquence :** HRP clusterise sur des corrélations sous-estimées, MVO/CVaR voient une diversification qui n'existe pas → **sur-allocation au couple crypto/actions** par rapport à la réalité. La volatilité, elle, est à peu près correcte (l'annualisation 365 compense les jours à zéro), c'est bien la structure de corrélation qui est faussée.
- **Correction :** avant l'optimisation, aligner le calendrier sur l'**intersection** des jours de cotation (jours ouvrés) plutôt que l'union ffillée — 1 ligne dans `fetch_price_data` (`dropna` avant `ffill`, ou `close_prices.dropna()` au lieu de `ffill().dropna()`), au prix de jeter les week-ends crypto. C'est le compromis standard. Documenter le choix dans l'UI (« les portefeuilles mixtes sont alignés sur les jours ouvrés »).

---

## 🟠 Important — biais méthodologiques à connaître pour bien utiliser le site

### I1. Le benchmark équipondéré ne paie pas de coûts de transaction
- **Fichier :** `backend/backtester.py:489-563` — `get_equal_weight_benchmark` calcule le turnover mais **ne déduit jamais de coût**, alors que les 3 stratégies paient leurs bps à chaque rebalancement. Le benchmark est donc structurellement avantagé (d'autant plus que tu mets des coûts élevés). Si une stratégie bat l'EW de peu, ce n'est pas concluant.
- **Correction :** appliquer les mêmes `transaction_cost_bps` au rebalancement mensuel de l'EW (le turnover y est déjà calculé, il suffit de le facturer).

### I2. CVaR à 95 % sur 252 jours = ~13 observations de queue
- La doc in-app le dit très bien (`DocumentationPage.tsx:497-503`). En pratique pour toi : l'allocation CVaR peut **changer notablement d'un rebalancement à l'autre** juste parce qu'un jour extrême entre/sort de la fenêtre glissante. C'est inhérent à la CVaR historique, pas un bug — mais utilise-la avec `training_window` ≥ 252, et ne sur-interprète pas ses variations fines.

### I3. Tiingo est un point de défaillance unique (et le README prétend le contraire)
- Aucun fallback yfinance n'existe (`grep yfinance` → uniquement doc et un commentaire dans `backtester.py:575`). Si ta clé Tiingo expire ou que l'API tombe, le site est mort — seul le cache joblib te sauve pour les requêtes déjà vues. Le fallback FRED → 4,5 % constant, lui, est réel.
- **Pour un usage perso c'est acceptable**, mais : (a) retire les mentions yfinance de `README.md` (lignes 12, 59) et `DOCUMENTATION.md` (ligne 493) pour que ta propre doc ne te mente pas ; (b) si tu veux de la vraie résilience, un fallback yfinance est ~20 lignes dans `fetch_ticker_history`.

### I4. `DOCUMENTATION.md` décrit un CVaR qui n'existe pas (et un contrôle qualité qui ne tourne pas)
- `DOCUMENTATION.md:70-87` décrit la stratégie CVaR comme un min-variance `min w'Σw` avec Ledoit-Wolf. **Le code fait un vrai Min-CVaR Rockafellar-Uryasev** (`EfficientCVaR.min_cvar()`, `optimization.py:358-375`) — vérifié empiriquement : sur 2 actifs de même variance dont un à queue épaisse, le CVaR donne 63/37 là où un min-variance donne 50/50. La page de doc **in-app** (`DocumentationPage.tsx`) est correcte, elle. Aligne `DOCUMENTATION.md` sur la version in-app (ou supprime-le aussi et garde la doc in-app comme source unique).
- `DOCUMENTATION.md:254-263` décrit un monitoring du condition number — or `check_covariance_quality` **n'est appelé nulle part** (code mort, vérifié par grep). Soit brancher l'appel (et remonter le warning dans `warnings[]` de la réponse — utile !), soit retirer la section.

### I5. Le classement « wins » double-compte des métriques redondantes
- **Fichier :** `frontend/src/hooks/useRanking.ts:21-33`. Sur les 11 métriques comparées : `cagr` et `total_return` sont la **même information**, et Sharpe/Sortino/Calmar/Omega sont fortement corrélées entre elles. Une stratégie « rendement » rafle mécaniquement 4-6 points. L'alpha inclus est le chiffre biaisé de R3. Le podium affiché est donc orienté rendement, pas « équilibré » comme il en a l'air.
- **Correction :** dédupliquer (retirer `total_return`, garder un seul ratio rendement/risque « principal » ou pondérer), et documenter le critère. Alternativement, ranker sur Sortino seul (le backend trie déjà comme ça) et présenter le reste comme détail.

### I6. Rebalancer : pas de ligne « cash » quand les poids ne somment pas à 1
- **Fichier :** `frontend/src/components/RebalancerCard.tsx:75-96`. Les poids cibles utilisés sont les derniers poids du backtest (post-lissage). Si le MVO est en risk-off (somme des poids ≈ 0,3 voire 0), le Rebalancer te dira de **vendre presque tout sans afficher où va l'argent** — le solde implicite (cash) n'apparaît nulle part. Tu pourrais croire à un bug ou mal exécuter les instructions.
- **Correction :** ajouter une ligne « CASH » = `(1 - Σw) × totalPortfolio` dans le tableau des trades, avec une note « la stratégie est partiellement en cash (risk-off) ».

### I7. Garde-fous d'API absents pour un site exposé publiquement
- `schemas.py:88` : pas de `max_length` sur `tickers` (une requête à 200 tickers = 200 appels Tiingo + optimisation 200×200) ni de validation du format ticker. `main.py:27-35` : CORS `*` + `allow_credentials=True` (combinaison à proscrire ; tu n'utilises aucun credential — passe à `False` et fixe `ALLOWED_ORIGINS` en prod). `jobs.py:342` et `data_provider.py:100,453` : `str(e)` renvoyé au client (fuite de détails internes ; en plus la clé FRED transite en query param → elle peut finir dans les logs d'erreur, `data_provider.py:241-256`). Si le site reste un outil perso déployé publiquement, c'est le minimum à durcir : `max_length=30` sur tickers, regex `^[A-Za-z0-9.\-]{1,10}$`, CORS restreint, messages d'erreur génériques.
- À vérifier aussi côté Render : derrière le proxy, `request.client.host` est probablement l'IP du load-balancer pour tout le monde → le rate-limit « 5 req/min/IP » (`main.py:40-69`) peut devenir **5 req/min global**. Teste avec `uvicorn --proxy-headers --forwarded-allow-ips='*'` ou lis `X-Forwarded-For`.

---

## 🟡 Mineur

- **Jours de rebalancement absents de l'equity curve** (`backtester.py:385-421`) : chaque bloc de détention couvre `[T+1, T+reb)` — la valeur au jour de décision T n'est jamais enregistrée, et le cash rate ~1 jour d'intérêts par cycle. Impact négligeable (< 1 bp), mais explique de petits « trous » de dates si tu exportes les courbes un jour.
- **Dernier rebalancement au bord** : `execution_idx = min(current_idx+1, len(dates)-1)` (`backtester.py:320`) — si le dernier jour de données est un jour de décision, l'exécution se fait à l'Open du même jour (léger anachronisme sur 1 trade).
- **Code mort** : `apply_weight_constraints` et `check_covariance_quality` (`optimization.py:105-141`) jamais appelés ; `MIN_POINTS_FOR_RELIABLE_SHARPE` importé mais inutilisé (`metrics.py:8`) ; `DEFAULT_TRAINING_WINDOW/REBALANCING_WINDOW/CVAR_CONFIDENCE` de `config.py` doublonnés par les littéraux du schéma — et **désynchronisés** (config dit 21 jours de rebalancement, schéma+frontend utilisent 63). Choisis une source unique.
- **`backend/debug_output.txt` commité** : log de debug oublié (chemin `C:\Users\clemm\...`), se réfère à un warning déjà corrigé et à un script disparu. `git rm` + compléter `.gitignore` (ajouter aussi `backend/__cache__/`).
- **Tests** : pas de pytest dans les requirements, pas de CI ; `test_crypto.py` exécute du réseau réel **au niveau module** (une collecte pytest déclencherait des appels Tiingo) ; `test_benchmark.py` vise `/optimize`, un endpoint qui n'existe plus ; tous les tests d'optimisation sont gaussiens (sous Gauss, min-CVaR ≈ min-variance, donc ils ne testent pas la capture de queue). Un test discriminant prêt à coller existe dans ma vérification (rendements asymétriques : CVaR doit donner A>0.60 quand min-var donne 50/50 — il passe sur le code actuel).
- **README** : la commande de démarrage documentée échoue (`cd backend && uvicorn main:app` → `ModuleNotFoundError: No module named 'backend'`, vérifié) ; il faut `uvicorn backend.main:app` depuis la racine. À corriger quand tu referas le README propre.
- **`metrics.py:266-267`** : commentaire « Ward's method » mais `method='average'` (cosmétique, n'affecte que l'ordre de la heatmap).
- **Incohérence UI** : `OverfittingChart.tsx` affiche « Robust » à ρ≥0.5 (ligne 112) mais le texte explicatif dit « ρ > 0.3 = robust » (ligne 413).
- **`test_audit.py` crashe en cp1252** (emojis) si un test échoue — lancer avec `PYTHONIOENCODING=utf-8` ou remplacer les emojis.

---

## 🟢 Ce qui est réellement solide (vérifié, pas juste survolé)

- **Zéro look-ahead dans le walk-forward** (`backtester.py:254-461`) : optimisation sur `returns.loc[:current_date]` uniquement, décision au Close(T), exécution à l'Open(T+1) (`execution_idx = current_idx+1`, prix `open_prices_clean`), valorisation au Close. J'ai tracé le flux complet : les données futures ne fuient nulle part. C'est LE point qui invalide la plupart des backtests amateurs, et ici il est juste.
- **Le Min-CVaR est un vrai optimiseur de queue** : prouvé par test empirique (actifs à variance égale, skew différent → CVaR 63/37 vs min-var 50/50, CVaR₉₅ du portefeuille améliorée). La doc in-app (VaR vs CVaR, cohérence d'Artzner, LP de Rockafellar-Uryasev, limite des ~13 jours) est **correcte et de très bonne qualité pédagogique**.
- **HRP fidèle et robuste numériquement** (`optimization.py:147-284`) : quasi-diagonalisation et bisection récursive canoniques, variances nulles neutralisées (`diag<1e-12 → 1e12`), corrélations NaN → distance max, α clampé. Ward au lieu du single-linkage original est un choix défendable (évite le chaînage) et assumé.
- **Ledoit-Wolf partout où il faut** et de manière cohérente (MVO, frontière efficiente, contributions au risque finales) — mêmes estimateurs, chiffres comparables entre panneaux.
- **Coûts et cash bien modélisés** : coût par jambe sur le turnover, turnover annualisé one-sided (÷2), cash rémunéré au taux FRED **historique en série temporelle** (pas un scalaire naïf) via `cumprod` vectorisé, lissage de turnover qui ne renormalise pas (permet la sortie progressive en cash — subtil et correct).
- **Métriques principales justes** : Sharpe (excess/std excess ×√252), Sortino (annualisations cohérentes num/dénom), MDD, CAGR, Calmar, Omega (seuil rf quotidien, garde division-par-zéro), skew/kurtosis, beta (cov/var quotidiens, ddof cohérents). Seule l'alpha a les problèmes décrits en R3.
- **Architecture backend saine pour un outil perso** : job manager singleton thread-safe avec TTL, exécution parallèle des 3 stratégies, `sanitize_nan` avant sérialisation, cache joblib clé-par-date pour le taux (refresh quotidien), clé API via env sans fallback hardcodé, drawdown calculé **full-res côté backend puis downsamplé pour l'affichage** — c'est exactement le bon pattern (celui que R1/R2 doivent imiter).
- **UX de qualité** : polling avec timeout et garde d'unmount (`useOptimization.ts`), progress bar réelle par stratégie, warnings de biais de survivance affichés, Rebalancer très pratique (le concept « entre tes montants → instructions de trades » est une vraie plus-value que peu d'outils gratuits offrent), page de documentation intégrée sérieuse.

---

## Feuille de route conseillée (par valeur pour toi, effort croissant)

| # | Quoi | Pourquoi | Effort |
|---|------|----------|--------|
| 1 | Câbler le slider CVaR (R4) | Contrôle mort → réel | ~4 lignes front |
| 2 | Alpha/Beta : bon benchmark + OLS + rf unifié (R3) | Chiffre central du tableau comparatif | ~20 lignes back |
| 3 | James-Stein : intensité constante 0,5 (R5) | Le MVO redevient ce que la doc promet | ~5 lignes back |
| 4 | Stress tests + Rolling Sharpe côté backend full-res (R1, R2) | Les 2 panneaux « risque » redeviennent fiables | ~60 lignes back + simplification front |
| 5 | Exclure le cash du diagnostic d'overfitting + n affiché (R6) | Diagnostic MVO honnête | ~15 lignes |
| 6 | Intersection des calendriers crypto/actions (R7) | Corrélations vraies sur portefeuilles mixtes | 1-2 lignes + test |
| 7 | Coûts sur le benchmark EW (I1) | Comparaison à armes égales | ~5 lignes |
| 8 | Durcissement API : max tickers, CORS, erreurs génériques (I7) | Site exposé publiquement | ~30 min |
| 9 | Nettoyage : debug_output.txt, code mort, config dédupliquée, README réécrit (sans yfinance, bonne commande) | Hygiène + doc unique fiable | ~1 h |
| 10 | Vrais tests pytest + le test CVaR-vs-minvar asymétrique + CI GitHub Actions | Filet de sécurité pour tes futures modifs | ~2 h |

## Verdict final

**Utilisable dès aujourd'hui pour :** comparer les profils de risque des 3 stratégies sur un univers d'actions/ETF, lire les courbes d'equity, drawdowns, corrélations, allocations dans le temps, et utiliser le Rebalancer. Le moteur sous-jacent est digne de confiance — c'est rare à ce niveau de réalisme (Open T+1, coûts, cash rémunéré, taux historique).

**À ne pas prendre au pied de la lettre tant que non corrigé :** le tableau Stress Tests et le Rolling Sharpe sur longs historiques (R1/R2), l'Alpha/Beta (R3), le score d'overfitting du MVO (R6), les portefeuilles mixtes crypto+actions (R7), et le slider CVaR (R4). Rien d'irrécupérable : les items 1-7 de la feuille de route représentent une grosse journée de travail et transforment le site en outil réellement fiable de bout en bout.
