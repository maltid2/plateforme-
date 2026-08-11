'use strict';

/**
 * Marque IXAUDIT + design « Dieter Rams » (Weniger, aber besser).
 *
 * Principes appliqués : fonction avant décoration, sobriété, grille stricte,
 * typographie Helvetica disciplinée, palette neutre chaude + un seul accent
 * (orange Braun), lignes fines, aucun effet superflu (ni dégradé, ni ombre
 * marquée, ni 3D, ni animation ostentatoire). Le contenu reste clair et
 * honnête. Zéro dépendance.
 *
 * Rebranding via env : BRAND_NAME, BRAND_HEADLINE, BRAND_ACCENT, BRAND_USER.
 */

const NAME = process.env.BRAND_NAME || 'IXAUDIT';
const HEADLINE = process.env.BRAND_HEADLINE || 'Votre site est-il vraiment sécurisé ?';
const TAGLINE =
  process.env.BRAND_TAGLINE ||
  'Découvrez en quelques minutes ce qui pourrait mettre votre entreprise ou vos données en danger.';
const ACCENT = process.env.BRAND_ACCENT || '#8b6cff'; // violet
const USER = process.env.BRAND_USER || 'Aymerick';

const GRADE = { A: '#22c55e', B: '#4ade80', C: '#facc15', D: '#fb923c', F: '#f43f5e' };
const SEV = { high: '#f43f5e', medium: '#fb923c', low: '#facc15', info: '#5aa9ff' };

const CATS = [
  { id: 'A1', icon: '🔒', label: 'Connexion sécurisée', tech: 'Certificat SSL/TLS',
    ok: 'Votre site utilise une connexion chiffrée. Vos visiteurs naviguent en sécurité.',
    warn: 'La connexion de votre site pourrait être mieux sécurisée.' },
  { id: 'A2', icon: '🌐', label: 'Protection du site', tech: 'En-têtes HTTP de sécurité',
    ok: 'Votre site est protégé contre plusieurs attaques courantes.',
    warn: 'Des protections manquent : votre site est plus exposé à certaines attaques.' },
  { id: 'A3', icon: '📁', label: 'Fichiers privés', tech: 'Fichiers sensibles exposés',
    ok: 'Aucun fichier sensible n\'est accessible publiquement.',
    warn: 'Des fichiers qui devraient rester privés pourraient être accessibles.' },
  { id: 'B', icon: '🛡️', label: 'Réputation en ligne', tech: 'Réputation / listes noires',
    ok: 'Votre site n\'est pas signalé comme dangereux.',
    warn: 'Votre site pourrait être signalé : cela nuit à votre image et à votre référencement.' },
  { id: 'C', icon: '⚠️', label: 'Failles connues', tech: 'Vulnérabilités (CVE)',
    ok: 'Aucune faille connue détectée sur vos technologies.',
    warn: 'Des failles connues ont été détectées : elles peuvent être exploitées.' },
  { id: 'D', icon: '🔐', label: 'Protection des données', tech: 'Conformité RGPD / cookies',
    ok: 'Vos visiteurs sont informés et leurs données sont mieux protégées.',
    warn: 'La protection des données de vos visiteurs peut être améliorée (RGPD).' },
];

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const DESIGN = `
  :root{
    --accent:${ACCENT};--accent-2:#6d4bff;--bg:#000000;--surface:#0c0c16;--surface-2:#111120;
    --ink:#eef0f8;--muted:#8b8ea3;--line:rgba(255,255,255,.09);--line-2:rgba(255,255,255,.17);
    --ok:#22c55e;--warn:#fb923c;--bad:#f43f5e;
    --sans:var(--font,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif);
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:var(--sans);color:var(--ink);background:var(--bg);line-height:1.5;
    -webkit-font-smoothing:antialiased;font-size:15px}
  body::before{content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;
    background:radial-gradient(720px 480px at 84% -10%,rgba(139,108,255,.20),transparent 60%),
    radial-gradient(600px 460px at -8% 112%,rgba(109,75,255,.16),transparent 60%),
    radial-gradient(500px 380px at 50% 120%,rgba(91,155,255,.08),transparent 60%)}
  a{color:inherit;text-decoration:none}
  .num{font-variant-numeric:tabular-nums}
  .app{display:grid;grid-template-columns:232px 1fr;min-height:100vh}
  .sidebar{background:var(--surface);border-right:1px solid var(--line);padding:26px 22px;display:flex;flex-direction:column;
    position:sticky;top:0;height:100vh}
  .wordmark{display:flex;align-items:center;gap:10px;font-weight:700;font-size:17px;letter-spacing:.02em;margin-bottom:40px}
  .mark{width:18px;height:18px;border-radius:5px;background:linear-gradient(135deg,var(--accent),var(--accent-2));display:inline-block}
  .nav a{display:block;padding:9px 0;color:var(--muted);font-size:14px;font-weight:500;border-left:2px solid transparent;padding-left:12px;margin-left:-12px}
  .nav a:hover{color:var(--ink)}
  .nav a.on{color:var(--ink);border-left-color:var(--accent)}
  .side-foot{margin-top:auto;font-size:13px;color:var(--muted);border-top:1px solid var(--line);padding-top:16px}
  .side-foot .u{color:var(--ink);font-weight:600}
  .main{min-width:0}
  .topbar{display:flex;align-items:center;justify-content:space-between;padding:20px 40px;border-bottom:1px solid var(--line);background:var(--surface)}
  .topbar .lbl{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
  .content{padding:48px 40px;max-width:1000px}
  .eyebrow{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:18px}
  h1{font-size:38px;line-height:1.12;letter-spacing:-.02em;font-weight:700;margin:0}
  h2{font-size:19px;font-weight:700;letter-spacing:-.01em;margin:0}
  .muted{color:var(--muted)}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;cursor:pointer;
    background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;font-family:var(--sans);font-weight:600;font-size:15px;padding:13px 22px;border-radius:11px;
    box-shadow:0 12px 26px -14px var(--accent)}
  .btn:hover{filter:brightness(1.06);transform:translateY(-1px)}
  .btn:disabled{opacity:.55;cursor:wait;transform:none}
  .btn.soft{background:rgba(255,255,255,.04);color:var(--ink);border:1px solid var(--line-2);box-shadow:none}
  .btn.soft:hover{background:rgba(255,255,255,.08);transform:none}
  input{width:100%;padding:13px 14px;border:1px solid var(--line-2);border-radius:11px;font-size:15px;background:rgba(255,255,255,.04);
    color:var(--ink);outline:none;font-family:var(--sans)}
  input:focus{border-color:var(--accent);box-shadow:0 0 0 4px rgba(139,108,255,.18)}
  .panel{background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));border:1px solid var(--line);
    border-radius:16px;padding:24px;backdrop-filter:blur(8px)}
  .panel.glow{box-shadow:0 40px 90px -50px rgba(139,108,255,.65),0 0 0 1px rgba(139,108,255,.06)}
  .panel-head{display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:12px}
  .panel-head .d{font-weight:700}
  .panel-head .s{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
  .row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);opacity:0;transform:translateY(4px);transition:.35s}
  .row.in{opacity:1;transform:none}
  .row .mk{width:20px;text-align:center;font-weight:700}
  .mk.ok{color:var(--ok)}.mk.warn{color:var(--warn)}
  .row .rl{flex:1}
  .row .rs{font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
  .score{margin-top:20px;padding-top:18px;border-top:1px solid var(--line)}
  .score-flex{display:flex;align-items:center;gap:20px}
  .gauge{width:108px;height:108px;border-radius:50%;flex:0 0 auto;display:flex;align-items:center;justify-content:center;
    background:conic-gradient(var(--gc,var(--accent)) calc(var(--gp,0)*1%),rgba(255,255,255,.08) 0);
    box-shadow:0 0 34px -8px var(--accent);transition:background .3s}
  .gauge .gin{width:84px;height:84px;border-radius:50%;background:#0a0a12;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .score-n{font-size:30px;font-weight:800;letter-spacing:-.02em;line-height:1}
  .score-o{color:var(--muted);font-size:12px;margin-top:2px}
  .score-msg{font-weight:700;font-size:15.5px}
  /* liste des vérifications (grille sobre) */
  .checks{border-top:1px solid var(--line);margin-top:18px}
  .check{border-bottom:1px solid var(--line);padding:18px 14px;cursor:pointer;display:grid;grid-template-columns:44px 1fr 20px;gap:14px;align-items:start;
    border-radius:12px;transition:background .15s}
  .check:hover{background:rgba(139,108,255,.07)}
  .check .idx{font-size:13px;color:#c9b8ff;font-weight:700;padding-top:2px}
  .check .cl{font-weight:600}
  .check .cd{color:var(--muted);font-size:13.5px;margin-top:2px}
  .check .more{display:none;color:var(--muted);font-size:13.5px;margin-top:10px}
  .check.open .more{display:block}
  .check .plus{color:var(--muted);text-align:right}
  .tech-tag{display:inline-block;font-size:11px;letter-spacing:.04em;color:var(--muted);border:1px solid var(--line-2);padding:2px 8px;border-radius:2px;margin-top:10px}
  .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:20px}
  .step .n{font-size:13px;color:var(--accent);font-weight:700;letter-spacing:.05em}
  .step .t{font-weight:600;margin:8px 0 4px}
  .rule{border:0;border-top:1px solid var(--line);margin:44px 0}
  .foot{color:var(--muted);font-size:13px;display:flex;gap:28px;flex-wrap:wrap;margin-top:8px}
  .reveal{opacity:0;transform:translateY(10px);transition:.6s ease}
  .reveal.in{opacity:1;transform:none}
  /* Variante centrée (page d'accueil alternative) */
  .site-head{display:flex;align-items:center;justify-content:space-between;max-width:920px;margin:0 auto;padding:24px 24px 0}
  .wrap{max-width:720px;margin:0 auto;padding:40px 24px 70px;text-align:center}
  .wrap h1{font-size:46px;line-height:1.08}
  .wrap .lead{font-size:18px;color:var(--muted);max-width:540px;margin:20px auto 30px}
  .wrap form{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;max-width:560px;margin:0 auto}
  .wrap .panel{text-align:left;max-width:560px;margin:32px auto 0}
  .checks.narrow{max-width:720px;margin:24px auto 0;text-align:left}
  .steps.narrow{max-width:820px;margin:22px auto 0;text-align:left}
  @media(max-width:900px){.app{grid-template-columns:1fr}.sidebar{display:none}.content,.topbar{padding-left:24px;padding-right:24px}
    .hero-grid{grid-template-columns:1fr!important}.steps{grid-template-columns:1fr}.wrap h1{font-size:34px}}
`;

function sidebar(active) {
  const items = [
    ['Accueil', '/', 'home'],
    ['Vérifier un site', '/app', 'verify'],
    ['Mes rapports', '/app', 'reports'],
    ['Conseils', '/app', 'tips'],
    ['Historique', '/app', 'history'],
    ['Paramètres', '/app', 'settings'],
  ];
  return `<aside class="sidebar">
    <div class="wordmark"><span class="mark"></span>${escapeHtml(NAME)}</div>
    <nav class="nav">${items.map(function (i) { return `<a class="${i[2] === active ? 'on' : ''}" href="${i[1]}">${i[0]}</a>`; }).join('')}</nav>
    <div class="side-foot"><div class="u">${escapeHtml(USER)}</div><div>Mon compte</div></div>
  </aside>`;
}

function topbar() {
  return `<div class="topbar"><span class="lbl">Vérification de sécurité · gratuite</span>
    <button class="btn soft" onclick="focusScan()">Vérifier mon site</button></div>`;
}

// Polices proposées (auto-hébergées, licences libres). Changer le défaut via
// la variable d'environnement BRAND_FONT, ou prévisualiser via ?font=<clé>.
const FONTS = {
  system: { label: 'Système', family: null },
  space: { label: 'Space Grotesk', family: 'Space Grotesk' },
  sora: { label: 'Sora', family: 'Sora' },
  manrope: { label: 'Manrope', family: 'Manrope' },
  inter: { label: 'Inter', family: 'Inter' },
};
const DEFAULT_FONT = process.env.BRAND_FONT || 'space';

function fontCss(fontKey) {
  const key = FONTS[fontKey] ? fontKey : DEFAULT_FONT;
  const f = FONTS[key] || FONTS.system;
  if (!f.family) {
    return `<style>:root{--font:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}</style>`;
  }
  const faces = [400, 600, 700].map((w) =>
    `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${w};font-display:swap;src:url('/assets/${key}-${w}.woff2') format('woff2')}`
  ).join('');
  return `<style>${faces}:root{--font:'${f.family}',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}</style>`;
}

function head(title, fontKey) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>${DESIGN}</style>${fontCss(fontKey)}</head>`;
}

function shell(active, main) {
  return `<body><div class="app">${sidebar(active)}<div class="main">${topbar()}<div class="content">${main}</div></div></div>`;
}

function fxScript() {
  return `<script>(function(){var r=[].slice.call(document.querySelectorAll('.reveal'));
    if('IntersectionObserver'in window){var o=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');o.unobserve(e.target);}});},{threshold:.1});
    r.forEach(function(e){o.observe(e);});}else{r.forEach(function(e){e.classList.add('in');});}})();
    function focusScan(){var u=document.getElementById('url');if(u){u.scrollIntoView({behavior:'smooth',block:'center'});u.focus();}else{location.href='/';}}</script>`;
}

// ------------------------------------------------------------------
// ACCUEIL
// ------------------------------------------------------------------
function landingPage(fontKey) {
  const steps = [
    ['01', 'Entrez l\'adresse de votre site', 'Aucune installation, aucune carte bancaire.'],
    ['02', 'IXAUDIT vérifie pour vous', 'Nous contrôlons automatiquement les points essentiels.'],
    ['03', 'Vous recevez des explications simples', 'Ce qui va bien, et ce qu\'il faut améliorer.'],
  ];
  const main = `
    <div class="hero-grid" style="display:grid;grid-template-columns:1fr 380px;gap:48px;align-items:start">
      <div>
        <div class="eyebrow">Vérification de sécurité</div>
        <h1>${escapeHtml(HEADLINE)}</h1>
        <p class="muted" style="font-size:16px;max-width:440px;margin:18px 0 26px">${escapeHtml(TAGLINE)}</p>
        <form id="f" style="display:flex;gap:10px;flex-wrap:wrap;max-width:500px">
          <input id="url" type="url" placeholder="https://votre-site.com" required style="flex:1 1 240px">
          <button class="btn" id="btn" type="submit">Vérifier mon site</button>
        </form>
        <p class="muted" style="font-size:13px;margin-top:16px">Aucune carte bancaire &nbsp;·&nbsp; Résultat en quelques minutes &nbsp;·&nbsp; Explications simples</p>
        <div id="err" style="display:none;margin-top:12px;color:var(--bad);font-size:14px"></div>
      </div>

      ${scanPanel()}
    </div>

    <hr class="rule">

    <div class="eyebrow">Ce que nous vérifions</div>
    <h2>Six vérifications essentielles</h2>
    <div class="checks">
      ${CATS.map(function (c, i) {
        return `<div class="check" onclick="this.classList.toggle('open')">
          <div class="idx num">0${i + 1}</div>
          <div><div class="cl">${escapeHtml(c.label)}</div><div class="cd">${escapeHtml(c.ok)}</div>
            <div class="more"><span class="tech-tag">Contrôle technique : ${escapeHtml(c.tech)}</span></div></div>
          <div class="plus">+</div></div>`;
      }).join('')}
    </div>

    <hr class="rule">

    <div class="eyebrow">Comment ça marche</div>
    <h2>Trois étapes</h2>
    <div class="steps">
      ${steps.map(function (s) {
        return `<div class="step"><div class="n num">${s[0]}</div><div class="t">${s[1]}</div><div class="muted" style="font-size:13.5px">${s[2]}</div></div>`;
      }).join('')}
    </div>

    <hr class="rule">
    <div class="foot"><span>Aucune carte bancaire</span><span>Conforme RGPD</span><span>Vérification non intrusive — on n'attaque jamais votre site</span></div>`;

  return `${head(NAME + ' — ' + HEADLINE, fontKey)}${shell('home', main)}${scanScript()}${fxScript()}
</body></html>`;
}

// ------------------------------------------------------------------
// ESPACE CLIENT
// ------------------------------------------------------------------
function dashboardPage(fontKey) {
  const cards = [
    ['01', 'Créer un compte', `<label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">Votre email</label><input id="email" type="email" placeholder="vous@entreprise.com">
      <button class="btn" style="margin-top:12px;width:100%" onclick="createAccount()">Créer mon compte</button><div id="createOut" style="margin-top:10px;font-size:14px"></div>`],
    ['02', 'Votre clé d\'accès', `<label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">Clé (sk_live_…)</label><input id="key" type="text" placeholder="Collez votre clé ici">
      <button class="btn soft" style="margin-top:12px;width:100%" onclick="checkStatus()">Vérifier mon statut</button>`],
    ['03', 'Débloquer l\'illimité', `<p class="muted" style="font-size:13.5px;margin:0 0 14px">Un seul paiement, accès à vie. Aucun abonnement.</p>
      <button class="btn" style="width:100%" onclick="checkout()">Débloquer · accès à vie</button><div id="payOut" class="muted" style="font-size:12px;margin-top:8px"></div>`],
    ['04', 'Vérifier un site', `<label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">Adresse du site</label><input id="auditUrl" type="url" placeholder="https://site-a-verifier.com">
      <button class="btn" style="margin-top:12px;width:100%" onclick="runAudit()">Lancer la vérification</button><div id="auditResult" style="margin-top:10px;font-size:14px"></div>`],
  ];
  const main = `
    <div class="eyebrow">Espace client</div>
    <h1 style="font-size:30px">Vos vérifications, en toute autonomie</h1>
    <p class="muted" style="margin:14px 0 24px;max-width:520px">Créez votre compte, débloquez une seule fois, puis vérifiez autant de sites que vous voulez, à vie.</p>
    <div class="panel" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px;padding:16px 22px">
      <div><span class="s" style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">Statut de l'accès</span>
        <div id="statusText" style="font-weight:700;margin-top:2px">Non connecté</div></div>
      <span id="statusPill" style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)">—</span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">
      ${cards.map(function (c) {
        return `<div class="panel"><div style="display:flex;align-items:baseline;gap:10px;margin-bottom:14px">
          <span class="num" style="color:var(--accent);font-weight:700;font-size:13px">${c[0]}</span><h2 style="font-size:16px">${c[1]}</h2></div>${c[2]}</div>`;
      }).join('')}
    </div>`;
  return `${head('Espace client · ' + NAME, fontKey)}${shell('verify', main)}
<script>
  var GC=${JSON.stringify(GRADE)};
  function focusScan(){location.href='/';}
  function key(){return document.getElementById('key').value.trim();}
  function setStatus(active,txt){document.getElementById('statusText').textContent=txt;var p=document.getElementById('statusPill');
    p.textContent=active?'ACTIF':'INACTIF';p.style.color=active?'var(--ok)':'var(--bad)';}
  function createAccount(){var email=document.getElementById('email').value.trim();
    fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email})}).then(function(r){return r.json();}).then(function(j){
      if(j.error){document.getElementById('createOut').innerHTML='<span style="color:var(--bad)">'+j.error+'</span>';return;}
      document.getElementById('createOut').innerHTML='<div class="muted">Votre clé (à copier, affichée une seule fois) :</div><div style="font-family:monospace;font-size:12px;background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:8px;padding:9px;word-break:break-all;margin-top:6px">'+j.apiKey+'</div>';
      document.getElementById('key').value=j.apiKey;});}
  function checkStatus(){fetch('/api/account/status',{headers:{'x-api-key':key()}}).then(function(r){return r.json();}).then(function(j){
      if(j.error){setStatus(false,j.error);return;}var d=j.active?(j.validUntil?('valable jusqu\\'au '+new Date(j.validUntil).toLocaleDateString()):'accès à vie'):'paiement requis';
      setStatus(j.active,(j.email||'')+' · '+(j.auditsCount||0)+' vérification(s) · '+d);});}
  function checkout(){fetch('/api/checkout',{method:'POST',headers:{'x-api-key':key()}}).then(function(r){return r.json();}).then(function(j){
      if(j.checkoutUrl){window.location=j.checkoutUrl;}else{document.getElementById('payOut').innerHTML='<span style="color:var(--bad)">'+(j.error||'Paiement indisponible')+'</span>';}});}
  function runAudit(){var url=document.getElementById('auditUrl').value.trim();var out=document.getElementById('auditResult');out.textContent='Vérification en cours…';
    fetch('/api/audit',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key()},body:JSON.stringify({url:url})}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});}).then(function(o){
      if(!o.ok){out.innerHTML='<span style="color:var(--bad)">'+(o.j.error||'Erreur')+'</span>';return;}
      out.innerHTML='Niveau de sécurité : <strong>'+o.j.score+'/100</strong> — <a style="color:var(--accent);font-weight:600" href="'+o.j.reportUrl+'" target="_blank">voir les détails</a>';});}
</script>
${fxScript()}
</body></html>`;
}

// Composant d'audit réutilisable (identique à l'accueil).
function scanPanel() {
  return `<div class="panel glow" id="scanCard">
    <div class="panel-head"><span class="d" id="scanDomain">monsite.fr</span><span class="s" id="scanStatus">Analyse…</span></div>
    <div id="scanList"></div>
    <div id="scanScore" class="score" style="display:none">
      <div class="score-flex">
        <div class="gauge" id="gauge"><div class="gin"><span class="score-n num" id="scoreN">0</span><span class="score-o num">/100</span></div></div>
        <div><div class="score-msg" id="scoreMsg"></div>
          <div class="muted" style="font-size:13.5px;margin-top:3px" id="scoreSub"></div>
          <a class="btn" id="scoreCta" href="#" style="margin-top:12px;padding:11px 18px;font-size:14px">Voir ce que vous pouvez améliorer</a></div>
      </div>
    </div></div>`;
}

function scanScript() {
  return `<script>
  var CATS=${JSON.stringify(CATS.map(function (c) { return { id: c.id, label: c.label, ok: c.ok, warn: c.warn }; }))};
  var CATMAP={};CATS.forEach(function(c){CATMAP[c.id]=c;});
  function sColor(s){return s>=75?'var(--ok)':s>=60?'var(--warn)':s>=45?'#c26a1a':'var(--bad)';}
  function sMsg(s){return s>=90?['Votre site est très bien protégé.','Continuez comme ça.']:
    s>=75?['Votre site est plutôt bien protégé.','Quelques points peuvent encore être améliorés.']:
    s>=60?['Votre site est correctement protégé.','Plusieurs améliorations sont recommandées.']:
    s>=45?['Votre site présente des points faibles.','Il est conseillé d\\'agir prochainement.']:
    ['Votre site présente des risques importants.','Une mise en sécurité rapide est recommandée.'];}
  function addRow(label,ok){var list=document.getElementById('scanList');var d=document.createElement('div');d.className='row';
    d.innerHTML='<span class="mk '+(ok?'ok':'warn')+'">'+(ok?'✓':'!')+'</span><span class="rl">'+label+'</span><span class="rs">'+(ok?'OK':'À vérifier')+'</span>';
    list.appendChild(d);setTimeout(function(){d.classList.add('in');},30);}
  function showScore(score,cta){document.getElementById('scanScore').style.display='block';
    var m=sMsg(score);document.getElementById('scoreMsg').textContent=m[0];document.getElementById('scoreSub').textContent=m[1];
    if(cta){document.getElementById('scoreCta').setAttribute('href',cta);document.getElementById('scoreCta').setAttribute('target','_blank');}
    var g=document.getElementById('gauge');g.style.setProperty('--gc',sColor(score));
    var cur=0,iv=setInterval(function(){cur+=Math.max(1,Math.round(score/26));if(cur>=score){cur=score;clearInterval(iv);}
      document.getElementById('scoreN').textContent=cur;g.style.setProperty('--gp',cur);},30);}
  function reset(domain){document.getElementById('scanDomain').textContent=domain;document.getElementById('scanStatus').textContent='Analyse…';
    document.getElementById('scanList').innerHTML='';document.getElementById('scanScore').style.display='none';
    var g=document.getElementById('gauge');if(g)g.style.setProperty('--gp',0);}
  function demo(){reset('monsite.fr');var items=[['Connexion sécurisée',true],['Site accessible',true],['Certificat valide',true],['Protection à améliorer',false],['2 points à vérifier',false]];
    var i=0;(function n(){if(i<items.length){addRow(items[i][0],items[i][1]);i++;setTimeout(n,340);}else{document.getElementById('scanStatus').textContent='Terminé';showScore(78,null);
      document.getElementById('scoreCta').addEventListener('click',function(e){e.preventDefault();focusScan();});}})();}
  document.getElementById('f').addEventListener('submit',function(e){e.preventDefault();
    var url=document.getElementById('url').value.trim(),btn=document.getElementById('btn'),errEl=document.getElementById('err');
    var domain=url.replace(/^https?:\\/\\//,'').replace(/\\/.*$/,'');errEl.style.display='none';btn.disabled=true;
    document.getElementById('scanCard').scrollIntoView({behavior:'smooth',block:'center'});reset(domain||'votre site');
    fetch('/api/audit/free',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url})})
    .then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});}).then(function(o){btn.disabled=false;
      if(!o.ok){errEl.style.display='block';errEl.textContent=o.j.error||'Erreur.';document.getElementById('scanStatus').textContent='Impossible';return;}
      var j=o.j,cats=(j.categories||[]).filter(function(c){return CATMAP[c.id]&&!c.degraded;});
      var i=0;(function n(){if(i<cats.length){var c=cats[i],m=CATMAP[c.id];addRow(m.label,c.ok);i++;setTimeout(n,300);}
        else{document.getElementById('scanStatus').textContent='Terminé';showScore(j.score,j.reportUrl);}})();})
    .catch(function(err){btn.disabled=false;errEl.style.display='block';errEl.textContent='Erreur réseau : '+err.message;});});
  setTimeout(demo,250);
  </script>`;
}

// ------------------------------------------------------------------
// ACCUEIL — VARIANTE 2 (centrée, sans sidebar, orientée conversion)
// ------------------------------------------------------------------
function landingAltPage(fontKey) {
  const steps = [
    ['01', 'Entrez l\'adresse de votre site', 'Aucune installation, aucune carte bancaire.'],
    ['02', 'IXAUDIT vérifie pour vous', 'Nous contrôlons automatiquement les points essentiels.'],
    ['03', 'Vous recevez des explications simples', 'Ce qui va bien, et ce qu\'il faut améliorer.'],
  ];
  return `${head(NAME + ' — ' + HEADLINE, fontKey)}<body>
  <header class="site-head">
    <div class="wordmark" style="margin-bottom:0"><span class="mark"></span>${escapeHtml(NAME)}</div>
    <a class="btn soft" href="/app">Espace client</a>
  </header>

  <main class="wrap">
    <div class="eyebrow" style="margin-bottom:14px">Vérification de sécurité · gratuite</div>
    <h1>${escapeHtml(HEADLINE)}</h1>
    <p class="lead">${escapeHtml(TAGLINE)}</p>
    <form id="f">
      <input id="url" type="url" placeholder="https://votre-site.com" required style="flex:1 1 300px;text-align:left">
      <button class="btn" id="btn" type="submit">Vérifier mon site</button>
    </form>
    <p class="muted" style="font-size:13px;margin-top:14px">Aucune carte bancaire &nbsp;·&nbsp; Résultat en quelques minutes &nbsp;·&nbsp; Explications simples</p>
    <div id="err" style="display:none;margin-top:12px;color:var(--bad);font-size:14px"></div>

    ${scanPanel()}
  </main>

  <div style="max-width:920px;margin:0 auto;padding:0 24px 70px">
    <hr class="rule">
    <div class="eyebrow">Ce que nous vérifions</div>
    <h2 style="margin-top:4px">Six vérifications essentielles</h2>
    <div class="checks narrow">
      ${CATS.map(function (c, i) {
        return `<div class="check" onclick="this.classList.toggle('open')">
          <div class="idx num">0${i + 1}</div>
          <div><div class="cl">${escapeHtml(c.label)}</div><div class="cd">${escapeHtml(c.ok)}</div>
            <div class="more"><span class="tech-tag">Contrôle technique : ${escapeHtml(c.tech)}</span></div></div>
          <div class="plus">+</div></div>`;
      }).join('')}
    </div>

    <hr class="rule">
    <div class="eyebrow">Comment ça marche</div>
    <h2 style="margin-top:4px">Trois étapes</h2>
    <div class="steps narrow">
      ${steps.map(function (s) { return `<div class="step"><div class="n num">${s[0]}</div><div class="t">${s[1]}</div><div class="muted" style="font-size:13.5px">${s[2]}</div></div>`; }).join('')}
    </div>

    <hr class="rule">
    <div class="foot"><span>Aucune carte bancaire</span><span>Conforme RGPD</span><span>Vérification non intrusive — on n'attaque jamais votre site</span></div>
  </div>
  ${scanScript()}${fxScript()}
</body></html>`;
}

module.exports = { NAME, HEADLINE, TAGLINE, ACCENT, GRADE, SEV, CATS, landingPage, landingAltPage, dashboardPage, escapeHtml };
