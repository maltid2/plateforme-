'use strict';

/**
 * Règles d'Engagement (Rules of Engagement — RoE)
 *
 * Surcouche du gate légal pour le cadre « test d'intrusion autorisé ».
 * Là où `consent-gate.js` matérialise le mandat, la RoE définit et fait
 * respecter le PÉRIMÈTRE exact de l'autorisation :
 *
 *   - allowlist de cibles (hôtes exacts + IPv4 + plages CIDR)
 *   - fenêtre temporelle d'autorisation (début / fin)
 *   - identité de l'opérateur + référence d'engagement
 *   - confirmation explicite (reprise de la phrase du consent-gate)
 *
 * Principe fondamental : AUCUNE action active (scan, vérification, plugin)
 * ne doit s'exécuter sur une cible qui n'est pas EXPLICITEMENT dans le
 * périmètre autorisé et dans la fenêtre temporelle. `authorize()` est le
 * point de contrôle unique appelé avant toute opération intrusive.
 *
 * C'est ce qui distingue un test d'intrusion légal d'un scan illégal.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const consentGate = require('./consent-gate');

const ROE_FILE = path.join(__dirname, '..', '..', 'logs', 'engagements.json');

function loadEngagements() {
  try {
    const raw = fs.readFileSync(ROE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveEngagement(entry) {
  const list = loadEngagements();
  list.push(entry);
  fs.mkdirSync(path.dirname(ROE_FILE), { recursive: true });
  fs.writeFileSync(ROE_FILE, JSON.stringify(list, null, 2), 'utf8');
  return entry;
}

// --- Utilitaires réseau (IPv4 / CIDR) ---

function ipv4ToLong(ip) {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return null;
  let long = 0;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    long = (long << 8) + n;
  }
  return long >>> 0;
}

function isIpv4(str) {
  return ipv4ToLong(str) != null;
}

/**
 * Une IPv4 appartient-elle à une entrée de périmètre (IP exacte ou CIDR) ?
 */
function ipInScopeEntry(ip, entry) {
  const ipLong = ipv4ToLong(ip);
  if (ipLong == null) return false;

  if (entry.includes('/')) {
    const [range, bitsStr] = entry.split('/');
    const bits = Number(bitsStr);
    const rangeLong = ipv4ToLong(range);
    if (rangeLong == null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
      return false;
    }
    if (bits === 0) return true;
    const mask = (~((1 << (32 - bits)) - 1)) >>> 0;
    return (ipLong & mask) === (rangeLong & mask);
  }
  const entryLong = ipv4ToLong(entry);
  return entryLong != null && entryLong === ipLong;
}

/**
 * La cible est-elle couverte par le périmètre déclaré ?
 * @param {string} target - hôte ou IPv4
 * @param {string[]} scope - hôtes exacts, IPv4, ou CIDR
 */
function targetInScope(target, scope) {
  const t = String(target).trim().toLowerCase();
  for (const raw of scope) {
    const entry = String(raw).trim();
    if (!entry) continue;
    if (isIpv4(target)) {
      if (ipInScopeEntry(target, entry)) return true;
    }
    // Correspondance d'hôte exacte (insensible à la casse).
    if (!entry.includes('/') && entry.toLowerCase() === t) return true;
  }
  return false;
}

/**
 * Enregistre un engagement (périmètre + fenêtre + mandat).
 *
 * @param {object} params
 * @param {string}   params.operator      - identité de l'opérateur
 * @param {string}   params.engagementRef - référence du mandat/contrat
 * @param {string[]} params.scope         - cibles autorisées (hôtes/IP/CIDR)
 * @param {string}   params.confirmation  - phrase de certification
 * @param {boolean}  params.mandateOnFile - mandat écrit signé disponible
 * @param {string}  [params.windowStart]  - ISO début d'autorisation (défaut: maintenant)
 * @param {string}  [params.windowEnd]    - ISO fin d'autorisation (défaut: +7 jours)
 * @returns {{ ok: boolean, reason?: string, engagement?: object }}
 */
function registerEngagement(params) {
  const {
    operator,
    engagementRef,
    scope,
    confirmation,
    mandateOnFile,
    windowStart,
    windowEnd,
  } = params || {};

  if (!operator || !String(operator).trim()) {
    return { ok: false, reason: 'Identité de l\'opérateur manquante.' };
  }
  if (!engagementRef || !String(engagementRef).trim()) {
    return { ok: false, reason: 'Référence d\'engagement (mandat) manquante.' };
  }
  if (!Array.isArray(scope) || scope.length === 0) {
    return {
      ok: false,
      reason: 'Périmètre vide : déclarez au moins une cible autorisée (hôte/IP/CIDR).',
    };
  }
  if (!consentGate.phraseMatches(confirmation)) {
    return {
      ok: false,
      reason:
        'Confirmation invalide. Saisissez exactement : « ' +
        consentGate.CONSENT_PHRASE +
        ' ».',
    };
  }
  if (mandateOnFile !== true) {
    return {
      ok: false,
      reason: 'Mandat écrit signé obligatoire (mandateOnFile doit être true).',
    };
  }

  const start = windowStart ? new Date(windowStart) : new Date();
  const end = windowEnd
    ? new Date(windowEnd)
    : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (isNaN(start) || isNaN(end) || end <= start) {
    return { ok: false, reason: 'Fenêtre temporelle invalide (fin <= début).' };
  }

  const engagement = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString('hex'),
    type: 'engagement',
    createdAt: new Date().toISOString(),
    operator: String(operator).trim(),
    engagementRef: String(engagementRef).trim(),
    scope: scope.map((s) => String(s).trim()),
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    confirmationText: String(confirmation).trim(),
    granted: true,
  };

  saveEngagement(engagement);
  return { ok: true, engagement };
}

/**
 * POINT DE CONTRÔLE UNIQUE — autorise (ou non) une action active sur une
 * cible. À appeler avant TOUT scan/vérification/plugin.
 *
 * @param {string} target
 * @returns {{ ok: boolean, engagement?: object, reason?: string }}
 */
function authorize(target) {
  const t = String(target || '').trim();
  if (!t) return { ok: false, reason: 'Cible manquante.' };

  const now = Date.now();
  const engagements = loadEngagements()
    .filter((e) => e.granted && e.type === 'engagement')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!engagements.length) {
    return {
      ok: false,
      reason:
        'Aucun engagement enregistré. Déclarez le périmètre via registerEngagement() avant toute action.',
    };
  }

  // On cherche un engagement qui couvre la cible ET dont la fenêtre est active.
  for (const e of engagements) {
    if (!targetInScope(t, e.scope)) continue;
    const start = new Date(e.windowStart).getTime();
    const end = new Date(e.windowEnd).getTime();
    if (now < start) {
      return {
        ok: false,
        reason:
          'La fenêtre d\'autorisation pour ' +
          t +
          ' n\'a pas encore commencé (' +
          e.windowStart +
          ').',
      };
    }
    if (now > end) {
      return {
        ok: false,
        reason:
          'La fenêtre d\'autorisation pour ' + t + ' est expirée (' + e.windowEnd + ').',
      };
    }
    return { ok: true, engagement: e };
  }

  return {
    ok: false,
    reason:
      'Cible ' +
      t +
      ' HORS PÉRIMÈTRE autorisé. Aucune action active ne sera exécutée.',
  };
}

module.exports = {
  registerEngagement,
  authorize,
  targetInScope,
  ipInScopeEntry,
  isIpv4,
  loadEngagements,
  ROE_FILE,
};
