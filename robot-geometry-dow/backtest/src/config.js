'use strict';

// Paramètres par défaut du robot « Geometry Market Mastery ».
// Les distances ci-dessous sont en « POINTS MÉTHODE » : les valeurs du PDF, écrites pour le
// Dow Jones (SL 5 / 20 / 30 pts, TP 30 pts...). Chaque marché les convertit en prix avec
// son échelle (pointScale) : Dow 1 point = 1.0 ; or 1 point = 0,40 $. Calibré sur les vrais cours
// XAUUSD M5 de février à mai 2026 : bougie M15 médiane ~10 $ (contre ~25-30 pts pour le Dow). Les mêmes noms (préfixés « Inp ») existent dans l'EA.

const base = {
  // --- Horaires (heure de Paris) -------------------------------------------
  // Décalage heure serveur du broker - heure de Paris (souvent +1 : serveur UTC+2/+3).
  serverMinusParisHours: 1,
  sessions: [
    { start: '10:00', end: '13:30' }, // avant l'ouverture US
    { start: '18:00', end: '20:00' },
    { start: '21:30', end: '23:00' }, // après la clôture de Wall Street
  ],
  // « Sniper pendant max deux heures et arrêter pour la journée »
  maxMinutesAfterFirstTrade: 120,

  // --- Étape 1 : type de trade (range ou impulsion) --------------------------
  regimeLookback: 24,        // bougies M15 analysées (6 h)
  rangeEfficiencyMax: 0.3,   // efficacité directionnelle < 0.3 => range
  rangeMinSL: 5,             // SL mini en range serré (faible volatilité)
  wideRangeSize: 100,        // au-delà de cette amplitude, un range est « large »
  wideRangeMinSL: 30,        // SL mini dans un range large (ex. range de 160 pts => 30 pts)
  impulseMinSL: 20,          // en impulsion : « pas 5 points mais au moins 20 »
  maxSL: 40,                 // au-delà, on ne trade pas (setup trop loin)
  slBuffer: 2,               // marge sous/au-dessus des mèches (anti stop hunt)

  // --- Étape 2 : zones clés M15 (supply / demand / S/R/P) ------------------
  pivotStrength: 2,          // bougies de chaque côté pour valider un point haut/bas
  zoneLookback: 96,          // 96 x M15 = 24 h
  minZoneHeight: 4,
  zoneTolerance: 3,          // tolérance de contact avec la zone

  // --- Étape 3 : géométrie de marché (AB=CD, U, N) --------------------------
  abcdMinRatio: 0.75,
  abcdMaxRatio: 1.3,
  requireGeometry: false,    // true = n'entrer que si AB=CD est complété
  targetMargin: 2,           // on vise juste avant la zone opposée
  minRR: 1.5,

  // --- Étape 4 : mèches de rejet M15 ----------------------------------------
  wickLookback: 3,           // bougies M15 récentes où chercher le rejet
  wickRatio: 0.4,            // mèche >= 40 % de la bougie
  bigWickRatio: 0.6,         // exception « grande mèche + avalement »
  minWicks: 1,
  requireStopHunt: false,

  // --- Étape 5 : confirmations M5 ------------------------------------------
  volumeMaPeriod: 20,
  volumeFactor: 1.0,         // volume >= moyenne => « volume acheteur/vendeur »
  maxEntryDistance: 15,      // pas d'entrée sur une simple accélération du prix

  // --- Mode « achat/vente rapide » (SL 5 / TP 30) ---------------------------
  quickMode: false,
  quickSL: 5,
  quickTP: 30,

  // --- Gestion de position --------------------------------------------------
  breakEvenAtR: 1.0,         // à +1R, le stop passe au prix d'entrée
  breakEvenLock: 1,
  trailing: true,            // stop suiveur (ne fait QUE resserrer)

  // --- Money management & psychologie --------------------------------------
  riskPercent: 1.0,
  maxTradesPerDay: 3,
  maxLossesPerDay: 2,
  pauseAfterLossMinutes: 120, // « prends 2 h de pause »
  maxDailyLossPercent: 3,

  // --- Filtre anti-news : pas d'entrée si la dernière M15 dépasse cette amplitude
  maxM15Range: 0,            // 0 = désactivé

  // --- Vendredi soir (heure de Paris) : '' = désactivé
  fridayLastEntry: '',       // plus de nouvelle entrée après cette heure
  fridayClose: '',           // clôture forcée avant le week-end

  // --- Taille de position (backtest en argent réel : --capital=90) --------
  capital: 0,                // 0 = résultats en R / % (sans contrainte de lot)
  contractSize: 1,           // unités par lot (or : 100 onces)
  minLot: 0.01,
  lotStep: 0.01,
  maxRiskPercentMinLot: 5,   // petit compte : lot minimum accepté si la perte au stop <= 5 %

  // --- Backtest ------------------------------------------------------------
  startTime: 0,              // heure serveur (ms) avant laquelle on n'entre pas (chauffe)
  spread: 2,
  initialBalance: 10000,
};

// Modes de trading.
const modes = {
  // Méthode du PDF : créneaux du marché, 2 h max après la 1re entrée, 3 trades/jour.
  methode: {},
  // H24 : toute la journée, hors rollover (22:45-01:00 Paris : spreads très larges).
  // Les garde-fous restent : pause 2 h après une perte, 2 pertes max, -10 % max par jour.
  h24: {
    sessions: [{ start: '01:00', end: '22:45' }],
    maxMinutesAfterFirstTrade: 0,
    maxTradesPerDay: 6,
    maxLossesPerDay: 2,
    maxDailyLossPercent: 10,
    fridayLastEntry: '21:00',
    fridayClose: '22:30',
  },
};

// Distances converties en prix selon le marché.
const DISTANCES = [
  'rangeMinSL', 'wideRangeSize', 'wideRangeMinSL', 'impulseMinSL', 'maxSL', 'slBuffer',
  'minZoneHeight', 'zoneTolerance', 'targetMargin', 'maxEntryDistance', 'quickSL', 'quickTP',
  'breakEvenLock', 'maxM15Range',
];

const markets = {
  gold: {
    label: 'Or (XAUUSD)',
    unit: '$',
    pointScale: 0.4,
    spread: 0.3, // en $, déjà en prix (non converti)
    contractSize: 100, // 1 lot = 100 onces : 0,01 lot = 1 $ par dollar de mouvement
    defaultMode: 'h24',
    // Or : Londres puis New York, en évitant le pic des stats US de 14:30.
    sessions: [
      { start: '09:00', end: '12:00' }, // ouverture de Londres
      { start: '14:45', end: '18:00' }, // chevauchement Londres / New York
    ],
    maxM15Range: 60, // = 24 $ : bougie M15 de news (~2x la moyenne), on ne court pas après
  },
  dow: {
    label: 'Dow Jones (US30)',
    unit: 'pts',
    pointScale: 1,
    spread: 2,
    contractSize: 1, // CFD indice : 1 lot = 1 $ par point (vérifier chez le broker)
    defaultMode: 'methode',
    sessions: base.sessions,
  },
};

function forMarket(name = 'gold', overrides = {}) {
  const m = markets[name];
  if (!m) throw new Error(`Marché inconnu : ${name} (disponibles : ${Object.keys(markets).join(', ')})`);
  const { pointScale, spread, label, unit, defaultMode, ...rest } = m;
  const mode = overrides.mode || defaultMode;
  if (!modes[mode]) throw new Error(`Mode inconnu : ${mode} (disponibles : ${Object.keys(modes).join(', ')})`);
  const cfg = { ...base, ...rest, ...modes[mode], market: name, marketLabel: label, unit, pointScale, mode };
  for (const k of DISTANCES) cfg[k] = cfg[k] * pointScale;
  cfg.spread = spread;
  return { ...cfg, ...overrides };
}

// Par défaut : l'or.
module.exports = Object.assign(forMarket('gold'), { forMarket, markets, modes, base, DISTANCES });
