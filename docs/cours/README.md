# Cours MINERVE — plan de montée en compétence

Analyse de l'examen FEDE (janvier 2025) : [`anglais-examen-fede-cu-b4-analyse.md`](anglais-examen-fede-cu-b4-analyse.md).

Plans et calendriers : [`parcours-en-parallele.md`](parcours-en-parallele.md) (toutes les pistes) et [`anglais-plan-a2-b2-janvier.md`](anglais-plan-a2-b2-janvier.md) (examen du 4 janvier 2027).

Objectif : savoir **juger un diff** produit par ATLAS, GHOST, SIMBA ou le CEO sur SentinelScope, pas réciter du vocabulaire.
Matière : le dépôt (code, commits, PR, issues) et le web (sources citées avec date de consultation).
Chaque fiche : 20 à 30 minutes, exercice compris. Fiches dans ce dossier, nommées `AAAA-MM-JJ-sujet.md`.

## Profil et niveaux constatés (mis à jour le 2026-10-23)

- **Réseau et commutation : à l'aise en pratique** (déclaré). Preuve dans le dépôt : `Read Me Exercice Packet Tracer Cisco` décrit un mini-lab VLAN, trunks entre commutateurs, routage inter-VLAN en *router-on-a-stick*, DHCP sur routeur et Wi-Fi. Conséquence : la fiche n° 2 du 22 octobre (DNS/TCP/TLS/HTTP) était d'un niveau plus basique que nécessaire ; les prochaines fiches réseau expliquent **ce qui se passe dans l'équipement** et donnent le vocabulaire exact, sans tutoriel de configuration.
- **Active Directory** et **SQL** : niveau **non établi**. Calibrage par trois questions de difficulté croissante à la première fiche de chaque piste (mardi pour Active Directory, mercredi pour SQL) ; résultat noté ici.
- **Matière disponible dans le dépôt** : `projet plateforme.pkt`, `Read Me Active Directory`, `Read Me Exercice Packet Tracer Cisco`, `script ajout utilisateur Active Directory`, `fichier csv`, `docker-compose.yml`.
- **Règle** : aucune manipulation d'apprentissage sur le réseau de l'employeur ; laboratoires personnels uniquement (Packet Tracer, GNS3, VM Windows Server, conteneur de base de données). Vérifier une version ou l'exposition d'un portail d'administration relève de l'exploitation normale, pas de l'apprentissage.

## Rotation hebdomadaire des fiches

lundi réseau et commutation · mardi Active Directory et Windows Server · mercredi SQL · jeudi sécurité de l'infrastructure · vendredi projet et développement · samedi poste de travail et support · dimanche synthèse. Veille des avis éditeurs : [`veille.md`](veille.md).

## Les cinq pistes

### Piste 1 — Langages et technique du projet (TypeScript, Node, Next.js, CSS)

| Niveau | Contenu | Prérequis |
|---|---|---|
| 1. Lire | Syntaxe JS/TS, modules, `async/await`, JSON, lire une stack trace ; HTML/CSS : cascade, boîte, flexbox | Aucun |
| 2. Comprendre | Composants React (props, état, rendu), routes Next.js (App Router), rendu serveur vs client, pipeline de rendu du navigateur, Tailwind | Niveau 1 |
| 3. Juger | Lire un diff de migration (ex. Next 15 → 16, React 19), perf web (Core Web Vitals), tests, moteur d'audit Node natif (`audit-engine/`) : flux, erreurs, délais d'attente | Niveau 2 |

### Piste 2 — Réseau et système

| Niveau | Contenu | Prérequis |
|---|---|---|
| 1. Lire | Client/serveur, URL, DNS, HTTP (méthodes, codes, en-têtes), ligne de commande Linux, `git` | Aucun |
| 2. Comprendre | TLS et certificats, cookies, CORS, redirections, cache HTTP/CDN, variables d'environnement, processus, GitHub Actions | Niveau 1 |
| 3. Juger | Déploiement et rollback, limites de débit, délais d'attente et reprise, journaux, SSRF côté réseau (pourquoi un outil qui visite des URL est dangereux) | Niveau 2 |

### Piste 3 — Sécurité web

| Niveau | Contenu | Prérequis |
|---|---|---|
| 1. Lire | Confidentialité/intégrité/disponibilité, HTTPS, mots de passe, ce qu'est une CVE et un score CVSS | Piste 2 niveau 1 |
| 2. Comprendre | En-têtes de sécurité (CSP, HSTS, X-Frame-Options…), XSS, CSRF, injection, OWASP Top 10, cookies `Secure`/`HttpOnly`/`SameSite` | Piste 2 niveau 2 |
| 3. Juger | Lire un avis de sécurité et décider de l'urgence (ex. alerte Next), chaîne d'approvisionnement des dépendances, ce qu'un audit passif peut et ne peut pas affirmer (faux positifs/négatifs), cadre légal d'un scan | Niveau 2 |

### Piste 4 — Anglais technique (priorité : le vocabulaire réseau)

Glossaire de travail : [`anglais-reseau-glossaire.md`](anglais-reseau-glossaire.md) (~90 termes, prononciation, codes HTTP, phrases d'erreur, méthode de mémorisation). Chaque fiche ajoute ses 10 à 15 termes du jour.

| Niveau | Contenu | Prérequis |
|---|---|---|
| 1. Reconnaître | 200 termes de base (commit, merge, branch, deploy, bug, fix, issue…) et tout le glossaire réseau, prononciation des pièges | Aucun |
| 2. Lire | Notes de version, README, messages d'erreur, avis de sécurité : comprendre sans traduire mot à mot | Niveau 1 |
| 3. Écrire | Rédiger une description de PR, une issue, un commentaire de revue clairs et courtois en anglais | Niveau 2 |

### Piste 5 — Français écrit (orthographe, grammaire, rédaction professionnelle)

| Niveau | Contenu | Prérequis |
|---|---|---|
| 1. Fiabiliser | homophones fréquents et tests de remplacement, accords simples (sujet–verbe, participe en -é/-er) | Aucun |
| 2. Accorder | participe passé (être / avoir / pronominaux), accords dans le groupe nominal, ponctuation | Niveau 1 |
| 3. Rédiger | structure d'un rapport, concision, ton professionnel, relecture méthodique | Niveau 2 |

Fiche 1 : [`francais-orthographe-fiche-1-homophones.md`](francais-orthographe-fiche-1-homophones.md).

## Tableau de suivi

Statuts : `vu` · `à revoir` · `acquis`. Mis à jour à chaque fiche.

| Sujet | Piste | Date | Statut |
|---|---|---|---|
| Repaints et animations web (pipeline de rendu, `transform`/`opacity`, `@property`) | 1 | 2026-10-22 | vu (fiche rédigée, en attente de lecture) |
| De l'URL à la réponse : DNS, TCP, TLS, HTTP (fiche n° 2) | 2/3 | 2026-10-22 | vu (fiche rédigée, en attente de lecture) |
| Anglais réseau : glossaire | 4 | 2026-10-22 | à revoir (à apprendre par répétition) |
| Anglais cybersécurité/infra : glossaire + cas n° 1 | 4 | 2026-10-22 | à revoir |
| Français : homophones (fiche 1) | 5 | 2026-10-22 | vu (fiche rédigée, en attente de lecture) |
| Lire un avis de vulnérabilité de dépendance (plages, correctifs par branche) | 1/3 | 2026-10-23 | vu (fiche rédigée, en attente de lecture) |

## Calibrage

Réponds en commentaire de la PR, une ligne par question suffit. « Je ne sais pas » est une réponse utile : elle fixe le point de départ. Ne cherche pas la réponse avant d'avoir essayé.

### Piste 1 — Langages et technique

1. Dans une page web, à quoi servent respectivement HTML, CSS et JavaScript ?
2. Que fait `const x = await fetch(url)` et pourquoi le mot `await` est-il là ?
3. Dans Next.js, quelle différence entre un composant serveur et un composant client (`"use client"`) ?
4. Pourquoi anime-t-on plutôt `transform` que `left` ou `top` ?
5. Un diff passe `package.json` de `"next": "15.x"` à `"16.x"` : cite trois choses que tu vérifies avant de fusionner.

### Piste 2 — Réseau et système

1. Que se passe-t-il, dans les grandes lignes, entre le moment où tu tapes une URL et celui où la page s'affiche ?
2. Que signifient les codes HTTP 200, 301, 403, 404 et 500 ?
3. À quoi sert un enregistrement DNS de type A, et de type CNAME ?
4. Qu'apporte TLS (le « S » de HTTPS) et que ne garantit-il pas ?
5. Un appel à un site tiers dépasse son délai d'attente : quels réglages et quelles protections mets-tu dans le code qui l'appelle ?

### Piste 3 — Sécurité web

1. Quelle différence entre une vulnérabilité, une exploitation et un risque ?
2. Qu'est-ce qu'une CVE ? Qu'indique un score CVSS, et qu'est-ce qu'il n'indique pas ?
3. À quoi sert l'en-tête `Content-Security-Policy` ? Quelle attaque limite-t-il ?
4. Explique la différence entre XSS et CSRF.
5. SentinelScope visite l'URL qu'un utilisateur lui donne : quel est le risque SSRF et comment le limiter ?

### Piste 4 — Anglais technique

1. Traduis : « The build failed because of a missing dependency. »
2. Quelle différence entre *to merge*, *to rebase* et *to squash* ?
3. Traduis : « This change is backwards compatible but deprecates the old option. »
4. Que veut dire « LGTM » et dans quel contexte l'écrit-on ?
5. Écris en anglais, en deux phrases, un commentaire de PR qui demande poliment d'ajouter un test.
