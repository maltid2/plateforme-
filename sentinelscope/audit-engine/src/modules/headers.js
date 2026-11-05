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
    why: 'Sans HSTS, un attaquant présent sur le réseau (Wi-Fi public, box compromise) peut forcer la connexion en HTTP non chiffré et intercepter identifiants et données — c\'est l\'attaque « SSL stripping ». HSTS oblige le navigateur à n\'utiliser que HTTPS, même si l\'utilisateur tape l\'adresse sans « https:// ».',
    recommendation:
      'Ajouter l\'en-tête : Strict-Transport-Security: max-age=31536000; includeSubDomains; preload — puis inscrire le domaine sur hstspreload.org pour une protection dès la toute première visite.',
  },
  {
    key: 'content-security-policy',
    label: 'Content-Security-Policy (CSP)',
    weight: 25,
    severity: 'high',
    why: 'La CSP indique au navigateur quelles ressources (scripts, styles, images) il a le droit de charger. C\'est la défense la plus efficace contre les attaques XSS : même si un script malveillant est injecté dans la page, le navigateur refuse de l\'exécuter s\'il n\'est pas autorisé par la politique.',
    recommendation:
      'Définir une politique restrictive, ex. : default-src \'self\'; object-src \'none\'; base-uri \'self\'. Déployer d\'abord en mode Content-Security-Policy-Report-Only pour la tester sans rien casser.',
  },
  {
    key: 'x-frame-options',
    label: 'X-Frame-Options',
    weight: 15,
    severity: 'medium',
    why: 'Sans cette protection, un site malveillant peut afficher votre page dans une iframe invisible et piéger vos utilisateurs pour qu\'ils cliquent à leur insu sur des boutons sensibles (attaque de type clickjacking).',
    recommendation: 'Ajouter : X-Frame-Options: SAMEORIGIN. Pour un contrôle plus fin, préférer la directive CSP frame-ancestors \'self\'.',
  },
  {
    key: 'x-content-type-options',
    label: 'X-Content-Type-Options',
    weight: 15,
    severity: 'medium',
    why: 'Sans « nosniff », le navigateur peut deviner (MIME-sniffing) le type d\'un fichier et l\'exécuter comme du script alors qu\'il était servi comme une image ou du texte — une porte d\'entrée pour du code malveillant.',
    recommendation: 'Ajouter : X-Content-Type-Options: nosniff (une seule ligne, aucun effet de bord).',
  },
  {
    key: 'referrer-policy',
    label: 'Referrer-Policy',
    weight: 10,
    severity: 'low',
    why: 'Par défaut, le navigateur transmet l\'URL complète de votre page — qui peut contenir des identifiants ou des informations privées — aux sites tiers que vous chargez. Referrer-Policy limite cette fuite d\'informations.',
    recommendation:
      'Ajouter : Referrer-Policy: strict-origin-when-cross-origin (bon compromis entre vie privée et outils d\'analyse).',
  },
  {
    key: 'permissions-policy',
    label: 'Permissions-Policy',
    weight: 10,
    severity: 'low',
    why: 'Cet en-tête déclare quelles API sensibles du navigateur (caméra, micro, géolocalisation, paiement…) le site est autorisé à utiliser. Les restreindre limite ce qu\'un script injecté pourrait activer à l\'insu de l\'utilisateur.',
    recommendation:
      'Désactiver explicitement les fonctionnalités inutilisées, ex. : Permissions-Policy: camera=(), microphone=(), geolocation=().',
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
          'Révéler la version exacte de votre serveur ou framework (ex. « nginx/1.18.0 », « PHP/7.4 ») permet à un attaquant de rechercher directement les failles connues de cette version précise et d\'automatiser son attaque.',
        recommendation:
          'Masquer ou neutraliser cet en-tête côté serveur : « server_tokens off; » sur nginx, « ServerTokens Prod » sur Apache, et retirer X-Powered-By au niveau applicatif.',
      });
    }
  }

  result.score = Math.round((earned / totalWeight) * 100);
  return result;
}

module.exports = { run, HEADER_CHECKS };
