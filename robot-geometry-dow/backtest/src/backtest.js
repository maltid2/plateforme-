'use strict';

const S = require('./strategy');

// Garde-fous psychologiques du PDF (« Note d'un trader ») traduits en règles :
//  - pas de trade pour « se venger » : pause après une perte
//  - pas plus de N pertes / jour, perte journalière max
//  - trader max 2 h puis arrêter pour la journée
//  - une seule position à la fois (jamais de renfort sur une position perdante)
class RiskGuard {
  constructor(cfg) {
    this.cfg = cfg;
    this.day = null;
  }

  reset(day) {
    this.day = day;
    this.trades = 0;
    this.losses = 0;
    this.pnlPercent = 0;
    this.firstTradeAt = null;
    this.lastLossAt = null;
  }

  sync(t) {
    const d = S.parisDay(t, this.cfg);
    if (d !== this.day) this.reset(d);
  }

  canTrade(t) {
    this.sync(t);
    const c = this.cfg;
    if (this.trades >= c.maxTradesPerDay) return 'max trades/jour';
    if (this.losses >= c.maxLossesPerDay) return 'max pertes/jour';
    if (this.pnlPercent <= -c.maxDailyLossPercent) return 'perte journalière max';
    if (c.maxMinutesAfterFirstTrade > 0 && this.firstTradeAt !== null && t - this.firstTradeAt > c.maxMinutesAfterFirstTrade * 60000) return '2 h de trading écoulées';
    if (this.lastLossAt !== null && t - this.lastLossAt < c.pauseAfterLossMinutes * 60000) return 'pause après perte';
    return null;
  }

  onOpen(t) {
    this.sync(t);
    this.trades += 1;
    if (this.firstTradeAt === null) this.firstTradeAt = t;
  }

  onClose(t, pnlPercent) {
    this.sync(t);
    this.pnlPercent += pnlPercent;
    if (pnlPercent < 0) {
      this.losses += 1;
      this.lastLossAt = t;
    }
  }
}

// Stop suiveur : ne fait QUE resserrer le stop (règle « ne déplace jamais ton stop » contre soi).
function trail(pos, bar, cfg) {
  const dir = pos.side === 'buy' ? 1 : -1;
  const profit = (bar.c - pos.entry) * dir;
  let sl = pos.sl;
  if (profit >= cfg.breakEvenAtR * pos.risk) {
    const be = pos.entry + dir * cfg.breakEvenLock;
    sl = dir > 0 ? Math.max(sl, be) : Math.min(sl, be);
    if (cfg.trailing) {
      const tr = bar.c - dir * pos.risk;
      sl = dir > 0 ? Math.max(sl, tr) : Math.min(sl, tr);
    }
  }
  return sl;
}

// Taille de position en lots quand on simule un vrai capital (cfg.capital > 0).
// Petit compte : si le risque visé donne moins que le lot minimum, on prend le lot minimum
// SEULEMENT si la perte au stop reste sous maxRiskPercentMinLot % du capital ; sinon pas de trade.
function sizeLots(balance, risk, cfg) {
  const perLot = risk * cfg.contractSize; // perte au stop pour 1 lot
  if (perLot <= 0) return 0;
  const target = (balance * cfg.riskPercent) / 100;
  let lots = Math.floor(target / perLot / cfg.lotStep + 1e-9) * cfg.lotStep;
  if (lots < cfg.minLot) {
    lots = perLot * cfg.minLot <= (balance * cfg.maxRiskPercentMinLot) / 100 ? cfg.minLot : 0;
  }
  return Math.round(lots * 100) / 100;
}

function run(m5, cfg) {
  const m15 = S.aggregateM15(m5);
  const guard = new RiskGuard(cfg);
  const trades = [];
  const realMoney = cfg.capital > 0;
  let balance = realMoney ? cfg.capital : cfg.initialBalance;
  let skipped = 0; // setups valides refusés car le lot minimum dépasse le risque autorisé
  let peak = balance;
  let maxDD = 0;
  let pos = null;
  let pending = null;
  let k15 = -1;
  let lastAnalyzed = -1;
  let analysis = null;
  const half = cfg.spread / 2;

  const close = (bar, price, reason) => {
    const dir = pos.side === 'buy' ? 1 : -1;
    const points = (price - pos.entry) * dir - half;
    const r = points / pos.risk;
    let pct = r * cfg.riskPercent;
    let pnl;
    if (realMoney) {
      pnl = points * pos.lots * cfg.contractSize;
      pct = (pnl / balance) * 100;
      balance += pnl;
    } else {
      pnl = balance * (pct / 100);
      balance *= 1 + pct / 100;
    }
    peak = Math.max(peak, balance);
    maxDD = Math.max(maxDD, (peak - balance) / peak);
    guard.onClose(bar.t, pct);
    trades.push({ ...pos, exitTime: bar.t, exit: price, reason, points, r, pnl, balance });
    pos = null;
  };

  for (let i = 0; i < m5.length; i++) {
    const bar = m5[i];

    // Ordre en attente : exécution à l'ouverture de la bougie suivante.
    if (pending) {
      const dir = pending.side === 'buy' ? 1 : -1;
      const entry = bar.o + dir * half;
      const risk = (entry - pending.sl) * dir;
      const ok = risk > 0 && (pending.tp - entry) * dir > 0;
      const lots = realMoney ? sizeLots(balance, risk, cfg) : null;
      if (ok && lots === 0) skipped++;
      else if (ok && !guard.canTrade(bar.t)) {
        pos = { ...pending, entry, entryTime: bar.t, risk, initialSL: pending.sl, lots };
        guard.onOpen(bar.t);
      }
      pending = null;
    }

    // Vendredi soir : on sort à l'ouverture de la bougie, pas de position pendant le week-end.
    if (pos && S.weekendClose(bar.t, cfg)) close(bar, bar.o, 'clôture week-end');

    // Gestion de la position : stop d'abord (hypothèse prudente), puis target.
    if (pos) {
      const buy = pos.side === 'buy';
      if (buy ? bar.l <= pos.sl : bar.h >= pos.sl) close(bar, pos.sl, pos.sl === pos.initialSL ? 'SL' : 'SL suiveur');
      else if (buy ? bar.h >= pos.tp : bar.l <= pos.tp) close(bar, pos.tp, 'TP');
      else pos.sl = trail(pos, bar, cfg);
    }

    // Dernière bougie M15 clôturée à la fin de cette bougie M5.
    while (k15 + 1 < m15.length && m15[k15 + 1].t + S.M15 <= bar.t + S.M5) k15++;
    if (k15 < cfg.regimeLookback + cfg.pivotStrength * 2) continue;
    if (k15 !== lastAnalyzed) {
      analysis = S.analyzeM15(m15, k15, cfg);
      lastAnalyzed = k15;
    }

    if (pos || i + 1 >= m5.length) continue;
    const nextOpen = bar.t + S.M5;
    if (realMoney && balance <= 0) break; // compte vidé
    if (!S.canEnter(nextOpen, cfg) || guard.canTrade(nextOpen)) continue;
    const sig = S.evaluate(m5, i, m15, analysis, cfg);
    if (sig) pending = sig;
  }
  if (pos) close(m5[m5.length - 1], m5[m5.length - 1].c, 'fin des données');

  return { trades, stats: { ...stats(trades, cfg, balance, maxDD), skipped } };
}

function stats(trades, cfg, balance, maxDD) {
  const wins = trades.filter((t) => t.points > 0);
  const losses = trades.filter((t) => t.points <= 0);
  const gross = (arr) => arr.reduce((s, t) => s + t.points, 0);
  const gw = gross(wins);
  const gl = -gross(losses);
  return {
    trades: trades.length,
    winRate: trades.length ? wins.length / trades.length : 0,
    points: gw - gl,
    profitFactor: gl > 0 ? gw / gl : wins.length ? Infinity : 0,
    avgR: trades.length ? trades.reduce((s, t) => s + t.r, 0) / trades.length : 0,
    finalBalance: balance,
    returnPercent: (balance / (cfg.capital > 0 ? cfg.capital : cfg.initialBalance) - 1) * 100,
    maxDrawdownPercent: maxDD * 100,
  };
}

module.exports = { run, RiskGuard, trail, stats, sizeLots };
