'use strict';

/**
 * Source : Genetec Supported Device List (SDL).
 *
 * La page https://www.genetec.com/supported-device-list est une application
 * React qui interroge l'API de recherche publique ci-dessous. Chaque appareil
 * y expose un bloc `firmware_information` (JSON) qui liste, pour Security
 * Center, chaque firmware testé avec sa certification et la version SC.
 *
 * Les identifiants moteur / data store sont lus dans la configuration de la
 * page (resourceapi, clé `sdl.config`) ; les valeurs ci-dessous ne servent
 * que de repli.
 */

const { compareVersions } = require('../lib/version');

const SEARCH_URL = 'https://www.genetec.com/restservices/public/search';
const CONFIG_URL = 'https://www.genetec.com/resourceapi/supported-device-list?page=1';
const PAGE_URL = 'https://www.genetec.com/supported-device-list';
const FALLBACK = {
  engineId: 'gen-prod-en-sdl_1779984486679',
  dataStore: 'gen-prod-en-pub-sdl-camera_3690587630811',
};
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let configCache = null;

/** Lit engineId / dataStore caméra depuis la configuration publiée de la page. */
async function loadConfig() {
  if (configCache) return configCache;
  configCache = { ...FALLBACK };
  try {
    const res = await fetch(CONFIG_URL, { headers: { 'user-agent': UA } });
    const text = await res.text();
    const engine = text.match(/"sdl_default_engine_id"\s*:\s*"([^"]+)"/);
    const store = text.match(/"sdl_camera_datastore_id"\s*:\s*"([^"]+)"/);
    if (engine) configCache.engineId = engine[1];
    if (store) configCache.dataStore = store[1];
  } catch {
    /* repli sur les valeurs connues */
  }
  return configCache;
}

async function search(query, { limit = 50, page = 1, retries = 3 } = {}) {
  const cfg = await loadConfig();
  const body = {
    query,
    engineId: cfg.engineId,
    limit,
    page,
    facets: ['manufacturer', 'device_type'],
    dataStores: [cfg.dataStore],
    languageCode: 'en-US',
    spellCorrectionMode: 'AUTO',
    includeSnippet: false,
  };
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(SEARCH_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          origin: 'https://www.genetec.com',
          referer: PAGE_URL,
          'user-agent': UA,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status + ' sur l\'API Genetec');
      const json = await res.json();
      return (json.results || []).map(normalize).filter(Boolean);
    } catch (err) {
      if (attempt >= retries) throw err;
      await sleep(2000 * 2 ** attempt);
    }
  }
}

const parseJson = (s) => {
  if (s && typeof s === 'object') return s;
  try { return JSON.parse(s); } catch { return {}; }
};

/** « 5.9.4.0 Driver Pack 10.10.0 » → { securityCenter, driverPack } */
function splitRelease(value) {
  const out = { raw: value || null };
  const sc = String(value || '').match(/^\s*v?(\d+(?:\.\d+)+)/);
  if (sc) out.securityCenter = sc[1];
  const dp = String(value || '').match(/driver ?pack\s*:?\s*v?(\d+(?:\.\d+)+)/i);
  if (dp) out.driverPack = dp[1];
  return out;
}

/** Résultat brut de l'API → appareil au schéma Tarik. */
function normalize(result) {
  const d = (result.document && result.document.structData) || result.structData || result;
  if (!d || !(d.model || d.title)) return null;
  const fw = parseJson(d.firmware_information);
  const sc = fw.SecurityCenter || {};
  const firmwares = (fw.AllFirmwares || [])
    .filter((f) => !f.Product || /security center/i.test(f.Product))
    .map((f) => {
      const rel = splitRelease((f.Releases || [])[0]);
      return {
        version: String(f.FirmwareName || '').trim(),
        certification: f.Certification || null,
        securityCenter: rel.securityCenter || null,
        driverPack: rel.driverPack || null,
      };
    })
    .filter((f) => f.version)
    .sort((a, b) => compareVersions(a.version, b.version) || 0);
  const initial = splitRelease(sc.SecurityCenterInitialRelease || d.security_center_initial_firmware);
  const basic = parseJson(d.basic_information);
  return {
    source: 'genetec',
    id: String(d.id || result.id || ''),
    manufacturer: d.manufacturer || basic.ManufacturerName || null,
    model: d.model || d.title,
    type: d.device_type || null,
    status: sc.SecurityCenterStatus || null,
    latestFirmware: sc.SecurityCenterLatestFirmware || d.security_center_latest_firmware || null,
    securityCenter: initial.securityCenter || null,
    driverPack: initial.driverPack || null,
    firmwares,
    extension: basic.Extension || null,
    comments: d.comments || basic.Comments || null,
    equivalentModels: d.equivalent_models || null,
    url: `${PAGE_URL}?query=${encodeURIComponent(d.model || d.title)}`,
  };
}

/** Télécharge toute la liste caméras (pagination jusqu'à épuisement). */
async function crawl({ limit = 100, maxPages = 1000, delayMs = 500, log = () => {} } = {}) {
  const byId = new Map();
  for (let page = 1; page <= maxPages; page++) {
    const batch = await search('', { limit, page });
    let added = 0;
    for (const dev of batch) {
      const key = dev.id || `${dev.manufacturer}|${dev.model}`;
      if (!byId.has(key)) {
        byId.set(key, dev);
        added++;
      }
    }
    log(`page ${page} : ${batch.length} appareils (${added} nouveaux, total ${byId.size})`);
    if (!batch.length || !added) break;
    await sleep(delayMs);
  }
  return [...byId.values()];
}

module.exports = { search, crawl, normalize, splitRelease, loadConfig };
