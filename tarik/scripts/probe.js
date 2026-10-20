'use strict';

/**
 * Sonde de diagnostic : ouvre la Supported Device List dans un vrai navigateur
 * (Playwright) et journalise les appels réseau JSON faits par l'application
 * React, pour identifier l'API de données à utiliser dans sources/genetec.js.
 *
 * Usage (CI) : npm i --no-save playwright && npx playwright install chromium
 *              node scripts/probe.js [URL ...]
 */

const { chromium } = require('playwright');

const URLS = process.argv.slice(2).length ? process.argv.slice(2) : [
  'https://www.genetec.com/supported-device-list?page=1',
  'https://www.genetec.com/solutions/resources/supported-device-list/detail?pid=2528',
];

(async () => {
  const browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    locale: 'en-US',
    viewport: { width: 1366, height: 900 },
  });
  const page = await context.newPage();
  page.on('console', (m) => console.log(`[console.${m.type()}] ${m.text().slice(0, 300)}`));
  page.on('pageerror', (e) => console.log('[pageerror] ' + e.message.slice(0, 300)));
  page.on('requestfailed', (r) => console.log(`[échec] ${r.url().slice(0, 200)} ${r.failure() && r.failure().errorText}`));
  page.on('response', async (res) => {
    const type = res.headers()['content-type'] || '';
    const req = res.request();
    if (!/google|cookielaw|doubleclick|facebook|linkedin|bing|hotjar/.test(res.url())) {
      console.log(`[${req.resourceType()}] ${res.status()} ${type.split(';')[0]} ${res.url().slice(0, 200)}`);
    }
    if (!/json/i.test(type) && !['xhr', 'fetch'].includes(req.resourceType())) return;
    let body = '';
    try { body = await res.text(); } catch { /* corps indisponible */ }
    console.log(`\n>>> ${req.method()} ${res.status()} ${res.url()}`);
    if (req.postData()) console.log('    POST : ' + req.postData().slice(0, 600));
    console.log('    ' + body.slice(0, 1500).replace(/\s+/g, ' '));
  });
  for (const url of URLS) {
    console.log(`\n===== ${url} =====`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => console.log('goto : ' + e.message));
    await page.waitForTimeout(5000);
    const text = await page.evaluate(() => document.body.innerText).catch(() => '');
    const htmlLen = await page.evaluate(() => document.documentElement.outerHTML.length).catch(() => 0);
    console.log(`titre : ${await page.title()} | DOM : ${htmlLen} octets`);
    console.log('\n----- texte rendu -----\n' + text.slice(0, 4000));
  }
  await browser.close();
})();
