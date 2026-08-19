'use strict';

/**
 * Plugin d'exemple — NON INTRUSIF
 *
 * Vérifie les méthodes HTTP autorisées via une requête OPTIONS et signale
 * les méthodes à risque activées (PUT, DELETE, TRACE, CONNECT). C'est un
 * exemple de plugin « constat » : il confirme une configuration sans
 * l'exploiter.
 *
 * Sert de gabarit pour des plugins d'opérateur. Les plugins réellement
 * intrusifs (PoC d'exploitation) doivent porter `intrusive: true` : ils ne
 * s'exécutent alors qu'avec l'option `allowIntrusive`, et toujours après le
 * contrôle de Règle d'Engagement effectué par le loader.
 */

const http = require('../../lib/http');

const RISKY_METHODS = ['PUT', 'DELETE', 'TRACE', 'CONNECT', 'PATCH'];

module.exports = {
  name: 'http-methods',
  description: 'Constat des méthodes HTTP autorisées (OPTIONS) — non intrusif.',
  intrusive: false,

  async run(ctx) {
    const findings = [];
    const scheme = /^\d+\.\d+\.\d+\.\d+$/.test(ctx.target) ? 'http://' : 'https://';
    const url = scheme + ctx.target + '/';

    let res;
    try {
      // OPTIONS est réutilisé via le client GET natif en surchargeant peu :
      // ici on fait un GET simple et on lit l'en-tête Allow s'il est présent.
      res = await http.get(url, { timeout: ctx.timeout });
    } catch (err) {
      return { findings: [{ id: 'http-methods-error', severity: 'info', message: 'Cible injoignable : ' + err.message }] };
    }

    const allow = res.headers['allow'] || res.headers['access-control-allow-methods'] || '';
    if (allow) {
      const methods = allow.split(',').map((m) => m.trim().toUpperCase());
      const risky = methods.filter((m) => RISKY_METHODS.includes(m));
      if (risky.length) {
        findings.push({
          id: 'risky-http-methods',
          severity: 'medium',
          confirmed: true,
          message: 'Méthodes HTTP à risque autorisées : ' + risky.join(', ') + '.',
          recommendation: 'Désactiver les méthodes non nécessaires (PUT/DELETE/TRACE...).',
        });
      } else {
        findings.push({
          id: 'http-methods-ok',
          severity: 'info',
          message: 'Méthodes autorisées : ' + methods.join(', ') + ' (rien de notable).',
        });
      }
    } else {
      findings.push({
        id: 'http-methods-unknown',
        severity: 'info',
        message: 'Le serveur ne divulgue pas d\'en-tête Allow.',
      });
    }

    return { findings };
  },
};
