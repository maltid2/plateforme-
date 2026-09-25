# Robot Geometry Dow — méthode « Geometry Market Mastery »

Robot de trading qui applique la méthode du PDF *Geometry Market Mastery* sur le
**Dow Jones (US30)** : zones clés en **M15**, entrée en **M5**, pendant les créneaux horaires
de la méthode, avec les règles de psychologie du PDF codées en garde-fous.

| Dossier | Contenu |
|---|---|
| [`mt5/GeometryDow.mq5`](./mt5/GeometryDow.mq5) | Expert Advisor **MetaTrader 5** (trading démo/réel) |
| [`backtest/`](./backtest) | Backtester **Node.js** sans dépendance, même logique, avec tests |

> ⚠️ **Avertissement** : les CFD sur indices sont à effet de levier et la majorité des comptes
> particuliers perdent de l'argent. Ce robot n'est **pas** un conseil en investissement et
> n'a pas été validé sur données réelles. Faites tourner le backtest sur votre historique,
> puis le robot **en démo** plusieurs semaines avant d'envisager un compte réel.

## Comment le robot applique la méthode

À chaque clôture de bougie M5, le robot vérifie la check-list du PDF (section « Comment ? ») :

| Étape du PDF | Traduction dans le robot |
|---|---|
| **1. Range ou impulsion ?** | Efficacité directionnelle des 24 dernières M15 (< 0,3 = range). SL mini : **5 pts** en range serré, **30 pts** en range large (≥ 100 pts), **20 pts** en impulsion. |
| **2. Zone clé** supply/demand, S/R/P | Points hauts/bas M15 (fractales) sur 24 h → zone de la mèche jusqu'au corps. Une zone n'est cassée que par une **clôture** au-delà (une mèche = stop hunt). |
| **3. Géométrie** AB=CD, U, N | Zigzag des pivots M15 : ratio CD/AB (complet entre 0,75 et 1,3). Target = zone opposée la plus proche, haut/bas du range (**U**) ou mouvement mesuré (**N**), avec un R:R mini de 1,5. |
| **4. Mèches M15** | Mèche basse sur bougie **verte** (achat) / haute sur bougie **rouge** (vente), dans la zone. Exception gérée : grande mèche puis **avalement**. Le **stop hunt** (mèche qui transperce la zone puis réintègre) est détecté. |
| **5. Confirmation M5** | **2 bougies** dans le sens, la 2ᵉ clôturant plus loin, avec **volume** ≥ moyenne 20 bougies. |
| **Stop loss** logique | Derrière les mèches / la zone / le plus bas des bougies de confirmation, + 2 pts de marge, jamais moins que le SL mini du type de trade, jamais plus de 40 pts. |
| **Stop suiveur** | À +1R le stop passe à l'entrée +1 pt, puis suit le prix à 1R de distance. Il ne fait **que se resserrer**. |
| **Achat / vente rapide** | Option `quickMode` : SL 5 pts / TP 30 pts fixes. |

### Horaires (heure de Paris)

10:00–13:30, 18:00–20:00 et 21:30–23:00. Après la **première** entrée de la journée,
le robot s'arrête au bout de **2 heures** (« prendre ce qu'on a à prendre pendant max deux heures »).

### Règles de psychologie codées en dur

| Règle du PDF | Garde-fou |
|---|---|
| « Ne déplace jamais ton stop » | Le stop n'est jamais élargi, seulement resserré par le stop suiveur. |
| « N'ajoute pas de position à une position perdante » | Une seule position à la fois. |
| « Prends 2 h de pause » / pas de *Hail-Mary trade* | Pause de 120 min après chaque perte. |
| « Un trade reste un trade » | Risque fixe par trade (1 % du capital), max 2 pertes et −3 % par jour, max 3 trades/jour. |
| « Ne prends pas position sur une simple accélération du prix » | Pas d'entrée si le prix est à plus de 15 pts de la zone. |
| « Tiens un journal de trading » | Le backtest exporte un journal CSV ; l'EA écrit chaque trade (check-list incluse) dans l'onglet *Experts*. |

## Installation dans MetaTrader 5

1. MT5 → **Fichier › Ouvrir le dossier des données** → `MQL5/Experts/`, copiez-y `GeometryDow.mq5`.
2. Ouvrez-le dans **MetaEditor** (F4) et compilez (F7).
3. Ouvrez un graphique **US30 / DJ30 / WS30** (nom selon le broker), n'importe quelle unité de temps.
4. Glissez l'EA sur le graphique, activez le **trading algorithmique**.

Paramètres à vérifier absolument :

- **`InpServerMinusParisHours`** : heure du serveur MT5 moins heure de Paris. La plupart des
  brokers sont en UTC+2/+3 → **1**. Comparez l'heure de la fenêtre *Market Watch* avec l'heure de Paris.
- **`InpIndexPoint`** : valeur d'un point d'indice en prix. **1.0** chez presque tous les brokers
  (le Dow coté 42 000,0). Si votre broker cote 4 200 000, mettez 100.
- **`InpRiskPercent`** : risque par trade (1 % par défaut).

Testez d'abord dans le **Testeur de stratégie** (Ctrl+R) en mode « Toutes les ticks basés sur des ticks réels ».

## Backtest en Node.js

Aucune installation : Node.js ≥ 18 suffit.

```bash
cd robot-geometry-dow/backtest
npm test                                            # tests de la logique
node src/index.js historique_US30_M5.csv            # backtest mode complet
node src/index.js historique_US30_M5.csv --quick    # mode achat/vente rapide (SL 5 / TP 30)
node src/index.js data.csv --offset=1 --risk=1 --spread=2 --journal=journal.csv
```

Pour obtenir l'historique : MT5 → **Affichage › Symboles** → US30 → onglet **Barres** →
période **M5** → *Demander* → **Exporter**. Le fichier exporté est lu tel quel
(`<DATE> <TIME> <OPEN> <HIGH> <LOW> <CLOSE> <TICKVOL>`), un CSV `time,open,high,low,close,volume` marche aussi.
Les heures du journal sont celles du serveur.

Hypothèses du simulateur : entrée à l'ouverture de la bougie M5 suivante, spread déduit,
et si le stop et la target sont touchés dans la même bougie, c'est le **stop** qui est retenu (prudent).

Tous les paramètres sont dans [`backtest/src/config.js`](./backtest/src/config.js) avec les mêmes
noms que dans l'EA (préfixe `Inp`).

## Limites

- Une zone supply/demand, une « belle série de mèches » ou une géométrie « qui tend à être
  complétée » sont des jugements visuels dans le PDF. Le robot en fait des règles chiffrées :
  il prendra des trades qu'un humain aurait refusés et en ratera d'autres. Ajustez les seuils
  avec le backtest.
- Le « volume acheteur / vendeur » est le **volume de ticks** de la bougie (ce que montre MT4/MT5
  sur un CFD), pas un vrai flux d'ordres.
- L'EA n'a pas pu être compilé dans cet environnement (MetaEditor est uniquement sous Windows) ;
  signalez toute erreur de compilation. La logique a été testée dans le backtester Node.js.
