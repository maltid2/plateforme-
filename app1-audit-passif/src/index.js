'use strict';

/**
 * App 1 — Audit Web Passif : orchestrateur principal
 *
 * Exécute tous les modules d'audit passif sur une URL cible, calcule le
 * score global pondéré et génère un rapport HTML (+ PDF optionnel).
 *
 * Usage CLI :
 *   node src/index.js https://exemple.com [--pdf] [--out ./reports]
 *
 * Usage programmatique :
 *   const { audit } = require('./src/index');
 *   const report = await audit('https://exemple.com', { pdf: true });
 */

require('./lib/env').loadEnv();

const path = require('path');
const { URL } = require('url');

const ssl = require('./modules/ssl');
const headers = require('./modules/headers');
const exposedFiles = require('./modules/exposed-files');
const reputation = require('./modules/reputation');
const techDetect = require('./modules/tech-detect');
const compliance = require('./modules/compliance');
const scoring = require('./scoring/engine');
const reportGen = require('./report/generator');

/**
 * Normalise l'URL fournie (ajoute https:// si le schéma est absent).
 */
function normalizeUrl(input) {
  let url = String(input || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  // Valide et renvoie une forme canonique.
  const parsed = new URL(url);
  return parsed.toString();
}

/**
 * Catalogue des modules disponibles (id -> métadonnées + exécuteur).
 * Permet de paramétrer l'audit : ne lancer que les contrôles choisis.
 */
const MODULE_CATALOG = [
  { id: 'A1', name: 'SSL/TLS', run: (u, o) => ssl.run(u, o), onError: (e) => ({ module: 'A1', name: 'SSL/TLS', findings: [], score: 0, error: e.message }) },
  { id: 'A2', name: 'Headers HTTP', run: (u, o) => headers.run(u, o), onError: (e) => ({ module: 'A2', name: 'Headers HTTP', findings: [], score: 0, error: e.message }) },
  { id: 'A3', name: 'Fichiers sensibles', run: (u, o) => exposedFiles.run(u, o), onError: (e) => ({ module: 'A3', name: 'Fichiers sensibles', findings: [], score: 0, error: e.message }) },
  { id: 'B', name: 'Réputation', run: (u, o) => reputation.run(u, o), onError: (e) => ({ module: 'B', name: 'Réputation', findings: [], score: 100, degraded: true, error: e.message }) },
  { id: 'C', name: 'Technologies + CVE', run: (u, o) => techDetect.run(u, o), onError: (e) => ({ module: 'C', name: 'Technologies + CVE', findings: [], score: 100, degraded: true, error: e.message }) },
  { id: 'D', name: 'Bonnes pratiques SaaS', run: (u, o) => compliance.run(u, o), onError: (e) => ({ module: 'D', name: 'Bonnes pratiques SaaS', findings: [], score: 100, error: e.message }) },
];

const ALL_MODULE_IDS = MODULE_CATALOG.map((m) => m.id);

/**
 * Exécute l'audit (paramétrable : on peut ne lancer qu'une partie des modules).
 * @param {string} targetUrl
 * @param {object} [options] - { pdf, outDir, timeout, minCvss, log, modules }
 *   options.modules : liste d'ids ('A1','A2','A3','B','C','D'). Défaut : tous.
 * @returns {Promise<object>} rapport structuré
 */
async function audit(targetUrl, options = {}) {
  const url = normalizeUrl(targetUrl);
  const log = options.log || (() => {});
  const modOptions = { timeout: options.timeout, minCvss: options.minCvss };

  // Sélection des modules : on garde l'ordre du catalogue.
  let selected = MODULE_CATALOG;
  if (Array.isArray(options.modules) && options.modules.length) {
    const want = new Set(options.modules.map((m) => String(m).toUpperCase()));
    const filtered = MODULE_CATALOG.filter((m) => want.has(m.id));
    if (filtered.length) selected = filtered;
  }

  log('▶ Audit passif de ' + url + ' (' + selected.map((m) => m.id).join(', ') + ')');

  // Modules indépendants -> exécution en parallèle. Chaque module encapsule
  // ses erreurs, donc Promise.all est sûr.
  const modules = await Promise.all(
    selected.map((m) => m.run(url, modOptions).catch(m.onError))
  );

  const scoringResult = scoring.compute(modules);

  const report = {
    target: url,
    generatedAt: new Date().toISOString(),
    scoring: scoringResult,
    modules,
  };

  log(
    '✔ Score global : ' +
      scoringResult.score +
      '/100 (' +
      scoringResult.letter +
      ') — ' +
      (scoringResult.findingsSummary.high || 0) +
      ' alerte(s) élevée(s)'
  );

  return report;
}

/**
 * Exécute l'audit puis génère les rapports sur disque.
 */
async function auditAndReport(targetUrl, options = {}) {
  const report = await audit(targetUrl, options);
  const outDir = options.outDir || path.join(process.cwd(), 'reports');
  const safeName =
    new URL(report.target).hostname.replace(/[^a-z0-9.-]/gi, '_') +
    '-' +
    Date.now();

  const gen = await reportGen.generate(report, {
    htmlPath: path.join(outDir, safeName + '.html'),
    pdfPath: path.join(outDir, safeName + '.pdf'),
    pdf: !!options.pdf,
  });

  return { report, files: gen };
}

// --- CLI ---
if (require.main === module) {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith('--'));
  const wantsPdf = args.includes('--pdf');
  const outIdx = args.indexOf('--out');
  const outDir = outIdx !== -1 ? args[outIdx + 1] : undefined;

  if (!target) {
    console.error('Usage : node src/index.js <url> [--pdf] [--out <dir>]');
    process.exit(1);
  }

  auditAndReport(target, { pdf: wantsPdf, outDir, log: console.log })
    .then(({ report, files }) => {
      console.log('\n=== Résultat ===');
      console.log('Cible   : ' + report.target);
      console.log('Score   : ' + report.scoring.score + '/100 (' + report.scoring.letter + ')');
      console.log(report.scoring.meaning);
      if (files.htmlPath) console.log('HTML    : ' + files.htmlPath);
      if (files.pdfPath) console.log('PDF     : ' + files.pdfPath);
      if (files.pdfError) console.log('Note PDF: ' + files.pdfError);
    })
    .catch((err) => {
      console.error('Erreur fatale : ' + err.message);
      process.exit(1);
    });
}

module.exports = {
  audit,
  auditAndReport,
  normalizeUrl,
  MODULES: MODULE_CATALOG.map((m) => ({ id: m.id, name: m.name })),
  ALL_MODULE_IDS,
};
