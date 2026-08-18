'use strict';

/**
 * Générateur de rapport — BILINGUE
 *
 * Haut du rapport : résumé en langage simple (score /100, catégories en clair,
 * priorités actionnables) pour n'importe quel dirigeant.
 * Bas du rapport : détails techniques (findings par module) pour les profils IT.
 *
 * Export PDF via Puppeteer (chargement paresseux : si absent, le HTML reste
 * produit).
 */

const fs = require('fs');
const path = require('path');
const brand = require('../lib/brand');

const SEVERITY_LABEL = { high: 'Élevé', medium: 'Moyen', low: 'Faible', info: 'Info' };
const SEVERITY_COLOR = { high: '#dc2626', medium: '#ea580c', low: '#d97706', info: '#2563eb' };

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Raison par défaut (« pourquoi le changer ») si le finding n'en fournit pas.
function whyFallback(severity) {
  if (severity === 'high')
    return 'Ce point peut être exploité directement par un attaquant pour compromettre votre site ou accéder à vos données.';
  if (severity === 'medium')
    return 'Ce point affaiblit la sécurité de votre site et facilite d\'éventuelles attaques.';
  return 'Amélioration recommandée : elle renforce la sécurité de votre site sans caractère d\'urgence.';
}

// --- Langage simple ---
function plainScore(score) {
  if (score >= 90) return { color: '#A7F36B', title: 'Votre site est très bien protégé', sub: 'Continuez comme ça !' };
  if (score >= 75) return { color: '#A7F36B', title: 'Votre site est plutôt bien protégé', sub: 'Quelques points peuvent encore être améliorés.' };
  if (score >= 60) return { color: '#F5C451', title: 'Votre site est correctement protégé', sub: 'Plusieurs améliorations sont recommandées.' };
  if (score >= 45) return { color: '#FF9715', title: 'Votre site présente des points faibles', sub: 'Il est conseillé d\'agir prochainement.' };
  return { color: '#F4576B', title: 'Votre site présente des risques importants', sub: 'Une mise en sécurité rapide est recommandée.' };
}

/** Statut simple d'une catégorie à partir de son module. */
function categoryStatus(mod) {
  if (!mod) return 'unknown';
  if (mod.degraded && !(mod.findings || []).some((f) => f.severity === 'high' || f.severity === 'medium')) return 'unknown';
  const hasIssue = (mod.findings || []).some((f) => f.severity === 'high' || f.severity === 'medium');
  return hasIssue ? 'warn' : 'ok';
}

function renderPlainCategories(modules) {
  const byId = {};
  modules.forEach((m) => { if (m && m.module) byId[m.module] = m; });
  return brand.CATS.map((c) => {
    const mod = byId[c.id];
    const st = categoryStatus(mod);
    const pill = st === 'ok'
      ? '<span class="pill ok">✓ Tout va bien</span>'
      : st === 'warn'
        ? '<span class="pill warn">⚠ À améliorer</span>'
        : '<span class="pill unk">— Non vérifié</span>';
    const text = st === 'warn' ? c.warn : st === 'ok' ? c.ok : 'Cette vérification n\'a pas pu être effectuée (source externe indisponible).';
    const ico = brand.picto ? brand.picto(c.pic, c.acc || '#64748b') : '';
    return `<div class="pcat">
      <div class="pcat-h"><span class="pico" style="color:${c.acc || '#64748b'}">${ico}</span><strong>${escapeHtml(c.label)}</strong>${pill}</div>
      <div class="pcat-t">${escapeHtml(text)}</div></div>`;
  }).join('');
}

/** Priorités en langage clair (findings triés par gravité). */
function renderPriorities(modules) {
  const all = [];
  modules.forEach((m) => (m.findings || []).forEach((f) => {
    if (f.severity === 'high' || f.severity === 'medium' || f.severity === 'low') all.push(f);
  }));
  if (!all.length) {
    return '<p class="allgood">🎉 Aucun point bloquant détecté. Continuez à surveiller régulièrement votre site.</p>';
  }
  const groups = [
    { sev: 'high', title: '🔴 À corriger en priorité', desc: 'Ces points peuvent réellement mettre votre site ou vos données en danger.' },
    { sev: 'medium', title: '🟠 À améliorer', desc: 'Des points importants pour renforcer votre sécurité.' },
    { sev: 'low', title: '🟡 Recommandations', desc: 'Des améliorations conseillées, sans urgence.' },
  ];
  return groups.map((g) => {
    const items = all.filter((f) => f.severity === g.sev);
    if (!items.length) return '';
    return `<div class="pgroup">
      <div class="pgroup-h" style="border-color:${SEVERITY_COLOR[g.sev]}"><strong>${g.title}</strong>
        <span class="cnt" style="background:${SEVERITY_COLOR[g.sev]}">${items.length}</span></div>
      <div class="muted small">${g.desc}</div>
      ${items.map((f) => `<div class="pitem">
        <div class="pitem-m">${escapeHtml(f.message)}</div>
        <div class="pitem-w"><strong>Pourquoi le changer :</strong> ${escapeHtml(f.why || whyFallback(f.severity))}</div>
        ${f.recommendation ? '<div class="pitem-r"><strong>Ce qu\'il faut faire :</strong> ' + escapeHtml(f.recommendation) + '</div>' : ''}</div>`).join('')}
    </div>`;
  }).join('');
}

// Tableau « Fichiers vérifiés » : accessible ou non, pour chaque chemin testé.
function renderExposedFiles(modules) {
  const mod = modules.find((m) => m && m.module === 'A3');
  if (!mod || !Array.isArray(mod.tested) || !mod.tested.length) return '';
  const rows = mod.tested.map((t) => {
    const exposed = !!t.exposed;
    const badge = exposed
      ? '<span class="fbadge bad">⚠ Accessible</span>'
      : '<span class="fbadge ok">✓ Non accessible</span>';
    const note = exposed
      ? 'Ce fichier est accessible publiquement : à retirer rapidement.'
      : 'Ce fichier n\'est pas accessible publiquement. Rien à faire.';
    return `<tr><td class="fpath">${escapeHtml(t.path)}</td>
      <td class="fdesc">${escapeHtml(t.label || '')}<div class="muted small">${note}</div></td>
      <td class="fstat">${badge}</td></tr>`;
  }).join('');
  const nbExposed = mod.tested.filter((t) => t.exposed).length;
  const intro = nbExposed
    ? 'Nous avons trouvé <strong>' + nbExposed + ' fichier(s) sensible(s) accessible(s)</strong> à sécuriser.'
    : 'Aucun fichier sensible n\'est accessible publiquement. ✔';
  return `<h2 class="sec">Fichiers vérifiés</h2>
    <div class="muted small">Pour chaque fichier sensible testé, nous indiquons s\'il est accessible ou non depuis Internet.</div>
    <div class="muted small" style="margin-top:6px">${intro}</div>
    <table class="ftable"><thead><tr><th>Fichier</th><th>Détail</th><th>État</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
}

// --- Section technique (profils IT) ---
function renderFindings(findings) {
  if (!findings || !findings.length) return '<p class="ok">Aucun problème détecté sur ce contrôle. ✔</p>';
  const order = { high: 0, medium: 1, low: 2, info: 3 };
  const sorted = [...findings].sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  return '<ul class="findings">' + sorted.map((f) => {
    const color = SEVERITY_COLOR[f.severity] || '#64748b';
    const label = SEVERITY_LABEL[f.severity] || f.severity;
    return '<li><span class="badge" style="background:' + color + '">' + escapeHtml(label) + '</span> ' +
      '<span class="msg">' + escapeHtml(f.message) + '</span>' +
      '<div class="reco why"><strong>Pourquoi :</strong> ' + escapeHtml(f.why || whyFallback(f.severity)) + '</div>' +
      (f.recommendation ? '<div class="reco"><strong>Recommandation :</strong> ' + escapeHtml(f.recommendation) + '</div>' : '') + '</li>';
  }).join('') + '</ul>';
}

function renderModuleCard(mod) {
  if (!mod) return '';
  const scoreColor = mod.score >= 80 ? '#16a34a' : mod.score >= 60 ? '#ca8a04' : '#dc2626';
  return '<section class="module"><div class="module-head">' +
    '<h3>' + escapeHtml(mod.name || mod.module) + ' <span class="mod-id">(' + escapeHtml(mod.module) + ')</span></h3>' +
    (mod.score != null ? '<span class="module-score" style="color:' + scoreColor + '">' + mod.score + '/100</span>' : '') +
    '</div>' +
    (mod.error ? '<p class="mod-error">⚠ ' + escapeHtml(mod.error) + '</p>' : '') +
    (mod.degraded ? '<p class="mod-note">Mode dégradé : une ou plusieurs sources externes n\'ont pas pu être interrogées.</p>' : '') +
    renderFindings(mod.findings) + '</section>';
}

function buildHtml(report) {
  const { target, generatedAt, scoring, modules } = report;
  const ps = plainScore(scoring.score);
  const dateStr = (function () { try { return new Date(generatedAt).toLocaleString('fr-FR'); } catch (e) { return generatedAt; } })();
  const warnCount = brand.CATS.filter((c) => categoryStatus(modules.find((m) => m && m.module === c.id)) === 'warn').length;

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<title>Rapport de sécurité — ${escapeHtml(target)}</title>
<style>
  @font-face{font-family:'Inter';font-weight:400;font-display:swap;src:url('/assets/inter-400.woff2') format('woff2')}
  @font-face{font-family:'Inter';font-weight:600;font-display:swap;src:url('/assets/inter-600.woff2') format('woff2')}
  @font-face{font-family:'Inter';font-weight:700;font-display:swap;src:url('/assets/inter-700.woff2') format('woff2')}
  @font-face{font-family:'Inter';font-weight:800;font-display:swap;src:url('/assets/inter-700.woff2') format('woff2')}
  *{box-sizing:border-box}
  body{font-family:'Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:#F5F7FA;margin:0;background:#07090D;-webkit-font-smoothing:antialiased}
  .page{max-width:880px;margin:0 auto;padding:44px 28px;background:transparent}
  .brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:19px}
  .blogo{width:24px;height:24px;display:inline-flex}.blogo svg{width:100%;height:100%}
  .brand .b{background:linear-gradient(120deg,#8D7CFF,#57E6D1);-webkit-background-clip:text;background-clip:text;color:transparent}
  .cover{border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:20px}
  .cover .t{font-size:26px;font-weight:800;margin:16px 0 4px;letter-spacing:-.02em}
  .cover .target{color:#8B98A8;word-break:break-all;font-family:ui-monospace,Menlo,monospace;font-size:13px}
  .cover .date{color:#8B98A8;font-size:13px;margin-top:4px}
  .scoreblock{display:flex;align-items:center;gap:24px;margin:26px 0 8px;padding:24px;border:1px solid rgba(255,255,255,.08);border-radius:20px;background:rgba(18,24,33,.6)}
  .ring{width:130px;height:130px;border-radius:50%;flex:0 0 auto;display:flex;align-items:center;justify-content:center;
    background:conic-gradient(${ps.color} ${scoring.score}%,rgba(255,255,255,.08) 0)}
  .ring .in{width:102px;height:102px;border-radius:50%;background:#0D1118;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .ring .n{font-size:34px;font-weight:800;line-height:1}
  .ring .o{color:#8B98A8;font-size:12px}
  .scoreblock .msg{font-size:21px;font-weight:800;letter-spacing:-.01em}
  .scoreblock .sub{color:#8B98A8;margin-top:4px}
  .scoreblock .cnt{color:#F5F7FA;margin-top:10px;font-size:14px}
  h2.sec{font-size:20px;font-weight:700;margin:38px 0 6px;letter-spacing:-.01em}
  .muted{color:#8B98A8}.small{font-size:13px}
  .pcats{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
  .pcat{border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px;background:rgba(18,24,33,.5)}
  .pcat-h{display:flex;align-items:center;gap:9px;font-size:15px}
  .pico{width:20px;height:20px;flex:0 0 auto;display:inline-flex}
  .pico svg{width:100%;height:100%}
  .pill{margin-left:auto;font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px}
  .pill.ok{background:rgba(167,243,107,.14);color:#A7F36B}.pill.warn{background:rgba(255,151,21,.16);color:#FF9715}.pill.unk{background:rgba(255,255,255,.06);color:#8B98A8}
  .pcat-t{color:#b4bfcc;font-size:13.5px;margin-top:8px}
  .pgroup{margin-top:16px}
  .pgroup-h{display:flex;align-items:center;gap:10px;border-left:4px solid;padding-left:10px;font-size:16px;font-weight:700}
  .cnt{color:#fff;font-size:12px;font-weight:800;border-radius:999px;padding:1px 8px}
  .pitem{border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px;margin-top:10px;background:rgba(18,24,33,.4)}
  .pitem-m{font-weight:600}
  .pitem-w{font-size:13.5px;color:#F5C451;background:rgba(255,151,21,.12);border-left:3px solid #FF9715;margin-top:8px;padding:8px 11px;border-radius:0 8px 8px 0}
  .pitem-r{font-size:13.5px;color:#c8e6a6;background:rgba(167,243,107,.1);border-left:3px solid #A7F36B;margin-top:8px;padding:8px 11px;border-radius:0 8px 8px 0}
  .ftable{width:100%;border-collapse:collapse;margin-top:14px;font-size:13.5px}
  .ftable th{text-align:left;color:#8B98A8;font-size:12px;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid rgba(255,255,255,.14);padding:8px 10px}
  .ftable td{border-bottom:1px solid rgba(255,255,255,.08);padding:12px 10px;vertical-align:top}
  .fpath{font-family:ui-monospace,Menlo,monospace;color:#F5F7FA;white-space:nowrap}
  .fdesc{color:#c3ccd6}
  .fstat{white-space:nowrap;text-align:right}
  .fbadge{font-size:12px;font-weight:800;padding:5px 11px;border-radius:999px;white-space:nowrap}
  .fbadge.ok{background:rgba(167,243,107,.14);color:#A7F36B}.fbadge.bad{background:rgba(244,87,107,.16);color:#F4576B}
  .allgood{background:rgba(167,243,107,.08);border:1px solid rgba(167,243,107,.25);color:#A7F36B;border-radius:14px;padding:16px;font-weight:600}
  .tech{margin-top:16px;border-top:1px dashed rgba(255,255,255,.14);padding-top:18px}
  .tech-note{background:rgba(18,24,33,.5);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px 14px;color:#8B98A8;font-size:13px;margin-bottom:8px}
  .module{border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px 20px;margin:14px 0;background:rgba(18,24,33,.4)}
  .module-head{display:flex;justify-content:space-between;align-items:baseline}
  .module-head h3{margin:0;font-size:16px;font-weight:700}
  .mod-id{color:#8B98A8;font-weight:normal;font-size:12px}
  .module-score{font-weight:800}
  .mod-error{color:#F4576B;font-size:13px}.mod-note{color:#8B98A8;font-size:12px;font-style:italic}
  ul.findings{list-style:none;padding:0;margin:8px 0 0}
  ul.findings li{padding:11px 0;border-top:1px dashed rgba(255,255,255,.08)}
  .badge{color:#fff;font-size:11px;font-weight:800;padding:2px 8px;border-radius:8px;text-transform:uppercase}
  .msg{font-size:14px}
  .reco{font-size:13px;color:#c3ccd6;margin-top:6px;padding:5px 10px;border-left:3px solid rgba(255,255,255,.16);border-radius:0 6px 6px 0}
  .reco.why{border-left-color:#FF9715;color:#F5C451;background:rgba(255,151,21,.08)}
  .ok{color:#A7F36B;font-size:14px}
  footer{margin-top:38px;padding-top:16px;border-top:1px solid rgba(255,255,255,.08);font-size:12px;color:#8B98A8;text-align:center}
  @media print{body{background:#07090D}.page{padding:0}}
  @media(max-width:620px){.pcats{grid-template-columns:1fr}.scoreblock{flex-direction:column;text-align:center}}
</style></head>
<body><div class="page">
  <header class="cover">
    <div class="brand"><span class="blogo">${brand.picto ? brand.picto('radar', '#8b6cff') : ''}</span> <span>IX<span class="b">AUDIT</span></span></div>
    <div class="t">Votre rapport de sécurité</div>
    <div class="target">${escapeHtml(target)}</div>
    <div class="date">Vérifié le ${escapeHtml(dateStr)}</div>
  </header>

  <div class="scoreblock">
    <div class="ring"><div class="in"><div class="n" style="color:${ps.color}">${scoring.score}</div><div class="o">/ 100</div></div></div>
    <div><div class="msg" style="color:${ps.color}">${escapeHtml(ps.title)}</div>
      <div class="sub">${escapeHtml(ps.sub)}</div>
      <div class="cnt">${warnCount > 0 ? 'Nous avons trouvé <strong>' + warnCount + ' point(s)</strong> à améliorer.' : 'Aucun point majeur à améliorer.'}</div></div>
  </div>

  <h2 class="sec">En résumé</h2>
  <div class="muted small">Ce que nous avons vérifié sur votre site, en clair.</div>
  <div class="pcats">${renderPlainCategories(modules)}</div>

  <h2 class="sec">Vos priorités</h2>
  <div class="muted small">Pour chaque point : ce que c'est, pourquoi le changer, et ce qu'il faut faire.</div>
  ${renderPriorities(modules)}

  ${renderExposedFiles(modules)}

  <div class="tech">
    <h2 class="sec" style="margin-top:6px">Détails techniques</h2>
    <div class="tech-note">Cette section s'adresse aux profils techniques (développeurs, prestataires informatiques). Vous pouvez la transmettre à la personne qui gère votre site.</div>
    ${modules.map(renderModuleCard).join('\n')}
  </div>

  <footer>Vérification passive et non intrusive — aucune requête agressive n'a été effectuée sur votre site.<br>
    Rapport fourni à titre informatif ; il ne constitue pas une garantie d'absence de vulnérabilité.</footer>
</div></body></html>`;
}

async function generate(report, options = {}) {
  const html = buildHtml(report);
  const out = { html };

  if (options.htmlPath) {
    fs.mkdirSync(path.dirname(options.htmlPath), { recursive: true });
    fs.writeFileSync(options.htmlPath, html, 'utf8');
    out.htmlPath = options.htmlPath;
  }

  if (options.pdf && options.pdfPath) {
    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}),
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      fs.mkdirSync(path.dirname(options.pdfPath), { recursive: true });
      await page.pdf({ path: options.pdfPath, format: 'A4', printBackground: true,
        margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
      await browser.close();
      out.pdfPath = options.pdfPath;
    } catch (err) {
      out.pdfError = 'Génération PDF impossible (' + err.message + '). Le rapport HTML reste disponible.';
    }
  }
  return out;
}

module.exports = { generate, buildHtml };
