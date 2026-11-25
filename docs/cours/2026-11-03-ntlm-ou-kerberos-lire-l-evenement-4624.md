# Fiche — NTLM ou Kerberos : lire l'événement 4624 pour savoir quel protocole a ouvert la session

Piste : Active Directory et Windows Server (rotation du mardi). Lecture + exercice : 25 à 30 minutes. Pas de tutoriel. Suite de la fiche du 27 octobre (Kerberos) : là, tu as vu ce que Kerberos échange ; ici, tu apprends à **savoir si c'est bien lui qui a servi**, et ce qu'est son repli, NTLM.

**Calibrage toujours en attente.** Les trois questions en tête de la fiche Kerberos du 2026-10-27 n'ont pas reçu de réponse. Une ligne par question suffit ; sans réponse, je garde le niveau de départ (bases confirmées par ton lab : AD DS installé, contrôleur de domaine promu, création d'utilisateurs par script).

## 1. Pourquoi ce mécanisme

« Ça marche » ne dit pas **comment** l'utilisateur s'est authentifié. Une machine du domaine peut ouvrir une session réseau avec Kerberos ou, silencieusement, avec **NTLM**, l'ancien protocole à défi-réponse. Les deux donnent un accès au partage. Mais NTLM est ce que Microsoft présente comme un **repli** : « Kerberos version 5 est la méthode d'authentification préférée dans les environnements Active Directory, mais une application peut encore utiliser NTLM » (page « NTLM overview », Microsoft Learn, lue le 2026-11-03). Savoir lire quel protocole a servi change ton diagnostic : un client qui « tombe » en NTLM te signale un problème de nom, de SPN ou d'application, **pas** un problème de mot de passe.

## 2. Le mécanisme, pas à pas

### 2.1 Qui choisit : le paquet « Negotiate »
Quand une application demande « authentifie-moi auprès de ce serveur », elle passe souvent par le paquet **Negotiate**. D'après la page de l'événement 4624 (lue le 2026-11-03) : « Negotiate choisit entre Kerberos et NTLM. Negotiate sélectionne Kerberos **sauf s'il ne peut pas être utilisé par l'un des systèmes concernés, ou si l'application appelante n'a pas fourni assez d'informations pour utiliser Kerberos**. »

Donc l'ordre est : **essai Kerberos d'abord, NTLM en repli**.

### 2.2 Ce que « pas assez d'informations pour Kerberos » veut dire en pratique
Kerberos a besoin de savoir **quel service** on vise (un nom de principal de service, SPN) pour demander un ticket de service au contrôleur de domaine (fiche du 27 octobre : échange TGS). Si l'application ne donne **qu'une adresse IP**, ou un nom que le domaine ne connaît pas, il n'y a pas de SPN à demander. Cas fréquents sur le terrain, **de ma mémoire et non vérifiés aujourd'hui dans une source Microsoft** : accès par adresse IP au lieu du nom, nom d'alias (CNAME) sans SPN enregistré, machine hors domaine, horloge décalée de plus de cinq minutes (fiche du 27 octobre), contrôleur de domaine injoignable.

### 2.3 Ce que NTLM fait (principe)
La page « NTLM overview » : NTLM est une famille de protocoles d'authentification (LAN Manager v1 et v2, NTLM v1 et v2) fondée sur un mécanisme de **défi-réponse** « qui prouve à un serveur ou à un contrôleur de domaine que l'utilisateur connaît le mot de passe associé au compte ». Le serveur de ressources doit, à chaque nouveau jeton d'accès, soit **contacter le service d'authentification du contrôleur de domaine** (compte de domaine), soit **consulter la base de comptes locale** (compte local).

Déroulé typique en trois messages (**de ma mémoire, spécification MS-NLMP non relue aujourd'hui**) : le client annonce ce qu'il sait faire (*Negotiate*) ; le serveur renvoie un nombre aléatoire, le **défi** (*Challenge*) ; le client répond en le combinant à un secret dérivé du mot de passe (*Authenticate*) ; le serveur fait vérifier la réponse par le contrôleur de domaine. Remarque de fond : contrairement à Kerberos, **le contrôleur de domaine est consulté à chaque authentification**, et il n'y a pas de ticket réutilisable.

Quand NTLM est **normal** : « NTLM doit être utilisé pour l'authentification Windows avec des systèmes configurés comme membres d'un groupe de travail. NTLM est aussi utilisé pour l'ouverture de session locale sur les machines qui ne sont pas des contrôleurs de domaine » (même page). Un poste hors domaine ou un compte local en NTLM n'est donc pas une anomalie.

### 2.4 Où on le voit : l'événement 4624
L'événement **4624(S)** « An account was successfully logged on » (sous-catégorie *Audit Logon*) est généré **sur la machine accédée**, là où la session est créée. Trois champs répondent à ta question :
1. **Logon Type** : le type d'ouverture. `3` = Network (accès réseau, par exemple à un partage), `2` = Interactive (clavier local), `10` = RemoteInteractive (Bureau à distance, d'après ma lecture de la table de la page).
2. **Authentication Package** : `Kerberos`, `NTLM` ou `Negotiate`. C'est le champ-clé. D'après la page : « NTLM = authentification de la famille NTLM ; Kerberos = authentification Kerberos ; Negotiate = le paquet Negotiate choisit entre les deux. »
3. **Package Name (NTLM only)** : `NTLM V1`, `NTLM V2` ou `LM`, rempli **seulement si** le paquet est NTLM. **Key Length** : longueur de la clé de session NTLM ; la page note qu'elle vaut 0 pour Kerberos (et aussi quand Kerberos a été négocié via Negotiate).

## 3. Lecture du réel : un événement 4624 authentique

Exemple fourni par Microsoft dans la page de l'événement (lue le 2026-11-03). **C'est un exemple de documentation (machine `WIN-GG82ULGC9GO`, groupe de travail, 2015), pas un journal de ton réseau.**

```xml
<EventID>4624</EventID>  <Version>2</Version>  <Channel>Security</Channel>
<Computer>WIN-GG82ULGC9GO</Computer>
SubjectUserSid         S-1-5-18
SubjectUserName        WIN-GG82ULGC9GO$
SubjectDomainName      WORKGROUP
TargetUserName         Administrator
TargetDomainName       WIN-GG82ULGC9GO
LogonType              2
LogonProcessName       User32
AuthenticationPackageName  Negotiate
WorkstationName        WIN-GG82ULGC9GO
LmPackageName          -
KeyLength              0
IpAddress              127.0.0.1
```
Lecture champ par champ :
- `SubjectUserName ...$` : le « sujet » est le **compte machine** (le `$` final) qui a demandé la création de la session ; `S-1-5-18` est le SID bien connu du compte système. Le sujet n'est **pas** la personne qui se connecte.
- `TargetUserName Administrator` : le compte **cible**, celui dont la session est créée.
- `LogonType 2` : interactif, ouverture au clavier de la machine. `IpAddress 127.0.0.1` : cohérent avec une ouverture locale.
- `AuthenticationPackageName Negotiate` : **le paquet Negotiate a été appelé**. Attention : dans cet exemple, ce champ ne dit pas « Kerberos », il dit qui a **négocié**. Pour une ouverture locale sur un groupe de travail, il n'y a pas de contrôleur de domaine.
- `LmPackageName -` et `KeyLength 0` : pas de sous-protocole NTLM renseigné, clé de session nulle, cohérent avec « Package Name est vide hors NTLM » et « Key Length vaut 0 quand ce n'est pas du NTLM pur ».

**Ce que cet exemple ne te montre pas** : un 4624 de type 3 avec `AuthenticationPackageName NTLM` et `LmPackageName NTLM V2`. C'est ce que tu cherches dans ton lab (exercice, §7). Je n'ai pas d'exemple authentique de ce cas à te montrer aujourd'hui.

## 4. Ce qui casse, symptôme, remontée

| Symptôme | Cause plausible | Remontée |
|---|---|---|
| Accès au partage par `\\10.x.x.x` fonctionne, mais le 4624 montre NTLM | Pas de nom, donc pas de SPN → repli NTLM | Refaire l'accès par le **nom** (FQDN) et comparer le champ *Authentication Package* |
| Un seul serveur fait du NTLM, les autres du Kerberos | SPN absent ou en double, ou alias | Comparer avec un autre serveur ; vérifier l'enregistrement du service (côté lab) |
| NTLM partout après une panne de DC | Contrôleur de domaine injoignable ou horloge décalée | Relire la fiche du 27 octobre ; événements 4768/4771 côté DC |
| `NTLM V1` ou `LM` dans le champ | Client ou application ancienne | La page recommande de surveiller tout paquet NTLM qui n'est pas `NTLM V2` si ton organisation n'utilise que V2 |
| Alerte sur NTLM d'un compte qui ne devrait pas en faire | Usage anormal | La page de monitoring : surveiller tous les 4624 dont le paquet est NTLM pour un compte donné |

**Piège de lecture :** `Negotiate` dans le journal ne prouve ni Kerberos ni NTLM. Il faut regarder le **détail** (type, Key Length, présence de `LmPackageName`) ou corréler avec les événements Kerberos du contrôleur de domaine (4768 TGT, et pour le ticket de service, de mémoire 4769, non relu).

## 5. Vocabulaire (FR / EN)

| FR | EN | Définition, piège |
|---|---|---|
| authentification | *authentication* | prouver **qui** on est. Piège : ≠ autorisation (*authorization*, ce qu'on a le droit de faire) |
| ouverture de session | *logon* | **Piège :** *login* est le nom/verbe courant ; Microsoft écrit *logon* |
| défi-réponse | *challenge-response* | le serveur envoie un aléa, le client répond avec un calcul fondé sur le secret |
| NTLM (famille) | *NTLM (family)* | LM v1/v2 et NTLM v1/v2 |
| repli | *fallback* | NTLM est le repli de Kerberos sous Negotiate |
| paquet d'authentification | *authentication package* | module chargé par la LSA (autorité de sécurité locale) |
| type d'ouverture | *logon type* | 2 interactif, 3 réseau, 10 bureau à distance |
| compte cible / sujet | *target account / subject* | **Piège :** le sujet est celui qui demande, la cible celui dont la session est créée |
| SID | *security identifier* | identifiant unique du compte ; ne pas confondre avec le nom |
| compte machine | *computer account* | nom terminé par `$` |
| principal de service (SPN) | *service principal name* | nom sous lequel un service est connu de Kerberos |
| ticket de service | *service ticket* | ce que Kerberos remet pour parler à un service |
| groupe de travail | *workgroup* | machines hors domaine : NTLM est normal |
| contrôleur de domaine | *domain controller (DC)* | **Piège :** il joue les deux rôles, KDC (Kerberos) et vérificateur NTLM de passage |
| session réseau | *network logon* | type 3 |

## 6. Comment le dire juste

**À un collègue (FR) :** « L'accès au partage a marché, mais le 4624 sur le serveur montre NTLM, pas Kerberos : le client a dû passer par l'adresse IP, donc sans SPN. »

**À un prestataire / éditeur (FR + EN) :**
- FR : « Pouvez-vous confirmer que l'application demande un ticket Kerberos pour le nom du service, et pas seulement l'adresse ? Nous voyons un repli sur NTLM. »
- EN: "Can you confirm that the application requests a Kerberos ticket for the service name, not just the IP address? We see a fallback to NTLM."

**Dans un ticket (FR + EN) :**
- FR : « Serveur FS01, événement 4624 type 3, paquet NTLM, sous-protocole NTLM V2, compte `utilisateur1`, source `10.x.x.x`. Hypothèse : accès par IP, repli NTLM. Vérification : refaire l'accès par le nom, relire le champ Authentication Package. »
- EN: "Server FS01, event 4624 logon type 3, package NTLM, sub-package NTLM V2, account `user1`, source `10.x.x.x`. Hypothesis: access by IP address, NTLM fallback. Check: repeat the access by name and re-read the Authentication Package field."

## 7. Exercice d'observation (25 à 30 minutes, **lab uniquement**)

**Rappel :** uniquement sur ta VM Windows Server 2019 et un poste client que tu montes toi-même. **Aucune manipulation sur le réseau de ton employeur**, y compris sur ses journaux : ces événements s'étudient dans ton lab.

Hypothèse à écrire d'abord : « Un accès par nom produira un 4624 Kerberos, un accès par adresse IP produira du NTLM. »
1. Sur le serveur du lab, ouvre l'Observateur d'événements (journal Sécurité) et repère la liste des 4624.
2. Depuis un client du lab, ouvre un partage **par le nom** du serveur, puis, après quelques secondes, **par son adresse IP**.
3. Sur le serveur, filtre sur l'ID 4624 et ouvre les deux événements correspondants. Note pour chacun : `Logon Type`, `Authentication Package`, `Package Name (NTLM only)`, `Key Length`, `Source Network Address`.
4. Compare à ton hypothèse. Écris une phrase de ticket (§6).
5. Si un seul des deux est tracé : note que l'**audit de l'ouverture de session** (sous-catégorie *Audit Logon*) doit être actif pour générer l'événement. *Ne le modifie que dans ton lab ; c'est le seul réglage de ce paragraphe, il est nécessaire à l'observation.*

<details><summary>Solution</summary>

Résultat attendu (**non exécuté par moi**, d'après le comportement décrit par Microsoft) : par le **nom**, `Authentication Package` = `Kerberos` (ou `Negotiate` selon la version de l'événement, avec `Key Length` = 0) ; par l'**IP**, repli sur `NTLM` avec `Package Name` = `NTLM V2` et `Key Length` = 128. Si tu vois autre chose, ne conclus pas : l'écart est une information (SPN, DNS, version d'événement) ; dis-le-moi, je corrige la fiche.
</details>

## 8. Révision espacée

**D'hier (fiche du 2026-11-02, 802.1Q et VLAN natif) :**
1. Où l'étiquette 802.1Q est-elle insérée dans la trame, et quel est son TPID ?
2. Dans quel VLAN un commutateur classe-t-il une trame arrivée sans étiquette sur un trunk ?
3. Avec un VLAN natif 99 d'un côté et 2 de l'autre, le trunk est-il « up » ?

**D'il y a 7 jours (fiche du 2026-10-27, Kerberos) :**
1. Quel est l'écart d'horloge toléré par défaut ?
2. Quels sont les trois échanges (AS, TGS, AP) et à quoi sert chacun ?
3. Quel événement du contrôleur de domaine marque l'obtention d'un TGT ?

<details><summary>Réponses</summary>

D'hier : (1) entre SA et Type/Longueur, TPID 0x8100. (2) Dans le VLAN natif de son propre port. (3) Oui, il reste actif et fuit seulement les trames natives.
Du 27 : (1) 5 minutes. (2) AS : obtenir le TGT (preuve du mot de passe) ; TGS : obtenir un ticket pour un service ; AP : présenter ce ticket au service. (3) 4768.
</details>

## 9. Trois questions de contrôle

1. Quel champ de l'événement 4624 indique le protocole utilisé, et quelles trois valeurs peut-il prendre ?
2. Pourquoi un accès par adresse IP peut-il provoquer un repli sur NTLM ?
3. Un poste hors domaine ouvre une session en NTLM : est-ce une anomalie ?

<details><summary>Réponses</summary>

1. `Authentication Package` : `NTLM`, `Kerberos` ou `Negotiate`. 2. Sans nom de service, l'application ne fournit pas assez d'informations pour demander un ticket Kerberos (SPN) ; Negotiate se replie sur NTLM. 3. Non : NTLM est requis pour les systèmes d'un groupe de travail et pour l'ouverture de session locale hors contrôleur de domaine (Microsoft Learn).
</details>

## 10. Sources (consultées le 2026-11-03)

- Microsoft Learn, « 4624(S): An account was successfully logged on » : https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/auditing/event-4624 (types d'ouverture, champs, Negotiate, exemple XML, recommandations de surveillance NTLM).
- Microsoft Learn, « NTLM overview » (dernière mise à jour affichée : 2025-04-18) : https://learn.microsoft.com/en-us/windows-server/security/kerberos/ntlm-overview (défi-réponse, quand NTLM est requis, Kerberos préféré).
- Non relu aujourd'hui, de ma mémoire : les trois messages NTLM (MS-NLMP), causes précises du repli (IP, alias, SPN absent), événement 4769, valeur 10 du type d'ouverture au-delà de ce que la table lue montre, ainsi que le comportement attendu dans la solution de l'exercice.
