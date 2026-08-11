'use strict';

/**
 * Marque + système de design haut de gamme (pages web).
 *
 * Direction artistique : luxe « tech », palette profonde, verre dépoli
 * (glassmorphism), or champagne, typographie éditoriale. 3D réelle sans
 * aucune dépendance : fond WebGL animé (shader inline) + profondeur CSS 3D
 * (parallaxe à la souris, emblème incliné, cartes en relief).
 *
 * Rebranding en une ligne via variables d'environnement :
 *   BRAND_NAME, BRAND_TAGLINE, BRAND_ACCENT, BRAND_GOLD, BRAND_LOGO
 */

const NAME = process.env.BRAND_NAME || 'Sentinel';
const TAGLINE =
  process.env.BRAND_TAGLINE || 'La sécurité de votre site, révélée avec élégance.';
const LOGO = process.env.BRAND_LOGO || '🛡️';
const ACCENT = process.env.BRAND_ACCENT || '#8b6cff'; // violet
const GOLD = process.env.BRAND_GOLD || '#e6c98f'; // or champagne

const GRADE = { A: '#31d67f', B: '#7be06a', C: '#f5c451', D: '#f79a3c', F: '#f2545b' };
const SEV = { high: '#f2545b', medium: '#f79a3c', low: '#f5c451', info: '#5aa9ff' };

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const DESIGN = `
  :root{
    --accent:${ACCENT}; --gold:${GOLD}; --gold-2:#caa662;
    --bg:#07070e; --bg2:#0b0b17; --ink:#f4f5fb; --muted:#9aa1bd;
    --glass:rgba(255,255,255,.05); --glass-2:rgba(255,255,255,.08);
    --brd:rgba(255,255,255,.14); --radius:18px;
    --serif:ui-serif,Georgia,'Times New Roman',serif;
    --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    --gA:${GRADE.A};--gB:${GRADE.B};--gC:${GRADE.C};--gD:${GRADE.D};--gF:${GRADE.F};
    --sHigh:${SEV.high};--sMed:${SEV.medium};--sLow:${SEV.low};--sInfo:${SEV.info};
  }
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{margin:0;font-family:var(--sans);color:var(--ink);background:var(--bg);
       line-height:1.55;-webkit-font-smoothing:antialiased;overflow-x:hidden}
  a{color:inherit;text-decoration:none}
  /* Fond WebGL + repli CSS luxe */
  #bg{position:fixed;inset:0;width:100%;height:100%;z-index:-2;display:block;
      background:radial-gradient(1200px 800px at 70% -10%,#2a1c5e 0%,transparent 55%),
                 radial-gradient(1000px 700px at 10% 20%,#3a1a4d 0%,transparent 50%),
                 linear-gradient(180deg,#07070e,#0b0b17)}
  #bg-veil{position:fixed;inset:0;z-index:-1;pointer-events:none;
      background:radial-gradient(1200px 700px at 50% 0%,transparent 40%,rgba(4,4,10,.55) 100%)}
  .container{max-width:1120px;margin:0 auto;padding:0 24px}
  /* Verre dépoli */
  .glass{background:var(--glass);backdrop-filter:blur(20px) saturate(140%);
    -webkit-backdrop-filter:blur(20px) saturate(140%);border:1px solid var(--brd);
    border-radius:var(--radius);box-shadow:0 30px 70px -30px rgba(0,0,0,.75),inset 0 1px 0 rgba(255,255,255,.10)}
  /* Boutons */
  .btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:9px;
    border:0;cursor:pointer;font-weight:700;font-size:15px;padding:14px 26px;border-radius:999px;
    color:#fff;background:linear-gradient(135deg,var(--accent),#b58bff);overflow:hidden;
    box-shadow:0 12px 30px -10px var(--accent);transition:transform .18s,box-shadow .18s}
  .btn:hover{transform:translateY(-2px);box-shadow:0 18px 40px -12px var(--accent)}
  .btn:disabled{opacity:.6;cursor:wait;transform:none}
  .btn::after{content:'';position:absolute;top:0;left:-120%;width:60%;height:100%;
    background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent);
    transform:skewX(-18deg);transition:left .6s}
  .btn:hover::after{left:130%}
  .btn.gold{background:linear-gradient(135deg,#f3ddac,var(--gold-2));color:#2a2410;box-shadow:0 12px 30px -10px rgba(230,201,143,.5)}
  .btn.gold:hover{box-shadow:0 18px 44px -12px rgba(230,201,143,.6)}
  .btn.ghost{background:rgba(255,255,255,.06);border:1px solid var(--brd);box-shadow:none;color:var(--ink)}
  .pill{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.03em;
    padding:7px 14px;border-radius:999px;border:1px solid var(--brd);background:rgba(255,255,255,.05)}
  .eyebrow{color:var(--gold);font-size:13px;font-weight:700;letter-spacing:.22em;text-transform:uppercase}
  h1,h2,h3{font-family:var(--serif);font-weight:500;letter-spacing:-.02em;margin:0}
  .muted{color:var(--muted)}
  input{width:100%;padding:15px 17px;border-radius:14px;border:1px solid var(--brd);font-size:15px;
    background:rgba(255,255,255,.06);color:var(--ink);outline:none;transition:.18s}
  input::placeholder{color:#8b90ab}
  input:focus{border-color:var(--accent);box-shadow:0 0 0 4px rgba(139,108,255,.22);background:rgba(255,255,255,.09)}
  label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:7px;letter-spacing:.02em}
  /* Nav */
  .nav{position:sticky;top:0;z-index:20;backdrop-filter:blur(14px);
    background:rgba(7,7,14,.55);border-bottom:1px solid rgba(255,255,255,.08)}
  .nav .in{display:flex;align-items:center;justify-content:space-between;height:70px}
  .brand{display:flex;align-items:center;gap:11px;font-family:var(--serif);font-size:22px;font-weight:600}
  .brand .lg{font-size:24px;filter:drop-shadow(0 4px 12px rgba(139,108,255,.5))}
  .nav a.link{color:var(--muted);font-weight:600;font-size:14px;margin-left:22px}
  .nav a.link:hover{color:var(--ink)}
  /* Reveal au scroll */
  .reveal{opacity:0;transform:translateY(26px);transition:opacity .9s cubic-bezier(.2,.7,.2,1),transform .9s cubic-bezier(.2,.7,.2,1)}
  .reveal.in{opacity:1;transform:none}
  /* Emblème 3D */
  .stage{perspective:1000px}
  .orb{position:relative;width:300px;height:300px;transform-style:preserve-3d;
    transition:transform .2s ease-out;margin:0 auto}
  .orb .disc{position:absolute;inset:0;border-radius:50%;
    background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.14),rgba(139,108,255,.10) 40%,rgba(7,7,14,.2) 70%);
    border:1px solid var(--brd);box-shadow:0 40px 90px -30px rgba(139,108,255,.6),inset 0 1px 0 rgba(255,255,255,.2);
    backdrop-filter:blur(6px)}
  .orb .ring{position:absolute;inset:-18px;border-radius:50%;border:1px solid rgba(230,201,143,.35);
    animation:spin 22s linear infinite}
  .orb .ring.b{inset:26px;border-color:rgba(139,108,255,.35);animation-duration:16s;animation-direction:reverse}
  .orb .sym{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:translateZ(60px)}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
  .floaty{animation:float 6s ease-in-out infinite}
  footer.foot{border-top:1px solid rgba(255,255,255,.08);margin-top:70px;padding:34px 0;color:var(--muted);font-size:13px}
  @media(max-width:820px){.hide-sm{display:none!important}}
`;

// Fond WebGL (shader inline) + repli CSS. Aucune dépendance.
function bgCanvas() {
  return `<canvas id="bg"></canvas><div id="bg-veil"></div>
<script id="frag" type="x-shader/x-fragment">
precision highp float;
uniform float t; uniform vec2 r;
mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
float fbm(vec2 p){float v=0.0,a=0.55;for(int i=0;i<5;i++){v+=a*sin(p.x)*cos(p.y);p=rot(0.7)*p*1.7+vec2(t*0.04);a*=0.55;}return v;}
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*r)/r.y;
  vec2 p=uv*2.1;
  p+=0.5*vec2(fbm(p+t*0.07),fbm(p-t*0.05));
  float f=fbm(p*1.4+t*0.09), g=fbm(p*2.2-t*0.07);
  vec3 deep=vec3(0.027,0.027,0.055);
  vec3 violet=vec3(0.30,0.17,0.62);
  vec3 magenta=vec3(0.52,0.18,0.46);
  vec3 gold=vec3(0.90,0.76,0.48);
  vec3 col=deep;
  col=mix(col,violet,smoothstep(-0.35,0.85,f));
  col=mix(col,magenta,smoothstep(0.15,1.05,g)*0.55);
  col+=gold*smoothstep(0.72,1.02,f*g)*0.30;
  col*=1.0-0.55*dot(uv,uv);
  gl_FragColor=vec4(col,1.0);
}
</script>
<script>
(function(){
  var cv=document.getElementById('bg');var gl=cv.getContext('webgl')||cv.getContext('experimental-webgl');
  if(!gl){return;} // repli CSS déjà en place
  function sh(ty,src){var s=gl.createShader(ty);gl.shaderSource(s,src);gl.compileShader(s);return s;}
  var vs=sh(gl.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}');
  var fs=sh(gl.FRAGMENT_SHADER,document.getElementById('frag').textContent);
  var pr=gl.createProgram();gl.attachShader(pr,vs);gl.attachShader(pr,fs);gl.linkProgram(pr);gl.useProgram(pr);
  var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  var lp=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(lp);gl.vertexAttribPointer(lp,2,gl.FLOAT,false,0,0);
  var ut=gl.getUniformLocation(pr,'t'),ur=gl.getUniformLocation(pr,'r');
  function size(){var d=Math.min(window.devicePixelRatio||1,2);cv.width=innerWidth*d;cv.height=innerHeight*d;gl.viewport(0,0,cv.width,cv.height);}
  window.addEventListener('resize',size);size();
  var t0=Date.now();
  (function loop(){gl.uniform1f(ut,(Date.now()-t0)/1000);gl.uniform2f(ur,cv.width,cv.height);gl.drawArrays(gl.TRIANGLES,0,6);requestAnimationFrame(loop);})();
})();
</script>`;
}

// Parallaxe souris + reveal au scroll + inclinaison de l'emblème.
function fxScript() {
  return `<script>
(function(){
  var reveals=[].slice.call(document.querySelectorAll('.reveal'));
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12});
    reveals.forEach(function(el){io.observe(el);});
  } else { reveals.forEach(function(el){el.classList.add('in');}); }
  var orb=document.querySelector('.orb');
  var layers=[].slice.call(document.querySelectorAll('[data-depth]'));
  window.addEventListener('mousemove',function(e){
    var x=(e.clientX/innerWidth-0.5), y=(e.clientY/innerHeight-0.5);
    if(orb){orb.style.transform='rotateY('+(x*22)+'deg) rotateX('+(-y*22)+'deg)';}
    layers.forEach(function(el){var d=parseFloat(el.getAttribute('data-depth'))||0;
      el.style.transform='translate('+(x*d*26)+'px,'+(y*d*26)+'px)';});
  });
})();
</script>`;
}

function head(title) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>${DESIGN}</style></head>`;
}

function nav(active) {
  return `<nav class="nav"><div class="container in">
    <a class="brand" href="/"><span class="lg">${LOGO}</span>${escapeHtml(NAME)}</a>
    <div>
      <a class="link" href="/"${active === 'home' ? ' style="color:var(--ink)"' : ''}>Analyse gratuite</a>
      <a class="link" href="/app"${active === 'app' ? ' style="color:var(--ink)"' : ''}>Espace client</a>
    </div>
  </div></nav>`;
}

function footer() {
  return `<footer class="foot"><div class="container">
    ${LOGO} <strong style="font-family:var(--serif)">${escapeHtml(NAME)}</strong> — audit passif, non intrusif. Résultat indicatif, aucune requête agressive.
  </div></footer>`;
}

const SHIELD_SVG = `<svg width="150" height="150" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 12px 30px rgba(139,108,255,.55))">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c9b3ff"/><stop offset="1" stop-color="#8b6cff"/>
    </linearGradient>
    <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f3ddac"/><stop offset="1" stop-color="#caa662"/>
    </linearGradient>
  </defs>
  <path d="M50 8 L82 20 V46 C82 68 68 84 50 92 C32 84 18 68 18 46 V20 Z" fill="url(#g1)" opacity="0.18"/>
  <path d="M50 8 L82 20 V46 C82 68 68 84 50 92 C32 84 18 68 18 46 V20 Z" stroke="url(#g1)" stroke-width="1.6"/>
  <path d="M35 49 L46 60 L67 37" stroke="url(#g2)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// ------------------------------------------------------------------
// PAGE D'ACCUEIL
// ------------------------------------------------------------------
function landingPage() {
  const modules = [
    ['🔒', 'SSL / TLS', 'Certificat, protocole, chiffrement'],
    ['🧱', 'En-têtes HTTP', 'HSTS, CSP, anti-clickjacking'],
    ['📁', 'Fichiers exposés', '.git, .env, sauvegardes'],
    ['🦠', 'Réputation', 'Blacklists & anti-malware'],
    ['🧩', 'Technologies & CVE', 'Failles connues de la stack'],
    ['⚖️', 'Conformité RGPD', 'Cookies, traceurs, mentions'],
  ];
  const steps = [
    ['I', 'Entrez votre URL', 'Aucune installation, aucune requête intrusive.'],
    ['II', 'Analyse passive', 'Six familles de contrôles, en 30 secondes.'],
    ['III', 'Recevez la note', 'Un rapport clair, en français, partageable.'],
  ];
  return `${head(TAGLINE + ' · ' + NAME)}<body>
${bgCanvas()}
${nav('home')}

<section style="position:relative;padding:70px 0 40px">
  <div class="container" style="display:grid;grid-template-columns:1.15fr .85fr;gap:40px;align-items:center">
    <div>
      <div class="eyebrow reveal" data-depth="0.5" style="margin-bottom:18px">Audit de sécurité web · passif</div>
      <h1 class="reveal" style="font-size:56px;line-height:1.05;margin-bottom:20px" data-depth="0.8">
        ${escapeHtml(TAGLINE)}
      </h1>
      <p class="muted reveal" style="font-size:19px;max-width:520px;margin:0 0 30px" data-depth="0.4">
        SSL, en-têtes, fichiers exposés, réputation, technologies vulnérables et
        conformité RGPD — évalués en un instant, sans jamais toucher à votre serveur.
      </p>
      <div class="glass reveal" style="padding:16px;max-width:560px" data-depth="0.3">
        <form id="f" style="display:flex;gap:10px;flex-wrap:wrap">
          <input id="url" type="url" placeholder="https://votre-site.com" required style="flex:1 1 280px">
          <button class="btn gold" id="btn" type="submit">Analyser</button>
        </form>
        <div id="spin" class="muted" style="display:none;padding:10px 4px 2px">⏳ Analyse en cours…</div>
        <div id="err" style="display:none;padding:10px 4px 2px;color:#ffb4b4;font-size:14px"></div>
      </div>
      <div class="muted reveal" style="font-size:13px;margin-top:16px;letter-spacing:.02em">
        ✦ Gratuit &nbsp; ✦ Sans inscription &nbsp; ✦ Sans impact sur votre site
      </div>

      <div id="res" class="glass" style="display:none;padding:22px;max-width:560px;margin-top:22px">
        <div style="display:flex;align-items:center;gap:20px">
          <div id="grade" style="width:92px;height:92px;border-radius:20px;display:flex;align-items:center;
            justify-content:center;font-size:52px;font-weight:800;font-family:var(--serif);color:#0a0a12;flex:0 0 auto;
            box-shadow:0 16px 40px -12px rgba(0,0,0,.6)"></div>
          <div><div id="score" style="font-size:26px;font-weight:800;font-family:var(--serif)"></div>
            <div id="meaning" class="muted"></div></div>
        </div>
        <div id="stats" style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap"></div>
        <div id="actions" style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap"></div>
      </div>
    </div>

    <div class="stage hide-sm" data-depth="1.2">
      <div class="orb floaty">
        <div class="ring"></div><div class="ring b"></div>
        <div class="disc"></div>
        <div class="sym">${SHIELD_SVG}</div>
      </div>
    </div>
  </div>
</section>

<section style="padding:60px 0 20px">
  <div class="container">
    <div class="eyebrow reveal" style="text-align:center;margin-bottom:10px">Ce que l'on révèle</div>
    <h2 class="reveal" style="font-size:34px;text-align:center;margin-bottom:38px">Six regards sur votre sécurité</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px">
      ${modules.map(function (m, i) {
        return `<div class="glass reveal" style="padding:24px;transition-delay:${i * 60}ms">
          <div style="font-size:26px">${m[0]}</div>
          <div style="font-family:var(--serif);font-size:19px;margin:10px 0 4px">${m[1]}</div>
          <div class="muted" style="font-size:14px">${m[2]}</div></div>`;
      }).join('')}
    </div>
  </div>
</section>

<section style="padding:56px 0">
  <div class="container">
    <div class="eyebrow reveal" style="text-align:center;margin-bottom:10px">Le parcours</div>
    <h2 class="reveal" style="font-size:34px;text-align:center;margin-bottom:38px">Trois gestes, une évidence</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px">
      ${steps.map(function (s, i) {
        return `<div class="glass reveal" style="padding:26px;text-align:center;transition-delay:${i * 80}ms">
          <div style="font-family:var(--serif);font-size:26px;color:var(--gold);border:1px solid var(--brd);
            width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px">${s[0]}</div>
          <div style="font-family:var(--serif);font-size:19px;margin-bottom:6px">${s[1]}</div>
          <div class="muted" style="font-size:14px">${s[2]}</div></div>`;
      }).join('')}
    </div>
    <div class="glass reveal" style="padding:40px;text-align:center;margin-top:44px">
      <h2 style="font-size:30px;margin-bottom:10px">L'accès illimité, une fois pour toutes</h2>
      <p class="muted" style="max-width:520px;margin:0 auto 22px">Auditez tous vos sites, autant de fois que vous le souhaitez, à vie. Un paiement unique, aucun abonnement.</p>
      <a class="btn gold" href="/app">Obtenir l'accès illimité →</a>
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
      var j=o.j, g=document.getElementById('grade');
      g.textContent=j.letter; g.style.background='linear-gradient(135deg,#fff,'+(GRADE[j.letter]||'#888')+')';
      document.getElementById('score').textContent=j.score+' / 100';
      document.getElementById('meaning').textContent=j.meaning;
      var s=j.findingsSummary||{};
      document.getElementById('stats').innerHTML=['high','medium','low','info'].map(function(k){
        return '<div style="background:'+SEV[k]+';color:#0a0a12;border-radius:12px;padding:8px 13px;text-align:center;min-width:66px;font-weight:700">'+
          '<div style="font-size:19px">'+(s[k]||0)+'</div><div style="font-size:11px;text-transform:uppercase;opacity:.85">'+SEVLABEL[k]+'</div></div>';
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
${fxScript()}
</body></html>`;
}

// ------------------------------------------------------------------
// ESPACE CLIENT
// ------------------------------------------------------------------
function dashboardPage() {
  const cards = [
    ['I', 'Créer un compte', `<label>Votre email</label>
      <input id="email" type="email" placeholder="vous@entreprise.com">
      <button class="btn" style="margin-top:14px;width:100%" onclick="createAccount()">Créer mon compte</button>
      <div id="createOut" style="margin-top:10px;font-size:14px"></div>`],
    ['II', 'Votre clé d\'accès', `<label>Clé (sk_live_…)</label>
      <input id="key" type="text" placeholder="Collez votre clé ici">
      <button class="btn ghost" style="margin-top:14px;width:100%" onclick="checkStatus()">Vérifier mon statut</button>`],
    ['III', 'Payer une fois — à vie', `<p class="muted" style="font-size:14px;margin:0 0 16px">Paiement unique et sécurisé. Aucun abonnement, aucune reconduction.</p>
      <button class="btn gold" style="width:100%" onclick="checkout()">Payer · accès à vie</button>
      <div id="payOut" class="muted" style="font-size:12px;margin-top:8px"></div>`],
    ['IV', 'Auditer (illimité)', `<label>URL à auditer</label>
      <input id="auditUrl" type="url" placeholder="https://site-a-auditer.com">
      <button class="btn" style="margin-top:14px;width:100%" onclick="runAudit()">Lancer l'audit</button>
      <div id="auditResult" style="margin-top:10px;font-size:14px"></div>`],
  ];
  return `${head('Espace client · ' + NAME)}<body>
${bgCanvas()}
${nav('app')}

<section style="padding:56px 0 20px">
  <div class="container" style="max-width:900px">
    <div class="eyebrow reveal" style="margin-bottom:12px">Espace client</div>
    <h1 class="reveal" style="font-size:40px;margin-bottom:10px">Vos audits, en toute autonomie</h1>
    <p class="muted reveal" style="margin:0 0 20px">Créez votre compte, réglez <strong style="color:var(--ink)">une seule fois</strong>, puis auditez <strong style="color:var(--ink)">sans limite, à vie</strong>.</p>

    <div class="glass reveal" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 22px;margin:18px 0 24px">
      <div><span class="muted" style="font-size:12px;letter-spacing:.04em;text-transform:uppercase">Statut de l'accès</span>
        <div id="statusText" style="font-family:var(--serif);font-size:18px;margin-top:2px">Non connecté</div></div>
      <span id="statusPill" class="pill">—</span>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:18px">
      ${cards.map(function (c, i) {
        return `<div class="glass reveal" style="padding:26px;transition-delay:${i * 70}ms">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
            <div style="font-family:var(--serif);color:var(--gold);border:1px solid var(--brd);width:40px;height:40px;
              border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px">${c[0]}</div>
            <h3 style="font-size:18px">${c[1]}</h3></div>
          ${c[2]}</div>`;
      }).join('')}
    </div>
  </div>
</section>

${footer()}
<script>
  var GC={A:'#31d67f',B:'#7be06a',C:'#f5c451',D:'#f79a3c',F:'#f2545b'};
  function key(){return document.getElementById('key').value.trim();}
  function setStatus(active,txt){
    document.getElementById('statusText').textContent=txt;
    var p=document.getElementById('statusPill');
    if(active){p.textContent='● ACTIF';p.style.borderColor='rgba(49,214,127,.5)';p.style.color='#7bffb0';}
    else{p.textContent='● INACTIF';p.style.borderColor='rgba(242,84,91,.5)';p.style.color='#ff9d9d';}
  }
  function createAccount(){
    var email=document.getElementById('email').value.trim();
    fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email})})
    .then(function(r){return r.json();}).then(function(j){
      if(j.error){document.getElementById('createOut').innerHTML='<span style="color:#ff9d9d">'+j.error+'</span>';return;}
      document.getElementById('createOut').innerHTML='<div class="muted">Votre clé (à copier, affichée une seule fois) :</div>'+
        '<div style="font-family:monospace;font-size:12px;background:rgba(255,255,255,.06);border:1px solid var(--brd);'+
        'border-radius:10px;padding:10px;word-break:break-all;margin-top:6px">'+j.apiKey+'</div>';
      document.getElementById('key').value=j.apiKey;
    });
  }
  function checkStatus(){
    fetch('/api/account/status',{headers:{'x-api-key':key()}}).then(function(r){return r.json();}).then(function(j){
      if(j.error){setStatus(false,j.error);return;}
      var d=j.active?(j.validUntil?('valable jusqu\\'au '+new Date(j.validUntil).toLocaleDateString()):'accès à vie'):'paiement requis';
      setStatus(j.active,(j.email||'')+' · '+(j.auditsCount||0)+' audit(s) · '+d);
    });
  }
  function checkout(){
    fetch('/api/checkout',{method:'POST',headers:{'x-api-key':key()}}).then(function(r){return r.json();}).then(function(j){
      if(j.checkoutUrl){window.location=j.checkoutUrl;}
      else{document.getElementById('payOut').innerHTML='<span style="color:#ff9d9d">'+(j.error||'Paiement indisponible')+'</span>';}
    });
  }
  function runAudit(){
    var url=document.getElementById('auditUrl').value.trim();
    var out=document.getElementById('auditResult'); out.textContent='⏳ Analyse en cours…';
    fetch('/api/audit',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key()},body:JSON.stringify({url:url})})
    .then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});}).then(function(o){
      if(!o.ok){out.innerHTML='<span style="color:#ff9d9d">'+(o.j.error||'Erreur')+'</span>';return;}
      out.innerHTML='Note <strong style="color:'+(GC[o.j.letter]||'#ccc')+'">'+o.j.letter+'</strong> ('+o.j.score+'/100) — '+
        '<a style="color:var(--gold);font-weight:600" href="'+o.j.reportUrl+'" target="_blank">rapport ↗</a> · '+o.j.auditsCount+' audits';
    });
  }
</script>
${fxScript()}
</body></html>`;
}

module.exports = { NAME, TAGLINE, LOGO, ACCENT, GOLD, GRADE, SEV, landingPage, dashboardPage, escapeHtml };
