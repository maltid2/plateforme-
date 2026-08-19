'use strict';

/**
 * Vérification TLS — NON DESTRUCTIVE
 *
 * Confirme l'exploitabilité réelle de faiblesses TLS sans les exploiter :
 * on se contente d'ouvrir des handshakes en forçant d'anciennes versions de
 * protocole. Si le serveur accepte la poignée de main, la faiblesse est
 * CONFIRMÉE (et pas seulement supposée d'après un numéro de version).
 *
 * Aucune donnée n'est extraite, aucune vulnérabilité n'est exploitée : ce
 * sont des négociations TLS standard, comme celles d'un vieux navigateur.
 *
 * ⚠ À n'exécuter que sur une cible autorisée (voir rules-of-engagement.js).
 */

const tls = require('tls');

const WEAK_PROTOCOLS = [
  { version: 'TLSv1', label: 'TLS 1.0', severity: 'medium' },
  { version: 'TLSv1.1', label: 'TLS 1.1', severity: 'medium' },
];

/**
 * Tente un handshake en forçant EXACTEMENT une version de protocole.
 * @returns {Promise<{accepted:boolean, cipher:string|null, error:string|null}>}
 */
function tryProtocol(host, port, version, timeout) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (res) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch (e) {
        /* noop */
      }
      resolve(res);
    };

    let socket;
    // SNI interdit pour une IP (RFC 6066) : on ne le pose que pour un hôte.
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    try {
      socket = tls.connect(
        {
          host,
          port,
          ...(isIp ? {} : { servername: host }),
          rejectUnauthorized: false,
          minVersion: version,
          maxVersion: version,
          timeout,
        },
        () => {
          const cipher = socket.getCipher();
          done({ accepted: true, cipher: cipher ? cipher.name : null, error: null });
        }
      );
    } catch (err) {
      return done({ accepted: false, cipher: null, error: err.message });
    }

    socket.on('error', (err) => done({ accepted: false, cipher: null, error: err.message }));
    socket.setTimeout(timeout, () => done({ accepted: false, cipher: null, error: 'timeout' }));
  });
}

/**
 * Vérifie les protocoles TLS obsolètes réellement acceptés par le serveur.
 * @param {string} host
 * @param {number} [port=443]
 * @param {object} [options]
 * @returns {Promise<object>}
 */
async function verify(host, port = 443, options = {}) {
  const timeout = options.timeout || 8000;
  const result = {
    check: 'tls-weakness',
    target: host + ':' + port,
    nonDestructive: true,
    weakProtocolsAccepted: [],
    findings: [],
    error: null,
  };

  for (const proto of WEAK_PROTOCOLS) {
    let res;
    try {
      res = await tryProtocol(host, port, proto.version, timeout);
    } catch (err) {
      continue;
    }
    if (res.accepted) {
      result.weakProtocolsAccepted.push(proto.label);
      result.findings.push({
        id: 'weak-tls-' + proto.version.toLowerCase(),
        severity: proto.severity,
        confirmed: true,
        message:
          proto.label +
          ' est ACCEPTÉ par le serveur (handshake réussi' +
          (res.cipher ? ', cipher ' + res.cipher : '') +
          ') — faiblesse confirmée, non supposée.',
        recommendation:
          'Désactiver ' +
          proto.label +
          ' côté serveur et n\'autoriser que TLS 1.2 / 1.3.',
      });
    }
  }

  if (!result.weakProtocolsAccepted.length) {
    result.findings.push({
      id: 'tls-weakness-none',
      severity: 'info',
      confirmed: true,
      message: 'Aucun protocole TLS obsolète (1.0/1.1) accepté. ✔',
      recommendation: null,
    });
  }

  return result;
}

module.exports = { verify, tryProtocol, WEAK_PROTOCOLS };
