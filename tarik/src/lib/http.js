'use strict';

/**
 * Client HTTP minimal (fetch natif Node ≥ 18) avec retry exponentiel et
 * délai de politesse entre requêtes pour ne pas surcharger le site source.
 */

const UA =
  'Mozilla/5.0 (compatible; Tarik/1.0; +https://github.com/maltid2/plateforme-)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getText(url, { retries = 3, timeout = 30000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeout);
      const res = await fetch(url, {
        headers: { 'user-agent': UA, accept: 'text/html,application/json,*/*' },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('HTTP ' + res.status + ' pour ' + url);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(2000 * 2 ** attempt);
    }
  }
  throw lastErr;
}

module.exports = { getText, sleep };
