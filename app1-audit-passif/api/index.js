'use strict';

/**
 * Point d'entrée serverless pour Vercel.
 *
 * IXAUDIT est un serveur HTTP Node natif ; Vercel exécute des fonctions
 * serverless. On réutilise la même logique de routage que `src/server.js`
 * (via `requestHandler`), qui reçoit (req, res) au format Node.
 *
 * Le `require` est fait paresseusement, dans un try/catch, pour qu'une
 * éventuelle erreur d'initialisation (module non embarqué, etc.) soit
 * renvoyée en clair au lieu de faire planter la fonction (500 opaque).
 *
 * Note : le stockage des rapports (`/r/:id`) est en mémoire. En serverless,
 * il persiste tant que l'instance reste « chaude » — suffisant pour tester.
 */

module.exports = async (req, res) => {
  try {
    const { requestHandler } = require('../src/server');
    return await requestHandler(req, res);
  } catch (err) {
    const msg = (err && (err.stack || err.message)) || String(err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify({ error: 'IXAUDIT init/runtime error', detail: msg }));
  }
};
