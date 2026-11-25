# Fiche — « Connecté, sans accès Internet » : comment Windows décide, avec la sonde NCSI

*Piste : poste de travail et support · samedi 21 novembre 2026 · lecture : 25 min*

> **Rappel :** observation sur ton **propre poste de test ou un lab**. Ne désactive pas la sonde et ne modifie pas le registre sur le parc de ton employeur ; regarder l'état d'un poste en dépannage reste de l'exploitation normale.

## 1. Pourquoi ce mécanisme
Ticket classique : « Wi-Fi/câble branché, mais Windows dit *Aucun accès Internet* alors que le navigateur marche (ou l'inverse) ». L'icône réseau n'est pas un test de ta connexion : c'est le verdict d'un composant, **NCSI** (*Network Connectivity Status Indicator*). Comprendre ses sondes évite de chercher au mauvais endroit (DNS, proxy, portail captif, pare-feu).

## 2. Le mécanisme (sources Microsoft Learn, lues le 2026-11-21)
**Rôle.** NCSI détermine si une connexion donne un accès **Internet** ou seulement **local**, pour épargner cette tâche aux applications. Il tient compte des proxies, points d'accès et **portails captifs**.

**Sonde active.** Séquence documentée : 1) une requête **DNS** pour `www.msftconnecttest.com` ; 2) si la réponse est valide, une requête **HTTP GET simple** vers `http://www.msftconnecttest.com/connecttest.txt` ; 3) NCSI vérifie que le fichier contient **« Microsoft Connect Test »** ; 4) une seconde requête **DNS** pour `dns.msftncsi.com`. Si **l'une** de ces requêtes échoue, l'alerte réseau apparaît (message du type « Pas de connectivité » ou « Accès Internet limité » selon ce qui a échoué) ; si **toutes** réussissent, l'icône normale (« Accès Internet »). Les sondes IPv4 et IPv6 partent **en parallèle** ; si l'une réussit, le poste est jugé connecté à Internet. Les hôtes et contenus sont dans `HKLM\SYSTEM\CurrentControlSet\Services\NlaSvc\Parameters\Internet`. Les serveurs de sonde publics sont hébergés par Akamai depuis le 20 juin 2023 (avant : Azure Front Door).

**Sonde passive.** NCSI examine aussi les paquets reçus et met à jour l'état de chaque interface (Internet ou local, d'après le nombre de sauts observé). Elle **complète** la sonde active et ne la remplace pas : Microsoft avertit de **ne pas désactiver la sonde active** pour « résoudre » un problème NCSI. Depuis Windows 11 NCSI est hébergé par le service *Network List Manager* (avant : *Network Location Awareness*).

**Échecs typiques.** Sonde qui n'aboutit pas (DNS, réseau, poste) ; sonde qui aboutit **en échec** (ex. **HTTP 403**, souvent un proxy qui bloque) ; **proxy** découvert mais inaccessible, ou fichier PAC qui n'associe pas `www.msftconnecttest.com` au bon proxy ; **portail captif** : redirection HTTP ou réponse vide, contenu différent de « Microsoft Connect Test ». Dans certains cas (proxy, restrictions réseau empêchant la sonde), Windows ouvre la page **MSN** dans le navigateur par défaut.

## 3. Lecture du réel
Extrait de la documentation : adresse testée `http://www.msftconnecttest.com/connecttest.txt`, contenu attendu `Microsoft Connect Test`, clé de configuration `…\NlaSvc\Parameters\Internet`. **Je n'ai pas de capture authentique de l'interface** à te montrer : sur ton poste de test, relis l'état dans *Paramètres → Réseau et Internet* et compare avec ce que fait réellement ton navigateur.

## 4. Ce qui casse, et le symptôme
| Symptôme | Cause plausible (documentée) |
|---|---|
| « Pas d'accès Internet », navigateur OK | sonde bloquée ou proxy qui répond 403 à l'adresse de sonde |
| Page de connexion qui s'ouvre toute seule | portail captif (contenu ≠ « Microsoft Connect Test ») |
| Ouverture de la page MSN | sonde non terminée (proxy / restriction) |
| Statut correct puis erroné | DNS ou IPv6 qui répond différemment de l'IPv4 |
Remonter : résolution DNS de `www.msftconnecttest.com` → réponse HTTP reçue → proxy/PAC → contenu.

## 5. Vocabulaire
| Français | English | Définition / piège |
|---|---|---|
| indicateur d'état de connectivité réseau | Network Connectivity Status Indicator (NCSI) | verdict affiché par l'icône |
| sonde active / passive | active / passive probe | requête HTTP / analyse des paquets reçus |
| portail captif | captive portal | page d'authentification imposée |
| proxy / fichier PAC | proxy / PAC file | relais et script qui choisit le proxy |
| accès Internet / accès local | Internet / local only | |
| redirection HTTP | HTTP redirect | |
| 403 Interdit | 403 Forbidden | refus, souvent par un proxy |
| résolution DNS | DNS resolution | |
| service de liste des réseaux | Network List Manager | héberge NCSI (Windows 11) |
| connectivité | connectivity | ≠ « le service demandé répond » |
Faux amis : « connecté » (lien établi) ≠ « Internet » ; l'icône n'est pas un `ping`.

## 6. Comment le dire juste
- **Collègue :** « Windows affiche *sans accès Internet* : c'est la sonde NCSI vers msftconnecttest.com qui échoue, pas forcément le navigateur. Je regarde DNS et proxy. »
- **Prestataire (EN) :** "The client reports 'No Internet' while browsing works. Could you confirm that `www.msftconnecttest.com` is allowed through the proxy and returns 'Microsoft Connect Test'?"
- **Ticket (EN) :** "NCSI shows no Internet on LAN. Active probe to http://www.msftconnecttest.com/connecttest.txt likely blocked or redirected (proxy/PAC/captive portal). Checked: DNS resolution, HTTP response code and body."

## 7. Exercice (poste de test, 20 min, sans modifier le registre)
Sur une VM Windows de **laboratoire** : 1) note l'état affiché ; 2) écris, avant de tester, l'hypothèse « que se passe-t-il si le DNS ne résout pas `www.msftconnecttest.com` ? » ; 3) vérifie le fonctionnement dans un navigateur vers un autre site ; 4) compare.
<details><summary>Solution</summary>
Selon la documentation, sans réponse DNS valide la sonde active ne continue pas : le statut peut devenir « sans accès Internet » même si d'autres sites s'ouvrent. À confirmer par ton observation : je ne l'ai pas testé.
</details>

## 8. Révision espacée
Hier (npm / lockfile) : 1) Quel fichier dit la version réellement installée ? 2) Que signifie `^16.4.6` ? Il y a sept jours (14 nov, GPO côté poste) : 3) À quoi sert `gpresult` ?

## 9. Questions de contrôle
1. Quelles étapes fait la sonde active ? 2. Pourquoi ne pas désactiver la sonde active ? 3. Que signale un contenu différent de « Microsoft Connect Test » ?
<details><summary>Réponses</summary>
1. DNS, puis HTTP GET `connecttest.txt`, puis vérification du contenu. 2. La sonde passive seule ne détecte pas tous les problèmes. 3. Un portail captif ou un intermédiaire qui modifie la réponse.
</details>

## 10. Sources (consultées le 2026-11-21)
- Microsoft Learn, « NCSI overview » : https://learn.microsoft.com/en-us/windows-server/networking/ncsi/ncsi-overview — sondes active/passive, clé de registre, proxy, portail captif, Akamai depuis 2023-06-20.
- Microsoft Learn, « Internet Explorer / Edge … ouvrent un portail » (page de dépannage) : https://learn.microsoft.com/en-us/troubleshoot/windows-client/networking/internet-explorer-edge-open-connect-corporate-public-network — séquence DNS puis `connecttest.txt`, ouverture de la page MSN.
