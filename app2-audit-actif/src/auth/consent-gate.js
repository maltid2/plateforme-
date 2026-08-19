'use strict';

/**
 * App 2 — Gate légal (module OBLIGATOIRE, à développer et exécuter en premier)
 *
 * Aucun scan actif ne peut démarrer sans passage par ce module. Il :
 *   1. Impose une confirmation explicite : « Je certifie être autorisé à
 *      tester ce système ».
 *   2. Enregistre une trace horodatée (IP cible, heure, utilisateur, texte
 *      de confirmation accepté) dans logs/consent-log.json.
 *
 * Le scan actif d'un système sans autorisation est illégal dans la plupart
 * des juridictions (en France : art. 323-1 et suivants du Code pénal). Ce
 * module matérialise le mandat écrit exigé par le cahier des charges.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONSENT_PHRASE = 'Je certifie être autorisé à tester ce système';
const LOG_FILE = path.join(__dirname, '..', '..', 'logs', 'consent-log.json');

/**
 * Charge le journal de consentement (crée un tableau vide si absent).
 */
function loadLog() {
  try {
    const raw = fs.readFileSync(LOG_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

/**
 * Écrit une entrée dans le journal de consentement (append).
 */
function appendLog(entry) {
  const log = loadLog();
  log.push(entry);
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2), 'utf8');
  return entry;
}

/**
 * Normalise et compare la phrase de confirmation (insensible aux accents,
 * à la casse et aux espaces superflus) pour éviter de bloquer sur un détail
 * de saisie, tout en exigeant une phrase de sens équivalent.
 */
function normalize(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents (diacritiques combinants)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function phraseMatches(input) {
  return normalize(input) === normalize(CONSENT_PHRASE);
}

/**
 * Valide un consentement et l'enregistre.
 *
 * @param {object} params
 * @param {string} params.target        - IP ou hôte cible du scan
 * @param {string} params.user          - identité de l'opérateur (email, nom...)
 * @param {string} params.confirmation  - texte de confirmation saisi
 * @param {boolean} [params.mandateOnFile] - un mandat écrit signé existe-t-il ?
 * @param {string} [params.mandateRef]  - référence du mandat (n° contrat...)
 * @returns {{ granted: boolean, reason?: string, entry?: object }}
 */
function requestConsent(params) {
  const { target, user, confirmation, mandateOnFile, mandateRef } = params || {};

  if (!target || !String(target).trim()) {
    return { granted: false, reason: 'Cible manquante.' };
  }
  if (!user || !String(user).trim()) {
    return { granted: false, reason: 'Identité de l\'opérateur manquante.' };
  }
  if (!phraseMatches(confirmation)) {
    return {
      granted: false,
      reason:
        'Confirmation invalide. Vous devez saisir exactement : « ' +
        CONSENT_PHRASE +
        ' ».',
    };
  }
  if (mandateOnFile !== true) {
    return {
      granted: false,
      reason:
        'Un mandat écrit signé est obligatoire (mandateOnFile doit être true). ' +
        'Aucun scan ne peut démarrer sans autorisation écrite.',
    };
  }

  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
    timestamp: new Date().toISOString(),
    target: String(target).trim(),
    user: String(user).trim(),
    confirmationText: String(confirmation).trim(),
    mandateRef: mandateRef ? String(mandateRef).trim() : null,
    granted: true,
  };

  appendLog(entry);
  return { granted: true, entry };
}

/**
 * Vérifie qu'un consentement valide existe pour une cible donnée (utilisé
 * comme garde avant de lancer un scan).
 * @param {string} target
 * @param {object} [opts] - { maxAgeMs } fraîcheur maximale du consentement
 * @returns {{ ok: boolean, entry?: object, reason?: string }}
 */
function assertConsent(target, opts = {}) {
  const log = loadLog();
  const t = String(target).trim();
  const maxAge = opts.maxAgeMs || 24 * 60 * 60 * 1000; // 24 h par défaut
  const now = Date.now();

  // On prend le consentement le plus récent pour cette cible.
  const matching = log
    .filter((e) => e.granted && e.target === t)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (!matching.length) {
    return {
      ok: false,
      reason:
        'Aucun consentement enregistré pour ' +
        t +
        '. Passez par requestConsent() avant tout scan.',
    };
  }

  const latest = matching[0];
  const age = now - new Date(latest.timestamp).getTime();
  if (age > maxAge) {
    return {
      ok: false,
      reason:
        'Le consentement pour ' +
        t +
        ' a expiré (âge > ' +
        Math.round(maxAge / 3600000) +
        ' h). Renouvelez l\'autorisation.',
    };
  }

  return { ok: true, entry: latest };
}

module.exports = {
  CONSENT_PHRASE,
  requestConsent,
  assertConsent,
  phraseMatches,
  loadLog,
  LOG_FILE,
};
