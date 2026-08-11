'use strict';

/**
 * Marque IXAUDIT + système de design (app-shell bleu électrique).
 *
 * Style : application SaaS sombre, sidebar à gauche, bleu électrique sur
 * fond navy, cartes en verre, bouclier 3D holographique. Zéro dépendance.
 *
 * Rebranding via env : BRAND_NAME, BRAND_TAGLINE, BRAND_ACCENT, BRAND_LOGO.
 */

const NAME = process.env.BRAND_NAME || 'IXAUDIT';
const SLOGAN = process.env.BRAND_SLOGAN || 'SÉCURISEZ. PROTÉGEZ. AVANCEZ.';
const TAGLINE =
  process.env.BRAND_TAGLINE ||
  'IXAUDIT analyse votre posture de sécurité et vous délivre un rapport clair, avec des recommandations concrètes.';
const ACCENT = process.env.BRAND_ACCENT || '#3b82f6';

const GRADE = { A: '#22c55e', B: '#4ade80', C: '#facc15', D: '#fb923c', F: '#f43f5e' };
const SEV = { high: '#f43f5e', medium: '#fb923c', low: '#facc15', info: '#38bdf8' };

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const DESIGN = `
  :root{
    --accent:${ACCENT};--accent-2:#2563eb;--cyan:#38bdf8;
    --bg:#080b14;--panel:#0c1220;--panel-2:#0e1526;--card:rgba(255,255,255,.028);
    --line:rgba(255,255,255,.08);--ink:#e9eefb;--muted:#8790a9;
    --radius:16px;--sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    --gA:${GRADE.A};--gB:${GRADE.B};--gC:${GRADE.C};--gD:${GRADE.D};--gF:${GRADE.F};
    --sHigh:${SEV.high};--sMed:${SEV.medium};--sLow:${SEV.low};--sInfo:${SEV.info};
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:var(--sans);color:var(--ink);background:var(--bg);line-height:1.55;-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  /* Coquille application */
  .app{display:grid;grid-template-columns:264px 1fr;min-height:100vh}
  .sidebar{background:linear-gradient(180deg,var(--panel),#0a0f1c);border-right:1px solid var(--line);
    padding:20px 16px;display:flex;flex-direction:column;gap:6px;position:sticky;top:0;height:100vh}
  .logo{display:flex;align-items:center;gap:11px;padding:6px 8px 18px}
  .logo .name{font-weight:800;font-size:19px;letter-spacing:.02em}
  .logo .name b{background:linear-gradient(120deg,#60a5fa,#38bdf8);-webkit-background-clip:text;background-clip:text;color:transparent}
  .nav-i{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:11px;color:var(--muted);
    font-weight:600;font-size:14.5px;cursor:pointer;transition:.15s}
  .nav-i .ic{width:20px;text-align:center;opacity:.9}
  .nav-i:hover{background:rgba(255,255,255,.04);color:var(--ink)}
  .nav-i.on{background:linear-gradient(90deg,rgba(59,130,246,.20),rgba(59,130,246,.06));color:#cfe0ff;
    box-shadow:inset 2px 0 0 var(--accent)}
  .side-card{margin-top:auto;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px}
  .badge{font-size:10.5px;font-weight:800;letter-spacing:.04em;padding:3px 8px;border-radius:999px;
    background:rgba(59,130,246,.16);color:#8fbaff}
  .acct{display:flex;align-items:center;gap:11px;padding:12px 8px 2px;border-top:1px solid var(--line);margin-top:12px}
  .avatar{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--accent),var(--cyan));
    display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#04102a}
  /* Zone principale */
  .main{min-width:0;display:flex;flex-direction:column}
  .topbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;
    padding:16px 26px;border-bottom:1px solid var(--line);background:rgba(8,11,20,.7);backdrop-filter:blur(12px)}
  .content{padding:24px 26px 40px;max-width:1120px;width:100%}
  .chip{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:#a9b6d6;
    padding:8px 14px;border-radius:999px;border:1px solid var(--line);background:var(--card)}
  /* Boutons */
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;border:0;cursor:pointer;
    font-weight:700;font-size:14.5px;padding:12px 20px;border-radius:12px;color:#fff;
    background:linear-gradient(135deg,var(--accent),var(--accent-2));box-shadow:0 12px 28px -12px var(--accent);transition:.16s}
  .btn:hover{transform:translateY(-1px);box-shadow:0 16px 34px -12px var(--accent)}
  .btn:disabled{opacity:.6;cursor:wait;transform:none}
  .btn.soft{background:var(--card);border:1px solid var(--line);color:var(--ink);box-shadow:none}
  .btn.soft:hover{background:rgba(255,255,255,.06)}
  /* Cartes / champs */
  .card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius)}
  input{width:100%;padding:13px 15px;border-radius:12px;border:1px solid var(--line);font-size:14.5px;
    background:rgba(255,255,255,.04);color:var(--ink);outline:none;transition:.16s}
  input::placeholder{color:#6f7893}
  input:focus{border-color:var(--accent);box-shadow:0 0 0 4px rgba(59,130,246,.18)}
  label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px}
  h1,h2,h3{margin:0;letter-spacing:-.02em}
  .muted{color:var(--muted)}
  .reveal{opacity:0;transform:translateY(18px);transition:.7s cubic-bezier(.2,.7,.2,1)}
  .reveal.in{opacity:1;transform:none}
  @keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
  .floaty{animation:floaty 6s ease-in-out infinite}
  @media(max-width:900px){.app{grid-template-columns:1fr}.sidebar{display:none}}
`;

// Logo IX (bouclier bleu)
function ixLogo(size) {
  const s = size || 30;
  return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="ixg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>
    <path d="M24 3 L41 10 V25 C41 35 33 42 24 45 C15 42 7 35 7 25 V10 Z" fill="url(#ixg)" opacity=".16"/>
    <path d="M24 3 L41 10 V25 C41 35 33 42 24 45 C15 42 7 35 7 25 V10 Z" stroke="url(#ixg)" stroke-width="2"/>
    <path d="M19 16 V32" stroke="url(#ixg)" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M24 16 L33 32 M33 16 L24 32" stroke="url(#ixg)" stroke-width="3.4" stroke-linecap="round"/>
  </svg>`;
}

// Grand bouclier 3D « holographique » (hero)
function shield3D() {
  return `<div class="floaty" style="position:relative;width:300px;height:300px">
    <div style="position:absolute;left:50%;bottom:16px;transform:translateX(-50%);width:220px;height:46px;
      background:radial-gradient(ellipse,rgba(56,189,248,.5),transparent 70%);filter:blur(8px)"></div>
    <svg width="300" height="300" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg"
      style="position:relative;filter:drop-shadow(0 20px 50px rgba(59,130,246,.55))">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#7cc4ff"/><stop offset="1" stop-color="#2563eb"/></linearGradient>
        <linearGradient id="sg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#bfe3ff"/><stop offset="1" stop-color="#38bdf8"/></linearGradient>
      </defs>
      <ellipse cx="100" cy="176" rx="66" ry="12" fill="#1e40af" opacity=".35"/>
      <path d="M100 26 L156 46 V96 C156 132 132 158 100 172 C68 158 44 132 44 96 V46 Z" fill="url(#sg)" opacity=".22"/>
      <path d="M100 26 L156 46 V96 C156 132 132 158 100 172 C68 158 44 132 44 96 V46 Z" stroke="url(#sg2)" stroke-width="2.4"/>
      <path d="M100 26 L100 172" stroke="url(#sg2)" stroke-width="1" opacity=".4"/>
      <path d="M78 96 L94 112 L126 74" stroke="#eaf6ff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="100" cy="99" r="82" stroke="url(#sg2)" stroke-width="1" opacity=".18"/>
    </svg>
  </div>`;
}

function head(title) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>${DESIGN}</style></head>`;
}

function sidebar(active) {
  const items = [
    ['🏠', 'Accueil', '/', 'home'],
    ['🔍', 'Audit', '/app', 'audit'],
    ['📄', 'Rapports', '/app', 'reports'],
    ['💡', 'Recommandations', '/app', 'reco'],
    ['🕘', 'Historique', '/app', 'history'],
    ['⚙️', 'Paramètres', '/app', 'settings'],
  ];
  return `<aside class="sidebar">
    <div class="logo">${ixLogo(30)}<span class="name">IX<b>AUDIT</b></span></div>
    ${items.map(function (i) {
      return `<a class="nav-i ${i[3] === active ? 'on' : ''}" href="${i[2]}"><span class="ic">${i[0]}</span>${i[1]}</a>`;
    }).join('')}
    <div class="side-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <strong style="font-size:14px">Plan Gratuit</strong><span class="badge">ILLIMITÉ</span></div>
      <div class="muted" style="font-size:12.5px;margin-bottom:12px">Audit illimité · accès basique</div>
      <a class="btn" style="width:100%;padding:10px" href="/app">Voir les offres</a>
    </div>
    <div class="acct"><div class="avatar">IX</div>
      <div><div style="font-size:13.5px;font-weight:700">Votre compte</div>
        <div class="muted" style="font-size:12px">Espace client</div></div></div>
  </aside>`;
}

function topbar() {
  return `<div class="topbar">
    <span class="chip">${ixLogo(16)} Audit gratuit et illimité</span>
    <a class="btn" href="/app" style="padding:10px 18px">Se connecter</a>
  </div>`;
}

function shell(active, main) {
  return `<body><div class="app">${sidebar(active)}
    <div class="main">${topbar()}<div class="content">${main}</div></div>
  </div>`;
}

function footer() {
  return `<div class="muted" style="display:flex;gap:26px;flex-wrap:wrap;font-size:13px;margin-top:26px;
    padding-top:20px;border-top:1px solid var(--line)">
    <span>💳 Aucune carte bancaire</span><span>✅ Conforme RGPD</span><span>🔒 Sécurisé & privé</span></div>`;
}

function fxScript() {
  return `<script>(function(){var r=[].slice.call(document.querySelectorAll('.reveal'));
    if('IntersectionObserver'in window){var o=new IntersectionObserver(function(es){es.forEach(function(e){
    if(e.isIntersecting){e.target.classList.add('in');o.unobserve(e.target);}});},{threshold:.12});
    r.forEach(function(e){o.observe(e);});}else{r.forEach(function(e){e.classList.add('in');});}})();</script>`;
}

// ------------------------------------------------------------------
// PAGE D'ACCUEIL
// ------------------------------------------------------------------
function landingPage() {
  const stats = [
    ['🛡️', 'Audit gratuit', 'Illimité', 'Sans carte bancaire'],
    ['⚡', 'Résultats instantanés', '< 2 min', 'Rapport détaillé'],
    ['🔒', 'Confidentialité', '100%', 'Données sécurisées'],
    ['👥', 'Anti-abus', 'Protégé', 'Système intelligent'],
  ];
  const steps = [
    ['1', 'Démarrez l\'audit', 'Indiquez votre cible et lancez l\'analyse.'],
    ['2', 'Analyse automatique', 'Nos modules analysent et évaluent les risques.'],
    ['3', 'Recevez le rapport', 'Des recommandations claires et actionnables.'],
  ];
  const main = `
    <section class="card reveal" style="position:relative;overflow:hidden;padding:38px 40px;
      background:radial-gradient(900px 400px at 85% -20%,rgba(37,99,235,.55),transparent 60%),
      radial-gradient(600px 400px at 10% 120%,rgba(56,189,248,.18),transparent 55%),var(--panel-2)">
      <div style="display:grid;grid-template-columns:1.1fr .9fr;gap:20px;align-items:center">
        <div>
          <span class="badge" style="letter-spacing:.06em">AUDIT GRATUIT & ILLIMITÉ</span>
          <h1 style="font-size:44px;line-height:1.08;margin:16px 0 14px">Analysez. Comprenez.
            <span style="background:linear-gradient(120deg,#60a5fa,#38bdf8);-webkit-background-clip:text;background-clip:text;color:transparent">Sécurisez.</span></h1>
          <p class="muted" style="font-size:16px;max-width:460px;margin:0 0 22px">${escapeHtml(TAGLINE)}</p>
          <form id="f" style="display:flex;gap:10px;flex-wrap:wrap;max-width:520px">
            <input id="url" type="url" placeholder="https://votre-site.com" required style="flex:1 1 240px">
            <button class="btn" id="btn" type="submit">Démarrer un audit gratuit →</button>
          </form>
          <div id="spin" class="muted" style="display:none;margin-top:12px">⏳ Analyse en cours…</div>
          <div id="err" style="display:none;margin-top:12px;color:#fda4af;font-size:14px"></div>
        </div>
        <div style="display:flex;justify-content:center" class="hide-sm">${shield3D()}</div>
      </div>

      <div id="res" class="card" style="display:none;margin-top:24px;padding:20px;background:rgba(0,0,0,.25)">
        <div style="display:flex;align-items:center;gap:18px">
          <div id="grade" style="width:84px;height:84px;border-radius:18px;display:flex;align-items:center;
            justify-content:center;font-size:46px;font-weight:800;color:#06111f;flex:0 0 auto"></div>
          <div><div id="score" style="font-size:24px;font-weight:800"></div><div id="meaning" class="muted"></div></div>
        </div>
        <div id="stats" style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"></div>
        <div id="actions" style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap"></div>
      </div>
    </section>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:14px;margin-top:16px">
      ${stats.map(function (s, i) {
        return `<div class="card reveal" style="padding:18px 18px;transition-delay:${i * 60}ms">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:34px;height:34px;border-radius:10px;background:rgba(59,130,246,.14);
              display:flex;align-items:center;justify-content:center;font-size:16px">${s[0]}</div>
            <span class="muted" style="font-size:12.5px">${s[1]}</span></div>
          <div style="font-size:22px;font-weight:800;margin:10px 0 2px">${s[2]}</div>
          <div class="muted" style="font-size:12.5px">${s[3]}</div></div>`;
      }).join('')}
    </div>

    <section class="card reveal" style="padding:30px 34px;margin-top:16px">
      <h2 style="font-size:24px;text-align:center">Comment ça marche&nbsp;?</h2>
      <p class="muted" style="text-align:center;margin:6px 0 26px;font-size:14px">3 étapes simples pour sécuriser votre environnement</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px">
        ${steps.map(function (s) {
          return `<div style="text-align:center">
            <div style="width:46px;height:46px;border-radius:50%;margin:0 auto 12px;font-weight:800;
              background:rgba(59,130,246,.14);border:1px solid rgba(59,130,246,.35);color:#8fbaff;
              display:flex;align-items:center;justify-content:center">${s[0]}</div>
            <div style="font-weight:700;margin-bottom:4px">${s[1]}</div>
            <div class="muted" style="font-size:13.5px">${s[2]}</div></div>`;
        }).join('')}
      </div>
    </section>
    ${footer()}`;
  return `${head('IXAUDIT — Analysez. Comprenez. Sécurisez.')}${shell('home', main)}
<script>
  var GRADE=${JSON.stringify(GRADE)}, SEV=${JSON.stringify(SEV)};
  var SEVLABEL={high:'Élevé',medium:'Moyen',low:'Faible',info:'Info'};
  document.getElementById('f').addEventListener('submit',function(e){
    e.preventDefault();
    var url=document.getElementById('url').value.trim(), btn=document.getElementById('btn');
    document.getElementById('err').style.display='none';document.getElementById('res').style.display='none';
    document.getElementById('spin').style.display='block';btn.disabled=true;
    fetch('/api/audit/free',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url})})
    .then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});})
    .then(function(o){
      document.getElementById('spin').style.display='none';btn.disabled=false;
      if(!o.ok){var e2=document.getElementById('err');e2.style.display='block';e2.textContent=o.j.error||'Erreur.';return;}
      var j=o.j,g=document.getElementById('grade');
      g.textContent=j.letter;g.style.background='linear-gradient(135deg,#fff,'+(GRADE[j.letter]||'#888')+')';
      document.getElementById('score').textContent=j.score+' / 100';
      document.getElementById('meaning').textContent=j.meaning;
      var s=j.findingsSummary||{};
      document.getElementById('stats').innerHTML=['high','medium','low','info'].map(function(k){
        return '<div style="background:'+SEV[k]+';color:#06111f;border-radius:10px;padding:7px 12px;text-align:center;min-width:62px;font-weight:700">'+
          '<div style="font-size:18px">'+(s[k]||0)+'</div><div style="font-size:10.5px;text-transform:uppercase">'+SEVLABEL[k]+'</div></div>';
      }).join('');
      document.getElementById('actions').innerHTML=
        '<a class="btn" href="'+j.reportUrl+'" target="_blank">Voir le rapport complet</a>'+
        '<a class="btn soft" href="/app">Débloquer l\\'illimité</a>';
      document.getElementById('res').style.display='block';
    })
    .catch(function(err){document.getElementById('spin').style.display='none';btn.disabled=false;
      var e2=document.getElementById('err');e2.style.display='block';e2.textContent='Erreur réseau : '+err.message;});
  });
</script>
${fxScript()}
</body></html>`;
}

// ------------------------------------------------------------------
// ESPACE CLIENT
// ------------------------------------------------------------------
function dashboardPage() {
  const cards = [
    ['1', 'Créer un compte', `<label>Votre email</label>
      <input id="email" type="email" placeholder="vous@entreprise.com">
      <button class="btn" style="margin-top:12px;width:100%" onclick="createAccount()">Créer mon compte</button>
      <div id="createOut" style="margin-top:10px;font-size:14px"></div>`],
    ['2', 'Votre clé d\'accès', `<label>Clé (sk_live_…)</label>
      <input id="key" type="text" placeholder="Collez votre clé ici">
      <button class="btn soft" style="margin-top:12px;width:100%" onclick="checkStatus()">Vérifier mon statut</button>`],
    ['3', 'Payer une fois — à vie', `<p class="muted" style="font-size:13.5px;margin:0 0 14px">Paiement unique et sécurisé. Aucun abonnement.</p>
      <button class="btn" style="width:100%" onclick="checkout()">Payer · accès à vie</button>
      <div id="payOut" class="muted" style="font-size:12px;margin-top:8px"></div>`],
    ['4', 'Auditer (illimité)', `<label>URL à auditer</label>
      <input id="auditUrl" type="url" placeholder="https://site-a-auditer.com">
      <button class="btn" style="margin-top:12px;width:100%" onclick="runAudit()">Lancer l'audit</button>
      <div id="auditResult" style="margin-top:10px;font-size:14px"></div>`],
  ];
  const main = `
    <div class="reveal" style="margin-bottom:18px">
      <h1 style="font-size:30px">Vos audits, en toute autonomie</h1>
      <p class="muted" style="margin:6px 0 0">Créez votre compte, réglez <strong style="color:var(--ink)">une seule fois</strong>, puis auditez <strong style="color:var(--ink)">sans limite, à vie</strong>.</p>
    </div>
    <div class="card reveal" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;margin-bottom:18px">
      <div><span class="muted" style="font-size:11.5px;letter-spacing:.05em;text-transform:uppercase">Statut de l'accès</span>
        <div id="statusText" style="font-weight:700;font-size:16px;margin-top:2px">Non connecté</div></div>
      <span id="statusPill" class="badge" style="background:rgba(255,255,255,.06);color:#9aa3ba">—</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px">
      ${cards.map(function (c, i) {
        return `<div class="card reveal" style="padding:22px;transition-delay:${i * 60}ms">
          <div style="display:flex;align-items:center;gap:11px;margin-bottom:14px">
            <div style="width:34px;height:34px;border-radius:10px;background:rgba(59,130,246,.14);
              border:1px solid rgba(59,130,246,.3);color:#8fbaff;font-weight:800;
              display:flex;align-items:center;justify-content:center">${c[0]}</div>
            <h3 style="font-size:16.5px">${c[1]}</h3></div>${c[2]}</div>`;
      }).join('')}
    </div>
    ${footer()}`;
  return `${head('Espace client · IXAUDIT')}${shell('audit', main)}
<script>
  var GC=${JSON.stringify(GRADE)};
  function key(){return document.getElementById('key').value.trim();}
  function setStatus(active,txt){document.getElementById('statusText').textContent=txt;
    var p=document.getElementById('statusPill');
    if(active){p.textContent='● ACTIF';p.style.background='rgba(34,197,94,.16)';p.style.color='#7ee6a4';}
    else{p.textContent='● INACTIF';p.style.background='rgba(244,63,94,.16)';p.style.color='#ff9db0';}}
  function createAccount(){var email=document.getElementById('email').value.trim();
    fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email})})
    .then(function(r){return r.json();}).then(function(j){
      if(j.error){document.getElementById('createOut').innerHTML='<span style="color:#ff9db0">'+j.error+'</span>';return;}
      document.getElementById('createOut').innerHTML='<div class="muted">Votre clé (à copier, affichée une seule fois) :</div>'+
        '<div style="font-family:monospace;font-size:12px;background:rgba(255,255,255,.05);border:1px solid var(--line);'+
        'border-radius:10px;padding:9px;word-break:break-all;margin-top:6px">'+j.apiKey+'</div>';
      document.getElementById('key').value=j.apiKey;});}
  function checkStatus(){fetch('/api/account/status',{headers:{'x-api-key':key()}}).then(function(r){return r.json();}).then(function(j){
      if(j.error){setStatus(false,j.error);return;}
      var d=j.active?(j.validUntil?('valable jusqu\\'au '+new Date(j.validUntil).toLocaleDateString()):'accès à vie'):'paiement requis';
      setStatus(j.active,(j.email||'')+' · '+(j.auditsCount||0)+' audit(s) · '+d);});}
  function checkout(){fetch('/api/checkout',{method:'POST',headers:{'x-api-key':key()}}).then(function(r){return r.json();}).then(function(j){
      if(j.checkoutUrl){window.location=j.checkoutUrl;}
      else{document.getElementById('payOut').innerHTML='<span style="color:#ff9db0">'+(j.error||'Paiement indisponible')+'</span>';}});}
  function runAudit(){var url=document.getElementById('auditUrl').value.trim();
    var out=document.getElementById('auditResult');out.textContent='⏳ Analyse en cours…';
    fetch('/api/audit',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key()},body:JSON.stringify({url:url})})
    .then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});}).then(function(o){
      if(!o.ok){out.innerHTML='<span style="color:#ff9db0">'+(o.j.error||'Erreur')+'</span>';return;}
      out.innerHTML='Note <strong style="color:'+(GC[o.j.letter]||'#ccc')+'">'+o.j.letter+'</strong> ('+o.j.score+'/100) — '+
        '<a style="color:var(--cyan);font-weight:600" href="'+o.j.reportUrl+'" target="_blank">rapport ↗</a> · '+o.j.auditsCount+' audits';});}
</script>
${fxScript()}
</body></html>`;
}

module.exports = { NAME, SLOGAN, TAGLINE, ACCENT, GRADE, SEV, landingPage, dashboardPage, escapeHtml };
