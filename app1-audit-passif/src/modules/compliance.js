'use strict';

/**
 * Module D — Bonnes pratiques SaaS / conformité
 *
 * Scraping léger et non intrusif du HTML de la page d'accueil :
 *   - présence de liens/textes légaux (politique de confidentialité,
 *     mentions légales, CGU)
 *   - détection d'un bandeau cookies (Cookiebot, OneTrust, patterns RGPD)
 *   - redirection HTTP -> HTTPS (requête sur le port 80)
 *   - mixed content (ressources http:// chargées sur une page https://)
 */

const http = require('./http-client');
const { URL } = require('url');

const LEGAL_PATTERNS = [
  {
    key: 'privacy',
    label: 'Politique de confidentialité',
    regexes: [/politique\s+de\s+confidentialit/i, /privacy\s+policy/i, /confidentialit/i],
  },
  {
    key: 'legal',
    label: 'Mentions légales',
    regexes: [/mentions\s+l[ée]gales/i, /legal\s+notice/i, /imprint/i],
  },
  {
    key: 'terms',
    label: 'CGU / Conditions d\'utilisation',
    regexes: [/cgu/i, /conditions\s+g[ée]n[ée]rales/i, /terms\s+of\s+(use|service)/i],
  },
];

const COOKIE_BANNER_PATTERNS = [
  /cookiebot/i,
  /onetrust/i,
  /optanon/i,
  /cookieconsent/i,
  /cookie-?consent/i,
  /didomi/i,
  /axeptio/i,
  /tarteaucitron/i,
  /gdpr/i,
  /rgpd/i,
];

/**
 * Vérifie la redirection HTTP -> HTTPS sur le port 80.
 */
async function checkHttpsRedirect(host, timeout) {
  const httpUrl = 'http://' + host + '/';
  try {
    // maxRedirects: 0 -> le client natif renvoie la réponse 3xx sans la suivre.
    const res = await http.get(httpUrl, { timeout: timeout || 12000, maxRedirects: 0 });
    const status = res.status;
    const location = res.headers['location'] || '';
    if (status >= 300 && status < 400 && /^https:\/\//i.test(location)) {
      return { redirects: true, status, location };
    }
    // Certains serveurs répondent directement ou ne redirigent pas vers HTTPS.
    return { redirects: false, status, location: location || null };
  } catch (err) {
    return { redirects: null, error: err.message };
  }
}

/**
 * Détecte le mixed content : ressources http:// référencées dans une page
 * servie en https://.
 */
function detectMixedContent(body) {
  if (!body) return [];
  const found = new Set();
  const attrRe = /(?:src|href)\s*=\s*["'](http:\/\/[^"']+)["']/gi;
  let m;
  while ((m = attrRe.exec(body)) !== null) {
    found.add(m[1]);
    if (found.size >= 20) break;
  }
  return Array.from(found);
}

async function run(targetUrl, options = {}) {
  const parsed = new URL(targetUrl);
  const isHttps = parsed.protocol === 'https:';
  const result = {
    module: 'D',
    name: 'Bonnes pratiques SaaS',
    target: targetUrl,
    legal: {},
    cookieBanner: false,
    httpsRedirect: null,
    mixedContent: [],
    findings: [],
    score: 100,
    error: null,
  };

  let res;
  try {
    res = await http.get(targetUrl, { timeout: options.timeout });
  } catch (err) {
    result.error = 'Requête impossible : ' + err.message;
    result.score = 50;
    return result;
  }

  const body = typeof res.data === 'string' ? res.data : '';

  // --- Liens/textes légaux ---
  let legalMissing = 0;
  for (const p of LEGAL_PATTERNS) {
    const present = p.regexes.some((re) => re.test(body));
    result.legal[p.key] = present;
    if (!present) {
      legalMissing++;
      result.findings.push({
        id: 'legal-missing-' + p.key,
        severity: 'low',
        message: 'Élément légal non détecté sur la page d\'accueil : ' + p.label + '.',
        recommendation:
          'Ajouter un lien visible vers ' + p.label + ' (obligation RGPD / conformité).',
      });
    }
  }

  // --- Bandeau cookies ---
  result.cookieBanner = COOKIE_BANNER_PATTERNS.some((re) => re.test(body));
  if (!result.cookieBanner) {
    result.findings.push({
      id: 'no-cookie-banner',
      severity: 'low',
      message: 'Aucun bandeau de consentement cookies détecté.',
      recommendation:
        'Mettre en place un bandeau de consentement conforme (RGPD/ePrivacy) si des cookies non essentiels sont déposés.',
    });
  }

  // --- Redirection HTTP -> HTTPS ---
  const redirect = await checkHttpsRedirect(parsed.hostname, options.timeout);
  result.httpsRedirect = redirect;
  if (redirect && redirect.redirects === false) {
    result.findings.push({
      id: 'no-https-redirect',
      severity: 'medium',
      message: 'Le port 80 (HTTP) ne redirige pas automatiquement vers HTTPS.',
      recommendation:
        'Configurer une redirection 301 de http:// vers https:// pour tout le trafic.',
    });
  }

  // --- Mixed content ---
  if (isHttps) {
    result.mixedContent = detectMixedContent(body);
    if (result.mixedContent.length) {
      result.findings.push({
        id: 'mixed-content',
        severity: 'medium',
        message:
          result.mixedContent.length +
          ' ressource(s) HTTP chargée(s) sur une page HTTPS (mixed content).',
        recommendation:
          'Servir toutes les ressources en HTTPS pour éviter les avertissements et interceptions.',
      });
    }
  }

  // --- Score du module ---
  let score = 100;
  score -= legalMissing * 8; // jusqu'à -24
  if (!result.cookieBanner) score -= 8;
  if (redirect && redirect.redirects === false) score -= 20;
  if (result.mixedContent.length) score -= 20;
  result.score = Math.max(0, score);

  return result;
}

module.exports = { run };
