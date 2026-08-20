'use strict';

/**
 * Point d'entrée serverless pour Vercel.
 *
 * IXAUDIT est un serveur HTTP Node natif ; Vercel exécute des fonctions
 * serverless. On réutilise ici exactement la même logique de routage que
 * `src/server.js` (via `requestHandler`), qui reçoit (req, res) au format
 * Node — compatible avec le runtime Node de Vercel.
 *
 * Note : le stockage des rapports (`/r/:id`) est en mémoire. En serverless,
 * il persiste tant que l'instance reste « chaude » — suffisant pour tester
 * (l'ouverture du rapport suit l'audit de quelques secondes). Pour une prod
 * durable, brancher un stockage externe (KV, base, disque).
 */

const { requestHandler } = require('../src/server');

module.exports = (req, res) => requestHandler(req, res);
