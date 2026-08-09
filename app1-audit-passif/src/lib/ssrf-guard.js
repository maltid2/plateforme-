'use strict';

/**
 * Garde anti-SSRF
 *
 * L'interface web audite l'URL soumise par l'utilisateur. Sans garde, on
 * pourrait la pointer vers des adresses internes/privées et détourner
 * l'outil en pivot SSRF. Ce module résout l'hôte et refuse toute cible qui
 * n'est pas une IP publique routable.
 *
 * Modules natifs uniquement.
 */

const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');

function ipv4ToLong(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

function inRange(ipLong, cidr) {
  const [range, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const rLong = ipv4ToLong(range);
  if (rLong == null) return false;
  if (bits === 0) return true;
  const mask = (~((1 << (32 - bits)) - 1)) >>> 0;
  return (ipLong & mask) === (rLong & mask);
}

// Plages non publiques IPv4.
const PRIVATE_V4 = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10', // CGNAT
  '127.0.0.0/8', // loopback
  '169.254.0.0/16', // link-local
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24', // TEST-NET (doc)
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24', // TEST-NET-2
  '203.0.113.0/24', // TEST-NET-3
  '224.0.0.0/4', // multicast
  '240.0.0.0/4', // réservé
];

function isPrivateV4(ip) {
  const l = ipv4ToLong(ip);
  if (l == null) return true; // en cas de doute, on bloque
  return PRIVATE_V4.some((cidr) => inRange(l, cidr));
}

function isPrivateV6(ip) {
  const low = ip.toLowerCase();
  return (
    low === '::1' || // loopback
    low.startsWith('fe80') || // link-local
    low.startsWith('fc') || // unique local
    low.startsWith('fd') ||
    low.startsWith('::ffff:') // IPv4-mapped -> on préfère refuser
  );
}

/**
 * Vérifie qu'une URL cible est publique et auditable.
 * @param {string} targetUrl
 * @returns {Promise<{ ok: boolean, reason?: string, ip?: string }>}
 */
async function assertPublicTarget(targetUrl) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (err) {
    return { ok: false, reason: 'URL invalide.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Seuls http:// et https:// sont acceptés.' };
  }

  const host = parsed.hostname;

  // Noms d'hôte manifestement locaux.
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return { ok: false, reason: 'Cible locale/interne interdite.' };
  }

  // Si c'est déjà une IP littérale.
  if (net.isIP(host) === 4) {
    if (isPrivateV4(host)) return { ok: false, reason: 'IP privée/réservée interdite.' };
    return { ok: true, ip: host };
  }
  if (net.isIP(host) === 6) {
    if (isPrivateV6(host)) return { ok: false, reason: 'IP IPv6 privée interdite.' };
    return { ok: true, ip: host };
  }

  // Sinon on résout le nom et on vérifie TOUTES les IP renvoyées.
  let records;
  try {
    records = await dns.lookup(host, { all: true });
  } catch (err) {
    return { ok: false, reason: 'Résolution DNS impossible : ' + err.message };
  }
  if (!records.length) {
    return { ok: false, reason: 'Aucune adresse IP résolue.' };
  }
  for (const r of records) {
    if (r.family === 4 && isPrivateV4(r.address)) {
      return { ok: false, reason: 'L\'hôte résout vers une IP privée/réservée.' };
    }
    if (r.family === 6 && isPrivateV6(r.address)) {
      return { ok: false, reason: 'L\'hôte résout vers une IP IPv6 privée.' };
    }
  }

  return { ok: true, ip: records[0].address };
}

module.exports = { assertPublicTarget, isPrivateV4, isPrivateV6 };
