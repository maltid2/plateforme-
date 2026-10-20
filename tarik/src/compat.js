'use strict';

/**
 * Moteur de vérification : indique si un couple (caméra + firmware) est
 * supporté par une version de Security Center, d'après la SDL Genetec.
 *
 * Règles :
 *   - firmware listé par Genetec → on reprend sa certification
 *     (Certified / Tested by Partner / Supported by Design) et la version SC
 *     minimale associée ;
 *   - firmware non listé et PLUS RÉCENT que le plus haut listé → non validé ;
 *   - firmware non listé mais dans la plage listée → supporté en général ;
 *   - version SC < version SC initiale du modèle → incompatible.
 */

const { compareVersions, parseVersion } = require('./lib/version');

const norm = (s) => String(s || '').toLowerCase().replace(/[\s_-]+/g, '');

/** « 5.11 » est un préfixe de « 5.11.0.1 » : même branche, build à préciser. */
function isBranchPrefix(short, full) {
  const a = parseVersion(short);
  const b = parseVersion(full);
  return !!a && !!b && a.length < b.length && a.every((n, i) => n === b[i]);
}

function search(devices, { manufacturer, model } = {}) {
  const m = norm(manufacturer);
  const q = norm(model);
  const found = devices.filter(
    (d) => (!m || norm(d.manufacturer).includes(m)) && (!q || norm(d.model).includes(q))
  );
  // Correspondance exacte du modèle en priorité.
  const exact = found.filter((d) => q && norm(d.model) === q);
  return exact.length ? exact : found;
}

const scLabel = (sc, dp) => (sc ? sc + (dp ? ' + Driver Pack ' + dp : '') : 'n/c');

function verdict(device, { firmware, securityCenter } = {}) {
  const checks = [];
  let status = 'compatible';
  const rank = ['compatible', 'compatible (à vérifier)', 'inconnu', 'non validé', 'incompatible'];
  const worsen = (s) => { if (rank.indexOf(s) > rank.indexOf(status)) status = s; };
  let minSc = device.securityCenter;
  let minDp = device.driverPack;

  const listed = device.firmwares || [];
  const highest = listed.length ? listed[listed.length - 1].version : device.latestFirmware;

  if (firmware) {
    const match = listed.find((f) => compareVersions(f.version, firmware) === 0);
    if (match) {
      checks.push(`firmware ${firmware} : listé par Genetec — ${match.certification || 'statut n/c'} (SC ${scLabel(match.securityCenter, match.driverPack)})`);
      if (match.securityCenter) { minSc = match.securityCenter; minDp = match.driverPack; }
      if (/supported by design/i.test(match.certification || '')) worsen('compatible (à vérifier)');
    } else {
      const c = compareVersions(firmware, highest);
      if (c == null) {
        checks.push(`firmware ${firmware} : comparaison impossible (plus haut listé : ${highest || 'aucun'})`);
        worsen('inconnu');
      } else if (c > 0) {
        checks.push(`firmware ${firmware} : NON LISTÉ, plus récent que le plus haut testé par Genetec (${highest}) — non validé`);
        worsen('non validé');
      } else {
        checks.push(`firmware ${firmware} : non listé, mais dans la plage testée (≤ ${highest}) — supporté en général`);
        worsen('compatible (à vérifier)');
      }
    }
  }

  if (securityCenter) {
    const c = compareVersions(securityCenter, minSc);
    if (c == null) {
      checks.push('Security Center : version minimale non renseignée');
      worsen('inconnu');
    } else if (c < 0 && isBranchPrefix(securityCenter, minSc)) {
      checks.push(`Security Center ${securityCenter} : même branche, vérifier que la build est ≥ ${scLabel(minSc, minDp)}`);
      worsen('compatible (à vérifier)');
    } else if (c < 0) {
      checks.push(`Security Center ${securityCenter} : TROP ANCIEN (minimum ${scLabel(minSc, minDp)})`);
      worsen('incompatible');
    } else {
      checks.push(`Security Center ${securityCenter} : OK (minimum ${scLabel(minSc, minDp)})`);
      if (minDp) checks.push(`Driver Pack : vérifier qu'au moins le ${minDp} est installé`);
    }
  }

  return { status, checks };
}

function check(devices, query) {
  return search(devices, query).map((device) => ({ device, ...verdict(device, query) }));
}

module.exports = { search, verdict, check };
