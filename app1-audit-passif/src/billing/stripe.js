'use strict';

/**
 * Intégration Stripe — via l'API REST directement (aucun SDK à installer).
 *
 * - createCheckoutSession() : crée une page de paiement hébergée par Stripe.
 * - verifyWebhookSignature() : valide la signature d'un webhook avec le
 *   `crypto` natif (HMAC-SHA256), sans dépendance.
 * - parseEvent() : extrait l'action à effectuer (activer/désactiver un compte).
 *
 * Tout est OPTIONNEL : sans STRIPE_SECRET_KEY, le module signale « non
 * configuré » et l'activation manuelle (admin) reste disponible.
 *
 * Variables d'environnement :
 *   STRIPE_SECRET_KEY       (sk_live_... ou sk_test_...)
 *   STRIPE_PRICE_ID         (price_... de l'abonnement)
 *   STRIPE_WEBHOOK_SECRET   (whsec_...)
 *   PUBLIC_BASE_URL         (ex: https://audit.mondomaine.com)
 */

const https = require('https');
const crypto = require('crypto');
const { URLSearchParams } = require('url');

function isConfigured() {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PRICE_ID;
}

/**
 * POST form-encodé vers l'API Stripe (natif).
 */
function stripePost(pathname, formObject) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(formObject).toString();
    const req = https.request(
      {
        method: 'POST',
        hostname: 'api.stripe.com',
        path: pathname,
        headers: {
          Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = { raw: data };
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Timeout Stripe')));
    req.write(body);
    req.end();
  });
}

/**
 * Crée une session de paiement (abonnement) pour un compte.
 * @param {object} account - compte (id, email)
 * @returns {Promise<{ ok:boolean, url?:string, reason?:string }>}
 */
async function createCheckoutSession(account) {
  if (!isConfigured()) {
    return { ok: false, reason: 'Stripe non configuré (STRIPE_SECRET_KEY / STRIPE_PRICE_ID).' };
  }
  const base = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
  const form = {
    mode: 'payment', // paiement unique (pas d'abonnement récurrent)
    'line_items[0][price]': process.env.STRIPE_PRICE_ID,
    'line_items[0][quantity]': '1',
    success_url: base + '/app?paid=1',
    cancel_url: base + '/app?canceled=1',
    client_reference_id: account.id,
    customer_email: account.email,
  };
  try {
    const res = await stripePost('/v1/checkout/sessions', form);
    if (res.status === 200 && res.data && res.data.url) {
      return { ok: true, url: res.data.url };
    }
    return {
      ok: false,
      reason:
        'Erreur Stripe (' +
        res.status +
        ') : ' +
        (res.data && res.data.error ? res.data.error.message : 'inconnue'),
    };
  } catch (err) {
    return { ok: false, reason: 'Appel Stripe impossible : ' + err.message };
  }
}

/**
 * Vérifie la signature d'un webhook Stripe (Stripe-Signature: t=..,v1=..).
 * @param {string} rawBody - corps brut EXACT (non parsé)
 * @param {string} signatureHeader
 * @param {number} [toleranceSec=300]
 * @returns {{ ok:boolean, reason?:string }}
 */
function verifyWebhookSignature(rawBody, signatureHeader, toleranceSec = 300) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return { ok: false, reason: 'STRIPE_WEBHOOK_SECRET absent.' };
  if (!signatureHeader) return { ok: false, reason: 'Signature absente.' };

  // En-tête Stripe : "t=1492774577,v1=abc...,v0=def..." (v1 peut apparaître
  // plusieurs fois lors d'une rotation de secret).
  let t = null;
  const v1List = [];
  for (const kv of signatureHeader.split(',')) {
    const idx = kv.indexOf('=');
    if (idx === -1) continue;
    const k = kv.slice(0, idx).trim();
    const v = kv.slice(idx + 1).trim();
    if (k === 't') t = v;
    else if (k === 'v1') v1List.push(v);
  }
  if (!t || !v1List.length) return { ok: false, reason: 'Signature mal formée.' };

  // Anti-rejeu : horodatage dans la tolérance.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
  if (Number.isNaN(age) || age > toleranceSec) {
    return { ok: false, reason: 'Horodatage hors tolérance (rejeu ?).' };
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(t + '.' + rawBody, 'utf8')
    .digest('hex');
  const expBuf = Buffer.from(expected, 'hex');

  const valid = v1List.some((v1) => {
    const v1Buf = Buffer.from(String(v1), 'hex');
    return expBuf.length === v1Buf.length && crypto.timingSafeEqual(expBuf, v1Buf);
  });
  return valid ? { ok: true } : { ok: false, reason: 'Signature invalide.' };
}

/**
 * Traduit un événement Stripe en action métier.
 * @param {object} event - événement Stripe parsé
 * @returns {{ action:'activate'|'deactivate'|'ignore', ref?:string, email?:string, customer?:string, days?:number }}
 */
function parseEvent(event) {
  const type = event && event.type;
  const obj = event && event.data && event.data.object ? event.data.object : {};

  switch (type) {
    // Paiement unique réussi -> accès À VIE (lifetime).
    case 'checkout.session.completed':
    case 'payment_intent.succeeded':
      return {
        action: 'activate',
        ref: obj.client_reference_id || null,
        email:
          obj.customer_email ||
          (obj.customer_details && obj.customer_details.email) ||
          (obj.receipt_email || null),
        customer: obj.customer || null,
        lifetime: true, // paiement en une fois = accès permanent
      };
    default:
      return { action: 'ignore' };
  }
}

module.exports = {
  isConfigured,
  createCheckoutSession,
  verifyWebhookSignature,
  parseEvent,
};
