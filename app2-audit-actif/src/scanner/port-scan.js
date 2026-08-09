'use strict';

/**
 * Module — Scan de ports (TCP connect)
 *
 * Utilise le module natif `net` de Node : un « TCP connect scan » ouvre une
 * connexion TCP complète (SYN / SYN-ACK / ACK). Contrairement à un SYN scan,
 * il ne nécessite AUCUN privilège root.
 *
 * - Liste de ports courants (top ~100) par défaut, extensible.
 * - Timeout court par port + concurrence limitée pour rester rapide sans
 *   saturer la cible.
 *
 * ⚠ Ce module ne doit être appelé qu'après validation du gate légal
 *   (consent-gate.js). L'orchestrateur (index.js) impose ce passage.
 */

const net = require('net');

/**
 * Top ~100 ports TCP les plus courants (sous-ensemble nmap top-ports).
 */
const TOP_100_PORTS = [
  7, 20, 21, 22, 23, 25, 26, 37, 53, 79, 80, 81, 88, 106, 110, 111, 113, 119,
  135, 139, 143, 144, 179, 199, 389, 427, 443, 444, 445, 465, 513, 514, 515,
  543, 544, 548, 554, 587, 631, 646, 873, 990, 993, 995, 1025, 1026, 1027,
  1028, 1029, 1110, 1433, 1720, 1723, 1755, 1900, 2000, 2001, 2049, 2121,
  2717, 3000, 3128, 3306, 3389, 3986, 4899, 5000, 5009, 5051, 5060, 5101,
  5190, 5357, 5432, 5631, 5666, 5800, 5900, 6000, 6001, 6379, 6646, 7070,
  8000, 8008, 8009, 8080, 8081, 8443, 8888, 9100, 9999, 10000, 27017, 32768,
  49152, 49153, 49154, 49155, 49156, 49157,
];

/**
 * Teste un port unique via TCP connect.
 * @returns {Promise<{port:number, open:boolean, latencyMs:number|null}>}
 */
function checkPort(host, port, timeout) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let settled = false;

    const done = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ port, open, latencyMs: open ? Date.now() - start : null });
    };

    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));

    try {
      socket.connect(port, host);
    } catch (err) {
      done(false);
    }
  });
}

/**
 * Exécute les tâches avec une concurrence limitée (pool simple).
 */
async function runWithConcurrency(items, worker, concurrency) {
  const results = new Array(items.length);
  let index = 0;

  async function next() {
    while (index < items.length) {
      const i = index++;
      results[i] = await worker(items[i], i);
    }
  }

  const pool = [];
  const size = Math.min(concurrency, items.length);
  for (let i = 0; i < size; i++) pool.push(next());
  await Promise.all(pool);
  return results;
}

/**
 * Scanne une liste de ports sur un hôte.
 * @param {string} host
 * @param {object} [options] - { ports, timeout, concurrency, onProgress }
 * @returns {Promise<{host, scanned, open: number[], results: object[]}>}
 */
async function scan(host, options = {}) {
  const ports = options.ports && options.ports.length ? options.ports : TOP_100_PORTS;
  const timeout = options.timeout || 1500;
  const concurrency = options.concurrency || 50;

  let completed = 0;
  const results = await runWithConcurrency(
    ports,
    async (port) => {
      const r = await checkPort(host, port, timeout);
      completed++;
      if (typeof options.onProgress === 'function') {
        options.onProgress(completed, ports.length, r);
      }
      return r;
    },
    concurrency
  );

  const open = results.filter((r) => r.open).map((r) => r.port).sort((a, b) => a - b);

  return {
    host,
    scanned: ports.length,
    open,
    results,
  };
}

module.exports = { scan, checkPort, TOP_100_PORTS };
