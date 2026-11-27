# Fiche — Relire un outillage tiers embarqué dans le dépôt : 19 compétences et un mod qui intercepte les commandes shell

*Piste : projet et développement · vendredi 27 novembre 2026 · lecture : 25 min · matière : commits `210a5c7`, `2ec5c37` et `13bdd3a` (25 novembre) sur `main`, lus le 2026-11-27*

> Aucune manipulation : tout se fait par lecture du dépôt. Ce que je n'ai pas lu est dit plus bas.

## 1. Pourquoi ce mécanisme
Tes agents ne font pas que du code produit : ils **installent des choses qui s'exécutent ou guident d'autres agents** à chaque session ouverte sur le dépôt. Un fichier `SKILL.md` oriente le comportement d'un agent ; un *mod* avec un *hook* **exécute du code** avant chaque commande shell. Relire ce genre de PR ne se fait pas comme un correctif de CSS : la question est « qui l'a écrit, sous quelle licence, que peut-il faire, qui peut le modifier ensuite ».

## 2. Le mécanisme (lu dans les commits et fichiers du dépôt)
**Compétences (commit `210a5c7`).** 19 compétences d'`anthropics/skills` recopiées dans `.claude/skills/`, une par dossier, avec leur `LICENSE.txt`. Le fichier `ORIGINE-anthropics-skills.md` (écrit par l'agent) consigne : source et commit amont (`e4bb5d9`, 2026-11-16, **non vérifié par moi côté amont**) ; 18 sur 19 ont une licence Apache 2.0 ; **`doc-coauthoring` n'a pas de `LICENSE.txt` propre** ; `canvas-design` embarque 54 polices `.ttf` (5,6 Mo) ; poids total de `.claude/skills/` : 17 Mo, alors que le dépôt est cloné à chaque build Vercel. Le commit `2ec5c37` **retire cinq doublons** (docx, pdf, pptx, xlsx, skill-creator) déjà fournis au niveau du compte.
**Mod `blast-radius` (commit `13bdd3a`).** Venu de `anthropics/claude-code-playground`, version 0.1.0, Apache-2.0, auteur « Claude Code DevRel » ; le dépôt amont se présente **comme non officiel et sans garantie**. Il est recopié sous `.claude/mods/` et **déclaré dans `.claude/settings.json`** (`extraKnownMarketplaces` avec un chemin relatif `./.claude/mods`, et `enabledPlugins` : `blast-radius@plateforme-mods`). Le fichier `hooks/blast-radius.mjs` (528 lignes) enregistre un **hook `tool.call` sur les appels Bash** : si la commande est jugée risquée (`rm -rf`, `git reset --hard`, `git clean`, `git push --force`, migrations…), il mesure ce qu'elle toucherait, ouvre un panneau **Procéder / Annuler** et **retient l'appel** jusqu'à la réponse ; sinon il laisse passer (`next(e)`).
**Le point structurel.** Déclaré dans le dépôt, ce hook s'exécute pour **toute session ouverte sur ce dépôt**, y compris celles de tes agents. Toute **modification future** de `.claude/mods/` ou de `.claude/settings.json` change donc ce qui s'exécute chez eux : ces fichiers relèvent de la même vigilance qu'un secret ou qu'un pipeline.

## 3. Lecture du réel
Extrait de `ORIGINE.md` du mod (écrit par l'agent) : « aucun accès réseau, aucun `import()` dynamique, aucun `eval` ; tout ce qu'il exécute est en lecture seule — `git status`, `git log`, `git diff --shortstat`, `git clean -n`, `git rev-parse`, `find`, `du` ; les chemins sont passés à bash en arguments, jamais interpolés ». **Ce que j'ai vérifié moi-même** sur `blast-radius.mjs` : une recherche de `import`/`require`/`child_process`/`fetch`/`http`/`eval`/`new Function`/`import(` ne trouve **aucun** de ces motifs (seuls apparaissent un `.exec` d'expression régulière et le mot `exec` dans une liste de préfixes de commandes) ; les commandes sont lancées par `$.process.run(["bash", "-c", SCRIPT, "blast-radius", args…])`, avec les chemins en arguments (commentaire du fichier, lignes 311-312 : `compgen -G` pour développer les globs) ; la boucle d'attente utilise `$.process.run(["sleep", …])`, avec une limite de 10 minutes. **Ce que je n'ai pas vérifié :** la lecture complète des 528 lignes ni le comportement à l'exécution. Je ne confirme donc pas à ta place « tout est en lecture seule » ; je confirme l'absence des motifs ci-dessus.

## 4. Ce qui casse, et le symptôme
- **Faux sentiment de sécurité :** le mod annonce retenir une liste de commandes (« le reste passe »). Une commande destructrice qui **n'est pas reconnue** n'est pas retenue. C'est un garde-fou, pas une barrière.
- **Hook qui bloque :** un appel retenu jusqu'à 10 minutes sans réponse humaine ; une session d'agent non surveillée peut rester suspendue.
- **Licence manquante :** `doc-coauthoring` sans `LICENSE.txt` propre : risque si le dossier est redistribué.
- **Poids :** 17 Mo clonés à chaque build.
- **Dérive silencieuse :** des fichiers `SKILL.md` tiers modifiés plus tard changent le comportement des agents sans que le code du produit bouge.

## 5. Vocabulaire
| Français | English | Définition / piège |
|---|---|---|
| compétence | skill | dossier d'instructions (`SKILL.md`) pour un agent |
| mod / greffon | mod / plugin | extension de l'outil |
| crochet | hook | code exécuté à un événement (ici avant un appel Bash) |
| place de marché | marketplace | catalogue de greffons |
| provenance | provenance | d'où vient le code, quel commit |
| licence Apache 2.0 | Apache-2.0 license | licence permissive, avec notice |
| doublon | duplicate | même compétence présente deux fois |
| chaîne d'approvisionnement logicielle | software supply chain | tout ce que tu importes |
| garde-fou | guardrail | protège, ne bloque pas tout |
| liste d'autorisation / de blocage | allowlist / denylist | « le reste passe » = denylist |
| lecture seule | read-only | |
| chemin relatif | relative path | suit le projet |
Faux amis : « installé depuis le dépôt d'Anthropic » ≠ « officiel et supporté » (l'amont se dit non officiel) ; « relu » ≠ « audité ».

## 6. Comment le dire juste
- **Collègue / agent :** « Le mod est dans le dépôt et déclaré dans `settings.json` : il s'exécute dans toutes les sessions. Je veux voir qui peut modifier ces fichiers et une relecture complète du hook. »
- **Prestataire (EN) :** "The hook is vendored under `.claude/mods` and enabled in `settings.json`; please confirm its provenance (upstream commit, license) and that any later change goes through code review."
- **Ticket / commentaire de PR (EN) :** "LGTM on provenance notes. Two follow-ups: `doc-coauthoring` has no license file of its own, and the Blast Radius hook only intercepts a fixed list of commands — please document that limit."

## 7. Exercice (20 min, lecture du dépôt, sans rien modifier)
Ouvre `.claude/settings.json` et `.claude/mods/blast-radius/ORIGINE.md` sur `main`. Écris : (1) les trois endroits qui décident que le hook s'exécute ; (2) une commande destructrice qui ne serait pas dans la liste du mod ; (3) qui, dans ton organisation, peut modifier ces fichiers.
<details><summary>Solution</summary>
(1) `extraKnownMarketplaces` (source `directory`), `enabledPlugins`, et `hooks/hooks.json` (qui nomme le module). (2) À toi de chercher dans `README.md` du mod la liste retenue puis de trouver une commande hors liste : je n'ai pas fait l'inventaire. (3) Tout contributeur dont la PR est fusionnée ; c'est pourquoi ces fichiers méritent une relecture dédiée.
</details>

## 8. Révision espacée
Hier (chemin alternatif d'authentification) : 1) Que décrit CWE-288 ? 2) Que signifie l'ajout au catalogue KEV ? Il y a sept jours (20 nov, mise à jour de sécurité Next.js) : 3) Quel fichier dit la version réellement installée ?

## 9. Questions de contrôle
1. Pourquoi un hook déclaré dans le dépôt est-il plus sensible qu'une simple compétence ? 2. Quelle est la limite d'un garde-fou à liste de commandes ? 3. Que prouve « relu avant installation » ?
<details><summary>Réponses</summary>
1. Il exécute du code dans chaque session, et toute modification ultérieure change ce qui s'exécute. 2. Ce qui n'est pas dans la liste passe. 3. Rien de plus qu'une relecture par quelqu'un ; ni audit complet ni exécution testée.
</details>

## 10. Sources (consultées le 2026-11-27)
- Dépôt : commits `210a5c7`, `2ec5c37`, `13bdd3a` ; fichiers `.claude/skills/ORIGINE-anthropics-skills.md`, `.claude/mods/blast-radius/ORIGINE.md`, `hooks/blast-radius.mjs`, `hooks/hooks.json`, `.claude/settings.json`, `.claude/mods/.claude-plugin/marketplace.json`.
- Les dépôts amont `anthropics/skills` et `anthropics/claude-code-playground` : **non consultés** ; leurs commits et licences sont repris des fichiers `ORIGINE`.
