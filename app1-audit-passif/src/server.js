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
const { audit } = require('./index');
const reportGen = require('./report/generator');
const ssrf = require('./lib/ssrf-guard');
const accounts = require('./auth/accounts');
const stripe = require('./billing/stripe');
const external = require('./billing/external');

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

// --- Page d'accueil (formulaire) ---
const INDEX_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Audit de sécurité web — analyse gratuite</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
         margin: 0; background: #0f172a; color: #e2e8f0; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 48px 20px; }
  h1 { font-size: 30px; margin: 0 0 8px; }
  .sub { color: #94a3b8; margin-bottom: 28px; }
  form { display: flex; gap: 10px; flex-wrap: wrap; }
  input[type=url] { flex: 1 1 320px; padding: 14px 16px; border-radius: 10px; border: 1px solid #334155;
                    background: #1e293b; color: #e2e8f0; font-size: 16px; }
  button { padding: 14px 22px; border: 0; border-radius: 10px; background: #2563eb; color: #fff;
           font-size: 16px; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: .6; cursor: wait; }
  .result { margin-top: 32px; display: none; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 24px;
          display: flex; align-items: center; gap: 24px; }
  .grade { font-size: 64px; font-weight: 800; width: 100px; height: 100px; border-radius: 14px;
           display: flex; align-items: center; justify-content: center; color: #fff; flex: 0 0 auto; }
  .meta .score { font-size: 26px; font-weight: 700; }
  .meta .meaning { color: #94a3b8; }
  .stats { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
  .stat { border-radius: 10px; padding: 10px 14px; color: #fff; text-align: center; min-width: 78px; }
  .actions { margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap; }
  .actions a { text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 600;
               background: #334155; color: #e2e8f0; }
  .actions a.primary { background: #16a34a; color: #fff; }
  .err { color: #f87171; margin-top: 16px; }
  .foot { margin-top: 40px; color: #64748b; font-size: 13px; }
  .spinner { display:none; margin-top:24px; color:#94a3b8; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Audit de sécurité web</h1>
  <div class="sub">Analyse passive et non intrusive de votre site — note A à F, en clair, en 30 secondes.</div>
  <form id="f">
    <input id="url" type="url" placeholder="https://votre-site.com" required autofocus>
    <button id="btn" type="submit">Analyser</button>
  </form>
  <div class="spinner" id="spin">Analyse en cours…</div>
  <div class="err" id="err"></div>

  <div class="result" id="res">
    <div class="card">
      <div class="grade" id="grade"></div>
      <div class="meta">
        <div class="score" id="score"></div>
        <div class="meaning" id="meaning"></div>
      </div>
    </div>
    <div class="stats" id="stats"></div>
    <div class="actions" id="actions"></div>
  </div>

  <div class="foot">Audit passif — aucune requête intrusive n'est effectuée. Résultat indicatif.</div>
</div>
<script>
  var COLORS = { A:'#16a34a', B:'#22c55e', C:'#f59e0b', D:'#ea580c', F:'#dc2626' };
  var SEV = { high:'#dc2626', medium:'#ea580c', low:'#f59e0b', info:'#3b82f6' };
  var f = document.getElementById('f');
  f.addEventListener('submit', function(e){
    e.preventDefault();
    var url = document.getElementById('url').value.trim();
    var btn = document.getElementById('btn');
    document.getElementById('err').textContent = '';
    document.getElementById('res').style.display = 'none';
    document.getElementById('spin').style.display = 'block';
    btn.disabled = true;
    fetch('/api/audit', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ url: url }) })
    .then(function(r){ return r.json().then(function(j){ return { ok:r.ok, j:j }; }); })
    .then(function(o){
      document.getElementById('spin').style.display = 'none';
      btn.disabled = false;
      if(!o.ok){ document.getElementById('err').textContent = o.j.error || 'Erreur.'; return; }
      var j = o.j;
      document.getElementById('grade').textContent = j.letter;
      document.getElementById('grade').style.background = COLORS[j.letter] || '#64748b';
      document.getElementById('score').textContent = j.score + '/100';
      document.getElementById('meaning').textContent = j.meaning;
      var s = j.findingsSummary || {};
      document.getElementById('stats').innerHTML =
        ['high','medium','low','info'].map(function(k){
          return '<div class="stat" style="background:'+SEV[k]+'"><div style="font-size:20px;font-weight:700">'+(s[k]||0)+'</div><div style="font-size:11px;text-transform:uppercase">'+k+'</div></div>';
        }).join('');
      document.getElementById('actions').innerHTML =
        '<a class="primary" href="'+j.reportUrl+'" target="_blank">Voir le rapport complet</a>' +
        '<a href="'+j.reportUrl+'" target="_blank">Lien partageable</a>';
      document.getElementById('res').style.display = 'block';
    })
    .catch(function(err){
      document.getElementById('spin').style.display = 'none';
      btn.disabled = false;
      document.getElementById('err').textContent = 'Erreur réseau : ' + err.message;
    });
  });
</script>
</body>
</html>`;

// --- Espace client (self-service : compte + paiement + audits illimités) ---
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Espace client — audits illimités</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
         margin: 0; background: #0f172a; color: #e2e8f0; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 40px 20px; }
  h1 { font-size: 26px; margin: 0 0 6px; }
  .sub { color: #94a3b8; margin-bottom: 24px; }
  .box { background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 22px; margin-bottom: 18px; }
  .box h2 { margin: 0 0 12px; font-size: 17px; }
  input { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid #334155;
          background: #0f172a; color: #e2e8f0; font-size: 15px; margin-bottom: 10px; }
  button { padding: 12px 18px; border: 0; border-radius: 10px; color: #fff; font-size: 15px;
           font-weight: 600; cursor: pointer; }
  .b-blue { background:#2563eb; } .b-green { background:#16a34a; } .b-slate{ background:#334155; }
  .status { font-size: 14px; margin-top: 8px; }
  .active { color:#22c55e; } .inactive { color:#f87171; }
  .key { font-family: monospace; background:#0f172a; padding:10px; border-radius:8px; word-break:break-all;
         border:1px solid #334155; margin:8px 0; font-size:13px; }
  .muted { color:#64748b; font-size:12px; }
  #auditResult { margin-top:12px; font-size:14px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Espace client</h1>
  <div class="sub">Créez votre compte, payez <strong>une seule fois</strong>, puis lancez <strong>autant d'audits que vous voulez, à vie</strong>.</div>

  <div class="box">
    <h2>1. Créer un compte</h2>
    <input id="email" type="email" placeholder="votre@email.com">
    <button class="b-blue" onclick="createAccount()">Créer mon compte</button>
    <div id="createOut"></div>
  </div>

  <div class="box">
    <h2>2. Votre clé d'accès</h2>
    <input id="key" type="text" placeholder="Collez votre clé (sk_live_...)">
    <button class="b-slate" onclick="checkStatus()">Vérifier mon statut</button>
    <div class="status" id="statusOut"></div>
  </div>

  <div class="box">
    <h2>3. Payer une fois — accès à vie</h2>
    <button class="b-green" onclick="checkout()">Payer (accès à vie)</button>
    <div class="muted" id="payOut">Paiement unique, sécurisé, hébergé par Stripe. Aucun abonnement.</div>
  </div>

  <div class="box">
    <h2>4. Lancer un audit (illimité)</h2>
    <input id="auditUrl" type="url" placeholder="https://site-a-auditer.com">
    <button class="b-blue" onclick="runAudit()">Auditer</button>
    <div id="auditResult"></div>
  </div>
</div>
<script>
  function key(){ return document.getElementById('key').value.trim(); }
  function createAccount(){
    var email = document.getElementById('email').value.trim();
    fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email})})
    .then(function(r){return r.json();}).then(function(j){
      if(j.error){ document.getElementById('createOut').innerHTML='<div class="inactive status">'+j.error+'</div>'; return; }
      document.getElementById('createOut').innerHTML='<div class="status">Voici votre clé (copiez-la, montrée une seule fois) :</div><div class="key">'+j.apiKey+'</div>';
      document.getElementById('key').value=j.apiKey;
    });
  }
  function checkStatus(){
    fetch('/api/account/status',{headers:{'x-api-key':key()}}).then(function(r){return r.json();}).then(function(j){
      if(j.error){ document.getElementById('statusOut').innerHTML='<span class="inactive">'+j.error+'</span>'; return; }
      var cls = j.active ? 'active' : 'inactive';
      var txt = j.active ? 'ACTIF' : 'INACTIF';
      var duree = j.active ? (j.validUntil ? ' — valable jusqu\\'au '+new Date(j.validUntil).toLocaleDateString() : ' — accès à vie') : '';
      document.getElementById('statusOut').innerHTML='<span class="'+cls+'">Accès : '+txt+'</span> — '+(j.auditsCount||0)+' audit(s) réalisés'+duree;
    });
  }
  function checkout(){
    fetch('/api/checkout',{method:'POST',headers:{'x-api-key':key()}}).then(function(r){return r.json();}).then(function(j){
      if(j.checkoutUrl){ window.location = j.checkoutUrl; }
      else { document.getElementById('payOut').innerHTML='<span class="inactive">'+(j.error||'Paiement indisponible')+'</span>'; }
    });
  }
  function runAudit(){
    var url = document.getElementById('auditUrl').value.trim();
    document.getElementById('auditResult').textContent='Analyse en cours...';
    fetch('/api/audit',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key()},body:JSON.stringify({url:url})})
    .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});}).then(function(o){
      if(!o.ok){ document.getElementById('auditResult').innerHTML='<span class="inactive">'+(o.j.error||'Erreur')+'</span>'; return; }
      document.getElementById('auditResult').innerHTML='Note <strong>'+o.j.letter+'</strong> ('+o.j.score+'/100) — <a href="'+o.j.reportUrl+'" target="_blank" style="color:#60a5fa">rapport</a> — total : '+o.j.auditsCount+' audits';
    });
  }
</script>
</body>
</html>`;

/**
 * Extrait la clé d'API : en-tête `x-api-key` ou `Authorization: Bearer ...`.
 */
function getApiKey(req) {
  if (req.headers['x-api-key']) return String(req.headers['x-api-key']).trim();
  const auth = req.headers['authorization'] || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

async function handleAudit(req, res) {
  // --- Contrôle d'abonnement : accès illimité tant que le compte est actif ---
  const key = getApiKey(req);
  const account = key ? accounts.findByKey(key) : null;
  if (!account) {
    return sendJson(res, 401, { error: 'Clé d\'API manquante ou invalide.' });
  }
  if (!accounts.isActive(account)) {
    return sendJson(res, 402, {
      error: 'Abonnement inactif ou expiré. Aucun audit tant que le paiement n\'est pas actif.',
      subscribeUrl: '/app',
    });
  }

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (err) {
    return sendJson(res, 400, { error: 'Requête JSON invalide.' });
  }
  const url = body && body.url ? String(body.url).trim() : '';
  if (!url) return sendJson(res, 400, { error: 'URL manquante.' });

  const normalized = /^https?:\/\//i.test(url) ? url : 'https://' + url;

  // Garde anti-SSRF.
  const guard = await ssrf.assertPublicTarget(normalized);
  if (!guard.ok) {
    return sendJson(res, 400, { error: 'Cible refusée : ' + guard.reason });
  }

  let report;
  try {
    report = await audit(normalized);
  } catch (err) {
    return sendJson(res, 500, { error: 'Audit impossible : ' + err.message });
  }

  const id = saveReport(report);
  const auditsCount = accounts.recordAudit(account);
  return sendJson(res, 200, {
    id,
    target: report.target,
    score: report.scoring.score,
    letter: report.scoring.letter,
    meaning: report.scoring.meaning,
    findingsSummary: report.scoring.findingsSummary,
    reportUrl: '/r/' + id,
    auditsCount,
  });
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
    if (req.method === 'GET' && pathname === '/') {
      return send(res, 200, INDEX_HTML);
    }
    if (req.method === 'GET' && pathname === '/app') {
      return send(res, 200, DASHBOARD_HTML);
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
