'use strict';

/**
 * Administration des comptes (CLI)
 *
 * Permet d'activer/désactiver/lister des comptes manuellement — utile pour
 * les ventes manuelles, les tests, ou si tu actives un client à la main.
 * L'activation automatique par paiement Stripe reste le mode nominal.
 *
 * Exemples :
 *   node src/admin.js list
 *   node src/admin.js create --email client@ex.com
 *   node src/admin.js activate --email client@ex.com --days 30
 *   node src/admin.js activate --email client@ex.com --lifetime
 *   node src/admin.js deactivate --email client@ex.com
 */

require('./lib/env').loadEnv();
const accounts = require('./auth/accounts');

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      flags[key] = val;
    }
  }
  return flags;
}

const [command, ...rest] = process.argv.slice(2);
const flags = parseFlags(rest);

switch (command) {
  case 'create': {
    const r = accounts.createAccount({ email: flags.email, plan: flags.plan });
    if (!r.ok) { console.error('✗ ' + r.reason); process.exit(1); }
    console.log('✔ Compte créé. Clé (à transmettre au client, montrée une fois) :');
    console.log('  ' + r.apiKey);
    break;
  }
  case 'activate': {
    const r = accounts.activate(flags.email || flags.id, {
      days: flags.lifetime ? 0 : flags.days != null ? Number(flags.days) : 30,
      lifetime: !!flags.lifetime,
      plan: flags.plan,
    });
    if (!r.ok) { console.error('✗ ' + r.reason); process.exit(1); }
    console.log('✔ Activé :', JSON.stringify(r.account, null, 2));
    break;
  }
  case 'deactivate': {
    const r = accounts.deactivate(flags.email || flags.id);
    if (!r.ok) { console.error('✗ ' + r.reason); process.exit(1); }
    console.log('✔ Désactivé :', JSON.stringify(r.account, null, 2));
    break;
  }
  case 'list': {
    const store = require('./lib/store');
    const rows = store.readAll('accounts').map((a) => accounts.publicView(a));
    console.log(JSON.stringify(rows, null, 2));
    break;
  }
  default:
    console.log('Commandes : create | activate | deactivate | list');
    console.log('  node src/admin.js create --email client@ex.com');
    console.log('  node src/admin.js activate --email client@ex.com --days 30');
    console.log('  node src/admin.js activate --email client@ex.com --lifetime');
    console.log('  node src/admin.js deactivate --email client@ex.com');
    console.log('  node src/admin.js list');
}
