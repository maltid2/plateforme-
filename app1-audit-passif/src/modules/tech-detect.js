'use strict';

/**
 * Module C — Détection de technologies + CVE
 *
 * 1. Empreinte technologique (fingerprinting) à partir des en-têtes,
 *    cookies, balises meta et motifs HTML/JS caractéristiques. Le format de
 *    la base de signatures s'inspire de Wappalyzer (open source).
 * 2. Pour chaque techno + version identifiée, interrogation de l'API NVD
 *    (National Vulnerability Database) pour lister les CVE connues,
 *    filtrées par sévérité CVSS.
 *
 * Sans clé API NVD, le module fonctionne en mode dégradé (fingerprinting
 * seul, sans enrichissement CVE) sans jamais échouer.
 */

const fs = require('fs');
const path = require('path');
const http = require('./http-client');

const NVD_API = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

function loadFingerprints() {
  try {
    // require() (au lieu de fs) pour que le bundler Vercel embarque le JSON.
    const data = require('../../data/fingerprints.json');
    const list = (data && data.technologies) || [];
    // On ignore les entrées de commentaire/section (sans nom réel).
    return list.filter((t) => t && typeof t.name === 'string');
  } catch (err) {
    return [];
  }
}

/**
 * Applique une regex éventuelle et renvoie { matched, version }.
 */
function matchPattern(pattern, haystack) {
  if (pattern === '' || pattern == null) {
    // Présence seule (ex: en-tête existe), pas de contrainte de valeur.
    return { matched: haystack != null, version: null };
  }
  let re;
  try {
    re = new RegExp(pattern, 'i');
  } catch (e) {
    return { matched: String(haystack || '').includes(pattern), version: null };
  }
  const m = re.exec(String(haystack || ''));
  if (!m) return { matched: false, version: null };
  return { matched: true, version: m[1] || null };
}

/**
 * Analyse la réponse et détecte les technologies.
 */
function detectTechnologies(fingerprints, headers, body, cookies) {
  const detected = [];

  for (const tech of fingerprints) {
    let matched = false;
    let version = null;

    // Headers
    if (tech.headers) {
      for (const [hKey, pattern] of Object.entries(tech.headers)) {
        const val = headers[hKey.toLowerCase()];
        if (val == null) continue;
        const r = matchPattern(pattern, val);
        if (r.matched) {
          matched = true;
          if (r.version) version = r.version;
        }
      }
    }

    // Meta (generator etc.) — on cherche dans le HTML
    if (tech.meta && body) {
      for (const [metaName, pattern] of Object.entries(tech.meta)) {
        const metaRe = new RegExp(
          '<meta[^>]+name=["\']' + metaName + '["\'][^>]+content=["\']([^"\']*)["\']',
          'i'
        );
        const mm = metaRe.exec(body);
        if (mm) {
          const r = matchPattern(pattern, mm[1]);
          if (r.matched) {
            matched = true;
            if (r.version) version = r.version;
          }
        }
      }
    }

    // HTML patterns
    if (tech.html && body) {
      for (const pattern of tech.html) {
        const r = matchPattern(pattern, body);
        if (r.matched) {
          matched = true;
          if (r.version && !version) version = r.version;
        }
      }
    }

    // Cookies
    if (tech.cookies && cookies.length) {
      for (const pattern of tech.cookies) {
        if (cookies.some((c) => c.toLowerCase().includes(pattern.toLowerCase()))) {
          matched = true;
        }
      }
    }

    if (matched) {
      detected.push({
        name: tech.name,
        category: tech.category,
        version: version || null,
        cpe: tech.cpe || null,
      });
    }
  }

  return detected;
}

/**
 * Interroge l'API NVD pour une techno + version.
 * Renvoie une liste de CVE filtrées par sévérité minimale.
 */
async function fetchCVEs(tech, apiKey, minCvss, timeout) {
  if (!tech.cpe || !tech.version) return [];

  // Construction d'un CPE match string : cpe base + version.
  const cpeName = tech.cpe + ':' + tech.version;
  const headers = apiKey ? { apiKey } : {};

  try {
    const res = await http.get(NVD_API, {
      params: { cpeName, resultsPerPage: 20 },
      headers,
      timeout: timeout || 20000,
      responseType: 'json',
    });

    if (res.status !== 200 || !res.data || !Array.isArray(res.data.vulnerabilities)) {
      return [];
    }

    const cves = [];
    for (const v of res.data.vulnerabilities) {
      const cve = v.cve;
      if (!cve) continue;
      const metrics = cve.metrics || {};
      let score = null;
      let severity = null;
      const m =
        (metrics.cvssMetricV31 && metrics.cvssMetricV31[0]) ||
        (metrics.cvssMetricV30 && metrics.cvssMetricV30[0]) ||
        (metrics.cvssMetricV2 && metrics.cvssMetricV2[0]);
      if (m && m.cvssData) {
        score = m.cvssData.baseScore;
        severity = m.baseSeverity || m.cvssData.baseSeverity || null;
      }
      if (score != null && score < minCvss) continue;

      const descEn =
        (cve.descriptions || []).find((d) => d.lang === 'en') ||
        (cve.descriptions || [])[0];
      cves.push({
        id: cve.id,
        cvss: score,
        severity,
        summary: descEn ? descEn.value.slice(0, 300) : null,
      });
    }
    // Tri par CVSS décroissant
    cves.sort((a, b) => (b.cvss || 0) - (a.cvss || 0));
    return cves;
  } catch (err) {
    return [];
  }
}

async function run(targetUrl, options = {}) {
  const result = {
    module: 'C',
    name: 'Technologies + CVE',
    target: targetUrl,
    technologies: [],
    cveByTech: {},
    findings: [],
    score: 100,
    error: null,
    degraded: false,
  };

  const fingerprints = loadFingerprints();

  let res;
  try {
    res = await http.get(targetUrl, { timeout: options.timeout });
  } catch (err) {
    result.error = 'Requête impossible : ' + err.message;
    result.score = 50;
    return result;
  }

  const headers = res.headers || {};
  const body = typeof res.data === 'string' ? res.data : '';
  const setCookie = headers['set-cookie'] || [];
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];

  const detected = detectTechnologies(fingerprints, headers, body, cookies);
  result.technologies = detected;

  const apiKey = options.nvdApiKey || process.env.NVD_API_KEY || null;
  const minCvss = options.minCvss != null ? options.minCvss : 7.0; // High/Critical
  if (!apiKey) {
    result.degraded = true;
  }

  let totalCriticalOrHigh = 0;

  for (const tech of detected) {
    if (!tech.version || !tech.cpe) continue;
    const cves = await fetchCVEs(tech, apiKey, minCvss, options.timeout);
    if (cves.length) {
      result.cveByTech[tech.name + ' ' + tech.version] = cves;
      for (const c of cves) {
        if (c.cvss != null && c.cvss >= 7) totalCriticalOrHigh++;
      }
      result.findings.push({
        id: 'cve-' + tech.name.toLowerCase(),
        severity: cves.some((c) => c.cvss >= 9) ? 'high' : 'medium',
        message:
          tech.name +
          ' ' +
          tech.version +
          ' : ' +
          cves.length +
          ' CVE de sévérité >= ' +
          minCvss +
          ' identifiée(s) (' +
          cves.slice(0, 3).map((c) => c.id).join(', ') +
          (cves.length > 3 ? ', ...' : '') +
          ').',
        recommendation:
          'Mettre à jour ' +
          tech.name +
          ' vers une version corrigée et suivre les avis de sécurité.',
      });
    }
  }

  // Divulgation de version = finding léger
  for (const tech of detected) {
    if (tech.version) {
      result.findings.push({
        id: 'version-disclosure-' + tech.name.toLowerCase(),
        severity: 'low',
        message:
          'Version exposée : ' + tech.name + ' ' + tech.version + '.',
        recommendation:
          'Masquer les numéros de version pour compliquer le ciblage automatisé.',
      });
    }
  }

  // Score : pénalité selon le nombre de CVE High/Critical.
  result.score = Math.max(0, 100 - totalCriticalOrHigh * 15);

  return result;
}

module.exports = { run, detectTechnologies, loadFingerprints };
