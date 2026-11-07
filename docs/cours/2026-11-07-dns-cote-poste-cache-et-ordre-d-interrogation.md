# Fiche — DNS côté poste Windows : le cache résolveur, l'ordre d'interrogation et le cache négatif

Piste : poste de travail et support (rotation du samedi). Lecture + exercice : 25 à 30 minutes. Pas de tutoriel : tu sais lancer `ipconfig /flushdns`. Cette fiche explique **ce que fait le poste** entre « l'application demande un nom » et « une adresse revient (ou pas) », et pourquoi `/flushdns` règle parfois un problème et parfois non. Complète la fiche DHCP du 24 octobre (là, le poste *reçoit* ses serveurs DNS ; ici, il *s'en sert*).

## 1. Pourquoi ce mécanisme

Symptôme classique du support : « le site marche par son adresse IP mais pas par son nom », ou « ça marche chez le voisin, pas chez moi », ou « ça marchait hier ». Entre l'application et le serveur DNS il y a un **intermédiaire local** (le service Client DNS, avec son cache) qui peut avoir mémorisé une réponse **positive périmée** ou une réponse **négative** (« ce nom n'existe pas »). Savoir où chercher (cache du poste, fichier Hosts, serveurs configurés, ordre d'interrogation) change ton diagnostic.

## 2. Le mécanisme, pas à pas

D'après la documentation Microsoft « DNS Processes and Interactions » (lue le 2026-11-07 ; **page écrite pour Windows Server 2008**, voir le §2.5) :

### 2.1 Deux parties
1. La requête **commence sur le poste** et passe à un résolveur, le **service Client DNS**.
2. Si le poste ne peut pas répondre localement, **les serveurs DNS sont interrogés** selon les besoins.

### 2.2 Ce que contient le cache local (deux sources, selon la doc)
- Si un fichier **Hosts** local est configuré, ses correspondances nom → adresse sont **chargées dans le cache** au démarrage du service Client DNS.
- Les enregistrements reçus dans des **réponses précédentes** sont ajoutés au cache et conservés un certain temps.
Si le nom est dans le cache, la requête est satisfaite sans quitter le poste. Sinon, on interroge un serveur.

### 2.3 L'ordre d'interrogation des serveurs (étapes décrites par la doc, avec leurs durées)
1. Envoi au **premier serveur DNS de la carte préférée** ; attente de **1 seconde**.
2. Sans réponse : envoi aux **premiers serveurs de toutes les cartes** encore en considération ; attente de **2 secondes**.
3. Sans réponse : envoi à **tous les serveurs de toutes les cartes** ; attente de **2 secondes** de plus.
4. Sans réponse : même envoi, attente de **4 secondes**.
5. Sans réponse : même envoi, attente de **8 secondes**.
6. Réponse positive : on arrête, on **ajoute au cache** et on répond. Aucune réponse après 8 secondes : **délai dépassé** (*timeout*).
7. Si **aucun** serveur d'une carte n'a répondu, pendant les **30 secondes suivantes**, le service répond immédiatement par un délai dépassé à toute requête destinée aux serveurs de cette carte, **sans les interroger**.
8. À une **réponse négative** d'un serveur, le service retire de la liste **tous les serveurs de cette carte** pour cette recherche.
9. Le service **mémorise la rapidité** de réponse des serveurs et les remonte ou descend dans sa liste.

### 2.4 Les types de réponse
La doc distingue : réponse **autoritaire**, **positive**, **de renvoi** (*referral*) et **négative**. Une réponse négative signifie l'un de deux cas : (a) un serveur faisant autorité dit que **le nom n'existe pas** ; (b) il dit que **le nom existe mais sans enregistrement de ce type**. La phrase-clé : « The resolver passes the results … back to the requesting program **and caches the response** », que la réponse soit positive **ou négative**.

### 2.5 Ce que la source ne garantit pas
La page décrit **Windows Server 2008**. Les durées exactes (1, 2, 2, 4, 8 secondes), le comportement des 30 secondes et la mémorisation de la rapidité sont documentés pour cette version ; **je n'ai pas relu de page équivalente pour Windows 10, 11 ou Server 2019/2022**. Retiens le **principe** (cache d'abord, puis escalade progressive) plus que les chiffres.

## 3. Lecture du réel

Extrait authentique de la page Microsoft de `ipconfig` (lue le 2026-11-07) :

```
ipconfig [/allcompartments] [/all] [/renew [<adapter>]] [/release [<adapter>]]
         [/renew6[<adapter>]] [/release6 [<adapter>]] [/flushdns] [/displaydns]
         [/registerdns] [/showclassid <adapter>] [/setclassid <adapter> [<classID>]]
```
- **`/displaydns`** : « Displays the contents of the DNS client resolver cache, which includes both entries preloaded from the local Hosts file and any recently obtained resource records … The DNS Client service uses this information to resolve frequently queried names quickly, before querying its configured DNS servers. » C'est ton instrument d'**observation** : tu vois ce que le poste croit déjà savoir.
- **`/flushdns`** : « Flushes and resets the contents of the DNS client resolver cache. During DNS troubleshooting, you can use this procedure to discard **negative cache entries** from the cache, as well as any other entries that have been added dynamically. » Le mot à retenir : *negative cache entries*.
- **`/registerdns`** : « Initiates manual dynamic registration for the DNS names and IP addresses that are configured at a computer. » Utile pour un poste dont **l'enregistrement dans le DNS** est faux ou manquant (le poste *s'inscrit*, ce n'est pas une requête de résolution).

Lecture de ce que `/flushdns` fait **et ne fait pas** : il vide le cache **du poste**. Il ne vide pas le cache du serveur DNS (qui a le sien), ni le cache du navigateur. Les deux autres caches existent : si le problème persiste après `/flushdns`, ce n'est pas forcément un échec du diagnostic, c'est qu'il faut regarder le niveau suivant. (Navigateur : de ma mémoire, non relu ici.)

## 4. Ce qui casse, symptôme, remontée

| Symptôme | Cause plausible | Remontée |
|---|---|---|
| Le nom ne se résout pas, l'IP répond | Réponse négative mémorisée, ou serveur DNS injoignable | `ipconfig /displaydns`, puis `/flushdns` et nouvel essai ; sinon tester un autre serveur |
| Le poste donne l'ancienne adresse, d'autres la nouvelle | Entrée positive périmée dans le cache du poste (ou entrée dans le fichier Hosts) | `ipconfig /displaydns` ; regarder le fichier Hosts |
| Lenteur de quelques secondes à chaque premier accès | Premier serveur injoignable : l'escalade 1 s, 2 s, 2 s... | Vérifier l'ordre et la joignabilité des serveurs DNS de la carte (voir DHCP, fiche du 24 octobre) |
| Délai dépassé immédiat pendant ~30 s après une panne | Le poste ne réinterroge pas les serveurs d'une carte qui n'a pas répondu | Attendre ou corriger la cause ; ne pas conclure « le DNS est mort » |
| Deux cartes réseau (Wi-Fi + câble, VPN) : réponses incohérentes | Le service interroge **toutes les cartes** en escalade ; un serveur d'une carte donne une réponse négative | Examiner les serveurs DNS de **chaque** carte (`ipconfig /all`) |
| Nom interne non résolu par un poste hors domaine | Serveur DNS public configuré à la place de celui du domaine | `ipconfig /all` : quels serveurs, sur quelle carte |

**Piège de raisonnement :** « j'ai fait `/flushdns`, ça marche, donc c'était le cache » est vrai, mais ne dit **pas pourquoi** le cache contenait une mauvaise réponse. Cherche la cause (changement d'adresse, enregistrement supprimé, serveur qui a répondu négativement un temps).

## 5. Vocabulaire (FR / EN)

| FR | EN | Définition, piège |
|---|---|---|
| résolveur | *resolver* | composant qui résout les noms ; ici le service Client DNS |
| cache du résolveur | *resolver cache* | mémoire locale des réponses ; **piège :** ≠ cache du serveur DNS, ≠ cache du navigateur |
| mise en cache négative | *negative caching* | mémoriser qu'un nom n'existe pas |
| fichier Hosts | *Hosts file* | correspondances locales, chargées dans le cache au démarrage du service |
| réponse positive / négative | *positive / negative response* | **piège :** « négative » ≠ erreur réseau ; c'est une réponse valide « n'existe pas » |
| réponse autoritaire | *authoritative answer* | donnée par un serveur qui fait autorité sur la zone |
| réponse de renvoi | *referral answer* | pointeurs vers d'autres serveurs |
| enregistrement (de ressource) | *(resource) record, RR* | A, CNAME... |
| délai dépassé | *timeout* | pas de réponse dans le temps imparti ; **piège :** ≠ « hors-ligne » |
| carte réseau préférée | *preferred adapter* | celle dont les serveurs sont interrogés d'abord |
| enregistrement dynamique | *dynamic registration / update* | le poste inscrit lui-même son nom et son adresse |
| suffixe DNS | *DNS suffix* | partie de domaine ajoutée aux noms courts |
| vider le cache | *flush the cache* | **faux ami :** *flush* ≠ « rincer », = vider |
| résolution inverse | *reverse lookup* | adresse → nom, domaine `in-addr.arpa` |
| serveur récursif | *recursive server* | accepte de résoudre pour le client |

## 6. Comment le dire juste

**À un collègue (FR) :** « Le poste a mémorisé une réponse négative pour ce nom. J'ai regardé `ipconfig /displaydns`, puis vidé le cache : le nom se résout. Reste à comprendre pourquoi le serveur avait répondu "inexistant" tout à l'heure. »

**À un prestataire / éditeur (FR + EN) :**
- FR : « Pouvez-vous confirmer que l'enregistrement A de ce serveur existe bien dans la zone et quelle est sa durée de vie ? Un de nos postes a mis en cache une réponse négative. »
- EN: "Can you confirm that the A record for this server exists in the zone and what its TTL is? One of our workstations cached a negative response."

**Dans un ticket (FR + EN) :**
- FR : « Poste PC-12, nom `app.interne` non résolu, l'IP répond. `ipconfig /displaydns` : entrée négative. Après `ipconfig /flushdns` : résolution OK. Cause à investiguer côté DNS (enregistrement absent à un instant donné ?). »
- EN: "Workstation PC-12, name `app.internal` not resolving, IP reachable. `ipconfig /displaydns`: negative entry. After `ipconfig /flushdns`: resolves OK. Root cause to investigate on the DNS side (record missing at some point?)."

## 7. Exercice d'observation (20 à 30 minutes, **lab uniquement**)

**Rappel :** uniquement sur ta VM Windows Server 2019 / ton client de lab. **Pas sur un poste ou un serveur de ton employeur.** `ipconfig /displaydns` ne modifie rien ; `/flushdns` ne vide que le cache de la machine de lab.

Hypothèse à écrire d'abord : « Après avoir résolu un nom, il apparaît dans le cache ; après `/flushdns`, il disparaît. »
1. `ipconfig /all` : note les **serveurs DNS** de chaque carte (c'est ce que le §2.3 interroge).
2. `ipconfig /displaydns` : combien d'entrées ? Y reconnais-tu des noms de ton fichier Hosts ?
3. Résous un nom de ton lab (par exemple le nom de ton contrôleur de domaine) avec `ping` ou `nslookup`, puis refais `ipconfig /displaydns`. L'entrée est-elle apparue ?
4. `ipconfig /flushdns`, puis `ipconfig /displaydns` : que reste-t-il ? (La doc dit que les entrées du fichier Hosts sont préchargées dans le cache : en reste-t-il après le vidage ? **je ne sais pas** : à toi d'observer.)
5. Tente de résoudre un nom **inexistant dans ton lab** (un nom inventé), puis regarde le cache : y a-t-il une trace de la réponse négative ? *(De ma mémoire, un message du type « le nom n'existe pas » peut apparaître : non vérifié.)*
6. Écris la phrase de ticket (§6) avec **tes** observations.

<details><summary>Solution</summary>

Il n'y a pas de sortie imposée : tout dépend de ta configuration. Critères : (a) l'étape 3 doit ajouter une entrée ; (b) l'étape 4 doit retirer les entrées dynamiques ; (c) le comportement des entrées Hosts après vidage est à constater : la doc dit qu'elles sont chargées au démarrage du service, `/flushdns` est décrit comme vidant « le cache » ; l'écart éventuel est une information à me renvoyer ; (d) l'étape 5 montre (ou non) le cache négatif. Je n'ai pas exécuté cet exercice.
</details>

## 8. Révision espacée

**D'hier (fiche du 2026-11-06, PR #53) :**
1. Pourquoi un `backdrop-filter` devant un canvas animé coûte-t-il cher à chaque image ?
2. Comment `AuditForm` et `NetworkBackground` communiquent-ils, et quel est le risque ?
3. Quel cas non couvert par la PR as-tu appris à vérifier (hypothèse du décalage) ?

**D'il y a 7 jours (fiche du 2026-10-31, build Windows) :**
1. À quoi correspond le dernier nombre de `10.0.17763.9376` ?
2. NVD écrit `versionEndExcluding 10.0.17763.9376` : une machine en `9376` est-elle vulnérable ?
3. Pourquoi « Windows Update dit qu'il est à jour » ne remplace-t-il pas la lecture du build ?

<details><summary>Réponses</summary>

D'hier : (1) Le navigateur relit ce qui est derrière, le floute et le recompose à chaque image, canvas compris. (2) Par la classe `modal-open` sur `body` ; renommée d'un côté, le fond ne se met plus en pause, sans erreur. (3) Le décalage de mise en page quand `body { overflow: hidden }` fait disparaître la barre de défilement (hypothèse non testée).
Du 31 : (1) La révision (UBR). (2) Non : borne exclue, donc corrigée. (3) Ce message dépend d'une source de mises à jour et d'un état d'interface ; le build est la valeur réellement installée.
</details>

## 9. Trois questions de contrôle

1. Quelles sont les deux sources du cache du résolveur, d'après la doc ?
2. Un poste n'obtient aucune réponse du premier serveur DNS de sa carte : décris l'escalade.
3. Pourquoi `/flushdns` peut-il corriger un symptôme sans en expliquer la cause ?

<details><summary>Réponses</summary>

1. Le fichier Hosts (chargé au démarrage du service) et les enregistrements reçus dans des réponses précédentes. 2. 1 s sur le premier serveur de la carte préférée ; puis premiers serveurs de toutes les cartes (2 s) ; puis tous les serveurs de toutes les cartes (2 s, 4 s, 8 s) ; au-delà, délai dépassé (durées documentées pour Windows Server 2008). 3. Il supprime l'entrée mémorisée (notamment négative) mais ne dit pas pourquoi elle était fausse ; la cause est côté données DNS ou serveur.
</details>

## 10. Sources (consultées le 2026-11-07)

- Microsoft Learn, « ipconfig » : https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/ipconfig (`/displaydns`, `/flushdns`, `/registerdns`).
- Microsoft Learn, « DNS Processes and Interactions » (Windows Server 2008) : https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2008-R2-and-2008/dd197552(v=ws.10) (cache, ordre d'interrogation, durées, réponses positives et négatives, mise en cache de la réponse).
- **Non relu aujourd'hui, de ma mémoire :** cache du navigateur, affichage d'une réponse négative dans `/displaydns`, durées applicables à Windows 10/11 et Server 2019/2022. Une page Microsoft sur les délais du client DNS (`troubleshoot/windows-server/networking/dns-client-resolver-timeouts`) a répondu 404 : je ne m'en sers pas.
