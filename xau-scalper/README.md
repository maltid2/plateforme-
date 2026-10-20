# xau-scalper — recherche et bot de scalping XAU/USD (MT5), capital 100 €

> **Mode réel désactivé par défaut. Conclusion des tests : aucune stratégie ne remplit les critères de passage en réel,
> et 100 € ne permettent pas d'ouvrir le lot minimum chez un courtier régulé UE.** Aucun résultat ne garantit un gain.

## Livrables

| # | Livrable | Où |
|---|---|---|
| 1 | Étude de faisabilité du scalping XAU/USD avec 100 € | [docs/FAISABILITE.md](docs/FAISABILITE.md) |
| 2 | Cartographie et comparatif des stratégies, règles exactes, matrice de recherche | [docs/STRATEGIES.md](docs/STRATEGIES.md), criblage dans les rapports |
| 3 | Les 3 stratégies testées en premier (sélection automatique sur le développement) | [docs/RAPPORT.md](docs/RAPPORT.md) |
| 4 | Plateforme et architecture | ci-dessous |
| 5 | Code Python organisé en fichiers | [xauscalp/](xauscalp/) |
| 6 | Tests unitaires (60) | [tests/](tests/) |
| 7 | Protocole de backtesting | [docs/PROTOCOLE.md](docs/PROTOCOLE.md), critères pré-enregistrés [docs/CRITERES.md](docs/CRITERES.md) |
| 8 | Rapport de résultats réellement mesurés | [docs/RAPPORT.md](docs/RAPPORT.md), [reports/etude_A](reports/etude_A/RESULTATS_MESURES.md), [reports/etude_B](reports/etude_B/RESULTATS_MESURES.md) |
| 9 | Guide d'installation et de lancement en démo | [docs/GUIDE_DEMO.md](docs/GUIDE_DEMO.md) |
| 10 | Grille de validation avant activation réelle | [docs/VALIDATION.md](docs/VALIDATION.md) |

## Résultat en bref (mesuré)

- **100 € chez un courtier UE régulé** : marge du lot minimum ≈ 185 € (levier 1:20) et perte au lot minimum ≈ 0,86 €
  par dollar de mouvement, contre 0,25 € de risque autorisé. **0 % des signaux exécutables.**
- **2015-2018 (ticks bid/ask)** : 159 combinaisons stratégie × unité de temps × session. 80 sont positives avant frais
  et **1 seule après frais** ; elle échoue en validation. Le coût médian vaut **0,81 R par trade en M1**, 0,34 R en M5
  et 0,20 R en M15.
- **2025-2026 (or très volatil)** : la cassure de Donchian M15 en session asiatique fait +0,172 R par trade sur 2026,
  jamais vu (165 trades, PF 1,34, +0,150 R en coûts stress). La même règle perd −0,23 à −0,26 R par trade en 2015-2018 :
  son avantage dépend de la tendance. **À suivre en paper trading, pas en réel.**

## Fusion des trois robots (étude C)

Les deux anciens robots du dossier `robot-geometry-dow` (méthode géométrique du PDF, liquidité sweep + MSS) sont
portés en Python (`xauscalp/strategies/legacy.py`) et combinés avec le nouveau dans un seul moteur :
chaque robot garde son unité de temps et ses sessions, une seule position à la fois, priorité dans l'ordre.

| Configuration | Contenu |
|---|---|
| `config.fusion.json` | **robot fusionné** : liquidité M5 (Londres / New York) puis Donchian M15 (Asie) |
| `config.example.json` | Donchian M15 seul |

La méthode du PDF est disponible (`geometry_pdf`) mais perd sur toutes les périodes testées : elle n'est pas dans la
fusion. Résultats : docs/RAPPORT.md (étude C) et reports/etude_C_fusion.

```bash
python -m xauscalp fusion --ticks data/xau_m1_2015.csv ... --mt5-m5 export_M5.csv --m1 xau_m1_2026.csv
python -m xauscalp paper export_M5.csv --server-tz paris+1 --config config.fusion.json --account cent --equity 100
python -m xauscalp run --config config.fusion.json --mode demo
```

## Scalp agressif (étude D)

`config.scalp.json` : jusqu'à 3 positions de ~1 € de risque (1 % de 100 €, compte cent), sorties en 1 à 5 minutes,
bougies M1 ou en secondes (`"tf_seconds": 10`, construites à partir des ticks MT5). **Perdant dans tous les tests**
(100 € → environ 80 € et arrêt automatique à −20 %) : voir docs/RAPPORT.md, étude D.

```bash
python -m xauscalp scalp --s10 data/xau_s10_2018H1.csv --m1-ticks data/xau_m1_2017.csv data/xau_m1_2018H1.csv --m1-2026 xau_m1_2026.csv --mt5-m5 export_M5.csv
python -m xauscalp run --config config.scalp.json --mode demo
```

## Architecture

```
xauscalp/
  data.py          chargement CSV (MT5, UTC, bid/ask), heure serveur → UTC, validation, nettoyage, ré-échantillonnage
  indicators.py    EMA, ATR, RSI, Bollinger, Donchian, efficacité directionnelle, VWAP (volume de ticks), mapping H1
  sessions.py      Asie / Londres / chevauchement / NY, en heure locale (changements d'heure), rollover, week-end
  news.py          calendrier des annonces US (intégré pour le backtest, CSV MT5 en démo) et fenêtres d'exclusion
  market.py        contexte : indicateurs en cache, niveaux Asie / veille, tendance H1, régime (sans look-ahead)
  strategies/      12 stratégies + les 2 anciens robots (legacy.py) + filtre H1 + ensemble + moteur par régime
  portfolio.py     fusion de robots (une position à la fois) et simulation de compte
  fusion.py        étude C (fusion des trois robots)
  scalp.py         scalp agressif : backtest multi-positions, stratégies de quelques minutes, étude D
  ml.py            méta-filtre logistique (Python pur), utilisé seulement s'il est démontré hors échantillon
  symbol.py        spécification du symbole fournie par le courtier (taille de contrat, tick, lots, marge, stops)
  sizing.py        taille de position : perte au stop frais compris ≤ limite, sinon REFUS ; contrôle de marge
  risk.py          gestionnaire central : risque/trade, perte journalière, drawdown → suspension, 1 position, arrêt d'urgence
  backtest.py      backtest bid/ask, spread variable, commission, slippage, gaps, latence, rejets, mode compte
  metrics.py       espérance, PF, drawdown, Sharpe, t, coûts, Monte-Carlo, sensibilité aux meilleurs trades
  research.py      protocole complet (criblage, sélection, validation, walk-forward, robustesse, faisabilité)
  feasibility.py   le capital permet-il de respecter le risque avec le lot minimum ?
  broker/          interface commune ; paper.py (rejeu simulé) ; mt5.py (MetaTrader 5 : order_check, codes retour,
                   exécutions partielles, stop obligatoire)
  engine.py        boucle paper / démo / réel : resynchronisation, pas de doublon, reprise après redémarrage
  journal.py       journal JSONL de chaque décision, état persistant écrit de façon atomique
  alerts.py        console + Telegram (anti-spam)
  dashboard.py     tableau de bord local (127.0.0.1) et arrêt d'urgence
  config.py        configuration ; trois verrous pour le réel
mql5/ExportCalendar.mq5   export du calendrier économique MT5 (le module Python n'y a pas accès)
scripts/ticks2m1.py       ticks bid/ask → bougies M1 avec spread et extrêmes de l'ask
```

Choix de plateforme : **MetaTrader 5 + Python**. Le paquet officiel `MetaTrader5` donne accès aux spécifications du
symbole, aux bougies, aux ticks, aux ordres et à l'historique. MQL5 sert seulement au calendrier économique. Le carnet
d'ordres d'un CFD sur or n'est pas un vrai order flow : la famille « order flow » n'est pas testée.

## Commandes

```bash
python -m unittest discover -s tests -t .                       # 60 tests, aucune dépendance
python -m xauscalp feasibility --equity 100 --risk 0.25         # faisabilité (specs d'exemple ou --spec réelle)
python -m xauscalp validate export.csv --server-tz paris+1      # qualité des données
python -m xauscalp backtest export.csv --server-tz paris+1 --tf 15 --strategy donchian_breakout --sessions asia --account cent
python -m xauscalp research --study A --ticks data/xau_m1_2015.csv ... --holdout-m5 export.csv --out reports/etude_A
python -m xauscalp research --study B --holdout-m5 export.csv --out reports/etude_B
python -m xauscalp paper export.csv --server-tz paris+1 --config config.example.json   # moteur complet en rejeu
python -m xauscalp run --config config.json --mode demo         # Windows + MT5, compte démo uniquement
python -m xauscalp dashboard
```
