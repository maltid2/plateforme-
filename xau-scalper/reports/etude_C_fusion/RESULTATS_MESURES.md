# Étude C — fusion des trois robots — généré le 2026-10-19 10:50 UTC

Valeurs mesurées par `python -m xauscalp fusion`. R = risque initial. E = espérance nette par trade.

## Chaque robot seul (coûts base)

| Robot | Période | Trades | Gagnants | E net | E brut | PF | DD (R) |
|---|---|---|---|---|---|---|---|
| R2 liquidité (ancien robot 2) | A dév. 2015-16 | 37 | 43% | +0.238 | +0.370 | 1.41 | 4.3 |
| R2 liquidité (ancien robot 2) | A valid. 2017-18 | 19 | 37% | +0.140 | +0.269 | 1.21 | 7.3 |
| R2 liquidité (ancien robot 2) | B dév. 2025 | 18 | 50% | +0.571 | +0.600 | 2.22 | 2.0 |
| R2 liquidité (ancien robot 2) | B valid. 2026 | 17 | 29% | -0.027 | -0.012 | 0.96 | 4.2 |
| R3 Donchian M15 Asie (nouveau) | A dév. 2015-16 | 302 | 34% | -0.262 | +0.006 | 0.61 | 81.7 |
| R3 Donchian M15 Asie (nouveau) | A valid. 2017-18 | 256 | 36% | -0.233 | +0.005 | 0.62 | 64.7 |
| R3 Donchian M15 Asie (nouveau) | B dév. 2025 | 174 | 48% | +0.245 | +0.287 | 1.50 | 12.0 |
| R3 Donchian M15 Asie (nouveau) | B valid. 2026 | 165 | 47% | +0.172 | +0.193 | 1.34 | 10.8 |
| R1 méthode du PDF (ancien robot 1) | A dév. 2015-16 | 201 | 22% | -0.226 | +0.050 | 0.67 | 48.3 |
| R1 méthode du PDF (ancien robot 1) | A valid. 2017-18 | 149 | 18% | -0.298 | -0.000 | 0.57 | 54.7 |
| R1 méthode du PDF (ancien robot 1) | B dév. 2025 | 87 | 18% | -0.164 | -0.108 | 0.75 | 16.9 |
| R1 méthode du PDF (ancien robot 1) | B valid. 2026 | 77 | 23% | -0.119 | -0.084 | 0.82 | 14.7 |

Membres retenus par la règle (E nette > 0 sur B dév. 2025) : **R2, R3**

## Ensemble « tous » (une position à la fois)

| Période | Coûts | Trades | Gagnants | E net | E brut | PF | DD (R) |
|---|---|---|---|---|---|---|---|
| A dév. 2015-16 | zero | 521 | 33% | +0.006 | +0.006 | 1.01 | 29.8 |
| A dév. 2015-16 | base | 523 | 30% | -0.242 | +0.021 | 0.65 | 129.8 |
| A dév. 2015-16 | stress | 505 | 27% | -0.416 | +0.012 | 0.46 | 212.9 |
| A valid. 2017-18 | zero | 406 | 34% | +0.029 | +0.029 | 1.05 | 24.5 |
| A valid. 2017-18 | base | 412 | 30% | -0.239 | +0.015 | 0.63 | 100.6 |
| A valid. 2017-18 | stress | 399 | 28% | -0.418 | +0.029 | 0.44 | 168.1 |
| B dév. 2025 | zero | 269 | 39% | +0.149 | +0.149 | 1.28 | 14.9 |
| B dév. 2025 | base | 270 | 37% | +0.090 | +0.136 | 1.16 | 17.6 |
| B dév. 2025 | stress | 265 | 38% | +0.065 | +0.152 | 1.12 | 18.3 |
| B valid. 2026 | zero | 250 | 40% | +0.105 | +0.105 | 1.19 | 14.7 |
| B valid. 2026 | base | 252 | 40% | +0.085 | +0.110 | 1.15 | 15.0 |
| B valid. 2026 | stress | 250 | 40% | +0.063 | +0.110 | 1.11 | 16.1 |

## Ensemble « sélection » (une position à la fois)

| Période | Coûts | Trades | Gagnants | E net | E brut | PF | DD (R) |
|---|---|---|---|---|---|---|---|
| A dév. 2015-16 | zero | 335 | 41% | +0.073 | +0.073 | 1.13 | 13.1 |
| A dév. 2015-16 | base | 337 | 35% | -0.202 | +0.051 | 0.70 | 72.5 |
| A dév. 2015-16 | stress | 321 | 32% | -0.360 | +0.033 | 0.51 | 118.3 |
| A valid. 2017-18 | zero | 267 | 42% | +0.060 | +0.060 | 1.11 | 13.7 |
| A valid. 2017-18 | base | 269 | 36% | -0.200 | +0.031 | 0.68 | 60.1 |
| A valid. 2017-18 | stress | 262 | 32% | -0.373 | +0.031 | 0.47 | 100.4 |
| B dév. 2025 | zero | 188 | 49% | +0.328 | +0.328 | 1.69 | 9.2 |
| B dév. 2025 | base | 189 | 48% | +0.261 | +0.301 | 1.53 | 11.5 |
| B dév. 2025 | stress | 186 | 47% | +0.221 | +0.297 | 1.44 | 11.8 |
| B valid. 2026 | zero | 180 | 46% | +0.171 | +0.171 | 1.33 | 11.7 |
| B valid. 2026 | base | 180 | 46% | +0.153 | +0.174 | 1.30 | 11.9 |
| B valid. 2026 | stress | 178 | 46% | +0.132 | +0.172 | 1.25 | 11.9 |

## Liquidité exécutée en M1 (2026-03 → 2026-09)

| Coûts | Trades | Gagnants | E net | E brut | PF | DD |
|---|---|---|---|---|---|---|
| base | 16 | 38% | +0.227 | +0.246 | 1.36 | 7.0 |
| stress | 16 | 38% | +0.209 | +0.245 | 1.33 | 7.1 |

## Robustesse et stabilité (ensemble sélectionné)

- Grille de paramètres (B dév., part des variantes positives avec ≥ 30 trades, critère 7) : R2 0%, R3 100%
- Information (pas un critère) : variantes positives sans minimum de trades : R2 100% (trades médians 17), R3 100% (trades médians 174)
- Monte-Carlo validation 2026 : P(total > 0) = 94%, drawdown 95e centile 21.7 R
- Par robot (validation 2026) : donchian_breakout 163 tr. E +0.172, liquidity_mss 17 tr. E -0.027

| Trimestre | Trades | E net | Total R |
|---|---|---|---|
| 2025-T2 | 57 | +0.409 | +23.3 |
| 2025-T3 | 61 | +0.065 | +3.9 |
| 2025-T4 | 71 | +0.309 | +22.0 |
| 2026-T1 | 59 | +0.438 | +25.8 |
| 2026-T2 | 67 | +0.096 | +6.4 |
| 2026-T3 | 54 | -0.087 | -4.7 |

## Compte de 100 € (simulation)

| Ensemble | Période | Compte | Risque/trade | Trades pris | Refus | Capital final | Pire baisse |
|---|---|---|---|---|---|---|---|
| tous | A valid. 2017-18 | cent | 0.25 % | 70 | suspendu : drawdown 5.00 % depuis le pic: 342 | 95.20 € | 5.0 % |
| tous | A valid. 2017-18 | eu_retail | 0.25 % | 0 | lot minimum 0.01: 410, marge 54.31 > 50% de la marge libre 100.00: 2 | 100.00 € | 0.0 % |
| tous | A valid. 2017-18 | cent | 1.0 % | 31 | perte journalière >= 1.0 %: 2, suspendu : drawdown 5.05 % depuis le pic: 379 | 95.78 € | 5.1 % |
| tous | A valid. 2017-18 | eu_retail | 1.0 % | 0 | lot minimum 0.01: 346, marge 54.31 > 50% de la marge libre 100.00: 64, marge 217.24 > 50% de la marge libre 100.00: 1, marge 380.17 > 50% de la marge libre 100.00: 1 | 100.00 € | 0.0 % |
| tous | B valid. 2026 | cent | 0.25 % | 236 | lot minimum 0.01: 16 | 104.48 € | 2.7 % |
| tous | B valid. 2026 | eu_retail | 0.25 % | 0 | lot minimum 0.01: 252 | 100.00 € | 0.0 % |
| tous | B valid. 2026 | cent | 1.0 % | 94 | perte journalière >= 1.0 %: 2, suspendu : drawdown 5.31 % depuis le pic: 156 | 124.81 € | 5.3 % |
| tous | B valid. 2026 | eu_retail | 1.0 % | 0 | lot minimum 0.01: 252 | 100.00 € | 0.0 % |
| tous | B dév. 2025 | cent | 0.25 % | 270 | – | 104.36 € | 4.1 % |
| tous | B dév. 2025 | eu_retail | 0.25 % | 0 | lot minimum 0.01: 270 | 100.00 € | 0.0 % |
| tous | B dév. 2025 | cent | 1.0 % | 54 | perte journalière >= 1.0 %: 3, suspendu : drawdown 5.06 % depuis le pic: 213 | 112.30 € | 5.1 % |
| tous | B dév. 2025 | eu_retail | 1.0 % | 0 | lot minimum 0.01: 270 | 100.00 € | 0.0 % |
| sélection | A valid. 2017-18 | cent | 0.25 % | 58 | suspendu : drawdown 5.21 % depuis le pic: 211 | 95.60 € | 5.2 % |
| sélection | A valid. 2017-18 | eu_retail | 0.25 % | 0 | lot minimum 0.01: 267, marge 54.31 > 50% de la marge libre 100.00: 2 | 100.00 € | 0.0 % |
| sélection | A valid. 2017-18 | cent | 1.0 % | 27 | perte journalière >= 1.0 %: 1, suspendu : drawdown 5.73 % depuis le pic: 241 | 98.58 € | 5.7 % |
| sélection | A valid. 2017-18 | eu_retail | 1.0 % | 0 | lot minimum 0.01: 254, marge 54.31 > 50% de la marge libre 100.00: 13, marge 217.24 > 50% de la marge libre 100.00: 1, marge 380.17 > 50% de la marge libre 100.00: 1 | 100.00 € | 0.0 % |
| sélection | B valid. 2026 | cent | 0.25 % | 164 | lot minimum 0.01: 16 | 105.51 € | 2.2 % |
| sélection | B valid. 2026 | eu_retail | 0.25 % | 0 | lot minimum 0.01: 180 | 100.00 € | 0.0 % |
| sélection | B valid. 2026 | cent | 1.0 % | 65 | suspendu : drawdown 5.33 % depuis le pic: 115 | 119.30 € | 5.3 % |
| sélection | B valid. 2026 | eu_retail | 1.0 % | 0 | lot minimum 0.01: 180 | 100.00 € | 0.0 % |
| sélection | B dév. 2025 | cent | 0.25 % | 189 | – | 109.91 € | 2.5 % |
| sélection | B dév. 2025 | eu_retail | 0.25 % | 0 | lot minimum 0.01: 189 | 100.00 € | 0.0 % |
| sélection | B dév. 2025 | cent | 1.0 % | 77 | suspendu : drawdown 5.19 % depuis le pic: 112 | 124.52 € | 5.2 % |
| sélection | B dév. 2025 | eu_retail | 1.0 % | 0 | lot minimum 0.01: 189 | 100.00 € | 0.0 % |

## Critères (ensemble sélectionné, validation 2026)

- ✅ 1_val_exp>=0.05R_PF>=1.10_n>=100
- ✅ 2_sans_top5_>0
- ✅ 3_stress_exp>=0
- ✅ 4_dd<=15R
- ✅ 5_trimestres_positifs>=50%
- ✅ 6_montecarlo>=90%
- ❌ 7_grille>=60%_chaque_membre
- ✅ 9_faisable_compte_cent>=80%
- ❌ info_A_val_non_negative
- ❌ candidate
