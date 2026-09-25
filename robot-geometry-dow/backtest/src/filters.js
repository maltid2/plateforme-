'use strict';

// Filtres ajoutés à la méthode du PDF :
//   - tendance de fond (H4 ou journalier) : n'acheter qu'en tendance haussière, ne vendre qu'en baissière ;
//   - fondamental : pas d'entrée autour des grosses annonces américaines (NFP, CPI, Fed).
// Le filtre price action (cassure de la bougie de rejet) est dans strategy.js.

const { US_NEWS } = require('./news-calendar');

const H1 = 3600000;
const PERIODS = { H1, H4: 4 * H1, D1: 24 * H1 };

function aggregate(m5, period) {
  const out = [];
  for (const b of m5) {
    const t = Math.floor(b.t / period) * period;
    const last = out[out.length - 1];
    if (last && last.t === t) {
      last.h = Math.max(last.h, b.h);
      last.l = Math.min(last.l, b.l);
      last.c = b.c;
    } else {
      out.push({ t, o: b.o, h: b.h, l: b.l, c: b.c });
    }
  }
  return out;
}

function ema(values, period) {
  const k = 2 / (period + 1);
  const out = [];
  let e = values[0];
  for (let i = 0; i < values.length; i++) {
    e = i === 0 ? values[0] : values[i] * k + e * (1 - k);
    out.push(e);
  }
  return out;
}

// Tendance : clôture au-dessus d'une EMA qui monte = haussière (+1), l'inverse = baissière (-1), sinon 0.
function trendTracker(m5, cfg) {
  const period = PERIODS[cfg.trendTimeframe];
  if (!period) throw new Error(`trendTimeframe inconnu : ${cfg.trendTimeframe}`);
  const bars = aggregate(m5, period);
  const e = ema(bars.map((b) => b.c), cfg.trendEmaPeriod);
  let k = -1;
  return function trendAt(t) {
    // dernière bougie de tendance CLÔTURÉE à l'instant t (t croissant)
    while (k + 1 < bars.length && bars[k + 1].t + period <= t) k++;
    const n = cfg.trendSlopeBars;
    if (k < Math.max(cfg.trendEmaPeriod, n)) return 0;
    const rising = e[k] > e[k - n];
    const falling = e[k] < e[k - n];
    if (bars[k].c > e[k] && rising) return 1;
    if (bars[k].c < e[k] && falling) return -1;
    return 0;
  };
}

// t en heure serveur (ms) ; les annonces sont en heure de Paris.
function newsBlocked(t, cfg) {
  const paris = t - cfg.serverMinusParisHours * H1;
  const before = cfg.newsBeforeMinutes * 60000;
  const after = cfg.newsAfterMinutes * 60000;
  return US_NEWS.some((n) => paris >= n.t - before && paris <= n.t + after);
}

module.exports = { aggregate, ema, trendTracker, newsBlocked, PERIODS };
