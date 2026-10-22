# Parcours en parallèle jusqu'au 4 janvier 2027

Mis à jour le 2026-10-22. Objectif : tenir **plusieurs pistes à la fois** sans te noyer. Priorité absolue : l'anglais écrit (examen du 4 janvier 2027, note minimale 10).

## Ce que je sais de ce que tu fais en parallèle, et ce que j'ignore

Sais (depuis le dépôt et tes messages) :
- Mastère cybersécurité, spécialité management d'infrastructure.
- Examen d'anglais écrit le 4 janvier 2027.
- Projet SentinelScope : tu relis et fusionnes les PR des agents.
- L'issue #1 du dépôt porte le titre « Exercie Cisco Packt Tracer » (sans description) : je suppose que tu fais des exercices **Cisco Packet Tracer** (simulation de réseaux). Je n'ai que le titre.

Ignore (à me dire) : le programme exact de ton Mastère (modules, dates de rendu), tes heures disponibles, ce que contient ton exercice Packet Tracer. Je ne prépare pas de cours sur ce que je ne connais pas : envoie-moi le sujet ou le plan de cours de ton école et j'aligne les fiches dessus.

## Les pistes et leur ordre de priorité

| Priorité | Piste | Pourquoi | Rythme (pour ~10 h/semaine) |
|---|---|---|---|
| 1 | Anglais écrit (piste 4) | échéance ferme, note minimale | 6 h |
| 2 | Réseau et système (piste 2) | cœur de ton Mastère, nourrit aussi l'anglais (vocabulaire) | 2,5 h |
| 3 | Sécurité web (piste 3) | ton produit, tes relectures de PR | 1 h |
| 4 | Langages et technique (piste 1) | utile surtout pour juger les diffs | 0,5 h |

Si ton temps est inférieur à 10 h, on **réduit les pistes 3 et 4 en premier** ; l'anglais ne se sacrifie pas avant janvier.

## Le lien entre les pistes (pour ne pas faire deux fois le même travail)

Chaque fiche sert à deux choses : apprendre la matière, et fournir un **texte anglais** avec questions. Ainsi une fiche réseau (comme la n° 2) vaut aussi pour l'examen : tu la relis en anglais, tu réponds aux questions en anglais.

## Semaine type

| Jour | Contenu |
|---|---|
| Lundi | nouvelle fiche (30 min) + 10 mots d'anglais |
| Mardi | exercice de la fiche sur ton projet ou Packet Tracer (45 min) |
| Mercredi | étude de cas en anglais, réponses écrites (60 min) |
| Jeudi | correction et révision des mots des jours précédents (30 min) |
| Vendredi | grammaire + connecteurs (45 min) |
| Week-end | un texte long en anglais (documentation, avis de sécurité), 45 min ; test blanc les semaines prévues |

## Programme des fiches à venir (provisoire, ajustable)

| Date cible | Fiche | Piste |
|---|---|---|
| 2026-10-22 | n° 1 Repaints et animations | 1 |
| 2026-10-22 | n° 2 De l'URL à la réponse : DNS, TCP, TLS, HTTP | 2 |
| semaine du 26 oct | n° 3 Adresses IP, masques, sous-réseaux (lien Packet Tracer) | 2 |
| semaine du 2 nov | n° 4 Routage et commutation : VLAN, routeur, passerelle | 2 |
| semaine du 9 nov | n° 5 En-têtes de sécurité (CSP, HSTS…) lus dans `headers.js` | 3 |
| semaine du 16 nov | n° 6 Linux : processus, droits, journaux | 2 |
| semaine du 23 nov | n° 7 Journalisation, supervision, SIEM | 2/3 |
| semaine du 30 nov | n° 8 Sauvegarde, RTO/RPO, haute disponibilité | 2 |
| semaine du 7 déc | n° 9 Gestion des correctifs et des changements (cas Next 16 / alerte critique) | 3 |
| suite | révision, tests blancs | 4 |

Les sujets sont mes propositions pour couvrir un Mastère de management d'infrastructure ; ils ne sont **pas** tirés du programme de ton école, que je ne connais pas.

## Règles

- Une seule nouvelle fiche par semaine en plus d'une première, jamais plus : mieux vaut une notion solide que cinq survolées.
- Chaque fiche contient un exercice, des questions de contrôle, et du vocabulaire anglais.
- Je ne modifie aucun code applicatif. Si un défaut me saute aux yeux, j'ouvre une issue `[MINERVE]` (déjà fait : #48).
