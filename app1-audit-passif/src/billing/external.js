'use strict';

/**
 * Paiement EXTERNE (provider-agnostique)
 *
 * Le paiement est encaissé sur une plateforme externe (lien de paiement
 * Stripe, PayPal, Gumroad, votre site existant, etc.). L'app ne traite aucun
 * paiement : elle se contente de
 *   1. rediriger le client vers le lien de paiement externe (PAYMENT_URL) ;
 *   2. débloquer l'accès quand la plateforme externe confirme le paiement,
 *      via un webhook générique authentifié par un secret partagé.
 *
 * Aucune dépendance ; `crypto` natif pour la comparaison en temps constant.
 *
 * Variables d'environnement :
 *   PAYMENT_URL         Lien de paiement externe (obligatoire pour /api/checkout)
 *   ACTIVATION_SECRET   Secret partagé pour authentifier /webhook/payment
 *   PUBLIC_BASE_URL     URL publique de l'app (pour le retour après paiement)
 */

const crypto = require('crypto');

function isConfigured() {
  return !!process.env.PAYMENT_URL;
}

/**
 * Construit le lien de paiement externe pour un compte, en y joignant sa
 * référence + email (pour que la plateforme externe puisse nous les
 * renvoyer dans le webhook). On ajoute aussi une URL de retour.
 *
 * @param {object} account - { id, email }
 * @returns {{ ok:boolean, url?:string, reason?:string }}
 */
function paymentUrl(account) {
  const base = process.env.PAYMENT_URL;
  if (!base) {
    return { ok: false, reason: 'PAYMENT_URL non configuré (lien de paiement externe).' };
  }
  let url;
  try {
    url = new URL(base);
  } catch (err) {
    return { ok: false, reason: 'PAYMENT_URL invalide.' };
  }
  // Paramètres de référence — noms courants ; adaptables à votre plateforme.
  // (Stripe Payment Links lit client_reference_id ; d'autres lisent ref/email.)
  url.searchParams.set('client_reference_id', account.id);
  url.searchParams.set('ref', account.id);
  if (account.email) {
    url.searchParams.set('prefilled_email', account.email);
    url.searchParams.set('email', account.email);
  }
  const ret = process.env.PUBLIC_BASE_URL;
  if (ret) url.searchParams.set('redirect', ret + '/app?paid=1');
  return { ok: true, url: url.toString() };
}

/**
 * Authentifie une requête d'activation entrante (webhook générique).
 * La plateforme externe (ou une automatisation type Zapier/Make) envoie
 * `Authorization: Bearer <ACTIVATION_SECRET>`.
 *
 * @param {string} authHeader - valeur de l'en-tête Authorization
 * @returns {{ ok:boolean, reason?:string }}
 */
function checkActivationToken(authHeader) {
  const secret = process.env.ACTIVATION_SECRET;
  if (!secret) return { ok: false, reason: 'ACTIVATION_SECRET non configuré.' };
  const m = String(authHeader || '').match(/^Bearer\s+(.+)$/i);
  const provided = m ? m[1].trim() : '';
  if (!provided) return { ok: false, reason: 'Jeton d\'activation absent.' };

  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  return valid ? { ok: true } : { ok: false, reason: 'Jeton d\'activation invalide.' };
}

/**
 * Extrait la cible à activer depuis le corps du webhook générique.
 * Accepte { ref } (id de compte) ou { email }.
 * @param {object} body
 * @returns {{ target: string|null }}
 */
function activationTarget(body) {
  if (!body || typeof body !== 'object') return { target: null };
  const target =
    body.ref ||
    body.client_reference_id ||
    body.account_id ||
    body.email ||
    null;
  return { target: target ? String(target).trim() : null };
}

module.exports = { isConfigured, paymentUrl, checkActivationToken, activationTarget };
