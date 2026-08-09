'use strict';

/**
 * Test de fumée (smoke test) — vérifie l'assemblage des modules sans
 * dépendre du réseau (le scoring, le rendu HTML et la logique pure sont
 * testés avec des données factices).
 *
 * Exécution : node test/smoke.test.js
 */

const assert = require('assert');
const scoring = require('../src/scoring/engine');
const reportGen = require('../src/report/generator');
const ssl = require('../src/modules/ssl');
const headers = require('../src/modules/headers');
const { normalizeUrl } = require('../src/index');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✔ ' + name);
  } catch (err) {
    console.error('  x ECHEC : ' + name);
    console.error('    ' + err.message);
    process.exitCode = 1;
  }
}

console.log('Smoke tests — App 1 (audit passif)');

check('normalizeUrl ajoute https://', () => {
  assert.strictEqual(normalizeUrl('exemple.com'), 'https://exemple.com/');
});

check('protocolScore pénalise les protocoles obsolètes', () => {
  assert.strictEqual(ssl.protocolScore('TLSv1.3').note, 100);
  assert.ok(ssl.protocolScore('TLSv1').obsolete);
  assert.ok(ssl.protocolScore('SSLv3').note < 20 + 1);
});

check('la grille headers contient les en-têtes clés', () => {
  const keys = headers.HEADER_CHECKS.map((h) => h.key);
  ['strict-transport-security', 'content-security-policy', 'x-frame-options',
   'x-content-type-options', 'referrer-policy'].forEach((k) => {
    assert.ok(keys.includes(k), 'manque : ' + k);
  });
});

check('scoring : moyenne pondérée + mapping lettre', () => {
  const modules = [
    { module: 'A1', name: 'SSL/TLS', score: 100, findings: [] },
    { module: 'A2', name: 'Headers', score: 100, findings: [] },
    { module: 'A3', name: 'Fichiers', score: 100, findings: [] },
  ];
  const r = scoring.compute(modules);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.letter, 'A');
});

check('scoring : mapping des lettres', () => {
  assert.strictEqual(scoring.scoreToLetter(95), 'A');
  assert.strictEqual(scoring.scoreToLetter(80), 'B');
  assert.strictEqual(scoring.scoreToLetter(65), 'C');
  assert.strictEqual(scoring.scoreToLetter(50), 'D');
  assert.strictEqual(scoring.scoreToLetter(20), 'F');
});

check('scoring : module dégradé sans finding est exclu', () => {
  const modules = [
    { module: 'A1', name: 'SSL', score: 40, findings: [] },
    { module: 'B', name: 'Réputation', score: 100, degraded: true,
      findings: [{ severity: 'info', message: 'x' }] },
  ];
  const r = scoring.compute(modules);
  // Seul A1 compte -> score 40
  assert.strictEqual(r.score, 40);
});

check('générateur HTML produit un document complet', () => {
  const report = {
    target: 'https://exemple.com/',
    generatedAt: new Date().toISOString(),
    scoring: scoring.compute([
      { module: 'A1', name: 'SSL/TLS', score: 90,
        findings: [{ severity: 'medium', message: 'Test', recommendation: 'Faire X' }] },
    ]),
    modules: [
      { module: 'A1', name: 'SSL/TLS', score: 90,
        findings: [{ severity: 'medium', message: 'Test', recommendation: 'Faire X' }] },
    ],
  };
  const html = reportGen.buildHtml(report);
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('exemple.com'));
  assert.ok(html.includes('Recommandation'));
});

console.log('\n' + passed + ' assertions passées.');
if (process.exitCode) {
  console.error('Des tests ont échoué.');
} else {
  console.log('Tous les smoke tests sont OK.');
}
