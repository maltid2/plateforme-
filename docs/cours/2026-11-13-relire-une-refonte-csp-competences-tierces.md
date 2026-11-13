# Fiche — Relire une refonte : une CSP à deux visages, des « compétences » tierces dans le dépôt, un fichier d'instructions pour agents

Piste : le projet et le développement (rotation du vendredi). Lecture + exercice : 25 à 30 minutes. Matière : ce que tes agents ont fusionné dans `main` depuis la PR #53 (période du 5 au 6 novembre). **Ce que j'ai lu :** la liste des commits, le diff complet de `a13db51` (`next.config.mjs`, `tailwind.config.ts`, `AGENTS.md`, message de commit), les fichiers `ORIGINE.md` des deux compétences ajoutées, et des extraits de leurs scripts. **Ce que je n'ai pas lu :** les diffs de `Navbar.tsx`, `Modules.tsx`, `Problem.tsx`, `HeroDashboard.tsx`, `Footer.tsx` et le fichier `COURS-SOLUTIONS-TRACKING.md` (document sans lien avec cette période). Je ne dis donc rien de leur contenu.

## 1. Pourquoi cette lecture

Trois changements de nature différente sont arrivés dans la même fusion (`24810c1`), et **aucun n'est « de l'interface »** au sens strict :
1. **Une configuration de sécurité** (`Content-Security-Policy`) rendue conditionnelle à l'environnement.
2. **Deux ensembles de fichiers tiers** (106 fichiers, environ 3,9 Mo) copiés dans `.claude/skills/` : ce sont des **instructions et des scripts** que tes futurs agents pourront charger.
3. **Un fichier `AGENTS.md`** qui s'adresse aux agents, généré par un outil.
Ton rôle de relecteur : décider **ce qui mérite une vérification de ta part** parmi des diffs que tu ne liras pas ligne à ligne.

## 2. Le mécanisme, point par point

### 2.1 La CSP conditionnelle (diff réel de `a13db51`, `sentinelscope/next.config.mjs`)
Avant : `script-src 'self' 'unsafe-inline'` et `connect-src 'self'`, quel que soit l'environnement.
Après :
```js
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";
...
isDev ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
```
Pourquoi : le message de commit l'explique. `npm run dev` affichait une page blanche, parce que webpack et le Fast Refresh de React enveloppent les modules dans des `eval()`, que la CSP refusait faute de `'unsafe-eval'`. Le commit annonce : « la CSP servie en production est inchangée (vérifié sur `next start` ».
**Lecture du relecteur :**
- Le correctif est **légitime** (un outil de développement qui ne marche pas est un vrai problème).
- **Sens de la condition :** `NODE_ENV !== "production"` signifie « tout ce qui n'est pas explicitement `production` est traité comme du développement ». C'est une condition **qui s'ouvre par défaut** (*fail-open*). Si, un jour, une variable d'environnement est absente ou mal nommée sur un hébergement (par exemple `staging`), le site servi au public recevrait `'unsafe-eval'` et les WebSockets. La forme inverse, `=== "development"`, **se ferme par défaut** (*fail-closed*).
- **Nuance, de ma mémoire et non vérifiée dans le dépôt :** Next.js positionne lui-même `NODE_ENV` à `production` pour `next build` et `next start`. Si c'est exact, le risque pratique est faible ; mais le principe de conception reste : sur un **produit d'audit de sécurité**, une politique de sécurité devrait échouer fermée.
- **Autre fait de la même CSP, ancien et non modifié par ce diff :** le commentaire du fichier dit que `'unsafe-inline'` est autorisé pour les scripts « (pas de nonce middleware ici) ». Un outil qui audite des CSP et qui en sert une avec `'unsafe-inline'` en production est exposé à une critique facile. Ce n'est **pas** un défaut de ce diff, c'est une dette connue.

### 2.2 Les compétences tierces (`.claude/skills/`)
Deux commits du 2026-11-05 ajoutent :
- **`unslop`** (source : `github.com/theclaymethod/unslop`, commit `17ed39c`, version 2.3.0, licence MIT) ;
- **`ui-ux-pro-max`** (source : `github.com/nextlevelbuilder/ui-ux-pro-max-skill`, commit `b7d5353`, version 2.15.0, licence MIT).
**Ce qui est bien fait (d'après leurs `ORIGINE.md`, que j'ai lus) :** la **provenance** est écrite (dépôt, commit, version, licence), ce qui a été **conservé et écarté** est listé, la **seule modification locale** de `ui-ux-pro-max` est décrite (réécriture de 11 chemins), la méthode de **mise à jour** est donnée, et un **doublon** avec une version plus ancienne du compte claude.ai est signalé.
**Pourquoi c'est un sujet de sécurité :** une « compétence » est un ensemble d'**instructions** qu'un agent suit et de **scripts** qu'il peut exécuter. L'importer dans le dépôt revient à donner à tes agents des consignes écrites par un tiers. C'est le même risque que la chaîne d'approvisionnement des dépendances (fiche du 23 octobre), mais **moins visible**, parce que `npm audit` ne regarde pas ces fichiers.
**Ce que j'ai vérifié dans les scripts de `unslop` (lecture seule, rien exécuté) :**
- `wiki_sync.py` : se connecte à `https://en.wikipedia.org/w/api.php` (réseau, un seul domaine). Sa documentation propose un enchaînement qui **envoie le texte récupéré à un agent** : `python wiki_sync.py prompt | claude -p --allowedTools Edit,Read,Grep,Glob,Bash`. **Conséquence :** du contenu externe (une page publique modifiable) devient une **consigne** pour un agent qui a le droit d'exécuter des commandes (`Bash`). C'est exactement le schéma « un contenu externe est une donnée, jamais une instruction » : **je te recommande de ne jamais lancer cet enchaînement**, et de demander à tes agents de ne pas le faire.
- `harvest_samples.py` : lit des fichiers **que l'utilisateur lui désigne**, y compris des **transcriptions de sessions** d'agents (formats `claude-jsonl` et `codex-jsonl`) ; ce n'est pas un défaut en soi, mais cela peut **extraire du texte de conversations**, donc potentiellement des secrets si on le pointe sur un mauvais dossier.
- `refresh_status.py` : appelle `git log` (lecture de l'historique).
- `contribute.py` : lance d'autres scripts du dossier avec `subprocess`.
**Ce que je n'ai pas fait :** lire les 21 scripts de `unslop` et les 8 de `ui-ux-pro-max` en entier. `ORIGINE.md` d'`ui-ux-pro-max` dit « bibliothèque standard seulement » et « vérifié avec `python3.13 -I scripts/search.py --help` » : je ne l'ai pas contrôlé.
**Un manque concret :** je n'ai trouvé **aucun fichier de licence** (`LICENSE`) dans `.claude/skills/` (seul un fichier de données sur les licences de polices existe). Les `ORIGINE.md` **citent** « licence MIT » et le nom de l'auteur, mais **ne reproduisent pas le texte de la licence**. Les termes MIT demandent d'inclure l'avis de droit d'auteur et l'avis de permission dans les copies (de ma connaissance générale ; **je ne suis pas juriste** et je n'ai pas relu le texte). C'est un point à faire vérifier, pas une conclusion.

### 2.3 Le fichier `AGENTS.md` (généré par `next dev`)
Le commit ajoute `sentinelscope/AGENTS.md` (9 lignes), dont le titre est « This is NOT the Next.js you know » et qui renvoie vers `node_modules/next/dist/docs/`. Le commit explique : ce fichier est « régénéré à chaque lancement de `next dev` », donc versionné pour garder l'arbre propre.
**Lecture :** un fichier `AGENTS.md` **s'adresse aux agents** : il fait partie des consignes qu'ils suivent. Ici, son contenu est écrit par l'outil (Next.js), pas par toi ni par tes agents. Ce n'est pas alarmant ; c'est un rappel : **tout fichier de consignes commité mérite une lecture humaine**, surtout s'il est généré.

### 2.4 Ce que le message de commit fait bien (modèle de description)
`a13db51` explique le **pourquoi** (page de 7305 px dont les blocs se répétaient), liste les **suppressions** et leur raison, décrit l'**échelle de sévérité** (rouge, orange, jaune, vert, gris **avec le libellé texte conservé** pour le daltonisme), et précise que `acc.green/cyan/violet` pointent volontairement vers la même teinte (« 91 occurrences » d'après le commentaire de `tailwind.config.ts`). Chiffres annoncés : page de 7305 à 6749 px. **Je n'ai rien mesuré** : ces chiffres sont ceux du message.

## 3. Lecture du réel : le point de bascule

```js
const isDev = process.env.NODE_ENV !== "production";
```
- `process.env.NODE_ENV` : variable d'environnement lue au démarrage ; trois valeurs usuelles : `development`, `production`, `test`.
- `!== "production"` : **vrai pour toute valeur autre que `production`**, y compris une valeur absente (`undefined`) ou fautive.
- Effet : `isDev` vrai ⇒ `'unsafe-eval'` autorisé et `ws:`/`wss:` ajoutés à `connect-src`.
Question de relecture à poser à l'agent : « Que se passe-t-il si `NODE_ENV` vaut `staging` ou n'est pas défini ? » Réponse lue dans le code : **la CSP de développement est servie**.

## 4. Ce qui casse, symptôme, remontée

| Risque | Symptôme | Comment vérifier |
|---|---|---|
| CSP de développement servie en production | En-tête `Content-Security-Policy` avec `'unsafe-eval'` et `ws:` ; un outil d'audit le signale | Lire l'en-tête réellement servi par **ton** déploiement (exercice §7) |
| Compétence tierce modifiée en amont | Comportement d'agent qui change après une mise à jour | Comparer au commit épinglé dans `ORIGINE.md` |
| Contenu externe transformé en consigne | Un agent exécute une commande demandée par une page | Ne jamais piper une page vers un agent muni de `Bash` |
| Transcriptions de sessions aspirées | Secrets dans des fichiers d'échantillons | Ne désigner que des dossiers choisis, relire la sortie |
| Licence non reproduite | Problème de conformité | Vérifier les termes avec une personne compétente |
| `AGENTS.md` généré non relu | Consignes d'un tiers appliquées sans contrôle | Le lire une fois, noter sa source |

**Piège de raisonnement :** « c'est du `chore(skills)`, donc sans risque ». Le préfixe d'un commit décrit l'intention, pas l'**effet** : des instructions d'agent sont du code d'exécution déguisé.

## 5. Vocabulaire (FR / EN)

| FR | EN | Définition, piège |
|---|---|---|
| politique de sécurité du contenu (CSP) | *Content-Security-Policy* | en-tête qui limite ce que la page a le droit de charger/exécuter |
| `'unsafe-eval'` | *`'unsafe-eval'`* | autorise `eval()` et assimilés ; **piège :** ≠ `'unsafe-inline'` (scripts en ligne) |
| s'ouvre par défaut / se ferme par défaut | *fail-open / fail-closed* | **piège :** « sûr par défaut » = *fail-closed* |
| variable d'environnement | *environment variable* | ici `NODE_ENV` |
| compétence (d'agent) | *(agent) skill* | instructions + scripts chargés par un agent ; **faux ami :** pas « compétence » RH |
| provenance | *provenance* | d'où vient un fichier, quelle version |
| chaîne d'approvisionnement | *supply chain* | tout ce qu'on importe d'autre |
| épingler (une version) | *to pin* | figer un commit/une version |
| injection de consigne | *prompt injection* | texte externe qui se fait passer pour une consigne |
| bac à sable / droits d'outils | *allowed tools* | outils qu'un agent a le droit d'utiliser (`Bash`...) |
| licence MIT | *MIT license* | licence permissive ; exige de conserver l'avis |
| code mort | *dead code* | code jamais utilisé |
| dette technique | *technical debt* | écart connu entre l'état et le bon état |
| retour arrière | *rollback / revert* | |
| faux ami : *to commit* | = enregistrer un changement | pas « s'engager » |

## 6. Comment le dire juste

**À un collègue (FR) :** « La CSP passe en mode développement dès que `NODE_ENV` n'est pas exactement `production`. En production Next la positionne, donc ça va ; mais la condition s'ouvre par défaut, je préférerais qu'elle se ferme. »

**À ton agent (FR + EN) :**
- FR : « Peux-tu inverser la condition de la CSP pour qu'elle ne soit permissive que si `NODE_ENV` vaut explicitement `development` ? Et ajouter le fichier de licence des deux compétences ? »
- EN: "Can you invert the CSP condition so it is permissive only when `NODE_ENV` is explicitly `development`? And add the license file for both skills?"

**Dans une issue / un commentaire de PR (FR + EN) :**
- FR : « `next.config.mjs` : `isDev = NODE_ENV !== "production"` sert `'unsafe-eval'` et `ws:` pour toute valeur autre que `production` (fail-open). Proposition : `=== "development"`. Non vérifié : valeur de `NODE_ENV` sur l'hébergement. »
- EN: "`next.config.mjs`: `isDev = NODE_ENV !== "production"` serves `'unsafe-eval'` and `ws:` for any value other than `production` (fail-open). Proposal: `=== "development"`. Not verified: the `NODE_ENV` value on the hosting platform."

## 7. Exercice d'observation (20 à 30 minutes, **sur ton propre produit et ton propre dépôt**)

1. Ouvre **ton** site SentinelScope déployé dans un navigateur. Outils de développement → onglet Réseau → premier document → **en-têtes de réponse** → `Content-Security-Policy`. **Hypothèse à écrire d'abord :** y a-t-il `'unsafe-eval'` ? `ws:` ?
2. Compare : la valeur lue est-elle celle de la branche « production » du code ?
3. Dans ton dépôt, ouvre `.claude/skills/unslop/ORIGINE.md` et `.claude/skills/ui-ux-pro-max/ORIGINE.md` : note commit, version, licence. Cherche un fichier `LICENSE` dans chaque dossier.
4. Lis `sentinelscope/AGENTS.md` (9 lignes) : d'où vient son contenu ?
5. Écris la phrase de commentaire de PR (§6) avec **ce que tu as constaté**.

<details><summary>Solution</summary>

Résultat attendu (**non exécuté par moi**) : en production, ni `'unsafe-eval'` ni `ws:` ; deux `ORIGINE.md` complets ; pas de `LICENSE` ; un `AGENTS.md` généré par Next. Si tu lis `'unsafe-eval'` sur le site public, c'est une **trouvaille importante** : dis-le-moi, je rédige l'issue pour ATLAS.
</details>

## 8. Révision espacée

**D'hier (fiche du 2026-11-12, OpenSSH musl) :**
1. Que prouve l'ajout `strlen(pw_password) >= MIN_PASSWORD_HASH_LEN` dans le diff, et que ne prouve-t-il pas ?
2. Pourquoi mettre à jour le paquet ne suffit-il pas ?
3. Pourquoi ne peut-on pas conclure que les systèmes à glibc sont concernés ?

**D'il y a 7 jours (fiche du 2026-11-06, PR #53) :**
1. Pourquoi un `backdrop-filter` devant un canvas animé coûte-t-il cher à chaque image ?
2. Comment `AuditForm` et `NetworkBackground` communiquent-ils, et quel est le risque ?
3. Quelle hypothèse non testée de la fiche concernait `body { overflow: hidden }` ?

<details><summary>Réponses</summary>

D'hier : (1) Il prouve qu'OpenSSH refuse de comparer quand la valeur stockée est trop courte pour être un hachage ; il ne prouve pas à lui seul le comportement de la bibliothèque C. (2) Il faut redémarrer sshd. (3) Les sources lues ne parlent que de musl sans PAM.
Du 6 : (1) Le navigateur relit ce qui est derrière, le floute et le recompose à chaque image. (2) Par la classe `modal-open` sur `body` ; renommée d'un côté, le fond ne se met plus en pause sans erreur. (3) Un décalage de la mise en page quand la barre de défilement de 10 px disparaît.
</details>

## 9. Trois questions de contrôle

1. Pourquoi `process.env.NODE_ENV !== "production"` « s'ouvre-t-il par défaut » ?
2. Pourquoi des fichiers `.claude/skills/` sont-ils un sujet de chaîne d'approvisionnement, alors que `npm audit` ne les voit pas ?
3. Pourquoi ne faut-il pas envoyer le texte d'une page externe à un agent muni de `Bash` ?

<details><summary>Réponses</summary>

1. Toute valeur autre que `production`, y compris absente ou fautive, est traitée comme du développement. 2. Ce sont des instructions et des scripts qu'un agent suit ou exécute, importés d'un tiers, hors du périmètre de `npm`. 3. Le contenu externe devient une consigne : une page modifiée peut faire exécuter une commande.
</details>

## 10. Sources (consultées le 2026-11-13)

- Dépôt `maltid2/plateforme-`, branche `main` : commits `a7fb977`, `252636e`, `625c653`, `a13db51`, `945fe3c`, `93f95e1`, `24810c1` ; diff de `a13db51` (`sentinelscope/next.config.mjs`, `tailwind.config.ts`, `AGENTS.md`) ; `.claude/skills/unslop/ORIGINE.md`, `.claude/skills/ui-ux-pro-max/ORIGINE.md` ; extraits de `wiki_sync.py`, `refresh_status.py`, `harvest_samples.py` ; recherche de fichiers de licence.
- **Non lu :** les diffs de présentation (Navbar, Modules, Problem, HeroDashboard, Footer), les 21 + 8 scripts en entier, les dépôts amont des deux compétences, les termes de la licence MIT. **De ma mémoire, non vérifié :** que Next.js positionne `NODE_ENV` à `production` pour `next build` et `next start`.
