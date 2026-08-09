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

---

## Phase de vérification (test d'intrusion autorisé)

> ⚠️ Cette phase va au-delà du simple constat : elle **sollicite activement**
> la cible pour **confirmer** l'exploitabilité de faiblesses. Elle ne
> s'exécute que dans un **cadre autorisé strict** (Règle d'Engagement).

### Règle d'Engagement (RoE)

Là où le gate légal matérialise le mandat, la **RoE définit le périmètre
exact** et le fait respecter. `verify` et les plugins refusent **toute** cible
qui n'est pas explicitement dans le périmètre (allowlist hôtes/IP/CIDR) et
dans la fenêtre temporelle autorisée.

```bash
# 1. Déclarer l'engagement (périmètre + fenêtre)
node src/index.js engagement \
  --user "pentester@exemple.com" \
  --mandate ENGAGE-2026-001 \
  --scope "203.0.113.0/24,app.client.com" \
  --confirm "Je certifie être autorisé à tester ce système"
  # --start / --end (ISO) optionnels ; défaut : maintenant → +7 jours

# 2. Lancer la vérification (constat d'exploitabilité NON destructif)
node src/index.js verify --target app.client.com
```

Une cible hors périmètre est **refusée** (`OUT_OF_SCOPE`), même si un
engagement est actif pour d'autres cibles.

### Vérifications intégrées — NON DESTRUCTIVES

| Fichier | Ce qu'il confirme (sans exploiter) |
|---|---|
| `verify/tls-weakness.js` | Protocoles TLS obsolètes (1.0/1.1) **réellement acceptés** — handshakes forcés, aucune donnée extraite. |
| `verify/web-misconfig.js` | Listing de répertoire, endpoints de debug (Spring Actuator…), traces d'erreur verbeuses — via GET simples. |

Ces contrôles **confirment** une faiblesse (elle est réelle, pas supposée
d'après un numéro de version) sans jamais l'exploiter.

### Plugins opérateur (`src/plugins/`)

Le tool **n'embarque volontairement aucun exploit armé**. Pour un PoC
d'exploitation réel, un opérateur qualifié dépose son module dans
`src/plugins/enabled/` (contrat documenté dans `plugins/loader.js`), dont il
assume la responsabilité légale. Le loader impose la RoE **avant** d'exécuter
le moindre plugin ; les plugins marqués `intrusive: true` ne tournent qu'avec
`--allow-intrusive`.

Exemple fourni (non intrusif) : `plugins/enabled/http-methods.js`.

**Hors périmètre volontaire** : exploits RCE clés en main, brute-force de
credentials, DoS, génération de payloads, évasion de détection. Ces éléments
relèvent du plugin opérateur sous mandat, pas de l'outil.

## Tests

```bash
npm test
```

Les tests vérifient notamment que **le scan est bloqué sans consentement**,
que la **RoE bloque les cibles hors périmètre** (matching CIDR/hôte) et que la
**vérification refuse une cible hors scope** (`OUT_OF_SCOPE`).
