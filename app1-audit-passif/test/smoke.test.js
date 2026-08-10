'use strict';

/**
 * Test de fumée (smoke test) — vérifie l'assemblage des modules sans
 * dépendre du réseau (le scoring, le rendu HTML et la logique pure sont
 * testés avec des données factices).
 *
 * Exécution : node test/smoke.test.js
 */

const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Isole le stockage des comptes dans un dossier temporaire (avant tout require
// qui utiliserait le store).
process.env.AUDIT_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-data-'));

const scoring = require('../src/scoring/engine');
const reportGen = require('../src/report/generator');
const ssl = require('../src/modules/ssl');
const headers = require('../src/modules/headers');
const accounts = require('../src/auth/accounts');
const stripe = require('../src/billing/stripe');
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

// --- Comptes clients / abonnement / self-service ---

check('compte : création renvoie une clé, statut inactif', () => {
  const r = accounts.createAccount({ email: 'client@exemple.com' });
  assert.ok(r.ok);
  assert.ok(/^sk_live_/.test(r.apiKey));
  assert.strictEqual(r.account.status, 'inactive');
  assert.strictEqual(r.account.active, false);
});

check('compte : email invalide refusé + pas de doublon', () => {
  assert.strictEqual(accounts.createAccount({ email: 'pasunemail' }).ok, false);
  accounts.createAccount({ email: 'dup@exemple.com' });
  assert.strictEqual(accounts.createAccount({ email: 'dup@exemple.com' }).ok, false);
});

check('compte : findByKey retrouve, clé fausse => null', () => {
  const r = accounts.createAccount({ email: 'find@exemple.com' });
  const found = accounts.findByKey(r.apiKey);
  assert.ok(found && found.email === 'find@exemple.com');
  assert.strictEqual(accounts.findByKey('sk_live_faux'), null);
});

check('abonnement : inactif bloque, activation => illimité', () => {
  const r = accounts.createAccount({ email: 'gate@exemple.com' });
  let acc = accounts.findByKey(r.apiKey);
  assert.strictEqual(accounts.isActive(acc), false); // paiement requis

  accounts.activate('gate@exemple.com', { days: 30 });
  acc = accounts.findByKey(r.apiKey);
  assert.strictEqual(accounts.isActive(acc), true); // paye => accès

  // « autant d'audits qu'il veut » : recordAudit n'impose aucun plafond.
  for (let i = 0; i < 100; i++) accounts.recordAudit(acc);
  assert.ok(accounts.isActive(accounts.findByKey(r.apiKey)));
});

check('abonnement : expiration désactive l\'accès', () => {
  const r = accounts.createAccount({ email: 'exp@exemple.com' });
  accounts.activate('exp@exemple.com', { days: 30 });
  // On force une échéance passée.
  const acc = accounts.findByEmail('exp@exemple.com');
  acc.validUntil = new Date(Date.now() - 1000).toISOString();
  assert.strictEqual(accounts.isActive(acc), false);
});

check('stripe : signature de webhook valide acceptée, altérée rejetée', () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  const payload = JSON.stringify({ type: 'checkout.session.completed', data: { object: {} } });
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', 'whsec_test_secret')
    .update(t + '.' + payload, 'utf8').digest('hex');
  const header = 't=' + t + ',v1=' + sig;
  assert.strictEqual(stripe.verifyWebhookSignature(payload, header).ok, true);
  // Payload altéré => signature invalide.
  assert.strictEqual(stripe.verifyWebhookSignature(payload + 'x', header).ok, false);
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

check('stripe : parseEvent => activate sur paiement', () => {
  const ev = { type: 'invoice.paid', data: { object: { client_reference_id: 'acc-1', customer: 'cus_1' } } };
  const d = stripe.parseEvent(ev);
  assert.strictEqual(d.action, 'activate');
  assert.strictEqual(d.ref, 'acc-1');
});

// Nettoyage du dossier de données temporaire.
process.on('exit', () => {
  try {
    fs.rmSync(process.env.AUDIT_DATA_DIR, { recursive: true, force: true });
  } catch (e) { /* noop */ }
});

console.log('\n' + passed + ' assertions passées.');
if (process.exitCode) {
  console.error('Des tests ont échoué.');
} else {
  console.log('Tous les smoke tests sont OK.');
}
