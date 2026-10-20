'use strict';

/**
 * Comparaison de versions tolérante aux formats constructeurs :
 * "10.12.182", "V5.7.3_build 220112", "5.11.0.1", "1.1.0.2".
 * On extrait la première suite de nombres séparés par des points ; ce qui
 * suit un « _ » (date, build, révision Hanwha « _20220420_R128 ») est ignoré.
 */

function parseVersion(v) {
  if (v == null) return null;
  const m = String(v).match(/\d+(?:\.\d+)*/);
  if (!m) return null;
  return m[0].split('.').map((n) => parseInt(n, 10));
}

/** -1 si a < b, 0 si égal, 1 si a > b, null si non comparable. */
function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return null;
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

module.exports = { parseVersion, compareVersions };
