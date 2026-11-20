# Fiche — Transactions, niveaux d'isolation et verrous InnoDB : pourquoi une requête « attend » sans raison apparente

*Piste : SQL · mercredi 18 novembre 2026 · lecture : 25 min · moteur : MariaDB / InnoDB (ton `docker-compose.yml` utilise `mariadb:latest` ; la version exacte n'est pas dans le fichier, voir §7)*

> **Rappel :** observations en **conteneur de laboratoire** uniquement. Ne reproduis pas un blocage sur une base de production ou de ton employeur.

## 1. Pourquoi ce mécanisme
Symptôme classique : « la requête est lente » alors qu'elle est simple, ou une erreur `1205 Lock wait timeout exceeded`. `EXPLAIN` (fiches des 4 et 11 novembre) ne montre pas ce cas : le plan est bon, la requête **attend un verrou**. Diagnostiquer, c'est savoir **qui** détient quoi.

## 2. Le mécanisme (source : documentation MariaDB, lue le 2026-11-18)
**Verrous de ligne.** InnoDB pose des verrous **partagés (S)** pour lire et **exclusifs (X)** pour écrire. Un verrou porte sur un **enregistrement d'index**, pas sur une « ligne logique » : si deux transactions atteignent la même ligne par deux index différents, elles peuvent ne pas se gêner.

**Verrous d'intention (IS, IX).** Ils permettent aux verrous de table et de ligne de coexister.

**Verrous d'intervalle (*gap locks*, *next-key locks*).** Au niveau par défaut `REPEATABLE READ`, InnoDB verrouille aussi **l'intervalle entre** des enregistrements d'index pour bloquer les insertions concurrentes dans la plage lue (les « fantômes »). Ils sont **désactivés** en `READ COMMITTED` et `READ UNCOMMITTED`, sauf pour la vérification de doublon sur index unique, qui pose un verrou *next-key* à tous les niveaux. La page indique que MariaDB **ne relâche pas** le verrouillage d'intervalle pour les index uniques, depuis 11.0 / 10.11.2 / 10.10.3 / 10.9.5 / 10.8.7 / 10.7.8 / 10.6.12.

**Niveaux d'isolation.** Défaut : `REPEATABLE READ`. Lecture non verrouillante : en `REPEATABLE READ`, toutes les lectures cohérentes d'une transaction voient **l'instantané** établi à la première lecture ; en `READ COMMITTED`, chaque lecture voit le dernier état validé. `READ UNCOMMITTED` permet les lectures sales. `SERIALIZABLE` transforme les `SELECT` simples en `LOCK IN SHARE MODE` si l'*autocommit* est désactivé.

**Qui garde ses verrous jusqu'à quand.** En `READ COMMITTED`/`READ UNCOMMITTED`, InnoDB relâche le verrou d'un enregistrement qui ne correspond pas au `WHERE`, **mais il a dû l'acquérir d'abord**, donc il attend quand même un conflit. En `REPEATABLE READ`/`SERIALIZABLE`, les verrous de tous les enregistrements visités sont gardés **jusqu'à la fin de la transaction**.

**Exemple de la documentation :** la table n'a d'index que sur `id`. La connexion 1 insère une ligne sans valider ; la connexion 2 fait `DELETE … WHERE flag <> 0`. Comme `flag` n'est pas indexé, InnoDB lit **tous** les enregistrements par la clé primaire, y compris la ligne non validée, et doit la verrouiller avant de tester la condition : le `DELETE` **attend**, alors que la nouvelle ligne ne correspond pas au filtre.

**Fin d'attente.** Si le verrou n'est pas libéré avant `innodb_lock_wait_timeout` secondes : erreur `1205` ; **l'instruction** est annulée (la transaction entière seulement si `innodb_rollback_on_timeout` est activé ; valeur par défaut `0`). Un **interblocage** (*deadlock*) est détecté **immédiatement** (`innodb_deadlock_detect`, activé par défaut) et une transaction est annulée.

**Instantané strict.** La variable `innodb_snapshot_isolation` : si activée, un `UPDATE`/`DELETE` sur une ligne modifiée depuis ton instantané échoue avec l'erreur `1020` (*Record has changed since last read*) et la transaction est annulée ; **la page se contredit** sur la version où elle devient le défaut (« 11.6.2 » dans un passage, « 11.8 » dans un autre) : vérifie sur **ta** version.

## 3. Lecture du réel
Extrait authentique de la documentation (§ ci-dessus) : `SELECT id FROM t WHERE flag <> 0 FOR UPDATE SKIP LOCKED` retourne les lignes 1 et 2 **sans attendre** celle verrouillée. Messages à reconnaître : `ERROR 1205 (HY000): Lock wait timeout exceeded; try restarting transaction` (attente trop longue, instruction annulée) ; `1020 Record has changed since last read` (instantané strict). **Je n'ai pas de sortie `SHOW ENGINE INNODB STATUS` authentique sous la main** : ne te fie pas à un format que je ne t'ai pas montré.

## 4. Ce qui casse, et le symptôme
- Transaction **ouverte et oubliée** (un client qui n'a ni validé ni annulé) : ses verrous durent tant qu'elle vit ; les autres requêtes attendent puis `1205`.
- `WHERE` sur une colonne **non indexée** : beaucoup d'enregistrements visités, donc beaucoup de verrous (et d'attentes), cf. l'exemple ci-dessus.
- Deux transactions qui verrouillent les mêmes lignes **dans un ordre différent** : interblocage ; l'une est annulée, **l'application doit réessayer**.
- Remonter : qui tient le verrou ? Quelle transaction est ouverte depuis longtemps ? Quel index manque ?

## 5. Vocabulaire
| Français | English | Définition / piège |
|---|---|---|
| transaction | transaction | suite d'opérations validée ou annulée en bloc |
| valider / annuler | commit / rollback | |
| niveau d'isolation | isolation level | ce qu'une transaction voit des autres |
| lecture cohérente | consistent read | lecture sur instantané, sans verrou |
| lecture verrouillante | locking read | `FOR UPDATE`, `LOCK IN SHARE MODE` |
| verrou partagé / exclusif | shared / exclusive lock (S/X) | lire / écrire |
| verrou d'intention | intention lock (IS/IX) | coexistence table/ligne |
| verrou d'intervalle | gap lock | bloque les insertions dans l'intervalle |
| verrou *next-key* | next-key lock | enregistrement + intervalle précédent |
| lecture sale | dirty read | donnée non validée vue |
| lecture fantôme | phantom read | nouvelles lignes qui apparaissent |
| interblocage | deadlock | attente circulaire ; détecté, une victime annulée |
| délai d'attente de verrou | lock wait timeout | erreur 1205 |
| instantané | snapshot | état figé de la lecture |
Faux amis : « bloqué » ≠ « lent » ; « verrou » MySQL (`LOCK TABLES`) ≠ verrous de ligne InnoDB ; « timeout » réseau ≠ timeout de verrou.

## 6. Comment le dire juste
- **Collègue :** « Ce n'est pas le plan, la requête attend un verrou : une transaction est restée ouverte et garde ses verrous. »
- **Prestataire (EN) :** "The query is waiting on a row lock held by an idle transaction; we get error 1205 after the lock wait timeout. Could you confirm which session holds the lock?"
- **Ticket (EN) :** "Intermittent `Lock wait timeout exceeded` (1205) on the orders table. Suspected long-running open transaction; query itself is fine. Need the lock holder and its start time."

## 7. Exercice (conteneur de laboratoire, 25 min)
Dans un conteneur MariaDB **de test**, deux terminaux. Relève `SELECT VERSION();` et `SHOW VARIABLES LIKE 'innodb_snapshot_isolation';` (la variable peut ne pas exister selon la version). Crée une table `t(id PK, flag INT)` avec 2 lignes. Terminal 1 : `START TRANSACTION; INSERT … (3,0);` sans valider. Terminal 2 : `DELETE FROM t WHERE flag <> 0;`. **Hypothèse à écrire d'abord :** le `DELETE` attend-il ? Vérifie, puis valide le terminal 1 et note le résultat. Essaie ensuite avec un index sur `flag`.
<details><summary>Solution</summary>
Selon la documentation, sans index sur `flag` le `DELETE` attend (il doit verrouiller la ligne non validée avant de tester la condition) ; si le terminal 1 valide, il continue ; sinon `1205` après `innodb_lock_wait_timeout`. Si ta version a l'instantané strict activé et que le terminal 2 a déjà lu dans sa transaction, tu peux obtenir `1020`. Avec un index sur `flag`, moins d'enregistrements sont visités : **je n'ai pas testé** ; observe-le.
</details>

## 8. Révision espacée
Hier (réplication AD) : 1) Qu'est-ce qu'un USN ? 2) Quelle limite rend un DC éteint dangereux à rallumer ? Il y a sept jours (11 nov, `GROUP BY`, tri, `Extra`) : 3) Que signifie `Using temporary` ?

## 9. Questions de contrôle
1. Pourquoi une requête au plan correct peut-elle attendre ? 2. Quelle différence de durée de conservation des verrous entre `READ COMMITTED` et `REPEATABLE READ` ? 3. Que fait InnoDB en cas d'interblocage ?
<details><summary>Réponses</summary>
1. Elle attend un verrou détenu par une autre transaction. 2. En `READ COMMITTED`, le verrou d'un enregistrement non correspondant est relâché ; en `REPEATABLE READ`, tous les verrous visités sont gardés jusqu'à la fin de la transaction. 3. Il le détecte immédiatement et annule une transaction (la victime).
</details>

## 10. Sources (consultées le 2026-11-18)
- MariaDB, « InnoDB Lock Modes » : https://mariadb.com/kb/en/innodb-lock-modes/ — S/X, intention, intervalle, exemple du `DELETE`, `SKIP LOCKED`.
- MariaDB, « SET TRANSACTION » : https://mariadb.com/kb/en/set-transaction/ — niveaux d'isolation, défaut, `innodb_snapshot_isolation`, erreur 1020.
- MariaDB, « InnoDB System Variables » : https://mariadb.com/kb/en/innodb-system-variables/ — `innodb_lock_wait_timeout`, `innodb_deadlock_detect`, `innodb_rollback_on_timeout`.
