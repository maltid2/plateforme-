# Robot Geometry — méthode « Geometry Market Mastery »

Robot de trading qui applique la méthode du PDF *Geometry Market Mastery* :
zones clés en **M15**, entrée en **M5**, avec les règles de psychologie du PDF codées en garde-fous.

**Marché par défaut : l'or (XAUUSD).** Le Dow Jones (US30), le marché d'origine du PDF,
reste disponible (paramètre `InpMarket` dans l'EA, `--market=dow` dans le backtest).

| Dossier | Contenu |
|---|---|
| [`mt5/GeometryDow.mq5`](./mt5/GeometryDow.mq5) | Expert Advisor **MetaTrader 5** (or ou Dow, démo/réel) |
| [`backtest/`](./backtest) | Backtester **Node.js** sans dépendance, même logique, avec tests |
| [`dashboard/`](./dashboard) | **Tableau de bord web** + **rapport quotidien automatique** (audit des règles, journal, Telegram facultatif) |

> ⚠️ **Avertissement** : les CFD sont à effet de levier et la majorité des comptes
> particuliers perdent de l'argent. Ce robot n'est **pas** un conseil en investissement et
> n'a pas été validé sur données réelles. Faites tourner le backtest sur votre historique,
> puis le robot **en démo** plusieurs semaines avant d'envisager un compte réel.

## L'or et la méthode

Le PDF dit que la méthode marche le mieux en **faible ou moyenne volatilité** : c'est ce qui
permet des stops courts et une entrée précise sur le setup. L'or bouge plus que le Dow, donc :

- les distances du PDF sont **converties à l'échelle de l'or** plutôt que copiées telles quelles ;
- les créneaux horaires sont ceux où l'or est liquide (Londres, puis New York), en **évitant les
  statistiques US de 14:30** ;
- un **filtre anti-news** bloque les entrées juste après une bougie M15 anormalement grande
  (« ne prends pas position sur une simple accélération du prix »).

### Conversion des distances

Tous les réglages sont écrits en **points méthode** (les valeurs du PDF pour le Dow) et convertis
en prix : **Dow 1 point = 1,0 · or 1 point = 0,45 $**. Ce ratio a été **calibré sur de vrais cours
XAUUSD M5** (février–mai 2026, voir plus bas) : une bougie M15 de l'or y fait en médiane **10 $**
(16 $ pendant New York). Une première estimation à 0,20 $ donnait des stops trop serrés ; entre
0,40 $ (stop normal) et 0,45 $ (stop un peu plus long), le second a mieux fait semaine par semaine.
Si ton broker ou la période est plus calme ou plus agitée, ajuste `InpPointScale`.

| Réglage du PDF | Dow | Or |
|---|---|---|
| SL mini en range serré | 5 pts | 2,25 $ |
| SL mini en impulsion | 20 pts | 9 $ |
| SL mini en range large / seuil de range large | 30 / 100 pts | 13,50 / 45 $ |
| SL maximum (au-delà : pas de trade) | 40 pts | 18 $ |
| Achat / vente rapide (SL / TP) | 5 / 30 pts | 2,25 / 13,50 $ |
| Distance max à la zone pour entrer | 15 pts | 6,75 $ |
| Filtre anti-news (amplitude M15 max) | désactivé | 27 $ |

### Horaires : mode méthode (défaut) ou H24

| Mode | Créneaux (heure de Paris) | Limites par jour |
|---|---|---|
| **Méthode du PDF** (défaut) | Or : **09:00–12:00** (ouverture de Londres) · **14:45–18:00** (Londres + New York, après les stats de 14:30) — Dow : 10:00–13:30 · 18:00–20:00 · 21:30–23:00. Arrêt **2 h** après la première entrée (« prendre ce qu'on a à prendre pendant max deux heures »). | 3 trades, 2 pertes, −3 % |
| H24 (option `InpMode`) | 01:00–22:45, hors rollover (22:45–01:00 : spreads très larges). | 6 trades, 2 pertes, −10 % |

Les horaires du PDF sont le réglage par défaut parce que c'est celui qui a donné le meilleur
résultat sur les vrais cours de l'or (voir « Résultats sur de vrais cours XAUUSD ») ; le mode H24
y perdait. Sur l'or, le vendredi, plus d'entrée après 21:00 et **clôture à 22:30** : jamais de
position pendant le week-end. Dans les deux modes, la pause de 2 h après une perte, le filtre
anti-news, le stop jamais élargi et une seule position à la fois restent actifs.

### Petit compte (80–100 $)

Sur l'or, la plus petite position (**0,01 lot**) gagne ou perd **environ 1 $ par dollar de mouvement**.
Avec 90 $ et 1 % de risque (0,90 $), aucun stop logique ne passerait : le robot ne traderait jamais.
Il fonctionne donc ainsi :

- il calcule le lot pour risquer `InpRiskPercent` (1 %) ;
- si ça donne moins que le lot minimum, il prend **0,01 lot seulement si la perte au stop reste
  ≤ `InpMaxRiskPercentMinLot` (5 %)**, soit un stop de 4,50 $ max avec 90 $ ;
- sinon, **il ne prend pas le trade** (message dans l'onglet *Experts*).

**Sur les vrais cours de 2026, ça ne suffit pas** : les stops logiques font 9 à 18 $ (médiane ~12,60 $),
donc avec 90 $ le robot refuse tout. Avec **200 $**, il n'a pris que 3 trades en 12 semaines ; avec
**280 $**, 14 trades (voir le tableau par semaine plus bas). Chaque perte coûte alors 4 à 5 % du compte.

> Le plus adapté à ce capital est un **compte cent** (proposé par beaucoup de brokers) :
> 90 $ y deviennent 9 000 cents et 0,01 lot ne vaut plus que 1 cent par dollar de mouvement.
> Le robot peut alors vraiment risquer 1 % par trade. Rien à changer dans l'EA : le lot est
> calculé à partir de la valeur du tick du symbole.

## Comment le robot applique la méthode

À chaque clôture de bougie M5, le robot vérifie la check-list du PDF (section « Comment ? »).
Les distances ci-dessous sont en points méthode (voir le tableau de conversion) :

| Étape du PDF | Traduction dans le robot |
|---|---|
| **1. Range ou impulsion ?** | Efficacité directionnelle des 24 dernières M15 (< 0,3 = range). SL mini : **5** en range serré, **30** en range large (≥ 100), **20** en impulsion. |
| **2. Zone clé** supply/demand, S/R/P | Points hauts/bas M15 (fractales) sur 24 h → zone de la mèche jusqu'au corps. Une zone n'est cassée que par une **clôture** au-delà (une mèche = stop hunt). |
| **3. Géométrie** AB=CD, U, N | Zigzag des pivots M15 : ratio CD/AB (complet entre 0,75 et 1,3). Target = zone opposée la plus proche, haut/bas du range (**U**) ou mouvement mesuré (**N**), avec un R:R mini de 1,5. |
| **4. Mèches M15** | Mèche basse sur bougie **verte** (achat) / haute sur bougie **rouge** (vente), dans la zone. Exception gérée : grande mèche puis **avalement**. Le **stop hunt** (mèche qui transperce la zone puis réintègre) est détecté. |
| **5. Confirmation M5** | **2 bougies** dans le sens, la 2ᵉ clôturant plus loin, avec **volume** ≥ moyenne 20 bougies. |
| **Stop loss** logique | Derrière les mèches / la zone / le plus bas des bougies de confirmation, + 2 de marge, jamais moins que le SL mini du type de trade, jamais plus de 40. |
| **Stop suiveur** | À +1R le stop passe à l'entrée +1, puis suit le prix à 1R de distance. Il ne fait **que se resserrer**. |
| **Achat / vente rapide** | Option `InpQuickMode` : SL 5 / TP 30 fixes. |

### Règles de psychologie codées en dur

| Règle du PDF | Garde-fou |
|---|---|
| « Ne déplace jamais ton stop » | Le stop n'est jamais élargi, seulement resserré par le stop suiveur. |
| « N'ajoute pas de position à une position perdante » | Une seule position à la fois. |
| « Prends 2 h de pause » / pas de *Hail-Mary trade* | Pause de 120 min après chaque perte. |
| « Un trade reste un trade » | Risque fixe par trade (1 % du capital), max 2 pertes et −3 % par jour, max 3 trades/jour. |
| « Ne prends pas position sur une simple accélération du prix » | Pas d'entrée loin de la zone ; filtre anti-news sur l'or. |
| « Tiens un journal de trading » | Le backtest exporte un journal CSV ; l'EA journalise chaque trade (check-list incluse) pour le tableau de bord, qui produit un rapport chaque soir avec un champ de notes. |

## Installation dans MetaTrader 5

1. MT5 → **Fichier › Ouvrir le dossier des données** → `MQL5/Experts/`, copiez-y `GeometryDow.mq5`.
2. Ouvrez-le dans **MetaEditor** (F4) et compilez (F7).
3. Ouvrez un graphique **XAUUSD** (parfois `GOLD`, `XAUUSD.m`… selon le broker), n'importe quelle unité de temps.
4. Glissez l'EA sur le graphique, activez le **trading algorithmique**.

Paramètres à vérifier absolument :

- **`InpMode`** : *Méthode du PDF* par défaut (horaires ci-dessus) ou *H24*.
- **`InpMaxRiskPercentMinLot`** : perte maximale acceptée au lot minimum sur un petit compte (5 %).
- **`InpMarket`** : *Or (XAUUSD)* par défaut. L'onglet *Experts* affiche un avertissement si le
  graphique ne correspond pas au marché choisi.
- **`InpServerMinusParisHours`** : heure du serveur MT5 moins heure de Paris. La plupart des
  brokers sont en UTC+2/+3 → **1**. Comparez l'heure de la fenêtre *Market Watch* avec l'heure de Paris.
- **`InpPointScale`** : `0` = automatique (or 0,45 $, Dow 1,0). À ajuster après backtest.
- **`InpSession1..3`** : `auto` = créneaux du mode et du marché choisis ; ou `HH:MM-HH:MM` ; vide = désactivé.
- **`InpFridayLastEntry` / `InpFridayClose`** : `auto` = 21:00 / 22:30 sur l'or (et en H24) ; vide = désactivé.
- **`InpMaxM15Range`** : `-1` = automatique (or 60 points méthode = 12 $, Dow désactivé) ; `0` = désactivé.
- **`InpRiskPercent`** : risque par trade (1 % par défaut). Le lot est calculé à partir de la
  distance du stop et de la valeur du tick du symbole : il s'adapte à l'or automatiquement.

Testez d'abord dans le **Testeur de stratégie** (Ctrl+R) en mode « Toutes les ticks basés sur des ticks réels ».

## Mise en route pas à pas (tourner 24 h/24)

Le robot ne trade que si MetaTrader 5 est ouvert. Pour ne pas dépendre de ton PC, fais tourner
MT5 et le tableau de bord sur un **VPS Windows** (beaucoup de brokers en offrent un gratuit à
partir d'un certain volume ; sinon comptez 10-30 €/mois).

1. **Compte démo** chez un broker MT5 qui propose l'or (XAUUSD) avec un spread serré.
2. Sur le VPS : installe **MetaTrader 5** (depuis le site du broker) et **Node.js LTS** (nodejs.org).
3. Copie le dossier `robot-geometry-dow` sur le VPS.
4. Installe l'EA (section ci-dessus), règle `InpServerMinusParisHours`, laisse `InpExportDashboard = true`.
5. Lance `dashboard\demarrer.bat`, puis ouvre <http://127.0.0.1:8787> sur le VPS.
   Pour qu'il redémarre avec Windows : **Planificateur de tâches › Créer une tâche de base ›
   Au démarrage de l'ordinateur › Démarrer un programme** → `demarrer.bat`.
6. Chaque soir le rapport du jour apparaît dans l'onglet **Rapports quotidiens**
   (et sur Telegram si tu l'as configuré, voir [`dashboard/README.md`](./dashboard/README.md)).

Aperçu immédiat, sans MetaTrader : `cd dashboard && npm run demo`.

## Résultats sur de vrais cours XAUUSD

Test sur **17 371 bougies M5 réelles, du 25/02 au 26/05/2026** (67 jours de marché), source :
[Sai310421/xauusd-data](https://github.com/Sai310421/xauusd-data) (prix milieu, sans spread :
le backtest ajoute 0,30 $ de spread). Période particulière : l'or est passé de 5 140 $ à 4 560 $.

| Réglage | Trades | Réussite | Profit factor | Total | Drawdown (1 %/trade) |
|---|---|---|---|---|---|
| **H24**, 1 pt = 0,20 $ (ancien réglage) | 13 | 23 % | 0,46 | −5,1 R | 6,4 % |
| **H24**, 1 pt = 0,40 $ | 57 | 37 % | 0,86 | −5,3 R | 14,2 % |
| **Méthode du PDF** (créneaux), 1 pt = 0,40 $ (stop normal) | 21 | 52 % | 1,45 | +5,4 R | 4,9 % |
| **Méthode du PDF** (créneaux), 1 pt = 0,45 $ (stop plus long, **défaut**) | 24 | 58 % | 1,41 | **+6,7 R** | 3,0 % |
| Méthode, mode rapide (SL 2 $ / TP 12 $) | 27 | 22 % | 0,54 | −10,4 R | — |
| H24, mode rapide | 80 | 25 % | 0,62 | −24,3 R | — |

Ce qu'on peut en dire :

- **Le mode H24 perd** sur cette période, quels que soient les réglages testés (profit factor < 1).
- **Les créneaux du PDF font mieux** et restent positifs sur chaque moitié de la période
  (et avec 1 pt = 0,35 ou 0,45 $), mais **21 trades en 3 mois, c'est beaucoup trop peu** pour
  conclure que la méthode gagne : ça peut être de la chance.
- **Le mode rapide perd nettement** : sur l'or, un stop de 2 $ est touché presque à chaque fois.
- Il faudrait refaire le test sur **au moins un an** de données, idéalement celles de ton broker
  (export MT5, avec son vrai spread).

### Semaine par semaine, en dollars (méthode, 0,01 lot)

Chaque semaine repart du capital de départ. Stop normal (0,40 $) contre stop plus long (0,45 $) :

| Capital | Stop | Trades (gagnants) | Setups refusés | Total 12 semaines | Pire semaine | Meilleure semaine |
|---|---|---|---|---|---|---|
| 200 $ | normal | 3 (3) | 21 | +45,96 $ | 0 $ | +16,68 $ |
| 200 $ | plus long | 3 (3) | 25 | +45,56 $ | 0 $ | +16,68 $ |
| 280 $ | normal | 14 (8) | 4 | +15,07 $ | −24,38 $ | +28,91 $ |
| 280 $ | plus long | 14 (10) | 10 | +38,50 $ | −13,78 $ | +25,61 $ |
| 280 $ | plus long + 2 créneaux + gain/risque ≥ 2 (**défaut**) | 14 (10) | — | **+47,44 $** | **−13,78 $** | **+30,08 $** |

**Optimisation des gains (défaut actuel pour l'or)** : sur les 3 mois en continu à 280 $, autoriser
les deux créneaux chaque jour (au lieu de s'arrêter 2 h après la première entrée) et ne garder que
les setups à gain/risque ≥ 2 fait passer le résultat de **+28,93 $ à +69,77 $** (19 trades, 68 % de
gagnants), sans que le compte descende plus bas (≈ 249 $ au pire). Viser la zone la plus lointaine
(`targetChoice: 'farthest'`, backtest seulement) a aussi été testé : moins régulier, non retenu.

## Backtest en Node.js

Aucune installation : Node.js ≥ 18 suffit.

```bash
cd robot-geometry-dow/backtest
npm test                                                # tests de la logique
node src/index.js historique_XAUUSD_M5.csv              # or (défaut), horaires du PDF, résultats en R
node src/index.js historique_XAUUSD_M5.csv --capital=90  # simulation en dollars avec 90 $ (lots réels)
node src/index.js historique_XAUUSD_M5.csv --mode=h24  # toute la journée
node src/index.js historique_XAUUSD_M5.csv --quick      # achat/vente rapide (SL 2 $ / TP 12 $)
node src/index.js historique_US30_M5.csv --market=dow   # Dow Jones
node src/index.js data.csv --offset=1 --risk=1 --spread=0.3 --journal=journal.csv
```

Pour obtenir l'historique : MT5 → **Affichage › Symboles** → XAUUSD → onglet **Barres** →
période **M5** → *Demander* → **Exporter**. Le fichier exporté est lu tel quel
(`<DATE> <TIME> <OPEN> <HIGH> <LOW> <CLOSE> <TICKVOL>`), un CSV `time,open,high,low,close,volume` marche aussi.
Les heures du journal sont celles du serveur. Le spread par défaut est de 0,30 $ pour l'or
(`--spread` pour mettre celui de ton broker).

Hypothèses du simulateur : entrée à l'ouverture de la bougie M5 suivante, spread déduit,
et si le stop et la target sont touchés dans la même bougie, c'est le **stop** qui est retenu (prudent).

Tous les paramètres sont dans [`backtest/src/config.js`](./backtest/src/config.js) avec les mêmes
noms que dans l'EA (préfixe `Inp`), et les réglages propres à chaque marché dans `markets`.

## Limites

- Les timings, stops et targets du PDF ont été pensés **pour le Dow** en faible volatilité.
  La conversion vers l'or est calibrée sur 3 mois de cours réels seulement : valide-la sur plus long.
- Une zone supply/demand, une « belle série de mèches » ou une géométrie « qui tend à être
  complétée » sont des jugements visuels dans le PDF. Le robot en fait des règles chiffrées :
  il prendra des trades qu'un humain aurait refusés et en ratera d'autres. Ajustez les seuils
  avec le backtest.
- Le « volume acheteur / vendeur » est le **volume de ticks** de la bougie (ce que montre MT4/MT5
  sur un CFD), pas un vrai flux d'ordres.
- Le filtre anti-news ne connaît pas le calendrier économique : il réagit à la bougie, après coup.
  Les jours de stats majeures (NFP, CPI, FOMC), le plus sûr reste de couper le robot.
- L'EA n'a pas pu être compilé dans cet environnement (MetaEditor est uniquement sous Windows) ;
  signalez toute erreur de compilation. La logique a été testée dans le backtester Node.js.
