# Fiche — Le SPN : comment Kerberos sait « quel compte » se cache derrière un service

*Piste : Active Directory et Windows Server · mardi 24 novembre 2026 · lecture : 25 min*

> **Rappel :** observations en **laboratoire** (VM Windows Server). Ne crée, ne modifie ni ne supprime de SPN sur l'annuaire de ton employeur pour t'entraîner : un SPN en double ou déplacé casse l'authentification d'un service réel. Lire les SPN d'un compte en dépannage est de l'exploitation normale.

## 1. Pourquoi ce mécanisme
Fiche du 27 octobre : Kerberos délivre un **billet de service** pour « un service ». Mais l'annuaire ne connaît que des **comptes**. Le **SPN** est le pont entre les deux. Quand un site web interne, une base SQL ou un partage « demande un mot de passe alors qu'il devrait faire du SSO », ou qu'un service ne démarre plus après un changement de compte, la question utile est : **quel compte porte ce SPN, et un seul ?**

## 2. Le mécanisme (sources Microsoft Learn, lues le 2026-11-24)
- Un **SPN** est « un identifiant unique d'une instance de service ». Kerberos s'en sert pour **associer une instance de service au compte de connexion du service**, ce qui permet à un client de demander l'authentification du service **sans connaître le nom du compte**.
- **Enregistrement :** avant que Kerberos puisse l'utiliser, le SPN doit être **inscrit sur l'objet compte** que l'instance de service utilise pour se connecter. **Un SPN donné ne peut être inscrit que sur un seul compte.** Si le compte de connexion du service change, les SPN doivent être **réinscrits** sous le nouveau compte.
- **Côté client :** le client localise une instance du service, **compose le SPN** de cette instance, se connecte et le présente pour s'authentifier.
- **Syntaxe :** `<classe de service>/<hôte>:<port>/<nom de service>` ; classe et hôte sont obligatoires ; le **port** (si le service n'utilise pas le port par défaut) et le **nom de service** (services réplicables) sont facultatifs. L'hôte peut être un nom DNS complet ou un nom NetBIOS ; **un nom NetBIOS n'est pas garanti unique dans une forêt**, donc un SPN qui le contient peut ne pas être unique.
- **Unicité :** un SPN doit être **unique dans la forêt** où il est inscrit ; sinon, **l'authentification échoue**.
- **Un service peut avoir plusieurs SPN** : un par nom ou alias de son hôte.

## 3. Lecture du réel
Extrait de la page de dépannage Kerberos de Microsoft (lue le 2026-11-24) : « **KDC_ERR_PRINCIPAL_NOT_UNIQUE** or **KDC_ERR_S_PRINCIPAL_UNKNOWN**. The requested SPN is associated with more than one account, or isn't associated with any account. » ; « **KRB_AP_ERR_MODIFIED**. The client couldn't decrypt the service ticket. More than one issue can cause this error. » Lecture champ par champ :
| Message | Ce qu'il dit |
|---|---|
| `KDC_ERR_S_PRINCIPAL_UNKNOWN` | le SPN demandé n'est **sur aucun compte** |
| `KDC_ERR_PRINCIPAL_NOT_UNIQUE` | le SPN est **sur plusieurs comptes** |
| `KRB_AP_ERR_MODIFIED` | le service n'a **pas pu déchiffrer** le billet : plusieurs causes possibles (la page cite par exemple horloges désynchronisées ou SPN non unique) |
Je n'ai pas de journal d'événements authentique commenté ligne à ligne à te montrer ici.

## 4. Ce qui casse, et le symptôme
- **SPN absent :** le client ne trouve pas de compte ; repli sur NTLM ou demande de mot de passe (fiche du 3 novembre, lecture de l'événement 4624 : le champ du paquet d'authentification te dit ce qui s'est passé).
- **SPN en double :** échec d'authentification (unicité de forêt).
- **Compte de service changé sans réinscrire les SPN :** le service ne démarre plus ou le billet n'est plus déchiffrable ; la page de Microsoft mentionne l'erreur 1069 (« échec d'ouverture de session ») liée à des SPN mal définis.
- **Nom NetBIOS dans le SPN :** unicité non garantie.
Remonter : message d'erreur → le SPN demandé (nom d'hôte et classe de service) → quels comptes le portent.

## 5. Vocabulaire
| Français | English | Définition / piège |
|---|---|---|
| nom principal de service | service principal name (SPN) | identifiant d'une instance de service |
| compte de connexion du service | service sign-in / logon account | compte qui porte le SPN |
| billet de service | service ticket | émis après demande pour un SPN |
| centre de distribution de clés | KDC | émet les billets |
| classe de service | service class | `www`, `ldap`, `MSSQLSvc`… |
| nom d'hôte complet | fully qualified domain name (FQDN) | à préférer au NetBIOS |
| forêt | forest | périmètre d'unicité du SPN |
| authentification mutuelle | mutual authentication | le client vérifie aussi le service |
| principal de sécurité | security principal | utilisateur, ordinateur, service |
| inscription d'un SPN | SPN registration | écriture sur l'objet compte |
| doublon | duplicate | deux comptes, même SPN |
Faux amis : SPN ≠ nom du compte ; « le service tourne » ≠ « son SPN est correct » ; NetBIOS ≠ DNS.

## 6. Comment le dire juste
- **Collègue :** « Le SSO tombe en mot de passe : je regarde si le SPN du site est inscrit sur le bon compte de service, et une seule fois. »
- **Prestataire (EN) :** "Clients fall back to NTLM for this service. Could you confirm that the SPN is registered on the service account and not on another account?"
- **Ticket (EN) :** "Kerberos failing for service X: KDC_ERR_PRINCIPAL_NOT_UNIQUE logged. Suspected duplicate SPN across two accounts. Need the list of accounts holding the SPN."

## 7. Exercice (VM de laboratoire, 25 min, observation)
Sur un contrôleur de domaine de test : repère **un compte de service ou un compte machine** et ses SPN (attribut `servicePrincipalName`, via la console utilisateurs et ordinateurs en mode avancé). **Hypothèse à écrire avant de regarder** : combien de SPN un compte machine porte-t-il, et de quelles classes de service ?
<details><summary>Solution</summary>
À observer sur ton laboratoire : je n'ai pas rejoué cet exercice. D'après la documentation, tu dois trouver des SPN de la forme `classe/hôte`, avec l'hôte en nom complet et/ou court selon le service. Si un même SPN apparaît sur deux comptes, c'est un doublon.
</details>

## 8. Révision espacée
Hier (table MAC contre table ARP) : 1) Que relie la table ARP ? 2) Comment un commutateur apprend-il une adresse ? Il y a sept jours (17 nov, réplication AD) : 3) Qu'est-ce qu'un USN ?

## 9. Questions de contrôle
1. À quoi sert un SPN ? 2. Pourquoi un SPN doit-il être unique dans la forêt ? 3. Que faut-il faire quand le compte de connexion d'un service change ?
<details><summary>Réponses</summary>
1. Associer une instance de service à son compte de connexion pour Kerberos. 2. Sinon l'authentification échoue (deux comptes revendiqueraient le service). 3. Réinscrire les SPN sous le nouveau compte.
</details>

## 10. Sources (consultées le 2026-11-24)
- Microsoft Learn, « Service principal names » : https://learn.microsoft.com/en-us/windows/win32/ad/service-principal-names — définition, unicité, réinscription.
- Microsoft Learn, « Name formats for unique SPNs » : https://learn.microsoft.com/en-us/windows/win32/ad/name-formats-for-unique-spns — syntaxe, NetBIOS, forêt.
- Microsoft Learn, guide de dépannage Kerberos : https://learn.microsoft.com/en-us/troubleshoot/windows-server/windows-security/kerberos-authentication-troubleshooting-guidance — erreurs KDC et `KRB_AP_ERR_MODIFIED`.
