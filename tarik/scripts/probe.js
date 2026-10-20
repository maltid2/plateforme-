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
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('response', async (res) => {
    const type = res.headers()['content-type'] || '';
    const req = res.request();
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
    console.log('\n----- texte rendu -----\n' + text.slice(0, 4000));
  }
  await browser.close();
})();
