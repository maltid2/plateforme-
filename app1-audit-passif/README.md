# App 1 — Audit Web Passif

Scanner une URL publique **sans aucune requête intrusive**, produire un score
global **A / B / C / D / F** et un rapport en langage clair (HTML + PDF).

> Audit *passif* : uniquement des requêtes GET simples et des lookups auprès de
> services tiers. Aucune énumération agressive, aucun bypass, aucun test
> d'intrusion. Aucune autorisation préalable n'est requise pour ce type de scan.

## Installation

**Aucune installation requise.** L'application n'a **aucune dépendance externe** :
elle fonctionne avec Node.js seul (modules natifs `tls`, `net`, `http`/`https`).
Pas de `npm install`, pas de librairie open source à récupérer.

```bash
cd app1-audit-passif
node src/index.js https://exemple.com     # ça tourne, tout de suite
cp .env.example .env                       # (optionnel) clés API pour B/C
```

> **Seule exception, entièrement optionnelle** : l'export **PDF** utilise
> `puppeteer` (qui embarque un navigateur pour le rendu). Il est déclaré en
> `optionalDependencies`. Si vous voulez le PDF : `npm install puppeteer`.
> Sans lui, le rapport **HTML** est généré normalement — le cœur de
> l'application ne dépend de rien.

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

### Interface web (ce que voit le client)

```bash
node src/server.js          # http://localhost:3000  (PORT surchargeable)
```

Serveur HTTP **natif** (aucune dépendance, pas d'Express). Le client saisit
une URL et obtient sa note A→F + un **lien de rapport partageable**.

| Route | Rôle |
|---|---|
| `GET /` | Page de saisie (formulaire) |
| `POST /api/audit` | Lance l'audit, renvoie `{ score, letter, reportUrl }` en JSON |
| `GET /r/:id` | Rapport HTML partageable (le lien à transmettre au client) |
| `GET /r/:id.json` | Résultat brut JSON |

**Sécurité** : garde anti-SSRF (`lib/ssrf-guard.js`) — les cibles internes/
privées (localhost, 10/8, 192.168/16…) sont refusées, y compris via
résolution DNS.

### Self-service : le client paie → audits illimités, sans vous

Une fois abonné, le client lance **autant d'audits qu'il veut, en autonomie**.

| Route | Rôle |
|---|---|
| `GET /app` | Espace client (créer un compte, payer, auditer) |
| `POST /api/account` | Crée un compte, renvoie la **clé d'API** (une seule fois) |
| `GET /api/account/status` | Statut de l'abonnement (via clé) |
| `POST /api/checkout` | Crée une session de paiement Stripe (self-service) |
| `POST /webhook/stripe` | **Active automatiquement** le compte après paiement |
| `POST /api/audit` | Refusé (401) sans clé, (402) si non payé, **illimité** si actif |

**Comptes** (`auth/accounts.js`) : la clé d'API n'est jamais stockée en clair
(empreinte SHA-256, comparaison temps constant). Un compte actif = audits
illimités (aucun plafond, on ne fait que compter l'usage).

**Paiement** (`billing/stripe.js`) : Stripe appelé via son **API REST
directement** (aucun SDK à installer) ; les webhooks sont vérifiés avec le
`crypto` natif (HMAC-SHA256 + anti-rejeu). Le paiement active le compte
**sans aucune intervention de votre part**.

> Le traitement des cartes passe par Stripe (obligation PCI/légale) : c'est le
> seul élément externe, et il n'exige aucune installation — juste 3 variables
> d'environnement (`STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`,
> `STRIPE_WEBHOOK_SECRET`). Voir `.env.example`.

**Activation manuelle** (ventes manuelles, tests) — sans Stripe :

```bash
node src/admin.js create   --email client@ex.com
node src/admin.js activate --email client@ex.com --days 30   # ou --lifetime
node src/admin.js list
node src/admin.js deactivate --email client@ex.com
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
