# Cartographie des stratégies XAU/USD et règles exactes

Aucune stratégie n'est supposée rentable. Toutes sont testées avec le même moteur, les mêmes coûts et la même
règle de sélection (docs/PROTOCOLE.md). Les distances sont en multiples d'ATR(14) de l'unité de temps testée, pour
que la même règle s'applique en M1, M5 et M15 et sur des années où l'or vaut 1 200 $ ou 4 500 $.

## 1. Cartographie des familles et données réellement accessibles à un particulier

| Famille | Hypothèse | Données nécessaires | Accessible (MT5, particulier) | Statut dans ce projet |
|---|---|---|---|---|
| Tendance / pullback (A) | les replis dans une tendance établie reprennent | OHLC, EMA, ATR, H1 | oui | implémentée : `trend_pullback` |
| Breakout de range (B1, B2) | la sortie d'un range de session déclenche un mouvement directionnel | OHLC, horaires de session | oui | `asia_breakout`, `ny_orb` |
| Fausse cassure / chasse aux stops (B3) | les stops au-delà des niveaux évidents sont « chassés » puis le prix revient | OHLC, niveaux Asie / veille | oui | `sweep_reversal` |
| Momentum intraday (C) | une impulsion forte avec volume se prolonge à très court terme | OHLC, volume de ticks | oui (volume de ticks seulement) | `momentum_impulse` |
| Retour à la moyenne Bollinger (D) | en range, les excès reviennent vers la moyenne | OHLC, H1 | oui | `bollinger_reversion` |
| VWAP (E) | l'écart au prix moyen pondéré se résorbe | volume RÉEL idéalement | **non** : l'or spot n'a pas de volume centralisé ; on utilise le volume de ticks (approximation) | `vwap_reversion` |
| Price action / niveaux de session (F) | réaction sur les hauts/bas de l'Asie et de la veille | OHLC | oui | `level_rejection`, `inside_bar` |
| Multi-timeframe (G) | filtrer dans le sens H1 améliore les signaux | H1 | oui | filtre `+H1` (`TrendFilter`) applicable à toutes |
| Order flow / carnet (H) | les déséquilibres acheteurs/vendeurs précèdent le prix | carnet L2, transactions | **non** pour le spot OTC : le DOM d'un courtier CFD reflète sa propre liquidité. Seul le future COMEX (GC/MGC) a un vrai carnet, avec un abonnement CME et un autre courtier | **non testée** (données absentes) |
| Détection de régimes (I) | chaque famille marche dans un régime donné | ER H1, ratio d'ATR | oui | `Market.regime` + `RegimeSwitch` |
| Statistique / ML (J) | des variables de contexte prédisent la qualité d'un signal | historique des signaux | oui | méta-filtre logistique (`ml.py`), évalué hors échantillon |
| Cassure de canal (Donchian, K) | les plus hauts/bas de n bougies cassés en tendance continuent | OHLC, H1 | oui | `donchian_breakout` |
| Compression de volatilité (squeeze, L) | une volatilité comprimée précède une expansion | OHLC | oui | `squeeze_breakout` |
| RSI(2) de Connors (M) | excès très court terme dans le sens de la tendance | OHLC, H1 | oui | `rsi2_reversion` |
| Saisonnalité intraday | certaines heures ont une dérive moyenne | historique long | oui | non testée : demande plus d'années que disponibles pour éviter le data mining |
| Trading de news (straddle) | l'annonce provoque un mouvement | calendrier, exécution rapide | partiellement | **exclue** : slippage et spreads extrêmes, incompatible avec le risque fixé |
| Corrélations (DXY, taux réels, XAG) | l'or réagit au dollar et aux taux | flux DXY / US10Y | partiel (selon courtier) | non testée (pas d'historique aligné disponible) |
| Arbitrage / latence | écarts entre places | colocation | non | hors de portée d'un particulier |
| Grid, martingale, moyenne à la baisse | « le prix revient toujours » | – | – | **interdites** par le cahier des charges et par le gestionnaire de risque |

## 2. Règles exactes (paramètres par défaut, non optimisés)

Convention commune : signal évalué à la clôture de la bougie k ; exécution au marché à l'ouverture de k+1 ; stop et
target posés avec l'ordre ; sortie au temps après `max_minutes` ; aucune entrée hors session, le vendredi après 15:00
New York, pendant le rollover (16:55–18:05 NY), 30 min avant / après une annonce US majeure, si le spread dépasse
0,60 $ ou si l'ATR dépasse 3× sa moyenne de 5 jours. Les positions sont fermées 5 min avant une annonce et le vendredi à
16:30 NY. `a` = ATR(14).

### A. `trend_pullback` — pullback de tendance
- Tendance : clôture H1 > EMA50 H1 et EMA50 H1 montante sur 3 bougies (achat) ; EMA20 > EMA50 sur l'unité testée.
- Entrée achat : sur les 6 dernières bougies, un plus bas ≤ EMA20 + 0,1a (contact), puis bougie haussière qui clôture
  au-dessus de l'EMA20 et du plus haut précédent.
- Stop : plus bas des 6 bougies − 0,2a ; distance entre 0,5a et 3a, sinon pas de trade. Target : 1,5R. Durée max 120 min.
- Vente : symétrique.
- S'abstenir : tendance H1 neutre, ATR anormal, annonces.

### B1. `asia_breakout` — cassure du range asiatique
- Range : plus haut / plus bas de 00:00–07:00 Londres, utilisable de 07:00 à 22:00 Londres, hauteur entre 2a et 15a.
- Entrée achat : clôture > haut Asie + 0,1a alors que la précédente était en dessous, corps ≥ 50 % de la bougie, bougie haussière.
- Stop : milieu du range, ramené à 3a maximum. Target : 1,5R. Durée max 180 min.
- Invalidation : range trop étroit (bruit) ou trop large (déjà en tendance).

### B2. `ny_orb` — opening range de New York
- Range : 09:30–10:00 New York ; entrées de 10:00 à 12:00 New York.
- Entrée : clôture au-delà du range + 0,1a (croisement). Stop : côté opposé du range (max 3a). Target : 1,5R. 120 min.

### B3. `sweep_reversal` — fausse cassure / chasse aux stops
- Niveaux : haut/bas Asie, haut/bas de la veille (jour de trading, rollover 17:00 NY).
- Vente : la bougie dépasse un haut (profondeur ≤ 1,5a), clôture revenue sous le niveau, mèche haute ≥ 40 %.
- Stop : extrême de la mèche + 0,2a (distance 0,5a–3a). Target : 2R. 120 min.

### C. `momentum_impulse` — impulsion
- Bougie d'amplitude ≥ 2× l'ATR précédent, clôture dans le quart extrême, volume de ticks ≥ 1,5× sa moyenne 20.
- Stop : 1a. Target : 1R. Sortie au temps 30 min. Option `htf` : seulement dans le sens H1.

### D. `bollinger_reversion` — retour à la moyenne
- Seulement si l'efficacité directionnelle H1 (12 bougies) ≤ 0,2 (range).
- Achat : clôture précédente sous la bande basse (20, 2σ), clôture actuelle revenue dedans, bougie haussière, RSI14 précédent < 35.
- Stop : plus bas des 3 bougies − 0,3a (max 3a). Target : bande centrale ; trade refusé si gain/risque < 1. 120 min.

### E. `vwap_reversion` — écart au VWAP
- VWAP journalier (remise à zéro 22:00 UTC), pondéré par le volume de ticks ; écart-type des prix autour du VWAP.
- Achat : écart ≤ −2σ, bougie haussière, régime H1 en range (ER ≤ 0,2), σ ≥ 0,5a. Target : VWAP. Stop : plus bas 3 bougies − 0,3a.

### F. `level_rejection` — rejet d'un niveau de session
- Contact (± 0,2a) d'un haut/bas Asie ou veille, mèche ≥ 50 %, bougie de couleur opposée, clôture du bon côté du niveau.
- Stop : au-delà de la mèche + 0,2a. Target : 1,5R. 120 min.

### K. `donchian_breakout` — cassure de canal
- Achat : clôture > plus haut des 20 bougies précédentes (croisement), tendance H1 haussière (clôture > EMA50 H1 montante).
- Stop : 1,5a. Target : 2R. Durée max 240 min. Vente symétrique en tendance H1 baissière.

### L. `squeeze_breakout` — compression puis expansion
- Compression : 2σ(20) < 1,5a pendant au moins 6 bougies ; signal : clôture hors des bandes de Bollinger.
- Stop : 1,5a. Target : 1,5R. 180 min.

### M. `rsi2_reversion` — RSI(2)
- Tendance H1 haussière et RSI(2) < 10 : achat ; stop 1,5a ; target 1a ; 60 min. Symétrique en baisse (RSI > 90).

### O. `inside_bar` — inside bar
- Bougie k−1 contenue dans k−2 (mère ≥ 0,8a) ; clôture k au-delà de la mère dans le sens H1. Stop : autre extrémité
  de la mère (max 3a). Target : 1,5R. 120 min.

### I. Moteur adaptatif `RegimeSwitch`
- Régime (seuils fixés a priori) : `volatile` si ATR / moyenne 5 jours ≥ 1,8 ; `trend` si ER H1 ≥ 0,30 ;
  `range` si ER H1 ≤ 0,15 et ratio ATR ≤ 1,2 ; sinon `chaotic`.
- Tendance → `trend_pullback` ; range → `bollinger_reversion` ; volatil et désordonné → aucun trade.

### J. Méta-filtre logistique
- Variables à la clôture du signal : ER H1, ratio d'ATR, alignement H1, distance à l'EMA50 en ATR, RSI centré,
  heure (sin/cos), spread/ATR, corps de bougie.
- Appris sur le développement (cible : trade gagnant), seuil = médiane des probabilités du développement, évalué une
  fois sur la validation.

## 3. Coûts et risques spécifiques à l'or
- Spread : 0,20–0,35 $ sur un compte standard (mesuré 0,22–0,32 $ en moyenne en 2015-2018 sur les ticks bid/ask), plus
  large en Asie, au rollover et autour des annonces ; commission 5–7 $ par lot de 100 oz sur les comptes « raw ».
- Le coût pèse d'autant plus que le stop est court : en M1 il représente en moyenne **0,8 R par trade** (mesuré), ce qui
  rend le scalping M1 non viable avec ces coûts.
- Gaps du lundi et des annonces (NFP, CPI, FOMC) : un stop ne garantit pas le prix de sortie.
- Swaps (financement de nuit) : non modélisés, car toutes les stratégies sont intraday et fermées avant le week-end.
