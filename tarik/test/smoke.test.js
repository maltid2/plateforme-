'use strict';

const assert = require('assert');
const genetec = require('../src/sources/genetec');
const { check } = require('../src/compat');
const { compareVersions } = require('../src/lib/version');
const { parseFirmwareFile } = require('../src/lib/firmware-file');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('✓ ' + name); };

// Réponse réelle de l'API Genetec (fiche PNM-9322VQP, octobre 2026).
const DEVICE = genetec.normalize(require('./fixtures/pnm-9322vqp.json'));
const DB = [DEVICE];

test('comparaison de versions', () => {
  assert.strictEqual(compareVersions('2.24.01', '2.22.02'), 1);
  assert.strictEqual(compareVersions('1.33.03_20220420_R128', '1.33.03'), 0);
  assert.strictEqual(compareVersions('5.11', '5.11.0.1'), -1);
  assert.strictEqual(compareVersions('n/a', '1.0'), null);
});

test('nom de fichier firmware Hanwha', () => {
  assert.deepStrictEqual(parseFirmwareFile('PNM-9322VQP_2.24.01_20260827_R3.zip'),
    { model: 'PNM-9322VQP', version: '2.24.01', date: '2026-08-27', manufacturer: 'Hanwha' });
});

test('nom de fichier firmware Axis', () => {
  const f = parseFirmwareFile('P3245-LVE_10_12_182.bin');
  assert.strictEqual(f.version, '10.12.182');
  assert.strictEqual(f.manufacturer, 'Axis');
});

test('normalisation de la réponse API', () => {
  assert.strictEqual(DEVICE.manufacturer, 'Hanwha Vision');
  assert.strictEqual(DEVICE.model, 'PNM-9322VQP');
  assert.strictEqual(DEVICE.status, 'Certified');
  assert.strictEqual(DEVICE.securityCenter, '5.9.4.0');
  assert.deepStrictEqual(DEVICE.firmwares.map((f) => f.version),
    ['1.33.00', '1.33.03_20220420_R128', '2.22.00', '2.22.01', '2.22.02']);
  assert.strictEqual(DEVICE.firmwares[1].driverPack, '10.10.0');
});

test('firmware plus récent que le plus haut listé → non validé', () => {
  const [r] = check(DB, { model: 'PNM-9322VQP', firmware: '2.24.01', securityCenter: '5.11.3.15' });
  assert.strictEqual(r.status, 'non validé');
});

test('firmware certifié + SC récent → compatible', () => {
  const [r] = check(DB, { model: 'pnm9322vqp', firmware: '2.22.00', securityCenter: '5.11.3.15' });
  assert.strictEqual(r.status, 'compatible');
});

test('firmware « Supported by Design » → à vérifier', () => {
  const [r] = check(DB, { model: 'PNM-9322VQP', firmware: '2.22.02', securityCenter: '5.11.3.15' });
  assert.strictEqual(r.status, 'compatible (à vérifier)');
});

test('Security Center trop ancien → incompatible', () => {
  const [r] = check(DB, { model: 'PNM-9322VQP', firmware: '1.33.03', securityCenter: '5.8.1' });
  assert.strictEqual(r.status, 'incompatible');
});

test('modèle absent', () => {
  assert.strictEqual(check(DB, { model: 'XYZ-0000' }).length, 0);
});

console.log(`\n${passed} tests OK`);
