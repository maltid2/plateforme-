'use strict';

/**
 * Marque IXAUDIT + design (grand public, bleu nuit + touches violettes).
 *
 * Positionnement : parler du PROBLÈME, pas de la technique. Message clair,
 * traduction du jargon (TLS, CVE, RGPD...) en langage simple, visuel concret
 * (simulation d'analyse + score /100). Premium, sobre, animations douces.
 * Zéro dépendance. Le rapport détaillé (technique) reste pour les profils IT.
 *
 * Rebranding via env : BRAND_NAME, BRAND_TAGLINE, BRAND_ACCENT, BRAND_USER.
 */

const NAME = process.env.BRAND_NAME || 'IXAUDIT';
const HEADLINE = process.env.BRAND_HEADLINE || 'Votre site est-il vraiment sécurisé ?';
const TAGLINE =
  process.env.BRAND_TAGLINE ||
  'Découvrez en quelques minutes ce qui pourrait mettre votre entreprise ou vos données en danger.';
const ACCENT = process.env.BRAND_ACCENT || '#8b6cff';
const USER = process.env.BRAND_USER || 'Aymerick';

const GRADE = { A: '#22c55e', B: '#4ade80', C: '#facc15', D: '#fb923c', F: '#f43f5e' };
const SEV = { high: '#f43f5e', medium: '#fb923c', low: '#facc15', info: '#5aa9ff' };

/**
 * Traduction cybersécurité -> langage simple. Chaque module technique devient
 * une vérification compréhensible, avec une explication claire.
 */
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
    --accent:${ACCENT};--accent-2:#6d4bff;--blue:#5b9bff;
    --bg:#0a0f1e;--panel:#0e1426;--panel-2:#101830;--card:rgba(255,255,255,.03);
    --line:rgba(255,255,255,.08);--ink:#eaf0fb;--muted:#8790a9;
    --ok:#22c55e;--warn:#fb923c;
    --radius:16px;--sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:var(--sans);color:var(--ink);background:var(--bg);line-height:1.55;-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  .app{display:grid;grid-template-columns:256px 1fr;min-height:100vh}
  .sidebar{background:linear-gradient(180deg,var(--panel),#0a0e1c);border-right:1px solid var(--line);
    padding:18px 15px;display:flex;flex-direction:column;gap:5px;position:sticky;top:0;height:100vh;overflow-y:auto}
  .logo{display:flex;align-items:center;gap:11px;padding:6px 6px 14px}
  .logo .name{font-weight:800;font-size:20px;letter-spacing:.01em}
  .logo .name b{background:linear-gradient(120deg,#a78bfa,#5b9bff);-webkit-background-clip:text;background-clip:text;color:transparent}
  .emblem{position:relative;display:flex;align-items:center;justify-content:center;padding:2px 0 14px}
  .emblem .glow{position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,rgba(124,92,255,.24),transparent 62%)}
  .emblem svg{position:relative;filter:drop-shadow(0 10px 26px rgba(124,92,255,.35))}
  .nav-i{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:11px;color:var(--muted);font-weight:600;font-size:14px;cursor:pointer;transition:.15s}
  .nav-i .ic{width:20px;text-align:center;opacity:.92}
  .nav-i:hover{background:rgba(255,255,255,.04);color:var(--ink)}
  .nav-i.on{background:linear-gradient(90deg,rgba(139,108,255,.20),rgba(139,108,255,.04));color:#d8ccff;box-shadow:inset 2px 0 0 var(--accent)}
  .acct{margin-top:auto;display:flex;align-items:center;gap:11px;padding:10px;border:1px solid var(--line);border-radius:13px;background:var(--card)}
  .avatar{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--accent),var(--blue));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#0a0713;flex:0 0 auto}
  .main{min-width:0;display:flex;flex-direction:column}
  .topbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 26px;border-bottom:1px solid var(--line);background:rgba(10,15,30,.72);backdrop-filter:blur(12px)}
  .chip{display:inline-flex;align-items:center;gap:11px;padding:8px 14px;border-radius:13px;border:1px solid var(--line);background:var(--card)}
  .content{padding:26px;max-width:1180px;width:100%}
  .btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:9px;border:0;cursor:pointer;font-weight:700;font-size:15px;padding:14px 24px;border-radius:13px;color:#fff;background:linear-gradient(135deg,var(--accent),var(--accent-2));box-shadow:0 12px 26px -14px var(--accent);transition:.16s}
  .btn:hover{transform:translateY(-2px);box-shadow:0 18px 36px -16px var(--accent)}
  .btn:disabled{opacity:.6;cursor:wait;transform:none}
  .btn.soft{background:var(--card);border:1px solid var(--line);color:var(--ink);box-shadow:none}
  .btn.soft:hover{background:rgba(255,255,255,.06)}
  .card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius)}
  input{width:100%;padding:15px 16px;border-radius:12px;border:1px solid var(--line);font-size:15px;background:rgba(255,255,255,.04);color:var(--ink);outline:none;transition:.16s}
  input::placeholder{color:#6f7893}
  input:focus{border-color:var(--accent);box-shadow:0 0 0 4px rgba(139,108,255,.18)}
  h1,h2,h3{margin:0;letter-spacing:-.02em}
  .muted{color:var(--muted)}
  .reveal{opacity:0;transform:translateY(16px);transition:.7s cubic-bezier(.2,.7,.2,1)}
  .reveal.in{opacity:1;transform:none}
  /* Carte d'analyse (visuel concret) */
  .scan{padding:20px 22px}
  .scan-head{display:flex;align-items:center;gap:10px;font-weight:700}
  .pulse{width:9px;height:9px;border-radius:50%;background:var(--blue);box-shadow:0 0 0 0 rgba(91,155,255,.6);animation:pulse 1.6s infinite}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(91,155,255,.5)}70%{box-shadow:0 0 0 8px rgba(91,155,255,0)}100%{box-shadow:0 0 0 0 rgba(91,155,255,0)}}
  .scan-item{padding:11px 0;border-top:1px solid var(--line);opacity:0;transform:translateY(6px);transition:.45s;cursor:pointer}
  .scan-item.in{opacity:1;transform:none}
  .scan-row{display:flex;align-items:center;gap:11px}
  .scan-st{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex:0 0 auto}
  .st-ok{background:rgba(34,197,94,.15);color:#4ade80}
  .st-warn{background:rgba(251,146,60,.15);color:#fb923c}
  .scan-more{display:none;margin:8px 0 2px 37px;font-size:13px;color:var(--muted)}
  .scan-item.open .scan-more{display:block}
  /* Jauge score */
  .gauge{width:118px;height:118px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:0 0 auto;
    background:conic-gradient(var(--gc) calc(var(--gp,0)*1%),rgba(255,255,255,.07) 0)}
  .gauge .in{width:92px;height:92px;border-radius:50%;background:var(--panel-2);display:flex;flex-direction:column;align-items:center;justify-content:center}
  .gauge .n{font-size:30px;font-weight:800;line-height:1}
  /* Catégories (ce que nous vérifions) */
  .cat{padding:16px 18px;cursor:pointer;transition:.15s}
  .cat:hover{background:rgba(255,255,255,.03)}
  .cat-more{display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);font-size:13.5px;color:var(--muted)}
  .cat.open .cat-more{display:block}
  .tag{display:inline-block;font-size:11px;font-weight:700;color:#a9b4ff;background:rgba(139,108,255,.12);border:1px solid var(--line);padding:2px 8px;border-radius:999px;margin-top:8px}
  .trust{display:flex;flex-wrap:wrap;gap:26px;align-items:center;padding:16px 20px;margin-top:16px}
  .trust .it{display:flex;align-items:center;gap:11px}
  .trust .ic{width:38px;height:38px;border-radius:10px;background:var(--card);border:1px solid var(--line);display:flex;align-items:center;justify-content:center}
  /* Intro (sobre) */
  #intro{position:fixed;inset:0;z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
    background:radial-gradient(1000px 700px at 50% 40%,#161a3a,#0a0f1e 72%);transition:opacity .7s,transform .7s,filter .7s}
  #intro.gone{opacity:0;transform:scale(1.06);filter:blur(6px);pointer-events:none}
  .intro-t{opacity:0;animation:up .8s ease both}
  @keyframes up{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:none}}
  .loader{width:180px;height:4px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden;margin:22px auto 0}
  .loader i{display:block;height:100%;width:40%;border-radius:999px;background:linear-gradient(90deg,var(--accent),var(--blue));animation:load 1.4s ease-in-out infinite}
  @keyframes load{0%{margin-left:-40%}100%{margin-left:100%}}
  @media(max-width:980px){.hero-grid{grid-template-columns:1fr!important}}
  @media(max-width:900px){.app{grid-template-columns:1fr}.sidebar{display:none}}
`;

function ixLogo(size) {
  const s = size || 30;
  return `<svg width="${s}" height="${s}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="ixg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#5b9bff"/></linearGradient></defs>
    <path d="M24 3 L41 10 V25 C41 35 33 42 24 45 C15 42 7 35 7 25 V10 Z" fill="url(#ixg)" opacity=".16"/>
    <path d="M24 3 L41 10 V25 C41 35 33 42 24 45 C15 42 7 35 7 25 V10 Z" stroke="url(#ixg)" stroke-width="2"/>
    <path d="M19 16 V32" stroke="url(#ixg)" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M24 16 L33 32 M33 16 L24 32" stroke="url(#ixg)" stroke-width="3.4" stroke-linecap="round"/>
  </svg>`;
}

function emblemSVG(px) {
  const s = px || 108;
  return `<svg width="${s}" height="${s}" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="eg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9b6ff"/><stop offset="1" stop-color="#7aa8ff"/></linearGradient></defs>
    <path d="M60 8 L100 22 V56 C100 82 82 100 60 110 C38 100 20 82 20 56 V22 Z" fill="url(#eg2)" opacity=".14"/>
    <path d="M60 8 L100 22 V56 C100 82 82 100 60 110 C38 100 20 82 20 56 V22 Z" stroke="url(#eg2)" stroke-width="2.2"/>
    <path d="M46 40 V72" stroke="url(#eg2)" stroke-width="6" stroke-linecap="round"/>
    <path d="M56 40 L78 72 M78 40 L56 72" stroke="url(#eg2)" stroke-width="6" stroke-linecap="round"/>
  </svg>`;
}

function head(title) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>${DESIGN}</style></head>`;
}

function sidebar(active) {
  const items = [
    ['🏠', 'Accueil', '/', 'home'],
    ['🔍', 'Vérifier un site', '/app', 'verify'],
    ['📄', 'Mes rapports', '/app', 'reports'],
    ['💡', 'Conseils', '/app', 'tips'],
    ['🕘', 'Historique', '/app', 'history'],
    ['⚙️', 'Paramètres', '/app', 'settings'],
  ];
  return `<aside class="sidebar">
    <div class="logo">${ixLogo(30)}<span class="name">IX<b>AUDIT</b></span></div>
    <div class="emblem"><div class="glow"></div>${emblemSVG(108)}</div>
    ${items.map(function (i) { return `<a class="nav-i ${i[3] === active ? 'on' : ''}" href="${i[2]}"><span class="ic">${i[0]}</span>${i[1]}</a>`; }).join('')}
    <div class="acct"><div class="avatar">${escapeHtml(USER.slice(0, 2).toUpperCase())}</div>
      <div style="flex:1"><div style="font-size:13.5px;font-weight:700">${escapeHtml(USER)}</div>
        <div class="muted" style="font-size:12px">Mon compte</div></div><span class="muted">▾</span></div>
  </aside>`;
}

function topbar() {
  return `<div class="topbar">
    <span class="chip">${ixLogo(20)}<span><div style="font-size:13.5px;font-weight:700">Vérification gratuite et illimitée</div>
      <div class="muted" style="font-size:12px">Résultat en quelques minutes</div></span></span>
    <button class="btn" onclick="focusScan()">Vérifier mon site</button>
  </div>`;
}

function shell(active, main, prepend) {
  return `<body>${prepend || ''}<div class="app">${sidebar(active)}
    <div class="main">${topbar()}<div class="content">${main}</div></div></div>`;
}

function fxScript() {
  return `<script>(function(){var r=[].slice.call(document.querySelectorAll('.reveal'));
    if('IntersectionObserver'in window){var o=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');o.unobserve(e.target);}});},{threshold:.1});
    r.forEach(function(e){o.observe(e);});}else{r.forEach(function(e){e.classList.add('in');});}})();
    function focusScan(){var u=document.getElementById('url');if(u){u.scrollIntoView({behavior:'smooth',block:'center'});u.focus();}else{location.href='/';}}
    </script>`;
}

// Intro sobre : marque + question + petit loader, puis on entre.
function introOverlay() {
  return `<div id="intro">
    <div class="intro-t" style="animation-delay:.05s">${emblemSVG(96)}</div>
    <div class="intro-t" style="animation-delay:.35s;margin-top:6px;display:flex;align-items:center;gap:11px">
      ${ixLogo(30)}<span style="font-weight:800;font-size:28px">IX<span style="background:linear-gradient(120deg,#a78bfa,#5b9bff);-webkit-background-clip:text;background-clip:text;color:transparent">AUDIT</span></span></div>
    <div class="intro-t muted" style="animation-delay:.6s;margin-top:12px;font-size:16px;max-width:420px">${escapeHtml(HEADLINE)}</div>
    <div class="intro-t" style="animation-delay:.85s"><div class="loader"><i></i></div></div>
    <button id="enterBtn" class="btn intro-t" style="animation-delay:1.15s;margin-top:26px">Commencer la vérification →</button>
  </div>
  <script>(function(){var intro=document.getElementById('intro');
    if(/intro=0/.test(location.search)||sessionStorage.getItem('ix_intro')){if(intro&&intro.parentNode)intro.parentNode.removeChild(intro);return;}
    function enter(){sessionStorage.setItem('ix_intro','1');intro.classList.add('gone');setTimeout(function(){if(intro&&intro.parentNode)intro.parentNode.removeChild(intro);},750);}
    document.getElementById('enterBtn').addEventListener('click',enter);
  })();</script>`;
}

// ------------------------------------------------------------------
// ACCUEIL — grand public
// ------------------------------------------------------------------
function landingPage() {
  const steps = [
    ['1', 'Entrez l\'adresse de votre site', 'Aucune installation, aucune carte bancaire.'],
    ['2', 'IXAUDIT vérifie pour vous', 'Nous contrôlons automatiquement les points essentiels.'],
    ['3', 'Vous recevez des explications simples', 'On vous dit clairement ce qui va bien et ce qu\'il faut améliorer.'],
  ];
  const main = `
    <section class="card reveal" style="position:relative;overflow:hidden;padding:34px 36px;
      background:radial-gradient(760px 380px at 80% -10%,rgba(91,155,255,.18),transparent 60%),
      radial-gradient(520px 360px at 8% 120%,rgba(139,108,255,.12),transparent 55%),var(--panel-2)">
      <div class="hero-grid" style="display:grid;grid-template-columns:1.05fr .95fr;gap:28px;align-items:center">
        <div>
          <h1 style="font-size:40px;line-height:1.1;margin-bottom:14px">${escapeHtml(HEADLINE)}</h1>
          <p class="muted" style="font-size:16.5px;max-width:460px;margin:0 0 22px">${escapeHtml(TAGLINE)}</p>
          <form id="f" style="display:flex;gap:10px;flex-wrap:wrap;max-width:520px">
            <input id="url" type="url" placeholder="https://votre-site.com" required style="flex:1 1 260px">
            <button class="btn" id="btn" type="submit">Vérifier mon site gratuitement →</button>
          </form>
          <div class="muted" style="font-size:13.5px;margin-top:14px">🔒 Aucune carte bancaire &nbsp;·&nbsp; ⚡ Résultat en quelques minutes &nbsp;·&nbsp; 🛡️ Explications simples</div>
          <div id="err" style="display:none;margin-top:12px;color:#fda4af;font-size:14px"></div>
        </div>

        <div class="card scan" id="scanCard">
          <div class="scan-head"><span class="pulse" id="scanPulse"></span>
            <span id="scanDomain">monsite.fr</span>
            <span class="muted" id="scanStatus" style="font-weight:500;font-size:13px">Analyse en cours…</span></div>
          <div id="scanList" style="margin-top:6px"></div>
          <div id="scanScore" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--line)">
            <div style="display:flex;align-items:center;gap:18px">
              <div class="gauge" id="gauge"><div class="in"><div class="n" id="scoreN">0</div><div class="muted" style="font-size:11px">/ 100</div></div></div>
              <div><div style="font-weight:700;font-size:15px" id="scoreMsg"></div>
                <div class="muted" style="font-size:13.5px;margin-top:4px" id="scoreSub"></div>
                <a class="btn" id="scoreCta" href="#" style="margin-top:12px;padding:10px 18px;font-size:14px">Voir ce que vous pouvez améliorer →</a></div>
            </div></div>
        </div>
      </div>
    </section>

    <h2 style="font-size:22px;margin:26px 4px 4px">Ce que nous vérifions pour vous</h2>
    <p class="muted" style="margin:0 4px 16px;font-size:14px">Cliquez sur une vérification pour comprendre à quoi elle sert.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">
      ${CATS.map(function (c, i) {
        return `<div class="card cat reveal" style="transition-delay:${i * 40}ms" onclick="this.classList.toggle('open')">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="font-size:22px">${c.icon}</div>
            <div style="flex:1"><div style="font-weight:700">${c.label}</div>
              <div class="muted" style="font-size:12.5px">Cliquez pour en savoir plus</div></div>
            <span class="muted">＋</span></div>
          <div class="cat-more">${c.ok}<div class="tag">Vérification technique : ${c.tech}</div></div></div>`;
      }).join('')}
    </div>

    <section class="card reveal" style="padding:28px 32px;margin-top:22px">
      <h2 style="font-size:22px">Comment ça marche&nbsp;?</h2>
      <p class="muted" style="margin:6px 0 22px;font-size:14px">Simple, en 3 étapes.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px">
        ${steps.map(function (s) {
          return `<div style="display:flex;gap:13px;align-items:flex-start">
            <div style="width:38px;height:38px;border-radius:11px;flex:0 0 auto;background:rgba(139,108,255,.14);border:1px solid rgba(139,108,255,.3);color:#c9b8ff;font-weight:800;display:flex;align-items:center;justify-content:center">${s[0]}</div>
            <div><div style="font-weight:700;margin:5px 0 4px">${s[1]}</div><div class="muted" style="font-size:13.5px">${s[2]}</div></div></div>`;
        }).join('')}
      </div>
    </section>

    <div class="card trust reveal">
      <div class="it"><div class="ic">🔒</div><div><div style="font-weight:700;font-size:13.5px">Aucune carte bancaire</div><div class="muted" style="font-size:12px">Vérification 100% gratuite</div></div></div>
      <div class="it"><div class="ic">🛡️</div><div><div style="font-weight:700;font-size:13.5px">Explications simples</div><div class="muted" style="font-size:12px">Compréhensible sans être expert</div></div></div>
      <div class="it"><div class="ic">🔐</div><div><div style="font-weight:700;font-size:13.5px">Sécurisé & privé</div><div class="muted" style="font-size:12px">On n'attaque jamais votre site</div></div></div>
    </div>`;

  return `${head(NAME + ' — ' + HEADLINE)}${shell('home', main, introOverlay())}
<script>
  var CATS=${JSON.stringify(CATS.map(function (c) { return { id: c.id, icon: c.icon, label: c.label, ok: c.ok, warn: c.warn }; }))};
  var CATMAP={};CATS.forEach(function(c){CATMAP[c.id]=c;});

  function scoreColor(s){return s>=75?'#22c55e':s>=60?'#facc15':s>=45?'#fb923c':'#f43f5e';}
  function scoreMsg(s){return s>=90?['🟢 Votre site est très bien protégé.','Continuez comme ça !']:
    s>=75?['🟢 Votre site est plutôt bien protégé.','Quelques points peuvent encore être améliorés.']:
    s>=60?['🟡 Votre site est correctement protégé.','Plusieurs améliorations sont recommandées.']:
    s>=45?['🟠 Votre site présente des points faibles.','Il est conseillé d\\'agir prochainement.']:
    ['🔴 Votre site présente des risques importants.','Une mise en sécurité est recommandée rapidement.'];}

  function addItem(list, icon, label, ok, explain){
    var d=document.createElement('div');d.className='scan-item';
    d.innerHTML='<div class="scan-row"><div class="scan-st '+(ok?'st-ok':'st-warn')+'">'+(ok?'✓':'⚠')+'</div>'+
      '<div style="flex:1"><span>'+label+'</span></div><span class="muted" style="font-size:12px">'+(ok?'Tout va bien':'À améliorer')+'</span></div>'+
      (explain?'<div class="scan-more">'+explain+'</div>':'');
    if(explain)d.addEventListener('click',function(){d.classList.toggle('open');});
    list.appendChild(d);
    setTimeout(function(){d.classList.add('in');},40);
    return d;
  }
  function showGauge(score,ctaHref){
    var g=document.getElementById('gauge');g.style.setProperty('--gc',scoreColor(score));
    document.getElementById('scanScore').style.display='block';
    var msg=scoreMsg(score);document.getElementById('scoreMsg').textContent=msg[0];
    document.getElementById('scoreSub').textContent=msg[1];
    if(ctaHref){document.getElementById('scoreCta').setAttribute('href',ctaHref);document.getElementById('scoreCta').setAttribute('target','_blank');}
    // animation du score + de la jauge
    var cur=0;var iv=setInterval(function(){cur+=Math.max(1,Math.round(score/28));if(cur>=score){cur=score;clearInterval(iv);}
      document.getElementById('scoreN').textContent=cur;g.style.setProperty('--gp',cur);},28);
  }
  function resetScan(domain,status){document.getElementById('scanDomain').textContent=domain;
    document.getElementById('scanStatus').textContent=status;document.getElementById('scanList').innerHTML='';
    document.getElementById('scanScore').style.display='none';document.getElementById('scanPulse').style.display='inline-block';}

  // Démo au chargement
  function demo(){
    resetScan('monsite.fr','Analyse en cours…');
    var list=document.getElementById('scanList');
    var items=[['Connexion sécurisée',true],['Site accessible',true],['Certificat valide',true],['Protection à améliorer',false],['2 points à vérifier',false]];
    var i=0;(function next(){if(i<items.length){addItem(list,'',items[i][0],items[i][1],'');i++;setTimeout(next,420);}
      else{document.getElementById('scanStatus').textContent='Analyse terminée';document.getElementById('scanPulse').style.display='none';showGauge(78,null);
        document.getElementById('scoreCta').addEventListener('click',function(e){e.preventDefault();var u=document.getElementById('url');u.scrollIntoView({behavior:'smooth',block:'center'});u.focus();});}})();
  }

  // Vérification réelle
  document.getElementById('f').addEventListener('submit',function(e){
    e.preventDefault();
    var url=document.getElementById('url').value.trim(),btn=document.getElementById('btn'),errEl=document.getElementById('err');
    var domain=url.replace(/^https?:\\/\\//,'').replace(/\\/.*$/,'');
    errEl.style.display='none';btn.disabled=true;
    document.getElementById('scanCard').scrollIntoView({behavior:'smooth',block:'center'});
    resetScan(domain||'votre site','Analyse en cours…');
    fetch('/api/audit/free',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url})})
    .then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});})
    .then(function(o){
      btn.disabled=false;
      if(!o.ok){errEl.style.display='block';errEl.textContent=o.j.error||'Erreur.';resetScan(domain,'Analyse impossible');document.getElementById('scanPulse').style.display='none';return;}
      var j=o.j,list=document.getElementById('scanList');
      var cats=(j.categories||[]).filter(function(c){return CATMAP[c.id]&&!c.degraded;});
      var i=0;(function next(){if(i<cats.length){var c=cats[i],m=CATMAP[c.id];
        addItem(list,m.icon,m.label,c.ok,c.ok?m.ok:m.warn);i++;setTimeout(next,360);}
        else{document.getElementById('scanStatus').textContent='Analyse terminée';document.getElementById('scanPulse').style.display='none';
          showGauge(j.score,j.reportUrl);}})();
    })
    .catch(function(err){btn.disabled=false;errEl.style.display='block';errEl.textContent='Erreur réseau : '+err.message;});
  });

  if(!/intro=1/.test(location.search)) setTimeout(demo,300);
</script>
${fxScript()}
</body></html>`;
}

// ------------------------------------------------------------------
// ESPACE CLIENT (compte + paiement + audits illimités)
// ------------------------------------------------------------------
function dashboardPage() {
  const cards = [
    ['1', 'Créer un compte', `<label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">Votre email</label><input id="email" type="email" placeholder="vous@entreprise.com">
      <button class="btn" style="margin-top:12px;width:100%" onclick="createAccount()">Créer mon compte</button>
      <div id="createOut" style="margin-top:10px;font-size:14px"></div>`],
    ['2', 'Votre clé d\'accès', `<label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">Clé (sk_live_…)</label><input id="key" type="text" placeholder="Collez votre clé ici">
      <button class="btn soft" style="margin-top:12px;width:100%" onclick="checkStatus()">Vérifier mon statut</button>`],
    ['3', 'Débloquer l\'illimité', `<p class="muted" style="font-size:13.5px;margin:0 0 14px">Un seul paiement, accès à vie. Aucun abonnement.</p>
      <button class="btn" style="width:100%" onclick="checkout()">Débloquer · accès à vie</button>
      <div id="payOut" class="muted" style="font-size:12px;margin-top:8px"></div>`],
    ['4', 'Vérifier un site', `<label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">Adresse du site</label><input id="auditUrl" type="url" placeholder="https://site-a-verifier.com">
      <button class="btn" style="margin-top:12px;width:100%" onclick="runAudit()">Lancer la vérification</button>
      <div id="auditResult" style="margin-top:10px;font-size:14px"></div>`],
  ];
  const main = `
    <div class="reveal" style="margin-bottom:18px">
      <h1 style="font-size:28px">Vos vérifications, en toute autonomie</h1>
      <p class="muted" style="margin:6px 0 0">Créez votre compte, débloquez <strong style="color:var(--ink)">une seule fois</strong>, puis vérifiez <strong style="color:var(--ink)">autant de sites que vous voulez, à vie</strong>.</p></div>
    <div class="card reveal" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;margin-bottom:18px">
      <div><span class="muted" style="font-size:11.5px;letter-spacing:.05em;text-transform:uppercase">Statut de l'accès</span>
        <div id="statusText" style="font-weight:700;font-size:16px;margin-top:2px">Non connecté</div></div>
      <span id="statusPill" style="font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.06);color:#9aa3ba">—</span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px">
      ${cards.map(function (c, i) {
        return `<div class="card reveal" style="padding:22px;transition-delay:${i * 60}ms">
          <div style="display:flex;align-items:center;gap:11px;margin-bottom:14px">
            <div style="width:34px;height:34px;border-radius:10px;background:rgba(139,108,255,.14);border:1px solid rgba(139,108,255,.3);color:#c9b8ff;font-weight:800;display:flex;align-items:center;justify-content:center">${c[0]}</div>
            <h3 style="font-size:16.5px">${c[1]}</h3></div>${c[2]}</div>`;
      }).join('')}
    </div>`;
  return `${head('Espace client · ' + NAME)}${shell('verify', main)}
<script>
  var GC=${JSON.stringify(GRADE)};
  function focusScan(){location.href='/';}
  function key(){return document.getElementById('key').value.trim();}
  function setStatus(active,txt){document.getElementById('statusText').textContent=txt;var p=document.getElementById('statusPill');
    if(active){p.textContent='● ACTIF';p.style.background='rgba(34,197,94,.16)';p.style.color='#7ee6a4';}else{p.textContent='● INACTIF';p.style.background='rgba(244,63,94,.16)';p.style.color='#ff9db0';}}
  function createAccount(){var email=document.getElementById('email').value.trim();
    fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email})}).then(function(r){return r.json();}).then(function(j){
      if(j.error){document.getElementById('createOut').innerHTML='<span style="color:#ff9db0">'+j.error+'</span>';return;}
      document.getElementById('createOut').innerHTML='<div class="muted">Votre clé (à copier, affichée une seule fois) :</div><div style="font-family:monospace;font-size:12px;background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:10px;padding:9px;word-break:break-all;margin-top:6px">'+j.apiKey+'</div>';
      document.getElementById('key').value=j.apiKey;});}
  function checkStatus(){fetch('/api/account/status',{headers:{'x-api-key':key()}}).then(function(r){return r.json();}).then(function(j){
      if(j.error){setStatus(false,j.error);return;}var d=j.active?(j.validUntil?('valable jusqu\\'au '+new Date(j.validUntil).toLocaleDateString()):'accès à vie'):'paiement requis';
      setStatus(j.active,(j.email||'')+' · '+(j.auditsCount||0)+' vérification(s) · '+d);});}
  function checkout(){fetch('/api/checkout',{method:'POST',headers:{'x-api-key':key()}}).then(function(r){return r.json();}).then(function(j){
      if(j.checkoutUrl){window.location=j.checkoutUrl;}else{document.getElementById('payOut').innerHTML='<span style="color:#ff9db0">'+(j.error||'Paiement indisponible')+'</span>';}});}
  function runAudit(){var url=document.getElementById('auditUrl').value.trim();var out=document.getElementById('auditResult');out.textContent='⏳ Vérification en cours…';
    fetch('/api/audit',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key()},body:JSON.stringify({url:url})}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});}).then(function(o){
      if(!o.ok){out.innerHTML='<span style="color:#ff9db0">'+(o.j.error||'Erreur')+'</span>';return;}
      out.innerHTML='Niveau de sécurité : <strong style="color:'+(GC[o.j.letter]||'#ccc')+'">'+o.j.score+'/100</strong> — <a style="color:#a9b4ff;font-weight:600" href="'+o.j.reportUrl+'" target="_blank">voir les détails ↗</a>';});}
</script>
${fxScript()}
</body></html>`;
}

module.exports = { NAME, HEADLINE, TAGLINE, ACCENT, GRADE, SEV, CATS, landingPage, dashboardPage, escapeHtml };
