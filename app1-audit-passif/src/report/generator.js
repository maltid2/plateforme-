'use strict';

/**
 * Générateur de rapport
 *
 * Assemble les résultats JSON des modules + le score global dans un template
 * HTML, puis (optionnellement) exporte en PDF via Puppeteer.
 *
 * Puppeteer est chargé de façon paresseuse : si le paquet n'est pas installé
 * ou que le rendu échoue, le rapport HTML reste produit et exploitable.
 */

const fs = require('fs');
const path = require('path');

const SEVERITY_LABEL = {
  high: 'Élevé',
  medium: 'Moyen',
  low: 'Faible',
  info: 'Info',
};

const SEVERITY_COLOR = {
  high: '#c0392b',
  medium: '#e67e22',
  low: '#f1c40f',
  info: '#3498db',
};

const LETTER_COLOR = {
  A: '#27ae60',
  B: '#2ecc71',
  C: '#f39c12',
  D: '#e67e22',
  F: '#c0392b',
};

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderFindings(findings) {
  if (!findings || !findings.length) {
    return '<p class="ok">Aucun problème détecté sur ce contrôle. ✔</p>';
  }
  // Tri par sévérité (high -> info)
  const order = { high: 0, medium: 1, low: 2, info: 3 };
  const sorted = [...findings].sort(
    (a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9)
  );
  return (
    '<ul class="findings">' +
    sorted
      .map((f) => {
        const color = SEVERITY_COLOR[f.severity] || '#7f8c8d';
        const label = SEVERITY_LABEL[f.severity] || f.severity;
        return (
          '<li>' +
          '<span class="badge" style="background:' +
          color +
          '">' +
          escapeHtml(label) +
          '</span> ' +
          '<span class="msg">' +
          escapeHtml(f.message) +
          '</span>' +
          (f.recommendation
            ? '<div class="reco"><strong>Recommandation :</strong> ' +
              escapeHtml(f.recommendation) +
              '</div>'
            : '') +
          '</li>'
        );
      })
      .join('') +
    '</ul>'
  );
}

function renderModuleCard(mod) {
  if (!mod) return '';
  const scoreColor =
    mod.score >= 80 ? '#27ae60' : mod.score >= 60 ? '#f39c12' : '#c0392b';
  return (
    '<section class="module">' +
    '<div class="module-head">' +
    '<h3>' +
    escapeHtml(mod.name || mod.module) +
    ' <span class="mod-id">(' +
    escapeHtml(mod.module) +
    ')</span></h3>' +
    (mod.score != null
      ? '<span class="module-score" style="color:' +
        scoreColor +
        '">' +
        mod.score +
        '/100</span>'
      : '') +
    '</div>' +
    (mod.error
      ? '<p class="mod-error">⚠ ' + escapeHtml(mod.error) + '</p>'
      : '') +
    (mod.degraded
      ? '<p class="mod-note">Mode dégradé : une ou plusieurs sources externes n\'ont pas pu être interrogées.</p>'
      : '') +
    renderFindings(mod.findings) +
    '</section>'
  );
}

/**
 * Construit le HTML complet du rapport.
 */
function buildHtml(report) {
  const { target, generatedAt, scoring, modules } = report;
  const letter = scoring.letter;
  const letterColor = LETTER_COLOR[letter] || '#7f8c8d';

  const summaryRows = scoring.breakdown
    .map(
      (b) =>
        '<tr>' +
        '<td>' +
        escapeHtml(b.name) +
        ' <span class="mod-id">(' +
        escapeHtml(b.module) +
        ')</span></td>' +
        '<td class="num">' +
        (b.excluded ? '—' : b.score + '/100') +
        '</td>' +
        '<td class="num">' +
        b.weight +
        '%</td>' +
        '<td>' +
        (b.excluded ? '<em>exclu (dégradé)</em>' : b.error ? '⚠ erreur' : 'ok') +
        '</td>' +
        '</tr>'
    )
    .join('');

  const fs2 = scoring.findingsSummary;

  const modulesHtml = modules.map(renderModuleCard).join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Rapport d'audit de sécurité — ${escapeHtml(target)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
         color: #2c3e50; margin: 0; padding: 0; background: #fff; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px; }
  header.cover { text-align: center; padding: 30px 0 20px; border-bottom: 3px solid #ecf0f1; }
  header.cover h1 { font-size: 26px; margin: 0 0 6px; }
  header.cover .target { font-size: 16px; color: #7f8c8d; word-break: break-all; }
  header.cover .date { font-size: 13px; color: #95a5a6; margin-top: 6px; }
  .grade-box { display: flex; align-items: center; justify-content: center; gap: 24px;
               margin: 30px 0; }
  .grade { font-size: 90px; font-weight: 800; line-height: 1;
           width: 150px; height: 150px; border-radius: 16px; color: #fff;
           display: flex; align-items: center; justify-content: center; }
  .grade-meta { text-align: left; }
  .grade-meta .score { font-size: 34px; font-weight: 700; }
  .grade-meta .meaning { font-size: 15px; color: #7f8c8d; max-width: 280px; }
  .stat-row { display: flex; gap: 12px; justify-content: center; margin: 20px 0 10px; flex-wrap: wrap; }
  .stat { border-radius: 10px; padding: 12px 18px; color: #fff; text-align: center; min-width: 90px; }
  .stat .n { font-size: 24px; font-weight: 700; }
  .stat .l { font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }
  h2.section-title { margin-top: 36px; font-size: 20px; border-bottom: 2px solid #ecf0f1; padding-bottom: 6px; }
  table.summary { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
  table.summary th, table.summary td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #ecf0f1; }
  table.summary th { background: #f8f9fa; }
  table.summary td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .module { border: 1px solid #ecf0f1; border-radius: 10px; padding: 16px 20px; margin: 16px 0; }
  .module-head { display: flex; justify-content: space-between; align-items: baseline; }
  .module-head h3 { margin: 0; font-size: 17px; }
  .mod-id { color: #95a5a6; font-weight: normal; font-size: 13px; }
  .module-score { font-weight: 700; font-size: 16px; }
  .mod-error { color: #c0392b; font-size: 14px; }
  .mod-note { color: #7f8c8d; font-size: 13px; font-style: italic; }
  ul.findings { list-style: none; padding: 0; margin: 10px 0 0; }
  ul.findings li { padding: 10px 0; border-top: 1px dashed #ecf0f1; }
  .badge { color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px;
           text-transform: uppercase; letter-spacing: .5px; }
  .msg { font-size: 14px; }
  .reco { font-size: 13px; color: #34495e; margin-top: 4px; padding-left: 8px; border-left: 3px solid #bdc3c7; }
  .ok { color: #27ae60; font-size: 14px; }
  footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ecf0f1;
           font-size: 12px; color: #95a5a6; text-align: center; }
  .disclaimer { font-size: 11px; color: #b0b7bd; margin-top: 8px; }
</style>
</head>
<body>
<div class="page">
  <header class="cover">
    <h1>Rapport d'audit de sécurité web (passif)</h1>
    <div class="target">${escapeHtml(target)}</div>
    <div class="date">Généré le ${escapeHtml(generatedAt)}</div>
  </header>

  <div class="grade-box">
    <div class="grade" style="background:${letterColor}">${escapeHtml(letter)}</div>
    <div class="grade-meta">
      <div class="score">${scoring.score}/100</div>
      <div class="meaning">${escapeHtml(scoring.meaning)}</div>
    </div>
  </div>

  <div class="stat-row">
    <div class="stat" style="background:${SEVERITY_COLOR.high}"><div class="n">${fs2.high || 0}</div><div class="l">Élevé</div></div>
    <div class="stat" style="background:${SEVERITY_COLOR.medium}"><div class="n">${fs2.medium || 0}</div><div class="l">Moyen</div></div>
    <div class="stat" style="background:${SEVERITY_COLOR.low}"><div class="n">${fs2.low || 0}</div><div class="l">Faible</div></div>
    <div class="stat" style="background:${SEVERITY_COLOR.info}"><div class="n">${fs2.info || 0}</div><div class="l">Info</div></div>
  </div>

  <h2 class="section-title">Synthèse par module</h2>
  <table class="summary">
    <thead><tr><th>Module</th><th class="num">Note</th><th class="num">Poids</th><th>État</th></tr></thead>
    <tbody>${summaryRows}</tbody>
  </table>

  <h2 class="section-title">Détail des contrôles</h2>
  ${modulesHtml}

  <footer>
    Audit passif non intrusif — aucune requête agressive n'a été effectuée.<br>
    <span class="disclaimer">Ce rapport est fourni à titre informatif et ne constitue pas une garantie d'absence de vulnérabilité.</span>
  </footer>
</div>
</body>
</html>`;
}

/**
 * Génère le rapport HTML et, si demandé, le PDF.
 * @param {object} report - { target, generatedAt, scoring, modules }
 * @param {object} [options] - { htmlPath, pdfPath, pdf }
 * @returns {Promise<{ html: string, htmlPath?: string, pdfPath?: string }>}
 */
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
      // Chargement paresseux de Puppeteer.
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        ...(process.env.PUPPETEER_EXECUTABLE_PATH
          ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
          : {}),
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      fs.mkdirSync(path.dirname(options.pdfPath), { recursive: true });
      await page.pdf({
        path: options.pdfPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
      });
      await browser.close();
      out.pdfPath = options.pdfPath;
    } catch (err) {
      out.pdfError =
        'Génération PDF impossible (' +
        err.message +
        '). Le rapport HTML reste disponible.';
    }
  }

  return out;
}

module.exports = { generate, buildHtml };
