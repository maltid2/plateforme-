# Fiche — SQL : `GROUP BY`, tri et la colonne `Extra` (`Using temporary`, `Using filesort`, `Using index for group-by`)

Piste : SQL (rotation du mercredi). Lecture + exercice : 25 à 30 minutes. Moteur : **MariaDB** (celui de ton lab). Suite des fiches du 28 octobre (index et plan) et du 4 novembre (jointures) : ici, **ce que le moteur fait quand tu regroupes ou trie**, et ce que dit la colonne `Extra` de `EXPLAIN`.

**Calibrage SQL : toujours sans réponse.** Les trois questions en tête de la fiche du 2026-10-28 attendent encore tes réponses. Je garde le niveau de départ.

## 1. Pourquoi ce mécanisme

« La requête est rapide sans `ORDER BY` et lente avec » ; « le rapport par client rame ». Regrouper (`GROUP BY`), dédoublonner (`DISTINCT`) et trier (`ORDER BY`) obligent le moteur à **organiser des lignes** : s'il ne peut pas s'appuyer sur un index qui a déjà l'ordre voulu, il construit une **structure temporaire** ou **trie** lui-même. `Extra` te dit lequel des deux a lieu. C'est la suite logique des fiches précédentes : l'index sert à *trouver* (28 octobre), à *joindre* (4 novembre) et aussi à *éviter un tri*.

## 2. Le mécanisme, pas à pas

### 2.1 Ce que « regrouper » demande au moteur
Pour calculer, par exemple, le nombre de commandes par client, le moteur doit **rassembler toutes les lignes d'un même client**. Deux façons de procéder (le principe est de ma connaissance générale ; les définitions exactes de `Extra` ci-dessous sont celles de la documentation MariaDB, lue le 2026-11-11) :
1. **Les lignes arrivent déjà dans l'ordre du regroupement** (parce qu'un index les livre triées par la colonne de regroupement) : le moteur n'a qu'à compter au fil de l'eau, un groupe après l'autre.
2. **Les lignes arrivent dans le désordre** : il faut les regrouper à part, dans une **table temporaire**, ou les **trier**, avant de pouvoir produire les groupes.

### 2.2 Les trois valeurs d'`Extra` à connaître (définitions MariaDB, mots exacts)
| `Extra` | Définition de la documentation | Lecture |
|---|---|---|
| `Using temporary` | « A temporary table is created to hold the result. This typically happens if you are using GROUP BY, DISTINCT or ORDER BY. » | Le moteur a bâti une table temporaire pour le résultat. |
| `Using filesort` | « Filesort is needed to resolve the query. This means an extra phase where we first collect all columns to sort, sort them with a disk based merge sort and then use the sorted set to retrieve the rows in sorted order. If the column set is small, we store all the columns in the sort file to not have to go to the database to retrieve them again. » | Une phase de tri **en plus**. Le nom est trompeur : voir §4. |
| `Using index for group-by` | « The index is being used to resolve a GROUP BY or DISTINCT query. The rows are not read. This is very efficient if the table has a lot of identical index entries as duplicates are quickly jumped over. » | Le groupement se fait **dans l'index**, sans lire les lignes : c'est le cas favorable. |

Autres valeurs utiles, mêmes définitions : `Using index` (« Only the index is used to retrieve the needed information from the table. There is no need to perform an extra seek to retrieve the actual record. ») et `Using where` (condition `WHERE` appliquée en plus de la recherche par index ; la doc ajoute : si tu vois un type `ALL` **sans** `Using where`, « you are probably doing something wrong »).

### 2.3 Ce que l'index change
Si une colonne de regroupement ou de tri est **couverte par un index dans le bon ordre**, le moteur peut livrer les lignes déjà ordonnées : pas de table temporaire, pas de tri en plus (c'est le sens de `Using index for group-by`). Sinon il organise lui-même, d'où `Using temporary` et/ou `Using filesort`. (Règle du préfixe gauche de l'index : fiche du 28 octobre.)

### 2.4 Ce que la source ne garantit pas
« Disk based merge sort » ne veut pas dire que le tri se fait toujours **sur le disque** : le nom `filesort` vient de l'histoire du moteur ; la doc décrit le mécanisme, pas le seuil à partir duquel on écrit sur le disque. Ce seuil, la taille des tables temporaires en mémoire et leur conversion sur disque : **de ma mémoire, non relus aujourd'hui**.

## 3. Lecture du réel

La documentation MariaDB que j'ai lue donne les **définitions** ci-dessus, mais **pas d'exemple complet de plan avec `GROUP BY`**. Je ne reproduis donc pas de sortie authentique. Voici la **forme** à reconnaître, **inventée de ma part, pour l'illustration** (table `commandes` hypothétique de 100 000 lignes) :

```
EXPLAIN SELECT client_id, COUNT(*) FROM commandes GROUP BY client_id;

+----+-------------+-----------+-------+---------------+-----------+---------+------+--------+--------------------------+
| id | select_type | table     | type  | possible_keys | key       | key_len | ref  | rows   | Extra                    |
+----+-------------+-----------+-------+---------------+-----------+---------+------+--------+--------------------------+
|  1 | SIMPLE      | commandes | index | NULL          | idx_client| 4       | NULL | 100000 | Using index              |
+----+-------------+-----------+-------+---------------+-----------+---------+------+--------+--------------------------+
```
puis, sans l'index sur `client_id`, un `type ALL` avec `Using temporary` (et éventuellement `Using filesort`). Les chiffres ici ne sont **pas** des mesures.

Lecture colonne par colonne (celles que tu connais déjà, fiche du 28 octobre) : `type = index` → parcours **de l'index complet** ; `key` → quel index ; `rows` → **estimation** ; `Extra = Using index` → la table n'est pas lue, tout vient de l'index. La différence `Using index` (le plan lit tout l'index) et `Using index for group-by` (il saute les doublons dans l'index) est importante : la seconde est la plus favorable quand les valeurs se répètent beaucoup, d'après la doc.

## 4. Ce qui casse, symptôme, remontée

| Symptôme | Cause plausible | Remontée |
|---|---|---|
| Requête rapide, puis lente après ajout d'un `ORDER BY` | Tri en plus sur un grand nombre de lignes | `EXPLAIN` : `Using filesort` apparaît |
| `Using temporary; Using filesort` sur un `GROUP BY` | Aucun index ne livre les lignes dans l'ordre du regroupement | Chercher un index sur la colonne de regroupement (dans le bon ordre) |
| Lenteur seulement en production | Beaucoup plus de lignes à organiser qu'en test | Comparer `rows` aux volumes réels ; `ANALYZE` (fiche du 28 octobre) |
| « `filesort` donc le tri est sur disque » | Faux ami du nom | La doc décrit un tri avec fusion « disk based merge sort » ; l'emplacement réel dépend de la taille (non relu) |
| `Using temporary` systématique avec `DISTINCT` | Dédoublonnage sans index adapté | Même remède : index |
| `SELECT *` qui empêche `Using index` | Colonnes demandées hors de l'index | Ne demander que ce qui est dans l'index (principe : de ma mémoire) |

**Piège de raisonnement :** « `Using filesort` = mauvais » et « `Using index` = bon » sont des raccourcis. Sur peu de lignes, un tri est négligeable ; sur des millions, il domine. C'est le **volume** qui décide. Et `rows` n'est qu'une estimation.

## 5. Vocabulaire (FR / EN)

| FR | EN | Définition, piège |
|---|---|---|
| regroupement | *grouping (`GROUP BY`)* | rassembler les lignes par valeur de colonne |
| fonction d'agrégation | *aggregate function* | `COUNT`, `SUM`, `MIN`, `MAX` : **piège :** `COUNT(*)` ≠ `COUNT(colonne)` (ce dernier ignore les `NULL`, de ma mémoire) |
| dédoublonnage | *`DISTINCT`* | supprimer les lignes identiques |
| tri | *sort / `ORDER BY`* | |
| table temporaire | *temporary table* | structure intermédiaire créée par le moteur |
| tri en plus (« filesort ») | *filesort* | phase de tri par le moteur ; **faux ami :** ne dit pas « sur fichier/disque » à coup sûr |
| index couvrant | *covering index* | contient toutes les colonnes demandées ; correspond à `Using index` |
| lecture de l'index seul | *index-only scan* | pas d'accès aux lignes de la table |
| balayage d'index | *index scan* | `type index` : on lit tout l'index |
| estimation | *estimate* | `rows` dans `EXPLAIN` |
| cardinalité | *cardinality* | nombre de valeurs distinctes ; élevée = peu de doublons |
| ordre de l'index | *index order* | l'ordre dans lequel les entrées sont rangées |
| groupe | *group* | ensemble des lignes à même valeur de regroupement |
| faux ami : *aggregate* | = agrégat / agréger | pas « agrégat » du béton |
| faux ami : *to sort* | = trier | ≠ *to sort out* (régler) |

## 6. Comment le dire juste

**À un collègue (FR) :** « Le rapport rame parce que le `GROUP BY` fait une table temporaire et un tri : aucun index ne livre les lignes dans l'ordre du client. Avec un index sur le client, ça devrait passer en `Using index for group-by`. »

**À un prestataire / éditeur (FR + EN) :**
- FR : « Pouvez-vous confirmer qu'un index existe sur la colonne de regroupement ? `EXPLAIN` montre `Using temporary; Using filesort` sur cette requête. »
- EN: "Can you confirm that an index exists on the grouping column? `EXPLAIN` shows `Using temporary; Using filesort` for this query."

**Dans un ticket (FR + EN) :**
- FR : « Requête X (rapport par client) lente. `EXPLAIN` : `type ALL`, `Extra: Using temporary; Using filesort`, `rows` estimé 100 000. Hypothèse : pas d'index sur `client_id`. Vérification : `SHOW INDEX`, puis relire `EXPLAIN` après ajout dans le lab. »
- EN: "Query X (per-customer report) is slow. `EXPLAIN`: `type ALL`, `Extra: Using temporary; Using filesort`, estimated `rows` 100,000. Hypothesis: no index on `client_id`. Check: `SHOW INDEX`, then re-read `EXPLAIN` after adding one in the lab."
*(Les valeurs de ces phrases sont des illustrations de format, pas des mesures.)*

## 7. Exercice d'observation (20 à 30 minutes, **lab uniquement**)

**Rappel :** uniquement ton conteneur MariaDB de lab. **Jamais sur une base de ton employeur.** `EXPLAIN` ne modifie rien et n'exécute pas le `SELECT` (fiche du 4 novembre).

Dans ta base WordPress de lab (noms d'après mes souvenirs, **non vérifiés dans ton lab** : adapte aux noms réels ; la table des articles s'appelle en général `wp_posts`, avec une colonne de statut `post_status`) :
1. Écris un `SELECT post_status, COUNT(*) FROM wp_posts GROUP BY post_status;` et fais `EXPLAIN` devant.
2. **Hypothèse à écrire d'abord :** y aura-t-il `Using temporary` ? `Using filesort` ?
3. Note `type`, `key`, `rows`, `Extra`.
4. `SHOW INDEX FROM wp_posts;` : existe-t-il un index qui couvre `post_status` ?
5. Refais `EXPLAIN` avec un `ORDER BY` sur une colonne **non indexée** : `Extra` change-t-il ?
6. Écris la phrase de ticket (§6) avec **tes** valeurs.

<details><summary>Solution</summary>

Pas de réponse unique : dépend de tes index réels. Critères : (a) un `GROUP BY` sur une colonne **sans** index adapté donne typiquement `Using temporary` (et souvent `Using filesort`) ; avec un index adapté, `Using index` ou `Using index for group-by` selon le plan ; (b) un `ORDER BY` sur une colonne non indexée ajoute `Using filesort`. Sur une petite table de lab, le coût est négligeable : c'est la **forme** du plan qui t'intéresse, pas le temps. Je n'ai pas exécuté cet exercice ; si ta sortie ne ressemble pas à ce schéma, dis-le-moi : je corrige la fiche.
</details>

## 8. Révision espacée

**D'hier (fiche du 2026-11-10, DC locator) :**
1. Quel enregistrement DNS un poste interroge-t-il pour trouver un serveur LDAP du domaine ?
2. Quel contrôleur Netlogon retient-il quand plusieurs répondent ?
3. Pourquoi « le ping de l'IP du contrôleur marche » ne suffit-il pas ?

**D'il y a 7 jours (fiche du 2026-11-04, jointures et EXPLAIN) :**
1. Pourquoi un `ALL` sur la première table n'est-il pas un défaut, alors que sur la table jointe oui ?
2. Que signifie `ref: test.t0.a` ?
3. À quoi sert `Using join buffer`, et pourquoi n'est-ce pas une solution ?

<details><summary>Réponses</summary>

D'hier : (1) Un SRV `_ldap._tcp.<domaine>` (variante `_ldap._tcp.dc._msdcs.<domaine>`). (2) Le premier qui répond. (3) L'ouverture de session dépend de la résolution du nom et des SRV, pas de l'IP.
Du 4 : (1) La première table est lue une fois ; la jointe est cherchée à chaque ligne. (2) La valeur cherchée dans l'index vient de la colonne `a` de `t0`. (3) Il regroupe des lignes précédentes pour les comparer en un passage ; on lit toujours beaucoup, faute d'index.
</details>

## 9. Trois questions de contrôle

1. Que dit la documentation de `Using temporary` et dans quels cas apparaît-il typiquement ?
2. Quelle est la différence entre `Using index` et `Using index for group-by` ?
3. Pourquoi « `Using filesort` donc tri sur le disque » est-il un raccourci ?

<details><summary>Réponses</summary>

1. Une table temporaire est créée pour contenir le résultat ; typiquement avec `GROUP BY`, `DISTINCT` ou `ORDER BY`. 2. `Using index` : seul l'index est lu, sans accès aux lignes ; `Using index for group-by` : l'index résout le regroupement en sautant les doublons, sans lire les lignes. 3. Le nom est historique : la doc décrit un tri avec fusion, mais pas où il se fait ; cela dépend de la taille (non relu ici).
</details>

## 10. Sources (consultées le 2026-11-11)

- MariaDB, instruction `EXPLAIN`, colonne `Extra` : https://mariadb.com/docs/server/reference/sql-statements/administrative-sql-statements/analyze-and-explain-statements/explain (définitions de `Using temporary`, `Using filesort`, `Using index`, `Using index for group-by`, `Using where`).
- Fiches du 2026-10-28 (index et plan) et du 2026-11-04 (jointures) pour `type`, `rows`, `EXPLAIN` / `ANALYZE`.
- **Non relu aujourd'hui, de ma mémoire :** seuils de passage en mémoire / sur disque des tris et tables temporaires, comportement de `COUNT(*)` face à `COUNT(colonne)`, noms de tables et colonnes WordPress. La table `commandes` et les chiffres du §3 sont **inventés** pour illustrer.
