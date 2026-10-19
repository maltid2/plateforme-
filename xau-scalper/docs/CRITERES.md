# Critères de décision — fixés AVANT les tests

Ce document a été écrit et commité **avant** l'exécution de la recherche (`python -m xauscalp research`).
Les seuils ne seront pas modifiés après coup pour faire passer une stratégie.

## Découpage des données (aucun réglage sur la validation ni sur le hold-out)

| Rôle | Données | Usage |
|---|---|---|
| Développement (in-sample) | Ticks bid/ask XAU/USD 2015-01 → 2016-12 (M1 reconstruites) | choix de la variante, grille de robustesse |
| Validation hors échantillon | Ticks bid/ask 2017-01 → 2018-06 | **une seule** évaluation par variante retenue |
| Hold-out final (autre régime, prix ×3,5) | Bougies MT5 XAUUSD M5 2025-04 → 2026-09 + M1 2026-03 → 2026-09 | **une seule** évaluation, à la fin |
| Walk-forward | 2015-01 → 2018-06 : fenêtres 6 mois d'apprentissage / 3 mois de test, pas de 3 mois | sélection automatique dans la grille, résultats concaténés des fenêtres de test |

## Scénarios de coûts (fixés)

- **zéro** : sans spread, sans commission, sans slippage (référence « avant frais »).
- **base** : spread réel de la bougie (plancher 0,20 $), commission 0,05 $/once aller-retour (5 $/lot de 100 oz),
  slippage 0,03 $ à l'entrée, 0,05 $ sur les stops, 0,03 $ sur les sorties au marché.
- **stress** : spread ×1,5 (plancher 0,30 $), commission 0,07 $/once, slippage 0,10 $ entrée / 0,20 $ stop /
  0,10 $ sortie, 3 % d'ordres rejetés.

## Une stratégie est « candidate au passage en démo » seulement si TOUS ces points sont vrais

1. **Validation hors échantillon (2017-2018, coûts base)** : espérance nette ≥ +0,05 R par trade, profit factor ≥ 1,10,
   au moins 100 trades.
2. **Pas de dépendance à quelques trades** : total en R toujours > 0 après retrait des 5 meilleurs trades.
3. **Coûts stress** sur la validation : espérance nette ≥ 0.
4. **Drawdown** sur la validation ≤ 15 R (à 0,25 % de risque : ≈ 3,75 %, sous le seuil de suspension de 5 %).
5. **Walk-forward** : espérance nette concaténée > 0 et au moins 50 % des fenêtres de test positives.
6. **Monte-Carlo** (bootstrap des trades de validation) : probabilité d'un total positif ≥ 90 %.
7. **Robustesse des paramètres** : au moins 60 % des variantes de la grille voisine positives (coûts base) sur le
   développement.
8. **Hold-out 2025-2026** (coûts base) : espérance nette > 0.
9. **Faisabilité avec le compte réel** : avec la spécification du symbole fournie par le courtier, au moins 80 % des
   signaux peuvent être exécutés à 0,25 % de risque (lot minimum et marge compris).

## Passage en réel (en plus des 9 points)

10. **Démo** : au moins 4 semaines et 50 trades ; slippage médian mesuré ≤ hypothèse « base » ; aucun ordre en double ;
    aucune erreur non gérée ; limites de perte vérifiées en conditions réelles.
11. **Cadre réglementaire** : courtier autorisé à fournir des services en France (registre REGAFI / liste blanche AMF,
    jamais une entité sur liste noire), protections ESMA pour client particulier (levier or 1:20, protection contre le
    solde négatif, clôture à 50 % de marge).

Si aucune stratégie ne remplit ces critères : **pas de passage en réel**. Conclusion attendue dans ce cas : poursuivre
la recherche et/ou augmenter le capital, sans forcer.

---

## Addendum (écrit après l'étude A, AVANT l'étude B) — étude B « régime de forte volatilité »

Motif : dans l'étude A, le coût moyen représente 0,8 R/trade en M1, 0,34 R en M5 et 0,20 R en M15 (2015-2018),
alors que l'ATR de l'or est 4 à 6 fois plus élevé en 2025-2026 pour un spread comparable. L'étude B teste si un
avantage net apparaît quand le coût pèse moins face au mouvement. Le hold-out 2025-2026 de l'étude A ayant déjà été
regardé une fois, l'étude B est une **nouvelle étude indépendante**, avec sa propre séparation :

| Rôle | Données |
|---|---|
| Développement | MT5 XAUUSD M5 2025-04-07 → 2025-12-31 (M5 et M15 reconstruites) |
| Validation | MT5 XAUUSD M5 2026-01-01 → 2026-09-17, une seule évaluation |
| Walk-forward | 2025-04 → 2026-09, 6 mois / 3 mois |

Mêmes stratégies, mêmes paramètres par défaut, même règle de sélection (meilleure espérance nette sur le développement,
une unité par stratégie, n ≥ 100 sur le développement), mêmes scénarios de coûts et **mêmes 9 critères**, à une
exception : le critère 8 (hold-out) n'existe pas dans l'étude B, faute de données indépendantes supplémentaires ; il est
remplacé par l'exigence que l'étude A ne contredise pas franchement le résultat (indiqué, non bloquant).
Limite connue : le développement de l'étude B chevauche la période du hold-out de l'étude A (déjà vue une fois).
Le M1 n'est pas testé dans l'étude B (pas de M1 sur le développement 2025).

---

## Addendum 2 (écrit AVANT l'étude C) — étude C « fusion des trois robots »

Demande : combiner les deux anciens robots (méthode géométrique du PDF, liquidité sweep + MSS) et le nouveau
(cassure de Donchian M15 en session asiatique). Le courtier choisi par l'utilisateur n'est pas forcément régulé :
la faisabilité (critère 9) est évaluée avec la spécification d'un **compte cent** (1 lot = 1 once).

- Membres, réglages d'origine, sans optimisation :
  R1 `geometry_pdf` M5 (Londres + chevauchement, R:R min 2, breakeven à 1R) ;
  R2 `liquidity_mss` M5 (créneaux de Paris 09:00-12:00 et 14:45-18:00, target 3R) ;
  R3 `donchian_breakout` M15 (session Asie, filtre H1).
- Combinaison : une seule position à la fois, priorité R2 > R3 > R1 (ordre fixé ici).
- Ensemble « tous » = R1 + R2 + R3. Ensemble « sélectionné » = membres dont l'espérance nette (coûts base) est > 0
  sur le développement de l'étude B (2025) — règle appliquée mécaniquement par le script.
- Périodes : développement / validation des études A (2015-16 / 2017-18) et B (2025 / 2026-01 → 09), plus le M1
  2026-03 → 09 pour R2. Validation regardée une seule fois.
- Mêmes scénarios de coûts et mêmes critères que l'étude B ; en plus, l'ensemble ne doit pas être négatif sur la
  validation de l'étude A (indiqué).
