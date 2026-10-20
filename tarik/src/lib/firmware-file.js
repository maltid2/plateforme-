'use strict';

/**
 * Déduit modèle + version depuis le nom d'un paquet firmware constructeur.
 *
 *   Hanwha : PNM-9322VQP_2.24.01_20260827_R3.zip
 *   Axis   : P3245-LVE_10_12_182.bin
 *   Hikvision : DS-2CD2143G2-I_V5.7.3_build220112.dav (forme approximative)
 */

// Préfixes de modèles → fabricant (heuristique, complétée par la base).
const PREFIXES = [
  [/^(PNM|PNO|PNV|PND|PNF|PNP|PNB|XNV|XNO|XND|XNF|XNP|XNB|QNV|QNO|QND|QNF|QNE|QNP|ANV|ANO|AND|ANE|TNV|TNO|TNM|TID|TNF|HCV|HCO|SNP|SNV|SNO)-/i, 'Hanwha'],
  [/^(DS-2C|DS-2D|IDS-|iDS-)/i, 'Hikvision'],
  [/^(IPC-|SD\d|DH-)/i, 'Dahua'],
  [/^(AXIS[ _-])?[MPQFV]\d{4}/i, 'Axis'],
  [/^(WV-|i-PRO)/i, 'i-PRO'],
  [/^(H\d[A-Z]?-|H4|H5|H6)/i, 'Avigilon'],
  [/^(AUTODOME|FLEXIDOME|DINION|MIC )/i, 'Bosch'],
];

function guessManufacturer(model) {
  for (const [re, name] of PREFIXES) if (re.test(model)) return name;
  return null;
}

function parseFirmwareFile(name) {
  const base = String(name).split(/[\\/]/).pop().replace(/\.(zip|bin|img|dav|tar|gz|tgz|fw)$/gi, '');
  // Modèle = premier segment, version = premier segment suivant ressemblant à une version.
  const parts = base.split('_');
  const model = parts.shift();
  let version = null;
  const v = parts.find((p) => /^v?\d+(\.\d+)+/i.test(p));
  if (v) version = v.replace(/^v/i, '');
  else {
    // Forme Axis : MODELE_10_12_182
    const nums = parts.filter((p) => /^\d{1,3}$/.test(p));
    if (nums.length >= 2) version = nums.join('.');
  }
  const date = parts.find((p) => /^\d{8}$/.test(p)) || null;
  return {
    model,
    version,
    date: date ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}` : null,
    manufacturer: guessManufacturer(model),
  };
}

module.exports = { parseFirmwareFile, guessManufacturer };
