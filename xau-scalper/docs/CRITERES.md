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
