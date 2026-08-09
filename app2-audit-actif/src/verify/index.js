'use strict';

/**
 * Orchestrateur de vérification (constat d'exploitabilité)
 *
 * Enchaîne les vérifications NON DESTRUCTIVES + les plugins opérateur, le
 * tout SOUS Règle d'Engagement : rien ne s'exécute si la cible n'est pas
 * dans le périmètre autorisé et dans la fenêtre temporelle.
 */

const { URL } = require('url');
const roe = require('../auth/rules-of-engagement');
const tlsWeakness = require('./tls-weakness');
const webMisconfig = require('./web-misconfig');
const pluginLoader = require('../plugins/loader');

/**
 * @param {string} targetUrl - http(s)://host[:port] OU host/IP nu
 * @param {object} [options] - { allowIntrusive, timeout, log }
 */
async function run(targetUrl, options = {}) {
  const log = options.log || (() => {});

  // Normalisation : accepte "host", "host:port" ou une URL complète.
  let url;
  let host;
  let port;
  try {
    url = new URL(/^https?:\/\//i.test(targetUrl) ? targetUrl : 'https://' + targetUrl);
    host = url.hostname;
    port = url.port ? Number(url.port) : url.protocol === 'http:' ? 80 : 443;
  } catch (err) {
    throw new Error('Cible invalide : ' + targetUrl);
  }

  // --- GARDE-FOU RoE : le contrôle porte sur l'HÔTE ---
  const auth = roe.authorize(host);
  if (!auth.ok) {
    const err = new Error('VÉRIFICATION BLOQUÉE — ' + auth.reason);
    err.code = 'OUT_OF_SCOPE';
    throw err;
  }
  log('✔ ' + host + ' autorisé (engagement ' + auth.engagement.id + ', réf ' + auth.engagement.engagementRef + ')');

  const report = {
    target: host,
    startedAt: new Date().toISOString(),
    engagement: {
      id: auth.engagement.id,
      operator: auth.engagement.operator,
      engagementRef: auth.engagement.engagementRef,
      window: [auth.engagement.windowStart, auth.engagement.windowEnd],
    },
    checks: [],
    plugins: [],
    finishedAt: null,
  };

  // --- Vérifications non destructives ---
  log('▶ Vérification TLS (négociation de protocoles obsolètes)...');
  report.checks.push(await tlsWeakness.verify(host, port, { timeout: options.timeout }));

  log('▶ Vérification des misconfigurations web (GET)...');
  report.checks.push(await webMisconfig.verify(url.origin, { timeout: options.timeout }));

  // --- Plugins opérateur (sous RoE, intrusifs seulement si autorisés) ---
  log('▶ Plugins de vérification...');
  const pluginRun = await pluginLoader.runAll(host, {
    allowIntrusive: options.allowIntrusive,
    timeout: options.timeout,
    log,
  });
  report.plugins = pluginRun.results;

  // Récapitulatif.
  const allFindings = [
    ...report.checks.flatMap((c) => c.findings || []),
    ...report.plugins.flatMap((p) => p.findings || []),
  ];
  report.summary = {
    confirmed: allFindings.filter((f) => f.confirmed && f.severity !== 'info').length,
    high: allFindings.filter((f) => f.severity === 'high').length,
    medium: allFindings.filter((f) => f.severity === 'medium').length,
  };

  report.finishedAt = new Date().toISOString();
  log(
    '✔ Vérification terminée — ' +
      report.summary.confirmed +
      ' faiblesse(s) confirmée(s) (' +
      report.summary.high +
      ' élevée(s), ' +
      report.summary.medium +
      ' moyenne(s)).'
  );

  return report;
}

module.exports = { run };
