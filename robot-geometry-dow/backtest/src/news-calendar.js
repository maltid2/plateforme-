'use strict';

// Grosses annonces américaines (impact fort sur l'or), heure de PARIS, pour le BACKTEST uniquement.
// En réel, l'EA lit le vrai calendrier économique de MetaTrader 5 (CalendarValueHistory) : c'est lui
// qui fait foi. Cette liste est reconstituée à la main et peut contenir des erreurs de date,
// surtout pour 2026 et pendant le shutdown américain d'octobre-novembre 2025.
//
// Heures : 8:30 à New York = 14:30 à Paris (13:30 pendant les semaines où les États-Unis ont déjà
// changé d'heure et pas l'Europe) ; décision de la Fed 14:00 New York = 20:00 Paris (19:00).

// Semaines de décalage États-Unis / Europe (heure d'été américaine en avance ou en retard).
const MISMATCH = [
  ['2025-03-09', '2025-03-30'], ['2025-10-26', '2025-11-02'],
  ['2026-03-08', '2026-03-29'], ['2026-10-25', '2026-11-01'],
];

function paris(day, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const shift = MISMATCH.some(([a, b]) => day >= a && day < b) ? -1 : 0;
  const [y, mo, d] = day.split('-').map(Number);
  return Date.UTC(y, mo - 1, d, h + shift, m);
}

const NFP = [ // emploi américain (Non-Farm Payrolls)
  '2025-04-04', '2025-05-02', '2025-06-06', '2025-07-03', '2025-08-01', '2025-09-05',
  '2025-11-20', '2025-12-16',
  '2026-01-09', '2026-02-11', '2026-03-06', '2026-04-03', '2026-05-08', '2026-06-05',
  '2026-07-02', '2026-08-07', '2026-09-04',
];
const CPI = [ // inflation américaine
  '2025-04-10', '2025-05-13', '2025-06-11', '2025-07-15', '2025-08-12', '2025-09-11',
  '2025-10-24', '2025-12-18',
  '2026-01-13', '2026-02-13', '2026-03-11', '2026-04-10', '2026-05-12', '2026-06-10',
  '2026-07-14', '2026-08-12', '2026-09-11',
];
const FOMC = [ // décision de taux de la Fed
  '2025-05-07', '2025-06-18', '2025-07-30', '2025-09-17', '2025-10-29', '2025-12-10',
  '2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17', '2026-07-29', '2026-09-16',
];

const US_NEWS = [
  ...NFP.map((d) => ({ t: paris(d, '14:30'), name: 'NFP' })),
  ...CPI.map((d) => ({ t: paris(d, '14:30'), name: 'CPI' })),
  ...FOMC.map((d) => ({ t: paris(d, '20:00'), name: 'FOMC' })),
].sort((a, b) => a.t - b.t);

module.exports = { US_NEWS };
