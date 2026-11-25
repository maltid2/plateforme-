# Origine des compétences venues d'anthropics/skills

Source : https://github.com/anthropics/skills
Commit : e4bb5d9 (2026-11-16)

19 compétences recopiées telles quelles depuis `skills/` du dépôt amont,
chacune dans son dossier, avec son `LICENSE.txt`.

## Licences

18 des 19 portent un `LICENSE.txt` Apache 2.0. **`doc-coauthoring` n'en a
pas** : le dépôt amont le couvre par sa licence globale, mais le fichier
propre manque. À vérifier si ce dossier devait un jour être redistribué.

`canvas-design` embarque 54 polices `.ttf` (5,6 Mo), chacune accompagnée de
son propre fichier de licence. Ce sont elles qui pèsent, pas la compétence.

## Ce qui n'a pas été pris

`template/` — c'est le gabarit pour écrire une compétence, pas une
compétence. `spec/` — la spécification du format.

## Doublons retirés

docx, pdf, pptx, xlsx et skill-creator ont été retirées après coup : elles
existent déjà au niveau du compte sous le préfixe `anthropic-skills:`, avec
des descriptions presque identiques. Les garder ici coûtait du contexte à
chaque session et rendait le déclenchement ambigu. Restent 14 compétences
venues de ce dépôt.

## Poids

17 Mo pour `.claude/skills/` au total, dont :
canvas-design 5,6 Mo · ui-ux-pro-max 3,5 Mo · claude-api 2,3 Mo ·
pptx 1,4 Mo · xlsx 1,3 Mo · docx 1,3 Mo.

Le dépôt est cloné à chaque build Vercel. Si le poids devient gênant, la
prochaine candidate à retirer est `canvas-design`.

## Mise à jour

Récupérer le dépôt amont et recopier `skills/<nom>/`. Les noms déclarés
dans l'en-tête de chaque `SKILL.md` correspondent au nom du dossier — un
écart empêcherait le chargement.
