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

async function handleAudit(req, res) {
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
  return sendJson(res, 200, {
    id,
    target: report.target,
    score: report.scoring.score,
    letter: report.scoring.letter,
    meaning: report.scoring.meaning,
    findingsSummary: report.scoring.findingsSummary,
    reportUrl: '/r/' + id,
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/') {
      return send(res, 200, INDEX_HTML);
    }
    if (req.method === 'POST' && pathname === '/api/audit') {
      return await handleAudit(req, res);
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
