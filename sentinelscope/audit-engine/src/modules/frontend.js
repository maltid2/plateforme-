'use strict';

/**
 * Module A4 — Sécurité front / navigateur
 *
 * Contrôles côté « front » d'un site web, à partir de la page principale
 * (non intrusif) :
 *   - Cookies sans attributs de sécurité (Secure / HttpOnly / SameSite)
 *   - Contenu mixte (ressources http:// chargées sur une page https://)
 *   - Formulaires envoyés en clair (action http://)
 *   - Absence de redirection HTTP → HTTPS (site accessible en clair)
 *
 * Chaque anomalie applique un malus au score du module.
 */

const http = require('./http-client');
const { URL } = require('url');

const PENALTY = { high: 25, medium: 12, low: 5, info: 0 };

/** Analyse un en-tête Set-Cookie et renvoie les attributs de sécurité manquants. */
function missingCookieFlags(cookieStr, isHttps) {
  const missing = [];
  if (isHttps && !/;\s*secure(\s*;|\s*$)/i.test(cookieStr)) missing.push('Secure');
  if (!/;\s*httponly(\s*;|\s*$)/i.test(cookieStr)) missing.push('HttpOnly');
  if (!/;\s*samesite\s*=/i.test(cookieStr)) missing.push('SameSite');
  return missing;
}

async function run(targetUrl, options = {}) {
  const result = {
    module: 'A4',
    name: 'Sécurité front',
    target: targetUrl,
    findings: [],
    score: 100,
    error: null,
  };

  let res;
  try {
    res = await http.get(targetUrl, { timeout: options.timeout });
  } catch (err) {
    // Impossible d'évaluer : module neutralisé (n'impacte pas le score).
    result.error = 'Requête impossible : ' + err.message;
    result.degraded = true;
    return result;
  }

  const headers = res.headers || {};
  const body = typeof res.data === 'string' ? res.data : '';
  const isHttps = /^https:/i.test(targetUrl);

  // 1) Cookies sans attributs de sécurité.
  const setCookie = headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  let shownCookies = 0;
  for (const c of cookies) {
    if (shownCookies >= 6) break;
    const name = String(c).split('=')[0].trim() || 'cookie';
    const missing = missingCookieFlags(String(c), isHttps);
    if (missing.length === 0) continue;
    const grave = missing.includes('Secure') || missing.includes('HttpOnly');
    result.findings.push({
      id: 'cookie-flags-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      severity: grave ? 'medium' : 'low',
      message:
        'Cookie « ' + name + ' » sans ' + missing.join(', ') + '.',
      why:
        'Sans HttpOnly un cookie est lisible par du JavaScript (vol via XSS) ; sans Secure il peut transiter en clair ; sans SameSite il est exposé au CSRF.',
      recommendation:
        'Ajouter les attributs manquants : Set-Cookie: ...; Secure; HttpOnly; SameSite=Lax',
    });
    shownCookies++;
  }

  // 2) Contenu mixte (page HTTPS chargeant des ressources HTTP).
  if (isHttps && body) {
    const active = (
      body.match(
        /<(?:script|iframe|link)\b[^>]*\b(?:src|href)\s*=\s*["']http:\/\//gi
      ) || []
    ).length;
    const passive = (
      body.match(/<(?:img|audio|video|source)\b[^>]*\bsrc\s*=\s*["']http:\/\//gi) || []
    ).length;

    if (active > 0) {
      result.findings.push({
        id: 'mixed-content-active',
        severity: 'medium',
        message:
          'Contenu mixte actif : ' +
          active +
          ' ressource(s) (script/iframe/style) chargée(s) en HTTP sur une page HTTPS.',
        why:
          'Une ressource active chargée en HTTP sur une page HTTPS peut être interceptée et modifiée, annulant la protection du HTTPS.',
        recommendation: 'Charger toutes les ressources en https:// (ou en URL relative).',
      });
    } else if (passive > 0) {
      result.findings.push({
        id: 'mixed-content-passive',
        severity: 'low',
        message:
          'Contenu mixte passif : ' +
          passive +
          ' média(s) chargé(s) en HTTP sur une page HTTPS.',
        why: 'Les navigateurs bloquent ou signalent le contenu mixte, dégradant la confiance.',
        recommendation: 'Servir les images/médias en https://.',
      });
    }
  }

  // 3) Formulaires envoyés en clair.
  if (isHttps && body) {
    const insecureForms = (
      body.match(/<form\b[^>]*\baction\s*=\s*["']http:\/\//gi) || []
    ).length;
    if (insecureForms > 0) {
      result.findings.push({
        id: 'form-insecure-action',
        severity: 'high',
        message:
          insecureForms +
          ' formulaire(s) envoyé(s) en clair (action http://) depuis une page HTTPS.',
        why:
          'Les données saisies (identifiants, messages) sont transmises en clair et interceptables.',
        recommendation: 'Pointer l\'attribut action des formulaires vers une URL https://.',
      });
    }
  }

  // 4) Redirection HTTP → HTTPS (best-effort, requête supplémentaire).
  if (isHttps) {
    try {
      const httpUrl = (() => {
        const u = new URL(targetUrl);
        u.protocol = 'http:';
        return u.toString();
      })();
      const r = await http.get(httpUrl, {
        timeout: Math.min(options.timeout || 12000, 8000),
        maxRedirects: 0,
      });
      const loc = String((r.headers && r.headers.location) || '');
      const redirectsToHttps = /^(30[1278])$/.test(String(r.status)) && /^https:/i.test(loc);
      if (!redirectsToHttps && r.status < 400) {
        result.findings.push({
          id: 'no-https-redirect',
          severity: 'medium',
          message:
            'Le site reste accessible en HTTP : http:// n\'est pas redirigé vers https://.',
          why:
            'Sans redirection systématique vers HTTPS, un visiteur peut naviguer en clair et être exposé à l\'interception.',
          recommendation:
            'Rediriger tout le trafic HTTP vers HTTPS (301) et activer HSTS.',
        });
      }
    } catch (e) {
      /* port 80 fermé ou erreur réseau : on ne conclut rien */
    }
  }

  let penalty = 0;
  for (const f of result.findings) penalty += PENALTY[f.severity] || 0;
  result.score = Math.max(0, 100 - penalty);
  return result;
}

module.exports = { run };
