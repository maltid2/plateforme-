'use strict';

/**
 * Générateur de rapport — BILINGUE
 *
 * Haut du rapport : résumé en langage simple (score /100, catégories en clair,
 * priorités actionnables) pour n'importe quel dirigeant.
 * Bas du rapport : détails techniques (findings par module) pour les profils IT.
 *
 * Design : interface cybersécurité premium, noir & violet, profondeur 3D
 * subtile (CSS/SVG uniquement — aucune lib 3D lourde). Structure, données,
 * scores, statuts et logique inchangés ; seul l'habillage évolue.
 */

const fs = require('fs');
const path = require('path');
const brand = require('../lib/brand');

const SEVERITY_LABEL = { high: 'Élevé', medium: 'Moyen', low: 'Faible', info: 'Info' };
// Danger (#A855F7) uniquement pour le critique ; recommandation en orange mat.
const SEVERITY_COLOR = { high: '#A855F7', medium: '#8B5CF6', low: '#A78BFA', info: '#8B5CF6' };

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Petites icônes en ligne (style Lucide) — sobres, ne concurrencent pas le texte.
const ICON = {
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.1 2.1-2.3-.6-.6-2.3z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
};

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
  if (score >= 90) return { color: '#A78BFA', title: 'Votre site est très bien protégé', sub: 'Continuez comme ça !' };
  if (score >= 75) return { color: '#A78BFA', title: 'Votre site est plutôt bien protégé', sub: 'Quelques points peuvent encore être améliorés.' };
  if (score >= 60) return { color: '#8B5CF6', title: 'Votre site est correctement protégé', sub: 'Plusieurs améliorations sont recommandées.' };
  if (score >= 45) return { color: '#8B5CF6', title: 'Votre site présente des points faibles', sub: 'Il est conseillé d\'agir prochainement.' };
  return { color: '#A855F7', title: 'Votre site présente des risques importants', sub: 'Une mise en sécurité rapide est recommandée.' };
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
      ? '<span class="pill ok">Tout va bien</span>'
      : st === 'warn'
        ? '<span class="pill warn">À améliorer</span>'
        : '<span class="pill unk">Non vérifié</span>';
    const text = st === 'warn' ? c.warn : st === 'ok' ? c.ok : 'Cette vérification n\'a pas pu être effectuée (source externe indisponible).';
    const ico = brand.picto ? brand.picto(c.pic, '#C4B5FD') : '';
    return `<div class="pcat reveal tilt">
      <div class="pcat-h"><span class="pico">${ico}</span><strong>${escapeHtml(c.label)}</strong>${pill}</div>
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
    return '<p class="allgood reveal">Aucun point bloquant détecté. Continuez à surveiller régulièrement votre site.</p>';
  }
  const groups = [
    { sev: 'high', title: 'À corriger en priorité', desc: 'Ces points peuvent réellement mettre votre site ou vos données en danger.' },
    { sev: 'medium', title: 'À améliorer', desc: 'Des points importants pour renforcer votre sécurité.' },
    { sev: 'low', title: 'Recommandations', desc: 'Des améliorations conseillées, sans urgence.' },
  ];
  return groups.map((g) => {
    const items = all.filter((f) => f.severity === g.sev);
    if (!items.length) return '';
    return `<div class="pgroup reveal">
      <div class="pgroup-h"><span class="gdot" style="background:${SEVERITY_COLOR[g.sev]}"></span><strong>${g.title}</strong>
        <span class="cnt" style="background:${SEVERITY_COLOR[g.sev]}">${items.length}</span></div>
      <div class="muted small">${g.desc}</div>
      ${items.map((f) => `<div class="pitem">
        <div class="pitem-m">${escapeHtml(f.message)}</div>
        <div class="pitem-w"><span class="pic-i">${ICON.info}</span><span><strong>Pourquoi le changer :</strong> ${escapeHtml(f.why || whyFallback(f.severity))}</span></div>
        ${f.recommendation ? '<div class="pitem-r"><span class="pic-i">' + ICON.wrench + '</span><span><strong>Ce qu\'il faut faire :</strong> ' + escapeHtml(f.recommendation) + '</span></div>' : ''}</div>`).join('')}
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
      ? '<span class="fbadge bad">Accessible</span>'
      : '<span class="fbadge ok">Non accessible</span>';
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
    : 'Aucun fichier sensible n\'est accessible publiquement.';
  return `<h2 class="sec">Fichiers vérifiés</h2>
    <div class="muted small">Pour chaque fichier sensible testé, nous indiquons s\'il est accessible ou non depuis Internet.</div>
    <div class="muted small" style="margin-top:6px">${intro}</div>
    <div class="panel reveal"><table class="ftable"><thead><tr><th>Fichier</th><th>Détail</th><th>État</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
}

// --- Section technique (profils IT) ---
function renderFindings(findings) {
  if (!findings || !findings.length) return '<p class="ok">Aucun problème détecté sur ce contrôle.</p>';
  const order = { high: 0, medium: 1, low: 2, info: 3 };
  const sorted = [...findings].sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  return '<ul class="findings">' + sorted.map((f) => {
    const color = SEVERITY_COLOR[f.severity] || '#8B5CF6';
    const label = SEVERITY_LABEL[f.severity] || f.severity;
    return '<li><span class="badge sev-' + escapeHtml(f.severity) + '" style="--sc:' + color + '">' + escapeHtml(label) + '</span> ' +
      '<span class="msg">' + escapeHtml(f.message) + '</span>' +
      '<div class="reco why"><strong>Pourquoi :</strong> ' + escapeHtml(f.why || whyFallback(f.severity)) + '</div>' +
      (f.recommendation ? '<div class="reco act"><strong>Recommandation :</strong> ' + escapeHtml(f.recommendation) + '</div>' : '') + '</li>';
  }).join('') + '</ul>';
}

function renderModuleCard(mod) {
  if (!mod) return '';
  const scoreColor = mod.score >= 80 ? '#A78BFA' : mod.score >= 60 ? '#8B5CF6' : '#A855F7';
  const gauge = mod.score != null
    ? '<span class="mscore"><span class="mring" style="--p:' + Math.max(0, Math.min(100, mod.score)) + ';--c:' + scoreColor + '"></span><span class="mnum" style="color:' + scoreColor + '">' + mod.score + '/100</span></span>'
    : '';
  return '<details class="module reveal"><summary class="module-head">' +
    '<span class="mh-title"><span class="mchev">' + ICON.chevron + '</span>' +
    '<span class="mh-name">' + escapeHtml(mod.name || mod.module) + ' <span class="mod-id">(' + escapeHtml(mod.module) + ')</span></span></span>' +
    gauge +
    '</summary><div class="module-body">' +
    (mod.error ? '<p class="mod-error">' + escapeHtml(mod.error) + '</p>' : '') +
    (mod.degraded ? '<p class="mod-note">Mode dégradé : une ou plusieurs sources externes n\'ont pas pu être interrogées.</p>' : '') +
    renderFindings(mod.findings) + '</div></details>';
}

function buildHtml(report) {
  const { target, generatedAt, scoring, modules } = report;
  const ps = plainScore(scoring.score);
  const dateStr = (function () { try { return new Date(generatedAt).toLocaleString('fr-FR'); } catch (e) { return generatedAt; } })();
  const warnCount = brand.CATS.filter((c) => categoryStatus(modules.find((m) => m && m.module === c.id)) === 'warn').length;

  // Anneau de score : circonférence et décalage cible (rayon 62, épaisseur 12).
  const R = 62;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, scoring.score));
  const dashTarget = (C * (1 - pct / 100)).toFixed(2);
  const Cf = C.toFixed(2);

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rapport de sécurité — ${escapeHtml(target)}</title>
<script>document.documentElement.classList.add('js')</script>
<style>
  @font-face{font-family:'Inter';font-weight:400;font-display:swap;src:url('/assets/inter-400.woff2') format('woff2')}
  @font-face{font-family:'Inter';font-weight:600;font-display:swap;src:url('/assets/inter-600.woff2') format('woff2')}
  @font-face{font-family:'Inter';font-weight:700;font-display:swap;src:url('/assets/inter-700.woff2') format('woff2')}
  @font-face{font-family:'Inter';font-weight:800;font-display:swap;src:url('/assets/inter-700.woff2') format('woff2')}
  :root{
    --bg:#08080D;--card:#11111A;--sub:#171724;--line:rgba(255,255,255,.08);
    --v:#8B5CF6;--vl:#A78BFA;--vd:#5B21B6;
    --ink:#F4F4F5;--ink2:#A1A1AA;--ok:#A78BFA;--reco:#8B5CF6;--bad:#A855F7;
  }
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{font-family:'Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--ink);margin:0;
    background:var(--bg);-webkit-font-smoothing:antialiased;position:relative;overflow-x:hidden}
  /* Décor 3D très discret, toujours derrière le contenu */
  .bg{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
  .bg .grid{position:absolute;left:50%;top:-10%;width:200%;height:70vh;transform:translateX(-50%) perspective(560px) rotateX(62deg);transform-origin:top center;
    background-image:linear-gradient(rgba(139,92,246,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,.05) 1px,transparent 1px);
    background-size:46px 46px;-webkit-mask-image:linear-gradient(to bottom,#000,transparent 78%);mask-image:linear-gradient(to bottom,#000,transparent 78%)}
  .bg .rad{position:absolute;inset:0;background:radial-gradient(60% 40% at 50% 0%,rgba(91,33,182,.20),transparent 70%),radial-gradient(50% 40% at 85% 30%,rgba(139,92,246,.10),transparent 70%)}
  .orb{position:absolute;border-radius:50%;filter:blur(46px);opacity:.5;will-change:transform}
  .orb.o1{width:340px;height:340px;left:-120px;top:120px;background:radial-gradient(circle at 35% 30%,rgba(139,92,246,.5),rgba(91,33,182,.18) 60%,transparent 72%)}
  .orb.o2{width:300px;height:300px;right:-110px;top:480px;background:radial-gradient(circle at 60% 40%,rgba(167,139,250,.4),transparent 68%)}
  .orb.o3{width:260px;height:260px;left:30%;bottom:-90px;background:radial-gradient(circle at 50% 50%,rgba(91,33,182,.4),transparent 70%)}
  .page{position:relative;z-index:1;max-width:900px;margin:0 auto;padding:44px 24px 60px}
  a{color:inherit}
  /* Marque */
  .brand{display:flex;align-items:center;gap:11px;font-weight:800;font-size:19px}
  .blogo{width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;border-radius:9px;
    background:linear-gradient(150deg,rgba(139,92,246,.22),rgba(139,92,246,.05));border:1px solid var(--line);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.08),inset 0 -3px 6px rgba(0,0,0,.5)}
  .blogo svg{width:18px;height:18px}
  .brand .b{background:linear-gradient(120deg,var(--vl),var(--v));-webkit-background-clip:text;background-clip:text;color:transparent}
  .cover{padding-bottom:8px}
  .cover .t{font-size:27px;font-weight:800;margin:18px 0 6px;letter-spacing:-.02em}
  .cover .target{color:var(--ink2);word-break:break-all;font-family:ui-monospace,Menlo,monospace;font-size:13px}
  .cover .date{color:var(--ink2);font-size:13px;margin-top:4px}
  /* Carte du score — élément visuel principal */
  .scorecard{position:relative;display:flex;align-items:center;gap:26px;margin:24px 0 8px;padding:26px 28px;border:1px solid var(--line);border-radius:22px;
    background:linear-gradient(180deg,rgba(23,23,36,.72),rgba(17,17,26,.72));backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
    box-shadow:0 30px 70px -34px rgba(0,0,0,.85),inset 0 1px 0 rgba(255,255,255,.05);overflow:hidden}
  .scorecard .halo{position:absolute;left:22px;top:50%;width:190px;height:190px;transform:translateY(-50%);border-radius:50%;
    background:radial-gradient(circle,rgba(139,92,246,.30),transparent 68%);filter:blur(22px);pointer-events:none}
  .ringwrap{position:relative;width:150px;height:150px;flex:0 0 auto}
  .ringwrap .sphere{position:absolute;inset:14px;border-radius:50%;
    background:radial-gradient(circle at 34% 30%,rgba(139,92,246,.22),rgba(10,8,16,.9) 62%);
    box-shadow:inset 0 6px 18px rgba(0,0,0,.7),inset 0 -3px 10px rgba(139,92,246,.18)}
  .ringsvg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);
    filter:drop-shadow(-1px -1px 1px rgba(196,181,253,.45)) drop-shadow(2px 3px 5px rgba(0,0,0,.6))}
  .ringsvg .prog{stroke-dasharray:${Cf};stroke-dashoffset:${dashTarget};transition:none}
  .ringcenter{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .ringcenter .n{font-size:40px;font-weight:800;line-height:1;color:var(--ink)}
  .ringcenter .o{color:var(--ink2);font-size:12px;margin-top:3px;letter-spacing:.04em}
  .scoretext .msg{font-size:22px;font-weight:800;letter-spacing:-.01em}
  .scoretext .sub{color:var(--ink2);margin-top:5px;font-size:14.5px}
  .scoretext .cnt{color:var(--ink);margin-top:12px;font-size:14px}
  /* Titres */
  h2.sec{font-size:20px;font-weight:800;margin:40px 0 6px;letter-spacing:-.01em}
  .muted{color:var(--ink2)}.small{font-size:13px}
  /* Résumé */
  .pcats{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}
  .pcat{position:relative;border:1px solid var(--line);border-radius:16px;padding:18px;
    background:linear-gradient(180deg,rgba(23,23,36,.66),rgba(17,17,26,.66));backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
    box-shadow:0 22px 46px -30px rgba(0,0,0,.8);transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease;transform-style:preserve-3d}
  .pcat:hover{border-color:rgba(167,139,250,.5)}
  .pcat-h{display:flex;align-items:center;gap:11px;font-size:15px}
  .pico{width:38px;height:38px;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;border-radius:11px;
    background:linear-gradient(150deg,rgba(139,92,246,.20),rgba(139,92,246,.04));border:1px solid var(--line);color:var(--vl);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.07),inset 0 -3px 6px rgba(0,0,0,.45)}
  .pico svg{width:19px;height:19px}
  .pill{margin-left:auto;font-size:11px;font-weight:800;padding:4px 11px;border-radius:999px;white-space:nowrap;border:1px solid transparent}
  .pill.ok{background:rgba(167,139,250,.12);color:#A78BFA;border-color:rgba(167,139,250,.28)}
  .pill.warn{background:rgba(139,92,246,.13);color:var(--reco);border-color:rgba(139,92,246,.30)}
  .pill.unk{background:rgba(255,255,255,.05);color:var(--ink2);border-color:var(--line)}
  .pcat-t{color:#cfcfd6;font-size:13.5px;margin-top:10px;line-height:1.5}
  /* Priorités */
  .pgroup{margin-top:18px;border:1px solid var(--line);border-radius:16px;padding:16px 18px;
    background:linear-gradient(180deg,rgba(23,23,36,.55),rgba(17,17,26,.55));box-shadow:0 22px 46px -32px rgba(0,0,0,.8)}
  .pgroup-h{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:800}
  .gdot{width:11px;height:11px;border-radius:50%;flex:0 0 auto;box-shadow:0 0 0 4px rgba(255,255,255,.03)}
  .cnt{color:#0b0b10;font-size:12px;font-weight:800;border-radius:999px;padding:1px 9px}
  .pitem{position:relative;border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-top:12px;
    background:var(--sub);box-shadow:0 10px 26px -20px rgba(0,0,0,.9)}
  .pitem-m{font-weight:700}
  .pitem-w,.pitem-r{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;margin-top:10px;padding:10px 12px;border-radius:8px;line-height:1.5}
  .pitem-w{color:#c7bef2;background:rgba(91,33,182,.16);border-left:3px solid var(--v)}
  .pitem-r{color:#A78BFA;background:rgba(167,139,250,.09);border-left:3px solid rgba(167,139,250,.55)}
  .pitem-w strong,.pitem-r strong{color:var(--ink)}
  .pic-i{flex:0 0 auto;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;
    border:1px solid var(--line);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),inset 0 -2px 5px rgba(0,0,0,.5);margin-top:1px}
  .pitem-w .pic-i{color:var(--vl);background:linear-gradient(150deg,rgba(139,92,246,.2),transparent)}
  .pitem-r .pic-i{color:#A78BFA;background:linear-gradient(150deg,rgba(167,139,250,.18),transparent)}
  .pic-i svg{width:14px;height:14px}
  .allgood{background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.25);color:#A78BFA;border-radius:16px;padding:16px;font-weight:600;margin-top:14px}
  /* Panneau générique (verre) */
  .panel{border:1px solid var(--line);border-radius:16px;padding:6px 4px;margin-top:14px;overflow-x:auto;
    background:linear-gradient(180deg,rgba(23,23,36,.55),rgba(17,17,26,.55))}
  .ftable{width:100%;border-collapse:collapse;font-size:13.5px;min-width:420px}
  .ftable th{text-align:left;color:var(--ink2);font-size:12px;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--line);padding:10px 14px}
  .ftable td{border-bottom:1px solid var(--line);padding:13px 14px;vertical-align:top}
  .ftable tr:last-child td{border-bottom:none}
  .fpath{font-family:ui-monospace,Menlo,monospace;color:var(--ink);white-space:nowrap}
  .fdesc{color:#c9c9d0}
  .fstat{white-space:nowrap;text-align:right}
  .fbadge{font-size:12px;font-weight:800;padding:5px 11px;border-radius:999px;white-space:nowrap;border:1px solid transparent}
  .fbadge.ok{background:rgba(167,139,250,.12);color:#A78BFA;border-color:rgba(167,139,250,.28)}
  .fbadge.bad{background:rgba(168,85,247,.14);color:#A855F7;border-color:rgba(168,85,247,.32)}
  /* Détails techniques — panneaux accordéon */
  .tech{margin-top:18px}
  .tech-sep{height:1px;margin:18px 0 4px;background:linear-gradient(90deg,transparent,rgba(139,92,246,.35),transparent)}
  .tech-note{background:var(--sub);border:1px solid var(--line);border-radius:12px;padding:12px 14px;color:var(--ink2);font-size:13px;margin-bottom:10px}
  details.module{border:1px solid var(--line);border-radius:14px;margin:12px 0;overflow:hidden;
    background:linear-gradient(180deg,rgba(23,23,36,.5),rgba(17,17,26,.5));box-shadow:0 18px 40px -30px rgba(0,0,0,.85)}
  .module-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px 18px;cursor:pointer;list-style:none;user-select:none}
  .module-head::-webkit-details-marker{display:none}
  .mh-title{display:flex;align-items:center;gap:10px;min-width:0}
  .mh-name{font-size:15.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mod-id{color:var(--ink2);font-weight:400;font-size:12px}
  .mchev{width:20px;height:20px;flex:0 0 auto;display:inline-flex;color:var(--vl);transition:transform .2s ease}
  .mchev svg{width:100%;height:100%}
  details.module[open] .mchev{transform:rotate(180deg)}
  .mscore{display:inline-flex;align-items:center;gap:8px;flex:0 0 auto}
  .mring{width:24px;height:24px;border-radius:50%;flex:0 0 auto;background:conic-gradient(var(--c) calc(var(--p)*1%),rgba(255,255,255,.09) 0);
    -webkit-mask:radial-gradient(circle 7px at center,transparent 98%,#000 100%);mask:radial-gradient(circle 7px at center,transparent 98%,#000 100%)}
  .mnum{font-weight:800;font-size:13.5px}
  .module-body{padding:2px 18px 16px}
  .mod-error{color:#A855F7;font-size:13px}.mod-note{color:var(--ink2);font-size:12px;font-style:italic}
  ul.findings{list-style:none;padding:0;margin:6px 0 0}
  ul.findings li{padding:13px 0;border-top:1px solid var(--line)}
  ul.findings li:first-child{border-top:none}
  .badge{color:var(--ink);font-size:11px;font-weight:800;padding:3px 9px;border-radius:8px;text-transform:uppercase;letter-spacing:.02em;
    background:color-mix(in srgb,var(--sc) 22%,transparent);border:1px solid color-mix(in srgb,var(--sc) 45%,transparent);color:var(--sc)}
  .msg{font-size:14px}
  .reco{font-size:13px;color:#c9c9d0;margin-top:8px;padding:8px 12px;border-left:3px solid var(--line);border-radius:0 8px 8px 0;background:rgba(255,255,255,.02)}
  .reco.why{border-left-color:var(--v);color:#c7bef2;background:rgba(91,33,182,.14)}
  .reco.act{border-left-color:rgba(167,139,250,.55);color:#A78BFA;background:rgba(167,139,250,.08)}
  .reco strong{color:var(--ink)}
  .ok{color:#A78BFA;font-size:14px}
  footer{margin-top:44px;padding-top:18px;border-top:1px solid var(--line);font-size:12px;color:var(--ink2);text-align:center;line-height:1.7}
  /* Révélation au scroll — masquée uniquement si le JS est actif (progressif) */
  .reveal{transition:opacity .25s ease,transform .25s ease}
  .js .reveal{opacity:0;transform:translateY(8px)}
  .js .reveal.in{opacity:1;transform:none}
  /* Anneau : animation de chargement unique */
  @keyframes ringload{from{stroke-dashoffset:${Cf}}to{stroke-dashoffset:${dashTarget}}}
  .ringsvg .prog.animate{animation:ringload 1100ms cubic-bezier(.22,.61,.36,1) both}
  /* Responsive iPhone-first */
  @media(max-width:640px){
    .page{padding:34px 16px 48px}
    .scorecard{flex-direction:column;text-align:center;gap:18px;padding:22px 18px}
    .scorecard .halo{left:50%;top:96px;transform:translateX(-50%)}
    .scoretext .cnt{margin-left:auto;margin-right:auto}
    .pcats{grid-template-columns:1fr}
    .bg .grid{display:none}.orb.o2{display:none}
    .cover .t{font-size:23px}
    .pcat,.pgroup{padding:16px}
  }
  @media(min-width:641px){ .pcats{gap:14px} }
  @media(prefers-reduced-motion:reduce){
    *{animation:none!important;transition:none!important;scroll-behavior:auto!important}
    .js .reveal,.reveal{opacity:1;transform:none}
    .ringsvg .prog{stroke-dashoffset:${dashTarget}}
  }
  @media print{body{background:#fff;color:#000}.bg{display:none}.page{padding:0}}
</style></head>
<body>
  <div class="bg" aria-hidden="true">
    <div class="rad"></div><div class="grid"></div>
    <div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div>
  </div>
  <div class="page">
  <header class="cover reveal">
    <div class="brand"><span class="blogo">${brand.picto ? brand.picto('radar', '#A78BFA') : ''}</span> <span>Sentinel<span class="b">Scope</span></span></div>
    <div class="t">Votre rapport de sécurité</div>
    <div class="target">${escapeHtml(target)}</div>
    <div class="date">Vérifié le ${escapeHtml(dateStr)}</div>
  </header>

  <div class="scorecard reveal">
    <div class="halo"></div>
    <div class="ringwrap">
      <div class="sphere"></div>
      <svg class="ringsvg" viewBox="0 0 150 150" aria-hidden="true">
        <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#A78BFA"/><stop offset="1" stop-color="#5B21B6"/>
        </linearGradient></defs>
        <circle cx="75" cy="75" r="${R}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="12"/>
        <circle class="prog" cx="75" cy="75" r="${R}" fill="none" stroke="url(#rg)" stroke-width="12" stroke-linecap="round"/>
      </svg>
      <div class="ringcenter"><div class="n">${scoring.score}</div><div class="o">/ 100</div></div>
    </div>
    <div class="scoretext">
      <div class="msg" style="color:${ps.color}">${escapeHtml(ps.title)}</div>
      <div class="sub">${escapeHtml(ps.sub)}</div>
      <div class="cnt">${warnCount > 0 ? 'Nous avons trouvé <strong>' + warnCount + ' point(s)</strong> à améliorer.' : 'Aucun point majeur à améliorer.'}</div>
    </div>
  </div>

  <h2 class="sec">En résumé</h2>
  <div class="muted small">Ce que nous avons vérifié sur votre site, en clair.</div>
  <div class="pcats">${renderPlainCategories(modules)}</div>

  <h2 class="sec">Vos priorités</h2>
  <div class="muted small">Pour chaque point : ce que c'est, pourquoi le changer, et ce qu'il faut faire.</div>
  ${renderPriorities(modules)}

  ${renderExposedFiles(modules)}

  <div class="tech">
    <div class="tech-sep"></div>
    <h2 class="sec" style="margin-top:14px">Détails techniques</h2>
    <div class="tech-note">Cette section s'adresse aux profils techniques (développeurs, prestataires informatiques). Vous pouvez la transmettre à la personne qui gère votre site.</div>
    ${modules.map(renderModuleCard).join('\n')}
  </div>

  <footer>Vérification passive et non intrusive — aucune requête agressive n'a été effectuée sur votre site.<br>
    Rapport fourni à titre informatif ; il ne constitue pas une garantie d'absence de vulnérabilité.</footer>
  </div>
<script>
(function(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  // Anneau : animation unique au chargement
  var prog = document.querySelector('.ringsvg .prog');
  if (prog && !reduce) { requestAnimationFrame(function(){ prog.classList.add('animate'); }); }
  // Révélation au scroll
  var items = [].slice.call(document.querySelectorAll('.reveal'));
  if (reduce || !('IntersectionObserver' in window)) { items.forEach(function(el){ el.classList.add('in'); }); }
  else {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){ if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: .12 });
    items.forEach(function(el){ io.observe(el); });
  }
  if (reduce || !fine) return;
  // Parallaxe très légère des orbes (desktop uniquement)
  var orbs = [].slice.call(document.querySelectorAll('.bg .orb'));
  window.addEventListener('mousemove', function(ev){
    var dx = (ev.clientX / window.innerWidth - .5), dy = (ev.clientY / window.innerHeight - .5);
    orbs.forEach(function(o,i){ var k = (i+1)*6; o.style.transform = 'translate('+(dx*k).toFixed(1)+'px,'+(dy*k).toFixed(1)+'px)'; });
  }, { passive: true });
  // Inclinaison 3D subtile des cartes du résumé (< 2°)
  document.querySelectorAll('.pcat.tilt').forEach(function(card){
    card.addEventListener('mousemove', function(ev){
      var r = card.getBoundingClientRect();
      var px = (ev.clientX - r.left)/r.width - .5, py = (ev.clientY - r.top)/r.height - .5;
      card.style.transform = 'perspective(700px) rotateX('+(-py*1.8).toFixed(2)+'deg) rotateY('+(px*1.8).toFixed(2)+'deg)';
    });
    card.addEventListener('mouseleave', function(){ card.style.transform = ''; });
  });
})();
</script>
</body></html>`;
}

async function generate(report, options = {}) {
  const html = buildHtml(report);
  const out = { html };

  if (options.htmlPath) {
    fs.mkdirSync(path.dirname(options.htmlPath), { recursive: true });
    fs.writeFileSync(options.htmlPath, html, 'utf8');
    out.htmlPath = options.htmlPath;
  }

  // Note : la génération PDF (puppeteer) de l'IXAUDIT d'origine est retirée
  // de cette copie « web » — SentinelScope ne sert que le rapport HTML.
  if (options.pdf) {
    out.pdfError = 'Export PDF non disponible dans cette version. Le rapport HTML reste disponible.';
  }
  return out;
}

module.exports = { generate, buildHtml };
