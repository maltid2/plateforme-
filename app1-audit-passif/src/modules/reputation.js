'use strict';

/**
 * Module B — Réputation et malware
 *
 * Agrège plusieurs sources de réputation :
 *   - Google Safe Browsing API (clé Google Cloud gratuite)
 *   - VirusTotal API (quota gratuit)
 *
 * Toutes les sources sont optionnelles : sans clé API, la source est
 * marquée « skipped » et le module fonctionne en mode dégradé sans échouer.
 * Aucune de ces requêtes n'est intrusive vis-à-vis de la cible (ce sont des
 * lookups auprès de services tiers).
 */

const http = require('./http-client');
const { URL } = require('url');

const SAFE_BROWSING_API =
  'https://safebrowsing.googleapis.com/v4/threatMatches:find';
const VIRUSTOTAL_DOMAIN_API = 'https://www.virustotal.com/api/v3/domains/';

async function checkSafeBrowsing(targetUrl, apiKey, timeout) {
  if (!apiKey) return { source: 'Google Safe Browsing', status: 'skipped', reason: 'clé API absente' };

  const payload = {
    client: { clientId: 'sec-audit-passive', clientVersion: '1.0' },
    threatInfo: {
      threatTypes: [
        'MALWARE',
        'SOCIAL_ENGINEERING',
        'UNWANTED_SOFTWARE',
        'POTENTIALLY_HARMFUL_APPLICATION',
      ],
      platformTypes: ['ANY_PLATFORM'],
      threatEntryTypes: ['URL'],
      threatEntries: [{ url: targetUrl }],
    },
  };

  try {
    const res = await http.post(SAFE_BROWSING_API, payload, {
      params: { key: apiKey },
      timeout: timeout || 15000,
      responseType: 'json',
    });
    if (res.status !== 200) {
      return {
        source: 'Google Safe Browsing',
        status: 'error',
        reason: 'HTTP ' + res.status,
      };
    }
    const matches = res.data && res.data.matches ? res.data.matches : [];
    return {
      source: 'Google Safe Browsing',
      status: 'ok',
      flagged: matches.length > 0,
      threats: matches.map((m) => m.threatType),
    };
  } catch (err) {
    return { source: 'Google Safe Browsing', status: 'error', reason: err.message };
  }
}

async function checkVirusTotal(domain, apiKey, timeout) {
  if (!apiKey) return { source: 'VirusTotal', status: 'skipped', reason: 'clé API absente' };

  try {
    const res = await http.get(VIRUSTOTAL_DOMAIN_API + encodeURIComponent(domain), {
      headers: { 'x-apikey': apiKey },
      timeout: timeout || 15000,
      responseType: 'json',
    });
    if (res.status !== 200) {
      return { source: 'VirusTotal', status: 'error', reason: 'HTTP ' + res.status };
    }
    const stats =
      res.data &&
      res.data.data &&
      res.data.data.attributes &&
      res.data.data.attributes.last_analysis_stats
        ? res.data.data.attributes.last_analysis_stats
        : {};
    const malicious = stats.malicious || 0;
    const suspicious = stats.suspicious || 0;
    return {
      source: 'VirusTotal',
      status: 'ok',
      flagged: malicious + suspicious > 0,
      malicious,
      suspicious,
      harmless: stats.harmless || 0,
    };
  } catch (err) {
    return { source: 'VirusTotal', status: 'error', reason: err.message };
  }
}

async function run(targetUrl, options = {}) {
  const parsed = new URL(targetUrl);
  const domain = parsed.hostname;

  const result = {
    module: 'B',
    name: 'Réputation et malware',
    target: domain,
    sources: [],
    findings: [],
    score: 100,
    degraded: false,
    error: null,
  };

  const sbKey = options.safeBrowsingKey || process.env.SAFE_BROWSING_API_KEY || null;
  const vtKey = options.virusTotalKey || process.env.VIRUSTOTAL_API_KEY || null;

  const [sb, vt] = await Promise.all([
    checkSafeBrowsing(targetUrl, sbKey, options.timeout),
    checkVirusTotal(domain, vtKey, options.timeout),
  ]);

  result.sources.push(sb, vt);

  let flagged = false;
  for (const s of [sb, vt]) {
    if (s.status === 'skipped') result.degraded = true;
    if (s.status === 'ok' && s.flagged) {
      flagged = true;
      result.findings.push({
        id: 'reputation-' + s.source.toLowerCase().replace(/\s+/g, '-'),
        severity: 'high',
        message:
          s.source +
          ' signale le domaine comme potentiellement malveillant' +
          (s.threats ? ' (' + s.threats.join(', ') + ')' : '') +
          (s.malicious != null ? ' (' + s.malicious + ' moteurs)' : '') +
          '.',
        recommendation:
          'Investiguer une éventuelle compromission ; demander un réexamen après nettoyage.',
      });
    }
  }

  if (flagged) {
    result.score = 0;
  } else if (result.degraded && sb.status === 'skipped' && vt.status === 'skipped') {
    // Aucune source disponible : on reste neutre plutôt que de sur-noter.
    result.score = 100;
    result.findings.push({
      id: 'reputation-no-source',
      severity: 'info',
      message:
        'Aucune source de réputation n\'a pu être interrogée (clés API absentes).',
      recommendation:
        'Configurer SAFE_BROWSING_API_KEY et/ou VIRUSTOTAL_API_KEY pour activer ce contrôle.',
    });
  }

  return result;
}

module.exports = { run };
