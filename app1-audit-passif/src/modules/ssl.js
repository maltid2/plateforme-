'use strict';

/**
 * Module A1 — SSL/TLS
 *
 * Récupère le certificat TLS via le module natif `tls` de Node (aucune
 * requête intrusive : simple handshake TLS, comme un navigateur).
 *
 * Vérifie :
 *   - date d'expiration du certificat
 *   - version du protocole négocié (TLS 1.2 / 1.3 minimum)
 *   - suite de chiffrement (cipher)
 *
 * Grille inspirée de SSL Labs : un protocole obsolète (TLS < 1.2)
 * entraîne une pénalité forte.
 */

const tls = require('tls');
const { URL } = require('url');

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Ouvre une connexion TLS et renvoie les informations du certificat + du
 * protocole négocié.
 * @param {string} host
 * @param {number} port
 * @param {number} timeout
 * @returns {Promise<object>}
 */
function fetchCertificate(host, port, timeout) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host, // SNI
        // On veut inspecter même un certificat invalide/expiré, donc on
        // n'interrompt pas le handshake sur une erreur de validation.
        rejectUnauthorized: false,
        timeout,
      },
      () => {
        const cert = socket.getPeerCertificate(true);
        const protocol = socket.getProtocol(); // ex: 'TLSv1.3'
        const cipher = socket.getCipher(); // { name, standardName, version }
        const authorized = socket.authorized;
        const authorizationError = socket.authorizationError
          ? String(socket.authorizationError)
          : null;
        socket.end();
        resolve({ cert, protocol, cipher, authorized, authorizationError });
      }
    );

    socket.on('error', (err) => {
      reject(err);
    });

    socket.setTimeout(timeout, () => {
      socket.destroy();
      reject(new Error('Timeout TLS après ' + timeout + ' ms'));
    });
  });
}

/**
 * Convertit une version de protocole ('TLSv1', 'TLSv1.2', ...) en note.
 */
function protocolScore(protocol) {
  switch (protocol) {
    case 'TLSv1.3':
      return { note: 100, obsolete: false };
    case 'TLSv1.2':
      return { note: 90, obsolete: false };
    case 'TLSv1.1':
      return { note: 40, obsolete: true };
    case 'TLSv1':
      return { note: 20, obsolete: true };
    case 'SSLv3':
    case 'SSLv2':
      return { note: 0, obsolete: true };
    default:
      return { note: 50, obsolete: false };
  }
}

/**
 * Point d'entrée du module A1.
 * @param {string} targetUrl - URL cible (http(s)://...)
 * @param {object} [options]
 * @returns {Promise<object>} résultat structuré JSON
 */
async function run(targetUrl, options = {}) {
  const timeout = options.timeout || DEFAULT_TIMEOUT_MS;
  const parsed = new URL(targetUrl);
  const host = parsed.hostname;
  const port = parsed.port ? Number(parsed.port) : 443;

  const result = {
    module: 'A1',
    name: 'SSL/TLS',
    target: host + ':' + port,
    checked: [],
    findings: [],
    score: 0, // 0..100
    error: null,
  };

  // Si la cible est en HTTP pur, pas de TLS à analyser.
  if (parsed.protocol === 'http:' && !parsed.port) {
    result.error = 'Cible en HTTP (pas de TLS). Voir module compliance pour la redirection HTTPS.';
    result.findings.push({
      id: 'no-tls',
      severity: 'high',
      message: 'Le site est servi en HTTP sans chiffrement TLS.',
      recommendation:
        'Mettre en place un certificat TLS (Let\'s Encrypt gratuit) et forcer HTTPS.',
    });
    result.score = 0;
    return result;
  }

  let data;
  try {
    data = await fetchCertificate(host, port, timeout);
  } catch (err) {
    result.error = 'Connexion TLS impossible : ' + err.message;
    result.findings.push({
      id: 'tls-connect-failed',
      severity: 'high',
      message: 'Impossible d\'établir une connexion TLS : ' + err.message,
      recommendation:
        'Vérifier que le port 443 est ouvert et qu\'un certificat valide est présenté.',
    });
    result.score = 0;
    return result;
  }

  const { cert, protocol, cipher, authorized, authorizationError } = data;

  // --- Vérification du protocole ---
  const proto = protocolScore(protocol);
  result.protocol = protocol;
  result.checked.push('protocole: ' + protocol);
  if (proto.obsolete) {
    result.findings.push({
      id: 'obsolete-protocol',
      severity: 'high',
      message:
        'Protocole obsolète négocié : ' +
        protocol +
        '. Ces versions présentent des vulnérabilités connues.',
      recommendation:
        'Désactiver SSLv3/TLS 1.0/1.1 côté serveur et n\'autoriser que TLS 1.2 et 1.3.',
    });
  }

  // --- Vérification de l'expiration ---
  let expiryScore = 100;
  if (cert && cert.valid_to) {
    const validTo = new Date(cert.valid_to);
    const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
    const now = new Date();
    const daysLeft = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));
    result.certificate = {
      subject: cert.subject && cert.subject.CN ? cert.subject.CN : null,
      issuer: cert.issuer && cert.issuer.O ? cert.issuer.O : null,
      validFrom: validFrom ? validFrom.toISOString() : null,
      validTo: validTo.toISOString(),
      daysLeft,
    };
    result.checked.push('expiration: ' + daysLeft + ' jours restants');

    if (daysLeft < 0) {
      expiryScore = 0;
      result.findings.push({
        id: 'cert-expired',
        severity: 'high',
        message: 'Le certificat TLS a expiré (' + validTo.toISOString() + ').',
        recommendation: 'Renouveler immédiatement le certificat.',
      });
    } else if (daysLeft < 15) {
      expiryScore = 50;
      result.findings.push({
        id: 'cert-expiring-soon',
        severity: 'medium',
        message: 'Le certificat expire dans ' + daysLeft + ' jours.',
        recommendation:
          'Renouveler le certificat sans tarder et automatiser le renouvellement.',
      });
    } else if (daysLeft < 30) {
      expiryScore = 80;
      result.findings.push({
        id: 'cert-expiring',
        severity: 'low',
        message: 'Le certificat expire dans ' + daysLeft + ' jours.',
        recommendation: 'Prévoir le renouvellement (idéalement automatisé).',
      });
    }
  } else {
    expiryScore = 40;
    result.findings.push({
      id: 'cert-no-date',
      severity: 'medium',
      message: 'Impossible de lire la date d\'expiration du certificat.',
      recommendation: 'Vérifier la chaîne de certification présentée.',
    });
  }

  // --- Validation de la chaîne (nom d'hôte, autorité) ---
  if (!authorized) {
    result.findings.push({
      id: 'cert-not-trusted',
      severity: 'high',
      message:
        'La chaîne de certification n\'est pas validée par le magasin de confiance système' +
        (authorizationError ? ' (' + authorizationError + ').' : '.'),
      recommendation:
        'Installer un certificat émis par une autorité reconnue et fournir la chaîne intermédiaire complète.',
    });
  }

  // --- Cipher ---
  if (cipher) {
    result.cipher = cipher.name || cipher.standardName;
    result.checked.push('cipher: ' + result.cipher);
  }

  // --- Score final pondéré interne au module ---
  // Protocole 50 %, expiration 30 %, chaîne de confiance 20 %.
  const trustScore = authorized ? 100 : 20;
  result.score = Math.round(
    proto.note * 0.5 + expiryScore * 0.3 + trustScore * 0.2
  );

  return result;
}

module.exports = { run, protocolScore };
