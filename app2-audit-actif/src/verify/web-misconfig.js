'use strict';

/**
 * Vérification de misconfigurations web — NON DESTRUCTIVE
 *
 * Confirme, par de simples requêtes GET, des erreurs de configuration
 * courantes exploitables en reconnaissance :
 *   - listing de répertoire activé (« Index of / »)
 *   - endpoints de debug/monitoring exposés (Spring Actuator, etc.)
 *   - pages d'erreur verbeuses divulguant des traces / chemins
 *
 * Aucune injection, aucun payload : uniquement des GET, comme un navigateur.
 * Ces requêtes restent « actives » (elles sollicitent le serveur cible) donc
 * elles ne s'exécutent que sous autorisation (rules-of-engagement.js).
 */

const http = require('../lib/http');
const { URL } = require('url');

const PATHS = [
  { path: '/', kind: 'dir-listing' },
  { path: '/uploads/', kind: 'dir-listing' },
  { path: '/images/', kind: 'dir-listing' },
  { path: '/actuator', kind: 'debug-endpoint', label: 'Spring Boot Actuator' },
  { path: '/actuator/health', kind: 'debug-endpoint', label: 'Spring Actuator /health' },
  { path: '/actuator/env', kind: 'debug-endpoint', label: 'Spring Actuator /env (sensible)' },
  { path: '/debug', kind: 'debug-endpoint', label: 'Endpoint /debug' },
  { path: '/server-status', kind: 'debug-endpoint', label: 'Apache mod_status' },
];

const DIR_LISTING_RE = /<title>\s*Index of\s+\//i;
const STACKTRACE_RE = /(Exception in thread|Traceback \(most recent call last\)|at [\w.$]+\([\w.]+:\d+\)|Warning: .+ on line \d+|Fatal error:)/i;

async function checkPath(base, item, timeout) {
  const url = base + item.path;
  let res;
  try {
    res = await http.get(url, { timeout: timeout || 10000, maxRedirects: 0 });
  } catch (err) {
    return null;
  }
  const body = typeof res.data === 'string' ? res.data : '';
  const status = res.status;

  if (item.kind === 'dir-listing') {
    if (status === 200 && DIR_LISTING_RE.test(body)) {
      return {
        id: 'dir-listing' + item.path.replace(/[^a-z0-9]/gi, '-'),
        severity: 'medium',
        confirmed: true,
        message: 'Listing de répertoire activé sur ' + item.path + ' (HTTP 200, « Index of / »).',
        recommendation: 'Désactiver l\'autoindex/directory listing côté serveur.',
      };
    }
    return null;
  }

  // debug-endpoint
  if (status === 200) {
    return {
      id: 'debug' + item.path.replace(/[^a-z0-9]/gi, '-'),
      severity: item.path.includes('/env') ? 'high' : 'medium',
      confirmed: true,
      message:
        'Endpoint de debug/monitoring exposé : ' +
        item.path +
        (item.label ? ' (' + item.label + ')' : '') +
        ' répond en HTTP 200.',
      recommendation:
        'Restreindre ou désactiver cet endpoint en production (auth, filtrage réseau).',
    };
  }
  return null;
}

/**
 * @param {string} targetUrl - base http(s)://host[:port]
 * @param {object} [options]
 */
async function verify(targetUrl, options = {}) {
  let base;
  try {
    base = new URL(targetUrl).origin;
  } catch (err) {
    return { check: 'web-misconfig', error: 'URL invalide : ' + targetUrl, findings: [] };
  }

  const result = {
    check: 'web-misconfig',
    target: base,
    nonDestructive: true,
    findings: [],
    error: null,
  };

  // Détection de trace verbeuse sur la page d'accueil.
  try {
    const home = await http.get(base + '/', { timeout: options.timeout || 10000 });
    const body = typeof home.data === 'string' ? home.data : '';
    if (STACKTRACE_RE.test(body)) {
      result.findings.push({
        id: 'verbose-error',
        severity: 'medium',
        confirmed: true,
        message: 'Trace d\'erreur verbeuse détectée dans la réponse (divulgation d\'informations).',
        recommendation: 'Désactiver l\'affichage des erreurs détaillées en production.',
      });
    }
  } catch (err) {
    /* on continue */
  }

  for (const item of PATHS) {
    const finding = await checkPath(base, item, options.timeout);
    if (finding) result.findings.push(finding);
  }

  if (!result.findings.length) {
    result.findings.push({
      id: 'web-misconfig-none',
      severity: 'info',
      confirmed: true,
      message: 'Aucune misconfiguration courante détectée sur les chemins testés. ✔',
      recommendation: null,
    });
  }

  return result;
}

module.exports = { verify, PATHS };
