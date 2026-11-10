# Fiche — Active Directory : comment un poste trouve son contrôleur de domaine (DC locator, enregistrements SRV)

Piste : Active Directory et Windows Server (rotation du mardi). Lecture + exercice : 25 à 30 minutes. Pas de tutoriel. Suite des fiches Kerberos (27 octobre) et NTLM/4624 (3 novembre) : avant même de s'authentifier, le poste doit **trouver** un contrôleur de domaine. C'est aussi le lien avec la fiche DNS du 7 novembre : **sans DNS correct, le poste ne trouve pas le contrôleur**.

**Calibrage Active Directory : toujours sans réponse.** Les trois questions en tête de la fiche Kerberos du 2026-10-27 attendent encore tes réponses. Je garde le niveau de départ (bases confirmées par ton lab : AD DS installé, domaine `laplateforme.io`, contrôleur promu, création d'utilisateurs par script).

## 1. Pourquoi ce mécanisme

« Le poste ne se connecte plus au domaine », « le mot de passe est refusé alors qu'il est bon », « les stratégies ne s'appliquent plus » : très souvent, la cause n'est pas le mot de passe mais le fait que le poste **n'a pas trouvé de contrôleur de domaine**, ou en a trouvé un **lointain**. Comprendre l'algorithme de localisation te dit où regarder : DNS d'abord, puis le service Netlogon du poste, puis le site Active Directory.

## 2. Le mécanisme, pas à pas

*(Source : Microsoft Learn, « Locating domain controllers in Windows and Windows Server », lue le 2026-11-10 ; s'applique à Windows Server 2016 à 2025 d'après la page.)*

### 2.1 Les deux temps du localisateur
D'après la page, le localisateur (*DC locator*) fait deux choses : (1) il **trouve quels contrôleurs sont enregistrés**, (2) il **soumet une requête** pour en repérer un dans le domaine demandé. Ensuite un message **LDAP UDP** est envoyé à un ou plusieurs contrôleurs de la réponse pour vérifier qu'ils sont **disponibles**, et le service **Netlogon met en cache** le contrôleur trouvé.

### 2.2 Les deux modes de découverte
- **Découverte par DNS** (le mode normal) : les contrôleurs enregistrent des **enregistrements SRV** dans le DNS (par exemple des enregistrements qui représentent des capacités, comme le Centre de distribution de clés Kerberos ou le Catalogue global, et d'autres qui décrivent la **localité**, comme les sites Active Directory). Les clients interrogent le DNS, puis « pinguent » les serveurs par des **pings LDAP en UDP**.
- **Découverte par NetBIOS** (ancien mode) : enregistrements dans **WINS**, ou diffusion par **mailslots**. La page indique que **WINS** est déprécié à partir de Windows Server 2022 et les **mailslots** à partir de Windows Server 2025, et que depuis Windows Server 2025 le localisateur **n'autorise plus** la découverte NetBIOS par défaut (paramètre de stratégie `BlockNetBIOSDiscovery`). Elle recommande la découverte par DNS, « plus fiable et plus sécurisée ».

### 2.3 Le déroulé en mode DNS (étapes de la page)
1. Sur le poste, le localisateur est lancé par un appel de procédure distante au service **Netlogon** local (interface `DsGetDcName`).
2. Le poste rassemble les informations nécessaires (domaine cherché, etc.).
3. Netlogon interroge le **DNS** : il lit les enregistrements **SRV** et **A**, après avoir ajouté le nom du domaine à la chaîne qui désigne les enregistrements SRV, au format `_<service>._<protocole>.<NomDeDomaineDNS>`. Pour un serveur LDAP du domaine : `_ldap._tcp.NomDeDomaineDNS`.
4. Netlogon envoie un **datagramme (recherche LDAP UDP)** aux contrôleurs découverts.
5. Chaque contrôleur disponible **répond** pour dire qu'il est opérationnel.
6. **Le premier qui répond** est celui que Netlogon retourne au poste.
7. Netlogon **met en cache** l'information : « il n'est pas nécessaire de refaire la découverte pour les requêtes suivantes ; cette mise en cache encourage l'usage constant du même contrôleur et donc une vue cohérente d'Active Directory ».

### 2.4 Le site le plus proche
Une fois un contrôleur trouvé, la négociation LDAP lui permet d'identifier **le site du client, d'après le sous-réseau IP du client**. S'il n'est pas dans le site optimal, il renvoie le nom du site du client ; le client refait alors une recherche DNS **propre au site**. D'après la page, si le contrôleur utilisé n'est pas dans le site optimal, le client **vide le cache au bout de 15 minutes** et cherche à nouveau un contrôleur du même site que lui.

### 2.5 Ce qui n'est pas dans la source lue
Le nom exact et l'ordre des variantes d'enregistrements de site (`_sites`), la liste complète des SRV enregistrés par Netlogon, la commande `nltest /dsgetdc` et le contenu de `Netlogon.dns` autrement que par l'article de vérification : **de ma mémoire sauf mention**, non relus aujourd'hui.

## 3. Lecture du réel

### 3.1 Où sont les enregistrements (article Microsoft « How to verify that SRV DNS records have been created for a domain controller », lu le 2026-11-10)
Dans le gestionnaire DNS, après installation d'Active Directory, les SRV sont créés dans :
```
Forward Lookup Zones/<Nom_Domaine>/_msdcs/dc/_sites/Default-First-Site-Name/_tcp
Forward Lookup Zones/<Nom_Domaine>/_msdcs/dc/_tcp
```
avec, dans chaque dossier, des enregistrements `_kerberos` et `_ldap`.

### 3.2 La sortie `nslookup` authentique (même article)
```
> set type=all
> _ldap._tcp.dc._msdcs.<Domain_Name>
Server: localhost
Address: 127.0.0.1
_ldap._tcp.dc._msdcs.<Domain_Name>
SRV service location:
   priority = 0
   weight   = 100
   port     = 389
   srv hostname = <Server_Name>.<Domain_Name>
<Server_Name>.<Domain_Name>  internet address = <Server_IP_Address>
```
Lecture champ par champ :
- `_ldap._tcp.dc._msdcs.<Domain_Name>` : « service LDAP, en TCP, fourni par un **contrôleur de domaine** (`dc`) du domaine `<Domain_Name>` ».
- `priority = 0` : ordre de préférence (le plus petit est préféré).
- `weight = 100` : poids pour répartir la charge entre enregistrements de même priorité.
- `port = 389` : port LDAP.
- `srv hostname` : le **nom** du contrôleur ; la ligne suivante donne son **adresse A**.
- Si cette requête **ne renvoie rien**, le poste ne peut pas localiser de contrôleur par DNS : il faut regarder **le serveur DNS interrogé** (est-ce celui du domaine ?) avant l'AD.
L'article ajoute : si on utilise un DNS non Microsoft, les enregistrements à créer sont dans `%systemroot%\System32\Config\Netlogon.dns` (le premier est le SRV LDAP du contrôleur).

## 4. Ce qui casse, symptôme, remontée

| Symptôme | Cause plausible | Remontée |
|---|---|---|
| Poste du domaine : « contrôleur de domaine introuvable » | Serveur DNS du poste incorrect (par exemple public au lieu de celui du domaine) | `ipconfig /all`, puis `nslookup` du SRV ci-dessus sur ce serveur |
| La requête SRV ne renvoie rien | Enregistrements absents (service Netlogon arrêté sur le contrôleur, zone incorrecte) | Vérifier la zone `_msdcs` dans le gestionnaire DNS |
| Connexion lente à l'ouverture de session | Contrôleur d'un site lointain choisi | Sous-réseau du poste absent des sites AD ; la page : le client le remarque et réessaie après 15 min |
| Poste hors domaine, partage par nom court | Découverte NetBIOS (si autorisée) au lieu de DNS | Utiliser le nom DNS complet ; Windows Server 2025 bloque NetBIOS par défaut |
| Authentification qui échoue juste après une panne de contrôleur | Cache Netlogon pointant sur un contrôleur éteint | Attendre ou forcer une nouvelle découverte (méthode : de ma mémoire) |
| Seul le premier contrôleur répondant sert | Normal : « le premier qui répond » est retenu | Pas un défaut ; ce n'est pas un équilibrage de charge strict |

**Piège de raisonnement :** « ping du contrôleur par son IP OK donc l'AD est joignable » : l'IP ne prouve pas que le **nom** et le **SRV** se résolvent. L'ouverture de session passe par le DNS.

## 5. Vocabulaire (FR / EN)

| FR | EN | Définition, piège |
|---|---|---|
| localisateur de contrôleur de domaine | *DC locator* | algorithme du poste pour trouver un contrôleur |
| enregistrement de localisation de service | *SRV record* | enregistrement DNS qui désigne qui fournit un service |
| découverte par DNS | *DNS-based discovery* | mode normal |
| découverte NetBIOS | *NetBIOS-based discovery* | ancien mode (WINS, mailslots) ; piège : ≠ le **nom** NetBIOS du domaine |
| ping LDAP | *LDAP ping* | datagramme UDP qui vérifie qu'un contrôleur répond |
| service Netlogon | *Netlogon service* | service qui met en cache le contrôleur trouvé |
| site Active Directory | *Active Directory site* | regroupement de sous-réseaux bien reliés ; piège : ≠ site web |
| Catalogue global | *Global Catalog* | contrôleur qui détient une copie partielle de tout l'annuaire |
| Centre de distribution de clés | *Key Distribution Center (KDC)* | service Kerberos du contrôleur (fiche du 27 octobre) |
| priorité / poids (SRV) | *priority / weight* | préférence / répartition de charge |
| nom NetBIOS du domaine | *NetBIOS domain name* | 15 caractères maximum d'après la page |
| nom de domaine DNS complet | *DNS FQDN* | ex. `laplateforme.io` |
| mise en cache | *caching* | Netlogon retient le contrôleur trouvé |
| dépréciation | *deprecation* | fin de prise en charge annoncée ; **piège :** déprécié ≠ supprimé |
| faux ami : *to locate* | = localiser/repérer | pas « louer » |

## 6. Comment le dire juste

**À un collègue (FR) :** « Le poste n'arrive pas à ouvrir de session : le SRV `_ldap._tcp.dc._msdcs` ne répond pas sur son DNS. Il pointe sur un DNS public, pas sur le DNS du domaine. »

**À un prestataire / éditeur (FR + EN) :**
- FR : « Pouvez-vous confirmer que les enregistrements SRV du contrôleur sont bien présents dans la zone `_msdcs` et que le service Netlogon est démarré sur le contrôleur ? »
- EN: "Can you confirm that the domain controller's SRV records are present in the `_msdcs` zone and that the Netlogon service is running on the domain controller?"

**Dans un ticket (FR + EN) :**
- FR : « Poste PC-12 : ouverture de session impossible, message "contrôleur introuvable". `ipconfig /all` : DNS = serveur public. `nslookup` du SRV LDAP : aucune réponse. Cause probable : mauvais serveur DNS. Action : corriger le DNS du poste, relever de nouveau le SRV, tester l'ouverture. »
- EN: "Workstation PC-12: cannot log on, 'domain controller not found'. `ipconfig /all`: DNS = public server. `nslookup` for the LDAP SRV record: no answer. Probable cause: wrong DNS server. Action: fix the workstation's DNS, re-check the SRV record, test the logon."

## 7. Exercice d'observation (25 à 30 minutes, **lab uniquement**)

**Rappel :** uniquement ta VM Windows Server 2019 / ton client de lab (domaine `laplateforme.io` d'après ton README). **Aucune manipulation sur le réseau de ton employeur.** Les requêtes ci-dessous sont des lectures.

Hypothèse à écrire d'abord : « un SRV `_ldap._tcp.dc._msdcs.laplateforme.io` doit exister et pointer sur mon contrôleur ».
1. Sur le contrôleur, ouvre le **gestionnaire DNS** : dans la zone `laplateforme.io`, repère `_msdcs` puis `dc/_tcp` et `dc/_sites/<ton-site>/_tcp`. Quels enregistrements y vois-tu (`_kerberos`, `_ldap`) ?
2. Dans `nslookup`, tape `set type=SRV` puis `_ldap._tcp.dc._msdcs.laplateforme.io`. Note `priority`, `weight`, `port`, `srv hostname`. *(L'article Microsoft utilise `set type=all` : l'un comme l'autre doit convenir ; sinon dis-le-moi.)*
3. Depuis le client du lab, refais la même requête : même résultat ?
4. Note quel serveur DNS répond (ligne `Server:`). Est-ce bien celui du domaine ?
5. Écris la phrase de ticket (§6) avec tes valeurs.
6. Question de réflexion (sans modification) : si le client avait un DNS public à la place, que donnerait cette requête, et que verrait l'utilisateur ?

<details><summary>Solution</summary>

Résultat attendu (**non exécuté par moi**, d'après l'article) : un enregistrement `priority = 0`, `weight = 100`, `port = 389`, avec le nom de ton contrôleur et son adresse. Pour la réflexion : un DNS public ne connaît pas la zone interne : la requête échoue (« non-existent domain »), le poste ne trouve pas de contrôleur, et l'utilisateur voit un message de contrôleur introuvable ou une ouverture de session qui échoue. Si ta sortie diffère, dis-le-moi : je corrige la fiche.
</details>

## 8. Révision espacée

**D'hier (fiche du 2026-11-09, STP) :**
1. Quelles sont les trois composantes du BID et dans quel ordre départagent-elles deux commutateurs ?
2. Pourquoi la priorité se règle-t-elle par pas de 4096 ?
3. Que fait un commutateur qui reçoit une BPDU dont l'identifiant de racine est plus grand que le sien ?

**D'il y a 7 jours (fiche du 2026-11-03, NTLM ou Kerberos) :**
1. Quel champ de l'événement 4624 indique le protocole utilisé ?
2. Pourquoi un accès par adresse IP peut-il provoquer un repli sur NTLM ?
3. NTLM sur un poste hors domaine : anomalie ?

<details><summary>Réponses</summary>

D'hier : (1) priorité, identifiant de système étendu, adresse MAC ; la priorité d'abord. (2) 12 des 16 bits sont pris par l'identifiant étendu. (3) Il l'ignore.
Du 3 : (1) `Authentication Package`. (2) Sans nom de service, pas de SPN pour demander un ticket Kerberos. (3) Non : NTLM est normal hors domaine.
</details>

## 9. Trois questions de contrôle

1. Quel enregistrement DNS un poste interroge-t-il pour trouver un serveur LDAP du domaine, et sous quel format ?
2. Quel contrôleur retient Netlogon quand plusieurs répondent à l'envoi LDAP UDP ?
3. Pourquoi « le ping de l'IP du contrôleur marche » ne prouve-t-il pas que l'ouverture de session peut marcher ?

<details><summary>Réponses</summary>

1. Un SRV, au format `_ldap._tcp.<NomDeDomaineDNS>` (variante `_ldap._tcp.dc._msdcs.<domaine>` pour un contrôleur). 2. Le premier qui répond. 3. L'ouverture de session suppose que le **nom** du domaine et les **SRV** se résolvent par DNS ; l'IP ne prouve rien de cela.
</details>

## 10. Sources (consultées le 2026-11-10)

- Microsoft Learn, « Locating domain controllers in Windows and Windows Server » : https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/dc-locator (algorithme, modes de découverte, mise en cache, site le plus proche, 15 minutes, dépréciations).
- Microsoft Learn, « How to verify that SRV DNS records have been created for a domain controller » : https://learn.microsoft.com/en-us/troubleshoot/windows-server/networking/verify-srv-dns-records-have-been-created (emplacements dans le DNS, sortie `nslookup`, `Netlogon.dns`).
- Ton lab : `Read Me Active Directory` (domaine `laplateforme.io`).
- **Non relu aujourd'hui, de ma mémoire :** `nltest /dsgetdc`, liste complète des SRV enregistrés par Netlogon, méthode pour forcer une redécouverte, comportement exact du cache après une panne.
