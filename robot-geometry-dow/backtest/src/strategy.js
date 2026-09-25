'use strict';

// Logique de la méthode « Geometry Market Mastery », en fonctions pures.
// Une bougie = { t, o, h, l, c, v } avec t = heure SERVEUR en ms (lue comme UTC).
//
// Check-list appliquée (PDF, section « Comment ? ») :
//   1. Type de trade : range ou impulsion      -> taille de stop
//   2. Zone clé M15 : supply / demand          -> où entrer
//   3. Géométrie de marché (AB=CD, U, N)        -> amplitude / target
//   4. Mèches de rejet M15 dans la zone         -> polarité
//   5. Confirmations M5 : 2 bougies + volume    -> entrée

const M5 = 5 * 60000;
const M15 = 15 * 60000;

// ---------------------------------------------------------------------------
// Temps
// ---------------------------------------------------------------------------

function parisMinutes(t, cfg) {
  const min = Math.floor(t / 60000) - cfg.serverMinusParisHours * 60;
  return ((min % 1440) + 1440) % 1440;
}

function parisDay(t, cfg) {
  return Math.floor((Math.floor(t / 60000) - cfg.serverMinusParisHours * 60) / 1440);
}

function hhmm(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function inSession(t, cfg) {
  const m = parisMinutes(t, cfg);
  return cfg.sessions.some((s) => m >= hhmm(s.start) && m < hhmm(s.end));
}

// ---------------------------------------------------------------------------
// Bougies
// ---------------------------------------------------------------------------

function aggregateM15(m5) {
  const out = [];
  for (const b of m5) {
    const t = Math.floor(b.t / M15) * M15;
    const last = out[out.length - 1];
    if (last && last.t === t) {
      last.h = Math.max(last.h, b.h);
      last.l = Math.min(last.l, b.l);
      last.c = b.c;
      last.v += b.v;
    } else {
      out.push({ t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v });
    }
  }
  return out;
}

const range = (b) => b.h - b.l;
const isBull = (b) => b.c > b.o;
const isBear = (b) => b.c < b.o;
const lowerWick = (b) => Math.min(b.o, b.c) - b.l;
const upperWick = (b) => b.h - Math.max(b.o, b.c);

// ---------------------------------------------------------------------------
// Étape 1 : range ou impulsion
// ---------------------------------------------------------------------------

function detectRegime(m15, last, cfg) {
  const from = Math.max(1, last - cfg.regimeLookback + 1);
  let path = 0;
  let hi = -Infinity;
  let lo = Infinity;
  for (let k = from; k <= last; k++) {
    path += Math.abs(m15[k].c - m15[k - 1].c);
    hi = Math.max(hi, m15[k].h);
    lo = Math.min(lo, m15[k].l);
  }
  const efficiency = path > 0 ? Math.abs(m15[last].c - m15[from - 1].c) / path : 0;
  const type = efficiency < cfg.rangeEfficiencyMax ? 'range' : 'impulsion';
  let minSL = cfg.impulseMinSL;
  if (type === 'range') minSL = hi - lo >= cfg.wideRangeSize ? cfg.wideRangeMinSL : cfg.rangeMinSL;
  return { type, efficiency, high: hi, low: lo, minSL };
}

// ---------------------------------------------------------------------------
// Étape 2 : points hauts/bas et zones supply/demand M15
// ---------------------------------------------------------------------------

function findPivots(m15, last, cfg) {
  const s = cfg.pivotStrength;
  const from = Math.max(s, last - cfg.zoneLookback);
  const pivots = [];
  for (let j = from; j <= last - s; j++) {
    let isHigh = true;
    let isLow = true;
    for (let k = 1; k <= s; k++) {
      if (!(m15[j].h > m15[j - k].h && m15[j].h >= m15[j + k].h)) isHigh = false;
      if (!(m15[j].l < m15[j - k].l && m15[j].l <= m15[j + k].l)) isLow = false;
    }
    if (isHigh) pivots.push({ idx: j, kind: 'high', price: m15[j].h });
    if (isLow) pivots.push({ idx: j, kind: 'low', price: m15[j].l });
  }
  return pivots;
}

function buildZones(m15, last, pivots, cfg) {
  const zones = [];
  for (const p of pivots) {
    const b = m15[p.idx];
    let zone;
    if (p.kind === 'low') {
      // Demand : de la mèche basse jusqu'au corps de la bougie pivot.
      const top = Math.max(Math.min(b.o, b.c), b.l + cfg.minZoneHeight);
      zone = { side: 'demand', bottom: b.l, top, pivotIdx: p.idx };
    } else {
      const bottom = Math.min(Math.max(b.o, b.c), b.h - cfg.minZoneHeight);
      zone = { side: 'supply', bottom, top: b.h, pivotIdx: p.idx };
    }
    // Zone cassée si une bougie a CLÔTURÉ au-delà (une mèche = stop hunt, pas une cassure).
    let broken = false;
    for (let k = p.idx + 1; k <= last && !broken; k++) {
      if (zone.side === 'demand' && m15[k].c < zone.bottom - cfg.zoneTolerance) broken = true;
      if (zone.side === 'supply' && m15[k].c > zone.top + cfg.zoneTolerance) broken = true;
    }
    if (!broken) zones.push(zone);
  }
  return zones;
}

// Zigzag : alterne strictement hauts et bas en gardant l'extrême.
function zigzag(pivots) {
  const zz = [];
  for (const p of [...pivots].sort((a, b) => a.idx - b.idx)) {
    const last = zz[zz.length - 1];
    if (last && last.kind === p.kind) {
      if ((p.kind === 'high' && p.price > last.price) || (p.kind === 'low' && p.price < last.price)) {
        zz[zz.length - 1] = p;
      }
    } else {
      zz.push(p);
    }
  }
  return zz;
}

function analyzeM15(m15, last, cfg) {
  const regime = detectRegime(m15, last, cfg);
  const pivots = findPivots(m15, last, cfg);
  const zones = buildZones(m15, last, pivots, cfg);
  return { last, regime, pivots, zones, zz: zigzag(pivots) };
}

// ---------------------------------------------------------------------------
// Étape 3 : géométrie AB=CD
// ---------------------------------------------------------------------------

// Pour un achat, D est le bas actuel (mèches de rejet) : A haut, B bas, C haut.
function geometry(zz, side, dPrice, beforeIdx, cfg) {
  const pts = zz.filter((p) => p.idx < beforeIdx);
  const want = side === 'buy' ? ['high', 'low', 'high'] : ['low', 'high', 'low'];
  // On cherche la dernière séquence A,B,C correspondant au motif.
  for (let k = pts.length - 1; k >= 2; k--) {
    const [a, b, c] = [pts[k - 2], pts[k - 1], pts[k]];
    if (a.kind !== want[0] || b.kind !== want[1] || c.kind !== want[2]) continue;
    const ab = Math.abs(a.price - b.price);
    const cd = Math.abs(c.price - dPrice);
    const ratio = ab > 0 ? cd / ab : 0;
    return {
      a: a.price, b: b.price, c: c.price, d: dPrice, ab, cd, ratio,
      complete: ratio >= cfg.abcdMinRatio && ratio <= cfg.abcdMaxRatio,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Étape 4 : mèches de rejet M15 dans la zone
// ---------------------------------------------------------------------------

function rejection(m15, last, zone, side, cfg) {
  const from = Math.max(zone.pivotIdx + cfg.pivotStrength + 1, last - cfg.wickLookback + 1);
  const wicks = [];
  for (let k = from; k <= last; k++) {
    const b = m15[k];
    const r = range(b);
    if (r <= 0) continue;
    if (side === 'buy') {
      const touch = b.l <= zone.top + cfg.zoneTolerance && b.c >= zone.bottom;
      if (!touch) continue;
      // Mèche basse sur bougie verte...
      const sameColor = isBull(b) && lowerWick(b) / r >= cfg.wickRatio;
      // ...ou exception : bougie rouge à grande mèche basse avalée par une verte.
      const next = m15[k + 1];
      const engulf = isBear(b) && lowerWick(b) / r >= cfg.bigWickRatio
        && next && k + 1 <= last && isBull(next) && next.c > b.o;
      if (sameColor || engulf) wicks.push({ idx: k, extreme: b.l, engulf: !!engulf && !sameColor });
    } else {
      const touch = b.h >= zone.bottom - cfg.zoneTolerance && b.c <= zone.top;
      if (!touch) continue;
      const sameColor = isBear(b) && upperWick(b) / r >= cfg.wickRatio;
      const next = m15[k + 1];
      const engulf = isBull(b) && upperWick(b) / r >= cfg.bigWickRatio
        && next && k + 1 <= last && isBear(next) && next.c < b.o;
      if (sameColor || engulf) wicks.push({ idx: k, extreme: b.h, engulf: !!engulf && !sameColor });
    }
  }
  if (wicks.length < cfg.minWicks) return null;
  const extreme = side === 'buy'
    ? Math.min(...wicks.map((w) => w.extreme))
    : Math.max(...wicks.map((w) => w.extreme));
  // Stop hunt : la zone a été transpercée par une mèche puis réintégrée.
  const stopHunt = side === 'buy' ? extreme < zone.bottom : extreme > zone.top;
  return { count: wicks.length, extreme, stopHunt, engulfing: wicks.some((w) => w.engulf), firstIdx: wicks[0].idx };
}

// ---------------------------------------------------------------------------
// Étape 5 : confirmation M5 (2 bougies dans le sens + volume)
// ---------------------------------------------------------------------------

function volumeAverage(m5, i, period) {
  const from = Math.max(0, i - period - 1);
  const to = i - 2; // moyenne AVANT les deux bougies de confirmation
  if (to < from) return 0;
  let s = 0;
  for (let k = from; k <= to; k++) s += m5[k].v;
  return s / (to - from + 1);
}

function confirmM5(m5, i, side, cfg) {
  if (i < 2) return null;
  const b1 = m5[i - 1];
  const b2 = m5[i];
  const avg = volumeAverage(m5, i, cfg.volumeMaPeriod);
  const volOk = (b) => b.v >= avg * cfg.volumeFactor;
  if (side === 'buy') {
    if (!(isBull(b1) && isBull(b2) && b2.c > b1.c && volOk(b1) && volOk(b2))) return null;
    return { retest: lowerWick(b2) > 0, low: Math.min(b1.l, b2.l), high: Math.max(b1.h, b2.h) };
  }
  if (!(isBear(b1) && isBear(b2) && b2.c < b1.c && volOk(b1) && volOk(b2))) return null;
  return { retest: upperWick(b2) > 0, low: Math.min(b1.l, b2.l), high: Math.max(b1.h, b2.h) };
}

// ---------------------------------------------------------------------------
// Assemblage : signal complet
// ---------------------------------------------------------------------------

function evaluate(m5, i, m15, analysis, cfg) {
  if (!analysis) return null;
  // Filtre anti-news : bougie M15 anormalement grande = accélération, pas un setup.
  if (cfg.maxM15Range > 0 && range(m15[analysis.last]) > cfg.maxM15Range) return null;
  const price = m5[i].c;
  for (const side of ['buy', 'sell']) {
    const conf = confirmM5(m5, i, side, cfg);
    if (!conf) continue;
    const dir = side === 'buy' ? 1 : -1;
    const own = analysis.zones.filter((z) => z.side === (side === 'buy' ? 'demand' : 'supply'));
    const opposite = analysis.zones.filter((z) => z.side === (side === 'buy' ? 'supply' : 'demand'));

    // Zones clés les plus proches du prix en premier.
    own.sort((a, b) => Math.abs(price - (a.top + a.bottom) / 2) - Math.abs(price - (b.top + b.bottom) / 2));
    for (const zone of own) {
      const edge = side === 'buy' ? zone.top : zone.bottom;
      const distance = (price - edge) * dir;
      if (distance > cfg.maxEntryDistance) continue; // prix déjà parti : on ne court pas après
      if (side === 'buy' && price < zone.bottom) continue;
      if (side === 'sell' && price > zone.top) continue;

      const rej = rejection(m15, analysis.last, zone, side, cfg);
      if (!rej) continue;
      if (cfg.requireStopHunt && !rej.stopHunt) continue;

      const geo = geometry(analysis.zz, side, rej.extreme, rej.firstIdx, cfg);
      if (cfg.requireGeometry && !(geo && geo.complete)) continue;

      const reg = analysis.regime;
      let sl;
      let tp;
      if (cfg.quickMode) {
        sl = price - dir * cfg.quickSL;
        tp = price + dir * cfg.quickTP;
      } else {
        // Stop logique : derrière les mèches / la zone / le plus bas, avec marge.
        const structural = side === 'buy'
          ? Math.min(rej.extreme, zone.bottom, conf.low) - cfg.slBuffer
          : Math.max(rej.extreme, zone.top, conf.high) + cfg.slBuffer;
        let dist = (price - structural) * dir;
        dist = Math.max(dist, reg.minSL);
        if (dist > cfg.maxSL) continue;
        sl = price - dir * dist;

        // Targets candidates : zones opposées, borne du range (U) ou mouvement mesuré (N).
        const cands = opposite
          .map((z) => (side === 'buy' ? z.bottom : z.top) - dir * cfg.targetMargin)
          .filter((p) => (p - price) * dir > 0);
        if (reg.type === 'range') cands.push((side === 'buy' ? reg.high : reg.low) - dir * cfg.targetMargin);
        else if (geo) cands.push(price + dir * geo.cd);
        const valid = cands
          .filter((p) => ((p - price) * dir) / dist >= cfg.minRR)
          .sort((a, b) => (a - b) * dir);
        if (!valid.length) continue;
        tp = valid[0]; // la target valide la plus proche : la plus probable
      }

      return {
        side,
        time: m5[i].t,
        price,
        sl,
        tp,
        checklist: {
          type: analysis.regime.type,
          zone: `${zone.side} ${zone.bottom.toFixed(2)}-${zone.top.toFixed(2)}`,
          geometry: geo ? `${analysis.regime.type === 'range' ? 'U' : 'N'} AB=CD x${geo.ratio.toFixed(2)}${geo.complete ? ' ✓' : ''}` : 'n/a',
          wicks: rej.count,
          engulfing: rej.engulfing,
          stopHunt: rej.stopHunt,
          retestM5: conf.retest,
        },
      };
    }
  }
  return null;
}

module.exports = {
  M5,
  M15,
  parisMinutes,
  parisDay,
  inSession,
  aggregateM15,
  detectRegime,
  findPivots,
  buildZones,
  zigzag,
  analyzeM15,
  geometry,
  rejection,
  confirmM5,
  evaluate,
};
