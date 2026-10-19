# Étude de faisabilité : scalping XAU/USD avec 100 €

Chiffres produits par `python -m xauscalp feasibility` (or à 4 300 $, EUR/USD 1,16) et par les études A et B
(reports/). Les spécifications de contrat ci-dessous sont des **exemples typiques** : la décision finale doit être prise
avec la spécification réelle exportée du courtier (`python -m xauscalp spec`).

## 1. Le risque autorisé est minuscule face au contrat

- Risque par trade : 0,25 % de 100 € = **0,25 €**. Perte journalière max : 1 €. Suspension à −5 € depuis le pic.
- Contrat CFD or standard : 1 lot = 100 onces, lot minimum 0,01 = **1 once** → chaque dollar de mouvement de l'or coûte
  environ **0,86 €** au lot minimum.
- Stop maximal compatible avec 0,25 € au lot minimum : 0,25 / 0,86 ≈ 0,29 $… **inférieur au seul spread** (0,20–0,35 $).
  Avec 1 % de risque (1 €), le stop maximal serait 0,86 $ : encore sous l'ATR d'une seule bougie M1 en 2026.

| Compte (exemple) | Perte par $ au lot min | Stop max à 0,25 € | Marge du lot min | Signaux exécutables* | Capital nécessaire (stop médian 9 $) |
|---|---|---|---|---|---|
| CFD UE régulé (1 lot = 100 oz, min 0,01, levier 1:20 ESMA) | 0,86 € | **0 $** | **185 €** (> capital) | **0 %** | **≈ 3 200 €** |
| CFD UE, lot min 0,001 (rare) | 0,09 € | 2,60 $ | 18,5 € | 0 % des stops de 3–14 $ | ≈ 320 € |
| Compte « cent » (1 lot = 1 oz, levier 1:500) | 0,009 € | 28,70 $ | 0,07 € | 100 % | ≈ 32 € |

\* part des distances de stop typiques (3, 6, 9, 14 $ en 2026) respectant 0,25 € de perte au lot minimum.

## 2. La marge seule bloque un compte UE régulé

Pour un client particulier, l'ESMA (reprise par l'AMF) limite le levier sur l'or à 1:20. Marge du lot minimum
(1 once × 4 300 $ / 20) ≈ 215 $ ≈ **185 €, soit plus que le capital**. Même sans aucune règle de risque, le bot ne
pourrait pas ouvrir la plus petite position chez un courtier régulé dans l'UE.

## 3. Les frais pèsent lourd en scalping (mesuré)

Coût moyen (spread + slippage + commission) exprimé en fraction du risque par trade, étude A (2015-2018, ticks bid/ask) :

| Unité de temps | Coût médian par trade | Espérance médiane AVANT frais | Espérance médiane APRÈS frais |
|---|---|---|---|
| M1 | **0,81 R** | −0,003 R | −0,780 R |
| M5 | 0,34 R | −0,020 R | −0,371 R |
| M15 | 0,20 R | +0,025 R | −0,161 R |

Plus le stop est court, plus le spread en mange une grande part. En 2025-2026 l'ATR de l'or a été multiplié par
4 à 6 pour un spread comparable, et le coût tombe à 0,03–0,07 R par trade (étude B). C'est ce qui rend le régime récent
plus favorable, pas une propriété durable de la stratégie (voir le rapport).

## 4. Comptes « cent » et réglementation en France

Un compte cent rend la taille de position compatible avec 100 €, mais ces comptes sont surtout proposés par des entités
**hors UE**, qui ne sont généralement pas autorisées à démarcher des clients résidant en France. Avant tout usage :

- vérifier le courtier sur le registre **REGAFI** et sur les **listes noires de l'AMF** ;
- s'assurer des protections d'un client particulier : levier limité, protection contre le solde négatif, clôture des
  positions à 50 % de marge ;
- ne jamais déposer de fonds chez une entité non autorisée, même pour « tester ».

## 5. Conclusion de faisabilité

1. **Avec 100 € chez un courtier régulé UE au contrat standard : impossible.** Le bot refusera tous les ordres, comme le
   cahier des charges l'exige (marge et risque au lot minimum).
2. Le scalping M1 est **économiquement non viable** avec les coûts mesurés (0,8 R par trade).
3. À 0,25 % de risque et 0,01 lot sur contrat standard, il faut **environ 3 000 € et plus** pour des stops de 6–14 $
   (M15 en 2026), environ 800 € à 1 % de risque.
4. Le projet reste donc **en simulation (paper) et en démo** : c'est le réglage par défaut (`mode: paper`,
   `live_enabled: false`).
