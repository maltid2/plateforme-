'use strict';

const assert = require('assert');
const genetec = require('../src/sources/genetec');
const { check } = require('../src/compat');
const { compareVersions } = require('../src/lib/version');
const { parseFirmwareFile } = require('../src/lib/firmware-file');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('✓ ' + name); };

const LIST_HTML = `
<table class="sdl">
  <thead><tr><th>Manufacturer</th><th>Model</th><th>Device type</th>
    <th>Latest firmware supported (SC)</th><th>Supported since</th></tr></thead>
  <tbody>
    <tr><td>Hanwha Vision</td><td><a href="/solutions/resources/supported-device-list/detail?pid=2528">PNM-9322VQP</a></td>
      <td>Camera</td><td>2.23.00</td><td>Security Center: 5.11.0.1 Driver Pack 11.11.0</td></tr>
    <tr><td>Axis</td><td><a href="detail?pid=12">P3245-LVE</a></td><td>Camera</td>
      <td>10.12.182</td><td>Security Center: 5.10.2.0</td></tr>
  </tbody>
</table>`;

const DETAIL_HTML = `<dl><dt>Manufacturer</dt><dd>Hanwha Vision</dd>
  <dt>Model</dt><dd>PNM-9322VQP</dd><dt>Latest firmware supported (SC)</dt><dd>2.23.00</dd>
  <dt>Security Center</dt><dd>5.11.0.1 &amp; Driver Pack 11.11.0</dd></dl>`;

test('comparaison de versions', () => {
  assert.strictEqual(compareVersions('2.24.01', '2.23.00'), 1);
  assert.strictEqual(compareVersions('5.11', '5.11.0.1'), -1);
  assert.strictEqual(compareVersions('V5.7.3_build 220112', '5.7.3'), 0);
  assert.strictEqual(compareVersions('n/a', '1.0'), null);
});

test('nom de fichier firmware Hanwha', () => {
  const f = parseFirmwareFile('PNM-9322VQP_2.24.01_20260827_R3.zip');
  assert.deepStrictEqual(f, { model: 'PNM-9322VQP', version: '2.24.01', date: '2026-08-27', manufacturer: 'Hanwha' });
});

test('nom de fichier firmware Axis', () => {
  const f = parseFirmwareFile('P3245-LVE_10_12_182.bin');
  assert.strictEqual(f.version, '10.12.182');
  assert.strictEqual(f.manufacturer, 'Axis');
});

test('parsing page de liste', () => {
  const list = genetec.parseListPage(LIST_HTML);
  assert.strictEqual(list.length, 2);
  const h = list[0];
  assert.strictEqual(h.manufacturer, 'Hanwha Vision');
  assert.strictEqual(h.model, 'PNM-9322VQP');
  assert.strictEqual(h.firmware, '2.23.00');
  assert.strictEqual(h.securityCenter, '5.11.0.1');
  assert.strictEqual(h.driverPack, '11.11.0');
  assert.strictEqual(h.pid, '2528');
});

test('parsing fiche détail', () => {
  const d = genetec.parseDetailPage(DETAIL_HTML, 2528);
  assert.strictEqual(d.model, 'PNM-9322VQP');
  assert.strictEqual(d.firmware, '2.23.00');
  assert.strictEqual(d.securityCenter, '5.11.0.1');
});

test('verdicts de compatibilité', () => {
  const db = genetec.parseListPage(LIST_HTML);
  const newer = check(db, { model: 'pnm9322', firmware: '2.24.01', securityCenter: '5.11.0.1' })[0];
  assert.strictEqual(newer.status, 'non validé');
  const tooOld = check(db, { model: 'PNM-9322VQP', firmware: '2.23.00', securityCenter: '5.10' })[0];
  assert.strictEqual(tooOld.status, 'incompatible');
  const ok = check(db, { manufacturer: 'axis', model: 'P3245', firmware: '10.12.182', securityCenter: '5.12' })[0];
  assert.strictEqual(ok.status, 'compatible');
  const branch = check(db, { manufacturer: 'axis', model: 'P3245', firmware: '10.12.182', securityCenter: '5.10' })[0];
  assert.strictEqual(branch.status, 'compatible (à vérifier)');
  assert.strictEqual(check(db, { model: 'XYZ-0000' }).length, 0);
});

console.log(`\n${passed} tests OK`);
