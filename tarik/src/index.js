#!/usr/bin/env node
'use strict';

/**
 * Tarik — agent de compatibilité firmware caméras ↔ Genetec Security Center.
 *
 *   node src/index.js sync [--details] [--max-pages N] [--from-dir DIR]
 *   node src/index.js check <fichier_firmware.zip> --sc 5.11
 *   node src/index.js check --marque Hanwha --modele PNM-9322VQP --firmware 2.24.01 --sc 5.11
 *   node src/index.js list --marque Axis [--modele P32]
 *
 * Ajouter --json pour une sortie machine.
 */

const fs = require('fs');
const path = require('path');
const genetec = require('./sources/genetec');
const { check, search } = require('./compat');
const { parseFirmwareFile } = require('./lib/firmware-file');

const DB_FILE = path.join(__dirname, '..', 'data', 'genetec-sdl.json');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next == null || next.startsWith('--')) args[key] = true;
      else args[key] = argv[++i];
    } else args._.push(a);
  }
  return args;
}

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    console.error('Base absente : lancez d\'abord « node src/index.js sync ».');
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

async function cmdSync(args) {
  let devices;
  const log = (m) => console.error('[tarik] ' + m);
  if (args['from-dir']) {
    // Mode hors-ligne : pages HTML enregistrées depuis le navigateur.
    devices = [];
    for (const f of fs.readdirSync(args['from-dir'])) {
      if (!/\.html?$/i.test(f)) continue;
      const body = fs.readFileSync(path.join(args['from-dir'], f), 'utf8');
      const list = genetec.parseListPage(body);
      if (list.length) devices.push(...list);
      else {
        const det = genetec.parseDetailPage(body, (f.match(/\d+/) || [null])[0]);
        if (det) devices.push(det);
      }
      log(`${f} : ${devices.length} appareils cumulés`);
    }
  } else {
    devices = await genetec.crawl({
      maxPages: Number(args['max-pages']) || 500,
      details: !!args.details,
      log,
    });
  }
  if (!devices.length) {
    console.error('[tarik] Aucun appareil extrait — la mise en page du site a peut-être changé. Base inchangée.');
    process.exit(1);
  }
  devices.sort((a, b) =>
    (a.manufacturer || '').localeCompare(b.manufacturer || '') ||
    (a.model || '').localeCompare(b.model || ''));
  const db = { source: genetec.LIST_URL(1), updatedAt: new Date().toISOString(), count: devices.length, devices };
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2) + '\n');
  log(`${devices.length} appareils enregistrés dans ${path.relative(process.cwd(), DB_FILE)}`);
}

function buildQuery(args) {
  const q = {
    manufacturer: args.marque || args.manufacturer,
    model: args.modele || args.model,
    firmware: args.firmware,
    securityCenter: args.sc,
  };
  if (args._[0]) {
    const f = parseFirmwareFile(args._[0]);
    q.model = q.model || f.model;
    q.firmware = q.firmware || f.version;
    q.manufacturer = q.manufacturer || f.manufacturer;
    q.file = f;
  }
  return q;
}

function cmdCheck(args) {
  const db = loadDb();
  const q = buildQuery(args);
  let results = check(db.devices, q);
  // Le fabricant deviné depuis le nom de fichier peut différer du libellé
  // Genetec (ex. « Hanwha Vision ») : on réessaie sur le modèle seul.
  if (!results.length && q.file && !(args.marque || args.manufacturer)) {
    results = check(db.devices, { ...q, manufacturer: undefined });
  }
  if (args.json) return console.log(JSON.stringify({ query: q, base: db.updatedAt, results }, null, 2));

  console.log(`Tarik — base Genetec SDL du ${db.updatedAt.slice(0, 10)} (${db.count} appareils)`);
  console.log(`Recherche : ${[q.manufacturer, q.model].filter(Boolean).join(' ')}` +
    (q.firmware ? ` | firmware ${q.firmware}` : '') +
    (q.securityCenter ? ` | Security Center ${q.securityCenter}` : ''));
  if (!results.length) {
    console.log('\n✗ Modèle absent de la Supported Device List Genetec.');
    console.log('  → Non supporté nativement : vérifier une intégration ONVIF (Profile S/T) ou contacter Genetec.');
    process.exitCode = 3;
    return;
  }
  for (const r of results) {
    const d = r.device;
    console.log(`\n■ ${d.manufacturer || '?'} ${d.model || '?'}  →  ${r.status.toUpperCase()}`);
    console.log(`  Dernier firmware validé : ${d.firmware || 'n/c'} | SC minimum : ${d.securityCenter || 'n/c'}` +
      (d.driverPack ? ` (Driver Pack ${d.driverPack})` : '') + (d.protocol ? ` | ${d.protocol}` : ''));
    for (const c of r.checks) console.log('  - ' + c);
    if (d.url) console.log('  Source : ' + d.url);
  }
  if (results.some((r) => r.status === 'incompatible')) process.exitCode = 1;
}

function cmdList(args) {
  const db = loadDb();
  const found = search(db.devices, { manufacturer: args.marque, model: args.modele });
  if (args.json) return console.log(JSON.stringify(found, null, 2));
  for (const d of found) {
    console.log([d.manufacturer, d.model, d.firmware, d.securityCenter, d.driverPack]
      .map((x) => x || '-').join(' | '));
  }
  console.error(`${found.length} appareil(s)`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._.shift();
  if (cmd === 'sync') return cmdSync(args);
  if (cmd === 'check') return cmdCheck(args);
  if (cmd === 'list') return cmdList(args);
  console.log(fs.readFileSync(__filename, 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[1].replace(/^ \* ?/gm, ''));
}

main().catch((err) => {
  console.error('[tarik] ' + err.message);
  process.exit(1);
});
