# Origine de cette compétence

Source : https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
Commit : b7d5353 (2026-11-05) — version 2.15.0, licence MIT, auteur NextLevelBuilder

Contenu conservé : `SKILL.md`, `references/`, `data/`, `scripts/*.py`.
Écarté : `scripts/tests/` (344 Ko de tests du dépôt amont), ainsi que les six
compétences compagnes livrées par le même dépôt (`design`, `design-system`,
`brand`, `ui-styling`, `slides`, `banner-design`), soit 6,7 Mo de plus.

Les scripts n'utilisent que la bibliothèque standard de Python — rien à
installer. Vérifié avec `python3.13 -I scripts/search.py --help`.

## Modification locale

Le dépôt amont se distribue comme plugin Claude Code et écrit ses chemins
sous la forme `${CLAUDE_PLUGIN_ROOT}/.claude/skills/ui-ux-pro-max/scripts/…`.
Cette variable n'existe pas pour une compétence installée simplement dans un
dépôt : les 11 chemins de `SKILL.md` ont été réécrits en
`.claude/skills/ui-ux-pro-max/scripts/…`, à exécuter depuis la racine du
dépôt. C'est la seule modification apportée au contenu amont.

## Doublon à connaître

Une version plus ancienne de la même compétence est déjà synchronisée sur le
compte claude.ai, sous le nom `anthropic-skills:ui-ux-pro-max` (67 styles,
161 palettes, 57 associations de polices, 16 stacks). Celle-ci en annonce 80,
192, 74 et 22. Les deux noms diffèrent, donc elles coexistent sans conflit,
mais c'est bien la même compétence à deux âges.

## Mise à jour

Récupérer le dépôt amont, recopier les quatre éléments ci-dessus, puis
refaire le remplacement de `${CLAUDE_PLUGIN_ROOT}/` décrit plus haut.
