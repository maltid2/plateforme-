# Suite d'audit de sécurité web

Deux applications distinctes, **séparées pour des raisons légales et
commerciales**, développées selon le cahier des charges.

| | [App 1 — Audit Web Passif](./app1-audit-passif) | [App 2 — Audit Serveur Actif](./app2-audit-actif) |
|---|---|---|
| **Type de scan** | Passif (aucune requête intrusive) | Actif (port scanning) |
| **Autorisation requise** | Aucune | **Mandat écrit signé obligatoire** |
| **Sortie** | Score A/B/C/D/F + rapport HTML/PDF | Rapport ports + services + CVE |

## Stack technique

- **Runtime** : Node.js (≥ 18)
- **HTTP** : `axios`
- **TLS / réseau** : modules natifs `tls` et `net`
- **Rapport** : HTML → PDF via `puppeteer` (optionnel)
- **Config** : `dotenv`
- **Sortie de chaque module** : JSON structuré, assemblé par le moteur de rapport

## Démarrage rapide

```bash
# App 1 — audit passif (aucune autorisation requise)
cd app1-audit-passif && npm install
node src/index.js https://exemple.com --pdf

# App 2 — audit actif (autorisation obligatoire)
cd app2-audit-actif && npm install
node src/index.js consent --target 203.0.113.10 --user "op@ex.com" \
     --mandate CONTRAT-042 --confirm "Je certifie être autorisé à tester ce système"
node src/index.js scan --target 203.0.113.10 --minCvss 7
```

## Roadmap (état)

- ✅ **Phase 1** — App 1 : Modules A1 (SSL/TLS), A2 (Headers), A3 (Fichiers exposés)
- ✅ **Phase 2** — App 1 : Moteur de scoring + génération de rapport HTML/PDF
- ✅ **Phase 3** — App 1 : Modules B (réputation), C (techno + CVE), D (conformité SaaS)
- ✅ **Phase 4** — App 2 : Gate légal (consentement horodaté, bloquant)
- ✅ **Phase 5** — App 2 : Scanner de ports + fingerprinting + matching CVE

## Note d'usage responsable

L'App 1 est non intrusive et peut viser n'importe quelle URL publique.
L'App 2 effectue un scan actif : elle ne doit être utilisée que sur des systèmes
pour lesquels vous détenez une **autorisation écrite**. Le gate légal
(`app2-audit-actif/src/auth/consent-gate.js`) matérialise et trace cette
autorisation ; il est volontairement impossible de lancer un scan sans passer
par lui.

Voir le détail dans chaque sous-dossier :
[app1-audit-passif/README.md](./app1-audit-passif/README.md) ·
[app2-audit-actif/README.md](./app2-audit-actif/README.md)
