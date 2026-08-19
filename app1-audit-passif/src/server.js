'use strict';

/**
 * Interface web — App 1 (audit passif)
 *
 * Serveur HTTP 100 % natif (aucune dépendance, pas d'Express) : c'est la
 * couche que voit le CLIENT. Il saisit une URL, obtient une note A/B/C/D/F
 * et un rapport partageable.
 *
 * Routes :
 *   GET  /                -> page de saisie (formulaire)
 *   POST /api/audit       -> lance l'audit passif, renvoie le résultat JSON
 *   GET  /r/:id           -> rapport HTML partageable (lien à transmettre)
 *   GET  /r/:id.json      -> résultat brut JSON
 *
 * Sécurité : garde anti-SSRF (refuse les cibles internes/privées).
 *
 * Lancement : node src/server.js   (port par défaut 3000, surchargeable via PORT)
 */

require('./lib/env').loadEnv();

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { audit } = require('./index');
const reportGen = require('./report/generator');
const ssrf = require('./lib/ssrf-guard');
const accounts = require('./auth/accounts');
const stripe = require('./billing/stripe');
const external = require('./billing/external');
const brand = require('./lib/brand');

// --- Limiteur de débit simple (anti-abus de l'audit gratuit public) ---
const FREE_LIMIT = process.env.FREE_AUDIT_LIMIT ? Number(process.env.FREE_AUDIT_LIMIT) : 5;
const FREE_WINDOW_MS = 60 * 60 * 1000; // 1 heure
const freeHits = new Map(); // ip -> [timestamps]

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function rateLimitOk(ip) {
  const now = Date.now();
  const hits = (freeHits.get(ip) || []).filter((t) => now - t < FREE_WINDOW_MS);
  if (hits.length >= FREE_LIMIT) {
    freeHits.set(ip, hits);
    return false;
  }
  hits.push(now);
  freeHits.set(ip, hits);
  return true;
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Stockage en mémoire des rapports générés (id -> { html, report }).
// Pour une mise en production, remplacer par une base ou du stockage disque.
const REPORTS = new Map();
const MAX_REPORTS = 500;

function saveReport(report) {
  const id = crypto.randomUUID
    ? crypto.randomUUID()
    : crypto.randomBytes(12).toString('hex');
  const html = reportGen.buildHtml(report);
  REPORTS.set(id, { html, report, createdAt: Date.now() });
  // Éviction simple si trop de rapports en mémoire.
  if (REPORTS.size > MAX_REPORTS) {
    const oldest = [...REPORTS.entries()].sort(
      (a, b) => a[1].createdAt - b[1].createdAt
    )[0];
    if (oldest) REPORTS.delete(oldest[0]);
  }
  return id;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), {
    'Content-Type': 'application/json; charset=utf-8',
  });
}

const ASSETS_DIR = path.join(__dirname, 'assets');
const ASSET_TYPES = { woff2: 'font/woff2', woff: 'font/woff', css: 'text/css', svg: 'image/svg+xml', png: 'image/png' };

function serveAsset(res, name) {
  const safe = String(name).replace(/[^a-z0-9._-]/gi, '');
  const ext = safe.split('.').pop();
  fs.readFile(path.join(ASSETS_DIR, safe), (err, buf) => {
    if (err) return send(res, 404, 'Not found');
    res.writeHead(200, {
      'Content-Type': ASSET_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    res.end(buf);
  });
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('Corps trop volumineux'));
        req.destroy();
        return;
      }
      data += c;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/**
 * Extrait la clé d'API : en-tête `x-api-key` ou `Authorization: Bearer ...`.
 */
function getApiKey(req) {
  if (req.headers['x-api-key']) return String(req.headers['x-api-key']).trim();
  const auth = req.headers['authorization'] || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * Cœur commun : lit l'URL, applique le garde SSRF, lance l'audit et sauve le
 * rapport. Renvoie { ok, status, error } ou { ok:true, report, id }.
 */
async function runAuditRequest(req) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (err) {
    return { ok: false, status: 400, error: 'Requête JSON invalide.' };
  }
  const url = body && body.url ? String(body.url).trim() : '';
  if (!url) return { ok: false, status: 400, error: 'URL manquante.' };

  const normalized = /^https?:\/\//i.test(url) ? url : 'https://' + url;

  const guard = await ssrf.assertPublicTarget(normalized);
  if (!guard.ok) return { ok: false, status: 400, error: 'Cible refusée : ' + guard.reason };

  // Paramétrage : liste de modules choisis (optionnelle).
  const modules = Array.isArray(body.modules) ? body.modules : undefined;

  let report;
  try {
    report = await audit(normalized, { modules });
  } catch (err) {
    return { ok: false, status: 500, error: 'Audit impossible : ' + err.message };
  }
  const id = saveReport(report);
  return { ok: true, report, id };
}

function auditResponse(report, id, extra) {
  // Statut simple par catégorie (langage grand public) : ok si aucune alerte
  // élevée/moyenne, sinon "à améliorer".
  const categories = (report.modules || []).map((m) => ({
    id: m.module,
    ok: !(m.findings || []).some((f) => f.severity === 'high' || f.severity === 'medium'),
    degraded: !!m.degraded,
  }));
  return {
    id,
    target: report.target,
    score: report.scoring.score,
    letter: report.scoring.letter,
    meaning: report.scoring.meaning,
    findingsSummary: report.scoring.findingsSummary,
    categories,
    reportUrl: '/r/' + id,
    ...(extra || {}),
  };
}

/**
 * POST /api/audit — audit ILLIMITÉ réservé aux comptes payés.
 */
async function handleAudit(req, res) {
  const key = getApiKey(req);
  const account = key ? accounts.findByKey(key) : null;
  if (!account) {
    return sendJson(res, 401, { error: 'Clé d\'API manquante ou invalide.' });
  }
  if (!accounts.isActive(account)) {
    return sendJson(res, 402, {
      error: 'Accès inactif. Aucun audit tant que le paiement n\'est pas effectué.',
      subscribeUrl: '/app',
    });
  }
  const r = await runAuditRequest(req);
  if (!r.ok) return sendJson(res, r.status, { error: r.error });
  const auditsCount = accounts.recordAudit(account);
  return sendJson(res, 200, auditResponse(r.report, r.id, { auditsCount }));
}

/**
 * POST /api/audit/free — audit GRATUIT public (accroche), limité par IP.
 */
async function handleFreeAudit(req, res) {
  const ip = clientIp(req);
  if (!rateLimitOk(ip)) {
    return sendJson(res, 429, {
      error:
        'Limite d\'audits gratuits atteinte (' +
        FREE_LIMIT +
        '/heure). Créez un accès illimité pour continuer.',
      subscribeUrl: '/app',
    });
  }
  const r = await runAuditRequest(req);
  if (!r.ok) return sendJson(res, r.status, { error: r.error });
  return sendJson(res, 200, auditResponse(r.report, r.id, { free: true }));
}

/**
 * POST /api/account — crée un compte, renvoie la clé UNE SEULE FOIS.
 */
async function handleCreateAccount(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (err) {
    return sendJson(res, 400, { error: 'Requête JSON invalide.' });
  }
  const result = accounts.createAccount({ email: body.email, plan: body.plan });
  if (!result.ok) return sendJson(res, 400, { error: result.reason });
  return sendJson(res, 201, {
    account: result.account,
    apiKey: result.apiKey,
    note: 'Conservez cette clé : elle ne sera plus jamais affichée.',
  });
}

/**
 * GET /api/account/status — statut de l'abonnement (via clé).
 */
function handleAccountStatus(req, res) {
  const key = getApiKey(req);
  const account = key ? accounts.findByKey(key) : null;
  if (!account) return sendJson(res, 401, { error: 'Clé invalide.' });
  return sendJson(res, 200, accounts.publicView(account));
}

/**
 * POST /api/checkout — renvoie le lien de PAIEMENT EXTERNE (self-service).
 *
 * Le paiement est encaissé en externe : on redirige vers PAYMENT_URL. Si un
 * paiement Stripe intégré est configuré à la place, on l'utilise en repli.
 */
async function handleCheckout(req, res) {
  const key = getApiKey(req);
  const account = key ? accounts.findByKey(key) : null;
  if (!account) return sendJson(res, 401, { error: 'Clé invalide.' });

  // 1) Paiement externe (mode nominal).
  if (external.isConfigured()) {
    const link = external.paymentUrl(account);
    if (link.ok) return sendJson(res, 200, { checkoutUrl: link.url, external: true });
    return sendJson(res, 503, { error: link.reason });
  }
  // 2) Repli : Stripe intégré, si configuré.
  const session = await stripe.createCheckoutSession(account);
  if (!session.ok) {
    return sendJson(res, 503, {
      error: 'Aucun moyen de paiement configuré (PAYMENT_URL ou Stripe).',
    });
  }
  return sendJson(res, 200, { checkoutUrl: session.url });
}

/**
 * POST /webhook/payment — activation générique après paiement EXTERNE.
 *
 * Appelé par la plateforme de paiement externe (ou une automatisation), avec
 * `Authorization: Bearer <ACTIVATION_SECRET>` et un corps `{ ref | email }`.
 * Active le compte À VIE (paiement unique).
 */
async function handleExternalActivation(req, res) {
  const raw = await readBody(req, 256 * 1024);
  const authCheck = external.checkActivationToken(req.headers['authorization']);
  if (!authCheck.ok) {
    return sendJson(res, 401, { error: 'Activation refusée : ' + authCheck.reason });
  }
  let body;
  try {
    body = JSON.parse(raw || '{}');
  } catch (err) {
    return sendJson(res, 400, { error: 'Corps JSON invalide.' });
  }
  const { target } = external.activationTarget(body);
  if (!target) {
    return sendJson(res, 400, { error: 'Cible manquante (ref ou email).' });
  }
  const result = accounts.activate(target, { lifetime: true });
  if (!result.ok) return sendJson(res, 404, { error: result.reason });
  return sendJson(res, 200, { activated: true, account: result.account });
}

/**
 * POST /webhook/stripe — active/désactive automatiquement après paiement.
 * L'activation est TOTALEMENT autonome (aucune intervention manuelle).
 */
async function handleStripeWebhook(req, res) {
  const raw = await readBody(req, 1024 * 1024);
  const sig = req.headers['stripe-signature'];
  const verified = stripe.verifyWebhookSignature(raw, sig);
  if (!verified.ok) {
    return sendJson(res, 400, { error: 'Webhook rejeté : ' + verified.reason });
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch (err) {
    return sendJson(res, 400, { error: 'Payload invalide.' });
  }
  const decision = stripe.parseEvent(event);
  if (decision.action === 'activate') {
    const target = decision.ref || decision.email;
    if (target) {
      // Paiement unique -> accès à vie (lifetime).
      accounts.activate(target, { lifetime: true, stripeCustomerId: decision.customer });
    }
  }
  return sendJson(res, 200, { received: true });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    // Assets statiques (polices auto-hébergées).
    if (req.method === 'GET' && pathname.startsWith('/assets/')) {
      return serveAsset(res, pathname.slice('/assets/'.length));
    }
    const font = url.searchParams.get('font') || undefined;
    if (req.method === 'GET' && pathname === '/') {
      return send(res, 200, brand.landingPage(font));
    }
    if (req.method === 'GET' && (pathname === '/v2' || pathname === '/decouvrir')) {
      return send(res, 200, brand.landingAltPage(font));
    }
    if (req.method === 'GET' && pathname === '/app') {
      return send(res, 200, brand.dashboardPage(font));
    }
    if (req.method === 'POST' && pathname === '/api/audit/free') {
      return await handleFreeAudit(req, res);
    }
    if (req.method === 'POST' && pathname === '/api/audit') {
      return await handleAudit(req, res);
    }
    if (req.method === 'POST' && pathname === '/api/account') {
      return await handleCreateAccount(req, res);
    }
    if (req.method === 'GET' && pathname === '/api/account/status') {
      return handleAccountStatus(req, res);
    }
    if (req.method === 'POST' && pathname === '/api/checkout') {
      return await handleCheckout(req, res);
    }
    if (req.method === 'POST' && pathname === '/webhook/payment') {
      return await handleExternalActivation(req, res);
    }
    if (req.method === 'POST' && pathname === '/webhook/stripe') {
      return await handleStripeWebhook(req, res);
    }
    // Rapport partageable : /r/<id> ou /r/<id>.json
    const m = pathname.match(/^\/r\/([a-z0-9-]+?)(\.json)?$/i);
    if (req.method === 'GET' && m) {
      const entry = REPORTS.get(m[1]);
      if (!entry) return send(res, 404, 'Rapport introuvable ou expiré.');
      if (m[2] === '.json') return sendJson(res, 200, entry.report);
      return send(res, 200, entry.html);
    }
    return send(res, 404, 'Not found');
  } catch (err) {
    return sendJson(res, 500, { error: 'Erreur serveur : ' + err.message });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log('Interface web d\'audit passif : http://localhost:' + PORT);
  });
}

module.exports = { server, saveReport, REPORTS };
