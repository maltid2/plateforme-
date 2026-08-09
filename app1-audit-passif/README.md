# App 1 — Audit Web Passif

Scanner une URL publique **sans aucune requête intrusive**, produire un score
global **A / B / C / D / F** et un rapport en langage clair (HTML + PDF).

> Audit *passif* : uniquement des requêtes GET simples et des lookups auprès de
> services tiers. Aucune énumération agressive, aucun bypass, aucun test
> d'intrusion. Aucune autorisation préalable n'est requise pour ce type de scan.

## Installation

```bash
cd app1-audit-passif
npm install
cp .env.example .env   # (optionnel) renseigner les clés API
```

`puppeteer` est une dépendance **optionnelle** (utilisée seulement pour le PDF).
Sans lui, le rapport HTML reste généré normalement.

## Utilisation

### En ligne de commande

```bash
# Rapport HTML uniquement
node src/index.js https://exemple.com

# Rapport HTML + PDF, dans un dossier précis
node src/index.js https://exemple.com --pdf --out ./reports
```

### En bibliothèque

```js
const { audit, auditAndReport } = require('./src/index');

const report = await audit('https://exemple.com');
console.log(report.scoring.score, report.scoring.letter);

// Avec génération de fichiers :
const { files } = await auditAndReport('https://exemple.com', { pdf: true });
```

## Modules

| Module | Fichier | Rôle | Dépend d'une API ? |
|---|---|---|---|
| **A1** | `modules/ssl.js` | SSL/TLS (certificat, protocole, cipher) — module natif `tls` | Non |
| **A2** | `modules/headers.js` | En-têtes HTTP de sécurité (HSTS, CSP, X-Frame-Options…) | Non |
| **A3** | `modules/exposed-files.js` | Fichiers sensibles exposés (`.git/config`, `.env`, backups…) | Non |
| **B** | `modules/reputation.js` | Réputation / malware (Google Safe Browsing, VirusTotal) | Oui (dégradé si absent) |
| **C** | `modules/tech-detect.js` | Fingerprinting techno + CVE (NVD) | Oui pour les CVE |
| **D** | `modules/compliance.js` | Bonnes pratiques SaaS (mentions légales, cookies, HTTPS, mixed content) | Non |

Chaque module renvoie un JSON structuré `{ module, name, score, findings[], … }`.
Les modules dont la source externe est indisponible passent en **mode dégradé**
et sont exclus de la moyenne (sauf s'ils remontent une alerte réelle).

## Scoring

`scoring/engine.js` calcule une **moyenne pondérée** (SSL et headers pèsent le
plus lourd), puis mappe le score en lettre :

| Score | Lettre |
|---|---|
| ≥ 90 | A |
| ≥ 75 | B |
| ≥ 60 | C |
| ≥ 45 | D |
| < 45 | F |

Poids par défaut : A1 25 %, A2 25 %, A3 20 %, C 12 %, B 10 %, D 8 %.

## Rapport

`report/generator.js` remplit un template HTML (score, note lettre, synthèse
par module, findings avec explication + niveau de risque + recommandation
actionnable) et l'exporte en PDF fidèle via Puppeteer.

## Tests

```bash
npm test
```

## Clés API (optionnelles)

Voir `.env.example` : `SAFE_BROWSING_API_KEY`, `VIRUSTOTAL_API_KEY`,
`NVD_API_KEY`. Toutes facultatives.
