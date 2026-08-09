'use strict';

/**
 * Chargeur `.env` minimal — module natif uniquement (remplace `dotenv`).
 *
 * Lit un fichier `.env` (au format KEY=VALUE) et injecte les variables dans
 * `process.env` sans écraser celles déjà définies. Silencieux si le fichier
 * est absent. Aucune dépendance externe.
 */

const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  const target = path.resolve(process.cwd(), file || '.env');
  let raw;
  try {
    raw = fs.readFileSync(target, 'utf8');
  } catch (err) {
    return {}; // pas de .env : on ne fait rien
  }

  const parsed = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    // Retire les guillemets encadrants éventuels.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
    if (!(key in process.env)) process.env[key] = value;
  }
  return parsed;
}

module.exports = { loadEnv };
