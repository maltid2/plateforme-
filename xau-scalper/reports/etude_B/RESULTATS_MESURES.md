# Résultats mesurés — étude B — généré le 2026-10-19 08:29 UTC

Fichier produit par `python -m xauscalp research`. Aucune valeur n'est saisie à la main.
R = risque initial (entrée → stop, spread d'entrée inclus). E = espérance par trade.

## Données

| Fichier | Bougies | Début | Fin | Doublons | OHLC incohérents | Trous | Pics |
|---|---|---|---|---|---|---|---|
| dinesh.csv | 101023 | 2025-04-06 22:00 | 2026-09-17 09:00 | 0 | 0 | 144 | 15 |

## Coûts face au mouvement (spread moyen en $, ATR médian Londres + chevauchement)

| Année | Spread Asie | Londres | Chevauchement | NY après-midi | ATR M1 | ATR M5 | ATR M15 |
|---|---|---|---|---|---|---|---|
| 2025 | 0.139 | 0.132 | 0.118 | 0.134 | – | 3.446 | 5.823 |
| 2026 | 0.059 | 0.055 | 0.050 | 0.054 | – | 5.692 | 9.623 |

## Criblage sur le développement (Dév. 2025-04 → 2025-12, coûts base) — 25 meilleures unités (n ≥ 100)

| Stratégie | TF | Session | Trades | E brut (zéro frais) | E net | PF | t | DD R | coût R/trade | stop médian $ |
|---|---|---|---|---|---|---|---|---|---|---|
| donchian_breakout | M15 | asia | 166 | +0.326 | +0.253 | 1.52 | +2.46 | 12.0 | +0.042 | 8.28 |
| donchian_breakout | M15 | overlap | 118 | +0.213 | +0.191 | 1.37 | +1.57 | 9.2 | +0.034 | 9.60 |
| asia_breakout | M5 | overlap | 114 | +0.153 | +0.107 | 1.24 | +1.05 | 6.8 | +0.027 | 13.24 |
| squeeze_breakout | M5 | asia | 228 | +0.151 | +0.057 | 1.10 | +0.72 | 22.7 | +0.082 | 4.16 |
| donchian_breakout | M5 | asia | 436 | +0.128 | +0.055 | 1.09 | +0.82 | 23.9 | +0.077 | 4.55 |
| squeeze_breakout | M5 | overlap | 112 | +0.108 | +0.048 | 1.09 | +0.43 | 7.7 | +0.057 | 5.85 |
| donchian_breakout | M5 | overlap | 248 | +0.101 | +0.044 | 1.07 | +0.50 | 15.3 | +0.054 | 6.01 |
| trend_pullback | M15 | ny_pm | 145 | +0.076 | +0.041 | 1.14 | +0.65 | 6.3 | +0.036 | 10.29 |
| inside_bar | M5 | overlap | 141 | +0.110 | +0.039 | 1.07 | +0.41 | 14.9 | +0.049 | 7.06 |
| ny_orb | M5 | overlap | 156 | +0.069 | +0.039 | 1.12 | +0.57 | 6.8 | +0.026 | 13.88 |
| rsi2_reversion | M15 | ny_pm | 152 | +0.075 | +0.035 | 1.16 | +0.79 | 10.3 | +0.033 | 10.01 |
| trend_pullback | M5 | overlap | 284 | +0.066 | +0.027 | 1.05 | +0.42 | 16.5 | +0.040 | 8.47 |
| trend_pullback | M15 | overlap | 151 | +0.030 | +0.009 | 1.02 | +0.12 | 8.7 | +0.024 | 13.27 |
| ny_orb | M15 | overlap | 113 | +0.031 | +0.004 | 1.02 | +0.07 | 4.0 | +0.022 | 16.31 |
| trend_pullback | M15 | asia | 290 | +0.036 | +0.003 | 1.01 | +0.05 | 18.5 | +0.037 | 9.83 |
| rsi2_reversion | M5 | ny_pm | 497 | +0.050 | -0.007 | 0.98 | -0.20 | 23.3 | +0.068 | 5.01 |
| trend_pullback | M5 | asia | 494 | +0.052 | -0.007 | 0.99 | -0.13 | 27.3 | +0.062 | 5.81 |
| inside_bar | M5 | asia | 250 | +0.065 | -0.009 | 0.98 | -0.12 | 17.7 | +0.075 | 4.82 |
| squeeze_breakout+H1 | M5 | asia | 104 | +0.100 | -0.025 | 0.96 | -0.21 | 16.6 | +0.084 | 4.16 |
| rsi2_reversion | M15 | overlap | 173 | -0.020 | -0.046 | 0.88 | -0.80 | 16.9 | +0.032 | 10.51 |
| rsi2_reversion | M15 | london | 176 | -0.010 | -0.051 | 0.84 | -1.01 | 19.4 | +0.040 | 7.95 |
| rsi2_reversion | M15 | asia | 332 | -0.007 | -0.055 | 0.83 | -1.50 | 26.0 | +0.042 | 7.96 |
| trend_pullback | M15 | london | 166 | -0.033 | -0.060 | 0.83 | -0.99 | 16.3 | +0.032 | 10.52 |
| inside_bar | M5 | london | 140 | -0.009 | -0.065 | 0.88 | -0.69 | 14.5 | +0.071 | 4.72 |
| trend_pullback | M5 | ny_pm | 281 | -0.009 | -0.066 | 0.87 | -1.09 | 25.6 | +0.062 | 5.97 |

Unités avec ≥ 100 trades : **41** ; positives AVANT frais : **21** ; positives APRÈS frais (base) : **15**.

| TF | Unités | E brut médiane | E net médiane | coût médian R/trade |
|---|---|---|---|---|
| M5 | 30 | -0.007 | -0.073 | +0.072 |
| M15 | 11 | +0.031 | +0.004 | +0.034 |

## Les 3 unités sélectionnées (règle fixée : meilleure E nette sur le développement, une par stratégie)

### donchian_breakout — M15 — session asia

| Période / coûts | Trades | Gagnants | E net | E brut | PF | DD (R) |
|---|---|---|---|---|---|---|
| Dév. 2025-04 → 2025-12, zéro frais | 173 | 49% | +0.316 | +0.316 | 1.67 | 9.6 |
| Dév. 2025-04 → 2025-12, base | 174 | 48% | +0.245 | +0.287 | 1.50 | 12.0 |
| **Validation 2026-01 → 2026-09, zéro frais** | 165 | 48% | +0.190 | +0.190 | 1.38 | 10.6 |
| **Validation 2026-01 → 2026-09, base** | 165 | 47% | +0.172 | +0.193 | 1.34 | 10.8 |
| Validation 2026-01 → 2026-09, stress | 163 | 47% | +0.150 | +0.191 | 1.30 | 10.7 |

- Walk-forward (6 mois / 3 mois) : 169 trades, E net +0.101, fenêtres positives 67% (3 fenêtres).
- Grille de robustesse (développement) : 100% des 27 variantes positives.
- Monte-Carlo (validation) : P(total > 0) = 96%, drawdown 95e centile 19.0 R.
- Sans les 5 meilleurs trades (validation) : +18.3 R.
- Par régime (validation) : chaotic 36 tr. E +0.11, range 39 tr. E +0.01, trend 85 tr. E +0.30, volatile 5 tr. E -0.25
- Par sens (validation) : achat 88 tr. E +0.24, vente 77 tr. E +0.09

Faisabilité avec 100 € (risque 0,25 % = 0,25 €), spécifications d'EXEMPLE :

| Période / compte | Stop max au lot min ($) | Marge lot min (€) | Signaux exécutables | Trades pris | Refus | Capital final (€) |
|---|---|---|---|---|---|---|
| val/eu_retail | 0.00 | 195.99 | 0% | 0 | lot minimum 0.01: 235 | 100.00 |
| val/eu_retail_micro | 2.60 | 19.60 | 0% | 0 | lot minimum 0.001: 235 | 100.00 |
| val/cent | 28.70 | 0.08 | 92% | 152 | lot minimum 0.01: 19 | 105.67 |

Critères pré-enregistrés (docs/CRITERES.md) :

- ✅ 1_val_exp>=0.05R_PF>=1.10_n>=100
- ✅ 2_sans_top5_>0
- ✅ 3_stress_exp>=0
- ✅ 4_dd<=15R
- ✅ 5_walkforward
- ✅ 6_montecarlo>=90%
- ✅ 7_grille>=60%
- ➖ non applicable 8_holdout_exp>0
- ❌ 9_faisable_100EUR>=80%
- ❌ candidate

### asia_breakout — M5 — session overlap

| Période / coûts | Trades | Gagnants | E net | E brut | PF | DD (R) |
|---|---|---|---|---|---|---|
| Dév. 2025-04 → 2025-12, zéro frais | 120 | 51% | +0.179 | +0.179 | 1.43 | 7.0 |
| Dév. 2025-04 → 2025-12, base | 121 | 50% | +0.134 | +0.161 | 1.31 | 7.5 |
| **Validation 2026-01 → 2026-09, zéro frais** | 131 | 50% | +0.104 | +0.104 | 1.24 | 7.3 |
| **Validation 2026-01 → 2026-09, base** | 131 | 50% | +0.092 | +0.107 | 1.21 | 7.5 |
| Validation 2026-01 → 2026-09, stress | 129 | 49% | +0.069 | +0.097 | 1.16 | 7.7 |

- Walk-forward (6 mois / 3 mois) : 143 trades, E net -0.005, fenêtres positives 33% (3 fenêtres).
- Grille de robustesse (développement) : 100% des 27 variantes positives.
- Monte-Carlo (validation) : P(total > 0) = 83%, drawdown 95e centile 18.9 R.
- Sans les 5 meilleurs trades (validation) : +4.5 R.
- Par régime (validation) : chaotic 49 tr. E -0.08, range 25 tr. E +0.18, trend 44 tr. E +0.20, volatile 13 tr. E +0.24
- Par sens (validation) : achat 71 tr. E -0.03, vente 60 tr. E +0.24

Faisabilité avec 100 € (risque 0,25 % = 0,25 €), spécifications d'EXEMPLE :

| Période / compte | Stop max au lot min ($) | Marge lot min (€) | Signaux exécutables | Trades pris | Refus | Capital final (€) |
|---|---|---|---|---|---|---|
| val/eu_retail | 0.00 | 197.73 | 0% | 0 | lot minimum 0.01: 182, annonce économique: 11 | 100.00 |
| val/eu_retail_micro | 2.60 | 19.77 | 0% | 0 | lot minimum 0.001: 182, annonce économique: 11 | 100.00 |
| val/cent | 28.70 | 0.08 | 78% | 103 | annonce économique: 11, lot minimum 0.01: 41 | 100.18 |

Critères pré-enregistrés (docs/CRITERES.md) :

- ✅ 1_val_exp>=0.05R_PF>=1.10_n>=100
- ✅ 2_sans_top5_>0
- ✅ 3_stress_exp>=0
- ✅ 4_dd<=15R
- ❌ 5_walkforward
- ❌ 6_montecarlo>=90%
- ✅ 7_grille>=60%
- ➖ non applicable 8_holdout_exp>0
- ❌ 9_faisable_100EUR>=80%
- ❌ candidate

### squeeze_breakout — M5 — session asia

| Période / coûts | Trades | Gagnants | E net | E brut | PF | DD (R) |
|---|---|---|---|---|---|---|
| Dév. 2025-04 → 2025-12, zéro frais | 234 | 46% | +0.143 | +0.143 | 1.26 | 16.0 |
| Dév. 2025-04 → 2025-12, base | 233 | 44% | +0.044 | +0.128 | 1.08 | 26.9 |
| **Validation 2026-01 → 2026-09, zéro frais** | 262 | 39% | -0.023 | -0.023 | 0.96 | 27.5 |
| **Validation 2026-01 → 2026-09, base** | 262 | 38% | -0.073 | -0.029 | 0.88 | 38.0 |
| Validation 2026-01 → 2026-09, stress | 258 | 38% | -0.109 | -0.026 | 0.83 | 41.8 |

- Walk-forward (6 mois / 3 mois) : 143 trades, E net +0.246, fenêtres positives 100% (3 fenêtres).
- Grille de robustesse (développement) : 74% des 27 variantes positives.
- Monte-Carlo (validation) : P(total > 0) = 17%, drawdown 95e centile 56.4 R.
- Sans les 5 meilleurs trades (validation) : -26.6 R.
- Par régime (validation) : chaotic 84 tr. E -0.05, range 66 tr. E -0.12, trend 110 tr. E -0.06, volatile 2 tr. E +0.25
- Par sens (validation) : achat 125 tr. E -0.04, vente 137 tr. E -0.10

Faisabilité avec 100 € (risque 0,25 % = 0,25 €), spécifications d'EXEMPLE :

| Période / compte | Stop max au lot min ($) | Marge lot min (€) | Signaux exécutables | Trades pris | Refus | Capital final (€) |
|---|---|---|---|---|---|---|
| val/eu_retail | 0.00 | 194.77 | 0% | 0 | lot minimum 0.01: 448 | 100.00 |
| val/eu_retail_micro | 2.60 | 19.48 | 0% | 0 | lot minimum 0.001: 448 | 100.00 |
| val/cent | 28.70 | 0.08 | 99% | 238 | lot minimum 0.01: 4, suspendu : drawdown 5.02 % depuis le pic: 36 | 97.69 |

Critères pré-enregistrés (docs/CRITERES.md) :

- ❌ 1_val_exp>=0.05R_PF>=1.10_n>=100
- ❌ 2_sans_top5_>0
- ❌ 3_stress_exp>=0
- ❌ 4_dd<=15R
- ✅ 5_walkforward
- ❌ 6_montecarlo>=90%
- ✅ 7_grille>=60%
- ➖ non applicable 8_holdout_exp>0
- ❌ 9_faisable_100EUR>=80%
- ❌ candidate

## Moteur adaptatif (tendance → pullback, range → Bollinger, volatil/désordonné → rien)

| TF | Période | Trades | Gagnants | E net | E brut | PF | DD |
|---|---|---|---|---|---|---|---|
| M5 | dev | 382 | 44% | -0.003 | +0.057 | 0.99 | 21.9 |
| M5 | val | 400 | 36% | -0.152 | -0.118 | 0.75 | 64.2 |
| M15 | dev | 191 | 46% | -0.051 | -0.020 | 0.87 | 16.0 |
| M15 | val | 211 | 47% | -0.011 | +0.008 | 0.97 | 21.5 |

## Méta-filtre statistique (régression logistique)

Appris sur le développement de donchian_breakout M15 asia, seuil = médiane des probabilités sur le développement, appliqué une fois à la validation.

| Validation | Trades | Gagnants | E net | E brut | PF | DD |
|---|---|---|---|---|---|---|
| tous les signaux | 165 | 47% | +0.172 | +0.193 | 1.34 | 10.8 |
| signaux filtrés | 142 | 48% | +0.186 | +0.208 | 1.37 | 9.1 |

## Verdict automatique

**Aucune unité ne remplit les 9 critères pré-enregistrés : pas de passage en démo ni en réel.**
