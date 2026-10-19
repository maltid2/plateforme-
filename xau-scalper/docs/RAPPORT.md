# Rapport de résultats (valeurs mesurées)

Tous les chiffres viennent des rapports générés automatiquement :
`reports/etude_A/RESULTATS_MESURES.md` et `reports/etude_B/RESULTATS_MESURES.md` (détail complet, JSON à côté).
R = risque initial du trade. Ce sont des **backtests** : ils ne prouvent pas une rentabilité future.

## Verdict

**Aucune stratégie ne remplit tous les critères pré-enregistrés. Le passage en réel est exclu ; avec 100 € chez un
courtier régulé UE, le bot ne peut de toute façon ouvrir aucune position.**

## Étude A — 2015-2018, ticks bid/ask (spread réel), 159 unités testées

| | Unités (≥ 100 trades) | Positives AVANT frais | Positives APRÈS frais (base) |
|---|---|---|---|
| M1, M5, M15 × 12 stratégies (+ filtre H1) × 4 sessions | 159 | 80 | **1** |

Environ la moitié des unités sont positives avant frais : c'est ce qu'on attend du hasard autour de zéro. Après frais,
une seule reste positive sur le développement, et elle ne tient pas en validation.

Les 3 unités sélectionnées sur le développement (règle fixée à l'avance), puis évaluées une fois sur 2017-2018 :

| Unité | Dév. 2015-16 (base) | **Validation 2017-18 (base)** | Validation stress | Walk-forward | Hold-out 2025-26 (base) |
|---|---|---|---|---|---|
| trend_pullback M15, chevauchement | 403 tr., +0,034 R | **320 tr., −0,144 R**, PF 0,70 | −0,259 R | −0,084 R | +0,048 R |
| asia_breakout + H1, M15, Londres | 175 tr., −0,046 R | **125 tr., −0,014 R**, PF 0,96 | −0,120 R | −0,059 R | +0,078 R |
| squeeze_breakout M15, chevauchement | 211 tr., −0,097 R | **153 tr., −0,090 R**, PF 0,83 | −0,222 R | −0,102 R | +0,150 R |

- Moteur adaptatif (tendance → pullback, range → Bollinger) : −0,127 R par trade en validation M15, −0,258 R en M5.
- Méta-filtre logistique : il **dégrade** la validation (−0,194 R contre −0,144 R sans filtre). Pas d'utilité démontrée.

## Étude B — régime de forte volatilité (développement 2025, validation 2026)

Pré-enregistrée après l'étude A (addendum de docs/CRITERES.md). Spread du fichier MT5 avec un plancher de 0,20 $ (base)
et 0,30 $ (stress).

| | Unités (≥ 100 trades) | Positives AVANT frais | Positives APRÈS frais |
|---|---|---|---|
| M5, M15 | 41 | 21 | 15 |

| Unité | Dév. 2025 (base) | **Validation 2026 (base)** | Stress | Walk-forward | Monte-Carlo P(>0) | Grille positive |
|---|---|---|---|---|---|---|
| **donchian_breakout M15, session Asie** | 174 tr., +0,245 R | **165 tr., +0,172 R, PF 1,34, DD 10,8 R** | +0,150 R | +0,101 R (3 fenêtres, 67 %) | 96 % | 100 % |
| asia_breakout M5, chevauchement | 121 tr., +0,134 R | 131 tr., +0,092 R, PF 1,21 | +0,069 R | −0,005 R | 83 % | 100 % |
| squeeze_breakout M5, Asie | 233 tr., +0,044 R | 262 tr., −0,073 R | −0,109 R | +0,246 R | 17 % | 74 % |

`donchian_breakout` M15 Asie remplit les 7 critères statistiques, mais :

1. **L'étude A la contredit nettement** : sur 2015-2018, la même règle fait +0,017 à +0,034 R avant frais et
   **−0,26 R / −0,23 R après frais** (environ 300 et 250 trades). Son avantage de 2025-2026 (+0,32 R avant frais) dépend
   du régime de marché : la forte tendance haussière de l'or. Les achats y rapportent +0,24 R contre +0,09 R pour les
   ventes. Ce n'est pas seulement l'effet de coûts plus faibles.
2. **Faisabilité à 100 €** : 0 % des signaux exécutables chez un courtier UE régulé (marge du lot minimum ≈ 196 €,
   stop médian ≈ 8 $). Le critère 9 échoue.
3. Le walk-forward ne compte que 3 fenêtres, faute d'historique 2025-2026 plus long.

Le moteur adaptatif reste négatif en validation 2026 (−0,011 R en M15, −0,152 R en M5). Le méta-filtre change à peine
le résultat (+0,186 R contre +0,172 R, sur 142 trades au lieu de 165) : rien de démontré.

## Ce que disent les données

- **Le scalping M1 n'est pas viable** avec les coûts d'un particulier : le coût médian vaut 0,81 R par trade.
- Les coûts dominent en M5 (0,34 R par trade en 2015-2018). Le M15 est l'unité la moins pénalisée.
- Aucune famille n'a d'avantage stable **à la fois** en 2015-2018 (or calme, 1 100–1 350 $) et en 2025-2026 (or en forte
  tendance, 3 000–5 000 $).
- La seule piste sérieuse (cassure de Donchian M15 en Asie, dans le sens H1) dépend de la tendance. À suivre **en paper
  trading à partir de maintenant** (période réellement future) avant toute autre conclusion.

## Simulation de compte à 100 € (risque 0,25 %), validation 2026, donchian_breakout M15 Asie

| Spécification (exemple) | Trades pris | Refus | Capital final |
|---|---|---|---|
| CFD UE régulé, lot min 0,01 | 0 | 235 (lot minimum) | 100,00 € |
| CFD UE, lot min 0,001 | 0 | 235 (lot minimum) | 100,00 € |
| Compte cent (hors UE, à vérifier auprès de l'AMF) | 152 | 19 | 105,67 € |

Même dans le cas le plus favorable (compte cent), 9 mois de backtest positif rapportent environ 5,67 € : l'enjeu ne
justifie pas de prendre un risque réglementaire.

## Contrôle de cohérence moteur ↔ backtest (rejeu 2025-04 → 2026-09, M15, compte cent d'exemple, 100 €)

`python -m xauscalp paper` fait passer l'historique par le **moteur d'exécution complet** (le même qu'en démo) :

| | Trades | Capital final | Remarque |
|---|---|---|---|
| Backtest (mode compte) | 327 | 113,69 € | 18 refus (lot minimum) |
| Moteur en rejeu | 294 | 111,45 € | 357 bougies ignorées pour « données périmées » (reprise après un week-end ou un trou de données), 18 refus (lot minimum) ; slippage médian simulé 0,03 $ |

L'écart s'explique par la règle de fraîcheur des données, qui n'existe que dans le moteur. Le test automatique
`test_moteur_et_backtest_prennent_les_memes_trades` exige au moins 90 % d'entrées communes sur des données synthétiques.

## Étude C — fusion des deux anciens robots et du nouveau (rapport complet : reports/etude_C_fusion)

Pré-enregistrée (addendum 2 de docs/CRITERES.md). Compte cent, choisi par l'utilisateur. Coûts base sauf mention.

| Robot seul | 2015-16 | 2017-18 | 2025 | **2026 (validation)** |
|---|---|---|---|---|
| R1 méthode du PDF (M5) | 201 tr., −0,226 R | 149 tr., −0,298 R | 87 tr., −0,164 R | 77 tr., **−0,119 R** |
| R2 liquidité sweep + MSS (M5) | 37 tr., +0,238 R | 19 tr., +0,140 R | 18 tr., +0,571 R | 17 tr., **−0,027 R** |
| R3 Donchian M15 Asie | 302 tr., −0,262 R | 256 tr., −0,233 R | 174 tr., +0,245 R | 165 tr., **+0,172 R** |

- La **méthode du PDF perd sur toutes les périodes**, avant comme après frais : la règle mécanique l'exclut.
- La **liquidité** est le seul robot positif dans les deux régimes de marché (2015-2018 et 2025), mais avec très peu de
  trades (17 à 37 par période) et elle est légèrement négative sur 2026 (17 trades). Exécutée en M1 sur 2026-03 → 09 :
  16 trades, +0,227 R.
- **Ensemble retenu (R2 liquidité > R3 Donchian, une position à la fois)** :

| Période | Trades | Gagnants | E net (base) | E stress | PF | DD |
|---|---|---|---|---|---|---|
| 2015-16 | 337 | 35 % | −0,202 R | −0,360 R | 0,70 | 72,5 R |
| 2017-18 | 269 | 36 % | −0,200 R | −0,373 R | 0,68 | 60,1 R |
| 2025 (dév.) | 189 | 48 % | +0,261 R | +0,221 R | 1,53 | 11,5 R |
| **2026 (validation)** | **180** | **46 %** | **+0,153 R** | **+0,132 R** | **1,30** | **11,9 R** |

  Trimestres 2025-T2 → 2026-T3 : 5 positifs sur 6, mais **le dernier (2026-T3) est négatif (−0,087 R)**.
  Monte-Carlo 2026 : P(total > 0) = 94 %.
- Critères : 7 sur 9 remplis. Échecs : robustesse de la liquidité (17 trades médians par variante, sous le minimum
  de 30) et résultat négatif sur 2017-18 (l'ensemble perd quand l'or n'est pas en forte tendance).
- **Compte cent de 100 €** : 2026 → 105,51 € à 0,25 % de risque (pire baisse 2,2 %), 119,30 € à 1 % (pire baisse 5,3 %,
  puis suspension automatique) ; 2017-18 → 95,60 € (suspension à −5 %). Compte standard 0,01 lot = 100 oz : 0 trade possible.

**Conclusion** : la fusion fait mieux que chaque robot seul sur 2026 et reste positive avec des frais stress, mais elle
dépend du régime de forte tendance de 2025-2026 et perd sur 2015-2018. Le robot est prêt pour la **démo et le paper
trading** (`config.fusion.json`), pas pour de l'argent réel : le mode réel reste verrouillé.

Contrôle de bout en bout : le moteur complet, en rejeu avec `config.fusion.json` (compte cent, 100 €, 0,25 %),
2025-04 → 2026-09 : **343 trades, 100 € → 113,60 €**, aucune position en double, aucune exception.
