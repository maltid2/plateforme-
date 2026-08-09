'use strict';

/**
 * Chargeur de plugins de vérification / preuve de concept (PoC)
 *
 * Cadre : test d'intrusion AUTORISÉ. Ce mécanisme permet à un opérateur
 * qualifié de brancher ses PROPRES modules de vérification/exploitation,
 * dont il assume la responsabilité légale, sans que l'outil embarque une
 * bibliothèque d'exploits armés.
 *
 * Contrat d'un plugin (module CommonJS exportant un objet) :
 *   {
 *     name: string,
 *     description: string,
 *     intrusive: boolean,   // true = va au-delà du simple constat
 *     async run(ctx): { findings: [...] }
 *   }
 *
 * GARDE-FOU CENTRAL : `runAll()` appelle la Règle d'Engagement
 * (`authorize(target)`) AVANT d'exécuter le moindre plugin. Une cible hors
 * périmètre => aucun plugin ne tourne. Les plugins marqués `intrusive:true`
 * ne s'exécutent QUE si l'option `allowIntrusive` est explicitement activée.
 */

const fs = require('fs');
const path = require('path');
const roe = require('../auth/rules-of-engagement');

function loadPlugins(dir) {
  const target = dir || path.join(__dirname, 'enabled');
  let files;
  try {
    files = fs.readdirSync(target).filter((f) => f.endsWith('.js'));
  } catch (err) {
    return [];
  }
  const plugins = [];
  for (const f of files) {
    try {
      const mod = require(path.join(target, f));
      if (mod && typeof mod.run === 'function' && mod.name) {
        plugins.push(mod);
      }
    } catch (err) {
      plugins.push({
        name: f,
        description: 'ERREUR de chargement : ' + err.message,
        intrusive: false,
        run: async () => ({ findings: [] }),
        _loadError: err.message,
      });
    }
  }
  return plugins;
}

/**
 * Exécute les plugins sur une cible — après contrôle d'autorisation RoE.
 * @param {string} target
 * @param {object} [options] - { dir, allowIntrusive, timeout, log }
 * @returns {Promise<{authorized:boolean, reason?:string, results:object[]}>}
 */
async function runAll(target, options = {}) {
  const log = options.log || (() => {});

  // --- GARDE-FOU : Règle d'Engagement, en tout premier ---
  const auth = roe.authorize(target);
  if (!auth.ok) {
    return { authorized: false, reason: auth.reason, results: [] };
  }
  log('✔ Cible ' + target + ' dans le périmètre autorisé (engagement ' + auth.engagement.id + ')');

  const plugins = loadPlugins(options.dir);
  const results = [];

  for (const plugin of plugins) {
    if (plugin.intrusive && !options.allowIntrusive) {
      results.push({
        plugin: plugin.name,
        skipped: true,
        reason: 'Plugin intrusif ignoré (allowIntrusive non activé).',
      });
      continue;
    }
    const ctx = {
      target,
      engagement: auth.engagement,
      timeout: options.timeout || 10000,
      log,
    };
    try {
      const out = await plugin.run(ctx);
      results.push({
        plugin: plugin.name,
        intrusive: !!plugin.intrusive,
        findings: (out && out.findings) || [],
      });
    } catch (err) {
      results.push({ plugin: plugin.name, error: err.message, findings: [] });
    }
  }

  return { authorized: true, engagement: auth.engagement, results };
}

module.exports = { loadPlugins, runAll };
