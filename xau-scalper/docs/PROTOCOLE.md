# Protocole de backtesting

## Données

| Jeu | Source | Contenu | Usage |
|---|---|---|---|
| Ticks bid/ask 2015-01 → 2018-06 | [FX-Data/FX-Data-XAUUSD-DS](https://github.com/FX-Data/FX-Data-XAUUSD-DS) (ticks au format Dukascopy, branches 2015 à 2018) | ~1,17 million de bougies M1 reconstruites par `scripts/ticks2m1.py` : OHLC bid, plus haut/bas de l'**ask**, spread moyen et max | étude A : développement 2015-16, validation 2017-18 |
| MT5 XAUUSD M5 2025-04 → 2026-09 | export MetaTrader 5 d'un courtier (heure serveur = Paris + 1) | OHLC bid, volume de ticks, spread de la bougie (en points, minimum de la bougie) | étude A : hold-out ; étude B : développement 2025 / validation 2026 |
| M1 2026-03 → 2026-09 | M1 publiques en UTC ([Sai310421/xauusd-data](https://github.com/Sai310421/xauusd-data), [getdata-finance](https://github.com/getdata-finance/xauusd-1m-ohlcv-metals-historical-data), voir robot-geometry-dow/README.md) | OHLC sans spread (profil horaire du spread repris du fichier MT5) | hold-out M1 de l'étude A |

Contrôle qualité (`python -m xauscalp validate`) : doublons, ordre chronologique, OHLC incohérents, prix nuls, trous hors
fermetures, pics anormaux. Les fichiers utilisés n'ont ni doublon ni OHLC incohérent (voir les rapports).
**Plusieurs années n'existent que pour 2015-2018** : les données gratuites accessibles depuis cet environnement ne
couvrent pas 2019-2024 (Dukascopy et Hugging Face sont bloqués par le proxy).

## Moteur (xauscalp/backtest.py)

- Signal à la clôture de la bougie k, ordre au marché à l'ouverture de k+1 (option de latence en bougies).
- Achat à l'ask, vente au bid ; un achat sort au bid, une vente à l'ask. Le stop d'une vente est déclenché par l'ask
  (plus haut de l'ask réel quand les données bid/ask existent).
- Stop au-delà duquel le marché ouvre en gap : sortie à l'ouverture, plus le slippage de stop.
- Stop et target touchés dans la même bougie : **stop retenu** (hypothèse prudente).
- Target = ordre limite (sans slippage) ; stop, sortie au temps, sortie avant annonce et avant le week-end = ordres au
  marché avec slippage.
- Ordres rejetés tirés au hasard (graine fixe) dans le scénario stress.
- Pas d'entrée : hors session, vendredi après 15:00 NY, rollover, ±30 min autour d'une annonce US majeure, spread
  > 0,60 $, ATR > 3× sa moyenne 5 jours. Positions fermées 5 min avant une annonce.
- Mode « compte » : taille de position, refus si le lot minimum dépasse le risque, marge, perte journalière et
  suspension sur drawdown appliqués par le même `RiskManager` que le moteur réel.

**Limite de précision** : sur des bougies, l'ordre des mouvements à l'intérieur d'une bougie est inconnu (d'où la règle
« stop d'abord »). Les ticks 2015-2018 ont été agrégés en M1 ; un backtest tick par tick serait plus précis pour le M1.

## Scénarios de coûts (fixés avant les tests)

| Scénario | Spread | Commission (aller-retour) | Slippage entrée / stop / sortie | Rejets |
|---|---|---|---|---|
| zéro (référence « avant frais ») | 0 | 0 | 0 | 0 |
| base | spread réel de la bougie, plancher 0,20 $ | 0,05 $/once (5 $/lot) | 0,03 / 0,05 / 0,03 $ | 0 |
| stress | spread ×1,5, plancher 0,30 $ | 0,07 $/once | 0,10 / 0,20 / 0,10 $ | 3 % |

## Déroulé (python -m xauscalp research)

1. Profil de coûts : spread moyen par session et ATR médian par unité de temps et par année.
2. **Criblage** : 12 stratégies (+ variantes avec filtre H1) × M1/M5/M15 × 4 sessions (Asie, Londres, chevauchement,
   après-midi New York), coûts zéro et base, sur le **développement uniquement**.
3. **Sélection** (règle fixée) : unités avec ≥ 100 trades, classées par espérance nette ; une unité par stratégie ;
   les 3 premières.
4. Pour chacune : grille de robustesse (27 variantes voisines), validation hors échantillon **une seule fois** (zéro,
   base, stress), walk-forward (6 mois d'apprentissage, 3 mois de test, choix automatique dans la grille), bootstrap
   Monte-Carlo de 2 000 tirages, sensibilité aux 5 meilleurs trades, résultats par régime, par sens et par année.
5. Hold-out (étude A) sur un autre régime de prix.
6. Moteur adaptatif par régime et méta-filtre logistique, évalués hors échantillon.
7. Simulation de compte à 100 € avec trois spécifications d'exemple.
8. Vérification automatique des critères de docs/CRITERES.md.

Métriques : rendement net en R et en $/once, espérance par trade, profit factor, drawdown maximal, Sharpe (série
journalière, √252), taux de réussite, gain moyen, perte moyenne, nombre de trades, coût total, statistique t,
avant / après frais.

## Simplifications connues

- Le criblage fait tourner les 4 sessions ensemble puis sépare les trades par session : une position ouverte dans une
  session peut masquer un signal dans une autre. Les évaluations détaillées tournent session par session, d'où de petits
  écarts entre le criblage et l'évaluation.
- Valeur du tick supposée constante (conversion EUR/USD fixe à 1,16) dans la simulation de compte.
- Pas de swap (positions intraday), pas de requote partiel modélisé dans le backtest (le moteur réel le gère).
- Calendrier économique 2015-2018 limité au NFP et au FOMC ; le filtre de volatilité couvre en partie le CPI.
