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
en prix : **Dow 1 point = 1,0 · or 1 point = 0,20 $**. Ce ratio vient des volatilités M15
typiques (une bougie M15 du Dow fait environ 5 fois plus en points qu'une bougie de l'or en dollars).
C'est une **hypothèse de départ à vérifier avec le backtest** sur ton historique XAUUSD :
si les stops sont trop souvent touchés, augmente `InpPointScale` (0,25 ; 0,30…).

| Réglage du PDF | Dow | Or |
|---|---|---|
| SL mini en range serré | 5 pts | 1,00 $ |
| SL mini en impulsion | 20 pts | 4,00 $ |
| SL mini en range large / seuil de range large | 30 / 100 pts | 6,00 / 20,00 $ |
| SL maximum (au-delà : pas de trade) | 40 pts | 8,00 $ |
| Achat / vente rapide (SL / TP) | 5 / 30 pts | 1,00 / 6,00 $ |
| Distance max à la zone pour entrer | 15 pts | 3,00 $ |
| Filtre anti-news (amplitude M15 max) | désactivé | 12,00 $ |

### Horaires : mode H24 (défaut pour l'or) ou mode méthode

| Mode | Créneaux (heure de Paris) | Limites par jour |
|---|---|---|
| **H24** (défaut or) | **01:00–22:45**, tous les jours de la semaine (le rollover 22:45–01:00 est évité : spreads très larges). Vendredi : plus d'entrée après 21:00, **clôture à 22:30** pour ne rien garder le week-end. | 6 trades, 2 pertes, −10 % |
| Méthode (défaut Dow) | Or : 09:00–12:00 · 14:45–18:00 — Dow : 10:00–13:30 · 18:00–20:00 · 21:30–23:00 (ceux du PDF). Arrêt **2 h** après la première entrée (« prendre ce qu'on a à prendre pendant max deux heures »). | 3 trades, 2 pertes, −3 % |

Dans les deux modes, la pause de 2 h après une perte, le filtre anti-news, le stop jamais élargi et
une seule position à la fois restent actifs. Le mode H24 s'éloigne du PDF, qui conseille de ne
trader que peu de temps par jour : il y aura plus de trades, y compris dans des heures plus calmes
(nuit asiatique) où les setups sont souvent moins nets.

### Petit compte (80–100 $)

Sur l'or, la plus petite position (**0,01 lot**) gagne ou perd **environ 1 $ par dollar de mouvement**.
Avec 90 $ et 1 % de risque (0,90 $), aucun stop logique ne passerait : le robot ne traderait jamais.
Il fonctionne donc ainsi :

- il calcule le lot pour risquer `InpRiskPercent` (1 %) ;
- si ça donne moins que le lot minimum, il prend **0,01 lot seulement si la perte au stop reste
  ≤ `InpMaxRiskPercentMinLot` (5 %)**, soit un stop de 4,50 $ max avec 90 $ ;
- sinon, **il ne prend pas le trade** (message dans l'onglet *Experts*).

Concrètement, avec 90 $ : **chaque trade perdant coûte 1 à 4,50 $ (1 à 5 % du compte)**, et
deux pertes dans la journée arrêtent le robot jusqu'au lendemain (environ −10 % maximum par jour).
Plusieurs mauvais jours d'affilée peuvent faire perdre une grosse partie du capital.

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

- **`InpMode`** : *H24* par défaut (voir plus haut) ou *Méthode du PDF*.
- **`InpMaxRiskPercentMinLot`** : perte maximale acceptée au lot minimum sur un petit compte (5 %).
- **`InpMarket`** : *Or (XAUUSD)* par défaut. L'onglet *Experts* affiche un avertissement si le
  graphique ne correspond pas au marché choisi.
- **`InpServerMinusParisHours`** : heure du serveur MT5 moins heure de Paris. La plupart des
  brokers sont en UTC+2/+3 → **1**. Comparez l'heure de la fenêtre *Market Watch* avec l'heure de Paris.
- **`InpPointScale`** : `0` = automatique (or 0,20 $, Dow 1,0). À ajuster après backtest.
- **`InpSession1..3`** : `auto` = créneaux du mode et du marché choisis ; ou `HH:MM-HH:MM` ; vide = désactivé.
- **`InpFridayLastEntry` / `InpFridayClose`** : `auto` = 21:00 / 22:30 en H24 ; vide = désactivé.
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

## Backtest en Node.js

Aucune installation : Node.js ≥ 18 suffit.

```bash
cd robot-geometry-dow/backtest
npm test                                                # tests de la logique
node src/index.js historique_XAUUSD_M5.csv              # or (défaut), H24, résultats en R
node src/index.js historique_XAUUSD_M5.csv --capital=90  # simulation en dollars avec 90 $ (lots réels)
node src/index.js historique_XAUUSD_M5.csv --mode=methode  # créneaux du PDF, 2 h max
node src/index.js historique_XAUUSD_M5.csv --quick      # achat/vente rapide (SL 1 $ / TP 6 $)
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
  La conversion vers l'or est une hypothèse raisonnable, pas une donnée du PDF : valide-la au backtest.
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
