# App 2 — Audit Serveur Actif

Scan **actif** des ports et services d'un serveur, avec matching CVE —
**uniquement après autorisation explicite et écrite du client**.

> ⚠️ **Cadre légal.** Le scan actif d'un système sans autorisation est illégal
> dans la plupart des juridictions (en France : art. 323-1 et suivants du Code
> pénal). Cette application impose un **gate légal** : aucun scan ne peut
> démarrer sans consentement valide, horodaté et tracé.

## Installation

**Aucune installation requise.** L'application n'a **aucune dépendance externe**
(modules natifs `net`, `http`/`https` uniquement). Pas de `npm install`.

```bash
cd app2-audit-actif
cp .env.example .env   # (optionnel) NVD_API_KEY pour augmenter le quota CVE
```

## Utilisation — deux étapes obligatoires

### 1. Enregistrer le consentement (gate légal)

```bash
node src/index.js consent \
  --target 203.0.113.10 \
  --user "operateur@exemple.com" \
  --mandate CONTRAT-2026-042 \
  --confirm "Je certifie être autorisé à tester ce système"
```

Cela crée une entrée horodatée dans `logs/consent-log.json` :
`{ id, timestamp, target, user, confirmationText, mandateRef, granted }`.

Le consentement est **refusé** si :
- la phrase de confirmation ne correspond pas ;
- aucune référence de mandat n'est fournie ;
- la cible ou l'opérateur manquent.

### 2. Lancer le scan

```bash
node src/index.js scan --target 203.0.113.10 --minCvss 7
```

Le scan **échoue immédiatement** (`CONSENT_REQUIRED`) si aucun consentement
valide (< 24 h par défaut) n'existe pour la cible.

### En bibliothèque

```js
const { grantConsent, runScan } = require('./src/index');

grantConsent({
  target: '203.0.113.10',
  user: 'op@exemple.com',
  confirmation: 'Je certifie être autorisé à tester ce système',
  mandateOnFile: true,
  mandateRef: 'CONTRAT-042',
});

const report = await runScan('203.0.113.10', { minCvss: 7 });
```

## Modules

| Fichier | Rôle |
|---|---|
| `auth/consent-gate.js` | **Gate légal** — confirmation + journal horodaté. Bloque tout scan non autorisé. |
| `scanner/port-scan.js` | Scan **TCP connect** (module natif `net`, sans privilège root), top ~100 ports, concurrence + timeout courts. |
| `scanner/banner-grab.js` | Banner grabbing + extraction de version (SSH, FTP, HTTP, SMTP…). |
| `cve/matcher.js` | Matching version → CVE via l'API NVD, priorisation par CVSS. |
| `index.js` | Orchestrateur : impose le gate, puis scan → fingerprint → CVE. |

## Options de scan

- `--ports 22,80,443` : liste de ports personnalisée (défaut : top ~100).
- `--minCvss 7` : ne remonter que les CVE de sévérité ≥ 7 (High/Critical).

## Tests

```bash
npm test
```

Les tests vérifient notamment que **le scan est bloqué sans consentement** et
que le gate refuse une phrase ou un mandat invalides.
