# Améliorations possibles — BestAllocation

> **Base de départ (17 août 2026).** L'audit [`AUDIT-2026-08.md`](AUDIT-2026-08.md) est
> intégralement corrigé, le frontend a un harnais de tests, et chaque stratégie est déclarée
> une seule fois de chaque côté. **76 tests backend + 29 tests frontend**, eslint à zéro,
> CI bloquante sur les quatre étapes. Ce document liste ce qu'il reste à *construire*, pas à
> réparer.
>
> Chaque entrée dit **ce que c'est**, **pourquoi ça vaut le coup**, **ce que ça coûte**, et
> **ce dont ça dépend**. Rien n'est engagé : c'est un menu.

---

## Le tableau de décision

| # | Amélioration | Valeur | Effort | Dépend de |
|---|---|---|---|---|
| **A1** | Sauvegarder et comparer des runs | ⭐⭐⭐ | ~1 j | — |
| **A2** | Balayage de sensibilité des paramètres | ⭐⭐⭐ | ~1 j | — |
| **A3** | ERC (Equal Risk Contribution) comme 4ᵉ stratégie | ⭐⭐⭐ | ~½ j | registre ✅ |
| **B1** | Fenêtre d'entraînement extensive (vs glissante) | ⭐⭐ | ~½ j | — |
| **B2** | Coûts de transaction proportionnels à la taille | ⭐⭐ | ~½ j | — |
| **B3** | Queue CVaR estimée sur plus de 13 observations | ⭐⭐ | ~1 j | — |
| **B4** | Benchmark buy-and-hold en plus du rebalancé | ⭐⭐ | ~2 h | — |
| **B5** | Paramètres dans l'URL (run reproductible par lien) | ⭐⭐ | ~3 h | — |
| **C1** | Source de données secondaire (Tiingo n'est plus un SPOF) | ⭐ | ~1 j | — |
| **C2** | Annulation de job | ⭐ | ~2 h | — |
| **C3** | Export CSV / JSON des résultats | ⭐ | ~3 h | — |
| **C4** | Découpage du bundle (1,2 Mo aujourd'hui) | ⭐ | ~2 h | — |

Mon ordre recommandé : **A3 → A2 → A1**, puis piocher dans B selon ce que tu veux répondre.

---

## A. Ce qui change ce que l'outil peut te dire

### A1. Sauvegarder et comparer des runs

**Ce que c'est.** Aujourd'hui chaque comparaison est éphémère : tu lances, tu lis, tu perds.
Nommer un run, le retrouver, et en afficher deux côte à côte.

**Pourquoi ça vaut le coup.** C'est *la* chose qui manque à quelqu'un qui utilise réellement
l'outil pour décider. Les questions naturelles — « est-ce que ça tient si j'enlève l'or ? »,
« qu'est-ce que ça donnait il y a six mois ? » — demandent toutes de comparer deux runs, et
tu ne peux pas. Aujourd'hui tu compares de mémoire ou avec des captures d'écran.

**Ce que ça coûte.** Le job store est déjà en mémoire avec un TTL d'une heure
(`app/services/jobs.py`) : il faut une persistance. SQLite suffit et évite toute infra —
une table `runs(id, label, request_json, result_json, created_at)`. Côté UI, un tiroir
« Runs sauvegardés » et un mode diff sur le tableau de métriques.

**Attention.** Un résultat complet fait ~1,5 Mo de JSON (3 courbes de 500 points, historique
d'allocation, significativité). Stocke la **requête** systématiquement et le **résultat** à
la demande, sinon la base gonfle vite.

---

### A2. Balayage de sensibilité des paramètres

**Ce que c'est.** Relancer la même comparaison sur une grille de paramètres — fenêtre
d'entraînement de 126 à 504 jours, rebalancement de 21 à 126, plafond de poids de 15 % à
100 % — et afficher comment le podium bouge.

**Pourquoi ça vaut le coup.** C'est le complément naturel du PBO, qui est déjà à 36 % sur
l'univers par défaut. Le PBO te dit « le gagnant sur une moitié de l'historique retombe une
fois sur trois dans la moitié basse de l'autre ». Le balayage te dit quelque chose de
différent et d'aussi utile : *à quel point le classement dépend-il de mes réglages ?* Si MVO
gagne à 252/63 mais perd à 378/21, tu ne l'as pas trouvé — tu l'as sélectionné.

C'est aussi l'amélioration qui exploite le mieux ce qui existe déjà : le moteur, les tests de
significativité et le cache joblib sont en place. C'est de l'orchestration, pas de la
nouvelle quant.

**Ce que ça coûte.** Une grille de 4 × 3 = 12 combinaisons × 3 stratégies = 36 backtests.
Sur l'univers par défaut un backtest complet prend quelques secondes une fois les prix en
cache, donc c'est de l'ordre de la minute. Une heatmap « paramètre × stratégie gagnante » et
un indicateur de stabilité du classement (Kendall tau entre les podiums).

**Attention.** Charge CPU réelle : à faire en tâche de fond avec progression, et à borner
(pas de grille arbitraire venant du client).

---

### A3. ERC — Equal Risk Contribution, comme 4ᵉ stratégie

**Ce que c'est.** L'allocation où chaque actif contribue à parts égales au risque du
portefeuille. C'est le *vrai* risk parity, dont HRP est une approximation heuristique.

**Pourquoi ça vaut le coup.** C'est le trou le plus évident du panel actuel. Le comparateur
oppose HRP (heuristique de clustering), Min-CVaR (queue) et MVO (moyenne-variance) — mais pas
la référence contre laquelle HRP se justifie. La question « HRP fait-il mieux que le risk
parity qu'il approxime ? » est exactement le genre de question que cet outil existe pour
trancher, et il ne peut pas y répondre.

Bonus méthodologique : le PBO tourne actuellement sur 4 candidats, ce qui rend le rang
hors-échantillon très grossier (l'interface le dit elle-même). Un cinquième candidat
l'améliore mécaniquement.

**Ce que ça coûte.** Petit maintenant que le registre existe : deux entrées (une dans
`backend/strategies.py`, une dans `frontend/src/theme/strategies.ts`) et une fonction dans
`optimization.py`. `calculate_risk_contributions` existe déjà dans `metrics.py` — l'ERC
consiste à minimiser la dispersion de ces contributions, ce qui se résout bien avec
`scipy.optimize.minimize` sous contrainte de somme à 1.

**Attention.** Ajouter un candidat change le Deflated Sharpe de *tout le monde* (le nombre
d'essais entre dans la correction) et redistribue les parts du PBO. C'est correct — c'est
même le comportement souhaité — mais les chiffres du README bougeront et il faudra les
remettre à jour.

---

## B. Ce qui rend les réponses plus justes

### B1. Fenêtre d'entraînement extensive

Aujourd'hui l'entraînement est une fenêtre **glissante** de 252 jours : à chaque
rebalancement le moteur oublie tout ce qui précède. L'alternative classique est la fenêtre
**extensive** — utiliser tout l'historique disponible jusqu'à la date de décision. Les deux
sont défendables : la glissante s'adapte aux changements de régime, l'extensive réduit
l'erreur d'estimation. Les comparer est un vrai résultat, et c'est un paramètre de plus pour
le balayage A2. Coût : un booléen dans le schéma et une ligne dans `walk_forward_backtest`
(le `.iloc[-training_window:]` devient conditionnel).

### B2. Coûts de transaction proportionnels à la taille

Le modèle actuel est un taux plat (10 bps par défaut) appliqué à la valeur échangée, quelle
que soit la taille. C'est correct pour des ETF liquides et des montants modestes — le README
le dit. Un modèle en deux morceaux (spread fixe + impact ∝ √taille) rendrait le turnover du
MVO (70 %/an mesuré, contre 27 % pour HRP) beaucoup plus coûteux, et c'est précisément là que
se joue une partie de son avantage affiché.

### B3. La queue du CVaR sur plus de 13 observations

À 95 % sur 252 jours, le CVaR repose sur ~13 observations de queue : une seule journée
extrême qui entre ou sort de la fenêtre déplace l'allocation. C'est documenté comme limite
intrinsèque, mais deux sorties existent : estimer la queue sur une fenêtre plus longue que
celle des autres optimiseurs, ou passer à un estimateur paramétrique de queue (Pareto
généralisée sur les dépassements). La seconde est plus élégante et plus discutable — à
présenter comme une option, pas comme un remplacement silencieux.

### B4. Benchmark buy-and-hold

L'équipondéré actuel est **rebalancé** au même rythme que les stratégies et paie les mêmes
coûts (1,06 % du capital initial sur l'univers par défaut). Le buy-and-hold équipondéré —
acheter 1/N une fois et ne plus rien faire — est un benchmark différent et souvent plus
difficile à battre, parce qu'il laisse courir les gagnants. Les deux méritent d'être
affichés. Coût faible : la fonction existe, il s'agit d'un mode sans rebalancement.

### B5. Paramètres dans l'URL

Encoder la requête dans le hash de l'URL pour qu'un lien rejoue exactement le même run.
Complément naturel de A1, et utile seul : c'est la façon la plus simple de retrouver « ce que
j'avais lancé la dernière fois ».

---

## C. Robustesse et confort

- **C1. Source de données secondaire.** Tiingo est le seul fournisseur et le README l'assume.
  Un repli (Stooq, yfinance) derrière la même interface `fetch_ticker_history` supprime le
  point de défaillance unique. Piège : les deux sources n'ajustent pas les dividendes de la
  même manière — mélanger silencieusement fausserait les rendements. À n'utiliser qu'en repli
  complet, jamais en complément partiel, et à afficher.
- **C2. Annulation de job.** Fermer l'onglet laisse trois threads calculer jusqu'au bout.
  Un endpoint `DELETE /api/jobs/{id}` et un drapeau coopératif vérifié dans la boucle de
  rebalancement suffisent.
- **C3. Export CSV / JSON.** Retiré en son temps (commit `b63692c`). Vaut d'être remis pour
  les allocations et le tableau de métriques, si tu veux retravailler les chiffres ailleurs.
- **C4. Découpage du bundle.** 1,2 Mo minifié, avertissement à chaque build. Les graphes sont
  déjà en `lazy()`, mais Recharts et MUI partent dans le chunk principal. Un `manualChunks`
  les isole.

---

## Ce que je ne recommande pas

- **Ajouter des métriques.** Le tableau en compte déjà 16 et le classement « wins » en
  arbitre 10. Une métrique de plus dilue la lecture sans rien trancher.
- **Une base de données pour le job store, tant que tu es seul dessus.** SQLite pour A1
  suffit ; Redis et le multi-instance n'ont de sens que si tu ouvres le site à d'autres.
- **Optimiser le moteur.** Un backtest complet prend quelques secondes sur 20 ans avec le
  cache. Ce n'est pas le goulot d'étranglement.
