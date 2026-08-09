'use strict';

/**
 * Client HTTP partagé — 100 % modules natifs de Node (`http` / `https`).
 *
 * AUCUNE dépendance externe : l'application fonctionne sans `npm install`.
 * Ce client reproduit le comportement dont les modules d'audit ont besoin :
 *   - GET / POST
 *   - paramètres de requête (query string)
 *   - suivi de redirection contrôlé (maxRedirects)
 *   - timeout dur
 *   - plafond de taille de réponse (maxContentLength)
 *   - on ne lève JAMAIS sur un code HTTP : le statut est renvoyé tel quel,
 *     afin d'analyser 403/404/301 comme des résultats normaux.
 *
 * Toutes les requêtes restent « douces » (non intrusives) : User-Agent
 * identifiable, méthode simple, aucun fuzzing.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const USER_AGENT =
  'SecAudit-Passive/1.0 (+audit passif non intrusif; contact: audit@localhost)';

const DEFAULT_TIMEOUT_MS = 12000;
const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

/**
 * Requête bas niveau.
 * @param {string} method
 * @param {string} urlStr
 * @param {object} options
 * @returns {Promise<{status:number, headers:object, data:(string|object)}>}
 */
function request(method, urlStr, options = {}, _redirectCount = 0) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlStr);
    } catch (err) {
      return reject(new Error('URL invalide : ' + urlStr));
    }

    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v != null) url.searchParams.set(k, String(v));
      }
    }

    const lib = url.protocol === 'https:' ? https : http;
    const timeout = options.timeout || DEFAULT_TIMEOUT_MS;
    const maxContentLength = options.maxContentLength || 5 * 1024 * 1024;

    const reqOptions = {
      method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
        // On ne demande PAS de compression : évite d'avoir à décompresser
        // (le serveur renvoie alors du texte brut).
        'Accept-Encoding': 'identity',
        Connection: 'close',
        ...(options.headers || {}),
      },
    };

    if (options.body != null) {
      reqOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
    }

    const req = lib.request(reqOptions, (res) => {
      const status = res.statusCode;

      // Gestion des redirections.
      const maxRedirects = options.maxRedirects != null ? options.maxRedirects : 5;
      if (
        REDIRECT_CODES.has(status) &&
        res.headers.location &&
        maxRedirects > 0
      ) {
        res.resume(); // vide le flux
        const nextUrl = new URL(res.headers.location, url).toString();
        return resolve(
          request(
            method,
            nextUrl,
            { ...options, params: undefined, maxRedirects: maxRedirects - 1 },
            _redirectCount + 1
          )
        );
      }

      // Collecte du corps avec plafond de taille.
      const chunks = [];
      let size = 0;
      let aborted = false;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxContentLength) {
          aborted = true;
          res.destroy();
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => finish());
      res.on('close', () => finish());
      res.on('error', (err) => reject(err));

      let finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        let data = Buffer.concat(chunks).toString('utf8');
        const ct = String(res.headers['content-type'] || '');
        const wantsJson = options.responseType === 'json' || ct.includes('json');
        if (wantsJson) {
          try {
            data = JSON.parse(data);
          } catch (e) {
            /* on garde le texte brut */
          }
        }
        resolve({ status, headers: res.headers, data, truncated: aborted });
      }
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(timeout, () => {
      req.destroy(new Error('Timeout après ' + timeout + ' ms'));
    });

    if (options.body != null) req.write(options.body);
    req.end();
  });
}

/**
 * GET non intrusif.
 */
async function get(url, options = {}) {
  return request('GET', url, options);
}

/**
 * POST (corps JSON par défaut).
 */
async function post(url, body, options = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  return request('POST', url, {
    ...options,
    body: payload,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
}

module.exports = { get, post, request, USER_AGENT, DEFAULT_TIMEOUT_MS };
