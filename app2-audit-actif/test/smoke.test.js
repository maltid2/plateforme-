'use strict';

/**
 * Test de fumée — App 2 (audit actif)
 *
 * Vérifie la logique pure sans dépendance réseau :
 *   - le gate légal bloque sans consentement / mandat
 *   - le fingerprinting extrait bien service + version
 *   - un scan est refusé sans consentement valide
 *
 * Exécution : node test/smoke.test.js
 */

const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Rediriger le journal de consentement vers un fichier temporaire pour ne
// pas polluer logs/consent-log.json pendant les tests.
const tmpLog = path.join(os.tmpdir(), 'consent-log-test-' + Date.now() + '.json');

const consentGate = require('../src/auth/consent-gate');
const bannerGrab = require('../src/scanner/banner-grab');
const portScan = require('../src/scanner/port-scan');

let passed = 0;
function check(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log('  ok ' + name);
    })
    .catch((err) => {
      console.error('  x ECHEC : ' + name + ' -> ' + err.message);
      process.exitCode = 1;
    });
}

console.log('Smoke tests — App 2 (audit actif)');

check('gate : refuse une confirmation invalide', () => {
  const r = consentGate.requestConsent({
    target: '203.0.113.10',
    user: 'op@ex.com',
    confirmation: 'ok je veux bien',
    mandateOnFile: true,
  });
  assert.strictEqual(r.granted, false);
});

check('gate : refuse sans mandat écrit', () => {
  const r = consentGate.requestConsent({
    target: '203.0.113.10',
    user: 'op@ex.com',
    confirmation: consentGate.CONSENT_PHRASE,
    mandateOnFile: false,
  });
  assert.strictEqual(r.granted, false);
});

check('gate : phrase tolérante aux accents/casse', () => {
  assert.ok(consentGate.phraseMatches('je certifie etre autorise a tester ce systeme'));
  assert.ok(consentGate.phraseMatches('  Je Certifie Être Autorisé À Tester Ce Système '));
  assert.ok(!consentGate.phraseMatches('autre phrase'));
});

check('assertConsent : bloque une cible sans consentement', () => {
  const r = consentGate.assertConsent('198.51.100.99');
  assert.strictEqual(r.ok, false);
});

check('fingerprint : extrait OpenSSH + version', () => {
  const fp = bannerGrab.fingerprint('SSH-2.0-OpenSSH_8.9p1 Ubuntu-3\r\n', 22);
  assert.strictEqual(fp.service, 'OpenSSH');
  assert.strictEqual(fp.version, '8.9p1');
  assert.ok(fp.cpe.includes('openssh'));
});

check('fingerprint : extrait nginx depuis un header HTTP', () => {
  const fp = bannerGrab.fingerprint(
    'HTTP/1.1 200 OK\r\nServer: nginx/1.24.0\r\n\r\n',
    80
  );
  assert.strictEqual(fp.service, 'nginx');
  assert.strictEqual(fp.version, '1.24.0');
});

check('port-scan : expose une liste top ports non vide', () => {
  assert.ok(Array.isArray(portScan.TOP_100_PORTS));
  assert.ok(portScan.TOP_100_PORTS.includes(22));
  assert.ok(portScan.TOP_100_PORTS.includes(443));
});

check('runScan : bloqué sans consentement (bout en bout)', async () => {
  const { runScan } = require('../src/index');
  await assert.rejects(
    () => runScan('192.0.2.55', { ports: [80] }),
    (err) => err.code === 'CONSENT_REQUIRED'
  );
});

const roe = require('../src/auth/rules-of-engagement');

check('RoE : matching CIDR IPv4 correct', () => {
  assert.ok(roe.ipInScopeEntry('203.0.113.10', '203.0.113.0/24'));
  assert.ok(!roe.ipInScopeEntry('203.0.114.10', '203.0.113.0/24'));
  assert.ok(roe.ipInScopeEntry('10.0.0.5', '10.0.0.5'));
});

check('RoE : targetInScope hôte + IP', () => {
  const scope = ['app.client.com', '203.0.113.0/24'];
  assert.ok(roe.targetInScope('app.client.com', scope));
  assert.ok(roe.targetInScope('203.0.113.42', scope));
  assert.ok(!roe.targetInScope('autre.com', scope));
  assert.ok(!roe.targetInScope('198.51.100.1', scope));
});

check('RoE : authorize bloque une cible hors périmètre', () => {
  const r = roe.authorize('8.8.8.8');
  assert.strictEqual(r.ok, false);
});

check('verify : bloqué si cible hors périmètre (bout en bout)', async () => {
  const verifier = require('../src/verify');
  await assert.rejects(
    () => verifier.run('scanme.invalid.example', { timeout: 500 }),
    (err) => err.code === 'OUT_OF_SCOPE'
  );
});

check('RoE : registerEngagement refuse un périmètre vide', () => {
  const r = roe.registerEngagement({
    operator: 'op@ex.com',
    engagementRef: 'REF-1',
    scope: [],
    confirmation: 'Je certifie être autorisé à tester ce système',
    mandateOnFile: true,
  });
  assert.strictEqual(r.ok, false);
});

process.on('exit', () => {
  try { fs.unlinkSync(tmpLog); } catch (e) {}
  if (!process.exitCode) {
    console.log('\n' + passed + ' assertions passées. Tous les smoke tests sont OK.');
  } else {
    console.error('\nDes tests ont échoué.');
  }
});
