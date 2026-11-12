# Fiche — Un enchaînement de failles : de l'exécution de code PHP à « root » en passant par le noyau Linux

Piste : sécurité de l'infrastructure (rotation du jeudi). Sujet pris sur l'avis marquant de la semaine : le catalogue CISA signale le 28 octobre 2026 que la faille du noyau Linux **CVE-2026-46300** « peut être enchaînée avec CVE-2026-109618 et CVE-2026-109619 [les failles PHP du 26 octobre] pour implanter des *webshells* PHP et exécuter des commandes en tant que root ». Lecture : 25 à 30 minutes. Mécanisme et vocabulaire, pas de manipulation sur un équipement réel.

## 1. Pourquoi ce mécanisme, et ce qu'il change dans ton diagnostic

Un avis de sécurité est souvent lu isolément : « PHP, exécution de code à distance », « noyau, gravité 7,8 ». Un attaquant, lui, **enchaîne**. Le premier maillon lui donne un pied dans la place avec peu de droits ; le second lui donne tous les droits. Pour toi, cela change deux réflexes : (1) ne pas classer une faille « locale » comme sans importance sur un serveur qui exécute aussi du code exposé ; (2) quand un compte de service (celui du serveur web, de PHP-FPM) est compromis, la question n'est plus « que peut-il faire ? » mais « **que peut-il faire ensuite, sur cette machine ?** ». Ton lab WordPress (Nginx, PHP-FPM, MariaDB sous Docker) est précisément ce type de pile.

## 2. Le mécanisme, étape par étape

### 2.1 Premier maillon : exécuter du code avec peu de droits
Les failles PHP CVE-2026-109618 et CVE-2026-109619 (entrées du 27 octobre dans `veille.md`) permettent, d'après le catalogue CISA, une **exécution de code à distance non authentifiée**. Le code s'exécute avec les droits du processus PHP : un compte de service **peu privilégié**. C'est un « pied dans la place » (*foothold*), pas encore le contrôle de la machine.

### 2.2 Second maillon : l'élévation de privilèges locale
CVE-2026-46300 est une faille **locale** : le score de la base NVD est de **7,8 (High)** avec le vecteur `CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H`, que la spécification FIRST permet de lire ainsi :

| Élément | Sens (spécification CVSS 3.1) |
|---|---|
| `AV:L` | vecteur d'attaque local : il faut un accès sur la machine (« read/write/execute capabilities ») |
| `AC:L` | complexité faible : pas de condition particulière |
| `PR:L` | privilèges requis faibles : des droits d'utilisateur basique suffisent |
| `UI:N` | aucune interaction d'un utilisateur |
| `S:U` | périmètre inchangé |
| `C:H / I:H / A:H` | perte totale de confidentialité, d'intégrité, de disponibilité |

Le score à lui seul dit « local, donc moins grave ». L'enchaînement montre le contraire : le premier maillon **fournit exactement** ce qu'exige `AV:L/PR:L`.

### 2.3 Ce qui se passe dans le noyau (d'après le texte du correctif lu dans NVD)
Vocabulaire minimal, définitions de la documentation du noyau :
- Un `sk_buff` (*socket buffer*) est « the main networking structure representing a packet » : il ne contient que des **métadonnées** ; les données sont dans des tampons associés.
- Ces données peuvent être décrites par des **fragments de pages** (*page frags*) : des pointeurs au format (page, décalage, longueur) vers de la mémoire. Plusieurs paquets peuvent pointer vers les **mêmes** données (clones, références).
- Le **cache de pages** (*page cache*) est la mémoire où le noyau garde le contenu des fichiers lus : « Whenever a file is read, the data is put into the page cache to avoid expensive disk access on the subsequent reads ».

Le texte du correctif décrit ensuite l'enchaînement exact :
1. Un fragment peut être **partagé**, c'est-à-dire qu'il appartient à quelqu'un d'autre ou qu'il est adossé au cache de pages d'un fichier. Le noyau le signale par un **marqueur** (`SKBFL_SHARED_FRAG`).
2. Règle (« invariant ») sur laquelle comptent les codes qui **écrivent sur place** : si le marqueur est présent, il faut **d'abord copier** les données avant de les modifier (étape de « copie à l'écriture », *skb_cow_data* dans le texte).
3. La fonction `skb_try_coalesce()` **fusionne** des tampons (utilisée par la réception TCP) en déplaçant des fragments de l'un vers l'autre. Elle **perdait le marqueur** : le tampon résultat contenait les mêmes fragments partagés, mais ne le disait plus.
4. Le traitement d'entrée **ESP** (IPsec, chiffrement de paquets) regarde ce marqueur pour décider s'il peut **sauter la copie** et déchiffrer **sur place**. Ne le voyant plus, il déchiffre « in place over page-cache backed frags » : il **écrit dans des pages qui sont aussi le contenu d'un fichier en cache**.
5. Conséquence résumée par le catalogue CISA : « unintended modification of page-cache-backed data ». Les processus qui lisent ce fichier lisent alors le contenu **altéré**.
6. Correctif : « Propagate SKBFL_SHARED_FRAG when skb_try_coalesce() transfers paged frags », c'est-à-dire recopier le marqueur lors du transfert.

La leçon générale : une règle de sécurité (« on ne modifie pas sur place des données partagées ») ne tient que si **chaque** code qui déplace les données **préserve** l'information qui la protège. Ici, un code d'optimisation du réseau a perdu cette information, et un autre code, plus loin, a fait confiance à son absence.

Je ne détaille pas comment un attaquant provoque cette séquence et je ne l'ai pas reproduite. Ce que le catalogue CISA affirme, tel quel : l'enchaînement avec les failles PHP permet d'« implanter des webshells PHP » et d'« exécuter des commandes en tant que root ».

### 2.4 Ce que ça veut dire pour une machine « conteneurisée »
De mémoire, non relue aujourd'hui dans une source : les conteneurs partagent le **noyau de l'hôte**. Une faille du noyau n'est donc pas arrêtée par la frontière du conteneur en principe ; reste à savoir si **celle-ci** est exploitable depuis un conteneur avec ses privilèges réduits, ce que je n'ai pas pu établir.

## 3. La lecture du réel

Entrée authentique du catalogue CISA des vulnérabilités exploitées (version publiée le 2026-10-28), commentée champ par champ :

```
cveID                        CVE-2026-46300
vendorProject / product      Linux / Kernel
dateAdded / dueDate          2026-10-28 / 2026-10-31
knownRansomwareCampaignUse   Unknown
forensicTriage               Yes
cwes                         CWE-456
shortDescription             Linux Kernel contains a missing initialization of a variable vulnerability that could allow
                             for unintended modification of page-cache-backed data via failure to preserve the
                             shared-fragment marker during socket buffer coalescing, causing ESP input processing to
                             decrypt shared fragments in place. This vulnerability can be chained with CVE-2026-109618
                             and CVE-2026-109619 to implant PHP webshells and run commands as root.
```

| Champ | Lecture |
|---|---|
| `dateAdded` | le jour où la CISA a reconnu l'exploitation active |
| `dueDate` | échéance de correction fixée aux **agences fédérales américaines** (3 jours ici) ; pour toi, c'est une indication d'urgence, pas une obligation |
| `knownRansomwareCampaignUse` : Unknown | pas d'information sur un usage par des rançongiciels |
| `forensicTriage` : Yes | la CISA demande une **analyse de compromission** (un « triage forensique ») en plus du correctif : il faut chercher si la machine est **déjà** compromise |
| `cwes` : CWE-456 | « Missing Initialization of a Variable » : une valeur n'a pas été (re)positionnée, ici le marqueur |
| `shortDescription` (dernière phrase) | l'enchaînement avec les deux CVE PHP |

Dans la base NVD (consultée le 2026-10-29, statut « Undergoing Analysis » : l'analyse n'est pas terminée), la liste des versions du noyau **concernées** par branche stable est : de 3.9 à 5.10.257 inclus ; de 5.11 jusqu'**avant** 5.15.208 ; de 5.16 avant 6.1.174 ; de 6.2 avant 6.6.141 ; de 6.7 avant 6.12.91 ; de 6.13 avant 6.18.33 ; de 6.19 avant 7.0.10. **Attention** : les distributions (Debian, Ubuntu, Red Hat, SUSE) corrigent souvent par rétroportage **sans changer le numéro de version amont** : le numéro `uname -r` ne suffit pas, il faut l'avis de **ta** distribution (que je n'ai pas lu).

## 4. Ce qui casse, et le symptôme

| Situation | Symptôme sur le terrain | Comment remonter à la cause |
|---|---|---|
| Un service exposé tourne avec des droits trop larges | un compromis du service donne quasiment le contrôle de la machine | quel utilisateur exécute PHP-FPM ou le serveur web ? Quels fichiers peut-il écrire ? |
| Fichiers PHP inattendus dans l'arborescence web | *webshell* (une porte dérobée écrite en PHP) | liste des fichiers récemment créés ou modifiés dans les dossiers de publication |
| Processus fils inattendus d'un processus PHP | un service web qui lance un interpréteur de commandes | arborescence des processus et journaux d'audit |
| Contenu d'un fichier différent en mémoire et sur disque | l'altération a été faite dans le **cache** sans passer par un écrit normal | comparer le contenu lu et une copie de confiance (hypothèse, non vérifiée ici) |
| Noyau mis à jour mais machine non redémarrée | la faille est toujours exploitable | version du noyau **en cours d'exécution**, pas seulement installée (de mémoire) |
| Correctif PHP appliqué mais pas le noyau (ou l'inverse) | la chaîne reste à moitié ouverte | traiter **les deux** ; l'ordre dépend de l'exposition |

## 5. Vocabulaire du jour (14 termes)

| Français | Anglais | Définition exacte / piège |
|---|---|---|
| enchaînement de failles | *exploit chain / vulnerability chaining* | utiliser plusieurs failles en série ; chacune seule paraît moins grave |
| exécution de code à distance | *remote code execution (RCE)* | faire exécuter du code sur une machine par le réseau |
| élévation de privilèges locale | *local privilege escalation (LPE)* | passer de peu de droits à beaucoup, depuis la machine |
| pied dans la place | *foothold* | premier accès, même limité, sur une machine |
| porte dérobée web | *webshell* | script déposé sur un serveur web qui exécute des commandes envoyées à distance |
| cache de pages | *page cache* | mémoire où le noyau garde le contenu des fichiers lus |
| tampon de socket | *socket buffer (sk_buff)* | structure du noyau décrivant un paquet réseau |
| fragment de page | *page frag* | pointeur (page, décalage, longueur) vers des données d'un paquet |
| copie à l'écriture | *copy-on-write (COW)* | copier des données partagées avant de les modifier |
| en place | *in place* | écrire directement sur les données d'origine, sans copie |
| invariant | *invariant* | règle qui doit rester vraie à chaque étape du code |
| rétroportage | *backport* | report d'un correctif sur une version plus ancienne |
| défense en profondeur | *defense in depth* | plusieurs barrières successives : un maillon qui cède ne suffit pas |
| moindre privilège | *least privilege* | ne donner que les droits nécessaires |

Faux amis et approximations : « root » est le compte administrateur Unix, pas un « répertoire racine » ; « local » dans un score CVSS ne veut pas dire « inoffensif » ; « le noyau est à jour » doit préciser **installé** ou **en cours d'exécution**.

## 6. Comment le dire juste

**Pour un collègue :** « Les failles PHP donnent un accès avec peu de droits, et la faille du noyau le transforme en root : sur nos serveurs PHP exposés, on traite les deux ensemble, et on cherche si un webshell est déjà présent. »

**Pour un prestataire ou un éditeur** (FR puis EN) :
- FR : « Pouvez-vous confirmer si le noyau de votre distribution contient le correctif de CVE-2026-46300 (rétroporté ou non), et à partir de quelle version de paquet ? »
- EN: "Could you confirm whether your distribution's kernel includes the fix for CVE-2026-46300 (backported or not), and from which package version?"

**Dans un ticket** (FR puis EN) :
- FR : « Risque : enchaînement CVE-2026-109618/109619 (PHP, exécution de code à distance) puis CVE-2026-46300 (noyau, élévation locale) : exploitation active (catalogue CISA). Actions : mettre à jour PHP et le noyau, redémarrer, rechercher des fichiers PHP récents et des processus fils inattendus. »
- EN: "Risk: chain of CVE-2026-109618/109619 (PHP remote code execution) then CVE-2026-46300 (kernel local privilege escalation): actively exploited (CISA catalog). Actions: update PHP and the kernel, reboot, look for recently created PHP files and unexpected child processes."

## 7. Exercice de diagnostic (20 à 30 minutes, **sur papier ou dans ton laboratoire**, jamais sur des machines de l'employeur)

Quatre machines **inventées par MINERVE** (inventaire fictif) ; les bornes sont celles du §3 (numéros amont, sans rétroportage) et celles de l'entrée PHP du 27 octobre (corrigé : 8.2.35, 8.3.36, 8.4.27, 8.5.12) :

| | Noyau | PHP | Exposition |
|---|---|---|---|
| A | 6.1.170 | 8.2.34 | Internet |
| B | 6.12.95 | 8.3.36 | réseau interne |
| C | 6.6.141 | 8.2.34 | Internet |
| D | 5.15.210 | aucun | Internet (Nginx seul) |

1. Pour chaque machine, la chaîne complète est-elle possible ? Classe A, B, C, D par priorité de traitement.
2. Pour A, quelle est la **première** vérification, et quelle est la deuxième ?
3. Dans **ton** lab, observe la version de PHP réellement présente dans ton conteneur PHP-FPM (par exemple avec `docker compose exec php php -v`) et compare-la à 8.2.35. Je n'ai pas lancé ta commande : note ce que tu obtiens.

<details>
<summary>Solution</summary>

1. A : noyau avant 6.1.174 (concerné) et PHP avant 8.2.35 (concerné), exposée à Internet : chaîne possible, **priorité 1**. C : noyau 6.6.141 est **à la borne** « avant 6.6.141 » (donc non concerné d'après NVD) mais PHP 8.2.34 est concerné et exposée : le premier maillon existe, le second peut manquer ; **priorité 2** (à confirmer avec l'avis de la distribution). B : noyau 6.12.95 (au-delà de 6.12.91) et PHP 8.3.36 corrigé ; interne : **priorité 4**. D : pas de PHP, donc pas ce premier maillon ; son noyau 5.15.210 est au-delà de 5.15.208 : **priorité 3 ou moins** (d'autres failles peuvent la concerner, cette fiche ne les couvre pas).
2. Première vérification : l'avis de **la distribution** (le numéro amont ne suffit pas, rétroportages) ; deuxième : l'exposition de PHP et l'utilisateur qui l'exécute. Puis la recherche d'un compromis déjà présent (fichiers PHP récents, processus fils inattendus), car la CISA demande aussi un triage forensique.
3. Si la version est inférieure à 8.2.35 (ou si l'image a été téléchargée avant la publication du correctif), mets l'image à jour dans ton lab avant de l'exposer. Le suffixe d'étiquette `8.2` désigne une branche, pas une version précise.
</details>

## 8. Révision espacée

Fiche de la veille (2026-10-28, SQL). Il n'existe pas de fiche vieille de sept jours ; je reprends donc des questions des fiches des jours précédents.

1. (SQL) Que signifient `type` = `ALL` et `key` = `NULL` dans un plan `EXPLAIN` ?
2. (Kerberos) Où cherches-tu un mauvais mot de passe : 4768 ou 4771 ?
3. (Commutateur) Que fait un commutateur d'une trame dont l'adresse destination est inconnue ?

<details>
<summary>Réponses</summary>

1. Balayage complet de la table : aucun index n'est utilisé.
2. Dans 4771 (code `0x18`).
3. Il l'inonde sur tous les ports du VLAN sauf celui d'arrivée, puis apprend l'adresse source du répondant.
</details>

## 9. Trois questions de contrôle

1. Pourquoi un score « local » (`AV:L`) peut-il quand même être critique sur un serveur web ?
2. Que veut dire « le marqueur de fragments partagés est perdu » dans cette faille, et quelle règle de sécurité cela casse-t-il ?
3. Pourquoi le numéro de version du noyau ne suffit-il pas à dire si une machine est corrigée ?

<details>
<summary>Réponses</summary>

1. Parce qu'un premier maillon (exécution de code à distance dans un service) fournit l'accès local peu privilégié que la faille exige, et la seconde donne alors root.
2. Le noyau fusionne deux tampons mais oublie d'indiquer que des fragments sont partagés (adossés au cache d'un fichier) ; le code de déchiffrement ESP se croit donc autorisé à écrire sur place au lieu de copier d'abord, et modifie des données partagées.
3. Parce que les distributions rétroportent les correctifs dans des numéros de version amont plus anciens : il faut lire l'avis de la distribution.
</details>

## 10. Sources (consultées le 2026-10-29)

- Catalogue CISA des vulnérabilités exploitées (version publiée le 2026-10-28) : https://www.cisa.gov/known-exploited-vulnerabilities-catalog — entrée CVE-2026-46300, avec l'enchaînement annoncé.
- NVD, CVE-2026-46300 (API, statut « Undergoing Analysis ») : https://nvd.nist.gov/vuln/detail/CVE-2026-46300 — texte du correctif, score 7,8, vecteur, versions par branche stable.
- FIRST, spécification CVSS 3.1 : https://www.first.org/cvss/v3.1/specification-document — définitions des métriques et échelle de gravité.
- Documentation du noyau Linux, réseau (`sk_buff`) : https://docs.kernel.org/networking/skbuff.html ; gestion de la mémoire (cache de pages) : https://docs.kernel.org/admin-guide/mm/concepts.html. Les pages ne décrivent pas la copie à l'écriture (`skb_cow_data`) : ce point vient du texte du correctif NVD.
- Failles PHP : voir l'entrée du 27 octobre de `veille.md` (catalogue CISA et alerte CERT-FR CERTFR-2026-ALE-014).
- Non vérifié aujourd'hui (de mémoire) : partage du noyau par les conteneurs ; nécessité de redémarrer après une mise à jour du noyau ; l'idée qu'une altération du cache ne soit pas visible par une vérification du fichier sur disque ; la manière précise dont l'attaquant déclenche la séquence (non décrite ici).
