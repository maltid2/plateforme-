'use strict';

/**
 * Module A2 — Headers HTTP de sécurité
 *
 * Requête GET simple sur l'URL cible, puis évaluation des en-têtes de
 * sécurité recommandés (OWASP Secure Headers Project).
 *
 * Chaque en-tête manquant applique un poids négatif défini ci-dessous.
 */

const http = require('./http-client');

/**
 * Grille des en-têtes évalués.
 * weight = importance relative (utilisée pour le score du module).
 */
const HEADER_CHECKS = [
  {
    key: 'strict-transport-security',
    label: 'Strict-Transport-Security (HSTS)',
    weight: 25,
    severity: 'high',
    why: 'Force le navigateur à toujours utiliser HTTPS, empêchant les attaques de downgrade.',
    recommendation:
      'Ajouter : Strict-Transport-Security: max-age=31536000; includeSubDomains',
  },
  {
    key: 'content-security-policy',
    label: 'Content-Security-Policy (CSP)',
    weight: 25,
    severity: 'high',
    why: 'Réduit fortement la surface d\'attaque XSS et l\'injection de ressources.',
    recommendation:
      'Définir une politique CSP restrictive (ex: default-src \'self\').',
  },
  {
    key: 'x-frame-options',
    label: 'X-Frame-Options',
    weight: 15,
    severity: 'medium',
    why: 'Protège contre le clickjacking en empêchant l\'affichage en iframe.',
    recommendation: 'Ajouter : X-Frame-Options: SAMEORIGIN (ou via CSP frame-ancestors).',
  },
  {
    key: 'x-content-type-options',
    label: 'X-Content-Type-Options',
    weight: 15,
    severity: 'medium',
    why: 'Empêche le MIME-sniffing du navigateur.',
    recommendation: 'Ajouter : X-Content-Type-Options: nosniff',
  },
  {
    key: 'referrer-policy',
    label: 'Referrer-Policy',
    weight: 10,
    severity: 'low',
    why: 'Contrôle les informations de provenance envoyées aux tiers.',
    recommendation:
      'Ajouter : Referrer-Policy: strict-origin-when-cross-origin',
  },
  {
    key: 'permissions-policy',
    label: 'Permissions-Policy',
    weight: 10,
    severity: 'low',
    why: 'Restreint l\'accès aux API sensibles du navigateur (caméra, micro, géoloc...).',
    recommendation:
      'Ajouter une Permissions-Policy limitant les fonctionnalités inutilisées.',
  },
];

/**
 * En-têtes qui divulguent des informations et devraient être retirés.
 */
const INFO_LEAK_HEADERS = [
  { key: 'server', label: 'Server' },
  { key: 'x-powered-by', label: 'X-Powered-By' },
  { key: 'x-aspnet-version', label: 'X-AspNet-Version' },
  { key: 'x-aspnetmvc-version', label: 'X-AspNetMvc-Version' },
];

async function run(targetUrl, options = {}) {
  const result = {
    module: 'A2',
    name: 'Headers HTTP',
    target: targetUrl,
    present: [],
    missing: [],
    infoLeak: [],
    findings: [],
    rawHeaders: {},
    score: 0,
    error: null,
  };

  let res;
  try {
    res = await http.get(targetUrl, { timeout: options.timeout });
  } catch (err) {
    result.error = 'Requête impossible : ' + err.message;
    result.score = 0;
    return result;
  }

  const headers = res.headers || {};
  result.rawHeaders = headers;
  result.statusCode = res.status;

  const totalWeight = HEADER_CHECKS.reduce((s, h) => s + h.weight, 0);
  let earned = 0;

  for (const check of HEADER_CHECKS) {
    const value = headers[check.key];
    if (value != null && String(value).trim() !== '') {
      earned += check.weight;
      result.present.push({ header: check.label, value: String(value) });
    } else {
      result.missing.push(check.label);
      result.findings.push({
        id: 'missing-' + check.key,
        severity: check.severity,
        message: 'En-tête de sécurité manquant : ' + check.label + '.',
        why: check.why,
        recommendation: check.recommendation,
      });
    }
  }

  // Divulgation d'information (léger malus informatif, pas bloquant).
  for (const leak of INFO_LEAK_HEADERS) {
    const value = headers[leak.key];
    if (value != null && String(value).trim() !== '') {
      result.infoLeak.push({ header: leak.label, value: String(value) });
      result.findings.push({
        id: 'info-leak-' + leak.key,
        severity: 'low',
        message:
          'En-tête divulguant des informations : ' +
          leak.label +
          ': ' +
          String(value),
        why:
          'Révéler la version exacte de votre serveur ou de votre framework aide un attaquant à cibler les failles connues de cette version précise.',
        recommendation:
          'Masquer ou retirer cet en-tête pour ne pas révéler la stack technique.',
      });
    }
  }

  result.score = Math.round((earned / totalWeight) * 100);
  return result;
}

module.exports = { run, HEADER_CHECKS };
