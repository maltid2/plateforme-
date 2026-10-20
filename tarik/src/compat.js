'use strict';

/**
 * Moteur de vérification : à partir de la base synchronisée, indique si un
 * couple (caméra + firmware) est compatible avec une version de Security Center.
 *
 * Règles (convention Genetec SDL) :
 *   - le firmware listé est le DERNIER validé ; un firmware plus récent n'est
 *     pas validé, un firmware plus ancien est en général supporté ;
 *   - la version Security Center listée est la version MINIMALE requise.
 */

const { compareVersions, parseVersion } = require('./lib/version');

/** « 5.11 » est un préfixe de « 5.11.0.1 » : même branche, build à préciser. */
function isBranchPrefix(short, full) {
  const a = parseVersion(short);
  const b = parseVersion(full);
  return !!a && !!b && a.length < b.length && a.every((n, i) => n === b[i]);
}

const norm = (s) => String(s || '').toLowerCase().replace(/[\s_-]+/g, '');

function search(devices, { manufacturer, model } = {}) {
  const m = norm(manufacturer);
  const q = norm(model);
  return devices.filter(
    (d) =>
      (!m || norm(d.manufacturer).includes(m)) &&
      (!q || norm(d.model).includes(q))
  );
}

function verdict(device, { firmware, securityCenter } = {}) {
  const checks = [];
  let status = 'compatible';

  if (firmware) {
    const c = compareVersions(firmware, device.firmware);
    if (c == null) {
      checks.push(`firmware : comparaison impossible (validé : ${device.firmware || 'non renseigné'})`);
      status = 'inconnu';
    } else if (c === 0) {
      checks.push(`firmware ${firmware} : version validée par Genetec`);
    } else if (c < 0) {
      checks.push(`firmware ${firmware} : antérieur au dernier validé (${device.firmware}) — supporté en général, mise à jour conseillée`);
      if (status === 'compatible') status = 'compatible (à vérifier)';
    } else {
      checks.push(`firmware ${firmware} : PLUS RÉCENT que le dernier validé (${device.firmware}) — non validé`);
      status = 'non validé';
    }
  }

  if (securityCenter) {
    const c = compareVersions(securityCenter, device.securityCenter);
    if (c == null) {
      checks.push(`Security Center : version minimale non renseignée`);
      if (status === 'compatible') status = 'inconnu';
    } else if (c < 0 && isBranchPrefix(securityCenter, device.securityCenter)) {
      checks.push(`Security Center ${securityCenter} : même branche, vérifier que la build installée est ≥ ${device.securityCenter}${device.driverPack ? ' avec le Driver Pack ' + device.driverPack : ''}`);
      if (status === 'compatible') status = 'compatible (à vérifier)';
    } else if (c < 0) {
      checks.push(`Security Center ${securityCenter} : TROP ANCIEN (minimum ${device.securityCenter}${device.driverPack ? ', Driver Pack ' + device.driverPack : ''})`);
      status = 'incompatible';
    } else {
      checks.push(`Security Center ${securityCenter} : OK (minimum ${device.securityCenter}${device.driverPack ? ', Driver Pack ' + device.driverPack : ''})`);
    }
  }

  return { status, checks };
}

function check(devices, query) {
  return search(devices, query).map((device) => ({ device, ...verdict(device, query) }));
}

module.exports = { search, verdict, check };
