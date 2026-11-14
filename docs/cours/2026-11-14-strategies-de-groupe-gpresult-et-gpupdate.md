# Fiche — Poste de travail : quand une stratégie de groupe s'applique, et ce que disent `gpresult` et `gpupdate`

Piste : poste de travail et support (rotation du samedi). Lecture + exercice : 25 à 30 minutes. Pas de tutoriel. Tu connais déjà les stratégies de groupe (GPO) ; cette fiche explique **pourquoi un réglage « n'est pas appliqué »** sur un poste alors que la GPO existe, et ce que montrent exactement les deux commandes de diagnostic. Elle prolonge la fiche du 10 novembre : pour appliquer une GPO, le poste doit d'abord **trouver un contrôleur de domaine**.

## 1. Pourquoi ce mécanisme

« Le réglage n'est pas pris », « ça marche sur le poste du voisin », « il a fallu redémarrer ». Entre la GPO écrite sur le serveur et l'effet sur le poste, il y a **trois questions** : (1) cette GPO **s'applique-t-elle à cet utilisateur / cet ordinateur** (portée) ? (2) le poste l'a-t-il **déjà traitée** (moment) ? (3) le réglage est-il de ceux qui **nécessitent une ouverture de session ou un redémarrage** (type d'extension) ? `gpresult` répond à (1), `gpupdate` agit sur (2) et (3).

## 2. Le mécanisme, pas à pas

*(Source : pages Microsoft Learn `gpresult` et `gpupdate`, lues le 2026-11-14 ; elles s'appliquent à Windows 10/11 et Windows Server 2016 à 2025 d'après leur en-tête.)*

### 2.1 La portée : qui reçoit quoi
D'après la page `gpresult` : « Dans un environnement Active Directory, la stratégie de groupe est appliquée aux utilisateurs ou aux ordinateurs **en fonction de leur appartenance à des sites, des domaines et des unités d'organisation (OU)**. » Et : comme des réglages peuvent se **chevaucher**, la fonction produit un **jeu de stratégies résultant** (*Resultant Set of Policy*, RSoP) **à l'ouverture de session**. `gpresult` « affiche le jeu résultant des réglages appliqués sur l'ordinateur pour l'utilisateur indiqué quand il s'est connecté ».

Deux conséquences à retenir :
- La stratégie d'**ordinateur** et la stratégie d'**utilisateur** sont **deux jeux distincts** (option `/scope {user | computer}`) ; un réglage peut être au mauvais endroit (une GPO « utilisateur » liée à une OU qui contient des ordinateurs ne fera rien).
- Le résultat dépend de **l'utilisateur qui s'est connecté** : deux personnes sur le même poste peuvent avoir deux jeux de stratégies utilisateur différents.

### 2.2 Le moment : quand le poste traite les stratégies
La page `gpupdate` distingue :
- la **stratégie de premier plan** (*foreground*), appliquée **au démarrage de l'ordinateur et à l'ouverture de session de l'utilisateur** ;
- le **cycle de mise à jour en arrière-plan** (*background update cycle*), qui retraite certaines extensions pendant que le poste tourne.
Par défaut, `gpupdate` n'applique que ce qui a **changé** ; `/force` « réapplique **tous** les réglages ».
(La fréquence exacte du cycle en arrière-plan, la règle d'ordre d'application site → domaine → OU et le décalage aléatoire sont de **ma mémoire**, **non relus** aujourd'hui : je ne te donne pas de durées.)

### 2.3 Le type de réglage : ceux qui exigent une déconnexion ou un redémarrage
La page `gpupdate` explique : certaines **extensions côté client** ne traitent pas la stratégie en arrière-plan.
- `/logoff` : provoque une **déconnexion** après la mise à jour. « Requis pour les extensions qui ne traitent pas la stratégie dans le cycle d'arrière-plan mais **à l'ouverture de session**. Exemples : **installation de logiciels ciblée utilisateur** et **redirection de dossiers**. » Sans effet si aucune extension n'en a besoin.
- `/boot` : provoque un **redémarrage**. « Requis pour les extensions qui traitent la stratégie **au démarrage** de l'ordinateur. Exemple : **installation de logiciels ciblée ordinateur**. »
- `/sync` : « fait que la prochaine application de premier plan se fasse **de manière synchrone** » (au démarrage ou à l'ouverture de session), pour l'utilisateur, l'ordinateur ou les deux.
- `/wait:<valeur>` : nombre de secondes d'attente de la fin du traitement avant de rendre la main ; **défaut 600 secondes** ; `0` = ne pas attendre ; `-1` = attendre indéfiniment. Quand la limite est dépassée, l'invite revient mais **le traitement continue**.
- `/target:{computer | user}` : ne mettre à jour que l'ordinateur ou que l'utilisateur ; par défaut, les deux.

## 3. Lecture du réel

Syntaxe authentique de `gpresult` (page Microsoft) :
```
gpresult [/s <system> [/u <username> [/p [<password>]]]] [/user [<targetdomain>\]<targetuser>]
         [/scope {user | computer}] {/r | /v | /z | [/x | /h] <filename> [/f] | /?}
```
Remarque de la page : « sauf avec `/?`, vous **devez** inclure une option de sortie : `/r`, `/v`, `/z`, `/x` ou `/h` ». Lecture :
- `/r` : **résumé** du jeu de stratégies résultant.
- `/v` : informations **détaillées**, y compris les réglages appliqués avec une **priorité de 1**.
- `/z` : **toutes** les informations disponibles (priorité 1 **et au-delà**) ; la page conseille de **rediriger vers un fichier** (par exemple `gpresult /z > policy.txt`) parce que `/v` et `/z` produisent beaucoup de texte.
- `/h <fichier>` ou `/x <fichier>` : rapport **HTML** ou **XML** ; ces deux options **ne peuvent pas** être combinées avec `/u`, `/p`, `/r`, `/v`, `/z`. `/f` force l'écrasement du fichier.
- `/s <système>` : ordinateur **distant** (nom ou adresse IP, sans barre oblique inverse) ; `/user` : utilisateur distant. La page précise qu'un rapport RSoP sur un ordinateur distant « à travers le pare-feu » exige des **règles de pare-feu** autorisant le trafic entrant sur les ports concernés.
- Exemple authentique de la page : `gpresult /s srvmain /user maindom\targetuser /scope user /r`.

Que cherches-tu dans la sortie ? (ce que dit la page : « les réglages appliqués ») : quelles **GPO** sont appliquées, lesquelles sont **filtrées** ou **refusées**, et **où elles sont liées**. Le détail du vocabulaire des sections d'un rapport (par exemple « Applied GPOs », « Denied GPOs ») est de **ma mémoire**, **non relu**.

## 4. Ce qui casse, symptôme, remontée

| Symptôme | Cause plausible | Remontée |
|---|---|---|
| Un réglage « utilisateur » n'a aucun effet | GPO utilisateur liée à une OU d'ordinateurs (ou l'inverse) | `gpresult /scope user /r` puis `/scope computer /r` |
| Marche sur un poste, pas sur un autre | Les deux machines ne sont pas dans la même OU / même site | `gpresult /r` sur chacune, comparer les GPO appliquées |
| « Le réglage n'est pris qu'après redémarrage » | Extension qui n'agit qu'au démarrage ou à l'ouverture de session | `gpupdate /boot` ou `/logoff` (page `gpupdate`) |
| `gpupdate` n'applique « rien » | Par défaut seuls les réglages **modifiés** sont appliqués | `gpupdate /force` pour tout réappliquer |
| `gpresult` donne des données d'un autre utilisateur | Résultat lié à la dernière session **de cet utilisateur** | Préciser `/user` ; lire la page |
| Le poste ne récupère aucune stratégie | Poste qui ne trouve pas de contrôleur (DNS) | Fiche du 10 novembre : SRV `_ldap._tcp.dc._msdcs.<domaine>` |
| Rapport distant refusé | Pare-feu bloquant les ports entrants | Règles de pare-feu (page `gpresult`) |

**Piège de raisonnement :** `gpupdate /force` n'est **pas** un outil de diagnostic : il **change l'état** (il réapplique tout). Pour **observer**, utilise `gpresult`. Et « forcer » ne règle ni une mauvaise portée ni un contrôleur introuvable.

## 5. Vocabulaire (FR / EN)

| FR | EN | Définition, piège |
|---|---|---|
| stratégie de groupe | *Group Policy (GPO = Group Policy Object)* | **Piège :** *GPO* désigne l'objet, *Group Policy* l'ensemble de la fonction |
| jeu de stratégies résultant | *Resultant Set of Policy (RSoP)* | ce qui est réellement appliqué après chevauchement |
| unité d'organisation | *organizational unit (OU)* | conteneur AD ; **piège :** ≠ « groupe » de sécurité |
| portée | *scope* | ici : utilisateur ou ordinateur |
| application de premier plan | *foreground processing* | au démarrage / à l'ouverture de session |
| mise à jour en arrière-plan | *background refresh* | pendant que le poste tourne |
| extension côté client | *client-side extension (CSE)* | module qui traite un type de réglage |
| redirection de dossiers | *folder redirection* | exemple d'extension traitée à l'ouverture de session |
| installation de logiciels | *software installation* | utilisateur ou ordinateur ; exige déconnexion / redémarrage |
| forcer | *to force (`/force`)* | réappliquer tout, pas seulement les changements |
| application synchrone | *synchronous processing* | le démarrage / l'ouverture attend la fin |
| rapport | *report (HTML / XML)* | sortie de `gpresult /h` ou `/x` |
| priorité | *precedence* | ordre de gagnant en cas de conflit |
| filtrer / refuser | *filter / deny* | une GPO existe mais ne s'applique pas à cet objet |
| faux ami : *policy* | = stratégie / politique | pas « police » |

## 6. Comment le dire juste

**À un collègue (FR) :** « Le réglage n'est pas appliqué parce que la GPO est une GPO utilisateur liée à l'OU des ordinateurs. `gpresult /scope user /r` ne la liste pas. Pas besoin de `/force`. »

**À un prestataire / éditeur (FR + EN) :**
- FR : « Pouvez-vous confirmer si cette extension côté client traite la stratégie à l'ouverture de session ou au démarrage ? Nous constatons que le réglage n'est effectif qu'après redémarrage. »
- EN: "Can you confirm whether this client-side extension processes policy at user logon or at computer startup? We see the setting only takes effect after a reboot."

**Dans un ticket (FR + EN) :**
- FR : « Poste PC-12, utilisateur `u1`. Réglage X non appliqué. `gpresult /scope user /r` : GPO "G-X" absente de la liste. Cause probable : GPO liée à une OU qui ne contient pas l'utilisateur. Action : vérifier le lien ; relever à nouveau `gpresult` après correction et ouverture de session. »
- EN: "Workstation PC-12, user `u1`. Setting X not applied. `gpresult /scope user /r`: GPO 'G-X' missing from the list. Probable cause: GPO linked to an OU that does not contain the user. Action: check the link; re-run `gpresult` after the fix and a new logon."
*(Noms de ces phrases : illustrations de format, pas des mesures.)*

## 7. Exercice d'observation (20 à 30 minutes, **lab uniquement**)

**Rappel :** uniquement ta VM Windows Server 2019 et un client de ton lab (domaine `laplateforme.io` d'après ton README). **Pas de manipulation d'apprentissage sur le réseau de ton employeur.** `gpresult` est une lecture ; `gpupdate /force` réapplique les stratégies : dans ton lab seulement.

Hypothèse à écrire d'abord : « sur mon client de lab, `gpresult /scope computer /r` et `/scope user /r` montreront deux listes de GPO différentes ».
1. Sur le client du lab, ouvre une invite de commandes et lance `gpresult /scope computer /r`. Note les GPO listées.
2. Lance `gpresult /scope user /r`. Les listes sont-elles différentes ?
3. Génère un rapport : `gpresult /h rapport.html` (puis ouvre-le dans le navigateur). Que contient-il de plus que `/r` ? **Je ne sais pas** : à toi d'observer.
4. Sur le serveur du lab, si tu as créé une GPO de test (sinon, passe à l'étape 6), modifie un réglage inoffensif, puis sur le client lance `gpupdate` **sans** `/force`, puis `gpresult /r` : le réglage apparaît-il ?
5. Refais avec `gpupdate /force`. Différence ?
6. Écris la phrase de ticket (§6) avec **tes** valeurs, ou « aucune GPO de test dans le lab » le cas échéant.

<details><summary>Solution</summary>

Pas de réponse unique : cela dépend des GPO de ton lab. Critères : (a) les deux jeux (ordinateur / utilisateur) sont présentés séparément ; (b) `gpresult /h` produit un rapport plus détaillé que `/r` ; (c) `gpupdate` seul ne réapplique que ce qui a changé, `/force` réapplique tout ; (d) un réglage de type installation de logiciels ou redirection de dossiers peut exiger `/logoff` ou `/boot`. Je n'ai pas exécuté cet exercice : si ta sortie diffère, dis-le-moi, je corrige la fiche.
</details>

## 8. Révision espacée

**D'hier (fiche du 2026-11-13, relire une refonte) :**
1. Pourquoi `process.env.NODE_ENV !== "production"` « s'ouvre-t-il par défaut » ?
2. Pourquoi des fichiers `.claude/skills/` relèvent-ils de la chaîne d'approvisionnement ?
3. Pourquoi ne faut-il pas envoyer le texte d'une page externe à un agent muni de `Bash` ?

**D'il y a 7 jours (fiche du 2026-11-07, DNS côté poste) :**
1. Quelles sont les deux sources du cache du résolveur ?
2. Que fait `ipconfig /flushdns`, et que ne fait-il pas ?
3. Pourquoi une réponse négative peut-elle rester mémorisée ?

<details><summary>Réponses</summary>

D'hier : (1) Toute valeur autre que `production` (absente ou fautive) est traitée comme du développement. (2) Ce sont des instructions et des scripts qu'un agent suit ou exécute, importés d'un tiers, que `npm audit` ne voit pas. (3) Le contenu externe devient une consigne.
Du 7 : (1) Le fichier Hosts (chargé au démarrage) et les réponses précédentes. (2) Il vide le cache du poste ; il ne vide ni le cache du serveur DNS ni celui du navigateur. (3) Le résolveur met en cache la réponse reçue, positive ou négative.
</details>

## 9. Trois questions de contrôle

1. Pourquoi `gpresult /scope user` et `/scope computer` peuvent-ils donner des listes différentes ?
2. Que fait `gpupdate /force` que `gpupdate` seul ne fait pas ?
3. Pour un réglage d'installation de logiciels ciblé ordinateur, quelle option de `gpupdate` est requise, et pourquoi ?

<details><summary>Réponses</summary>

1. Les stratégies d'utilisateur et d'ordinateur sont deux jeux distincts, chacun selon l'appartenance de l'objet aux sites, domaines et OU. 2. Il réapplique **tous** les réglages, pas seulement ceux qui ont changé. 3. `/boot` : cette extension traite la stratégie au démarrage de l'ordinateur, pas en arrière-plan.
</details>

## 10. Sources (consultées le 2026-11-14)

- Microsoft Learn, `gpresult` : https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/gpresult (syntaxe, options, remarque sur la portée par sites / domaines / OU, exemples).
- Microsoft Learn, `gpupdate` : https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/gpupdate (options, application de premier plan, extensions nécessitant déconnexion ou redémarrage).
- Fiche du 2026-11-10 (localisation du contrôleur de domaine) pour le lien avec le DNS.
- **Non relu aujourd'hui, de ma mémoire :** fréquence du cycle en arrière-plan, ordre site → domaine → OU, noms des sections d'un rapport `gpresult`, rôle de SYSVOL. Une page Microsoft plus ancienne tentée (`cc785665`) a répondu 404 : je ne m'en sers pas.
