#!/usr/bin/env node
'use strict';

/**
 * Tarik — agent de compatibilité firmware caméras ↔ Genetec Security Center.
 *
 *   node src/index.js check <fichier_firmware.zip> --sc 5.11.3.15
 *   node src/index.js check --marque Hanwha --modele PNM-9322VQP --firmware 2.24.01 --sc 5.11
 *   node src/index.js sync                  télécharge toute la liste caméras
 *   node src/index.js list --marque Axis [--modele P32]
 *
 * `check` interroge l'API Genetec en direct ; --hors-ligne utilise la base
 * locale (data/genetec-sdl.json). Ajouter --json pour une sortie machine.
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
  if (!fs.existsSync(DB_FILE)) return null;
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

async function cmdSync() {
  const log = (m) => console.error('[tarik] ' + m);
  const devices = await genetec.crawl({ log });
  if (!devices.length) {
    console.error('[tarik] Aucun appareil reçu de l\'API Genetec. Base inchangée.');
    process.exit(1);
  }
  devices.sort((a, b) =>
    (a.manufacturer || '').localeCompare(b.manufacturer || '') ||
    (a.model || '').localeCompare(b.model || ''));
  const db = { source: 'https://www.genetec.com/supported-device-list', updatedAt: new Date().toISOString(), count: devices.length, devices };
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
    q.file = f;
  }
  return q;
}

async function cmdCheck(args) {
  const q = buildQuery(args);
  if (!q.model) {
    console.error('Préciser un fichier firmware ou --modele.');
    process.exit(2);
  }
  let devices;
  let origin;
  if (!args['hors-ligne']) {
    try {
      devices = await genetec.search(q.model, { limit: 20 });
      origin = 'API Genetec (en direct)';
    } catch (err) {
      console.error(`[tarik] API indisponible (${err.message}), repli sur la base locale.`);
    }
  }
  if (!devices) {
    const db = loadDb();
    if (!db) {
      console.error('Ni API ni base locale : lancez « node src/index.js sync » depuis un poste connecté.');
      process.exit(2);
    }
    devices = db.devices;
    origin = `base locale du ${db.updatedAt.slice(0, 10)}`;
  }
  const results = check(devices, q);
  if (args.json) return console.log(JSON.stringify({ query: q, origin, results }, null, 2));

  console.log(`Tarik — source : ${origin}`);
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
    console.log(`\n■ ${d.manufacturer || '?'} ${d.model}  →  ${r.status.toUpperCase()}`);
    console.log(`  Statut Genetec : ${d.status || 'n/c'} | SC initial : ${d.securityCenter || 'n/c'}` +
      (d.driverPack ? ` (Driver Pack ${d.driverPack})` : '') + (d.extension ? ` | ${d.extension}` : ''));
    if (d.firmwares && d.firmwares.length) {
      console.log('  Firmwares listés :');
      for (const f of d.firmwares) {
        console.log(`    - ${f.version.padEnd(24)} ${String(f.certification || '').padEnd(20)} SC ${f.securityCenter || '?'}${f.driverPack ? ' + DP ' + f.driverPack : ''}`);
      }
    }
    for (const c of r.checks) console.log('  • ' + c);
    if (d.comments) console.log('  Note Genetec : ' + d.comments);
    console.log('  Source : ' + d.url);
  }
  if (results.some((r) => r.status === 'incompatible')) process.exitCode = 1;
}

function cmdList(args) {
  const db = loadDb();
  if (!db) {
    console.error('Base absente : lancez d\'abord « node src/index.js sync ».');
    process.exit(2);
  }
  const found = search(db.devices, { manufacturer: args.marque, model: args.modele });
  if (args.json) return console.log(JSON.stringify(found, null, 2));
  for (const d of found) {
    const top = d.firmwares && d.firmwares.length ? d.firmwares[d.firmwares.length - 1].version : d.latestFirmware;
    console.log([d.manufacturer, d.model, top, d.securityCenter, d.status].map((x) => x || '-').join(' | '));
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
