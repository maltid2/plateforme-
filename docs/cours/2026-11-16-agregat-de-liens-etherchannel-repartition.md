# Fiche — Agrégat de liens (EtherChannel) : ce qu'il répartit, et selon quel critère

Piste : réseau et commutation (rotation du lundi). Lecture + exercice : 25 à 30 minutes. Pas de tutoriel : tu sais créer un port-channel. Cette fiche explique **ce que fait l'équipement d'une trame** quand plusieurs liens physiques en forment un seul, pourquoi **un seul flux n'utilise jamais deux liens à la fois**, et pourquoi quatre liens ne donnent pas toujours « quatre fois plus ».

## 1. Pourquoi ce mécanisme

« J'ai agrégé quatre liens de 1 Gb/s, mais le transfert ne dépasse pas 1 Gb/s », ou « un lien est saturé et les autres sont presque vides ». Ce n'est pas une panne : c'est la **règle de répartition**. Elle décide **quel lien porte quelle trame**, et ce choix est fait par un calcul sur les adresses, pas par la charge instantanée.

## 2. Le mécanisme, pas à pas

*(Source : document Cisco « Understand EtherChannel Load Balance and Redundancy on Catalyst Switches », lu le 2026-11-16. Il décrit des plateformes **Catalyst anciennes** (6500, 4500, 3550…) ; les détails varient selon la plateforme et la version, je le précise à chaque point.)*

### 2.1 Un seul lien logique, plusieurs liens physiques
Le document pose l'objectif : un agrégat « permet le partage de charge du trafic entre les liens du canal, ainsi que la **redondance** en cas de panne d'un ou plusieurs liens ». Contraintes de formation citées pour le Catalyst 6500 : jusqu'à **huit** ports compatibles ; **même vitesse** ; tous en couche 2 **ou** tous en couche 3.

### 2.2 Le choix du lien : un calcul sur les adresses
« EtherChannel réduit une partie du motif binaire que forment les adresses de la trame à une **valeur numérique** qui sélectionne l'un des liens du canal. » Détails du document :
- l'algorithme de hachage est **propriétaire** (Cisco) ;
- il est **déterministe** : « si vous utilisez les mêmes adresses et les mêmes informations de session, vous aboutissez **toujours au même port** » ;
- conséquence indiquée : « cette méthode **empêche la livraison de paquets dans le désordre** » ;
- sur le Catalyst 6500/6000 décrit, il calcule une valeur de **0 à 7**, et chaque port a un **masque** qui indique les valeurs qu'il accepte.

### 2.3 La répartition des valeurs entre les ports (tableau authentique du document)
| Nombre de ports dans le canal | Rapport de charge |
|---|---|
| 8 | 1:1:1:1:1:1:1:1 |
| 7 | 2:1:1:1:1:1:1 |
| 6 | 2:2:1:1:1:1 |
| 5 | 2:2:2:1:1 |
| 4 | 2:2:2:2 |
| 3 | 3:3:2 |
| 2 | 4:4 |
Lecture : avec huit valeurs possibles (0 à 7), **huit** ports reçoivent chacun une valeur ; avec **quatre** ports, chacun reçoit **deux** valeurs ; avec **trois** ports, deux ports en reçoivent trois et le dernier deux (3:3:2). Le document en tire la conséquence : « vous ne pouvez obtenir une répartition parfaite, même avec des adresses aléatoires, qu'avec **deux, quatre ou huit** ports ».
Deux remarques du document à retenir : « vous **ne pouvez pas contrôler** le port qu'un flux particulier utilise » et « l'algorithme de hachage **ne peut pas être configuré ni changé** » ; seul le **mode de distribution** (quelles adresses entrent dans le calcul) est configurable.

### 2.3bis Ce qui entre dans le calcul : la méthode de répartition
Commande globale (document, plateforme 6500/IOS) :
`port-channel load-balance {src-mac | dst-mac | src-dst-mac | src-ip | dst-ip | src-dst-ip | src-port | dst-port | src-dst-port | mpls}`
et vérification : `show etherchannel load-balance`. Le document précise que le mode se règle **globalement** et **non par port** (« applies to all EtherChannels configured on the switch ») et que les options **varient selon la plateforme**.
Exemple de lecture du document pour la méthode « source MAC » (Catalyst 3550/2900XL décrits) : « les paquets de **différents hôtes** utilisent des ports **différents** du canal, mais les paquets d'un **même hôte** utilisent le **même** port ».

### 2.4 Prédire le lien d'une trame : `test etherchannel load-balance`
Le document montre une commande de **simulation** (sans trafic réel), sortie authentique :
```
6509-sp#test etherchannel load-balance interface port-channel 1 ip 10.10.10.2 10.10.10.1
Would select Gi6/1 of Po1
6509-sp#test etherchannel load-balance interface port-channel 1 mac 00d0.c0d7.2dd4 0002.fc26.2494
Would select Gi6/1 of Po1
```
Lecture : on donne **les adresses** (IP, ou MAC, ou ports de couche 4) et l'équipement répond « **choisirait Gi6/1 du Po1** ». C'est un **outil d'observation** : il dit quel lien porterait ce flux, sans l'envoyer. (Disponibilité de la commande selon plateforme : d'après le document, plusieurs plateformes la proposent, avec des paramètres différents.)

### 2.5 La négociation : PAgP (lu) et LACP (de ma mémoire)
Le document décrit **PAgP** (*Port Aggregation Protocol*, propriétaire Cisco) : des paquets PAgP sont échangés entre ports pour **négocier** la formation du canal. Il écrit : « les modes PAgP sont `off`, `auto`, `desirable` et `on`. **Seules** les combinaisons `auto`–`desirable`, `desirable`–`desirable` et `on`–`on` permettent la formation d'un canal. » PAgP ne groupe pas des ports de **vitesses ou duplex différents**, et exige que les ports soient dans le **même VLAN** ou tous en trunk.
**LACP** (le protocole ouvert, norme IEEE) n'est **pas** décrit dans ce document. De ma mémoire, **non relue aujourd'hui** : ses modes sont `active` et `passive` (formation avec active–active ou active–passive, pas passive–passive), PAgP et LACP ne dialoguent pas entre eux. Un résumé secondaire trouvé par recherche dit la même chose, mais je ne l'ai pas lu à la source.

### 2.6 Ce que la source ne couvre pas
Les plateformes actuelles (méthode par défaut, taille du hachage, options de couche 4) : **non lues**. Le document décrit des plateformes anciennes. Ne copie pas ses chiffres (« 0 à 7 », huit ports) sur ton matériel sans vérifier sa documentation.

## 3. Lecture du réel

Extrait authentique (document Cisco, §2.3) : « Therefore, you can only achieve perfect load balancing, even with random addresses, if you have **two, four, or eight ports** in the port channel. » et « You cannot control the port that a particular flow uses. »

Lecture pas à pas d'un cas : un canal de **trois** ports, rapport 3:3:2. Les 8 valeurs de hachage sont réparties : deux ports en prennent 3, un en prend 2. Si les flux sont variés, le **troisième port reçoit en moyenne moins de trafic** (2/8 contre 3/8). Ce n'est pas un défaut de configuration, c'est le **dénominateur** : 8 ne se divise pas en 3.
Cas d'un **flux unique** (un seul couple d'adresses) : l'algorithme est déterministe, donc **tous les paquets de ce flux** vont sur **le même port**. Il ne dépassera jamais le débit d'un lien. C'est le prix de « pas de paquets dans le désordre ».

## 4. Ce qui casse, symptôme, remontée

| Symptôme | Cause plausible | Remontée |
|---|---|---|
| Un transfert unique plafonne à 1 Gb/s sur un agrégat de 4 Gb/s | Un flux = un lien (hachage déterministe) | Normal ; tester avec plusieurs flux ou changer la méthode (`src-dst-ip`, couche 4) |
| Un lien saturé, les autres peu utilisés | Peu de variété dans les adresses du critère | `show etherchannel load-balance` ; `test etherchannel load-balance` avec des adresses réelles |
| Mauvaise répartition avec 3 ou 6 ports | 8 valeurs ne se divisent pas en 3 ou 6 | Rapport 3:3:2 / 2:2:1:1:1:1 (document) ; préférer 2, 4 ou 8 ports |
| Le canal ne se forme pas | Modes incompatibles (par exemple `auto`–`auto`) | Modes aux deux bouts ; vitesses et duplex identiques ; même VLAN ou trunk |
| Un seul côté configuré en `on` | Pas de négociation : l'autre bout ne sait pas qu'il y a un canal | Configurer les deux bouts de la même façon (de ma mémoire pour le risque de boucle) |
| Un lien tombe et le débit baisse | Redondance : les flux du lien en panne passent sur les autres | Document : « le trafic qui utilisait ce lien utilise le lien suivant » |

**Piège de raisonnement :** « agréger n'a rien donné » est faux : l'agrégat apporte **redondance** et **capacité globale pour de nombreux flux**, pas la **vitesse d'un flux unique**.

## 5. Vocabulaire (FR / EN)

| FR | EN | Définition, piège |
|---|---|---|
| agrégat de liens | *link aggregation / EtherChannel / port-channel* | **Piège :** *EtherChannel* = nom Cisco ; *LAG* = terme générique |
| canal de ports | *port channel* | interface logique regroupant les liens |
| répartition de charge | *load balancing (distribution)* | **Piège :** ≠ répartition « égale » : c'est une répartition par hachage |
| hachage | *hash* | réduit des adresses à une valeur |
| déterministe | *deterministic* | mêmes entrées, même résultat |
| paquets dans le désordre | *out-of-order delivery* | ce que le hachage par flux évite |
| flux | *flow* | ensemble de trames d'une même conversation |
| méthode de distribution | *frame distribution method* | `src-mac`, `src-dst-ip`… |
| port de membre | *member port / bundle member* | lien physique du canal |
| protocole d'agrégation de ports | *PAgP (Port Aggregation Protocol)* | propriétaire Cisco |
| protocole de contrôle d'agrégation de liens | *LACP (Link Aggregation Control Protocol)* | ouvert, norme IEEE |
| mode `desirable` / `auto` | *desirable / auto mode* | PAgP : initie / attend |
| mode `active` / `passive` | *active / passive mode* | LACP (de ma mémoire) |
| redondance | *redundancy* | continuité si un lien tombe |
| faux ami : *trunk* | = lien multi-VLAN (Cisco) | **Piège :** chez d'autres éditeurs, *trunk* désigne l'agrégat |

## 6. Comment le dire juste

**À un collègue (FR) :** « Il n'y a pas de panne : un transfert unique reste sur un seul lien de l'agrégat, parce que le hachage de l'adresse donne toujours le même port. L'agrégat sert pour plusieurs flux et pour la redondance. »

**À un prestataire / éditeur (FR + EN) :**
- FR : « Pouvez-vous confirmer la méthode de répartition configurée sur le port-channel et si elle inclut les adresses IP et les ports de couche 4 ? »
- EN: "Can you confirm the load-balancing method configured on the port-channel and whether it includes IP addresses and Layer 4 ports?"

**Dans un ticket (FR + EN) :**
- FR : « Agrégat Po1 (4 liens de 1 Gb/s) entre SW-A et SW-B. Constat : un lien à 95 % d'utilisation, les trois autres à moins de 10 %. Méthode : `src-mac`. Hypothèse : peu de variété d'adresses source. Action : relever `show etherchannel load-balance`, simuler le choix du lien avec `test etherchannel load-balance` pour les flux concernés, évaluer `src-dst-ip`. »
- EN: "Po1 (4 x 1 Gb/s) between SW-A and SW-B. Finding: one link at 95% utilization, the other three below 10%. Method: `src-mac`. Hypothesis: little variety in source addresses. Action: capture `show etherchannel load-balance`, simulate link selection with `test etherchannel load-balance` for the affected flows, evaluate `src-dst-ip`."
*(Chiffres de ces phrases : illustrations de format, pas des mesures.)*

## 7. Exercice d'observation (20 à 30 minutes, **lab uniquement**)

**Rappel :** Packet Tracer ou GNS3 sur ta machine. **Aucune manipulation d'apprentissage sur le réseau de ton employeur.** Dans ton lab (`projet plateforme.pkt`, commutateurs en étoile d'après ton README) :
1. Relève si ton lab contient **déjà** un agrégat (`show etherchannel summary`). S'il n'y en a pas, l'exercice se limite aux questions de réflexion (étapes 4 et 5) : ne reconfigure rien d'important.
2. Si un agrégat existe : note les ports membres, le **mode** de chaque côté, et la méthode (`show etherchannel load-balance`).
3. Si ton simulateur propose `test etherchannel load-balance` (**je ne sais pas** si Packet Tracer le propose), compare le lien choisi pour deux couples d'adresses.
4. **Hypothèse sans manipulation :** avec 4 liens, un hôte A envoie à un hôte B un seul gros transfert : combien de liens sont utilisés ? Et avec 3 liens et 100 flux variés : la charge est-elle égale ?
5. Écris la phrase de ticket (§6) avec **tes** valeurs, ou « aucun agrégat dans le lab ».

<details><summary>Solution</summary>

Étape 4 : un seul lien (flux unique, hachage déterministe) ; avec 3 liens et des flux variés, la charge tend vers 3:3:2 sur les huit valeurs, donc le troisième lien en porte moins (d'après le document, plateforme décrite). Je n'ai pas exécuté cet exercice et ne sais pas si ton simulateur reproduit ce comportement : si tu observes autre chose, dis-le-moi.
</details>

## 8. Révision espacée

**D'hier (synthèse du 2026-11-15) :**
1. Quel est le fil rouge « s'ouvrir ou se fermer par défaut » (*fail-open / fail-closed*) ? Donne un exemple de la semaine.
2. Que retient le DC locator quand plusieurs contrôleurs répondent ?
3. Pourquoi `gpupdate /force` n'est-il pas un outil de diagnostic ?

**D'il y a 7 jours (fiche du 2026-11-09, STP) :**
1. Quelles sont les trois composantes du BID et dans quel ordre départagent-elles deux commutateurs ?
2. Pourquoi la priorité se règle-t-elle par pas de 4096 ?
3. Que fait un commutateur qui reçoit une BPDU dont l'identifiant de racine est plus grand que le sien ?

<details><summary>Réponses</summary>

D'hier : (1) Par défaut, une condition qui autorise tout sauf ce qu'on a interdit, par exemple `NODE_ENV !== "production"` qui sert la CSP de développement. (2) Le premier qui répond. (3) Il réapplique tout et change l'état ; pour observer, on utilise `gpresult`.
Du 9 : (1) Priorité, identifiant de système étendu (n° de VLAN), adresse MAC ; la priorité d'abord. (2) 12 des 16 bits du champ sont pris par l'identifiant étendu. (3) Il l'ignore.
</details>

## 9. Trois questions de contrôle

1. Pourquoi un transfert unique ne dépasse-t-il pas le débit d'un lien de l'agrégat ?
2. Pourquoi un agrégat de 3 liens se répartit-il moins bien qu'un agrégat de 4 ?
3. Quelles combinaisons de modes PAgP forment un canal, d'après le document ?

<details><summary>Réponses</summary>

1. Le hachage est déterministe : mêmes adresses, même port ; cela évite aussi les paquets dans le désordre. 2. Huit valeurs de hachage se divisent mal en 3 (3:3:2) et bien en 4 (2:2:2:2). 3. `auto`–`desirable`, `desirable`–`desirable` et `on`–`on`.
</details>

## 10. Sources (consultées le 2026-11-16)

- Cisco, « Understand EtherChannel Load Balance and Redundancy on Catalyst Switches » : https://www.cisco.com/c/en/us/support/docs/lan-switching/etherchannel/12023-4.html (hachage déterministe 0–7, masques et rapports de charge, méthodes de distribution, commande `test etherchannel load-balance`, modes PAgP, redondance).
- **De ma mémoire, non relu aujourd'hui :** LACP (modes active/passive, norme IEEE, incompatibilité avec PAgP), comportement des plateformes actuelles, risque lié à une configuration d'un seul côté. Un résumé secondaire trouvé par recherche (non lu à la source) concorde sur LACP. Le document Cisco décrit des plateformes anciennes : à vérifier sur ta documentation de matériel.
