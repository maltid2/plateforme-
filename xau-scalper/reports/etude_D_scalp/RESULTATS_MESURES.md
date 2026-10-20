# Étude D — scalp agressif multi-positions — généré le 2026-10-20 07:53 UTC

Jusqu'à 3 positions en même temps, une nouvelle entrée par bougie au maximum, sessions Londres + chevauchement.
E = espérance nette par trade en R (risque initial). Coûts « base » : spread réel (plancher 0,20 $), commission 0,05 $/once, slippage 0,03 $ (entrée) / 0,05 $ (stop).

## Spread face au mouvement

| Données | Spread moyen | ATR médian de la bougie | Spread / ATR |
|---|---|---|---|
| S10 2018-S1 (ticks) | 0.221 $ | 0.105 $ | 210% |
| M1 2017-18 (ticks) | 0.227 $ | 0.300 $ | 76% |
| M1 2026 | 0.075 $ | 2.387 $ | 3% |

## Criblage sur le développement

| Données | Stratégie | Durée max | Trades | E avant frais | E après frais |
|---|---|---|---|---|---|
| S10 2018-S1 (ticks) | micro_momentum | 1 min | 5542 | -0.009 | -2.656 |
| S10 2018-S1 (ticks) | micro_momentum | 3 min | 5542 | -0.010 | -2.656 |
| S10 2018-S1 (ticks) | micro_momentum | 5 min | 5542 | -0.009 | -2.655 |
| S10 2018-S1 (ticks) | micro_reversion | 1 min | 5300 | +0.169 | -1.729 |
| S10 2018-S1 (ticks) | micro_reversion | 3 min | 5281 | +0.184 | -1.727 |
| S10 2018-S1 (ticks) | micro_reversion | 5 min | 5281 | +0.183 | -1.726 |
| S10 2018-S1 (ticks) | micro_breakout | 1 min | 6604 | +0.029 | -2.544 |
| S10 2018-S1 (ticks) | micro_breakout | 3 min | 6603 | +0.016 | -2.545 |
| S10 2018-S1 (ticks) | micro_breakout | 5 min | 6603 | +0.015 | -2.545 |
| S10 2018-S1 (ticks) | micro_sweep | 1 min | 2932 | +0.033 | -2.365 |
| S10 2018-S1 (ticks) | micro_sweep | 3 min | 2932 | +0.037 | -2.364 |
| S10 2018-S1 (ticks) | micro_sweep | 5 min | 2932 | +0.038 | -2.362 |
| M1 2017-18 (ticks) | micro_momentum | 1 min | 4881 | -0.063 | -0.949 |
| M1 2017-18 (ticks) | micro_momentum | 3 min | 4881 | -0.071 | -0.955 |
| M1 2017-18 (ticks) | micro_momentum | 5 min | 4881 | -0.073 | -0.952 |
| M1 2017-18 (ticks) | micro_reversion | 1 min | 2215 | +0.038 | -0.554 |
| M1 2017-18 (ticks) | micro_reversion | 3 min | 2215 | +0.054 | -0.548 |
| M1 2017-18 (ticks) | micro_reversion | 5 min | 2195 | +0.046 | -0.557 |
| M1 2017-18 (ticks) | micro_breakout | 1 min | 4774 | -0.025 | -0.874 |
| M1 2017-18 (ticks) | micro_breakout | 3 min | 4774 | -0.044 | -0.885 |
| M1 2017-18 (ticks) | micro_breakout | 5 min | 4774 | -0.052 | -0.882 |
| M1 2017-18 (ticks) | micro_sweep | 1 min | 2223 | +0.012 | -0.830 |
| M1 2017-18 (ticks) | micro_sweep | 3 min | 2223 | +0.048 | -0.835 |
| M1 2017-18 (ticks) | micro_sweep | 5 min | 2223 | +0.041 | -0.838 |
| M1 2026 | micro_momentum | 1 min | 1921 | -0.060 | -0.170 |
| M1 2026 | micro_momentum | 3 min | 1921 | -0.071 | -0.179 |
| M1 2026 | micro_momentum | 5 min | 1921 | -0.080 | -0.188 |
| M1 2026 | micro_reversion | 1 min | 514 | +0.026 | -0.053 |
| M1 2026 | micro_reversion | 3 min | 514 | +0.089 | +0.013 |
| M1 2026 | micro_reversion | 5 min | 510 | +0.100 | +0.026 |
| M1 2026 | micro_breakout | 1 min | 1805 | -0.026 | -0.137 |
| M1 2026 | micro_breakout | 3 min | 1805 | -0.037 | -0.153 |
| M1 2026 | micro_breakout | 5 min | 1805 | -0.064 | -0.178 |
| M1 2026 | micro_sweep | 1 min | 1007 | +0.023 | -0.088 |
| M1 2026 | micro_sweep | 3 min | 1007 | +0.038 | -0.069 |
| M1 2026 | micro_sweep | 5 min | 1007 | +0.039 | -0.070 |

Variantes positives avant frais : **21/36** ; après frais : **2/36**.

## Validation (une seule fois) de la meilleure variante de chaque jeu de données

### S10 2018-S1 (ticks) — micro_reversion, durée max 5 min

| Coûts | Trades | Gagnants | E net | PF | DD (R) |
|---|---|---|---|---|---|
| zero | 6264 | 41% | +0.162 | 1.27 | 94.4 |
| base | 5078 | 13% | -1.833 | 0.03 | 9309.3 |
| stress | 3883 | 5% | -2.565 | 0.01 | 9960.3 |

Compte cent 100 €, ~1 € de risque par position, 3 positions max : **30 trades, capital final 79.72 €**, pire baisse 20.3 %, durée médiane d'un trade 0 s, risque médian par trade (1 R) 0.43 €. Refus : perte journalière >= 5.0 % 365, niveaux invalides 5, suspendu : drawdown 20.28 % depuis le pic 6068, annonce 59.

### M1 2017-18 (ticks) — micro_reversion, durée max 3 min

| Coûts | Trades | Gagnants | E net | PF | DD (R) |
|---|---|---|---|---|---|
| zero | 2048 | 53% | +0.022 | 1.07 | 44.8 |
| base | 2041 | 19% | -0.560 | 0.10 | 1143.2 |
| stress | 1912 | 8% | -0.899 | 0.02 | 1718.6 |

Compte cent 100 €, ~1 € de risque par position, 3 positions max : **58 trades, capital final 79.32 €**, pire baisse 20.7 %, durée médiane d'un trade 120 s, risque médian par trade (1 R) 0.67 €. Refus : perte journalière >= 5.0 % 9, annonce 30, suspendu : drawdown 20.68 % depuis le pic 1981.

### M1 2026 — micro_reversion, durée max 5 min

| Coûts | Trades | Gagnants | E net | PF | DD (R) |
|---|---|---|---|---|---|
| zero | 560 | 48% | +0.027 | 1.07 | 23.7 |
| base | 560 | 45% | -0.069 | 0.84 | 54.5 |
| stress | 536 | 42% | -0.151 | 0.68 | 84.4 |

Compte cent 100 €, ~1 € de risque par position, 3 positions max : **109 trades, capital final 79.88 €**, pire baisse 20.4 %, durée médiane d'un trade 240 s, risque médian par trade (1 R) 0.84 €. Refus : annonce 23, perte journalière >= 5.0 % 4, suspendu : drawdown 20.43 % depuis le pic 447.

