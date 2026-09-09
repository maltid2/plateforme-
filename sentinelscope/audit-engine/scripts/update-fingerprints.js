'use strict';

/**
 * Met à jour la base de signatures technologiques à partir d'une source
 * open-source maintenue (fork communautaire de Wappalyzer :
 * enthec/webappanalyzer, licence GPL-3.0).
 *
 * Objectif : garder la détection de technologies à jour chaque jour, sans
 * toucher à la base curée à la main (data/fingerprints.json). Le résultat
 * est écrit dans data/fingerprints.generated.json et fusionné au runtime
 * par le module tech-detect (la base curée reste prioritaire).
 *
 * On ne conserve que les technologies qui :
 *   - possèdent un CPE (donc exploitables pour l'enrichissement CVE via NVD),
 *   - ont au moins un motif de détection supporté (headers/cookies/meta/html),
 *   - ne sont pas déjà présentes dans la base curée (celle-ci gagne).
 *
 * Usage : node scripts/update-fingerprints.js
 */

const fs = require('fs');
const path = require('path');

const BASE =
  'https://raw.githubusercontent.com/enthec/webappanalyzer/main/src';
const LETTERS = '_abcdefghijklmnopqrstuvwxyz'.split('');
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_FILE = path.join(DATA_DIR, 'fingerprints.generated.json');
const CURATED_FILE = path.join(DATA_DIR, 'fingerprints.json');

// Catégories Wappalyzer (id → libellé FR) pour un rendu cohérent avec la
// base curée. Repli sur le nom anglais fourni par la source si absent.
const CATEGORY_FR = {
  1: 'CMS',
  2: 'Forum',
  6: 'E-commerce',
  11: 'Blog',
  12: 'Framework JavaScript',
  18: 'Framework web',
  21: 'Base de données',
  22: 'Serveur web',
  23: 'Cache',
  27: 'Langage',
  28: "Système d'exploitation",
  33: 'Serveur applicatif',
  34: 'Base de données',
  51: 'Landing page',
  57: 'Générateur de site statique',
  62: 'PaaS',
  64: 'Reverse proxy',
  80: 'Serveur applicatif (Java)',
};

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'sentinelscope-fingerprint-updater' },
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' pour ' + url);
  return res.json();
}

/**
 * Retire les suffixes Wappalyzer (\;version:\1, \;confidence:80, ...) pour
 * ne garder que la regex brute attendue par notre détecteur.
 */
function cleanPattern(p) {
  if (typeof p !== 'string') return null;
  let raw = p.split('\\;')[0];
  // Retire les drapeaux inline PCRE (?i) (?s) (?is)… non supportés par les
  // regex JavaScript (le détecteur applique déjà le drapeau « i »). On ne
  // touche pas aux groupes (?: (?= (?! (?<…> qui restent valides.
  raw = raw.replace(/\(\?[a-z]+\)/g, '');
  return raw.length ? raw : '';
}

/** Normalise un CPE 2.3 vers la forme courte cpe:2.3:a:vendor:product. */
function normalizeCpe(cpe) {
  if (typeof cpe !== 'string' || !cpe.startsWith('cpe:2.3:')) return null;
  const parts = cpe.split(':');
  if (parts.length < 5) return null;
  // cpe : 2.3 : a : vendor : product : ...(reste ignoré)
  return parts.slice(0, 5).join(':');
}

function categoryLabel(cats) {
  if (Array.isArray(cats)) {
    for (const id of cats) {
      if (CATEGORY_FR[id]) return CATEGORY_FR[id];
    }
  }
  return null;
}

/** Transforme une entrée upstream vers notre schéma, ou null si inexploitable. */
function transform(name, tech, categoriesByName) {
  const cpe = normalizeCpe(tech.cpe);
  if (!cpe) return null; // sans CPE : aucun apport CVE, on ignore.

  const out = { name, cpe };

  const label =
    categoryLabel(tech.cats) ||
    (Array.isArray(tech.cats) &&
      categoriesByName[tech.cats[0]] &&
      categoriesByName[tech.cats[0]].name) ||
    'Technologie';
  out.category = label;

  // headers : objet { nom: regex }
  if (tech.headers && typeof tech.headers === 'object') {
    const h = {};
    for (const [k, v] of Object.entries(tech.headers)) {
      const c = cleanPattern(v);
      if (c != null) h[k] = c;
    }
    if (Object.keys(h).length) out.headers = h;
  }

  // meta : objet { nom: regex }
  if (tech.meta && typeof tech.meta === 'object') {
    const m = {};
    for (const [k, v] of Object.entries(tech.meta)) {
      const c = cleanPattern(v);
      if (c != null) m[k] = c;
    }
    if (Object.keys(m).length) out.meta = m;
  }

  // html : tableau de regex
  if (Array.isArray(tech.html)) {
    const arr = tech.html.map(cleanPattern).filter((x) => x != null && x !== '');
    if (arr.length) out.html = arr;
  } else if (typeof tech.html === 'string') {
    const c = cleanPattern(tech.html);
    if (c) out.html = [c];
  }

  // cookies : upstream = objet { nom: valeur } → notre schéma = tableau de noms
  if (tech.cookies && typeof tech.cookies === 'object') {
    const arr = Object.keys(tech.cookies)
      .map(cleanPattern)
      .filter((k) => k != null && k !== '');
    if (arr.length) out.cookies = arr;
  }

  const hasSignal =
    out.headers || out.meta || out.html || out.cookies;
  if (!hasSignal) return null; // aucun moyen de détecter : inutile.

  return out;
}

async function main() {
  console.log('Téléchargement des catégories…');
  const categoriesByName = await getJson(BASE + '/categories.json');

  console.log('Téléchargement des signatures (27 fichiers)…');
  const merged = {};
  for (const letter of LETTERS) {
    const url = BASE + '/technologies/' + letter + '.json';
    try {
      const part = await getJson(url);
      Object.assign(merged, part);
    } catch (err) {
      console.warn('  ! ' + letter + '.json ignoré : ' + err.message);
    }
  }
  console.log('  technologies upstream :', Object.keys(merged).length);

  // Noms déjà couverts par la base curée (elle reste prioritaire).
  let curatedNames = new Set();
  try {
    const curated = JSON.parse(fs.readFileSync(CURATED_FILE, 'utf8'));
    for (const t of curated.technologies || []) {
      if (t && typeof t.name === 'string') curatedNames.add(t.name.toLowerCase());
    }
  } catch (err) {
    console.warn('base curée illisible :', err.message);
  }

  const technologies = [];
  for (const [name, tech] of Object.entries(merged)) {
    if (curatedNames.has(name.toLowerCase())) continue;
    const t = transform(name, tech, categoriesByName);
    if (t) technologies.push(t);
  }
  technologies.sort((a, b) => a.name.localeCompare(b.name));

  const payload = {
    _comment:
      'Fichier GÉNÉRÉ automatiquement — ne pas éditer à la main. ' +
      'Source : enthec/webappanalyzer (GPL-3.0). Fusionné au runtime avec ' +
      'data/fingerprints.json (base curée prioritaire). Régénéré par ' +
      'scripts/update-fingerprints.js.',
    _source: 'enthec/webappanalyzer',
    _generatedAt: new Date().toISOString().slice(0, 10),
    technologies,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 1) + '\n');
  console.log(
    'Écrit ' + technologies.length + ' technologies dans ' +
      path.relative(process.cwd(), OUT_FILE)
  );
}

main().catch((err) => {
  console.error('Échec de la mise à jour :', err);
  process.exit(1);
});
