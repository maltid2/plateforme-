# Origine de ce mod

Source : https://github.com/anthropics/claude-code-playground
Chemin amont : `claude-code/mods/blast-radius/`
Commit : 569c528 (2026-10-01) — version 0.1.0, licence Apache-2.0, auteur Claude Code DevRel

## Ce n'est pas un skill

Le dépôt annonce un dossier `skills/`, mais il ne contient qu'un README :
aucun `SKILL.md` n'y est publié à ce jour. Ce qui est installable, ce sont
trois mods — des greffons qui changent l'interface de Claude Code. Celui-ci
est le seul des trois qui touche à la sécurité.

Le dépôt amont se présente lui-même comme « pas un produit Anthropic
officiel », fourni tel quel, sans garantie de fonctionnement dans la durée.

## Pourquoi il est embarqué dans le dépôt

Un mod s'installe depuis une place de marché. Déclarer celle du dépôt amont
pointerait vers une copie locale, qui disparaît avec la machine. Le mod est
donc recopié ici et déclaré dans `.claude/settings.json` avec un chemin
relatif : il suit le projet, et toute session ouverte sur ce dépôt l'a.

Contenu conservé : `.claude-plugin/plugin.json`, `hooks/`, `README.md`.
Écartés : `screenshots/` (4 captures d'écran), `.gitignore` amont.

## Lecture du code avant installation

`hooks/blast-radius.mjs` (528 lignes) a été relu avant installation :

- aucun accès réseau, aucun `import()` dynamique, aucun `eval` ;
- tout ce qu'il exécute est en lecture seule — `git status`, `git log`,
  `git diff --shortstat`, `git clean -n`, `git rev-parse`, `find`, `du` ;
- les chemins sont passés à bash **en arguments** (`"$@"`), jamais
  interpolés dans la source du script, et les globs passent par
  `compgen -G` plutôt que par une substitution de commande ;
- un chemin relatif reçoit un `./` avant d'aller à `find`, pour qu'un
  fichier nommé `-delete` ne soit pas lu comme une action.

## Ce qu'il fait

Il retient un appel `Bash` risqué, mesure ce que la commande toucherait, et
ouvre un panneau avec **Procéder** / **Annuler**. Un refus revient à Claude
sous forme de `deny` motivé, que Claude lit et prend en compte.

Commandes concernées : `rm -r/-f/-rf`, `git reset --hard`,
`git checkout -- .`, `git restore .`, `git clean`, `git push --force`
(et `-f`, `--force-with-lease`, `+ref`), et les migrations
(`manage.py migrate`, `db:migrate`, `alembic upgrade`, `prisma migrate`).
Tout le reste passe sans être retenu.

## Compatibilité vérifiée

Claude Code 2.1.332 : le format mod est reconnu (`modules`, `tool.call`,
`ui.invalidate`, `AbovePrompt`, `isPlaced`).

`claude plugin details` affiche « Hooks (0) » : l'inventaire ne compte que
les hooks au format classique, pas les modules de mod. Le mod est bien
déclaré `enabled` en portée projet.

## Mise à jour

Récupérer le dépôt amont et recopier `claude-code/mods/blast-radius/`,
en relisant le diff de `hooks/blast-radius.mjs` avant de le garder.
