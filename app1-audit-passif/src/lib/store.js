'use strict';

/**
 * Stockage JSON persistant minimal — modules natifs uniquement.
 *
 * Un « collection store » simple : un fichier JSON = un tableau d'objets.
 * Écriture atomique (fichier temporaire + rename) pour éviter la corruption.
 * Suffisant pour des comptes clients ; remplaçable par une vraie base plus
 * tard sans changer les appelants.
 */

const fs = require('fs');
const path = require('path');

function dataDir() {
  return process.env.AUDIT_DATA_DIR
    ? path.resolve(process.env.AUDIT_DATA_DIR)
    : path.join(__dirname, '..', '..', 'data');
}

function filePath(name) {
  return path.join(dataDir(), name + '.json');
}

function readAll(name) {
  try {
    const raw = fs.readFileSync(filePath(name), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function writeAll(name, rows) {
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  const target = filePath(name);
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), 'utf8');
  fs.renameSync(tmp, target); // rename atomique sur la plupart des FS
}

module.exports = { readAll, writeAll, filePath, dataDir };
