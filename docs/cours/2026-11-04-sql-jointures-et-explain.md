# Fiche — SQL : comment une jointure s'exécute, et ce que `EXPLAIN` en dit

Piste : SQL (rotation du mercredi). Lecture + exercice : 25 à 30 minutes. Moteur : **MariaDB** (celui de ton lab, `docker-compose.yml`). Suite de la fiche du 28 octobre (index et plan) : là, une seule table ; ici, **deux tables**, et la question « dans quel ordre, et avec quel index ? ».

**Calibrage SQL : toujours sans réponse lisible.** Les trois questions en tête de la fiche du 2026-10-28 (clé primaire, `LEFT JOIN` contre `INNER JOIN`, requête lente sur 2 millions de lignes) attendent encore ta réponse. Je garde le niveau de départ.

## 1. Pourquoi ce mécanisme

Une page lente est rarement due à une table seule : c'est la **jointure** qui multiplie le travail. Dix lignes lues d'un côté, chacune cherchant sa correspondance de l'autre : si cette recherche est un saut par index, c'est quasi gratuit ; si c'est une lecture de toute la table, le coût se **multiplie**. Savoir lire quelle table est lue en premier et comment l'autre est cherchée change ton diagnostic : tu sais quel index manque, au lieu de « la base est lente ».

## 2. Le mécanisme, pas à pas

1. **Le moteur choisit un ordre de jointure.** Ce n'est pas forcément l'ordre écrit dans ta requête : l'optimiseur évalue plusieurs ordres et choisit celui qu'il estime le moins coûteux (fiche du 28 octobre, étape 3 : il s'appuie sur des statistiques, donc sur des **estimations**).
2. **La première table est lue (la « table directrice »).** Selon le plan, c'est un balayage complet (`ALL`), une lecture par index, ou une plage (`range`).
3. **Pour chaque ligne obtenue, le moteur cherche la ou les lignes correspondantes dans la table suivante.** C'est exactement ce que décrit la documentation MariaDB sur son exemple : « MariaDB scans all of t0 (type: ALL, 10 rows), and for each row it looks up the single matching row in t1 through the unique a index (type: eq_ref, 1 row) ; the ref column shows that the lookup value comes from test.t0.a. »
4. **La qualité de cette recherche dépend de l'index sur la colonne de jointure.**
   - `eq_ref` : un index **unique** est utilisé, au plus une ligne par recherche. La doc : « the best possible plan to find the row ».
   - `ref` : un index non unique, possiblement plusieurs lignes par recherche (descripteur de `ref` : de ma mémoire, la page lue ne l'est pas ici en entier ; la fiche du 28 octobre le traite).
   - `ALL` sur la table **jointe** (pas la première) : la doc l'écrit : « bad if the table is large and the table is joined against a previous table ». Pour chaque ligne de la première table, la seconde est **lue en entier** : le coût est le produit des deux tailles.
5. **Si aucun index n'aide, le moteur peut utiliser un tampon de jointure** : `Using join buffer` dans la colonne `Extra`. La doc : « We store previous row combinations in a row buffer to be able to match each row against all of the rows combinations in the join buffer at one go. » C'est une atténuation, pas une solution : tu lis toujours beaucoup.
6. **Le nom du schéma de base (de ma mémoire, non relu aujourd'hui) :** on appelle cette stratégie « boucles imbriquées » (*nested loop join*) : une boucle sur la première table, une boucle interne sur la seconde. Retiens l'idée : **la boucle interne est ce qu'un index doit rendre bon marché**.

## 3. Lecture du réel : un plan de jointure authentique

Exemple de la documentation MariaDB (« EXPLAIN », lue le 2026-11-04). `t0` contient 10 lignes ; `t1` a un index unique sur la colonne `a`.

```
EXPLAIN SELECT t0.a, t1.b FROM t0, t1 WHERE t0.a = t1.a;
+------+-------------+-------+--------+---------------+------+---------+-----------+------+-------------+
| id   | select_type | table | type   | possible_keys | key  | key_len | ref       | rows | Extra       |
+------+-------------+-------+--------+---------------+------+---------+-----------+------+-------------+
|    1 | SIMPLE      | t0    | ALL    | NULL          | NULL | NULL    | NULL      |   10 | Using where |
|    1 | SIMPLE      | t1    | eq_ref | a             | a    | 5       | test.t0.a |    1 |             |
+------+-------------+-------+--------+---------------+------+---------+-----------+------+-------------+
```
Ligne par ligne :
- **Les lignes sont dans l'ordre de jointure, de haut en bas** (doc). `t0` est lue d'abord, `t1` ensuite.
- `t0`, `type ALL`, `key NULL`, `rows 10` : balayage complet de 10 lignes. Ici ce n'est pas un défaut : la première table est petite, et il faut bien en lire des lignes pour avoir des valeurs à chercher.
- `t1`, `type eq_ref`, `key a`, `key_len 5` : l'index `a` est utilisé. `key_len` est la longueur de la partie d'index utilisée (ici 5 octets).
- `ref test.t0.a` : la valeur cherchée dans l'index vient de **la colonne `a` de `t0`** : c'est la liaison entre les deux boucles.
- `rows 1` pour `t1` : **une** ligne attendue par recherche (estimation).
- `Using where` sur `t0` : une condition `WHERE` est appliquée à la ligne lue.
- `id` identique (1) pour les deux : un seul niveau de `SELECT`, deux tables jointes ; `select_type SIMPLE` : pas de sous-requête ni d'union.

**Coût estimé de cette requête** (raisonnement à toi de refaire) : environ 10 lectures de `t0` + 10 recherches par index dans `t1`. Si l'index sur `t1.a` n'existait pas, le même plan ressemblerait à `ALL` des deux côtés et le coût approcherait 10 × la taille de `t1`.

## 4. Ce qui casse, symptôme, remontée

| Symptôme | Cause plausible | Remontée |
|---|---|---|
| Requête rapide en test, très lente en production | Table jointe sans index sur la colonne de jointure ; ça ne se voit pas sur peu de lignes | `EXPLAIN` : chercher `type ALL` sur une table **qui n'est pas la première** |
| `Using join buffer` apparaît | Pas d'index exploitable pour la jointure | Identifier la colonne de jointure, vérifier ses index |
| Le plan change après un gros import | Statistiques périmées ou nouvelles ; l'optimiseur change l'ordre | Comparer les `rows` estimés aux volumes réels (fiche du 28 octobre : `EXPLAIN` vs `ANALYZE`) |
| Le plan est bon mais la requête lente | Estimation fausse : `rows` n'est pas une mesure | `ANALYZE` (exécute la requête, donne les lignes réelles : de ma mémoire côté MariaDB, à vérifier avant usage) |
| Jointure sur colonnes de types ou de collations différents | L'index peut ne pas être utilisé | De ma mémoire, non relu ici ; à tester en lab |

**Piège de lecture :** un `ALL` sur la **première** table n'est pas un défaut en soi. C'est un `ALL` sur une table jointe **après** une autre qui doit t'alerter.

## 5. Vocabulaire (FR / EN)

| FR | EN | Définition, piège |
|---|---|---|
| jointure | *join* | combiner deux tables sur une condition |
| jointure interne | *inner join* | garde les lignes qui correspondent des deux côtés |
| jointure externe gauche | *left (outer) join* | garde aussi toutes les lignes de gauche ; **piège :** les colonnes de droite valent `NULL` en l'absence de correspondance |
| ordre de jointure | *join order* | ordre dans lequel les tables sont lues ; décidé par l'optimiseur |
| table directrice | *driving table* | la première lue (terme courant, pas dans la doc lue) |
| plan d'exécution | *execution plan* | ce que le moteur compte faire |
| type d'accès | *access type (`type`)* | `ALL`, `index`, `range`, `ref`, `eq_ref`, `const` |
| index unique | *unique index* | au plus une ligne par valeur : permet `eq_ref` |
| clé de jointure | *join key / join column* | la colonne comparée |
| tampon de jointure | *join buffer* | mémoire qui regroupe des lignes de la table précédente |
| balayage complet | *full table scan* | lecture de toutes les lignes (`ALL`) |
| estimation de lignes | *estimated rows* | `rows` : estimation, pas mesure |
| sélectivité | *selectivity* | part des lignes retenues par une condition ; **piège :** haute sélectivité = peu de lignes retenues |
| cardinalité | *cardinality* | nombre de valeurs distinctes d'une colonne |
| faux ami : *join* | = jointure | pas « joindre un fichier » |

## 6. Comment le dire juste

**À un collègue (FR) :** « Le plan lit d'abord `wp_posts` en entier, puis pour chaque ligne cherche dans `wp_postmeta` sans index : un `ALL` sur la table jointe. C'est le produit des deux tailles. »

**À un prestataire / éditeur (FR + EN) :**
- FR : « Pouvez-vous confirmer qu'il existe un index sur la colonne de jointure de la seconde table ? Le plan montre un balayage complet à chaque itération. »
- EN: "Can you confirm there is an index on the join column of the second table? The plan shows a full table scan on every iteration."

**Dans un ticket (FR + EN) :**
- FR : « Requête X lente (4 s). `EXPLAIN` : table A en `ALL` (rows estimé 2 000), table B en `ALL` avec `Using join buffer`. Hypothèse : pas d'index sur B.colonne_de_jointure. Vérification : consulter les index de B, relire `EXPLAIN` après ajout dans le lab. »
- EN: "Query X is slow (4 s). `EXPLAIN`: table A `ALL` (estimated rows 2,000), table B `ALL` with `Using join buffer`. Hypothesis: no index on B.join_column. Check: review B's indexes, re-run `EXPLAIN` after adding one in the lab."
*(Les chiffres de ces exemples de phrases sont des illustrations de format, pas des mesures.)*

## 7. Exercice d'observation (20 à 30 minutes, **lab uniquement**)

**Rappel :** uniquement ton conteneur MariaDB de lab. Jamais sur une base de ton employeur ni sur une base de production.

`EXPLAIN` ne modifie rien et, d'après la documentation, **n'exécute pas** un `SELECT` : il décrit le plan. Sur les tables de ton lab WordPress (noms d'après mes souvenirs de WordPress : `wp_posts` et `wp_postmeta` avec la clé de liaison `ID` / `post_id`, préfixe `wp_` par défaut, **non vérifiés dans ton lab** : adapte aux noms réels) :
1. Liste les tables : `SHOW TABLES;`.
2. Écris une jointure simple entre deux tables liées et fais `EXPLAIN` devant (pas `ANALYZE`).
3. Pour chaque ligne du plan, note : table, `type`, `key`, `ref`, `rows`, `Extra`.
4. Hypothèse à écrire avant de lire : quelle table est lue en premier ? Laquelle est cherchée par index ?
5. `SHOW INDEX FROM <table_jointe>;` : l'index qui sert à la jointure existe-t-il ?
6. Écris la phrase de ticket (§6) avec **tes** valeurs.

<details><summary>Solution</summary>

Il n'y a pas une réponse unique : ça dépend de ton schéma réel. Critères de vérification : (a) la table jointe n'est pas en `ALL` si un index couvre sa colonne de jointure ; (b) `ref` nomme la colonne de la première table ; (c) `rows` est un ordre de grandeur, pas un compte exact. Si tu obtiens un `ALL` sur une table jointe volumineuse, `SHOW INDEX` te dit si l'index manque ou si l'optimiseur le juge peu utile. Je n'ai pas exécuté cet exercice : si la sortie ne ressemble pas à la fiche, dis-le-moi.
</details>

## 8. Révision espacée

**D'hier (fiche du 2026-11-03, NTLM ou Kerberos) :**
1. Quel champ de l'événement 4624 indique le protocole, et quelles valeurs peut-il prendre ?
2. Pourquoi un accès par adresse IP peut-il provoquer un repli sur NTLM ?
3. Un poste hors domaine ouvre une session en NTLM : anomalie ?

**D'il y a 7 jours (fiche du 2026-10-28, index et plan d'exécution) :**
1. Que signifie `type: ALL` ?
2. `rows` dans `EXPLAIN` est-il un compte mesuré ?
3. Quelle est la différence entre `EXPLAIN` et `ANALYZE` ?

<details><summary>Réponses</summary>

D'hier : (1) `Authentication Package` : `NTLM`, `Kerberos`, `Negotiate`. (2) Sans nom de service il n'y a pas de SPN pour demander un ticket. (3) Non, NTLM est normal pour les systèmes hors domaine.
Du 28 : (1) Lecture complète de la table. (2) Non, c'est une estimation. (3) `EXPLAIN` montre le plan prévu ; `ANALYZE` exécute et ajoute les chiffres réels.
</details>

## 9. Trois questions de contrôle

1. Dans le plan d'exemple, pourquoi le `ALL` sur `t0` n'est-il pas un défaut, alors qu'un `ALL` sur `t1` en serait un ?
2. Que signifie `ref: test.t0.a` ?
3. À quoi sert `Using join buffer`, et pourquoi n'est-ce pas une solution ?

<details><summary>Réponses</summary>

1. `t0` est lue une fois (10 lignes) ; `t1` est cherchée **à chaque ligne** de `t0` : un `ALL` y multiplierait le coût. 2. La valeur cherchée dans l'index de `t1` vient de la colonne `a` de `t0`. 3. À comparer plusieurs lignes précédentes d'un seul passage ; mais on lit toujours beaucoup, faute d'index.
</details>

## 10. Sources (consultées le 2026-11-04)

- MariaDB, instruction `EXPLAIN` : https://mariadb.com/docs/server/reference/sql-statements/administrative-sql-statements/analyze-and-explain-statements/explain (exemple `t0`/`t1`, lecture de l'ordre de jointure, définitions de `ALL`, `eq_ref`, `Using join buffer`).
- Fiche du 2026-10-28 (`2026-10-28-sql-index-et-plan-d-execution.md`) pour les définitions de `type`, `rows`, `EXPLAIN` / `ANALYZE`.
- Non relu aujourd'hui, de mémoire : nom « nested loop join », noms de tables et colonnes WordPress, comportement de `ANALYZE` sous MariaDB, effet des types ou collations différents sur l'usage d'un index.
