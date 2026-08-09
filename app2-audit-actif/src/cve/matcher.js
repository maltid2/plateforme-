'use strict';

/**
 * Module — Matching CVE
 *
 * Même logique que le Module C de l'App 1 : à partir d'un service + version
 * détecté (via banner grabbing), interroge l'API NVD (National Vulnerability
 * Database) pour lister les CVE connues, priorisées par score CVSS.
 *
 * Sans clé API NVD, le module fonctionne (le quota anonyme est simplement
 * plus restrictif) ; en cas d'erreur réseau, il renvoie une liste vide sans
 * jamais faire échouer le scan.
 */

const axios = require('axios');

const NVD_API = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

/**
 * Interroge NVD pour un couple (cpe, version).
 * @returns {Promise<object[]>} CVE triées par CVSS décroissant
 */
async function fetchCVEs(cpe, version, options = {}) {
  if (!cpe || !version) return [];
  const apiKey = options.nvdApiKey || process.env.NVD_API_KEY || null;
  const minCvss = options.minCvss != null ? options.minCvss : 0;
  const cpeName = cpe + ':' + version;
  const headers = apiKey ? { apiKey } : {};

  try {
    const res = await axios.get(NVD_API, {
      params: { cpeName, resultsPerPage: 25 },
      headers,
      timeout: options.timeout || 20000,
      validateStatus: () => true,
    });
    if (res.status !== 200 || !res.data || !Array.isArray(res.data.vulnerabilities)) {
      return [];
    }

    const cves = [];
    for (const v of res.data.vulnerabilities) {
      const cve = v.cve;
      if (!cve) continue;
      const metrics = cve.metrics || {};
      const m =
        (metrics.cvssMetricV31 && metrics.cvssMetricV31[0]) ||
        (metrics.cvssMetricV30 && metrics.cvssMetricV30[0]) ||
        (metrics.cvssMetricV2 && metrics.cvssMetricV2[0]);
      let score = null;
      let severity = null;
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
        published: cve.published || null,
      });
    }
    cves.sort((a, b) => (b.cvss || 0) - (a.cvss || 0));
    return cves;
  } catch (err) {
    return [];
  }
}

/**
 * Prend la sortie du banner grabbing et enrichit chaque service avec ses CVE.
 * @param {object[]} services - [{ port, service, version, cpe, raw }]
 * @param {object} [options]
 * @returns {Promise<object[]>}
 */
async function matchServices(services, options = {}) {
  const enriched = [];
  for (const svc of services) {
    let cves = [];
    if (svc.cpe && svc.version) {
      cves = await fetchCVEs(svc.cpe, svc.version, options);
    }
    enriched.push({
      ...svc,
      cveCount: cves.length,
      criticalCount: cves.filter((c) => c.cvss != null && c.cvss >= 9).length,
      highCount: cves.filter((c) => c.cvss != null && c.cvss >= 7 && c.cvss < 9).length,
      cves,
    });
  }
  // Priorisation : services avec le plus de CVE critiques en premier.
  enriched.sort(
    (a, b) =>
      b.criticalCount - a.criticalCount ||
      b.highCount - a.highCount ||
      b.cveCount - a.cveCount
  );
  return enriched;
}

module.exports = { fetchCVEs, matchServices };
