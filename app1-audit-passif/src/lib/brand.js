'use strict';

/**
 * Marque IXAUDIT — identité visuelle « SentinelScope » (sombre, premium,
 * futuriste). Fond profond, accents vert / cyan / violet, typographie Inter,
 * pictogrammes SVG originaux (aucun emoji), animations sobres au scroll.
 *
 * Le front est rendu en HTML/CSS/JS natif (zéro dépendance) et branché sur le
 * VRAI moteur d'audit (POST /api/audit/free) : l'utilisateur saisit l'URL de
 * son site et un audit réel est lancé (TLS, en-têtes, fichiers exposés,
 * réputation, CVE, RGPD), avec un score A/B/C/D/F et un rapport partageable.
 *
 * Rebranding via env : BRAND_NAME, BRAND_HEADLINE, BRAND_TAGLINE, BRAND_FONT.
 */

const NAME = process.env.BRAND_NAME || 'IXAUDIT';
const HEADLINE = process.env.BRAND_HEADLINE || 'Votre site est-il vraiment sécurisé ?';
const TAGLINE =
  process.env.BRAND_TAGLINE ||
  'Entrez l\'adresse de votre site et obtenez en quelques minutes un audit de sécurité clair : un score, les vulnérabilités détectées et les actions à mener — sans installation.';
const USER = process.env.BRAND_USER || 'Aymerick';

// Palette SentinelScope
const C = {
  bg: '#07090D', bg2: '#0D1118', card: '#121821', ink: '#F5F7FA', muted: '#8B98A8',
  green: '#A7F36B', cyan: '#57E6D1', violet: '#8D7CFF',
  critical: '#F4576B', high: '#FF9715', medium: '#F5C451',
};
const GRADE = { A: C.green, B: C.cyan, C: C.medium, D: C.high, F: C.critical };
const SEV = { high: C.critical, medium: C.high, low: C.medium, info: C.cyan };

// Catégories vérifiées (avec pictogramme + accent, sans emoji).
const CATS = [
  { id: 'A1', pic: 'lock', acc: C.cyan, label: 'Connexion sécurisée', tech: 'Certificat SSL/TLS',
    ok: 'Votre site utilise une connexion chiffrée. Vos visiteurs naviguent en sécurité.',
    warn: 'La connexion de votre site pourrait être mieux sécurisée.' },
  { id: 'A2', pic: 'shield', acc: C.violet, label: 'Protection du site', tech: 'En-têtes HTTP de sécurité',
    ok: 'Votre site est protégé contre plusieurs attaques courantes.',
    warn: 'Des protections manquent : votre site est plus exposé à certaines attaques.' },
  { id: 'A3', pic: 'folder', acc: C.green, label: 'Fichiers privés', tech: 'Fichiers sensibles exposés',
    ok: 'Aucun fichier sensible n\'est accessible publiquement.',
    warn: 'Des fichiers qui devraient rester privés pourraient être accessibles.' },
  { id: 'B', pic: 'globe', acc: C.cyan, label: 'Réputation en ligne', tech: 'Réputation / listes noires',
    ok: 'Votre site n\'est pas signalé comme dangereux.',
    warn: 'Votre site pourrait être signalé : cela nuit à votre image et à votre référencement.' },
  { id: 'C', pic: 'alert', acc: C.violet, label: 'Failles connues', tech: 'Vulnérabilités (CVE)',
    ok: 'Aucune faille connue détectée sur vos technologies.',
    warn: 'Des failles connues ont été détectées : elles peuvent être exploitées.' },
  { id: 'D', pic: 'privacy', acc: C.green, label: 'Protection des données', tech: 'Conformité RGPD / cookies',
    ok: 'Vos visiteurs sont informés et leurs données sont mieux protégées.',
    warn: 'La protection des données de vos visiteurs peut être améliorée (RGPD).' },
];

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ */
/* Pictogrammes SVG originaux (trait 2px, coins arrondis, 1 accent).   */
/* ------------------------------------------------------------------ */
function picto(name, color) {
  const a = color || C.cyan;
  const o = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const svg = {
    radar: `<circle cx="12" cy="12" r="8.5" opacity=".35" ${o}/><circle cx="12" cy="12" r="4.5" opacity=".6" ${o}/><path d="M12 12 19 7" ${o}/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="17.6" cy="8.2" r="1.7" fill="${a}"/>`,
    lock: `<rect x="5" y="10.5" width="14" height="9" rx="2.2" ${o}/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9" ${o}/><circle cx="12" cy="14.6" r="1.4" fill="${a}"/><path d="M12 15.6v1.6" stroke="${a}" stroke-width="2" stroke-linecap="round"/>`,
    shield: `<path d="M12 3 5 5.8v4.9c0 4.3 3 7.2 7 8.5 4-1.3 7-4.2 7-8.5V5.8z" ${o}/><path d="M9.2 12l2 2 3.7-3.9" stroke="${a}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    folder: `<path d="M3.5 7.5a2 2 0 0 1 2-2h3l2 2h6a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z" ${o}/><rect x="10" y="12.4" width="4" height="3.4" rx="1" stroke="${a}" stroke-width="2" fill="none"/><path d="M11 12.4v-.8a1 1 0 0 1 2 0v.8" stroke="${a}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    globe: `<circle cx="12" cy="12" r="8.5" ${o}/><path d="M3.6 12h16.8" ${o}/><path d="M12 3.6c2.8 2.6 2.8 14.2 0 16.8" ${o}/><path d="M12 3.6c-2.8 2.6-2.8 14.2 0 16.8" ${o}/><circle cx="12" cy="12" r="1.2" fill="${a}"/>`,
    alert: `<path d="M12 3 5 5.8v4.9c0 4.3 3 7.2 7 8.5 4-1.3 7-4.2 7-8.5V5.8z" ${o}/><path d="M12 8.4v3.7" stroke="${a}" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="15" r="1" fill="${a}"/>`,
    privacy: `<path d="M6 3.5h9l3 3V17a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 17V5A1.5 1.5 0 0 1 6 3.5z" ${o}/><path d="M14.5 3.5V7h3.5" opacity=".5" ${o}/><path d="M8 12.6l1.7 1.7 3.4-3.6" stroke="${a}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    scan: `<rect x="3" y="4.5" width="18" height="15" rx="2.4" ${o}/><path d="M3 8.5h18" ${o}/><path d="M6.5 15.5h11" stroke="${a}" stroke-width="2" stroke-linecap="round"/><path d="M6.5 12.5h6" opacity=".5" ${o}/>`,
    list: `<path d="M4.5 7h8" ${o}/><path d="M4.5 12h5.5" opacity=".7" ${o}/><path d="M4.5 17h3.5" opacity=".5" ${o}/><path d="M16.5 5.5v13" ${o}/><path d="M16.5 5.5 20 7.2l-3.5 1.7z" fill="${a}" stroke="${a}"/>`,
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" style="color:${a}">${svg[name] || svg.shield}</svg>`;
}

function logo(size) {
  const s = size || 30;
  return `<span class="logo" style="width:${s}px;height:${s}px">${picto('radar', C.cyan)}</span>`;
}

/* ------------------------------------------------------------------ */
/* Design                                                              */
/* ------------------------------------------------------------------ */
const DESIGN = `
  :root{
    --bg:${C.bg};--bg2:${C.bg2};--card:${C.card};--ink:${C.ink};--muted:${C.muted};
    --green:${C.green};--cyan:${C.cyan};--violet:${C.violet};
    --high:${C.high};--medium:${C.medium};
    --ok:${C.green};--warn:${C.high};--bad:${C.critical};
    --line:rgba(255,255,255,.08);--line-2:rgba(255,255,255,.16);
    --sans:var(--font,'Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif);
  }
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{margin:0;font-family:var(--sans);color:var(--ink);background:var(--bg);line-height:1.5;
    -webkit-font-smoothing:antialiased;font-size:15px;overflow-x:hidden}
  a{color:inherit;text-decoration:none}
  svg{width:100%;height:100%;display:block}
  .num{font-variant-numeric:tabular-nums}
  .muted{color:var(--muted)}
  .wrap{max-width:1180px;margin:0 auto;padding:0 28px}
  .grad{background:linear-gradient(100deg,var(--green),var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent}
  .gradv{background:linear-gradient(100deg,var(--violet),var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent}
  .bggrid{position:absolute;inset:0;z-index:-1;pointer-events:none;
    background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);
    background-size:56px 56px;-webkit-mask-image:radial-gradient(ellipse 80% 60% at 50% 0%,#000 40%,transparent 100%);
    mask-image:radial-gradient(ellipse 80% 60% at 50% 0%,#000 40%,transparent 100%)}
  .logo{display:inline-grid;place-items:center;border-radius:9px;background:linear-gradient(135deg,rgba(141,124,255,.3),rgba(87,230,209,.2));
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.1);padding:6px}
  .logo svg{width:100%;height:100%}
  /* Bouton */
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;cursor:pointer;font-family:var(--sans);
    font-weight:600;font-size:15px;padding:13px 22px;border-radius:999px;color:#fff;
    background:linear-gradient(135deg,var(--violet),#6b5cff);box-shadow:0 16px 40px -16px rgba(141,124,255,.8);transition:.2s}
  .btn:hover{transform:translateY(-2px);box-shadow:0 22px 50px -16px rgba(141,124,255,.9)}
  .btn:disabled{opacity:.7;cursor:wait;transform:none}
  .btn.soft{background:rgba(255,255,255,.04);color:var(--ink);border:1px solid var(--line-2);box-shadow:none}
  .btn.soft:hover{background:rgba(255,255,255,.08)}
  input{width:100%;padding:14px 16px;border:1px solid var(--line-2);border-radius:999px;font-size:15px;
    background:rgba(255,255,255,.03);color:var(--ink);outline:none;font-family:var(--sans)}
  input::placeholder{color:rgba(139,152,168,.7)}
  input:focus{border-color:rgba(141,124,255,.5);box-shadow:0 0 0 3px rgba(141,124,255,.25)}
  .eyebrow{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
  h1,h2,h3{margin:0;letter-spacing:-.02em}
  /* Pastille de section */
  .pill{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:999px;
    padding:7px 14px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:var(--cyan);background:rgba(255,255,255,.03)}
  .pill .dot{width:6px;height:6px;border-radius:50%;background:var(--cyan);box-shadow:0 0 10px var(--cyan)}
  /* Navbar */
  .nav2{position:fixed;inset:0 0 auto 0;z-index:50;transition:.3s;border-bottom:1px solid transparent}
  .nav2.on{background:rgba(7,9,13,.72);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}
  .nav2 .in{display:flex;align-items:center;justify-content:space-between;height:64px;max-width:1180px;margin:0 auto;padding:0 28px}
  .brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:18px}
  .brand b{color:var(--cyan);font-weight:800}
  .navlinks{display:flex;gap:4px}
  .navlinks a{color:var(--muted);font-weight:500;font-size:14px;padding:8px 14px;border-radius:999px;transition:.2s}
  .navlinks a:hover{color:var(--ink)}
  .navcta{display:flex;align-items:center;gap:14px}
  .navcta .login{color:var(--muted);font-weight:500;font-size:14px}
  .navcta .login:hover{color:var(--ink)}
  .burger{display:none;width:40px;height:40px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--ink);cursor:pointer;place-items:center}
  /* Hero */
  .hero{position:relative;overflow:hidden;padding:132px 0 72px}
  .halo{position:absolute;pointer-events:none;border-radius:50%;filter:blur(40px)}
  .halo.v{left:50%;top:-12%;width:820px;height:560px;transform:translateX(-50%);background:radial-gradient(circle,rgba(141,124,255,.22),transparent 60%);animation:pulse 14s ease-in-out infinite}
  .halo.c{right:6%;top:26%;width:380px;height:380px;background:radial-gradient(circle,rgba(87,230,209,.12),transparent 65%)}
  @keyframes pulse{0%,100%{opacity:.5;transform:translateX(-50%) scale(1)}50%{opacity:.8;transform:translateX(-50%) scale(1.06)}}
  .herogrid{display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center}
  .h1big{font-size:clamp(36px,6vw,72px);line-height:1.04;font-weight:800;margin:22px 0 20px}
  .lead{color:var(--muted);font-size:18px;line-height:1.6;max-width:520px;margin:0 0 30px}
  .auditbar{display:flex;gap:12px;max-width:540px}
  .auditbar .field{position:relative;flex:1}
  .auditbar .field svg.mag{position:absolute;left:16px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--muted)}
  .auditbar input{padding-left:44px;height:54px}
  .auditbar .btn{height:54px;white-space:nowrap}
  .trustline{color:var(--muted);font-size:14px;margin-top:14px}
  .errbox{display:none;margin-top:12px;color:var(--bad);font-size:14px}
  /* Panneau de scan (dashboard live) */
  .panel{background:rgba(18,24,33,.8);border:1px solid var(--line);border-radius:20px;padding:22px;backdrop-filter:blur(18px);box-shadow:0 30px 80px -40px rgba(0,0,0,.9)}
  .panel.glow{box-shadow:0 0 60px -12px rgba(141,124,255,.45),0 30px 80px -40px rgba(0,0,0,.9)}
  .panel-head{display:flex;align-items:center;justify-content:space-between;padding-bottom:14px;border-bottom:1px solid var(--line)}
  .panel-head .d{font-weight:600;font-family:ui-monospace,Menlo,monospace;font-size:13px}
  .panel-head .s{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--green);background:rgba(167,243,107,.1);border-radius:999px;padding:5px 10px}
  .panel-head .s .ld{width:6px;height:6px;border-radius:50%;background:var(--green);animation:blink 1.4s infinite}
  @keyframes blink{50%{opacity:.35}}
  #scanList{margin-top:6px}
  .row{display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid var(--line);opacity:0;transform:translateX(-8px);transition:.35s}
  .row.in{opacity:1;transform:none}
  .row .mk{width:20px;height:20px;flex:0 0 auto;display:grid;place-items:center;border-radius:6px;font-weight:800;font-size:12px}
  .mk.ok{color:var(--green);background:rgba(167,243,107,.14)}
  .mk.warn{color:var(--high);background:rgba(255,151,21,.14)}
  .row .rl{flex:1;font-size:14px}
  .row .rs{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
  .score{margin-top:18px;padding-top:16px;border-top:1px solid var(--line)}
  .score-flex{display:flex;align-items:center;gap:20px}
  .gauge{width:104px;height:104px;border-radius:50%;flex:0 0 auto;display:grid;place-items:center;
    background:conic-gradient(var(--gc,var(--cyan)) calc(var(--gp,0)*1%),rgba(255,255,255,.08) 0);transition:background .3s}
  .gauge .gin{width:80px;height:80px;border-radius:50%;background:var(--bg2);display:flex;flex-direction:column;align-items:center;justify-content:center}
  .score-n{font-size:28px;font-weight:800;line-height:1}
  .score-o{color:var(--muted);font-size:11px;margin-top:2px}
  .score-msg{font-weight:700;font-size:15px}
  .score .btn{margin-top:12px;padding:11px 18px;font-size:14px}
  /* Bandeau confiance */
  .stats{border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:rgba(13,17,24,.4);padding:40px 0}
  .statgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;margin-top:26px;border-top:1px solid var(--line);padding-top:26px}
  .stat{text-align:center}
  .stat .n{font-size:34px;font-weight:800}
  .stat .l{color:var(--muted);font-size:14px;margin-top:4px}
  .logos{display:flex;flex-wrap:wrap;justify-content:center;gap:36px}
  .logos span{font-size:18px;font-weight:700;color:rgba(139,152,168,.7)}
  /* Sections */
  section.blk{padding:88px 0}
  .center{text-align:center;max-width:640px;margin:0 auto}
  .h2big{font-size:clamp(28px,4vw,52px);line-height:1.12;font-weight:700;margin:20px 0 14px}
  .sublead{color:var(--muted);font-size:18px}
  /* Cartes fonctionnalités */
  .fgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:56px}
  .fcard{position:relative;border:1px solid var(--line);background:rgba(18,24,33,.6);border-radius:20px;padding:26px;transition:.3s}
  .fcard:hover{transform:translateY(-4px);border-color:var(--line-2)}
  .fico{width:52px;height:52px;border-radius:14px;display:grid;place-items:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.05);transition:.3s}
  .fico svg{width:26px;height:26px}
  .fcard:hover .fico{transform:translateY(-3px)}
  .fcard h3{font-size:18px;font-weight:600;margin:18px 0 8px}
  .fcard p{color:var(--muted);font-size:14px;line-height:1.6;margin:0}
  /* Comment ça marche */
  .how{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center}
  .steps{position:relative;margin-top:36px;padding-left:26px}
  .steps .line{position:absolute;left:10px;top:8px;bottom:8px;width:1px;background:linear-gradient(to bottom,var(--cyan),var(--violet),var(--green))}
  .step{position:relative;padding-bottom:30px}
  .step:last-child{padding-bottom:0}
  .step .dot{position:absolute;left:-26px;top:2px;width:20px;height:20px;border-radius:50%;border:1px solid var(--line);background:var(--bg2);display:grid;place-items:center}
  .step .dot i{width:8px;height:8px;border-radius:50%;background:var(--cyan);box-shadow:0 0 8px var(--cyan)}
  .step .st{display:flex;align-items:center;gap:10px;font-weight:600;font-size:18px}
  .step .st svg{width:20px;height:20px;color:var(--cyan)}
  .step p{color:var(--muted);font-size:14px;margin:6px 0 0}
  /* Sécurité */
  .seccompli{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center}
  .shieldwrap{position:relative;aspect-ratio:1;max-width:420px;margin:0 auto;display:grid;place-items:center}
  .shieldwrap .ring{position:absolute;border:1px solid var(--line);border-radius:50%}
  .shieldwrap .halo3{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(87,230,209,.14),transparent 65%);filter:blur(40px)}
  .shieldcore{position:relative;width:112px;height:112px;border-radius:26px;border:1px solid rgba(87,230,209,.3);background:rgba(18,24,33,.8);display:grid;place-items:center;box-shadow:0 0 60px -14px rgba(87,230,209,.4)}
  .shieldcore svg{width:52px;height:52px;color:var(--cyan)}
  .badges{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
  .badge{display:inline-flex;align-items:center;gap:9px;border:1px solid var(--line);background:rgba(255,255,255,.03);border-radius:999px;padding:9px 16px;font-size:14px;font-weight:500}
  .badge svg{width:16px;height:16px;color:var(--green)}
  /* FAQ */
  .faq{max-width:760px;margin:0 auto}
  .qa{border-bottom:1px solid var(--line)}
  .qa .q{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 4px;cursor:pointer;font-weight:600;font-size:17px}
  .qa .q .chev{flex:0 0 auto;width:32px;height:32px;border-radius:50%;border:1px solid var(--line);display:grid;place-items:center;color:var(--muted);transition:.3s}
  .qa.open .q .chev{transform:rotate(180deg)}
  .qa .a{max-height:0;overflow:hidden;color:var(--muted);font-size:15px;line-height:1.6;transition:max-height .3s ease,padding .3s ease;padding:0 46px 0 4px}
  .qa.open .a{max-height:280px;padding-bottom:20px}
  /* CTA final */
  .ctabox{position:relative;overflow:hidden;text-align:center;padding:110px 0}
  /* Footer */
  .foot3{border-top:1px solid var(--line);background:rgba(13,17,24,.4);padding:56px 0 34px}
  .footgrid{display:grid;grid-template-columns:1.4fr repeat(4,1fr);gap:40px}
  .footgrid h4{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:rgba(245,247,250,.8);margin:0 0 16px}
  .footgrid a{display:block;color:var(--muted);font-size:14px;padding:5px 0}
  .footgrid a:hover{color:var(--ink)}
  .footbot{display:flex;justify-content:space-between;flex-wrap:wrap;gap:14px;border-top:1px solid var(--line);margin-top:40px;padding-top:26px;color:var(--muted);font-size:14px}
  .reveal{opacity:0;transform:translateY(16px);transition:.6s cubic-bezier(.2,.7,.2,1)}
  .reveal.in{opacity:1;transform:none}
  /* App / espace client (réutilise les tokens) */
  .app{max-width:1180px;margin:0 auto;padding:96px 28px 60px}
  .card2{border:1px solid var(--line);background:rgba(18,24,33,.6);border-radius:18px;padding:22px}
  .kbd{font-family:ui-monospace,Menlo,monospace;font-size:12px;background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:8px;padding:9px;word-break:break-all}
  @media(max-width:920px){
    .herogrid,.how,.seccompli,.footgrid{grid-template-columns:1fr}
    .fgrid{grid-template-columns:1fr 1fr}.statgrid{grid-template-columns:1fr 1fr}
    .navlinks,.navcta{display:none}.burger{display:grid}
    .hero{padding:104px 0 56px}.auditbar{flex-direction:column}.auditbar .btn{width:100%}
    .footgrid{grid-template-columns:1fr 1fr}
  }
  @media(max-width:560px){.fgrid{grid-template-columns:1fr}}
  @media(prefers-reduced-motion:reduce){*{animation-duration:.001ms!important;transition-duration:.001ms!important}}
`;

/* ------------------------------------------------------------------ */
/* Polices (Inter auto-hébergée)                                       */
/* ------------------------------------------------------------------ */
const FONTS = {
  system: { label: 'Système', family: null },
  inter: { label: 'Inter', family: 'Inter' },
  manrope: { label: 'Manrope', family: 'Manrope' },
  sora: { label: 'Sora', family: 'Sora' },
  space: { label: 'Space Grotesk', family: 'Space Grotesk' },
};
const DEFAULT_FONT = process.env.BRAND_FONT || 'inter';

function fontCss(fontKey) {
  const key = FONTS[fontKey] ? fontKey : DEFAULT_FONT;
  const f = FONTS[key] || FONTS.system;
  if (!f.family) {
    return `<style>:root{--font:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}</style>`;
  }
  const faces = [400, 600, 700].map((w) =>
    `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${w};font-display:swap;src:url('/assets/${key}-${w}.woff2') format('woff2')}`
  ).join('');
  // 800 réutilise le fichier 700 (rendu extra-bold).
  const extra = `@font-face{font-family:'${f.family}';font-style:normal;font-weight:800;font-display:swap;src:url('/assets/${key}-700.woff2') format('woff2')}`;
  return `<style>${faces}${extra}:root{--font:'${f.family}',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif}</style>`;
}

function head(title, fontKey) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${escapeHtml(TAGLINE)}">
<title>${escapeHtml(title)}</title><style>${DESIGN}</style>${fontCss(fontKey)}</head>`;
}

function navbar() {
  return `<header class="nav2" id="nav"><div class="in">
    <a class="brand" href="#top">${logo(30)} <span>IX<b>AUDIT</b></span></a>
    <nav class="navlinks">
      <a href="#verifs">Vérifications</a><a href="#comment">Comment ça marche</a>
      <a href="#securite">Sécurité</a><a href="#faq">FAQ</a>
    </nav>
    <div class="navcta">
      <a class="login" href="/app">Espace client</a>
      <button class="btn" style="padding:10px 20px" onclick="focusScan()">Analyser mon site</button>
    </div>
    <button class="burger" aria-label="Menu" onclick="focusScan()">${picto('list', C.ink)}</button>
  </div></header>`;
}

function fxScript() {
  return `<script>(function(){
    var nav=document.getElementById('nav');function onScroll(){if(nav)nav.classList.toggle('on',window.scrollY>12);}
    onScroll();window.addEventListener('scroll',onScroll,{passive:true});
    var r=[].slice.call(document.querySelectorAll('.reveal'));
    if('IntersectionObserver'in window){var o=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');o.unobserve(e.target);}});},{threshold:.12});
    r.forEach(function(e){o.observe(e);});}else{r.forEach(function(e){e.classList.add('in');});}
  })();
  function focusScan(){var u=document.getElementById('url');if(u){u.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(function(){u.focus();},300);}else{location.href='/';}}
  function toggleQa(el){el.classList.toggle('open');}</script>`;
}

/* ------------------------------------------------------------------ */
/* ACCUEIL                                                             */
/* ------------------------------------------------------------------ */
function landingPage(fontKey) {
  const stats = [
    ['50k+', 'Sites audités'], ['99.9%', 'Disponibilité'],
    ['24/7', 'Analyse continue'], ['4.9/5', 'Satisfaction'],
  ];
  const steps = [
    ['globe', 'Entrez votre URL', 'Indiquez l\'adresse de votre site, sans installation ni configuration.'],
    ['scan', 'Analyse automatique', 'IXAUDIT teste la sécurité de votre site de façon non intrusive.'],
    ['list', 'Rapport & score', 'Recevez un score clair, les vulnérabilités détectées et les actions à mener.'],
  ];
  const badges = [
    ['shield', 'Vérification non intrusive'], ['lock', 'Aucune attaque de votre site'],
    ['privacy', 'Conforme RGPD'], ['folder', 'Aucune donnée revendue'], ['globe', 'Sans installation'],
  ];
  const faqs = [
    ['Qu\'est-ce qu\'un audit de sécurité passif ?',
     'Un audit passif observe votre site depuis l\'extérieur, comme le ferait un visiteur, sans jamais l\'attaquer ni le perturber. Il vérifie la connexion, les protections, les fichiers exposés, la réputation, les failles connues et la conformité RGPD.'],
    ['Est-ce que c\'est risqué pour mon site ?',
     'Non. IXAUDIT n\'envoie aucune attaque et ne modifie rien. L\'analyse est non intrusive et se contente de contrôler des points publics : elle est totalement sans danger pour votre site en production.'],
    ['Ai-je besoin de compétences techniques ?',
     'Aucune. Vous entrez l\'adresse de votre site et vous recevez un rapport en langage clair : ce qui va bien, ce qu\'il faut améliorer, et comment le corriger — sans jargon.'],
    ['Combien de temps prend une analyse ?',
     'La plupart des analyses se terminent en une à deux minutes. Le score et le rapport s\'affichent dès que la vérification est terminée.'],
    ['Que contient le rapport ?',
     'Un score sur 100 et une note de A à F, le détail de chaque catégorie vérifiée, les vulnérabilités détectées classées par gravité, et des recommandations concrètes à transmettre à la personne qui gère votre site.'],
    ['Combien ça coûte ?',
     'La première analyse est gratuite et sans inscription. Pour auditer autant de sites que vous voulez, un paiement unique débloque l\'accès à vie — sans abonnement.'],
  ];

  const body = `<body id="top">
  ${navbar()}

  <section class="hero">
    <div class="bggrid"></div><div class="halo v"></div><div class="halo c"></div>
    <div class="wrap herogrid">
      <div>
        <span class="pill"><span class="dot"></span>Audit de sécurité web automatisé</span>
        <h1 class="h1big">Votre site est-il <span class="grad">vraiment</span> sécurisé ?</h1>
        <p class="lead">${escapeHtml(TAGLINE)}</p>
        <form id="f" class="auditbar">
          <div class="field">
            ${inlineMag()}
            <input id="url" type="text" inputmode="url" placeholder="votre-site.fr" required aria-label="Adresse de votre site">
          </div>
          <button class="btn" id="btn" type="submit">Analyser mon site</button>
        </form>
        <div id="err" class="errbox"></div>
        <div class="trustline">Sans inscription · Audit non intrusif · Résultat en quelques minutes</div>
      </div>
      <div>${scanPanel()}</div>
    </div>
  </section>

  <section class="stats">
    <div class="wrap">
      <div class="reveal" style="text-align:center;color:var(--muted);font-size:14px;font-weight:600">Conçu pour les entreprises qui ne peuvent se permettre aucun angle mort.</div>
      <div class="logos reveal" style="margin-top:26px">
        <span>Northstar</span><span>Vertex</span><span>Cloudline</span><span>Orbital</span><span>Acme Labs</span>
      </div>
      <div class="statgrid">
        ${stats.map(function (s) { return `<div class="stat reveal"><div class="n grad">${s[0]}</div><div class="l">${s[1]}</div></div>`; }).join('')}
      </div>
    </div>
  </section>

  <section class="blk" id="verifs">
    <div class="wrap">
      <div class="center reveal">
        <span class="pill">Ce que nous vérifions</span>
        <h2 class="h2big">Tout le nécessaire, expliqué simplement</h2>
        <p class="sublead">Six contrôles essentiels, traduits en langage clair — sans jargon technique.</p>
      </div>
      <div class="fgrid">
        ${CATS.map(function (c) {
          return `<div class="fcard reveal">
            <div class="fico" style="background:${c.acc}1a;color:${c.acc}">${picto(c.pic, c.acc)}</div>
            <h3>${escapeHtml(c.label)}</h3><p>${escapeHtml(c.ok)}</p></div>`;
        }).join('')}
      </div>
    </div>
  </section>

  <section class="blk" id="comment" style="border-top:1px solid var(--line);background:rgba(13,17,24,.3)">
    <div class="wrap how">
      <div class="reveal">
        <span class="pill">Comment ça marche</span>
        <h2 class="h2big">De votre URL à un rapport clair.</h2>
        <p class="sublead">Trois étapes, aucune compétence technique requise.</p>
        <div class="steps"><span class="line"></span>
          ${steps.map(function (s) {
            return `<div class="step"><span class="dot"><i></i></span>
              <div class="st">${picto(s[0], C.cyan)}${s[1]}</div><p>${s[2]}</p></div>`;
          }).join('')}
        </div>
      </div>
      <div class="reveal">${howCard()}</div>
    </div>
  </section>

  <section class="blk" id="securite">
    <div class="wrap seccompli">
      <div class="reveal">
        <div class="shieldwrap">
          <span class="halo3"></span>
          <span class="ring" style="width:60%;height:60%"></span>
          <span class="ring" style="width:80%;height:80%"></span>
          <span class="ring" style="width:100%;height:100%"></span>
          <span class="shieldcore">${picto('shield', C.cyan)}</span>
        </div>
      </div>
      <div class="reveal">
        <span class="pill">Sécurité &amp; confiance</span>
        <h2 class="h2big">Une analyse sûre, dès la conception.</h2>
        <p class="sublead">IXAUDIT observe votre site depuis l'extérieur, sans jamais l'attaquer ni le ralentir. Chaque vérification est cadrée, non intrusive et respectueuse de vos données.</p>
        <div class="badges">
          ${badges.map(function (b) { return `<span class="badge">${picto(b[0], C.green)}${b[1]}</span>`; }).join('')}
        </div>
      </div>
    </div>
  </section>

  <section class="blk" id="faq" style="border-top:1px solid var(--line);background:rgba(13,17,24,.3)">
    <div class="wrap">
      <div class="center reveal">
        <span class="pill">FAQ</span>
        <h2 class="h2big">Vos questions, nos réponses</h2>
      </div>
      <div class="faq reveal" style="margin-top:44px">
        ${faqs.map(function (q, i) {
          return `<div class="qa${i === 0 ? ' open' : ''}" onclick="toggleQa(this)">
            <div class="q">${escapeHtml(q[0])}<span class="chev">▾</span></div>
            <div class="a">${escapeHtml(q[1])}</div></div>`;
        }).join('')}
      </div>
    </div>
  </section>

  <section class="ctabox">
    <div class="bggrid"></div><div class="halo v" style="top:20%"></div>
    <div class="wrap center reveal">
      <h2 class="h2big">Découvrez le niveau de sécurité de votre site.</h2>
      <p class="sublead" style="margin-bottom:32px">Gratuit, sans inscription, avec un rapport clair en quelques minutes.</p>
      <button class="btn" style="padding:16px 30px;font-size:16px" onclick="focusScan()">Analyser mon site gratuitement →</button>
      <div class="trustline" style="margin-top:20px">Paiement unique · Audits illimités · Sans abonnement</div>
    </div>
  </section>

  <footer class="foot3">
    <div class="wrap">
      <div class="footgrid">
        <div style="max-width:280px">
          <a class="brand" href="#top">${logo(30)} <span>IX<b>AUDIT</b></span></a>
          <p class="muted" style="font-size:14px;margin-top:14px">La sécurité de votre site web, auditée et expliquée simplement.</p>
        </div>
        <div><h4>Produit</h4><a href="#verifs">Vérifications</a><a href="#comment">Comment ça marche</a><a href="/app">Espace client</a><a href="#faq">FAQ</a></div>
        <div><h4>Ressources</h4><a href="#">Documentation</a><a href="#securite">Sécurité</a><a href="#">Guide RGPD</a><a href="#">Blog</a></div>
        <div><h4>Entreprise</h4><a href="#">À propos</a><a href="#">Contact</a><a href="#">Tarifs</a></div>
        <div><h4>Légal</h4><a href="#">Confidentialité</a><a href="#">Conditions</a><a href="#">Cookies</a></div>
      </div>
      <div class="footbot"><span>© 2026 ${escapeHtml(NAME)}. Tous droits réservés.</span>
        <span style="display:inline-flex;align-items:center;gap:8px"><span style="width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green)"></span>Vérification non intrusive · Conforme RGPD</span></div>
    </div>
  </footer>`;

  return `${head(NAME + ' — ' + HEADLINE, fontKey)}${body}${scanScript()}${fxScript()}
</body></html>`;
}

function inlineMag() {
  return `<svg class="mag" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`;
}

// Carte « exemple de résultat » à droite de la section Comment ça marche.
function howCard() {
  return `<div class="panel">
    <div class="panel-head"><span class="d" style="display:inline-flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:var(--high);box-shadow:0 0 8px var(--high)"></span>Détail d'une vérification</span>
      <span style="font-size:11px;font-weight:700;color:var(--high);background:rgba(255,151,21,.15);border-radius:999px;padding:5px 10px">À améliorer</span></div>
    <h3 style="font-size:17px;margin:16px 0 4px">En-tête de sécurité manquant</h3>
    <div class="muted" style="font-family:ui-monospace,monospace;font-size:12px">Protection du site · Content-Security-Policy</div>
    <div style="border:1px solid var(--line);background:rgba(13,17,24,.5);border-radius:14px;padding:16px;margin-top:16px">
      <div class="eyebrow" style="margin-bottom:10px">Recommandation</div>
      <div style="display:flex;gap:10px;align-items:flex-start;font-size:14px"><span style="color:var(--green)">✓</span>Ajouter un en-tête Content-Security-Policy pour bloquer les contenus non autorisés.</div>
    </div>
    <a class="btn" style="width:100%;margin-top:16px;box-sizing:border-box" onclick="focusScan()">Vérifier mon site</a>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Composant d'audit (branché sur le VRAI /api/audit/free)             */
/* ------------------------------------------------------------------ */
function scanPanel() {
  return `<div class="panel glow" id="scanCard">
    <div class="panel-head"><span class="d" id="scanDomain">votre-site.fr</span>
      <span class="s"><span class="ld"></span><span id="scanStatus">En analyse</span></span></div>
    <div id="scanList"></div>
    <div id="scanScore" class="score" style="display:none">
      <div class="score-flex">
        <div class="gauge" id="gauge"><div class="gin"><span class="score-n num" id="scoreN">0</span><span class="score-o num">/100</span></div></div>
        <div><div class="score-msg" id="scoreMsg"></div>
          <div class="muted" style="font-size:13.5px;margin-top:3px" id="scoreSub"></div>
          <a class="btn" id="scoreCta" href="#">Voir le rapport complet</a></div>
      </div>
    </div></div>`;
}

function scanScript() {
  return `<script>
  var CATS=${JSON.stringify(CATS.map(function (c) { return { id: c.id, label: c.label, ok: c.ok, warn: c.warn }; }))};
  var CATMAP={};CATS.forEach(function(c){CATMAP[c.id]=c;});
  function sColor(s){return s>=75?'var(--green)':s>=60?'var(--medium,#F5C451)':s>=45?'var(--high,#FF9715)':'var(--bad)';}
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
  function reset(domain){document.getElementById('scanDomain').textContent=domain;document.getElementById('scanStatus').textContent='En analyse';
    document.getElementById('scanList').innerHTML='';document.getElementById('scanScore').style.display='none';
    var g=document.getElementById('gauge');if(g)g.style.setProperty('--gp',0);}
  function demo(){reset('votre-site.fr');var items=[['Connexion sécurisée',true],['Site accessible',true],['Certificat valide',true],['Protection à améliorer',false],['2 points à vérifier',false]];
    var i=0;(function n(){if(i<items.length){addRow(items[i][0],items[i][1]);i++;setTimeout(n,300);}else{document.getElementById('scanStatus').textContent='Terminé';showScore(78,null);
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

/* ------------------------------------------------------------------ */
/* ESPACE CLIENT                                                       */
/* ------------------------------------------------------------------ */
function dashboardPage(fontKey) {
  const cards = [
    ['01', 'Créer un compte', `<label class="muted" style="display:block;font-size:12px;margin-bottom:6px">Votre email</label><input id="email" type="email" placeholder="vous@entreprise.com">
      <button class="btn" style="margin-top:12px;width:100%" onclick="createAccount()">Créer mon compte</button><div id="createOut" style="margin-top:10px;font-size:14px"></div>`],
    ['02', 'Votre clé d\'accès', `<label class="muted" style="display:block;font-size:12px;margin-bottom:6px">Clé (sk_live_…)</label><input id="key" type="text" placeholder="Collez votre clé ici">
      <button class="btn soft" style="margin-top:12px;width:100%" onclick="checkStatus()">Vérifier mon statut</button>`],
    ['03', 'Débloquer l\'illimité', `<p class="muted" style="font-size:13.5px;margin:0 0 14px">Un seul paiement, accès à vie. Aucun abonnement.</p>
      <button class="btn" style="width:100%" onclick="checkout()">Débloquer · accès à vie</button><div id="payOut" class="muted" style="font-size:12px;margin-top:8px"></div>`],
    ['04', 'Analyser un site', `<label class="muted" style="display:block;font-size:12px;margin-bottom:6px">Adresse du site</label><input id="auditUrl" type="text" placeholder="site-a-verifier.fr">
      <button class="btn" style="margin-top:12px;width:100%" onclick="runAudit()">Lancer l'analyse</button><div id="auditResult" style="margin-top:10px;font-size:14px"></div>`],
  ];
  const main = `
    <div class="eyebrow">Espace client</div>
    <h1 style="font-size:34px;font-weight:800;margin-top:10px">Vos audits, en toute autonomie</h1>
    <p class="muted" style="margin:14px 0 26px;max-width:540px;font-size:17px">Créez votre compte, débloquez une seule fois, puis analysez autant de sites que vous voulez, à vie.</p>
    <div class="card2" style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px">
      <div><span class="eyebrow">Statut de l'accès</span>
        <div id="statusText" style="font-weight:700;margin-top:4px">Non connecté</div></div>
      <span id="statusPill" style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:700">—</span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
      ${cards.map(function (c) {
        return `<div class="card2"><div style="display:flex;align-items:baseline;gap:10px;margin-bottom:14px">
          <span class="num" style="color:var(--violet);font-weight:800;font-size:13px">${c[0]}</span><h2 style="font-size:16px;font-weight:700">${c[1]}</h2></div>${c[2]}</div>`;
      }).join('')}
    </div>`;
  return `${head('Espace client · ' + NAME, fontKey)}<body id="top">${navbar()}<div class="app">${main}</div>
<script>
  function focusScan(){location.href='/';}
  function key(){return document.getElementById('key').value.trim();}
  function setStatus(active,txt){document.getElementById('statusText').textContent=txt;var p=document.getElementById('statusPill');
    p.textContent=active?'ACTIF':'INACTIF';p.style.color=active?'var(--green)':'var(--bad)';}
  function createAccount(){var email=document.getElementById('email').value.trim();
    fetch('/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email})}).then(function(r){return r.json();}).then(function(j){
      if(j.error){document.getElementById('createOut').innerHTML='<span style="color:var(--bad)">'+j.error+'</span>';return;}
      document.getElementById('createOut').innerHTML='<div class="muted">Votre clé (à copier, affichée une seule fois) :</div><div class="kbd" style="margin-top:6px">'+j.apiKey+'</div>';
      document.getElementById('key').value=j.apiKey;});}
  function checkStatus(){fetch('/api/account/status',{headers:{'x-api-key':key()}}).then(function(r){return r.json();}).then(function(j){
      if(j.error){setStatus(false,j.error);return;}var d=j.active?(j.validUntil?('valable jusqu\\'au '+new Date(j.validUntil).toLocaleDateString()):'accès à vie'):'paiement requis';
      setStatus(j.active,(j.email||'')+' · '+(j.auditsCount||0)+' analyse(s) · '+d);});}
  function checkout(){fetch('/api/checkout',{method:'POST',headers:{'x-api-key':key()}}).then(function(r){return r.json();}).then(function(j){
      if(j.checkoutUrl){window.location=j.checkoutUrl;}else{document.getElementById('payOut').innerHTML='<span style="color:var(--bad)">'+(j.error||'Paiement indisponible')+'</span>';}});}
  function runAudit(){var url=document.getElementById('auditUrl').value.trim();var out=document.getElementById('auditResult');out.textContent='Analyse en cours…';
    fetch('/api/audit',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key()},body:JSON.stringify({url:url})}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});}).then(function(o){
      if(!o.ok){out.innerHTML='<span style="color:var(--bad)">'+(o.j.error||'Erreur')+'</span>';return;}
      out.innerHTML='Niveau de sécurité : <strong>'+o.j.score+'/100</strong> — <a style="color:var(--cyan);font-weight:600" href="'+o.j.reportUrl+'" target="_blank">voir le rapport</a>';});}
</script>
${fxScript()}
</body></html>`;
}

/* ------------------------------------------------------------------ */
/* Variante 2 — redirige vers l'accueil (design unifié)               */
/* ------------------------------------------------------------------ */
function landingAltPage(fontKey) {
  return landingPage(fontKey);
}

module.exports = { NAME, HEADLINE, TAGLINE, GRADE, SEV, CATS, landingPage, landingAltPage, dashboardPage, escapeHtml };
