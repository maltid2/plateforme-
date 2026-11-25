# Fiche — Sécurité de l'infrastructure : OpenSSH sur musl sans PAM, quand « pas de mot de passe » est accepté (CVE-2026-123158)

Piste : sécurité de l'infrastructure (rotation du jeudi, sujet = l'avis marquant de la semaine). Lecture + exercice : 25 à 30 minutes. Cette fiche explique le **mécanisme** à partir du **correctif réel** d'OpenSSH (diff entre 10.6p1 et 10.6p2) et des avis. Elle ne donne **aucune marche à suivre pour exploiter** la faille.

## 1. Pourquoi ce mécanisme

L'avis a été consigné mardi (échéance CISA : **aujourd'hui, 12 novembre**). Au-delà de l'avis, c'est une leçon d'infrastructure : **une comparaison de deux valeurs** qui paraissent indépendantes (ce qu'on calcule, ce qu'on a stocké) peut devenir vraie **par accident** quand les deux sont des valeurs d'**échec**. Ce schéma réapparaît partout : jeton vide contre jeton vide, hachage d'erreur contre champ « verrouillé », `NULL` contre `NULL`.

Question de diagnostic à retenir : **« quand cette vérification échoue, que renvoie-t-elle, et qu'est-ce qu'on compare ensuite ? »**

## 2. Le mécanisme, pas à pas

### 2.1 Les faits (avis lus le 2026-11-10 et le 2026-11-12)
- **NVD** : « sshd in OpenSSH before 10.6p2 on Linux, when musl libc is used without PAM, lacks a workaround for a password authentication bypass (related to misinterpretation of whether a string is intended to be a password hash). For some configurations of accounts, any password between 256 and 1024 characters succeeds. An example of a platform using musl libc without PAM is Alpine Linux. » CVSS 3.1 de 8,1, `AV:N/AC:H`.
- **Notes de version OpenSSH 10.6p2 (2026-11-05)** : « sshd(8) : avoid password authentication bypass that is exploitable through sshd(8) that affects some Linux systems when built and run with PAM support disabled. **We consider the root cause of this bug to be outside sshd**, but it is exploitable via sshd and can be avoided there. »
- **Avis Alpine (2026-11-05)** : conditions : sshd sans PAM ; `PasswordAuthentication yes` ; un compte dont le champ de mot de passe vaut `*` ; au moins un autre compte avec un hachage `$5$` ou `$6$` ; mot de passe envoyé de 257 à 1024 octets.

Deux idées à tenir ensemble : **(1)** la cause racine est jugée **hors d'OpenSSH** (dans le comportement d'une fonction de bibliothèque, ici la fonction de hachage de mots de passe de la bibliothèque C) ; **(2)** OpenSSH **ajoute malgré tout une protection** (« workaround ») : il se défend contre ce comportement.

### 2.2 Le code qui accepte ou refuse (OpenSSH 10.6p2, `auth-passwd.c`, lu le 2026-11-12)
Version corrigée de la fonction `sys_auth_passwd` (extrait authentique, commenté) :
```c
/* Just use the supplied fake password if authctxt is invalid */
char *pw_password = authctxt->valid ? shadow_pw(pw) : xstrdup(pw->pw_passwd);
...
/* Check for users with no password. */
if (strcmp(pw_password, "") == 0 && strcmp(password, "") == 0) { ... return 1; }

/* Encrypt the candidate password using the proper salt, or pass a
 * NULL and let xcrypt pick one. */
if (authctxt->valid && pw_password[0] && pw_password[1])
	salt = pw_password;
encrypted_password = xcrypt(password, salt);

/* Authentication is accepted if the encrypted passwords are identical. */
ret = encrypted_password != NULL &&
    strlen(pw_password) >= MIN_PASSWORD_HASH_LEN &&      /* <- AJOUT de 10.6p2 */
    strcmp(encrypted_password, pw_password) == 0;
```
et, en tête de fichier, `#define MIN_PASSWORD_HASH_LEN 4` (ajout) à côté de `#define MAX_PASSWORD_LEN 1024` (existant) ; `auth_password()` rejette déjà un mot de passe plus long que 1024 (`if (strlen(password) > MAX_PASSWORD_LEN)`).

### 2.3 Lecture, ligne par ligne
1. `pw_password` : la valeur **stockée** pour le compte (le champ de mot de passe du fichier des mots de passe masqués).
2. Un compte « sans mot de passe » (clé seule) a, dans le fichier, un champ `*` : **un seul caractère**. Ce n'est pas un hachage, c'est un **marqueur** « pas de mot de passe valide ».
3. `salt` : si le champ stocké fait **au moins deux caractères**, il sert de sel (le début d'un vrai hachage contient le sel). Si le champ fait **moins de deux caractères** (comme `*`), `salt` reste `NULL`, et le commentaire dit « laisser `xcrypt` en choisir un ».
4. `encrypted_password = xcrypt(password, salt)` : on **calcule** le hachage du mot de passe fourni.
5. La décision : `strcmp(encrypted_password, pw_password) == 0` : **les deux chaînes sont identiques**.
6. **L'ajout de 10.6p2** : on exige aussi `strlen(pw_password) >= 4`. Un vrai hachage fait bien plus de 4 caractères ; un marqueur comme `*` en fait 1.

### 2.4 Reconstitution (de ma part : **déduction**, pas affirmation de l'éditeur)
Ce que le diff **prouve** : OpenSSH ne se contente plus de comparer deux chaînes ; il refuse d'accepter une comparaison **dont la valeur stockée est trop courte pour être un hachage**. Si cette garde était nécessaire, c'est que dans certaines conditions **la valeur calculée par `xcrypt` pouvait être égale à un champ stocké très court comme `*`**.
Ce que j'en **déduis** : pour un mot de passe très long, la fonction de hachage de la bibliothèque C (musl, sans PAM) **échoue** et renvoie une **valeur d'échec** ; si cette valeur d'échec est justement `*`, elle **ressemble** au champ stocké d'un compte sans mot de passe, et la comparaison devient « vraie ». Cela cadre avec : (a) la condition « compte à champ `*` » de l'avis Alpine ; (b) la borne haute de 1024 d'OpenSSH ; (c) la borne basse annoncée de 256 / 257 (limite de longueur de clé de la bibliothèque : **de ma mémoire, non relue**, donc **non vérifiée**).
Ce que je **ne sais pas** : pourquoi il faut, en plus, au moins un autre compte avec un hachage `$5$` ou `$6$` (condition de l'avis Alpine). Je n'ai pas lu le code de `xcrypt` ni celui de musl, et je ne l'invente pas.

### 2.5 Pourquoi musl et pas glibc ; pourquoi sans PAM
Les notes OpenSSH et NVD disent musl **sans PAM**. Avec PAM, c'est PAM qui vérifie le mot de passe : ce chemin de code n'est pas utilisé. Je n'ai **aucune source** disant que les distributions à glibc sont concernées, et je ne le prétends pas.

## 3. Lecture du réel

Extrait de l'avis Alpine (2026-11-05), à lire comme une **liste de conditions** :
- « You run the Alpine openssh-server package, which is built without PAM, or you run openssh-server-pam with UsePAM no. »
- « PasswordAuthentication is yes (the OpenSSH default, unless you changed it). »
- « The machine has an account whose password field is `*`. »
- « At least one local account has a `$5$` or `$6$` password hash. »
Chaque condition **retire** des cas : c'est ce qui rend une faille « 8,1, complexité élevée » (`AC:H`) mais **exploitée** (catalogue CISA). Contournements de l'avis : mise à jour **puis redémarrage de sshd**, ou `PasswordAuthentication no`. Premier réflexe de lecture d'un avis : **sépare les conditions, compte celles que tu remplis**.

## 4. Ce qui casse, symptôme, remontée

| Situation | Risque | Comment vérifier (équipement à toi / lab) |
|---|---|---|
| sshd sur Alpine (ou autre musl) sans PAM, mots de passe activés | Connexion acceptée sans mot de passe valide | Système, version d'OpenSSH, `PasswordAuthentication` effectif |
| Mise à jour du paquet sans redémarrage de sshd | Le démon en cours reste vulnérable | Date de démarrage du processus vs date du paquet |
| Compte à clé seule (`*`) à côté de comptes à mot de passe | Condition réunie | Lire les champs (sans afficher de hachage dans un ticket) |
| Conteneur avec sshd « pour débugger » | Faille oubliée dans une image | Inventaire des images |
| Journaux sshd : connexions par mot de passe sur un compte qui n'en a pas | Indice d'abus (**déduction**) | Journaux d'authentification |

**Piège de raisonnement :** « 8,1 avec complexité élevée, donc pas urgent ». Le score ne dit pas si un équipement **exposé** remplit les conditions, ni que la faille est **exploitée** : c'est l'**exploitation constatée** et l'**exposition** qui priorisent (fiches de la semaine d'Ivanti et de SonicWall).

## 5. Vocabulaire (FR / EN)

| FR | EN | Définition, piège |
|---|---|---|
| contournement d'authentification | *authentication bypass* | accès sans preuve valable ; **piège :** *bypass* (attaque) ≠ *workaround* (parade) |
| bibliothèque C | *C library (libc)* | **piège :** glibc ≠ musl : deux implémentations, comportements différents |
| fonction de hachage de mot de passe | *password hashing function (crypt)* | calcule l'empreinte stockée |
| sel | *salt* | valeur ajoutée avant hachage |
| champ de mot de passe | *password field* | colonne du fichier des mots de passe masqués ; `*` ou `!` = pas de mot de passe utilisable |
| compte verrouillé | *locked account* | champ commençant par `!` (avis Alpine) |
| marqueur / valeur sentinelle | *sentinel value* | valeur spéciale qui signifie « n'existe pas / invalide » |
| valeur d'échec | *failure value / error token* | ce que renvoie une fonction quand elle échoue |
| module d'authentification enfichable | *PAM (Pluggable Authentication Modules)* | |
| cause racine | *root cause* | **piège :** ici « hors d'OpenSSH » |
| correctif de contournement | *workaround (in the code)* | **piège :** dans le code = protection ajoutée ; dans un avis = parade temporaire |
| comparer deux chaînes | *string comparison (`strcmp`)* | égalité octet par octet |
| démon | *daemon* | `sshd` ; **piège :** mettre à jour le paquet ≠ redémarrer le démon |
| version portable | *portable release (`p1`, `p2`)* | le suffixe `p` désigne la version « portable » d'OpenSSH |
| faux ami : *exploit* | = exploiter (une faille) / outil d'exploitation | pas « exploit » sportif |

## 6. Comment le dire juste

**À un collègue (FR) :** « Le bug n'est pas dans le mot de passe : c'est que la fonction de hachage échoue sur un mot de passe très long, et que sa valeur d'échec peut être égale au champ `*` d'un compte sans mot de passe. OpenSSH 10.6p2 refuse maintenant de comparer quand le champ stocké est trop court pour être un hachage. »

**À un prestataire / éditeur (FR + EN) :**
- FR : « Pouvez-vous confirmer sur quel système tourne sshd, s'il utilise musl sans PAM, et si `PasswordAuthentication` est activé ? »
- EN: "Can you confirm which operating system sshd runs on, whether it uses musl without PAM, and whether `PasswordAuthentication` is enabled?"

**Dans un ticket (FR + EN) :**
- FR : « CVE-2026-123158 (OpenSSH < 10.6p2, musl sans PAM, exploitation active selon la CISA). Hôte : <nom>, système : <x>, OpenSSH : <version>, `PasswordAuthentication` : <valeur>. Action : mise à jour puis **redémarrage de sshd** ; à défaut, `PasswordAuthentication no`. Contrôle : journaux de connexions par mot de passe sur comptes à clé seule. »
- EN: "CVE-2026-123158 (OpenSSH < 10.6p2, musl without PAM, actively exploited per CISA). Host: <name>, OS: <x>, OpenSSH: <version>, `PasswordAuthentication`: <value>. Action: update, then **restart sshd**; otherwise `PasswordAuthentication no`. Check: password logins for key-only accounts in the logs."

## 7. Exercice d'observation (20 à 30 minutes, **lab uniquement**)

**Rappel :** uniquement sur **une machine de lab à toi** (VM, conteneur) : jamais sur un équipement de ton employeur ni de tiers. **Il ne s'agit pas de reproduire la faille.** Tu observes ce qu'un avis te demande de vérifier.

1. Sur une machine de lab qui fait tourner sshd (si tu n'en as pas, passe à l'étape 5 : tu n'as rien à observer, c'est un résultat), relève : le système, la version d'OpenSSH (`ssh -V`), et la valeur **effective** de `PasswordAuthentication` (`sshd -T`, lecture seule).
2. **Hypothèse à écrire d'abord :** « ma machine remplit-elle les quatre conditions de l'avis Alpine ? » Pour chacune, réponds oui / non / je ne sais pas.
3. Repère les comptes à clé seule (champ `*`) sans **jamais** copier un hachage dans une note ou un ticket.
4. Vérifie si le démon en cours est **plus ancien** que la dernière mise à jour du paquet.
5. Écris la phrase de ticket (§6) avec **tes** valeurs, ou « sshd non utilisé » si c'est le cas.

<details><summary>Solution</summary>

Pas de réponse unique. Critères : (a) tu sais dire sur quel système tourne sshd et s'il est musl (Alpine) ou glibc ; (b) tu connais `PasswordAuthentication` ; (c) tu ne conclus « concerné » que si **toutes** les conditions de l'avis sont réunies, et « non concerné » seulement quand tu as une source (par exemple `UsePAM yes`, ou `PasswordAuthentication no`) ; (d) tu n'as exposé aucun secret. Je n'ai pas exécuté cet exercice.
</details>

## 8. Révision espacée

**D'hier (fiche du 2026-11-11, SQL `GROUP BY` et `Extra`) :**
1. Que dit la doc de `Using temporary` ?
2. Quelle différence entre `Using index` et `Using index for group-by` ?
3. Pourquoi « `Using filesort` donc tri sur le disque » est-il un raccourci ?

**D'il y a 7 jours (fiche du 2026-11-05, WordPress, TOCTOU) :**
1. Qu'est-ce qu'un TOCTOU ?
2. Cite deux des trois changements du correctif WordPress 7.1.4.
3. Pourquoi une liste d'exclusion est-elle moins robuste qu'une liste d'inclusion ?

<details><summary>Réponses</summary>

D'hier : (1) Une table temporaire est créée pour contenir le résultat ; typiquement avec `GROUP BY`, `DISTINCT` ou `ORDER BY`. (2) Le premier lit tout l'index ; le second résout le regroupement dans l'index en sautant les doublons. (3) Le nom est historique ; l'emplacement du tri dépend de la taille.
Du 5 : (1) L'état change entre la vérification et l'usage. (2) Nom du dossier de travail aléatoire ; `index.php` contre le listage ; `wp-config.php` jamais recopié. (3) On doit penser à tout ce qui est dangereux ; l'inclusion ne laisse passer que le prévu.
</details>

## 9. Trois questions de contrôle

1. Que prouve l'ajout `strlen(pw_password) >= MIN_PASSWORD_HASH_LEN` dans le diff, et que ne prouve-t-il pas ?
2. Pourquoi mettre à jour le paquet OpenSSH ne suffit-il pas ?
3. Pourquoi ne peut-on pas conclure que les systèmes à glibc sont concernés ?

<details><summary>Réponses</summary>

1. Il prouve qu'OpenSSH refuse d'accepter une comparaison dont la valeur stockée est trop courte pour être un hachage ; il ne prouve pas à lui seul le détail du comportement de la bibliothèque C (déduction). 2. Le démon en cours continue de tourner avec l'ancien code : il faut redémarrer sshd. 3. NVD, les notes OpenSSH et l'avis Alpine ne parlent que de musl sans PAM ; aucune source lue n'étend le périmètre.
</details>

## 10. Sources (consultées le 2026-11-10 et le 2026-11-12)

- NVD, CVE-2026-123158 : https://nvd.nist.gov/vuln/detail/CVE-2026-123158 (description, score, plages).
- Notes de version OpenSSH 10.6p2 : https://www.openssh.com/releasenotes.html (section « Security », cause racine hors de sshd).
- Avis Alpine du 2026-11-05 : https://alpinelinux.org/posts/2026-11-05-openssh-password-authentication-bypass/ (conditions, contournement, versions corrigées).
- Code source OpenSSH portable, étiquettes `V_10_6_P1` et `V_10_6_P2`, fichier `auth-passwd.c`, lu via `raw.githubusercontent.com` ; diff calculé localement par moi. Le fichier `auth.c`, `auth2-passwd.c`, `sshd-auth.c` et `auth-shadow.c` sont **identiques** entre les deux versions.
- Catalogue CISA KEV (échéance 2026-11-12).
- **Non lu :** le code de `xcrypt` (OpenSSH) et de la fonction de hachage de musl ; le dépôt GitHub du commit (accès refusé dans cette session) ; les pages tierces citées par NVD (dont une page de suivi GreyNoise). **De ma mémoire, non vérifié :** la limite de 256 caractères de musl. Le scénario du §2.4 est une déduction.
