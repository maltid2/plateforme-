# Résultats mesurés — étude A — généré le 2026-10-19 08:29 UTC

Fichier produit par `python -m xauscalp research`. Aucune valeur n'est saisie à la main.
R = risque initial (entrée → stop, spread d'entrée inclus). E = espérance par trade.

## Données

| Fichier | Bougies | Début | Fin | Doublons | OHLC incohérents | Trous | Pics |
|---|---|---|---|---|---|---|---|
| xau_m1_2015.csv | 338425 | 2015-01-01 23:00 | 2015-12-31 21:59 | 0 | 0 | 269 | 42 |
| xau_m1_2016.csv | 338789 | 2016-01-03 23:00 | 2016-12-30 21:59 | 0 | 0 | 268 | 33 |
| xau_m1_2017.csv | 337395 | 2017-01-02 23:00 | 2017-12-29 21:58 | 0 | 0 | 266 | 29 |
| xau_m1_2018H1.csv | 157051 | 2018-01-01 23:00 | 2018-06-19 10:59 | 0 | 0 | 125 | 7 |
| dinesh.csv | 101023 | 2025-04-06 22:00 | 2026-09-17 09:00 | 0 | 0 | 144 | 15 |
| XAUUSD_1m.csv | 179662 | 2026-03-26 02:28 | 2026-09-25 20:44 | 0 | 0 | 35 | 8 |

## Coûts face au mouvement (spread moyen en $, ATR médian Londres + chevauchement)

| Année | Spread Asie | Londres | Chevauchement | NY après-midi | ATR M1 | ATR M5 | ATR M15 |
|---|---|---|---|---|---|---|---|
| 2015 | 0.314 | 0.293 | 0.286 | 0.303 | 0.373 | 0.885 | 1.394 |
| 2016 | 0.320 | 0.292 | 0.282 | 0.300 | 0.415 | 0.958 | 1.565 |
| 2017 | 0.245 | 0.231 | 0.229 | 0.237 | 0.295 | 0.668 | 1.078 |
| 2018 | 0.234 | 0.220 | 0.222 | 0.231 | 0.311 | 0.707 | 1.171 |

## Criblage sur le développement (Dév. 2015-16, coûts base) — 25 meilleures unités (n ≥ 100)

| Stratégie | TF | Session | Trades | E brut (zéro frais) | E net | PF | t | DD R | coût R/trade | stop médian $ |
|---|---|---|---|---|---|---|---|---|---|---|
| trend_pullback | M15 | overlap | 367 | +0.158 | +0.070 | 1.20 | +1.46 | 18.4 | +0.113 | 3.80 |
| asia_breakout+H1 | M15 | london | 148 | +0.118 | -0.009 | 0.98 | -0.11 | 12.1 | +0.123 | 3.54 |
| asia_breakout+H1 | M15 | overlap | 135 | +0.082 | -0.022 | 0.95 | -0.28 | 15.6 | +0.098 | 4.14 |
| asia_breakout | M15 | overlap | 244 | +0.057 | -0.043 | 0.90 | -0.73 | 18.9 | +0.097 | 4.35 |
| asia_breakout+H1 | M5 | overlap | 218 | +0.069 | -0.064 | 0.87 | -0.92 | 24.1 | +0.135 | 3.20 |
| squeeze_breakout | M15 | overlap | 199 | +0.043 | -0.079 | 0.86 | -1.03 | 20.9 | +0.155 | 2.70 |
| squeeze_breakout+H1 | M15 | overlap | 123 | +0.045 | -0.079 | 0.86 | -0.81 | 13.8 | +0.156 | 2.73 |
| donchian_breakout | M15 | overlap | 350 | +0.062 | -0.083 | 0.86 | -1.28 | 39.1 | +0.146 | 2.85 |
| ny_orb+H1 | M5 | overlap | 189 | +0.051 | -0.091 | 0.77 | -1.52 | 21.5 | +0.109 | 4.02 |
| inside_bar | M15 | overlap | 161 | +0.025 | -0.093 | 0.77 | -1.38 | 21.3 | +0.117 | 3.83 |
| asia_breakout | M15 | london | 255 | +0.015 | -0.094 | 0.78 | -1.67 | 26.6 | +0.123 | 3.50 |
| trend_pullback | M15 | london | 413 | +0.080 | -0.097 | 0.77 | -2.26 | 42.3 | +0.172 | 2.52 |
| ny_orb+H1 | M15 | overlap | 136 | -0.015 | -0.101 | 0.69 | -1.71 | 14.9 | +0.095 | 4.79 |
| rsi2_reversion | M15 | ny_pm | 444 | +0.044 | -0.103 | 0.63 | -4.01 | 50.1 | +0.149 | 2.87 |
| momentum_impulse+H1 | M15 | overlap | 235 | +0.091 | -0.106 | 0.78 | -1.83 | 26.5 | +0.230 | 1.75 |
| asia_breakout | M5 | overlap | 400 | +0.023 | -0.111 | 0.79 | -2.19 | 48.8 | +0.132 | 3.26 |
| rsi2_reversion | M15 | overlap | 453 | +0.025 | -0.115 | 0.70 | -3.42 | 53.0 | +0.141 | 2.83 |
| inside_bar | M15 | london | 130 | +0.084 | -0.130 | 0.74 | -1.51 | 20.4 | +0.202 | 2.11 |
| ny_orb | M15 | overlap | 274 | -0.045 | -0.131 | 0.61 | -3.24 | 37.6 | +0.093 | 4.74 |
| trend_pullback | M5 | overlap | 745 | +0.041 | -0.139 | 0.75 | -3.67 | 111.6 | +0.177 | 2.46 |
| donchian_breakout | M5 | overlap | 634 | +0.084 | -0.149 | 0.79 | -2.92 | 97.0 | +0.227 | 1.87 |
| ny_orb | M5 | overlap | 410 | -0.020 | -0.150 | 0.64 | -3.85 | 65.9 | +0.110 | 3.90 |
| asia_breakout | M15 | ny_pm | 112 | -0.032 | -0.154 | 0.57 | -2.45 | 17.5 | +0.117 | 4.13 |
| sweep_reversal+H1 | M15 | london | 107 | +0.149 | -0.155 | 0.74 | -1.41 | 17.4 | +0.304 | 1.40 |
| momentum_impulse | M15 | overlap | 524 | +0.049 | -0.161 | 0.68 | -4.19 | 84.4 | +0.226 | 1.77 |

Unités avec ≥ 100 trades : **159** ; positives AVANT frais : **80** ; positives APRÈS frais (base) : **1**.

| TF | Unités | E brut médiane | E net médiane | coût médian R/trade |
|---|---|---|---|---|
| M1 | 66 | -0.003 | -0.780 | +0.806 |
| M5 | 55 | -0.020 | -0.371 | +0.338 |
| M15 | 38 | +0.025 | -0.161 | +0.195 |

## Les 3 unités sélectionnées (règle fixée : meilleure E nette sur le développement, une par stratégie)

### trend_pullback — M15 — session overlap

| Période / coûts | Trades | Gagnants | E net | E brut | PF | DD (R) |
|---|---|---|---|---|---|---|
| Dév. 2015-16, zéro frais | 403 | 51% | +0.136 | +0.136 | 1.38 | 13.6 |
| Dév. 2015-16, base | 403 | 49% | +0.034 | +0.155 | 1.09 | 20.3 |
| **Validation 2017-18, zéro frais** | 321 | 44% | -0.012 | -0.012 | 0.97 | 19.3 |
| **Validation 2017-18, base** | 320 | 38% | -0.144 | -0.015 | 0.70 | 48.3 |
| Validation 2017-18, stress | 310 | 35% | -0.259 | -0.032 | 0.51 | 81.1 |
| Hold-out 2025-26 (M15 dinesh.csv@15m), base | 340 | 51% | +0.048 | +0.069 | 1.12 | 12.8 |
| Hold-out 2025-26, stress | 332 | 51% | +0.048 | +0.087 | 1.12 | 13.1 |

- Walk-forward (6 mois / 3 mois) : 569 trades, E net -0.084, fenêtres positives 42% (12 fenêtres).
- Grille de robustesse (développement) : 37% des 27 variantes positives.
- Monte-Carlo (validation) : P(total > 0) = 0%, drawdown 95e centile 73.8 R.
- Sans les 5 meilleurs trades (validation) : -53.5 R.
- Par régime (validation) : chaotic 92 tr. E -0.15, range 60 tr. E -0.27, trend 157 tr. E -0.09, volatile 11 tr. E -0.20
- Par sens (validation) : achat 178 tr. E -0.21, vente 142 tr. E -0.06

Faisabilité avec 100 € (risque 0,25 % = 0,25 €), spécifications d'EXEMPLE :

| Période / compte | Stop max au lot min ($) | Marge lot min (€) | Signaux exécutables | Trades pris | Refus | Capital final (€) |
|---|---|---|---|---|---|---|
| val/eu_retail | 0.00 | 55.12 | 0% | 0 | lot minimum 0.01: 455, annonce économique: 5 | 100.00 |
| val/eu_retail_micro | 2.60 | 5.51 | 41% | 151 | lot minimum 0.001: 231, annonce économique: 5 | 97.63 |
| val/cent | 28.70 | 0.02 | 100% | 77 | annonce économique: 5, suspendu : drawdown 5.16 % depuis le pic: 345 | 94.84 |
| holdout_2025_2026/eu_retail | 0.00 | 180.87 | 0% | 0 | lot minimum 0.01: 556, annonce économique: 16, volatilité anormale: 1 | 100.00 |
| holdout_2025_2026/eu_retail_micro | 2.60 | 18.09 | 0% | 0 | lot minimum 0.001: 556, annonce économique: 16, volatilité anormale: 1 | 100.00 |
| holdout_2025_2026/cent | 28.70 | 0.07 | 86% | 295 | annonce économique: 16, lot minimum 0.01: 76, volatilité anormale: 1 | 102.82 |

Critères pré-enregistrés (docs/CRITERES.md) :

- ❌ 1_val_exp>=0.05R_PF>=1.10_n>=100
- ❌ 2_sans_top5_>0
- ❌ 3_stress_exp>=0
- ❌ 4_dd<=15R
- ❌ 5_walkforward
- ❌ 6_montecarlo>=90%
- ❌ 7_grille>=60%
- ✅ 8_holdout_exp>0
- ❌ 9_faisable_100EUR>=80%
- ❌ candidate

### asia_breakout+H1 — M15 — session london

| Période / coûts | Trades | Gagnants | E net | E brut | PF | DD (R) |
|---|---|---|---|---|---|---|
| Dév. 2015-16, zéro frais | 175 | 48% | +0.073 | +0.073 | 1.19 | 9.8 |
| Dév. 2015-16, base | 175 | 39% | -0.046 | +0.077 | 0.89 | 18.0 |
| **Validation 2017-18, zéro frais** | 125 | 53% | +0.127 | +0.127 | 1.44 | 6.6 |
| **Validation 2017-18, base** | 125 | 45% | -0.014 | +0.118 | 0.96 | 9.8 |
| Validation 2017-18, stress | 123 | 37% | -0.120 | +0.111 | 0.70 | 19.4 |
| Hold-out 2025-26 (M15 dinesh.csv@15m), base | 96 | 51% | +0.078 | +0.095 | 1.31 | 6.6 |
| Hold-out 2025-26, stress | 96 | 50% | +0.066 | +0.097 | 1.25 | 6.9 |

- Walk-forward (6 mois / 3 mois) : 259 trades, E net -0.059, fenêtres positives 42% (12 fenêtres).
- Grille de robustesse (développement) : 0% des 27 variantes positives.
- Monte-Carlo (validation) : P(total > 0) = 42%, drawdown 95e centile 20.8 R.
- Sans les 5 meilleurs trades (validation) : -9.1 R.
- Par régime (validation) : chaotic 35 tr. E +0.16, range 26 tr. E -0.12, trend 64 tr. E -0.07
- Par sens (validation) : achat 69 tr. E +0.06, vente 56 tr. E -0.10

Faisabilité avec 100 € (risque 0,25 % = 0,25 €), spécifications d'EXEMPLE :

| Période / compte | Stop max au lot min ($) | Marge lot min (€) | Signaux exécutables | Trades pris | Refus | Capital final (€) |
|---|---|---|---|---|---|---|
| val/eu_retail | 0.00 | 55.19 | 0% | 0 | lot minimum 0.01: 154 | 100.00 |
| val/eu_retail_micro | 2.60 | 5.52 | 39% | 62 | lot minimum 0.001: 82 | 99.52 |
| val/cent | 28.70 | 0.02 | 100% | 125 | – | 100.40 |
| holdout_2025_2026/eu_retail | 0.00 | 177.13 | 0% | 0 | lot minimum 0.01: 122 | 100.00 |
| holdout_2025_2026/eu_retail_micro | 2.60 | 17.71 | 0% | 0 | lot minimum 0.001: 122 | 100.00 |
| holdout_2025_2026/cent | 28.70 | 0.07 | 81% | 80 | lot minimum 0.01: 21 | 101.56 |

Critères pré-enregistrés (docs/CRITERES.md) :

- ❌ 1_val_exp>=0.05R_PF>=1.10_n>=100
- ❌ 2_sans_top5_>0
- ❌ 3_stress_exp>=0
- ✅ 4_dd<=15R
- ❌ 5_walkforward
- ❌ 6_montecarlo>=90%
- ❌ 7_grille>=60%
- ✅ 8_holdout_exp>0
- ❌ 9_faisable_100EUR>=80%
- ❌ candidate

### squeeze_breakout — M15 — session overlap

| Période / coûts | Trades | Gagnants | E net | E brut | PF | DD (R) |
|---|---|---|---|---|---|---|
| Dév. 2015-16, zéro frais | 211 | 43% | +0.036 | +0.036 | 1.07 | 11.7 |
| Dév. 2015-16, base | 211 | 41% | -0.097 | +0.063 | 0.83 | 20.5 |
| **Validation 2017-18, zéro frais** | 153 | 46% | +0.055 | +0.055 | 1.11 | 14.4 |
| **Validation 2017-18, base** | 153 | 43% | -0.090 | +0.091 | 0.83 | 22.4 |
| Validation 2017-18, stress | 149 | 39% | -0.222 | +0.094 | 0.63 | 37.0 |
| Hold-out 2025-26 (M15 dinesh.csv@15m), base | 189 | 48% | +0.150 | +0.177 | 1.31 | 9.9 |
| Hold-out 2025-26, stress | 183 | 49% | +0.144 | +0.195 | 1.29 | 10.1 |

- Walk-forward (6 mois / 3 mois) : 389 trades, E net -0.102, fenêtres positives 50% (12 fenêtres).
- Grille de robustesse (développement) : 15% des 27 variantes positives.
- Monte-Carlo (validation) : P(total > 0) = 14%, drawdown 95e centile 39.1 R.
- Sans les 5 meilleurs trades (validation) : -21.3 R.
- Par régime (validation) : chaotic 48 tr. E -0.18, range 40 tr. E -0.19, trend 63 tr. E -0.00, volatile 2 tr. E +1.22
- Par sens (validation) : achat 76 tr. E -0.18, vente 77 tr. E -0.00

Faisabilité avec 100 € (risque 0,25 % = 0,25 €), spécifications d'EXEMPLE :

| Période / compte | Stop max au lot min ($) | Marge lot min (€) | Signaux exécutables | Trades pris | Refus | Capital final (€) |
|---|---|---|---|---|---|---|
| val/eu_retail | 0.00 | 54.98 | 0% | 0 | lot minimum 0.01: 236, annonce économique: 10 | 100.00 |
| val/eu_retail_micro | 2.60 | 5.50 | 84% | 138 | lot minimum 0.001: 26, annonce économique: 10 | 97.61 |
| val/cent | 28.70 | 0.02 | 100% | 153 | annonce économique: 10 | 97.63 |
| holdout_2025_2026/eu_retail | 0.00 | 187.01 | 0% | 0 | lot minimum 0.01: 293, annonce économique: 17 | 100.00 |
| holdout_2025_2026/eu_retail_micro | 2.60 | 18.70 | 0% | 0 | lot minimum 0.001: 293, annonce économique: 17 | 100.00 |
| holdout_2025_2026/cent | 28.70 | 0.07 | 96% | 181 | annonce économique: 17, lot minimum 0.01: 14 | 104.62 |

Critères pré-enregistrés (docs/CRITERES.md) :

- ❌ 1_val_exp>=0.05R_PF>=1.10_n>=100
- ❌ 2_sans_top5_>0
- ❌ 3_stress_exp>=0
- ❌ 4_dd<=15R
- ❌ 5_walkforward
- ❌ 6_montecarlo>=90%
- ❌ 7_grille>=60%
- ✅ 8_holdout_exp>0
- ✅ 9_faisable_100EUR>=80%
- ❌ candidate

## Moteur adaptatif (tendance → pullback, range → Bollinger, volatil/désordonné → rien)

| TF | Période | Trades | Gagnants | E net | E brut | PF | DD |
|---|---|---|---|---|---|---|---|
| M5 | dev | 1004 | 37% | -0.253 | +0.017 | 0.60 | 258.3 |
| M5 | val | 802 | 37% | -0.258 | +0.023 | 0.59 | 208.3 |
| M15 | dev | 462 | 41% | -0.081 | +0.077 | 0.82 | 47.3 |
| M15 | val | 399 | 38% | -0.127 | +0.044 | 0.72 | 53.0 |

## Méta-filtre statistique (régression logistique)

Appris sur le développement de trend_pullback M15 overlap, seuil = médiane des probabilités sur le développement, appliqué une fois à la validation.

| Validation | Trades | Gagnants | E net | E brut | PF | DD |
|---|---|---|---|---|---|---|
| tous les signaux | 320 | 38% | -0.144 | -0.015 | 0.70 | 48.3 |
| signaux filtrés | 137 | 36% | -0.194 | -0.063 | 0.62 | 30.9 |

## Verdict automatique

**Aucune unité ne remplit les 9 critères pré-enregistrés : pas de passage en démo ni en réel.**
