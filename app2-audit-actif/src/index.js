'use strict';

/**
 * App 2 — Audit Serveur Actif : orchestrateur principal
 *
 * Scan actif des ports + fingerprinting de service + matching CVE.
 * UNIQUEMENT après passage par le gate légal (consent-gate.js).
 *
 * Aucun scan ne peut démarrer sans consentement valide : `runScan` appelle
 * `assertConsent` en tout premier et interrompt immédiatement sinon.
 *
 * Usage CLI (deux étapes obligatoires) :
 *   1) Enregistrer le consentement :
 *      node src/index.js consent --target 203.0.113.10 \
 *           --user "op@exemple.com" --mandate CONTRAT-2026-042 \
 *           --confirm "Je certifie être autorisé à tester ce système"
 *   2) Lancer le scan :
 *      node src/index.js scan --target 203.0.113.10
 */

require('./lib/env').loadEnv();

const consentGate = require('./auth/consent-gate');
const portScan = require('./scanner/port-scan');
const bannerGrab = require('./scanner/banner-grab');
const cveMatcher = require('./cve/matcher');
const roe = require('./auth/rules-of-engagement');
const verifier = require('./verify');

/**
 * Enregistre un consentement (étape 1).
 */
function grantConsent(params) {
  return consentGate.requestConsent(params);
}

/**
 * Exécute le scan actif complet (étape 2).
 * @param {string} target - IP ou hôte
 * @param {object} [options] - { ports, timeout, concurrency, minCvss, maxAgeMs, log }
 * @returns {Promise<object>} rapport structuré
 */
async function runScan(target, options = {}) {
  const log = options.log || (() => {});

  // --- GATE LÉGAL : bloquant, en tout premier ---
  const consent = consentGate.assertConsent(target, { maxAgeMs: options.maxAgeMs });
  if (!consent.ok) {
    const err = new Error('SCAN BLOQUÉ — ' + consent.reason);
    err.code = 'CONSENT_REQUIRED';
    throw err;
  }
  log('✔ Consentement validé (id ' + consent.entry.id + ', opérateur ' + consent.entry.user + ')');

  const report = {
    target,
    startedAt: new Date().toISOString(),
    consent: {
      id: consent.entry.id,
      user: consent.entry.user,
      timestamp: consent.entry.timestamp,
      mandateRef: consent.entry.mandateRef,
    },
    portScan: null,
    services: null,
    finishedAt: null,
  };

  // --- Scan de ports ---
  log('▶ Scan TCP connect en cours...');
  const scanResult = await portScan.scan(target, {
    ports: options.ports,
    timeout: options.timeout,
    concurrency: options.concurrency,
    onProgress: options.onProgress,
  });
  report.portScan = {
    scanned: scanResult.scanned,
    open: scanResult.open,
  };
  log('✔ ' + scanResult.open.length + ' port(s) ouvert(s) : ' + (scanResult.open.join(', ') || '—'));

  // --- Fingerprinting ---
  let services = [];
  if (scanResult.open.length) {
    log('▶ Banner grabbing sur les ports ouverts...');
    services = await bannerGrab.grabAll(target, scanResult.open, {
      timeout: options.timeout ? Math.max(options.timeout, 2000) : 3000,
    });
  }

  // --- Matching CVE ---
  log('▶ Matching CVE (NVD)...');
  const enriched = await cveMatcher.matchServices(services, {
    minCvss: options.minCvss,
    timeout: options.timeout,
  });
  report.services = enriched;

  const totalCritical = enriched.reduce((s, e) => s + (e.criticalCount || 0), 0);
  const totalHigh = enriched.reduce((s, e) => s + (e.highCount || 0), 0);
  report.summary = {
    openPorts: scanResult.open.length,
    servicesIdentified: enriched.filter((e) => e.service).length,
    criticalCVE: totalCritical,
    highCVE: totalHigh,
  };

  report.finishedAt = new Date().toISOString();
  log(
    '✔ Terminé — ' +
      report.summary.servicesIdentified +
      ' service(s) identifié(s), ' +
      totalCritical +
      ' CVE critique(s), ' +
      totalHigh +
      ' CVE élevée(s).'
  );

  return report;
}

// --- CLI ---
function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      flags[key] = val;
    }
  }
  return flags;
}

if (require.main === module) {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  if (command === 'consent') {
    const res = grantConsent({
      target: flags.target,
      user: flags.user,
      confirmation: flags.confirm,
      mandateOnFile: true, // la présence du flag --mandate matérialise le mandat
      mandateRef: flags.mandate,
    });
    if (res.granted) {
      console.log('✔ Consentement enregistré :');
      console.log(JSON.stringify(res.entry, null, 2));
    } else {
      console.error('✗ Consentement refusé : ' + res.reason);
      process.exit(1);
    }
  } else if (command === 'scan') {
    if (!flags.target) {
      console.error('Usage : node src/index.js scan --target <ip|host> [--minCvss 7]');
      process.exit(1);
    }
    const ports = flags.ports
      ? String(flags.ports).split(',').map((p) => parseInt(p.trim(), 10)).filter(Boolean)
      : undefined;
    runScan(flags.target, {
      ports,
      minCvss: flags.minCvss != null ? Number(flags.minCvss) : undefined,
      log: console.log,
    })
      .then((report) => {
        console.log('\n=== Rapport ===');
        console.log(JSON.stringify(report.summary, null, 2));
      })
      .catch((err) => {
        console.error('\n' + err.message);
        if (err.code === 'CONSENT_REQUIRED') {
          console.error(
            'Enregistrez d\'abord le consentement :\n' +
              '  node src/index.js consent --target ' +
              flags.target +
              ' --user "vous@exemple.com" --mandate REF --confirm "' +
              consentGate.CONSENT_PHRASE +
              '"'
          );
        }
        process.exit(1);
      });
  } else if (command === 'engagement') {
    // Déclare une Règle d'Engagement (périmètre + fenêtre) pour la phase
    // de vérification (constat d'exploitabilité).
    const scope = flags.scope ? String(flags.scope).split(',').map((s) => s.trim()) : [];
    const res = roe.registerEngagement({
      operator: flags.user,
      engagementRef: flags.mandate,
      scope,
      confirmation: flags.confirm,
      mandateOnFile: true,
      windowStart: flags.start,
      windowEnd: flags.end,
    });
    if (res.ok) {
      console.log('✔ Engagement enregistré :');
      console.log(JSON.stringify(res.engagement, null, 2));
    } else {
      console.error('✗ Engagement refusé : ' + res.reason);
      process.exit(1);
    }
  } else if (command === 'verify') {
    if (!flags.target) {
      console.error('Usage : node src/index.js verify --target <host|url> [--allow-intrusive]');
      process.exit(1);
    }
    verifier
      .run(flags.target, { allowIntrusive: !!flags['allow-intrusive'], log: console.log })
      .then((report) => {
        console.log('\n=== Constat ===');
        console.log(JSON.stringify(report.summary, null, 2));
      })
      .catch((err) => {
        console.error('\n' + err.message);
        if (err.code === 'OUT_OF_SCOPE') {
          console.error(
            'Déclarez d\'abord un engagement couvrant cette cible :\n' +
              '  node src/index.js engagement --user "vous@ex.com" --mandate REF \\\n' +
              '       --scope "' + flags.target + '" --confirm "' + consentGate.CONSENT_PHRASE + '"'
          );
        }
        process.exit(1);
      });
  } else {
    console.log('Commandes disponibles :');
    console.log('  consent     Enregistrer un consentement (obligatoire avant tout scan)');
    console.log('  scan        Lancer le scan actif (ports + services + CVE)');
    console.log('  engagement  Déclarer une Règle d\'Engagement (périmètre + fenêtre) pour la vérification');
    console.log('  verify      Constat d\'exploitabilité NON DESTRUCTIF, sous Règle d\'Engagement');
    console.log('\nExemples :');
    console.log('  node src/index.js consent --target 203.0.113.10 --user "op@ex.com" \\');
    console.log('       --mandate CONTRAT-042 --confirm "' + consentGate.CONSENT_PHRASE + '"');
    console.log('  node src/index.js scan --target 203.0.113.10 --minCvss 7');
    console.log('  node src/index.js engagement --user "op@ex.com" --mandate CONTRAT-042 \\');
    console.log('       --scope "203.0.113.0/24,app.client.com" --confirm "' + consentGate.CONSENT_PHRASE + '"');
    console.log('  node src/index.js verify --target app.client.com');
  }
}

module.exports = { runScan, grantConsent, registerEngagement: roe.registerEngagement, verify: verifier.run };
