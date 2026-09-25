'use strict';

// Stratégie « liquidité » (chasse aux stops) :
//   1. Liquidité : plus haut / plus bas de la session asiatique et de la veille (heure de Paris).
//   2. Sweep : pendant les sessions, le prix dépasse un niveau (prend les stops) puis revient.
//   3. Changement de structure (MSS) : dans les N bougies M5, clôture au-delà du dernier
//      creux (pour une vente) / sommet (pour un achat) formé avant le sweep.
//   4. Entrée à l'ouverture suivante, stop derrière l'extrême du sweep, target sur la liquidité
//      opposée ou à un multiple fixe du risque.
// Distances en prix (déjà converties par config.forMarket).

const S = require('./strategy');

function hhmm(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function median(a) {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[s.length >> 1] : 0;
}

function createLiquidity(m5, cfg) {
  // Volatilité : amplitude médiane des bougies M15 des N derniers jours (recalculée chaque jour).
  const m15 = S.aggregateM15(m5);
  let k15 = -1;
  let vol = 0;
  const asiaStart = hhmm(cfg.liqAsiaStart);
  const asiaEnd = hhmm(cfg.liqAsiaEnd);
  const days = new Map(); // jour de Paris -> { hi, lo, asiaHi, asiaLo }
  let dayOrder = [];
  let lastIndexed = -1;
  let curDay = null;
  let pools = [];
  let pending = [];

  function index(upTo) {
    for (let k = lastIndexed + 1; k <= upTo; k++) {
      const b = m5[k];
      const d = S.parisDay(b.t, cfg);
      let r = days.get(d);
      if (!r) {
        r = { hi: -Infinity, lo: Infinity, asiaHi: -Infinity, asiaLo: Infinity };
        days.set(d, r);
        dayOrder.push(d);
      }
      r.hi = Math.max(r.hi, b.h);
      r.lo = Math.min(r.lo, b.l);
      const m = S.parisMinutes(b.t, cfg);
      if (m >= asiaStart && m < asiaEnd) {
        r.asiaHi = Math.max(r.asiaHi, b.h);
        r.asiaLo = Math.min(r.asiaLo, b.l);
      }
    }
    lastIndexed = Math.max(lastIndexed, upTo);
  }

  function buildPools(d) {
    const out = [];
    const today = days.get(d);
    const pos = dayOrder.indexOf(d);
    const prev = pos > 0 ? days.get(dayOrder[pos - 1]) : null;
    if (cfg.liqPools.includes('asia') && today && Number.isFinite(today.asiaHi)) {
      out.push({ name: 'haut Asie', price: today.asiaHi, kind: 'high', used: false });
      out.push({ name: 'bas Asie', price: today.asiaLo, kind: 'low', used: false });
    }
    if (cfg.liqPools.includes('pdhl') && prev) {
      out.push({ name: 'haut de la veille', price: prev.hi, kind: 'high', used: false });
      out.push({ name: 'bas de la veille', price: prev.lo, kind: 'low', used: false });
    }
    return out;
  }

  // Appelée à la clôture de la bougie i ; renvoie un signal ou null.
  return function evaluate(i, allow = { buy: true, sell: true }, tradingWindow = true) {
    index(i);
    const b = m5[i];
    const d = S.parisDay(b.t, cfg);
    const minute = S.parisMinutes(b.t, cfg);
    if (d !== curDay) {
      curDay = d;
      pools = [];
      pending = [];
      if (cfg.liqVolMode) {
        while (k15 + 1 < m15.length && m15[k15 + 1].t + S.M15 <= b.t) k15++;
        const from = Math.max(0, k15 - cfg.liqVolDays * 92);
        vol = median(m15.slice(from, k15 + 1).map((x) => x.h - x.l));
      }
    }
    // Distances : fixes (en prix) ou proportionnelles à la volatilité récente.
    const V = cfg.liqVolMode
      ? { depth: cfg.liqDepthVol * vol, minSL: cfg.liqMinSLVol * vol, maxSL: cfg.liqMaxSLVol * vol, buffer: cfg.liqBufferVol * vol }
      : { depth: cfg.liqMaxSweepDepth, minSL: cfg.rangeMinSL, maxSL: cfg.maxSL, buffer: cfg.slBuffer };
    if (cfg.liqVolMode && !(vol > 0)) return null;
    // Les niveaux asiatiques sont figés à la fin de la session asiatique.
    if (!pools.length && minute >= asiaEnd) {
      pools = buildPools(d);
      // un niveau déjà dépassé aujourd'hui (avant la fin de l'Asie) n'est plus de la liquidité
      const today = days.get(d);
      for (const p of pools) if (p.kind === 'high' ? today.hi > p.price : today.lo < p.price) p.used = true;
    }
    if (!pools.length) return null;

    // 1) Nouveaux sweeps (hors session : le niveau est consommé mais on ne trade pas)
    {
      for (const p of pools) {
        if (p.used) continue;
        const swept = p.kind === 'high' ? b.h > p.price : b.l < p.price;
        if (!swept) continue;
        p.used = true; // un seul sweep par niveau et par jour
        if (!tradingWindow) { if (cfg._stats) cfg._stats.horsSession++; continue; }
        if (cfg._stats) cfg._stats.sweeps++;
        const from = Math.max(0, i - cfg.liqSwingBars);
        const before = m5.slice(from, i);
        if (!before.length) continue;
        pending.push({
          pool: p,
          dir: p.kind === 'high' ? -1 : 1, // sweep du haut -> vente
          extreme: p.kind === 'high' ? b.h : b.l,
          mss: p.kind === 'high' ? Math.min(...before.map((x) => x.l)) : Math.max(...before.map((x) => x.h)),
          start: i,
        });
      }
    }

    // 2) Suivi des sweeps en attente : extrême, invalidation, changement de structure
    const keep = [];
    let signal = null;
    for (const s of pending) {
      if (s.dir < 0) s.extreme = Math.max(s.extreme, b.h);
      else s.extreme = Math.min(s.extreme, b.l);
      const depth = (s.extreme - s.pool.price) * -s.dir;
      if (depth > V.depth) { if (cfg._stats) cfg._stats.cassure++; continue; } // vraie cassure, pas un sweep
      if (i - s.start > cfg.liqMaxWaitBars) { if (cfg._stats) cfg._stats.pasDeMSS++; continue; } // trop tard
      // 'mss' : cassure du dernier creux/sommet ; 'reclaim' : clôture revenue de l'autre côté du niveau pris
      const level = cfg.liqEntry === 'reclaim' ? s.pool.price : s.mss;
      const mssOk = s.dir < 0 ? b.c < level : b.c > level;
      if (!mssOk) { keep.push(s); continue; }
      const side = s.dir > 0 ? 'buy' : 'sell';
      if (cfg._stats) cfg._stats.mss++;
      if (signal || !tradingWindow || !allow[side]) { if (cfg._stats) cfg._stats.bloque++; continue; }
      const price = b.c;
      const sl = s.extreme - s.dir * V.buffer;
      const dist = (price - sl) * s.dir;
      if (dist < V.minSL || dist > V.maxSL) { if (cfg._stats) cfg._stats[dist < V.minSL ? 'stopTropPetit' : 'stopTropGrand']++; continue; }
      let tp = price + s.dir * cfg.liqTargetR * dist;
      if (cfg.liqTarget === 'opposite') {
        const opp = pools.filter((p) => p.kind === (s.dir > 0 ? 'high' : 'low') && (p.price - price) * s.dir > 0)
          .map((p) => p.price - s.dir * cfg.targetMargin)
          .filter((x) => ((x - price) * s.dir) / dist >= cfg.minRR)
          .sort((a, c) => (a - c) * s.dir);
        if (!opp.length) continue;
        tp = opp[0];
      }
      signal = {
        side,
        time: b.t,
        price,
        sl,
        tp,
        checklist: {
          type: 'liquidité',
          zone: `sweep ${s.pool.name} ${s.pool.price.toFixed(2)}`,
          wicks: 0,
          stopHunt: true,
          geometry: `MSS ${s.mss.toFixed(2)}`,
        },
      };
    }
    pending = keep;
    return signal;
  };
}

module.exports = { createLiquidity };
