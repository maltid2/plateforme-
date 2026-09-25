'use strict';

// Paramètres par défaut du robot « Geometry Market Mastery ».
// Toutes les distances sont en POINTS D'INDICE du Dow Jones (1 point = 1.0 de prix).
// Les mêmes noms (préfixés « Inp ») existent dans l'EA MetaTrader 5.

module.exports = {
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

  // --- Backtest ------------------------------------------------------------
  spread: 2,
  initialBalance: 10000,
};
