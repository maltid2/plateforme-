# Fiche — Sécurité de l'infrastructure : la fenêtre de mise à jour de WordPress (TOCTOU, CVE-2026-119977)

Piste : sécurité de l'infrastructure (rotation du jeudi, sujet = l'avis marquant de la semaine). Lecture + exercice : 25 à 30 minutes. Cette fiche explique **le mécanisme** de la faille à partir du **correctif lui-même** (diff réel entre WordPress 7.1.3 et 7.1.4). Elle ne donne aucune marche à suivre pour l'exploiter.

## 1. Pourquoi ce mécanisme

L'avis a été consigné hier dans `veille.md` (WordPress Core, exploitation constatée par la CISA, échéance 2026-11-06). Ici, on comprend **pourquoi** une mise à jour, censée corriger, ouvre une porte : c'est une classe de défauts que tu retrouves partout (fichiers temporaires, répertoires de travail, installeurs, sauvegardes). Question de diagnostic à retenir : **« pendant l'opération, qu'est-ce qui est accessible depuis le réseau, sous quel nom, et pendant combien de temps ? »**

## 2. Le mécanisme, pas à pas

### 2.1 Les mots exacts de l'avis
- NVD (CVE-2026-119977, lu le 2026-11-04) : « WordPress Core is vulnerable to Remote Code Execution in versions 4.7 through 7.1.3. This is due to **predictable, web-accessible staging paths** used during full-package core upgrades. This makes it possible for unauthenticated attackers to execute code on the server **during the upgrade window**. » Faiblesse CWE-367 (*time-of-check time-of-use*), CVSS 3.1 de 8,1, complexité d'attaque élevée (`AC:H`).
- Annonce WordPress 7.1.4 (2026-10-28) : « A weakness in the WordPress upgrade process which can lead to remote code execution during the upgrade window. »

### 2.2 TOCTOU, en une phrase
*Time-of-check to time-of-use* : un programme **vérifie** une condition à l'instant T1, puis **s'en sert** à l'instant T2 ; si quelqu'un peut changer la situation **entre les deux**, la vérification ne vaut plus rien. Ici, la « situation » est un **répertoire de travail** que WordPress remplit pendant une mise à jour.

### 2.3 Ce que le correctif révèle (diff réel 7.1.3 → 7.1.4)
J'ai lu le code source de `wp-admin/includes/class-wp-upgrader.php` dans les deux versions (étiquettes `7.1.3` et `7.1.4` du dépôt public `WordPress/wordpress-develop`, lues le 2026-11-05). Trois changements, qui disent beaucoup :

**(a) Le nom du répertoire de travail devenait prévisible.**
Avant (7.1.3) :
```php
// We need a working directory - strip off any .tmp or .zip suffixes.
$working_dir = $upgrade_folder . basename( basename( $package, '.tmp' ), '.zip' );
```
Après (7.1.4) :
```php
/** Builds an unpredictable name for the directory a package is unpacked into. */
private function get_working_dir_name( $package ) {
    $name = basename( basename( $package, '.tmp' ), '.zip' );
    return $name . '-' . wp_generate_password( 16, false );
}
$working_dir = $upgrade_folder . $this->get_working_dir_name( $package );
```
Lecture : avant, le nom du dossier où le paquet est décompressé **se déduisait du nom du fichier du paquet** ; après, on lui ajoute **16 caractères aléatoires**. Un nom qui se devine permet d'y adresser une requête.

**(b) Le répertoire parent était « servi par le web » et listable.**
Après (7.1.4), le commentaire du correctif le dit en toutes lettres : « The upgrade directory is **web-served**. Keep it from being listed, as core does for wp-content and its plugins and themes directories, so the name of the working directory created below cannot be discovered from a directory index. » Et le code crée un fichier `index.php` (« Silence is golden. ») dans `wp-content/upgrade/`, et **ne le supprime plus** lors du nettoyage (`if ( 'index.php' === $file['name'] ) { continue; }`). Lecture : même sans deviner le nom, un **index de répertoire** pouvait le révéler.

**(c) Un `wp-config.php` déposé dans le répertoire de travail pouvait être recopié sur le vrai site.**
Dans `update-core.php`, la liste des éléments à ne pas copier passe de
`array( 'wp-content', 'wp-includes/version.php' )` à
`array( 'wp-content', 'wp-includes/version.php', 'wp-config.php' )`,
avec le commentaire « **Never copy a wp-config.php, which could have been written to the working directory.** » Lecture : les développeurs reconnaissent qu'un `wp-config.php` **pouvait être écrit dans le répertoire de travail** par un tiers, et qu'à la fin de la mise à jour, WordPress copiait tout (sauf une liste) du répertoire de travail vers le site réel.

### 2.4 Reconstitution (de ma part : une **déduction**, pas une affirmation de l'éditeur)
Les trois correctifs dessinent le scénario suivant ; je ne l'ai **pas** vu décrit dans un avis, je l'infère de la combinaison du diff, de la description NVD et des fichiers qu'elle cite (`setup-config.php`, `update-core.php`, `class-core-upgrader.php`) :
1. WordPress décompresse le paquet de la nouvelle version dans `wp-content/upgrade/<nom>/`, **un dossier accessible depuis le web** (b).
2. Ce paquet contient l'arborescence complète de WordPress, donc aussi le **programme d'installation** (`wp-admin/setup-config.php`, dont l'objet est de créer `wp-config.php`, d'après son propre commentaire d'en-tête : « Retrieves and creates the wp-config.php file »).
3. Si l'on peut **atteindre** ce dossier de travail pendant la mise à jour (nom prévisible ou listable (a, b)), on peut **faire exécuter** ce programme dans un contexte que l'on contrôle, et lui faire écrire un `wp-config.php` à l'intérieur du dossier de travail.
4. À la fin de la mise à jour, WordPress **recopie** le contenu du dossier de travail vers le site réel : sans le correctif (c), ce `wp-config.php` pouvait atterrir sur le site, et un `wp-config.php` **est du code PHP**.
Le maillon « check / use » : WordPress **vérifie** un état (« le répertoire de travail est mon contenu ») puis **s'en sert** (copie) sans que rien ne garantisse que personne n'y a écrit entre-temps. D'où la « fenêtre » : le délai entre décompression et nettoyage.

Pourquoi `AC:H` : l'attaquant doit **être présent pendant la fenêtre**, et cette fenêtre ne dure que le temps de la mise à jour. Mais CVE-2026-119977 figure au catalogue d'exploitation active : *difficile* ne veut pas dire *théorique*.

### 2.5 Ce que le correctif ne dit pas
Le diff ne prouve pas que ces trois changements sont **les seuls** nécessaires, ni que l'exploitation observée passe par ce chemin exact. Je n'ai pas lu l'article Wordfence cité par le catalogue (la page n'a pas répondu), ni testé quoi que ce soit.

## 3. Lecture du réel

Extrait authentique du correctif (`update-core.php`, 7.1.4), commenté :

```php
/*
 * Don't copy wp-content, we'll deal with that below.
 * We also copy version.php last so failed updates report their old version.
 * Never copy a wp-config.php, which could have been written to the working directory.
 */
$skip = array( 'wp-content', 'wp-includes/version.php', 'wp-config.php' );
```
- `$skip` : liste des chemins **exclus** de la copie du répertoire de travail vers le site.
- `'wp-content'` : traité à part (contenu de l'utilisateur).
- `'wp-includes/version.php'` : copié **en dernier** pour qu'une mise à jour qui échoue au milieu affiche encore l'ancienne version (écho de la même idée : l'ordre des opérations compte).
- `'wp-config.php'` : ajout du correctif. C'est une **liste d'exclusion** (on énumère ce qu'on refuse), approche moins robuste qu'une liste d'inclusion : un autre fichier sensible oublié passerait. (Jugement de ma part, pas une critique de l'éditeur.)

Extrait de l'avis NVD, mots-clés à retenir : *predictable*, *web-accessible*, *staging*, *during the upgrade window*, *unauthenticated*.

## 4. Ce qui casse, symptôme, remontée

| Situation | Symptôme possible | Remontée |
|---|---|---|
| Site non corrigé, mise à jour automatique activée | Aucun symptôme visible | La version : si elle est ≤ 7.1.3 (branches rétroportées : voir l'annonce, les correctifs sortent progressivement), le risque existe pendant chaque mise à jour du noyau |
| Fichier `wp-config.php` modifié sans que tu l'aies fait | Base de données inconnue, redirections, comportement étrange | Date de modification de `wp-config.php`, comparaison avec une sauvegarde saine |
| Répertoire `wp-content/upgrade/` listable depuis le web | La liste des dossiers apparaît dans le navigateur | Tester **sur ton propre site** uniquement (voir exercice) |
| Fichiers inconnus dans `wp-content/upgrade/` après une mise à jour | Résidus d'une mise à jour interrompue, ou intrus | Contenu et dates du répertoire ; journaux d'accès du serveur web sur ce chemin |

Piège de raisonnement : « mon site n'est pas visible d'Internet » protège mais ne remplace pas la mise à jour ; et « je mets à jour pendant la nuit » **réduit** la probabilité de rencontre, il ne supprime pas la fenêtre.

## 5. Vocabulaire (FR / EN)

| FR | EN | Définition, piège |
|---|---|---|
| condition de concurrence | *race condition* | résultat qui dépend de l'ordre d'événements concurrents |
| TOCTOU | *time-of-check to time-of-use* | CWE-367 : l'état change entre la vérification et l'usage |
| fenêtre de mise à jour | *upgrade window* | durée pendant laquelle l'état intermédiaire existe |
| répertoire de travail / de préparation | *working directory / staging directory* | **Piège :** *working directory* a aussi le sens de « répertoire courant » d'un processus |
| chemin prévisible | *predictable path* | nom qu'on peut deviner |
| listage de répertoire | *directory listing / directory index* | le serveur affiche le contenu d'un dossier sans fichier d'index |
| servi par le web | *web-served / web-accessible* | accessible par une requête HTTP |
| exécution de code à distance | *remote code execution (RCE)* | **Piège :** ≠ exécution de commande par un administrateur légitime |
| non authentifié | *unauthenticated* | **Piège :** ≠ *non authorized* ; sans compte |
| complexité d'attaque | *attack complexity (AC)* | `AC:H` = conditions hors du contrôle de l'attaquant |
| liste d'exclusion / d'inclusion | *denylist (blocklist) / allowlist* | **Piège :** préférer l'allowlist |
| rétroportage | *backport* | appliquer un correctif à d'anciennes branches |
| version de sécurité | *security release* | **Piège :** ≠ *patch Tuesday* (calendrier Microsoft) |
| exploitation active | *active exploitation* | constatée en conditions réelles (catalogue CISA) |
| faux ami : *staging* | = préparation / pré-production selon le contexte | pas « mise en scène » |

## 6. Comment le dire juste

**À un collègue (FR) :** « La faille WordPress, c'est la mise à jour elle-même : pendant la mise à jour, le dossier de travail est accessible par le web, avec un nom devinable. Le correctif 7.1.4 le rend aléatoire, empêche son listage, et refuse de recopier un `wp-config.php`. »

**À un prestataire / éditeur d'hébergement (FR + EN) :**
- FR : « Pouvez-vous confirmer la version de WordPress de notre site et si les mises à jour automatiques du noyau sont actives ? Nous voulons passer en 7.1.4 ou dans la branche rétroportée correspondante. »
- EN: "Can you confirm the WordPress version of our site and whether automatic core updates are enabled? We want to move to 7.1.4 or the corresponding backported branch."

**Dans un ticket (FR + EN) :**
- FR : « CVE-2026-119977 (WordPress ≤ 7.1.3, exploitation active selon la CISA). Site : <nom>, version relevée : <x>. Action : mise à jour vers 7.1.4 (ou branche rétroportée disponible), puis contrôle de la date de modification de `wp-config.php` et du contenu de `wp-content/upgrade/`. »
- EN: "CVE-2026-119977 (WordPress ≤ 7.1.3, actively exploited per CISA). Site: <name>, version found: <x>. Action: update to 7.1.4 (or the backported branch once available), then check the modification date of `wp-config.php` and the contents of `wp-content/upgrade/`."

## 7. Exercice d'observation (20 à 30 minutes, **ton lab uniquement**)

**Rappel :** uniquement sur **ton propre** site WordPress de lab. Jamais sur un site de ton employeur, d'un client ou d'un tiers, et ne teste jamais l'exposition d'un site qui n'est pas le tien.

1. Relève la version de ton WordPress de lab (tableau de bord, ou fichier `wp-includes/version.php`). Est-elle ≤ 7.1.3 ? *Note : tes fichiers WordPress ne sont pas dans le dépôt ; je ne connais pas ta version.*
2. Regarde si le dossier `wp-content/upgrade/` existe et ce qu'il contient. S'il contient un `index.php`, de quand date-t-il ?
3. Hypothèse à écrire : « le serveur web de mon lab sert-il ce dossier ? Affiche-t-il son listing ? » Vérifie **depuis ton propre navigateur sur ton propre lab**, sans rien envoyer d'autre qu'une requête d'ouverture de dossier.
4. Relève la date de modification de ton `wp-config.php` et compare-la à ce que tu t'attends à voir.
5. Écris la phrase de ticket (§6) avec tes valeurs. **Ne lance pas de mise à jour du noyau** dans un site qui contient des données utiles sans sauvegarde.

*Rappel de l'hygiène du dépôt : `docker-compose.yml` (lignes 10 et 13 : identifiants de base de données) contient des valeurs que je ne reproduis jamais ; elles sont déjà signalées dans la fiche du 2026-10-27.*

<details><summary>Solution</summary>

Il n'y a pas de bonne réponse unique. Ce que tu dois pouvoir dire : (a) ta version, et si elle est avant ou après la correction (7.1.4, ou une branche rétroportée sortie depuis) ; (b) si `wp-content/upgrade/` est vide/absent hors mise à jour ; (c) si le listing est refusé ou affiché ; (d) la date de `wp-config.php`. Je n'ai pas exécuté cet exercice. Si ton listing s'affiche, c'est une information sur ton **lab** ; le correctif d'éditeur ajoute justement un `index.php` pour l'éviter.
</details>

## 8. Révision espacée

**D'hier (fiche du 2026-11-04, SQL jointures et EXPLAIN) :**
1. Dans un plan de jointure, pourquoi un `ALL` sur la première table n'est-il pas un défaut, et sur la table jointe oui ?
2. Que signifie `ref: test.t0.a` ?
3. À quoi sert `Using join buffer` ?

**D'il y a 7 jours (fiche du 2026-10-29, PHP + noyau Linux vers root) :**
1. Pourquoi enchaîner deux failles donne-t-il plus qu'une seule ?
2. Que lit-on dans un vecteur CVSS `AV:N/AC:L/PR:N` ?
3. Pourquoi le score d'une CVE seule peut-il sous-estimer une chaîne ?

<details><summary>Réponses</summary>

D'hier : (1) La première table est lue une fois ; la table jointe est cherchée à chaque ligne : sans index, le coût se multiplie. (2) La valeur cherchée dans l'index vient de la colonne `a` de `t0`. (3) Regrouper des lignes précédentes pour les comparer en un passage ; atténuation, pas solution.
Du 29 : (1) Le premier maillon donne un accès limité, le second l'élève en root. (2) Réseau (`N`), complexité faible (`L`), aucun privilège requis (`N`). (3) Chaque CVE est notée seule ; la chaîne produit un effet que ni l'une ni l'autre n'a seule.
</details>

## 9. Trois questions de contrôle

1. Qu'est-ce qu'un TOCTOU, et quel est « l'intervalle » dans la faille WordPress ?
2. Cite les trois changements du correctif 7.1.4 et le problème que chacun traite.
3. Pourquoi une liste d'exclusion (`$skip`) est-elle moins robuste qu'une liste d'inclusion ?

<details><summary>Réponses</summary>

1. L'état change entre la vérification et l'usage ; ici entre la décompression du paquet dans un dossier accessible par le web et la recopie de son contenu sur le site. 2. Nom du dossier de travail rendu aléatoire (nom devinable) ; `index.php` pour empêcher le listage (nom découvrable) ; `wp-config.php` jamais recopié (fichier déposé dans le dossier de travail). 3. On doit penser à tout ce qui est dangereux ; ce qu'on oublie passe. Une liste d'inclusion ne laisse passer que ce qui est prévu.
</details>

## 10. Sources (consultées le 2026-11-05)

- NVD, CVE-2026-119977 : https://nvd.nist.gov/vuln/detail/CVE-2026-119977 (description, CWE-367, score 8,1 `AV:N/AC:H/PR:N/UI:N`, versions 4.7 à 7.1.3).
- WordPress.org, « WordPress 7.1.4 » (2026-10-28) : https://wordpress.org/news/2026/10/wordpress-7-1-4 (version de sécurité, rétroportages en cours).
- Code source WordPress, dépôt `WordPress/wordpress-develop`, étiquettes `7.1.3` et `7.1.4` : fichiers `src/wp-admin/includes/class-wp-upgrader.php`, `update-core.php`, `class-core-upgrader.php` (inchangé) et `src/wp-admin/setup-config.php` (inchangé), lus via `raw.githubusercontent.com` (diff calculé localement par moi).
- Catalogue CISA KEV : https://www.cisa.gov/known-exploited-vulnerabilities-catalog (exploitation active, entrée du 2026-11-03).
- **Non lu :** l'article Wordfence cité par le catalogue (page sans contenu à la lecture) ; la page Trac de WordPress (limite de débit). Le scénario de la section 2.4 est ma déduction à partir du diff et de la description NVD ; aucun avis lu ne le décrit.
