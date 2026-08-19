'use strict';

/**
 * Client HTTP minimal — modules natifs `http` / `https` uniquement.
 *
 * AUCUNE dépendance externe. Utilisé par le matching CVE pour interroger
 * l'API NVD (GET + query string + en-têtes + réponse JSON). Suit les
 * redirections et ne lève pas sur un code d'erreur HTTP (statut renvoyé tel
 * quel).
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

function get(urlStr, options = {}, _redirects = 0) {
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
    const timeout = options.timeout || 20000;

    const reqOptions = {
      method: 'GET',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'User-Agent': 'SecAudit-Active/1.0',
        Accept: 'application/json, */*',
        'Accept-Encoding': 'identity',
        Connection: 'close',
        ...(options.headers || {}),
      },
    };

    const req = lib.request(reqOptions, (res) => {
      const status = res.statusCode;
      const maxRedirects = options.maxRedirects != null ? options.maxRedirects : 5;
      if (REDIRECT_CODES.has(status) && res.headers.location && maxRedirects > 0) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        return resolve(
          get(next, { ...options, params: undefined, maxRedirects: maxRedirects - 1 }, _redirects + 1)
        );
      }

      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        let data = Buffer.concat(chunks).toString('utf8');
        const ct = String(res.headers['content-type'] || '');
        if (options.responseType === 'json' || ct.includes('json')) {
          try {
            data = JSON.parse(data);
          } catch (e) {
            /* garde le texte */
          }
        }
        resolve({ status, headers: res.headers, data });
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error('Timeout après ' + timeout + ' ms')));
    req.end();
  });
}

module.exports = { get };
