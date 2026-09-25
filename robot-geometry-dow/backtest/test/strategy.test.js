'use strict';

// Tests sans framework (module natif assert), comme le reste du dépôt.
const assert = require('assert');
const config = require('../src/config');
const cfg = config.forMarket('dow'); // scénarios écrits en prix du Dow
// Les scénarios synthétiques n'ont que quelques jours d'historique : tendance et annonces coupées.
const gold = config.forMarket('gold', { strategy: 'geometry', trendFilter: false, newsFilter: false, trailing: true, breakEvenAtR: 1 });
const F = require('../src/filters');
const { US_NEWS } = require('../src/news-calendar');
const S = require('../src/strategy');
const { run, RiskGuard, trail, sizeLots } = require('../src/backtest');
const { parseCsv } = require('../src/csv');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.stack}`);
    process.exitCode = 1;
  }
}

const DAY = Date.UTC(2024, 0, 2); // mardi 2 janvier 2024, 00:00 serveur

// Découpe une bougie M15 en 3 bougies M5 cohérentes (extrême opposé d'abord).
function expand(b, t, vol = [100, 100, 100]) {
  const bull = b.c >= b.o;
  const first = bull ? b.l : b.h;
  const last = bull ? b.h : b.l;
  const p1 = first + (b.c - first) * 0.3;
  const p2 = first + (b.c - first) * 0.65;
  const mk = (o, c, k, ext) => ({
    t: t + k * S.M5,
    o,
    c,
    h: Math.max(o, c, k === 0 && !bull ? b.h : -Infinity, k === 2 && bull ? last : -Infinity),
    l: Math.min(o, c, k === 0 && bull ? b.l : Infinity, k === 2 && !bull ? last : Infinity),
    v: vol[k],
  });
  return [mk(b.o, p1, 0), mk(p1, p2, 1), mk(p2, b.c, 2)];
}

// Scénario d'achat : range, zone de demand, retour dans la zone avec mèche basse M15,
// puis 2 bougies M5 vertes avec volume acheteur pendant la session de 10 h (Paris).
function buyScenario() {
  const m15 = [];
  let p = 38000;
  // 24 h de range calme autour de 38000 (amplitude ~±60)
  for (let k = 0; k < 40; k++) {
    const o = p;
    const c = 38000 + 60 * Math.sin(k / 3);
    m15.push({ o, c, h: Math.max(o, c) + 3, l: Math.min(o, c) - 3 });
    p = c;
  }
  const path = [
    // chute vers la demand
    [p, 37960], [37960, 37930], [37930, 37912],
    // pivot bas (mèche basse) = zone de demand 37900-37912
    [37912, 37918, 37900], [37918, 37935], [37935, 37960], [37960, 37985],
    // pivot haut C -> future supply
    [37985, 38010, null, 38020], [38010, 37990], [37990, 37960], [37960, 37935], [37935, 37918],
  ];
  for (const [o, c, l, h] of path) {
    m15.push({ o, c, h: h ?? Math.max(o, c) + 2, l: l ?? Math.min(o, c) - 2 });
  }
  // Bougie M15 de rejet : verte avec grande mèche basse dans la zone
  m15.push({ o: 37912, c: 37918, h: 37920, l: 37901 });

  // Place la bougie de rejet pour qu'elle clôture à 10:30 Paris (11:30 serveur).
  const rejectEnd = DAY + (11 * 60 + 30) * 60000;
  const start = rejectEnd - m15.length * S.M15 + 24 * 3600000;
  const bars = [];
  m15.forEach((b, k) => bars.push(...expand(b, start + k * S.M15)));
  const t0 = start + m15.length * S.M15;
  // 2 bougies M5 vertes, volume acheteur (> moyenne)
  bars.push({ t: t0, o: 37918, h: 37923, l: 37916, c: 37922, v: 250 });
  bars.push({ t: t0 + S.M5, o: 37922, h: 37928, l: 37920, c: 37927, v: 300 });
  // suite : le prix monte vers la supply
  let q = 37927;
  for (let k = 2; k < 30; k++) {
    const o = q;
    q += 3;
    bars.push({ t: t0 + k * S.M5, o, c: q, h: q + 1, l: o - 1, v: 120 });
  }
  return bars;
}

// Marche aléatoire déterministe pour les tests d'invariants.
function randomWalk(n, seed = 42) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const bars = [];
  let p = 38000;
  for (let i = 0; i < n; i++) {
    const o = p;
    const c = o + (rnd() - 0.5) * 16;
    bars.push({ t: DAY + i * S.M5, o, c, h: Math.max(o, c) + rnd() * 6, l: Math.min(o, c) - rnd() * 6, v: 50 + Math.floor(rnd() * 150) });
    p = c;
  }
  return bars;
}

console.log('Horaires');
test('heure de Paris avec décalage serveur +1', () => {
  const t = DAY + 11 * 3600000; // 11:00 serveur
  assert.strictEqual(S.parisMinutes(t, cfg), 10 * 60);
  assert.ok(S.inSession(t, cfg));
  assert.ok(!S.inSession(DAY + 15 * 3600000, cfg)); // 14:00 Paris : hors créneaux
  assert.ok(S.inSession(DAY + (22 * 60 + 45) * 60000, cfg)); // 21:45 Paris
});

console.log('Bougies');
test('agrégation M5 -> M15', () => {
  const m5 = [
    { t: DAY, o: 1, h: 3, l: 0, c: 2, v: 1 },
    { t: DAY + S.M5, o: 2, h: 5, l: 1, c: 4, v: 2 },
    { t: DAY + 2 * S.M5, o: 4, h: 4, l: -1, c: 3, v: 3 },
    { t: DAY + 3 * S.M5, o: 3, h: 3, l: 3, c: 3, v: 1 },
  ];
  const m15 = S.aggregateM15(m5);
  assert.strictEqual(m15.length, 2);
  assert.deepStrictEqual(m15[0], { t: DAY, o: 1, h: 5, l: -1, c: 3, v: 6 });
});

test('lecture CSV export MetaTrader 5', () => {
  const bars = parseCsv('<DATE>\t<TIME>\t<OPEN>\t<HIGH>\t<LOW>\t<CLOSE>\t<TICKVOL>\n2024.01.02\t11:05:00\t38000\t38010\t37990\t38005\t120\n');
  assert.strictEqual(bars.length, 1);
  assert.strictEqual(bars[0].t, DAY + (11 * 60 + 5) * 60000);
  assert.strictEqual(bars[0].v, 120);
});

console.log('Check-list');
test('étape 1 : range vs impulsion', () => {
  const flat = Array.from({ length: 30 }, (_, k) => ({ o: 0, c: k % 2 ? 10 : 0, h: 12, l: -2 }));
  assert.strictEqual(S.detectRegime(flat, 29, cfg).type, 'range');
  assert.strictEqual(S.detectRegime(flat, 29, cfg).minSL, cfg.rangeMinSL);
  const trend = Array.from({ length: 30 }, (_, k) => ({ o: k * 10, c: k * 10 + 10, h: k * 10 + 12, l: k * 10 - 2 }));
  const r = S.detectRegime(trend, 29, cfg);
  assert.strictEqual(r.type, 'impulsion');
  assert.strictEqual(r.minSL, cfg.impulseMinSL);
});

test('étape 2 : une clôture sous la zone la casse, pas une mèche', () => {
  const m15 = [
    { o: 50, c: 45, h: 52, l: 44 }, { o: 45, c: 40, h: 46, l: 38 }, { o: 40, c: 30, h: 41, l: 29 },
    { o: 30, c: 32, h: 33, l: 20 }, // pivot bas -> demand 20-30
    { o: 32, c: 40, h: 41, l: 31 }, { o: 40, c: 45, h: 46, l: 39 },
    { o: 45, c: 30, h: 46, l: 15 }, // mèche sous la zone (stop hunt) mais clôture dedans
  ];
  let zones = S.buildZones(m15, 6, S.findPivots(m15, 6, cfg), cfg);
  assert.ok(zones.some((z) => z.side === 'demand' && z.bottom === 20));
  m15.push({ o: 30, c: 10, h: 31, l: 9 }); // clôture franche sous la zone
  zones = S.buildZones(m15, 7, S.findPivots(m15, 7, cfg), cfg);
  assert.ok(!zones.some((z) => z.side === 'demand' && z.bottom === 20));
});

test('étape 3 : AB=CD complété', () => {
  const zz = [
    { idx: 1, kind: 'high', price: 100 },
    { idx: 5, kind: 'low', price: 60 },
    { idx: 9, kind: 'high', price: 90 },
  ];
  const g = S.geometry(zz, 'buy', 50, 12, cfg); // CD = 40 = AB
  assert.ok(g.complete);
  assert.strictEqual(g.ratio, 1);
  assert.ok(!S.geometry(zz, 'buy', 80, 12, cfg).complete); // CD = 10 : pas complété
});

test('étape 4 : mèche basse sur bougie verte + exception avalement', () => {
  const zone = { side: 'demand', bottom: 100, top: 110, pivotIdx: 0 };
  const base = [{}, {}, {}];
  const wick = [...base, { o: 108, c: 112, h: 113, l: 101 }];
  assert.strictEqual(S.rejection(wick, 3, zone, 'buy', cfg).count, 1);
  const redNoEngulf = [...base, { o: 112, c: 109, h: 113, l: 101 }];
  assert.strictEqual(S.rejection(redNoEngulf, 3, zone, 'buy', cfg), null);
  const engulf = [...base, { o: 112, c: 109, h: 113, l: 101 }, { o: 109, c: 115, h: 116, l: 108 }];
  const r = S.rejection(engulf, 4, zone, 'buy', cfg);
  assert.ok(r && r.engulfing);
  const hunt = [...base, { o: 104, c: 108, h: 109, l: 95 }];
  assert.ok(S.rejection(hunt, 3, zone, 'buy', cfg).stopHunt);
});

test('étape 5 : 2 bougies vertes avec volume acheteur', () => {
  const m5 = Array.from({ length: 25 }, (_, k) => ({ o: 10, c: 9, h: 11, l: 8, v: 100, t: k }));
  m5.push({ o: 9, c: 12, h: 12, l: 8.5, v: 150 }, { o: 12, c: 14, h: 15, l: 11, v: 160 });
  assert.ok(S.confirmM5(m5, 26, 'buy', cfg));
  m5[26].v = 40; // volume trop faible
  assert.strictEqual(S.confirmM5(m5, 26, 'buy', cfg), null);
});

console.log('Scénario complet');
test('le robot achète sur la demand et vise la supply', () => {
  const { trades } = run(buyScenario(), cfg);
  assert.strictEqual(trades.length, 1, `trades: ${JSON.stringify(trades.map((t) => t.reason))}`);
  const t = trades[0];
  assert.strictEqual(t.side, 'buy');
  assert.ok(t.initialSL < 37901, `SL sous les mèches (${t.initialSL})`);
  assert.ok(t.tp > t.entry + (t.entry - t.initialSL) * cfg.minRR - 1e-9, 'R:R minimum respecté');
  assert.ok(S.inSession(t.entryTime, cfg));
});

test('mode rapide : SL 5 / TP 30', () => {
  const { trades } = run(buyScenario(), { ...cfg, quickMode: true });
  assert.strictEqual(trades.length, 1);
  assert.ok(Math.abs(trades[0].tp - trades[0].initialSL - 35) < 1e-9);
});

console.log('Or (XAUUSD)');
test('or par défaut : distances converties en dollars', () => {
  assert.strictEqual(config.market, 'gold');
  assert.strictEqual(gold.unit, '$');
  assert.strictEqual(gold.pointScale, 0.45);
  assert.ok(Math.abs(gold.impulseMinSL - 9) < 1e-9);   // 20 pts méthode = 9 $
  assert.ok(Math.abs(gold.maxSL - 18) < 1e-9);         // 40 pts méthode = 18 $
  assert.ok(Math.abs(gold.maxM15Range - 27) < 1e-9);
  assert.strictEqual(cfg.impulseMinSL, 20);            // Dow inchangé
  const methode = config.forMarket('gold', { mode: 'methode' });
  assert.ok(S.inSession(DAY + (10 * 60 + 30) * 60000, methode));   // 09:30 Paris : Londres
  assert.ok(!S.inSession(DAY + (15 * 60 + 35) * 60000, methode));  // 14:35 Paris : stats US, évité
});

// Même scénario ramené à l'échelle de l'or : 38000 -> 3800 $, écarts x pointScale.
function goldScenario() {
  return buyScenario().map((b) => {
    const g = (p) => 3800 + (p - 38000) * gold.pointScale;
    return { ...b, o: g(b.o), h: g(b.h), l: g(b.l), c: g(b.c) };
  });
}

test('or : le même setup déclenche le même achat', () => {
  const { trades } = run(goldScenario(), gold);
  assert.strictEqual(trades.length, 1);
  const t = trades[0];
  assert.strictEqual(t.side, 'buy');
  assert.ok(t.initialSL < 3800 + (37901 - 38000) * gold.pointScale, `SL sous les mèches (${t.initialSL})`);
  assert.ok((t.tp - t.entry) / (t.entry - t.initialSL) >= gold.minRR - 1e-9);
});

test('or : filtre anti-news sur une bougie M15 géante', () => {
  const { trades } = run(goldScenario(), { ...gold, maxM15Range: 1 });
  assert.strictEqual(trades.length, 0);
});

console.log('Mode H24 & petit compte');
test('or : horaires du PDF par défaut, jamais de position le week-end', () => {
  assert.strictEqual(gold.mode, 'methode');
  assert.strictEqual(cfg.mode, 'methode');
  assert.strictEqual(gold.maxMinutesAfterFirstTrade, 0); // les 2 créneaux chaque jour
  assert.strictEqual(gold.minRR, 2);
  const at = (day, h, m) => Date.UTC(2024, 0, day, h + 1, m);
  assert.ok(!S.canEnter(at(2, 3, 0), gold));   // mardi 03:00 : hors créneaux
  assert.ok(S.canEnter(at(2, 9, 30), gold));   // mardi 09:30 : Londres
  assert.ok(S.weekendClose(at(5, 22, 35), gold)); // vendredi 22:35 : clôture
});

test('mode H24 (option) : toute la journée sauf le rollover', () => {
  const h24 = config.forMarket('gold', { mode: 'h24' });
  const at = (day, h, m) => Date.UTC(2024, 0, day, h + 1, m); // heure serveur = Paris + 1
  assert.ok(S.canEnter(at(2, 3, 0), h24));    // mardi 03:00
  assert.ok(S.canEnter(at(2, 15, 0), h24));   // mardi 15:00
  assert.ok(!S.canEnter(at(2, 23, 30), h24)); // rollover
  assert.strictEqual(h24.maxMinutesAfterFirstTrade, 0); // pas de limite de 2 h
  assert.ok(S.canEnter(at(5, 20, 0), h24));   // vendredi 20:00
  assert.ok(!S.canEnter(at(5, 21, 30), h24)); // vendredi après 21:00 : plus d'entrée
  assert.ok(!S.weekendClose(at(5, 22, 0), h24));
  assert.ok(S.weekendClose(at(5, 22, 35), h24)); // clôture avant le week-end
  const g = new RiskGuard(h24);
  g.onOpen(at(2, 3, 0));
  assert.strictEqual(g.canTrade(at(2, 15, 0)), null); // plus de coupure « 2 h »
});

test('petit compte 90 $ : lot minimum si la perte reste <= 5 %', () => {
  const small = { ...gold, capital: 90 };
  assert.strictEqual(sizeLots(90, 4, small), 0.01);   // stop 4 $ -> perte 4 $ = 4,4 %
  assert.strictEqual(sizeLots(90, 6, small), 0);      // stop 6 $ -> 6,7 % : refusé
  assert.strictEqual(sizeLots(10000, 4, small), 0.25); // gros compte : 1 % = 100 $ / 400 $
});

test('petit compte : stop trop large refusé à 90 $, accepté à 300 $', () => {
  // Ce setup a un stop logique de ~13,8 $ : 0,01 lot risque 13,8 $.
  const at90 = run(goldScenario(), { ...gold, capital: 90 });
  assert.strictEqual(at90.trades.length, 0);   // 15 % du capital > 5 % : refusé
  assert.ok(at90.stats.skipped >= 1, 'setups refusés comptés');
  const at150 = run(goldScenario(), { ...gold, capital: 300 });
  assert.ok(at150.trades.length >= 1);         // 4,6 % : accepté au lot minimum
  const t = at150.trades[0];
  assert.strictEqual(t.lots, 0.01);
  assert.ok(Math.abs(t.pnl - t.points * 0.01 * 100) < 1e-9);
  const total = at150.trades.reduce((x, k) => x + k.pnl, 0);
  assert.ok(Math.abs(at150.stats.finalBalance - (300 + total)) < 1e-9);
});

console.log('Tendance & fondamental');
test('or : stratégie liquidité par défaut, annonces US filtrées', () => {
  assert.strictEqual(config.strategy, 'liquidity');
  assert.strictEqual(config.liqVolMode, true);
  assert.strictEqual(config.newsFilter, true);
  assert.strictEqual(config.trendFilter, false);
});

// Journée construite : Asie 01:00-08:00 entre 3000 et 3010, puis à 09:30 le prix dépasse le haut
// de l'Asie (sweep), et casse le dernier creux → vente attendue, stop au-dessus de la mèche.
function sweepDay() {
  const bars = [];
  const day = Date.UTC(2024, 0, 3); // mercredi, heure serveur = Paris + 1
  let p = 3005;
  // 30 jours d'historique calme pour la volatilité (bougies M5 de ~2 $)
  for (let t = day - 30 * 86400000; t < day; t += S.M5) {
    const wd = new Date(t - 3600000).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const o = p; p = 3005 + Math.sin(t / 3.6e6) * 4;
    bars.push({ t, o, c: p, h: Math.max(o, p) + 1, l: Math.min(o, p) - 1, v: 100 });
  }
  const at = (h, m) => day + ((h + 1) * 60 + m) * 60000;
  for (let t = at(0, 0); t < at(9, 0); t += S.M5) { const o = p; p = 3005 + Math.sin(t / 1.2e6) * 4.5; bars.push({ t, o, c: p, h: Math.min(3010, Math.max(o, p) + 0.5), l: Math.max(3000, Math.min(o, p) - 0.5), v: 100 }); }
  const seq = [ // [o, h, l, c] à partir de 09:00
    [3006, 3007, 3005, 3006.5], [3006.5, 3008, 3006, 3007.5], [3007.5, 3009, 3007, 3008.5], [3008.5, 3009.5, 3007.5, 3008],
    [3008, 3009, 3007, 3007.5], [3007.5, 3009.8, 3007.2, 3009], [3009, 3013, 3008.5, 3009.2], // sweep du haut Asie (3010)
    [3009.2, 3009.5, 3006.5, 3006.8], [3006.8, 3007, 3004, 3004.5], // cassure du creux (~3007) → MSS
    [3004.5, 3005, 3000, 3000.5], [3000.5, 3001, 2996, 2996.5], [2996.5, 2997, 2990, 2990.5], [2990.5, 2991, 2985, 2985.5],
  ];
  seq.forEach(([o, h, l, c], k) => bars.push({ t: at(9, 0) + k * S.M5, o, h, l, c, v: 150 }));
  return bars;
}

test('liquidité : sweep du haut asiatique puis cassure de structure = vente', () => {
  // on ne trade que la journée construite (l'historique sert à la volatilité)
  const c = config.forMarket('gold', { newsFilter: false, startTime: Date.UTC(2024, 0, 3) + 3600000 });
  const { trades } = run(sweepDay(), c);
  assert.strictEqual(trades.length, 1, JSON.stringify(trades));
  const t = trades[0];
  assert.strictEqual(t.side, 'sell');
  assert.ok(t.initialSL > 3013, `stop au-dessus de la mèche du sweep (${t.initialSL})`);
  assert.ok(Math.abs((t.price - t.tp) - c.liqTargetR * (t.initialSL - t.price)) < 1e-6, 'target à 3R du prix de signal');
  assert.ok(t.checklist.zone.includes('haut Asie'));
});

test('tendance : EMA qui monte = achats seulement, qui baisse = ventes seulement', () => {
  const mk = (slope) => Array.from({ length: 288 * 80 }, (_, i) => {
    const p = 3000 + slope * i / 288; return { t: DAY + i * S.M5, o: p, h: p + 1, l: p - 1, c: p + slope * 0.001, v: 100 };
  });
  const c = { ...config.forMarket('gold'), trendTimeframe: 'D1', trendEmaPeriod: 20 };
  const up = F.trendTracker(mk(5), c); const down = F.trendTracker(mk(-5), c);
  const end = DAY + 288 * 80 * S.M5;
  assert.strictEqual(up(end), 1);
  assert.strictEqual(down(end), -1);
  assert.strictEqual(F.trendTracker(mk(5), c)(DAY + 5 * 86400000), 0); // pas assez d'historique : neutre
});

test('fondamental : entrées bloquées autour du NFP', () => {
  const nfp = US_NEWS.find((n) => n.name === 'NFP');
  const c = config.forMarket('gold');
  const server = (parisMs) => parisMs + c.serverMinusParisHours * 3600000;
  assert.ok(F.newsBlocked(server(nfp.t - 30 * 60000), c));   // 30 min avant
  assert.ok(F.newsBlocked(server(nfp.t + 90 * 60000), c));   // 1 h 30 après
  assert.ok(!F.newsBlocked(server(nfp.t + 5 * 3600000), c)); // 5 h après : libre
});

console.log('Garde-fous');
test('stop suiveur : ne s\'éloigne jamais', () => {
  const pos = { side: 'buy', entry: 100, sl: 90, risk: 10 };
  assert.strictEqual(trail(pos, { c: 105 }, cfg), 90);
  assert.strictEqual(trail(pos, { c: 111 }, cfg), 101);
  const moved = { ...pos, sl: 110 };
  assert.strictEqual(trail(moved, { c: 112 }, cfg), 110); // jamais reculé
});

test('pause de 2 h après une perte, max pertes/jour', () => {
  const g = new RiskGuard(cfg);
  const t = DAY + 11 * 3600000;
  assert.strictEqual(g.canTrade(t), null);
  g.onOpen(t);
  g.onClose(t + 600000, -1);
  assert.strictEqual(g.canTrade(t + 30 * 60000), 'pause après perte');
  assert.strictEqual(g.canTrade(t + 125 * 60000), '2 h de trading écoulées');
  const g2 = new RiskGuard({ ...cfg, maxMinutesAfterFirstTrade: 1e9, pauseAfterLossMinutes: 0 });
  g2.onOpen(t); g2.onClose(t, -1); g2.onOpen(t); g2.onClose(t, -1);
  assert.strictEqual(g2.canTrade(t + 1), 'max pertes/jour');
  assert.strictEqual(g2.canTrade(t + 24 * 3600000), null); // nouveau jour
});

test('invariants sur 60 jours aléatoires', () => {
  const bars = randomWalk(288 * 60);
  const { trades, stats } = run(bars, cfg);
  let prevExit = -Infinity;
  const perDay = {};
  for (const t of trades) {
    assert.ok(t.entryTime > prevExit, 'une seule position à la fois');
    prevExit = t.exitTime;
    assert.ok(S.inSession(t.entryTime, cfg), 'entrée hors session');
    const d = S.parisDay(t.entryTime, cfg);
    perDay[d] = (perDay[d] || 0) + 1;
    assert.ok(perDay[d] <= cfg.maxTradesPerDay);
    assert.ok(t.r >= -1 - cfg.spread / t.risk - 1e-9, 'perte > 1R : stop élargi ?');
  }
  assert.ok(Number.isFinite(stats.finalBalance));
  console.log(`    (${stats.trades} trades simulés sur données aléatoires)`);
});

console.log(`\n${passed} test(s) OK`);
