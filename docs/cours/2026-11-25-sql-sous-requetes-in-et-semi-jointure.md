# Fiche — Sous-requêtes `IN` : pourquoi MariaDB les transforme en jointure (semi-jointure)

*Piste : SQL · mercredi 25 novembre 2026 · lecture : 25 min · moteur : MariaDB (ton `docker-compose.yml` utilise `mariadb:latest`, version exacte non précisée)*

> **Rappel :** observations en **conteneur de laboratoire**. N'exécute pas de requêtes d'essai coûteuses sur une base de production.

## 1. Pourquoi ce mécanisme
Fiches du 4 et du 11 novembre : `EXPLAIN`, jointures, `Extra`. Beaucoup de requêtes s'écrivent avec `WHERE x IN (SELECT …)`. Savoir **comment le moteur les exécute** explique pourquoi deux écritures « équivalentes » n'ont pas le même plan, et pourquoi une requête lente peut être réécrite sans changer le résultat.

## 2. Le mécanisme (source : documentation MariaDB, lue le 2026-11-25)
- **Forme semi-jointure.** Une *semi-join subquery* a la forme `SELECT … FROM tables_externes WHERE expr IN (SELECT … FROM tables_internes …) AND …` : une sous-requête **`IN`, située dans le `WHERE`**. Ce qui compte : **on ne s'intéresse qu'aux lignes externes qui ont une correspondance** dans la sous-requête.
- **Pourquoi c'est utile.** Cette propriété autorise une exécution « à l'envers » : l'exemple de la documentation (`Country.Code IN (SELECT City.country FROM City WHERE City.Population > 1000000)`) peut partir des **pays d'Europe** et vérifier s'ils ont de grandes villes, **ou** partir des **grandes villes** et chercher leur pays. Dans une variante non semi-jointure décrite par la page, **le sens inverse n'est pas possible**.
- **Différence avec une jointure ordinaire.** Avec une semi-jointure, **peu importe combien de correspondances** a la table interne : dans l'exemple, l'Allemagne est renvoyée **une seule fois**, même avec trois villes de plus d'un million d'habitants. Une jointure ordinaire la répéterait.
- **Cinq stratégies d'exécution** citées par la page : *Table pullout*, *FirstMatch*, *Semi-join Materialization*, *LooseScan*, *DuplicateWeedout*. Les optimisations sont **activées par défaut** ; on peut les couper avec `SET optimizer_switch='semijoin=off'`.
- **Matérialisation (page « Optimization strategies »)** : la stratégie *Semi-join Materialization* exécute une sous-requête `IN` **non corrélée** dans une **table temporaire**, puis la joint par *Materialization-scan* ou *Materialization-lookup*.
- **`EXPLAIN` reste rapide :** selon la carte des optimisations de sous-requêtes, MariaDB **n'évalue pas** les sous-requêtes coûteuses pendant l'optimisation ; donc `EXPLAIN` est toujours rapide.

## 3. Lecture du réel
Extrait authentique de la page « Subquery limitations » (lue le 2026-11-25) :
```
SELECT * FROM staff WHERE (name,age) = ALL (
  SELECT name,age FROM customer WHERE age >=51
);
ERROR 1241 (21000): Operand should contain 1 column(s)
```
Lecture : la comparaison `= ALL` avec une paire `(name, age)` n'est pas acceptée (une seule colonne attendue) ; l'exemple voisin avec `(name,age) NOT IN (…)` s'exécute et renvoie `Bilhah` (37) et `Maia` (25) dans la documentation. **Je n'ai pas de sortie `EXPLAIN` d'une sous-requête `IN` à commenter champ par champ** : l'exercice du §7 te la fait produire.

## 4. Ce qui casse, et le symptôme
- **Même résultat, plans différents :** une `IN (SELECT …)` et sa jointure équivalente ne se comportent pas forcément pareil ; si un plan est mauvais, compare les deux dans `EXPLAIN` avant de réécrire.
- **Doublons inattendus** si tu remplaces un `IN` par une jointure ordinaire : la semi-jointure garantit **une** ligne externe, la jointure non.
- **Sous-requête corrélée coûteuse** (référençant la requête externe) : exécutée par ligne externe si aucune optimisation ne s'applique ; **ne pas supposer** sans lire le plan.
- Comportement qui dépend de la **version** : pas de généralisation sans `SELECT VERSION();`.

## 5. Vocabulaire
| Français | English | Définition / piège |
|---|---|---|
| sous-requête | subquery | requête dans une requête |
| semi-jointure | semi-join | ne garde que les lignes externes qui ont une correspondance |
| sous-requête corrélée | correlated subquery | dépend de la ligne externe |
| table dérivée | derived table | sous-requête dans `FROM` |
| matérialisation | materialization | résultat stocké en table temporaire |
| table temporaire | temporary table | |
| stratégie d'exécution | execution strategy | FirstMatch, LooseScan… |
| interrupteur de l'optimiseur | optimizer switch | `optimizer_switch` |
| ligne externe / interne | outer / inner row | |
| doublon | duplicate | |
| jointure | join | ≠ semi-jointure |
| `IN` / `EXISTS` | `IN` / `EXISTS` | appartenance / existence |
Faux amis : « sous-requête » ≠ « jointure » ; semi-jointure : **pas** un mot-clé SQL, un **concept** de l'optimiseur.

## 6. Comment le dire juste
- **Collègue :** « Cette requête n'est pas lente à cause du plan de jointure : c'est une sous-requête `IN` ; je compare son `EXPLAIN` avec la version en jointure. »
- **Prestataire (EN) :** "Could you share the `EXPLAIN` output for the `IN (SELECT …)` version, and confirm whether semi-join optimizations are enabled (`optimizer_switch`)?"
- **Ticket (EN) :** "Query using `WHERE x IN (SELECT …)` is slow. Compare plans with a join rewrite (watch duplicates: a semi-join returns each outer row once). Version and `optimizer_switch` to be confirmed."

## 7. Exercice (conteneur MariaDB de laboratoire, 25 min)
Crée deux petites tables `pays(code, continent)` et `villes(pays_code, population)` avec quelques lignes (un pays avec **trois** grandes villes). **Avant de lancer quoi que ce soit, écris tes hypothèses :** (1) combien de lignes pour `SELECT … FROM pays WHERE code IN (SELECT pays_code FROM villes WHERE population > 1000000)` ? (2) combien avec une jointure ordinaire équivalente ? (3) que change `SET optimizer_switch='semijoin=off'` dans `EXPLAIN` ? Relève `SELECT VERSION();`.
<details><summary>Solution</summary>
(1) Une ligne par pays, d'après la documentation (l'Allemagne apparaît une fois). (2) Avec une jointure ordinaire, une ligne **par grande ville**, donc trois pour ce pays, sauf `DISTINCT`. (3) À observer : **je n'ai pas rejoué l'exercice** ; compare `select_type` et `Extra` avant/après et note ce que tu vois. Je ne te donne pas de sortie attendue que je n'ai pas lue.
</details>

## 8. Révision espacée
Hier (SPN) : 1) À quoi sert un SPN ? 2) Que signifie `KDC_ERR_PRINCIPAL_NOT_UNIQUE` ? Il y a sept jours (18 nov, verrous InnoDB) : 3) Quelle erreur obtiens-tu après `innodb_lock_wait_timeout` ?

## 9. Questions de contrôle
1. Quelle forme de requête est une semi-jointure ? 2. Pourquoi une semi-jointure ne renvoie-t-elle pas de doublon de la ligne externe ? 3. Comment désactiver les optimisations semi-jointure ?
<details><summary>Réponses</summary>
1. `WHERE expr IN (SELECT …)` (sous-requête `IN` dans le `WHERE`). 2. On ne s'intéresse qu'à l'existence d'une correspondance, pas à leur nombre. 3. `SET optimizer_switch='semijoin=off'`.
</details>

## 10. Sources (consultées le 2026-11-25)
- MariaDB, « Semi-join Subquery Optimizations » : https://mariadb.com/kb/en/semi-join-subquery-optimizations/ — définition, exemple Country/City, cinq stratégies, `optimizer_switch`.
- MariaDB, « Optimization Strategies » : https://mariadb.com/kb/en/optimization-strategies/ — Semi-join Materialization.
- MariaDB, « Subquery Optimizations Map » : https://mariadb.com/kb/en/subquery-optimizations-map/ — `EXPLAIN` toujours rapide, optimisations listées.
- MariaDB, « Subquery Limitations » : https://mariadb.com/kb/en/subquery-limitations/ — erreur 1241 de l'exemple.
