'use strict';

const fs = require('fs');

// Lit un historique M5. Formats acceptés :
//  - export MetaTrader 5 : <DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>...
//    (date au format 2024.01.02)
//  - CSV simple : time,open,high,low,close,volume  (time = "2024-01-02 10:05" ou ISO)
// Les heures sont celles du SERVEUR du broker (voir serverMinusParisHours).
function parseTime(date, time) {
  const s = (time ? `${date} ${time}` : date).trim().replace(/\./g, '-').replace('T', ' ');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ ]+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
}

function parseCsv(text) {
  const bars = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const f = line.split(/[\t,;]/).map((x) => x.trim());
    let t;
    let rest;
    if (/^\d{4}[.-]\d{2}[.-]\d{2}$/.test(f[0]) && /^\d{2}:\d{2}/.test(f[1] || '')) {
      t = parseTime(f[0], f[1]);
      rest = f.slice(2);
    } else {
      t = parseTime(f[0]);
      rest = f.slice(1);
    }
    const [o, h, l, c, v] = rest.map(Number);
    if (!Number.isFinite(t) || ![o, h, l, c].every(Number.isFinite)) continue; // en-tête
    bars.push({ t, o, h, l, c, v: Number.isFinite(v) ? v : 0 });
  }
  bars.sort((a, b) => a.t - b.t);
  return bars;
}

function loadCsv(path) {
  return parseCsv(fs.readFileSync(path, 'utf8'));
}

module.exports = { parseCsv, loadCsv, parseTime };
