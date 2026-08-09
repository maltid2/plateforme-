'use strict';

/**
 * Client HTTP partagé pour les modules d'audit passif.
 *
 * Toutes les requêtes sont volontairement « douces » :
 *   - méthode GET simple (aucune tentative de bypass / fuzzing)
 *   - User-Agent identifiable
 *   - suivi de redirection contrôlé
 *   - on ne lève JAMAIS sur un code HTTP (validateStatus: () => true) afin
 *     de pouvoir analyser 403/404/301 comme des résultats normaux.
 */

const axios = require('axios');

const USER_AGENT =
  'SecAudit-Passive/1.0 (+audit passif non intrusif; contact: audit@localhost)';

const DEFAULT_TIMEOUT_MS = 12000;

/**
 * Effectue une requête GET non intrusive.
 * @param {string} url
 * @param {object} [options]
 * @returns {Promise<import('axios').AxiosResponse|null>}
 */
async function get(url, options = {}) {
  return axios.get(url, {
    timeout: options.timeout || DEFAULT_TIMEOUT_MS,
    maxRedirects: options.maxRedirects != null ? options.maxRedirects : 5,
    // On accepte tous les statuts pour les analyser nous-mêmes.
    validateStatus: () => true,
    // Évite de télécharger des fichiers énormes lors du test d'exposition.
    maxContentLength: options.maxContentLength || 5 * 1024 * 1024,
    responseType: options.responseType || 'text',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: '*/*',
      ...(options.headers || {}),
    },
    // Nécessaire pour observer une redirection sans la suivre.
    ...(options.noFollow ? { maxRedirects: 0 } : {}),
  });
}

module.exports = { get, USER_AGENT, DEFAULT_TIMEOUT_MS };
