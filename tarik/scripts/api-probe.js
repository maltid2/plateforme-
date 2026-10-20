'use strict';

/**
 * Sonde de l'API de recherche Genetec (utilisée par la page Supported Device
 * List). Affiche la réponse brute pour une requête donnée.
 *
 * Usage : node scripts/api-probe.js "PNM-9322VQP"
 */

const query = process.argv[2] || '';
const body = {
  query,
  engineId: 'gen-prod-en-sdl_1779984486679',
  limit: 3,
  page: 1,
  facets: ['manufacturer', 'device_type', 'features', 'compression_types', 'audio', 'products', 'license_type'],
  dataStores: ['gen-prod-en-pub-sdl-camera_3690587630811'],
  languageCode: 'en-US',
  spellCorrectionMode: 'AUTO',
  includeSnippet: true,
};

(async () => {
  const res = await fetch('https://www.genetec.com/restservices/public/search', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      origin: 'https://www.genetec.com',
      referer: 'https://www.genetec.com/supported-device-list',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    },
    body: JSON.stringify(body),
  });
  console.log('HTTP ' + res.status);
  const json = await res.json();
  const { results, ...rest } = json;
  console.log('Méta : ' + JSON.stringify(rest).slice(0, 3000));
  for (const r of results || []) console.log('\n' + JSON.stringify(r, null, 2));
  // Où trouver engineId/dataStores sans les coder en dur ?
  const page = await (await fetch('https://www.genetec.com/resourceapi/supported-device-list?page=1')).text();
  console.log('\nresourceapi : ' + page.length + ' octets');
  for (const m of page.matchAll(/.{0,120}(gen-prod-en-[a-z-]*sdl[a-z0-9_-]*).{0,120}/g)) console.log('  ' + m[0]);
})();
