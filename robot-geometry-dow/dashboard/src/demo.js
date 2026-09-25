'use strict';

// Données de démonstration : fait tourner le backtester sur 6 semaines de cours simulés
// (jours ouvrés, jusqu'à maintenant) et écrit les fichiers exactement comme l'EA.
// Permet de voir le tableau de bord et les rapports avant d'installer MetaTrader 5.

const fs = require('fs');
const path = require('path');
const cfg = require('../../backtest/src/config');
const S = require('../../backtest/src/strategy');
const { run } = require('../../backtest/src/backtest');
const { buildReport, reportText } = require('./report');

const OFFSET = cfg.serverMinusParisHours;

// Heure de Paris actuelle en « UTC naïf » (ms).
function parisNowMs() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
}

function simulateBars(days = 42, seed = 20240925) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const endServer = Math.floor((parisNowMs() + OFFSET * 3600000) / S.M5) * S.M5 - S.M5;
  const start = endServer - days * 86400000;
  const bars = [];
  let p = 42000;
  let drift = 0;
  for (let t = start; t <= endServer; t += S.M5) {
    const wd = new Date(t - OFFSET * 3600000).getUTCDay();
    if (wd === 0 || wd === 6) continue; // marché fermé le week-end
    if (rnd() < 0.02) drift = (rnd() - 0.5) * 3; // alternance range / impulsion
    const o = p;
    const c = o + drift + (rnd() - 0.5) * 18 - (p - 42000) * 0.002;
    const v = 60 + Math.floor(rnd() * 180);
    bars.push({ t, o, c, h: Math.max(o, c) + rnd() * 7, l: Math.min(o, c) - rnd() * 7, v });
    p = c;
  }
  return bars;
}

// Diagnostic de la check-list sur la dernière bougie, comme l'EA l'écrit dans state.json.
function diagnose(m5, m15, analysis, i) {
  const out = {};
  const price = m5[i].c;
  for (const side of ['buy', 'sell']) {
    const dir = side === 'buy' ? 1 : -1;
    const own = analysis.zones
      .filter((z) => z.side === (side === 'buy' ? 'demand' : 'supply'))
      .sort((a, b) => Math.abs(price - (a.top + a.bottom) / 2) - Math.abs(price - (b.top + b.bottom) / 2));
    const zone = own[0];
    const d = { zone: '', zoneOk: false, wicks: 0, stopHunt: false, geometry: 'n/a', geoComplete: false, m5: !!S.confirmM5(m5, i, side, cfg), ready: false };
    if (zone) {
      d.zone = `${zone.side} ${zone.bottom.toFixed(1)}-${zone.top.toFixed(1)}`;
      const edge = dir > 0 ? zone.top : zone.bottom;
      d.zoneOk = (price - edge) * dir <= cfg.maxEntryDistance && (dir > 0 ? price >= zone.bottom : price <= zone.top);
      const rej = S.rejection(m15, analysis.last, zone, side, cfg);
      if (rej) {
        d.wicks = rej.count;
        d.stopHunt = rej.stopHunt;
        const g = S.geometry(analysis.zz, side, rej.extreme, rej.firstIdx, cfg);
        if (g) {
          d.geometry = `${analysis.regime.type === 'range' ? 'U' : 'N'} AB=CD x${g.ratio.toFixed(2)}`;
          d.geoComplete = g.complete;
        }
      }
    }
    d.ready = d.zoneOk && d.wicks >= cfg.minWicks && d.m5;
    out[side] = d;
  }
  return out;
}

function generate(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'reports'), { recursive: true });
  const bars = simulateBars();
  const { trades } = run(bars, cfg);
  const sec = (ms) => Math.floor(ms / 1000);

  // events.jsonl
  const events = [{ type: 'start', t: sec(bars[0].t) }];
  let balance = cfg.initialBalance;
  let pos = 1000;
  for (const t of trades) {
    pos += 1;
    const lots = Math.max(0.01, Math.round((balance * cfg.riskPercent / 100) / t.risk * 100) / 100);
    events.push({
      type: 'open', t: sec(t.entryTime), pos, side: t.side, lots, entry: t.entry, sl: t.initialSL, tp: t.tp,
      risk: t.risk, balance, checklist: t.checklist,
    });
    if (t.reason === 'SL suiveur') events.push({ type: 'trail', t: sec(t.entryTime) + 900, pos, sl: t.exit });
    const profit = t.balance - balance;
    balance = t.balance;
    events.push({
      type: 'close', t: sec(t.exitTime), pos, side: t.side, exit: t.exit, profit: Math.round(profit * 100) / 100,
      points: t.points, r: t.r, reason: t.reason, balance: Math.round(balance * 100) / 100,
    });
  }
  // quelques garde-fous déclenchés, comme l'EA les journalise
  for (let k = 1; k < trades.length; k++) {
    if (trades[k - 1].points < 0) events.push({ type: 'block', t: sec(trades[k - 1].exitTime) + 300, reason: 'pause après perte' });
  }
  events.sort((a, b) => a.t - b.t);
  fs.writeFileSync(path.join(dir, 'events.jsonl'), `${events.map((e) => JSON.stringify(e)).join('\n')}\n`);

  // state.json (dernière bougie)
  const m15 = S.aggregateM15(bars);
  const last = m15.length - 2; // dernière M15 clôturée
  const analysis = S.analyzeM15(m15, last, cfg);
  const i = bars.length - 1;
  const state = {
    version: 1,
    t: sec(bars[i].t + S.M5),
    offset: OFFSET,
    symbol: 'US30 (démo)',
    demo: true,
    balance: Math.round(balance * 100) / 100,
    equity: Math.round(balance * 100) / 100,
    inSession: S.inSession(bars[i].t + S.M5, cfg),
    block: '',
    regime: {
      type: analysis.regime.type, efficiency: analysis.regime.efficiency,
      high: analysis.regime.high, low: analysis.regime.low, minSL: analysis.regime.minSL,
    },
    zones: analysis.zones.map((z) => ({ side: z.side, bottom: z.bottom, top: z.top, t: sec(m15[z.pivotIdx].t) })),
    m15: m15.slice(Math.max(0, last - 63), last + 1).map((b) => [sec(b.t), b.o, b.h, b.l, b.c]),
    price: bars[i].c,
    checklist: diagnose(bars, m15, analysis, i),
    position: null,
    params: {
      riskPercent: cfg.riskPercent, maxTradesPerDay: cfg.maxTradesPerDay, maxLossesPerDay: cfg.maxLossesPerDay,
      pauseAfterLossMinutes: cfg.pauseAfterLossMinutes, quickMode: cfg.quickMode, sessions: cfg.sessions,
    },
  };
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state));

  // Rapports des jours passés (ceux qu'aurait produits le serveur chaque soir)
  const days = new Set(trades.map((t) => new Date(t.entryTime - OFFSET * 3600000).toISOString().slice(0, 10)));
  const today = new Date(parisNowMs()).toISOString().slice(0, 10);
  for (const day of days) {
    if (day >= today) continue;
    const r = buildReport(events, day, { offset: OFFSET, params: state.params });
    fs.writeFileSync(path.join(dir, 'reports', `${day}.json`), JSON.stringify(r, null, 2));
    fs.writeFileSync(path.join(dir, 'reports', `${day}.txt`), `${reportText(r)}\n`);
  }
  return { trades: trades.length, reports: days.size };
}

module.exports = { generate, diagnose };
