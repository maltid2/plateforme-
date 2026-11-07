# Fiche — Comment un index change le plan d'exécution d'une requête SQL

Piste : SQL (rotation du mercredi). Lecture : 25 à 30 minutes, exercice compris. Moteur de référence : **MariaDB**, celui de ton lab (`docker-compose.yml`, service `db`, image `mariadb`). Pas de tutoriel de syntaxe : le mécanisme et les mots exacts.

## 0. Calibrage de la piste (3 questions, avant de lire la suite)

C'est la première fiche de cette piste : ta réponse fixe le niveau des suivantes. Réponds en une ou deux phrases chacune, dans notre conversation ou en commentaire de la PR #47. « Je ne sais pas » est une réponse utile.

1. (Facile) Qu'est-ce qu'une clé primaire, et en quoi diffère-t-elle d'un index ordinaire ?
2. (Moyen) Que renvoie un `LEFT JOIN` que ne renvoie pas un `INNER JOIN` ?
3. (Difficile) `SELECT * FROM clients WHERE telephone = '…'` devient lente sur 2 millions de lignes. Que regardes-tu en premier, pourquoi, et qu'attends-tu de voir ?

Résultat du calibrage : **en attente de ta réponse** (noté dans `docs/cours/README.md`).

## 1. Pourquoi ce mécanisme, et ce qu'il change dans ton diagnostic

Dans ton lab WordPress (MariaDB + PHP-FPM + Nginx), un site qui « rame » vient souvent d'une requête qui lit **toute** une table au lieu de sauter à la bonne ligne. En support ou en exploitation, la plainte arrive sous la forme « la page est lente », « la base est à 100 % de processeur », « ça marchait avec peu de données ». Ce que tu cherches : **comment le moteur a décidé de retrouver les lignes**, et si un index aurait pu lui éviter de tout lire. Le moteur te le dit : c'est le plan d'exécution.

## 2. Le mécanisme, étape par étape

**Étape 1 — Sans index, le moteur lit tout.** D'après le manuel MySQL (même famille de moteurs, lu le 2026-10-28) : « Without an index, MySQL must begin with the first row and then read through the entire table to find the relevant rows. The larger the table, the more this costs. » C'est le *balayage complet de table* (*full table scan*).

**Étape 2 — Un index est une structure triée à côté de la table.** « If the table has an index for the columns in question, MySQL can quickly determine the position to seek to in the middle of the data file without having to look at all the data. » La plupart des index (clé primaire, unique, ordinaire) sont stockés dans des **arbres B** (*B-trees*) ; dans la sortie MariaDB ci-dessous, la colonne `Index_type` indique `BTREE`. Un arbre B permet de **descendre** vers la valeur cherchée en peu d'étapes au lieu de parcourir les lignes une à une (explication simplifiée).

**Étape 3 — L'optimiseur choisit un plan.** Avant d'exécuter, le moteur évalue plusieurs façons d'obtenir les lignes (balayage, index, ordre des jointures) et choisit celle qu'il estime la moins coûteuse. Il s'appuie sur des **statistiques** sur les tables et les index. Elles sont des **estimations** : la colonne `rows` d'`EXPLAIN` est, selon la documentation MariaDB, « an estimate of how many rows we will find in the table for each key lookup ». `EXPLAIN` **n'exécute pas** la requête ; `ANALYZE` l'exécute et ajoute les chiffres réels (« r_rows »).

**Étape 4 — Le plan nomme la méthode d'accès : la colonne `type`.** Du meilleur au moins bon, d'après la documentation MariaDB :

| `type` | Sens |
|---|---|
| `system` | la table a 0 ou 1 ligne |
| `const` | « There is only one possibly matching row in the table » |
| `eq_ref` | « A unique index is used to find the rows. This is the best possible plan to find the row. » (cas d'une jointure) |
| `ref` | « A non unique index or prefix of an unique index is used to find the rows. » |
| `range` | « The table will be accessed with a key over one or more value ranges. » |
| `index` | balayage **complet de l'index** : mieux que `ALL`, mais mauvais si l'index est grand |
| `ALL` | « A full table scan is done for the table (all rows are read). » |

**Étape 5 — Le préfixe gauche.** Pour un index sur plusieurs colonnes `(col1, col2, col3)`, « any leftmost prefix of the index can be used by the optimizer » : on peut chercher par `(col1)`, `(col1, col2)` ou `(col1, col2, col3)`, **pas** par `col2` seul (manuel MySQL ; je transpose à MariaDB sans l'avoir relu dans la documentation MariaDB). C'est la règle qui explique « j'ai un index, et pourtant il n'est pas utilisé ».

**Étape 6 — Un index n'est pas toujours la bonne réponse.** « Indexes are less important for queries on small tables, or big tables where report queries process most or all of the rows. When a query needs to access most of the rows, reading sequentially is faster than working through an index. » (manuel MySQL.) Un plan `ALL` n'est donc pas **toujours** un défaut : sur une petite table, ou quand presque toutes les lignes sont nécessaires, il peut être le bon choix.

**Étape 7 — Le coût caché.** Chaque index doit être mis à jour quand les données changent : plus d'index ralentit les écritures et prend de la place (connu en général, non relu dans une source aujourd'hui).

## 3. La lecture du réel

Extraits authentiques de la documentation MariaDB de l'instruction `EXPLAIN` (consultée le 2026-10-28). Table d'exemple :

```sql
CREATE TABLE IF NOT EXISTS `employees_example` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `first_name` varchar(30) NOT NULL,
  `last_name` varchar(40) NOT NULL,
  `position` varchar(25) NOT NULL,
  `home_address` varchar(50) NOT NULL,
  `home_phone` varchar(12) NOT NULL,
  `employee_code` varchar(25) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_code` (`employee_code`),
  KEY `first_name` (`first_name`,`last_name`)
) ENGINE=Aria;
```
(six lignes y sont insérées par la documentation.)

```
SHOW INDEXES FROM employees_example;
| Key_name      | Seq_in_index | Column_name   | Cardinality | Index_type |
| PRIMARY       |            1 | id            |           7 | BTREE      |
| employee_code |            1 | employee_code |           7 | BTREE      |
| first_name    |            1 | first_name    |        NULL | BTREE      |
| first_name    |            2 | last_name     |        NULL | BTREE      |

EXPLAIN SELECT * FROM employees_example WHERE id=1;
| id | select_type | table             | type  | possible_keys | key     | key_len | ref   | rows | Extra |
|  1 | SIMPLE      | employees_example | const | PRIMARY       | PRIMARY | 4       | const |    1 |       |

EXPLAIN SELECT * FROM employees_example WHERE home_phone='326-555-3492';
| id | select_type | table             | type | possible_keys | key  | key_len | ref  | rows | Extra       |
|  1 | SIMPLE      | employees_example | ALL  | NULL          | NULL | NULL    | NULL |    6 | Using where |
```
(Colonnes de `SHOW INDEXES` réduites aux plus utiles ; les valeurs sont celles de la documentation.)

| Champ | Lecture |
|---|---|
| `Cardinality` : 7 | estimation du nombre de valeurs distinctes dans l'index. **La table n'a que 6 lignes** : le chiffre est une **estimation**, pas un compte exact. `NULL` signifie « pas encore calculé » |
| `Index_type` : BTREE | structure de l'index (arbre B) |
| `id` (EXPLAIN) : 1 | numéro d'ordre de lecture des tables |
| `select_type` : SIMPLE | requête sans sous-requête ni union |
| `type` : `const` | une seule ligne possible : la clé primaire est utilisée pour `id=1` |
| `possible_keys` / `key` | les index envisageables / l'index **réellement** choisi. `NULL` = aucun |
| `key_len` : 4 | octets de la clé utilisés (un entier de 4 octets, ici toute la clé) ; sert à voir si un index composite n'est utilisé qu'en partie |
| `ref` : `const` | la valeur recherchée est une constante |
| `rows` : 1 puis 6 | lignes que le moteur estime devoir lire : 1 avec la clé primaire, 6 (toute la table) sans index |
| `Extra` : `Using where` | un filtre `WHERE` est appliqué ligne par ligne ; avec un `type` `ALL`, la documentation signale que c'est souvent le signe d'un problème |

La documentation commente elle-même : pour `home_phone`, « the type is All, which means no index could be used ». Il n'y a **aucun index** sur `home_phone` (voir `SHOW INDEXES`) : le moteur lit les 6 lignes.

## 4. Ce qui casse, et le symptôme

| Défaut | Symptôme sur le terrain | Comment remonter à la cause |
|---|---|---|
| Colonne filtrée **sans index** | requête lente qui s'aggrave avec le volume ; processeur élevé ; `type` = `ALL`, `key` = `NULL` | `EXPLAIN` : `key` vide et `rows` proche du nombre total de lignes |
| Index composite utilisé **à l'envers** | « j'ai un index et il ne sert pas » | la colonne cherchée n'est pas le préfixe gauche de l'index (étape 5) |
| `rows` très éloigné de la réalité | plan « bizarre », mauvais choix | comparer `EXPLAIN` et `ANALYZE` (`rows` estimé et `r_rows` réel) ; statistiques périmées |
| Tri ou regroupement non indexé | `Extra` contient `Using filesort` ou `Using temporary` (« Filesort is needed to resolve the query » / « A temporary table is created to hold the result ») | un index sur la colonne de tri peut l'éviter |
| Trop d'index | écritures lentes, espace disque | liste des index inutilisés (non vu aujourd'hui) |
| Fonction ou préfixe joker sur la colonne (`WHERE LOWER(nom)='x'`, `LIKE '%x'`) | l'index n'est pas utilisé | connu en général ; **non relu dans la documentation MariaDB aujourd'hui** : à vérifier avec `EXPLAIN` dans ton lab |

## 5. Vocabulaire du jour (14 termes)

| Français | Anglais | Définition exacte / piège |
|---|---|---|
| plan d'exécution | *execution plan, query plan* | la méthode que le moteur choisit pour répondre à la requête |
| optimiseur | *optimizer* | le composant qui choisit le plan |
| balayage complet de table | *full table scan* | lecture de toutes les lignes (`type` = `ALL`) |
| index | *index* | structure triée qui retrouve les lignes sans tout lire |
| arbre B | *B-tree* | structure d'index la plus courante. Faux ami : le « B » ne veut pas dire *binary* |
| clé primaire | *primary key* | identifiant unique et non nul d'une ligne ; une table n'en a qu'une |
| clé unique | *unique key* | interdit les doublons ; peut accepter `NULL` selon le moteur |
| index composite | *composite / compound index* | index sur plusieurs colonnes ; l'ordre compte |
| préfixe gauche | *leftmost prefix* | partie initiale d'un index composite utilisable seule |
| cardinalité | *cardinality* | nombre estimé de valeurs distinctes dans un index |
| sélectivité | *selectivity* | part des lignes qu'un filtre écarte : un filtre sélectif renvoie peu de lignes |
| index couvrant | *covering index* | index qui contient toutes les colonnes demandées : `Using index` (« Only the index is used to retrieve the needed information ») |
| tri sur fichier | *filesort* | tri non fait par un index, donc par une étape de plus. Faux ami : ce n'est pas forcément un fichier sur disque |
| jointure | *join* | combinaison de deux tables ; `INNER JOIN` garde les lignes qui correspondent des deux côtés, `LEFT JOIN` garde aussi toutes celles de gauche |

Approximations courantes : « la base est lente » (c'est une requête) ; « l'index est cassé » (il n'est le plus souvent pas utilisé) ; « `EXPLAIN` exécute la requête » (non, c'est `ANALYZE`).

## 6. Comment le dire juste

**Pour un collègue :** « La requête lit toute la table : `EXPLAIN` donne `ALL`, aucun index choisi, un nombre de lignes estimé proche du total. Il manque un index sur la colonne du filtre. »

**Pour un prestataire ou un éditeur** (FR puis EN) :
- FR : « Pour la requête sur `home_phone`, `EXPLAIN` indique un `type` à `ALL` et `key` à `NULL`. Pouvez-vous confirmer qu'aucun index n'est prévu sur cette colonne et en évaluer l'effet sur les écritures ? »
- EN: "For the `home_phone` query, `EXPLAIN` shows `type` `ALL` and `key` `NULL`. Could you confirm that no index is planned on this column and assess the impact on writes?"

**Dans un ticket** (FR puis EN) :
- FR : « Symptôme : page lente, processeur de la base élevé. Constat : balayage complet de la table (`type` `ALL`, `rows` ≈ total). Hypothèse : absence d'index sur la colonne filtrée. Vérification : `EXPLAIN`, puis `ANALYZE` pour les valeurs réelles, avant et après création d'un index de test. »
- EN: "Symptom: slow page, high database CPU. Finding: full table scan (`type` `ALL`, `rows` ≈ total). Hypothesis: missing index on the filtered column. Check: `EXPLAIN`, then `ANALYZE` for actual values, before and after adding a test index."

## 7. Exercice de diagnostic (20 à 30 minutes, **dans ton laboratoire** : un conteneur MariaDB à toi, jamais une base de l'employeur)

Matière : la table `employees_example` de la section 3 (documentation MariaDB). Dans ton lab, crée-la, insère quelques lignes (ou beaucoup, avec une boucle) et observe. **Avant** d'exécuter chaque `EXPLAIN`, écris ta prédiction (`type`, `key`).

1. `WHERE id = 1` : prédiction puis observation. (La documentation montre `const`.)
2. `WHERE employee_code = 'MM1'`.
3. `WHERE first_name = 'Fanny'`.
4. `WHERE last_name = 'Crowne'`.
5. `WHERE home_phone = '326-555-3492'` (la documentation montre `ALL`). Ajoute ensuite **dans ton lab seulement** un index sur `home_phone` et recommence. Que deviennent `type`, `key` et `rows` ?
6. Question : sur une table de 6 lignes, le plan `ALL` est-il vraiment un problème ?

<details>
<summary>Solution</summary>

1. `const` (clé primaire), comme dans la documentation.
2. Probablement `const` : la clé unique `employee_code` garantit au plus une ligne (prédiction : à confirmer par `EXPLAIN`).
3. Probablement `ref` sur l'index composite `first_name` (préfixe gauche), plusieurs lignes possibles.
4. Probablement `ALL` : `last_name` n'est **pas** le préfixe gauche de l'index composite. Un moteur peut aussi choisir de parcourir l'index entier (`index`) selon les colonnes demandées : observe et note ce que **ton** MariaDB choisit, c'est l'intérêt de l'exercice.
5. Avant : `ALL`, `key` `NULL`, `rows` = nombre de lignes. Après l'ajout de l'index : `ref`, `key` = ton index, `rows` beaucoup plus petit (sur peu de lignes, l'optimiseur peut malgré tout préférer le balayage : étape 6).
6. Non : sur une petite table lire tout est quasi gratuit ; le même plan sur des millions de lignes est un problème. C'est le **volume** qui décide.
</details>

## 8. Révision espacée

Fiche de la veille (2026-10-27, Kerberos). Il n'existe pas de fiche vieille de sept jours ; je reprends une question de la fiche du 26 octobre.

1. Pourquoi Kerberos tolère-t-il seulement quelques minutes d'écart d'horloge, et quel code obtiens-tu sinon ?
2. Où cherches-tu un mauvais mot de passe : 4768 ou 4771 ?
3. Que fait un commutateur d'une trame dont l'adresse destination est inconnue ?

<details>
<summary>Réponses</summary>

1. Pour empêcher le rejeu : la pré-authentification est un horodatage chiffré ; au-delà de la tolérance (5 minutes par défaut), erreur `0x25` (KRB_AP_ERR_SKEW).
2. Dans **4771** (code `0x18`).
3. Il l'inonde sur tous les ports du VLAN sauf celui d'arrivée, puis apprend l'adresse du répondant.
</details>

## 9. Trois questions de contrôle

1. Que signifie `type` = `ALL` et `key` = `NULL` dans un plan ?
2. Pourquoi un index sur `(first_name, last_name)` ne sert-il pas à chercher par `last_name` seul ?
3. Quelle est la différence entre `EXPLAIN` et `ANALYZE` ?

<details>
<summary>Réponses</summary>

1. Un balayage complet de la table : aucun index n'est utilisé, toutes les lignes sont lues.
2. Parce que seul un préfixe gauche d'un index composite est exploitable ; `last_name` est la deuxième colonne.
3. `EXPLAIN` donne le plan estimé sans exécuter ; `ANALYZE` exécute la requête et ajoute des chiffres réels (`r_rows`).
</details>

## 10. Sources (consultées le 2026-10-28)

- MariaDB, instruction `EXPLAIN` : https://mariadb.com/docs/server/reference/sql-statements/administrative-sql-statements/analyze-and-explain-statements/explain — colonnes de sortie, valeurs de `type` et de `Extra`, exemples (`id=1` en `const`, `home_phone` en `ALL`), `SHOW INDEXES` avec `BTREE` et la cardinalité, différence avec `ANALYZE`. Le site a répondu par intermittence (erreurs 504) ; le contenu cité vient d'une lecture réussie.
- MySQL 8.4, « How MySQL uses indexes » : https://dev.mysql.com/doc/refman/8.4/en/mysql-indexes.html — lecture séquentielle sans index, arbres B, préfixe gauche, petites tables. Moteur voisin de MariaDB, cité avec cette réserve.
- Dépôt : `docker-compose.yml` (image `mariadb`), `docker wordpress` (compte rendu du lab).
- Non vérifié aujourd'hui (de mémoire) : le coût des index en écriture ; l'inefficacité d'un index avec fonction ou joker en tête de chaîne ; la mise à jour des statistiques ; l'équivalence exacte du préfixe gauche chez MariaDB.
