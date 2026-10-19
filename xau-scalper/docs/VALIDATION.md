# Grille de validation avant toute activation réelle

Le mode réel exige trois verrous : `"live_enabled": true` dans la configuration, la variable d'environnement
`XAUSCALP_LIVE=JE_COMPRENDS_LES_RISQUES`, et un compte détecté comme réel par MT5. **Ne les lever que si chaque ligne
ci-dessous est cochée.** État au moment de la livraison : ❌ (voir docs/RAPPORT.md).

## A. Recherche (backtest)
- [ ] Les 9 critères de docs/CRITERES.md sont remplis par la stratégie configurée (rapport `research`).
- [ ] Le résultat tient dans les deux régimes (2015-2018 et 2025-2026), ou la dépendance au régime est explicitement
      gérée par un filtre validé hors échantillon.
- [ ] Le résultat tient au scénario de coûts stress.
- [ ] Au moins 3 mois de paper trading **après** la date des données de recherche, avec une espérance nette > 0.

## B. Faisabilité du compte
- [ ] Spécification réelle exportée (`python -m xauscalp spec`) et `feasibility` relancé avec elle.
- [ ] Au moins 80 % des signaux exécutables à 0,25 % de risque, lot minimum et marge compris.
- [ ] La marge du lot minimum reste ≤ 50 % du capital.
- [ ] Le capital déposé est une somme dont la perte totale est acceptable.

## C. Démo MT5 (au moins 4 semaines et 50 trades)
- [ ] Les signaux du journal correspondent à ceux du backtest sur la même période (commande `backtest --journal`).
- [ ] Slippage médian mesuré (champ `slippage` des décisions `order`) ≤ 0,03 $ à l'entrée.
- [ ] Aucun ordre en double (identifiants `xs<bougie><sens>` uniques dans le journal).
- [ ] Redémarrage testé position ouverte : position reprise (`position_adopted` ou `intent_confirmed`), pas de renvoi.
- [ ] Déconnexion testée (terminal coupé puis relancé) : `reconnect`, alertes reçues, pas d'ordre fantôme.
- [ ] Spread excessif testé (`max_spread` abaissé) : entrées refusées et journalisées.
- [ ] Perte journalière et drawdown testés (limites abaissées en démo) : nouvelles entrées bloquées, suspension active.
- [ ] Arrêt d'urgence testé (fichier STOP et tableau de bord) : positions fermées, aucune nouvelle entrée.
- [ ] Aucune exception non gérée sur toute la période.

## D. Cadre réglementaire et pratique (France)
- [ ] Courtier présent sur le registre REGAFI / autorisé par l'AMF ou passeporté dans l'UE, absent des listes noires AMF.
- [ ] Compte client particulier avec protections ESMA (levier or 1:20, protection contre le solde négatif, clôture à 50 %).
- [ ] Trading algorithmique autorisé par les conditions du courtier ; VPS ou PC allumé en continu, heure synchronisée.
- [ ] Gains déclarés selon la fiscalité applicable (à vérifier auprès d'un professionnel).
