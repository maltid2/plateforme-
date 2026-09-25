'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-'));
process.env.GD_DATA_DIR = DATA;
process.env.GD_PASSWORD = 'secret';

const { buildReport, reportText } = require('../src/report');
const { buildTrades, parisDayKey } = require('../src/journal');
const { handle } = require('../src/server');
const { generate } = require('../src/demo');

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// Mardi 22/09/2026, heure serveur = Paris + 1 h
const T = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return Date.UTC(2026, 8, 22, h + 1, m) / 1000;
};
const DAY = '2026-09-22';

function trade(pos, open, close, { side = 'buy', entry = 42000, sl = 41980, exit, reason = 'TP', trails = [], balance }) {
  const dir = side === 'buy' ? 1 : -1;
  const ex = exit ?? entry + dir * 40;
  const r = ((ex - entry) * dir) / Math.abs(entry - sl);
  const ev = [{ type: 'open', t: T(open), pos, side, lots: 1, entry, sl, tp: entry + dir * 40, risk: Math.abs(entry - sl), balance: balance - r * 100, checklist: { type: 'range', zone: 'demand 41990-41998' } }];
  for (const [at, s] of trails) ev.push({ type: 'trail', t: T(at), pos, sl: s });
  ev.push({ type: 'close', t: T(close), pos, side, exit: ex, profit: r * 100, points: (ex - entry) * dir, r, reason, balance });
  return ev;
}

test('assemblage des trades à partir des événements', () => {
  const ev = [...trade(1, '10:30', '11:00', { balance: 10200 })];
  const { trades } = buildTrades(ev);
  assert.strictEqual(trades.length, 1);
  assert.strictEqual(trades[0].r, 2);
  assert.strictEqual(parisDayKey(trades[0].openT, 1), DAY);
});

test('rapport : bilan et règles respectées', () => {
  const ev = [
    ...trade(1, '10:30', '11:00', { exit: 41980, reason: 'SL', balance: 9900 }),
    ...trade(2, '18:10', '18:40', { balance: 10100, trails: [['18:20', 41995], ['18:30', 42010]] }),
    { type: 'block', t: T('11:05'), reason: 'pause après perte' },
  ];
  const r = buildReport(ev, DAY, { offset: 1, params: { maxTradesPerDay: 3, pauseAfterLossMinutes: 120 } });
  assert.strictEqual(r.summary.trades, 2);
  assert.strictEqual(r.summary.wins, 1);
  assert.strictEqual(r.summary.r, 1);
  assert.ok(r.rules.every((c) => c.ok), JSON.stringify(r.rules));
  assert.deepStrictEqual(r.blocks, [{ time: '11:05', reason: 'pause après perte' }]);
  assert.strictEqual(r.trades[0].open, '10:30');
  assert.ok(reportText(r).includes('rapport du 2026-09-22'));
});

test('audit : stop élargi et trade de vengeance détectés', () => {
  const ev = [
    ...trade(1, '10:30', '11:00', { exit: 41960, reason: 'SL', balance: 9800, trails: [['10:40', 41970]] }),
    ...trade(2, '11:10', '11:40', { balance: 10000 }),
  ];
  const r = buildReport(ev, DAY, { offset: 1, params: { pauseAfterLossMinutes: 120 } });
  const byRule = Object.fromEntries(r.rules.map((c) => [c.rule, c.ok]));
  assert.strictEqual(byRule['Stop jamais élargi'], false);
  assert.strictEqual(byRule['Pause après perte (pas de trade de vengeance)'], false);
});

test('rapport d\'un jour sans trade', () => {
  const r = buildReport([], DAY, { offset: 1 });
  assert.strictEqual(r.summary.trades, 0);
  assert.ok(r.psychology.includes('ne pas trader'));
});

test('démo : fichiers identiques à ceux de l\'EA', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-demo-'));
  const res = generate(dir);
  assert.ok(res.trades > 0);
  const state = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
  for (const k of ['t', 'offset', 'regime', 'zones', 'm15', 'checklist', 'params']) assert.ok(k in state, k);
  assert.ok(fs.readdirSync(path.join(dir, 'reports')).length > 0);
});

// --- API --------------------------------------------------------------------
function request(port, method, url, { auth = 'secret', body } = {}) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (auth) headers.Authorization = `Basic ${Buffer.from(`u:${auth}`).toString('base64')}`;
    if (body) headers['Content-Type'] = 'application/json';
    const req = http.request({ host: '127.0.0.1', port, method, path: url, headers }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
}

test('API : authentification, rapport, note, fichiers protégés', async () => {
  fs.writeFileSync(path.join(DATA, 'events.jsonl'), `${trade(7, '10:30', '11:00', { balance: 10200 }).map((e) => JSON.stringify(e)).join('\n')}\n{ligne cassée\n`);
  fs.writeFileSync(path.join(DATA, 'state.json'), JSON.stringify({ t: T('11:05'), offset: 1, params: {} }));
  const server = http.createServer((q, s) => handle(q, s));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  try {
    assert.strictEqual((await request(port, 'GET', '/api/dashboard', { auth: null })).status, 401);
    assert.strictEqual((await request(port, 'GET', '/api/dashboard', { auth: 'faux' })).status, 401);
    const dash = JSON.parse((await request(port, 'GET', '/api/dashboard')).body);
    assert.strictEqual(dash.total.trades, 1);
    assert.strictEqual(dash.todaySummary.trades, 1);

    const gen = await request(port, 'POST', `/api/reports/${DAY}/generate`);
    assert.strictEqual(JSON.parse(gen.body).summary.trades, 1);
    const note = await request(port, 'POST', `/api/reports/${DAY}/note`, { body: { text: 'Resté patient.' } });
    assert.strictEqual(JSON.parse(note.body).note, 'Resté patient.');
    const list = JSON.parse((await request(port, 'GET', '/api/reports')).body);
    assert.strictEqual(list[0].day, DAY);

    assert.strictEqual((await request(port, 'GET', '/api/reports/..%2F..%2Fetc')).status, 400);
    assert.strictEqual((await request(port, 'GET', '/%2e%2e/src/server.js')).status, 404);
    assert.strictEqual((await request(port, 'GET', '/')).status, 200);
  } finally {
    server.close();
  }
});

(async () => {
  for (const [name, fn] of tests) {
    try {
      await fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (e) {
      console.error(`  ✗ ${name}\n    ${e.stack}`);
      process.exitCode = 1;
    }
  }
  console.log(`\n${passed}/${tests.length} test(s) OK`);
})();
