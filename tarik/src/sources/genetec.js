'use strict';

/**
 * Source : Genetec Supported Device List (SDL).
 *
 *   Liste paginée : https://www.genetec.com/supported-device-list?page=N
 *   Fiche détail  : https://www.genetec.com/solutions/resources/supported-device-list/detail?pid=N
 *
 * Chaque appareil y indique le dernier firmware validé pour Security Center
 * (« Latest firmware supported (SC) ») et la version de Security Center /
 * Driver Pack à partir de laquelle il est supporté.
 *
 * Le parsing repose sur les libellés de colonnes (et non leur position) pour
 * résister aux changements de mise en page : voir COLUMNS.
 */

const { getText, sleep } = require('../lib/http');
const html = require('../lib/html');

const BASE = 'https://www.genetec.com';
const LIST_URL = (page) => `${BASE}/supported-device-list?page=${page}`;
const DETAIL_URL = (pid) =>
  `${BASE}/solutions/resources/supported-device-list/detail?pid=${pid}`;

// Champ normalisé → motifs de libellé (colonne de liste ou fiche détail).
const COLUMNS = {
  manufacturer: /manufacturer|fabricant|vendor|brand|marque/i,
  model: /model|mod[eè]le|product|produit|device name/i,
  type: /device type|^type|category|cat[eé]gorie/i,
  firmware: /firmware/i,
  securityCenter: /security ?center|^sc\b|supported (in|since)|version/i,
  driverPack: /driver ?pack/i,
  protocol: /protocol|protocole|integration|driver\b/i,
  features: /feature|capabilit|fonctionnalit/i,
};

function fieldFor(label) {
  // L'ordre compte : firmware et driver pack avant le motif générique « version ».
  for (const key of ['firmware', 'driverPack', 'manufacturer', 'model', 'type',
    'protocol', 'features', 'securityCenter']) {
    if (COLUMNS[key].test(label)) return key;
  }
  return null;
}

/**
 * Découpe une cellule du type « Security Center: 5.11.0.1 Driver Pack 11.11.0 »
 * en { securityCenter: "5.11.0.1", driverPack: "11.11.0" }.
 */
function splitScCell(value) {
  const out = {};
  const sc = value.match(/(?:security ?center|sc)\s*:?\s*v?(\d+(?:\.\d+)+)/i) ||
    value.match(/^v?(\d+(?:\.\d+)+)/);
  if (sc) out.securityCenter = sc[1];
  const dp = value.match(/driver ?pack\s*:?\s*v?(\d+(?:\.\d+)+)/i);
  if (dp) out.driverPack = dp[1];
  return out;
}

function pidFrom(urls) {
  for (const u of urls || []) {
    const m = u.match(/[?&](?:pid|id)=(\d+)/);
    if (m) return m[1];
  }
  return null;
}

/** Normalise un enregistrement { libellé: valeur } vers le schéma Tarik. */
function normalize(record, extra = {}) {
  const dev = { source: 'genetec', ...extra, raw: {} };
  for (const [label, value] of Object.entries(record)) {
    if (!value) continue;
    dev.raw[label] = value;
    const key = fieldFor(label);
    if (!key) continue;
    if (key === 'securityCenter' || key === 'driverPack') {
      const parsed = splitScCell(value);
      if (parsed.securityCenter && !dev.securityCenter) dev.securityCenter = parsed.securityCenter;
      if (parsed.driverPack && !dev.driverPack) dev.driverPack = parsed.driverPack;
      if (key === 'driverPack' && !dev.driverPack) dev.driverPack = value;
      if (key === 'securityCenter') dev.securityCenterRaw = value;
    } else if (!dev[key]) {
      dev[key] = value;
    }
  }
  if (dev.pid) dev.url = DETAIL_URL(dev.pid);
  return dev;
}

/** Extrait les appareils d'une page de liste HTML. */
function parseListPage(page) {
  const devices = [];
  for (const t of html.tables(page)) {
    if (!t.headers.some((h) => /firmware/i.test(h)) &&
      !t.headers.some((h) => /model|product/i.test(h))) continue;
    for (const row of t.rows) {
      const record = {};
      t.headers.forEach((h, i) => (record[h || `col${i}`] = row.cells[i] || ''));
      const dev = normalize(record, { pid: pidFrom(row.links) });
      if (dev.model || dev.manufacturer) devices.push(dev);
    }
  }
  return devices;
}

/** Extrait un appareil d'une fiche détail HTML. */
function parseDetailPage(page, pid) {
  const dev = normalize(html.labelValues(page), { pid: pid != null ? String(pid) : null });
  return dev.model || dev.firmware ? dev : null;
}

const keyOf = (d) =>
  d.pid || [d.manufacturer, d.model, d.firmware].map((s) => (s || '').toLowerCase()).join('|');

/**
 * Parcourt la liste paginée jusqu'à une page vide ou sans nouveauté.
 * Options : maxPages, delayMs, details (enrichit via la fiche détail), log.
 */
async function crawl({ maxPages = 500, delayMs = 800, details = false, log = () => {} } = {}) {
  const byKey = new Map();
  for (let page = 1; page <= maxPages; page++) {
    const body = await getText(LIST_URL(page));
    if (!body) break;
    const found = parseListPage(body);
    let added = 0;
    for (const d of found) {
      const k = keyOf(d);
      if (!byKey.has(k)) {
        byKey.set(k, d);
        added++;
      }
    }
    log(`page ${page} : ${found.length} appareils (${added} nouveaux)`);
    if (!found.length || !added) break;
    await sleep(delayMs);
  }

  if (details) {
    for (const d of byKey.values()) {
      if (!d.pid) continue;
      try {
        const body = await getText(DETAIL_URL(d.pid));
        const det = body && parseDetailPage(body, d.pid);
        if (det) {
          for (const [k, v] of Object.entries(det)) {
            if (k === 'raw') Object.assign(d.raw, v);
            else if (v && !d[k]) d[k] = v;
          }
        }
      } catch (err) {
        log(`détail pid=${d.pid} ignoré : ${err.message}`);
      }
      await sleep(delayMs);
    }
  }

  return [...byKey.values()];
}

module.exports = {
  crawl,
  parseListPage,
  parseDetailPage,
  splitScCell,
  LIST_URL,
  DETAIL_URL,
};
