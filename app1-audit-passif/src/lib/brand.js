'use strict';

/**
 * Marque + système de design partagé (pages web).
 *
 * Centralise le nom, le slogan, les couleurs et le CSS commun pour que le
 * rebranding se fasse en un seul endroit (ou via variables d'environnement).
 * Rend les pages HTML complètes (accueil + espace client).
 *
 * Personnalisation rapide :
 *   BRAND_NAME, BRAND_TAGLINE, BRAND_ACCENT (couleur hex), BRAND_LOGO (emoji)
 */

const NAME = process.env.BRAND_NAME || 'Sentinel';
const TAGLINE =
  process.env.BRAND_TAGLINE || 'La sécurité de votre site web, notée en 30 secondes.';
const LOGO = process.env.BRAND_LOGO || '🛡️';
const ACCENT = process.env.BRAND_ACCENT || '#6366f1';

// Couleurs des notes (partagées avec le rapport).
const GRADE = { A: '#16a34a', B: '#22c55e', C: '#f59e0b', D: '#f97316', F: '#dc2626' };
const SEV = { high: '#dc2626', medium: '#f97316', low: '#f59e0b', info: '#3b82f6' };

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// --- Système de design commun (CSS) ---
const DESIGN = `
  :root{
    --accent:${ACCENT}; --accent-2:#8b5cf6; --ink:#0f172a; --muted:#64748b;
    --bg:#ffffff; --soft:#f1f5f9; --card:#ffffff; --border:#e6e8ee;
    --radius:16px; --shadow:0 10px 30px -12px rgba(15,23,42,.18);
    --gA:${GRADE.A};--gB:${GRADE.B};--gC:${GRADE.C};--gD:${GRADE.D};--gF:${GRADE.F};
    --sHigh:${SEV.high};--sMed:${SEV.medium};--sLow:${SEV.low};--sInfo:${SEV.info};
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
       color:var(--ink);background:var(--bg);line-height:1.5;-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  .container{max-width:1080px;margin:0 auto;padding:0 22px}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;cursor:pointer;
       font-weight:700;font-size:15px;padding:13px 22px;border-radius:12px;transition:.15s transform,.15s box-shadow;
       background:var(--accent);color:#fff;box-shadow:0 8px 20px -8px var(--accent)}
  .btn:hover{transform:translateY(-1px)}
  .btn:disabled{opacity:.6;cursor:wait;transform:none}
  .btn.ghost{background:transparent;color:var(--ink);box-shadow:none;border:1px solid var(--border)}
  .btn.dark{background:#0f172a;box-shadow:none}
  .btn.green{background:#16a34a;box-shadow:0 8px 20px -8px #16a34a}
  .pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:5px 11px;border-radius:999px}
  /* Barre de navigation */
  .nav{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.85);backdrop-filter:blur(10px);
       border-bottom:1px solid var(--border)}
  .nav .inner{display:flex;align-items:center;justify-content:space-between;height:64px}
  .brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:19px;letter-spacing:-.02em}
  .brand .logo{font-size:22px}
  .nav a.link{color:var(--muted);font-weight:600;font-size:14px;margin-left:18px}
  .nav a.link:hover{color:var(--ink)}
  /* Cartes */
  .card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:22px}
  .grid{display:grid;gap:16px}
  /* Champs */
  input{width:100%;padding:14px 16px;border-radius:12px;border:1px solid var(--border);
        font-size:15px;background:#fff;color:var(--ink);outline:none;transition:.15s border,.15s box-shadow}
  input:focus{border-color:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 18%,transparent)}
  label{display:block;font-size:13px;font-weight:600;color:var(--muted);margin-bottom:6px}
  .muted{color:var(--muted)}
  footer.foot{border-top:1px solid var(--border);margin-top:60px;padding:28px 0;color:var(--muted);font-size:13px}
`;

function head(title) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>${DESIGN}</style></head>`;
}

function nav(active) {
  return `<nav class="nav"><div class="container inner">
    <a class="brand" href="/"><span class="logo">${LOGO}</span>${escapeHtml(NAME)}</a>
    <div>
      <a class="link" href="/"${active === 'home' ? ' style="color:var(--ink)"' : ''}>Analyse gratuite</a>
      <a class="link" href="/app"${active === 'app' ? ' style="color:var(--ink)"' : ''}>Espace client</a>
    </div>
  </div></nav>`;
}

function footer() {
  return `<footer class="foot"><div class="container">
    ${LOGO} <strong>${escapeHtml(NAME)}</strong> — audit passif non intrusif. Résultat indicatif, aucune requête agressive.
  </div></footer>`;
}

// ------------------------------------------------------------------
// PAGE D'ACCUEIL (landing / accroche démarchage)
// ------------------------------------------------------------------
function landingPage() {
  const modules = [
    ['🔒', 'SSL / TLS', 'Certificat, protocole, chiffrement'],
    ['🧱', 'En-têtes HTTP', 'HSTS, CSP, protection anti-clickjacking'],
    ['📁', 'Fichiers exposés', '.git, .env, sauvegardes accessibles'],
    ['🦠', 'Réputation', 'Blacklists & moteurs anti-malware'],
    ['🧩', 'Technologies & CVE', 'Failles connues de votre stack'],
    ['⚖️', 'Conformité RGPD', 'Cookies, traceurs, mentions légales'],
  ];
  const steps = [
    ['1', 'Vous entrez votre URL', 'Aucune installation, aucune requête intrusive.'],
    ['2', 'On analyse en passif', '6 familles de contrôles, en 30 secondes.'],
    ['3', 'Vous recevez une note', 'Un rapport clair, en français, partageable.'],
  ];
  return `${head(TAGLINE + ' — ' + NAME)}<body>
${nav('home')}

<section style="background:linear-gradient(160deg,#0b1120 0%,#141d3b 55%,#241b52 100%);color:#e8ecf6;padding:64px 0 72px">
  <div class="container">
    <div class="pill" style="background:rgba(255,255,255,.10);color:#c7d2fe;margin-bottom:18px">
      ${LOGO} Audit de sécurité web · passif & non intrusif
    </div>
    <h1 style="font-size:44px;line-height:1.1;letter-spacing:-.03em;margin:0 0 14px;max-width:760px">
      ${escapeHtml(TAGLINE)}
    </h1>
    <p style="font-size:18px;color:#aeb8d4;max-width:620px;margin:0 0 28px">
      Découvrez en un clin d'œil les failles visibles de votre site : SSL, en-têtes,
      fichiers exposés, réputation, technologies vulnérables et conformité RGPD.
    </p>
    <div class="card" style="background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.12);max-width:640px">
      <form id="f" style="display:flex;gap:10px;flex-wrap:wrap">
        <input id="url" type="url" placeholder="https://votre-site.com" required
               style="flex:1 1 300px;background:rgba(255,255,255,.95)">
        <button class="btn" id="btn" type="submit">Analyser gratuitement</button>
      </form>
      <div id="spin" class="muted" style="display:none;margin-top:14px;color:#aeb8d4">⏳ Analyse en cours…</div>
      <div id="err" style="display:none;margin-top:12px;color:#fca5a5;font-size:14px"></div>
    </div>
    <div style="margin-top:14px;color:#8ea0c8;font-size:13px">✔ Gratuit · ✔ Sans inscription · ✔ Sans impact sur votre site</div>

    <div id="res" class="card" style="display:none;color:var(--ink);max-width:640px;margin-top:22px">
      <div style="display:flex;align-items:center;gap:20px">
        <div id="grade" style="width:96px;height:96px;border-radius:16px;display:flex;align-items:center;
             justify-content:center;font-size:56px;font-weight:800;color:#fff;flex:0 0 auto"></div>
        <div>
          <div id="score" style="font-size:26px;font-weight:800"></div>
          <div id="meaning" class="muted"></div>
        </div>
      </div>
      <div id="stats" style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap"></div>
      <div id="actions" style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap"></div>
    </div>
  </div>
</section>

<section style="padding:56px 0">
  <div class="container">
    <h2 style="font-size:28px;letter-spacing:-.02em;text-align:center;margin:0 0 8px">Ce que l'on analyse</h2>
    <p class="muted" style="text-align:center;margin:0 0 32px">6 familles de contrôles, sans jamais toucher à votre serveur de façon intrusive.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
      ${modules.map(function (m) {
        return `<div class="card"><div style="font-size:26px">${m[0]}</div>
          <div style="font-weight:700;margin:8px 0 4px">${m[1]}</div>
          <div class="muted" style="font-size:14px">${m[2]}</div></div>`;
      }).join('')}
    </div>
  </div>
</section>

<section style="padding:20px 0 60px;background:var(--soft)">
  <div class="container">
    <h2 style="font-size:28px;letter-spacing:-.02em;text-align:center;margin:44px 0 32px">Comment ça marche</h2>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
      ${steps.map(function (s) {
        return `<div class="card" style="text-align:center">
          <div style="width:44px;height:44px;border-radius:50%;background:var(--accent);color:#fff;
               font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 12px">${s[0]}</div>
          <div style="font-weight:700;margin-bottom:4px">${s[1]}</div>
          <div class="muted" style="font-size:14px">${s[2]}</div></div>`;
      }).join('')}
    </div>
    <div style="text-align:center;margin-top:36px">
      <a class="btn green" href="/app">Accès illimité — paiement unique →</a>
      <div class="muted" style="font-size:13px;margin-top:10px">Auditez tous vos sites, autant de fois que vous voulez, à vie.</div>
    </div>
  </div>
</section>

${footer()}
<script>
  var GRADE=${JSON.stringify(GRADE)}, SEV=${JSON.stringify(SEV)};
  var SEVLABEL={high:'Élevé',medium:'Moyen',low:'Faible',info:'Info'};
  document.getElementById('f').addEventListener('submit',function(e){
    e.preventDefault();
    var url=document.getElementById('url').value.trim(), btn=document.getElementById('btn');
    document.getElementById('err').style.display='none';
    document.getElementById('res').style.display='none';
    document.getElementById('spin').style.display='block'; btn.disabled=true;
    fetch('/api/audit/free',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url})})
    .then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});})
    .then(function(o){
      document.getElementById('spin').style.display='none'; btn.disabled=false;
      if(!o.ok){var e2=document.getElementById('err');e2.style.display='block';e2.textContent=o.j.error||'Erreur.';return;}
      var j=o.j;
      var g=document.getElementById('grade'); g.textContent=j.letter; g.style.background=GRADE[j.letter]||'#64748b';
      document.getElementById('score').textContent=j.score+'/100';
      document.getElementById('meaning').textContent=j.meaning;
      var s=j.findingsSummary||{};
      document.getElementById('stats').innerHTML=['high','medium','low','info'].map(function(k){
        return '<div style="background:'+SEV[k]+';color:#fff;border-radius:10px;padding:8px 12px;text-align:center;min-width:70px">'+
          '<div style="font-size:19px;font-weight:800">'+(s[k]||0)+'</div><div style="font-size:11px;text-transform:uppercase">'+SEVLABEL[k]+'</div></div>';
      }).join('');
      document.getElementById('actions').innerHTML=
        '<a class="btn" href="'+j.reportUrl+'" target="_blank">Voir le rapport complet</a>'+
        '<a class="btn ghost" href="/app">Débloquer l\\'illimité</a>';
      document.getElementById('res').style.display='block';
      document.getElementById('res').scrollIntoView({behavior:'smooth',block:'nearest'});
    })
    .catch(function(err){document.getElementById('spin').style.display='none';btn.disabled=false;
      var e2=document.getElementById('err');e2.style.display='block';e2.textContent='Erreur réseau : '+err.message;});
  });
</script>
</body></html>`;
}

// ------------------------------------------------------------------
// ESPACE CLIENT (self-service : compte + paiement + audits illimités)
// ------------------------------------------------------------------
function dashboardPage() {
  return `${head('Espace client — ' + NAME)}<body>
${nav('app')}

<section style="padding:40px 0 20px">
  <div class="container" style="max-width:820px">
    <h1 style="font-size:30px;letter-spacing:-.02em;margin:0 0 6px">Espace client</h1>
    <p class="muted" style="margin:0 0 8px">Créez votre compte, payez <strong>une seule fois</strong>, puis lancez
      <strong>autant d'audits que vous voulez, à vie</strong>.</p>

    <div id="statusBar" class="card" style="display:flex;align-items:center;justify-content:space-between;
         gap:12px;margin:18px 0;background:var(--soft)">
      <div><span class="muted" style="font-size:13px">Statut de l'accès</span>
        <div id="statusText" style="font-weight:700">Non connecté</div></div>
      <span id="statusPill" class="pill" style="background:#e2e8f0;color:#475569">—</span>
    </div>

    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">

      <div class="card">
        <div class="pill" style="background:color-mix(in srgb,var(--accent) 14%,#fff);color:var(--accent);margin-bottom:12px">Étape 1</div>
        <h3 style="margin:0 0 12px;font-size:17px">Créer un compte</h3>
        <label>Votre email</label>
        <input id="email" type="email" placeholder="vous@entreprise.com">
        <button class="btn" style="margin-top:12px;width:100%" onclick="createAccount()">Créer mon compte</button>
        <div id="createOut" style="margin-top:10px;font-size:14px"></div>
      </div>

      <div class="card">
        <div class="pill" style="background:color-mix(in srgb,var(--accent) 14%,#fff);color:var(--accent);margin-bottom:12px">Étape 2</div>
        <h3 style="margin:0 0 12px;font-size:17px">Votre clé d'accès</h3>
        <label>Clé (sk_live_…)</label>
        <input id="key" type="text" placeholder="Collez votre clé ici">
        <button class="btn ghost" style="margin-top:12px;width:100%" onclick="checkStatus()">Vérifier mon statut</button>
      </div>

      <div class="card">
        <div class="pill" style="background:#dcfce7;color:#15803d;margin-bottom:12px">Étape 3</div>
        <h3 style="margin:0 0 12px;font-size:17px">Payer une fois — accès à vie</h3>
        <p class="muted" style="font-size:14px;margin:0 0 14px">Paiement unique et sécurisé. Aucun abonnement, aucune reconduction.</p>
        <button class="btn green" style="width:100%" onclick="checkout()">Payer (accès à vie)</button>
        <div id="payOut" class="muted" style="font-size:12px;margin-top:8px"></div>
      </div>

      <div class="card">
        <div class="pill" style="background:#dbeafe;color:#1d4ed8;margin-bottom:12px">Étape 4</div>
        <h3 style="margin:0 0 12px;font-size:17px">Lancer un audit (illimité)</h3>
        <label>URL à auditer</label>
        <input id="auditUrl" type="url" placeholder="https://site-a-auditer.com">
        <button class="btn" style="margin-top:12px;width:100%" onclick="runAudit()">Auditer</button>
        <div id="auditResult" style="margin-top:10px;font-size:14px"></div>
      </div>

    </div>
  </div>
</section>

${footer()}
<script>
  function key(){return document.getElementById('key').value.trim();}
  function setStatus(active,txt){
    document.getElementById('statusText').textContent=txt;
    var p=document.getElementById('statusPill');
    if(active){p.textContent='● ACTIF';p.style.background='#dcfce7';p.style.color='#15803d';}
    else{p.textContent='● INACTIF';p.style.background='#fee2e2';p.style.color='#b91c1c';}
  }
  function createAccount(){
    var email=document.getElementById('email').value.trim();
    fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email})})
    .then(function(r){return r.json();}).then(function(j){
      if(j.error){document.getElementById('createOut').innerHTML='<span style="color:#b91c1c">'+j.error+'</span>';return;}
      document.getElementById('createOut').innerHTML='<div class="muted">Votre clé (copiez-la, affichée une seule fois) :</div>'+
        '<div style="font-family:monospace;font-size:12px;background:var(--soft);border:1px solid var(--border);'+
        'border-radius:8px;padding:9px;word-break:break-all;margin-top:6px">'+j.apiKey+'</div>';
      document.getElementById('key').value=j.apiKey;
    });
  }
  function checkStatus(){
    fetch('/api/account/status',{headers:{'x-api-key':key()}}).then(function(r){return r.json();}).then(function(j){
      if(j.error){setStatus(false,j.error);return;}
      var d=j.active?(j.validUntil?('valable jusqu\\'au '+new Date(j.validUntil).toLocaleDateString()):'accès à vie'):'paiement requis';
      setStatus(j.active,(j.email||'')+' — '+(j.auditsCount||0)+' audit(s) · '+d);
    });
  }
  function checkout(){
    fetch('/api/checkout',{method:'POST',headers:{'x-api-key':key()}}).then(function(r){return r.json();}).then(function(j){
      if(j.checkoutUrl){window.location=j.checkoutUrl;}
      else{document.getElementById('payOut').innerHTML='<span style="color:#b91c1c">'+(j.error||'Paiement indisponible')+'</span>';}
    });
  }
  function runAudit(){
    var url=document.getElementById('auditUrl').value.trim();
    var out=document.getElementById('auditResult'); out.textContent='⏳ Analyse en cours…';
    fetch('/api/audit',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key()},body:JSON.stringify({url:url})})
    .then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});}).then(function(o){
      if(!o.ok){out.innerHTML='<span style="color:#b91c1c">'+(o.j.error||'Erreur')+'</span>';return;}
      out.innerHTML='Note <strong style="color:'+( {A:'#16a34a',B:'#22c55e',C:'#f59e0b',D:'#f97316',F:'#dc2626'}[o.j.letter]||'#334155')+'">'+
        o.j.letter+'</strong> ('+o.j.score+'/100) — <a style="color:var(--accent);font-weight:600" href="'+o.j.reportUrl+'" target="_blank">rapport ↗</a> · total : '+o.j.auditsCount+' audits';
    });
  }
</script>
</body></html>`;
}

module.exports = {
  NAME, TAGLINE, LOGO, ACCENT, GRADE, SEV,
  landingPage, dashboardPage, escapeHtml,
};
