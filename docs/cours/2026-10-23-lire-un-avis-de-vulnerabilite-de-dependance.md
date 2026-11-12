# Fiche — Lire un avis de vulnérabilité de dépendance : plages de versions, correctifs par branche, et ce que « critique » veut dire

Piste : le projet et le développement (rotation du vendredi). Lecture : 25 minutes, exercice compris.
Objectif : à la fin, tu peux juger la PR #45 d'ATLAS (Next 14 → 16) et expliquer à quelqu'un pourquoi on ne pouvait pas simplement « mettre à jour » Next.

## 1. Pourquoi ce mécanisme, et ce qu'il change dans ton diagnostic

Cette semaine, ATLAS a livré la PR #45 « migration Next 16 + React 19 (alerte critique Next) » : un saut de version majeure pour corriger des alertes. Quand un agent te propose ça, la question n'est pas « est-ce que ça compile » (il l'a vérifié) mais : **la migration était-elle nécessaire, et que risque-t-elle ?** Pour y répondre, il faut savoir comment un outil décide qu'une version est « vulnérable » et pourquoi, parfois, la seule sortie est de changer de version majeure. C'est la même logique que lire un avis Palo Alto ou Fortinet (voir `veille.md`) : plage affectée, version corrigée par branche, exploitation constatée ou non, applicabilité chez toi.

## 2. Le mécanisme, étape par étape

### 2.1 La plage déclarée et la version réellement installée
Dans `sentinelscope/package.json` de `main`, on lit `"next": "^14.2.35"`. Le signe `^` (« caret ») déclare une **plage** de versions acceptables, pas une version. Avec la bibliothèque `semver` fournie avec npm 10.9.4 (Node 22.22.0), j'ai obtenu :

```
^14.2.35  =>  >=14.2.35 <15.0.0-0
^14.2.35  satisfait 14.2.35 : true      14.9.0 : true
^14.2.35  satisfait 15.0.0  : false     16.4.2 : false
```

Lecture : `^14.2.35` accepte toute version 14.x à partir de 14.2.35, et **jamais** la 15 ni la 16. Les versions suivent le schéma MAJEUR.MINEUR.CORRECTIF (*semantic versioning*) : un changement de MAJEUR peut casser la compatibilité, MINEUR ajoute des fonctions, CORRECTIF corrige des défauts. Le fichier `package-lock.json` fige la version **exacte** installée ; c'est elle, pas la plage, qui compte pour l'audit (comportement standard de npm, décrit de mémoire : documentation npm non relue aujourd'hui).

### 2.2 Comment l'outil décide « vulnérable »
`npm audit` envoie au registre npm la liste des paquets avec leurs versions installées. J'ai reproduit l'appel (lecture seule, sur ta propre dépendance) :

```
POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk
corps : {"next":["14.2.35"]}
```

Le corps ne contient **que des noms et des numéros de version** : ni ton code, ni ta configuration. Le registre renvoie, pour chaque avis, un champ `vulnerable_versions` (une plage). Le verdict est donc un **test d'appartenance** : ta version est-elle dans la plage ? Voici la vérification faite avec `semver` :

```
>=10.0.0 <=15.5.27 satisfait 14.2.35 : true     → vulnérable
>=16.0.0 <=16.4.0  satisfait 16.4.2  : false    → non concerné
>=16.0.0 <=16.4.0  satisfait 16.4.0  : true     → vulnérable
```

Conséquence essentielle : l'outil **ne sait pas si ton code emprunte le chemin fautif**. Il signale tout ce dont la version tombe dans la plage. C'est pour cela qu'une alerte « critique » peut ne pas s'appliquer chez toi, et qu'il faut lire les **conditions d'exploitation**.

### 2.3 « Corrigé en » : une version par branche
Un avis liste les versions corrigées **par branche** parce que les mainteneurs ne corrigent pas toutes les branches. Pour l'avis GHSA-2464-fhr4-w9xw (lu sur GitHub le 2026-10-23) : corrigé en **15.5.28** (branche 15) et **16.4.1** (branche 16), et **aucune version corrigée listée pour la 14**. Même chose pour GHSA-2xp9-vwfh-vxw4 (15.5.24 ; 16.3.3) et GHSA-p293-qw3h-jr36 (15.5.24 ; 16.3.3).

D'où le piège : comme le `^14.2.35` interdit 15 et 16 (§2.1), **`npm update` ne peut pas corriger** : il reste dans la 14, qui n'a pas de correctif. La seule voie est de **modifier la plage dans `package.json`** vers une branche corrigée, c'est-à-dire un changement de version majeure. Le terme est le *rétroportage* (*backport*) : porter un correctif sur une branche ancienne. Ici il n'existe pas pour la 14, d'après les pages lues.

### 2.4 Le prix d'un saut de version majeure
La PR #45 déclare les cassures réellement rencontrées : (a) Next 16 utilise par défaut un autre empaqueteur (Turbopack) ; l'API d'audit charge le moteur via `__non_webpack_require__`, que Turbopack ne connaît pas, et `/api/audit` renvoyait **500** (constaté par ATLAS) ; la parade est de forcer webpack (`--webpack`) ; (b) l'option `eslint` de `next.config.mjs` n'existe plus ; (c) un type React (`JSX.Element`) a changé de nom ; (d) `tsconfig.json` est réécrit automatiquement. Ce sont des **changements cassants** (*breaking changes*).

### 2.5 Trois questions différentes qu'on confond
| Question | Ce qui la mesure | Exemple lu aujourd'hui |
|---|---|---|
| **Gravité** : quel dégât si ça marche ? | score CVSS | GHSA-2464 : 9,5 (CVSS 4.0) |
| **Exploitation** : quelqu'un s'en sert-il ? | catalogue CISA KEV, déclaration de l'éditeur, EPSS (probabilité estimée) | PAN-OS CVE-2026-0322 : « ATTACKED » ; GHSA-p293 : EPSS 2,105 % |
| **Applicabilité** : suis-je concerné chez moi ? | les conditions écrites dans l'avis (configuration, système, option) | GHSA-p293 : « hébergé sur système de fichiers Windows » |

Un score 9,5 répond à la première seulement. ATLAS écrit, dans la PR #45, que « plusieurs avis ne s'appliquent probablement pas » ; la bonne attitude est la sienne : **probablement**, pas **sûrement**. L'issue #49 consigne ce qui reste à établir.

## 3. La lecture du réel

Sortie authentique de l'API d'avis npm pour `next@14.2.35` (extraits, consultée le 2026-10-23), puis ce que chaque champ veut dire :

```
critical 1193677 https://github.com/advisories/GHSA-p293-qw3h-jr36 | Next.js: Unauthenticated Remote Code Execution on windows-hosted servers | >=13.4.0 <15.5.24
critical 1193733 https://github.com/advisories/GHSA-2xp9-vwfh-vxw4 | ... Remote Code Execution in Image Optimization API when AVIF files a... | >=10.0.0 <15.5.24
critical 1242817 https://github.com/advisories/GHSA-2464-fhr4-w9xw | ... Remote Code Execution in Image Optimization API when SVG files ar... | >=10.0.0 <=15.5.27
high     1124185 https://github.com/advisories/GHSA-89xv-2m56-2m9x | Next.js: Server-Side Request Forgery in Server Actions on custom servers | >=14.1.1 <15.5.21
```

| Champ | Sens |
|---|---|
| `critical` / `high` | gravité déclarée par l'avis (≠ exploitabilité chez toi) |
| `1242817` | identifiant interne du registre npm |
| `GHSA-…` | identifiant de l'avis GitHub (*GitHub Security Advisory*) ; il peut exister **sans** numéro CVE (la page de GHSA-2464 affiche « No known CVE » mais cite CVE-2026-96889 : à ne pas prendre pour confirmé) |
| titre | le type de faille et, **souvent, la condition** : « on windows-hosted servers », « when AVIF files are… » |
| `>=10.0.0 <=15.5.27` | plage vulnérable ; `<` exclut la borne, `<=` l'inclut |

Pour `next@16.4.2` et `react@19.3.1`, `react-dom@19.3.1` (versions de la PR #45), la même requête renvoie `{}`, c'est-à-dire aucun avis connu du registre ce jour.

## 4. Ce qui casse, et le symptôme

| Défaut classique | Symptôme sur le terrain | Remonter du symptôme à la cause |
|---|---|---|
| Croire que `npm update` suffit | l'alerte reste après la mise à jour | comparer la plage `^14…` (§2.1) et les versions corrigées de l'avis (§2.3) |
| Corriger sans tester le moteur chargé à l'exécution | `/api/audit` répond 500 après la montée de version | chercher ce que le nouvel empaqueteur ne connaît plus (`__non_webpack_require__`) |
| Prendre « critique » pour « exploité chez moi » | migration d'urgence non nécessaire, risque de régression | lire la **condition** de l'avis, vérifier la configuration |
| Prendre « moyen » pour « sans importance » | oubli d'une faille déjà exploitée | consulter le KEV : une faille à 6,0 (Fortinet CVE-2025-61624) y figure |
| Fusionner sans captures avant/après | régression visuelle passée inaperçue | la PR #45 déclare ne pas avoir comparé le rendu React 19 ; à demander |

## 5. Vocabulaire du jour (12 termes)

| Français | Anglais | Définition exacte / piège |
|---|---|---|
| avis (de sécurité) | *advisory* | publication d'un éditeur ou d'une base décrivant une faille, ses versions et son correctif. Ne pas confondre avec la CVE (l'identifiant) |
| CVE | *CVE (Common Vulnerabilities and Exposures)* | identifiant public d'une faille (`CVE-AAAA-N`). Une faille peut avoir un avis GHSA sans CVE |
| plage de versions | *version range* | ensemble de versions défini par des bornes ; `<` exclut, `<=` inclut |
| version corrigée | *patched version / fixed version* | première version qui ne contient plus la faille, **par branche** |
| plage caret | *caret range* | `^14.2.35` = `>=14.2.35 <15.0.0` ; ne franchit pas le majeur |
| fichier de verrouillage | *lockfile* | fige les versions exactes installées (`package-lock.json`) |
| dépendance transitive | *transitive dependency* | dépendance d'une dépendance ; tu ne l'as pas choisie mais elle est installée |
| version majeure | *major version* | premier nombre ; peut casser la compatibilité |
| changement cassant | *breaking change* | modification qui oblige les utilisateurs à adapter leur code |
| rétroportage | *backport* | report d'un correctif sur une branche ancienne |
| faux positif | *false positive* | alerte déclenchée alors que la faille n'est pas exploitable chez toi |
| exploitabilité | *exploitability* | possibilité réelle d'exploiter la faille dans un contexte donné ; distincte de la gravité (*severity*) |

Faux amis et approximations : « critique » (*critical*) est une **gravité** déclarée, pas une preuve d'exploitation ; « patch » désigne un correctif, et « fix » le fait de corriger ; « mettre à jour » (*update*) ne franchit pas un majeur, « mettre à niveau » (*upgrade*) est le terme usuel pour un changement de majeure.

## 6. Comment le dire juste

**Pour un collègue** : « Next 14 n'a pas de correctif pour les trois avis critiques, donc `npm update` ne règle rien : il faut passer en 16. La PR d'ATLAS le fait, mais elle casse l'API d'audit sous Turbopack, d'où le `--webpack`. »

**Pour un prestataire ou un éditeur (version française, puis anglaise)** :
- FR : « Pouvez-vous confirmer si la branche 14.x recevra un correctif pour GHSA-2464-fhr4-w9xw ? À défaut, nous migrons vers 16.4.1 ou plus. »
- EN : « Could you confirm whether the 14.x branch will receive a fix for GHSA-2464-fhr4-w9xw? Otherwise, we will upgrade to 16.4.1 or later. »

**Dans un ticket (version française, puis anglaise)** :
- FR : « Next 14.2.35 est dans la plage vulnérable de trois avis critiques (RCE). Aucun correctif en 14.x. Applicabilité non établie (endpoint d'optimisation d'images, système hôte). Correctif prévu : PR #45 (Next 16.4.2), non fusionnée. »
- EN: "Next 14.2.35 falls within the vulnerable range of three critical advisories (RCE). No patched 14.x version is listed. Applicability not established (image optimization endpoint, host OS). Planned fix: PR #45 (Next 16.4.2), not merged yet."

## 7. Exercice d'observation (20 à 30 minutes, dans TON laboratoire, jamais sur le réseau de l'employeur)

Matière : un clone local du dépôt sur ta machine ou dans une VM à toi.

1. **Plages.** Sans lancer de commande, réponds : la version `15.5.20` est-elle dans la plage `>=10.0.0 <=15.5.27` ? Et `15.5.28` ? Vérifie ensuite avec `node -e "const s=require(require('child_process').execSync('npm root -g').toString().trim()+'/npm/node_modules/semver');console.log(s.satisfies('15.5.20','>=10.0.0 <=15.5.27'),s.satisfies('15.5.28','>=10.0.0 <=15.5.27'))"`.
2. **Hypothèse.** L'avis GHSA-2464 parle de fichiers SVG dans l'API d'optimisation d'images. Le dépôt n'utilise pas `next/image` et `next.config.mjs` ne configure pas `images`. Formule **en une phrase** une hypothèse sur la possibilité d'exploitation, et **ce que tu observerais** pour la tester sur ton instance locale (`npm ci`, puis `npx next build`, puis `npx next start`) : le seul geste autorisé est de regarder si l'URL `/_next/image` répond ; n'essaie aucune exploitation.
3. **Décision.** Rédige le titre d'un commentaire de relecture pour la PR #45 : quelle information demandes-tu à ATLAS avant que tu fusionnes ?

<details>
<summary>Solution</summary>

1. `15.5.20` : vrai (dans la plage, donc vulnérable) ; `15.5.28` : faux (au-dessus de la borne, donc corrigé). Cela rejoint le tableau de l'avis : 15.5.28 est la version corrigée de la branche 15.
2. Hypothèse raisonnable : « Sans `remotePatterns` et sans fichiers SVG ou AVIF fournis par un utilisateur, l'attaquant n'a probablement pas de moyen de faire traiter un fichier piégé par l'optimiseur ; mais l'endpoint existant par défaut n'est pas prouvé fermé. » À observer : le code de réponse de `/_next/image` sur l'instance locale (200, 400, 404 ?). Une réponse 400 « url manquante » prouverait que l'endpoint est actif ; cela ne prouve pas qu'il est exploitable. **Je n'ai pas fait cette vérification : c'est volontairement laissé à toi dans ton laboratoire.**
3. Exemple : « Peux-tu confirmer (a) si l'endpoint `/_next/image` est actif en production, (b) l'hébergement (Windows ou non) et (c) fournir des captures avant/après du rendu React 19 ? » Ce sont les trois points que la PR #45 déclare non vérifiés ou que l'issue #49 laisse ouverts.
</details>

## 8. Révision espacée

Reprise de la fiche d'hier (2026-10-22). Il n'existe pas encore de fiche d'il y a sept jours.

1. (Fiche « De l'URL à la réponse ») Dans l'ordre, quelles sont les quatre étapes entre une URL et une réponse ? Pourquoi le garde anti-SSRF résolvait-il le nom deux fois, et quel est le risque (issue #48) ?
2. (Même fiche) Pourquoi `rejectUnauthorized: false` est-il acceptable dans `ssl.js` et dangereux ailleurs ?
3. (Fiche « Repaints et animations ») Pourquoi anime-t-on `transform` plutôt que `background-position` ?

<details>
<summary>Réponses</summary>

1. DNS, TCP, TLS, HTTP. Le garde résout et valide l'IP, puis `https.request` résout de nouveau le nom : entre les deux, le DNS peut renvoyer une autre IP (DNS rebinding) ; correction : connecter à l'IP validée.
2. L'outil veut lire un certificat même invalide pour le signaler et n'envoie aucun secret ; ailleurs, accepter tout certificat permet une interception.
3. `transform` déplace un calque déjà peint (composition seule) ; `background-position` change le contenu et force une repeinture à chaque image.
</details>

## 9. Trois questions de contrôle

1. Pourquoi `npm update` ne corrige-t-il pas Next 14.2.35 pour les avis critiques ?
2. Que contient exactement la requête envoyée à l'API d'avis npm, et qu'en déduis-tu sur la capacité de l'outil à savoir si tu es réellement exposé ?
3. Distingue gravité, exploitation et applicabilité avec un exemple chacun.

<details>
<summary>Réponses</summary>

1. La plage `^14.2.35` interdit les versions 15 et 16 ; or les versions corrigées ne sont listées que pour les branches 15 et 16, aucune pour la 14. Il faut changer la plage dans `package.json` (changement de version majeure).
2. Uniquement des noms de paquets et des numéros de version. L'outil ne voit ni le code ni la configuration : il teste seulement l'appartenance de la version à une plage, donc il ne peut pas dire si le chemin fautif est atteignable ; d'où l'importance de lire les conditions.
3. Gravité : le score CVSS (9,5 pour GHSA-2464). Exploitation : KEV, déclaration de l'éditeur ou EPSS (« ATTACKED » pour PAN-OS CVE-2026-0322). Applicabilité : les conditions de l'avis face à ta configuration (GHSA-p293 ne vaut que sur un système de fichiers Windows).
</details>

## 10. Sources (consultées le 2026-10-23)

- API d'avis npm (bulk) : https://registry.npmjs.org/-/npm/v1/security/advisories/bulk — avis et plages pour `next@14.2.35` ; aucune entrée pour `next@16.4.2`, `react@19.3.1`, `react-dom@19.3.1`.
- GitHub Advisory : https://github.com/advisories/GHSA-2464-fhr4-w9xw (CVSS 4.0 : 9,5 ; affecté `>=10.0.0 <=15.5.27` et `>=16.0.0 <=16.4.0` ; corrigé 15.5.28 et 16.4.1 ; publié le 14 octobre 2026) ; https://github.com/advisories/GHSA-2xp9-vwfh-vxw4 (9,5 ; corrigé 15.5.24 et 16.3.3 ; publié le 25 août 2026) ; https://github.com/advisories/GHSA-p293-qw3h-jr36 (CVE-2026-75604, CVSS 3.1 : 9,0 ; Windows ; EPSS 2,105 % ; corrigé 15.5.24 et 16.3.3).
- Bibliothèque `semver` livrée avec npm 10.9.4 : sorties exécutées localement le 2026-10-23.
- Dépôt : `sentinelscope/package.json` et `next.config.mjs` sur `main` (97a14d0) ; PR #45 (description lue le 2026-10-23) ; issue #49.
- Non vérifié aujourd'hui (de mémoire) : détail du comportement de `package-lock.json` et de la commande `npm update` (documentation npm non relue) ; définition générale de EPSS.
