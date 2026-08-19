'use strict';

/**
 * Comptes clients + clés d'accès + abonnement
 *
 * Modèle self-service : un client crée un compte, reçoit une CLÉ D'API
 * (montrée une seule fois), paie, puis lance autant d'audits qu'il veut tant
 * que son abonnement est actif — sans intervention manuelle.
 *
 * Sécurité : on ne stocke JAMAIS la clé en clair, seulement son empreinte
 * (SHA-256). Comparaison en temps constant. Modules natifs uniquement.
 */

const crypto = require('crypto');
const store = require('../lib/store');

const COLLECTION = 'accounts';

function hashKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

function generateKey() {
  // Préfixe lisible + entropie forte.
  return 'sk_live_' + crypto.randomBytes(24).toString('hex');
}

function now() {
  return Date.now();
}

/**
 * Un compte est-il actif (abonnement payé et non expiré) ?
 */
function isActive(account) {
  if (!account || account.status !== 'active') return false;
  if (!account.validUntil) return true; // actif sans échéance (ex: à vie)
  return new Date(account.validUntil).getTime() > now();
}

function publicView(account) {
  if (!account) return null;
  return {
    id: account.id,
    email: account.email,
    plan: account.plan,
    status: account.status,
    active: isActive(account),
    validUntil: account.validUntil || null,
    auditsCount: account.auditsCount || 0,
    createdAt: account.createdAt,
  };
}

/**
 * Crée un compte. Renvoie la clé EN CLAIR une seule fois.
 * @param {object} params - { email, plan }
 * @returns {{ ok:boolean, reason?:string, account?:object, apiKey?:string }}
 */
function createAccount(params) {
  const email = params && params.email ? String(params.email).trim().toLowerCase() : '';
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, reason: 'Email invalide.' };
  }
  const accounts = store.readAll(COLLECTION);
  if (accounts.some((a) => a.email === email)) {
    return { ok: false, reason: 'Un compte existe déjà pour cet email.' };
  }

  const apiKey = generateKey();
  const account = {
    id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
    email,
    apiKeyHash: hashKey(apiKey),
    plan: params.plan || 'passif',
    status: 'inactive', // devient 'active' après paiement
    validUntil: null,
    stripeCustomerId: null,
    auditsCount: 0,
    createdAt: new Date().toISOString(),
  };
  accounts.push(account);
  store.writeAll(COLLECTION, accounts);
  return { ok: true, account: publicView(account), apiKey };
}

/**
 * Retrouve un compte à partir d'une clé d'API (comparaison temps constant).
 */
function findByKey(apiKey) {
  if (!apiKey) return null;
  const target = hashKey(apiKey);
  const targetBuf = Buffer.from(target, 'hex');
  const accounts = store.readAll(COLLECTION);
  for (const a of accounts) {
    const buf = Buffer.from(a.apiKeyHash, 'hex');
    if (buf.length === targetBuf.length && crypto.timingSafeEqual(buf, targetBuf)) {
      return a;
    }
  }
  return null;
}

function findByEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  return store.readAll(COLLECTION).find((a) => a.email === e) || null;
}

function findById(id) {
  return store.readAll(COLLECTION).find((a) => a.id === id) || null;
}

function persist(account) {
  const accounts = store.readAll(COLLECTION);
  const idx = accounts.findIndex((a) => a.id === account.id);
  if (idx === -1) return false;
  accounts[idx] = account;
  store.writeAll(COLLECTION, accounts);
  return true;
}

/**
 * Active (ou prolonge) l'abonnement d'un compte.
 * @param {string} idOrEmail
 * @param {object} [opts] - { days, plan, stripeCustomerId }
 */
function activate(idOrEmail, opts = {}) {
  const account = findById(idOrEmail) || findByEmail(idOrEmail);
  if (!account) return { ok: false, reason: 'Compte introuvable.' };

  account.status = 'active';
  if (opts.plan) account.plan = opts.plan;
  if (opts.stripeCustomerId) account.stripeCustomerId = opts.stripeCustomerId;

  if (opts.days === 0 || opts.lifetime) {
    account.validUntil = null; // à vie
  } else {
    const days = opts.days != null ? Number(opts.days) : 30;
    // On prolonge à partir de la date la plus tardive (maintenant ou échéance).
    const base = account.validUntil && new Date(account.validUntil).getTime() > now()
      ? new Date(account.validUntil).getTime()
      : now();
    account.validUntil = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();
  }
  persist(account);
  return { ok: true, account: publicView(account) };
}

function deactivate(idOrEmail) {
  const account = findById(idOrEmail) || findByEmail(idOrEmail);
  if (!account) return { ok: false, reason: 'Compte introuvable.' };
  account.status = 'inactive';
  persist(account);
  return { ok: true, account: publicView(account) };
}

/**
 * Incrémente le compteur d'audits (usage illimité, on ne fait que compter).
 */
function recordAudit(account) {
  account.auditsCount = (account.auditsCount || 0) + 1;
  persist(account);
  return account.auditsCount;
}

module.exports = {
  createAccount,
  findByKey,
  findByEmail,
  findById,
  activate,
  deactivate,
  recordAudit,
  isActive,
  publicView,
  hashKey,
};
