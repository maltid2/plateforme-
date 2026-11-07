# Fiche — L'étiquette 802.1Q et le VLAN natif : ce qu'il y a dans le trame, et pourquoi un désaccord fait « fuir » un VLAN

Piste : réseau et commutation (rotation du lundi). Lecture + exercice : 25 à 30 minutes. Pas de tutoriel : tu sais déjà monter un trunk. Cette fiche explique **ce que l'équipement met sur le fil**, et te donne les mots pour le dire.

## 1. Pourquoi ce mécanisme

Ton lab Packet Tracer (`Read Me Exercice Packet Tracer Cisco`) a des trunks entre commutateurs et un routeur en *router-on-a-stick* avec des sous-interfaces. Dans cette architecture, **chaque trame qui traverse un trunk porte (ou ne porte pas) une étiquette**. Quand « ça marche pour les VLAN 10 et 20 mais pas pour un seul », la question utile n'est plus « le trunk est-il monté ? » mais **« cette trame-là est-elle étiquetée, et par qui est-elle lue ? »**. C'est la clé du diagnostic du VLAN natif.

## 2. Le mécanisme, pas à pas

### 2.1 Où se trouve l'étiquette
D'après la documentation Cisco (« Inter-Switch Link and IEEE 802.1Q Frame Format », lue le 2026-11-02) : 802.1Q insère un **champ de 4 octets dans la trame Ethernet d'origine, entre l'adresse source (SA) et le champ Type/Longueur**. La trame est donc modifiée, et le commutateur **recalcule le FCS**.

```
Avant :  DA | SA |          TYPE/LEN | DATA | FCS
Après :  DA | SA | TAG(4) | TYPE/LEN | DATA | FCS (recalculé)
```

### 2.2 Les quatre champs de l'étiquette (16 + 3 + 1 + 12 = 32 bits)
| Champ | Taille | Rôle (d'après la doc Cisco citée) |
|---|---|---|
| **TPID** (*Tag Protocol Identifier*) | 16 bits | Vaut **0x8100** : c'est ce qui dit « cette trame est étiquetée 802.1Q ». |
| **Priority** (PCP, 802.1p) | 3 bits | Niveau de priorité, 8 valeurs (0 à 7), pour la qualité de service. |
| **CFI** (*Canonical Format Indicator*) | 1 bit | 0 = adresse MAC au format canonique, 1 = non canonique. |
| **VID** (*VLAN Identifier*) | 12 bits | Le numéro du VLAN. La doc écrit « entre 0 et 4095 ». |

Deux remarques de ma part, à vérifier si tu les utilises : (a) 12 bits donnent 4096 valeurs, mais les valeurs 0 et 4095 sont **réservées** par la norme (de mémoire, norme non relue aujourd'hui) : on en déduit en pratique 4094 VLAN utilisables ; (b) la doc Cisco appelle le champ de 1 bit « CFI », la révision actuelle de la norme l'a renommé (de mémoire : DEI, *Drop Eligible Indicator*), non vérifié ici.

**Taille :** l'étiquette fait 4 octets ; la trame peut donc atteindre **1522 octets** (doc Cisco), contre 1518 sans étiquette (chiffre de ma mémoire, non relu).

### 2.3 Le VLAN natif : la trame qui n'a pas d'étiquette
Toujours d'après la même doc : « 802.1Q **ne marque pas** les trames du VLAN natif. Il marque toutes les autres trames émises et reçues sur le trunk. » Et : « Quand vous configurez un trunk 802.1Q, vous devez vous assurer de configurer **le même VLAN natif des deux côtés**. »

Conséquence mécanique, côté **réception** :
1. Une trame arrive sur le trunk, **avec** étiquette (TPID 0x8100) : le commutateur lit le VID et la place dans ce VLAN.
2. Une trame arrive **sans** étiquette : il n'y a aucune information de VLAN dans la trame. Le commutateur lui attribue **le VLAN natif configuré sur son propre port**, et rien d'autre.

Côté **émission** : une trame du VLAN natif local part **sans** étiquette. Si l'autre extrémité a un VLAN natif différent, elle la classera dans **son** VLAN natif.

### 2.4 Le désaccord, étape par étape
Exemple (celui de la documentation de cours Cisco lue, VLAN 99 d'un côté, VLAN 2 de l'autre) :
1. Le commutateur A a le VLAN natif 99, le commutateur B le VLAN natif 2.
2. Un hôte du VLAN 99 émet ; A envoie la trame **sans étiquette** (c'est son VLAN natif).
3. B reçoit une trame **sans étiquette** et la place dans **son** VLAN natif : le VLAN 2.
4. Résultat : le trafic du VLAN 99 **apparaît dans le VLAN 2**. C'est le « VLAN leaking » de la doc de cours.
5. Les autres VLAN (tous étiquetés) passent normalement : **le trunk reste « up » et fonctionne en partie**.

C'est tout ce qui rend ce défaut vicieux : il ne coupe rien d'évident.

## 3. Lecture du réel

### 3.1 Le message de journal authentique (cours Cisco, mirroir de l'université de Tartu, lu le 2026-11-02)
```
*Mar  1 06:45:26.232: %CDP-4-NATIVE_VLAN_MISMATCH: Native VLAN mismatch discovered on FastEthernet0/1 (2), with S2 FastEthernet0/1 (99).
```
- `*Mar  1 06:45:26.232` : horodatage ; l'astérisque en tête signifie, de mémoire, que l'horloge n'est pas synchronisée (non relu).
- `%CDP-4-NATIVE_VLAN_MISMATCH` : le message vient de **CDP** (*Cisco Discovery Protocol*), niveau **4** (*warning*), mnémonique `NATIVE_VLAN_MISMATCH`.
- `FastEthernet0/1 (2)` : le port **local** et **son** VLAN natif (2).
- `with S2 FastEthernet0/1 (99)` : le voisin (nom S2), son port et **son** VLAN natif (99).
Ce message est un signal utile : c'est CDP qui compare les deux extrémités, pas la couche 2 elle-même. Si CDP est désactivé sur le lien, **le message n'apparaît pas et le défaut subsiste**.

### 3.2 Ce que montre `show interfaces trunk`
Je n'ai pas relevé de sortie réelle aujourd'hui (la page contenant la figure n'est pas lisible en texte). Voici la **forme** que tu dois retrouver, **écrite de ma mémoire, valeurs inventées pour l'exemple, à vérifier sur ton équipement de lab** :
```
Port   Mode   Encapsulation  Status    Native vlan
Fa0/1  on     802.1q         trunking  2
```
Colonnes à lire dans cet ordre : **Status** (le trunk est-il actif ?), **Encapsulation** (802.1q ?), **Native vlan** (la valeur à comparer avec l'autre bout). La doc de cours lue précise que la commande sert à vérifier « l'état du trunk, le VLAN natif utilisé et l'établissement du trunk », et que **le trunk peut être actif malgré le désaccord**.

## 4. Ce qui casse, symptôme, remontée

| Symptôme | Cause probable | Comment remonter |
|---|---|---|
| Les hôtes d'un VLAN ne se voient pas à travers le trunk alors que les autres VLAN fonctionnent | VLAN natif différent des deux côtés | `show interfaces trunk` des deux côtés : comparer la colonne « Native vlan » |
| Un hôte reçoit du trafic d'un autre VLAN (broadcast, DHCP d'un mauvais VLAN) | Fuite entre les deux VLAN natifs | Le message CDP ; adresse IP reçue dans le mauvais sous-réseau |
| Message `NATIVE_VLAN_MISMATCH` en boucle | Désaccord permanent | Aligner les deux côtés |
| Rien dans les journaux mais le défaut existe | CDP désactivé sur le lien | Ne pas se fier au silence ; relever les deux côtés |
| Le routeur ne répond pas pour un VLAN précis (*router-on-a-stick*) | La sous-interface du VLAN natif est configurée comme étiquetée alors que le commutateur envoie sans étiquette (ou l'inverse) | Comparer ce que le commutateur envoie (non étiqueté) et ce que la sous-interface attend. *(Le mot-clé `native` sur la sous-interface vient de ma mémoire, non relu : vérifie-le dans ton lab.)* |

**Piège de raisonnement :** un trunk « up » ne prouve pas que les deux extrémités sont d'accord. L'état du trunk (négociation) et l'accord sur le VLAN natif sont **deux choses différentes**.

## 5. Vocabulaire (FR / EN)

| FR | EN | Définition, piège |
|---|---|---|
| étiquette 802.1Q | *802.1Q tag* | 4 octets insérés entre SA et Type/Long. |
| identifiant de protocole d'étiquette | *TPID* | 16 bits, 0x8100 |
| priorité (802.1p) | *priority / PCP* | 3 bits, 8 niveaux, qualité de service |
| identifiant de VLAN | *VID (VLAN ID)* | 12 bits |
| VLAN natif | *native VLAN* | VLAN dont les trames passent **sans** étiquette. **Piège :** ce n'est pas le VLAN « de gestion » ni le VLAN 1 par définition |
| trame étiquetée / non étiquetée | *tagged / untagged frame* | « untagged » = sans étiquette ; faux ami : *untagged* n'est pas « sans VLAN », c'est « VLAN natif implicite » |
| port d'accès | *access port* | un seul VLAN, trames **sans** étiquette |
| trunk (lien en mode trunc) | *trunk* | **Piège :** en réseau Cisco = lien multi-VLAN ; chez d'autres éditeurs, *trunk* désigne l'agrégat de liens (*LAG*). Précise le contexte |
| fuite de VLAN | *VLAN leaking / VLAN hopping* (attaque) | **Piège :** la fuite par désaccord n'est pas l'attaque *VLAN hopping* |
| désaccord de VLAN natif | *native VLAN mismatch* | message CDP |
| recalculer le FCS | *recompute the FCS* | la trame change, donc son contrôle aussi |
| MTU / taille de trame | *frame size* | 1522 octets avec étiquette (doc Cisco) |
| double étiquette | *QinQ / double-tagged frame* | une 2e étiquette « métro » ajoutée par l'opérateur |
| sous-interface | *subinterface* | une interface logique par VLAN sur le routeur |
| CDP | *Cisco Discovery Protocol* | protocole propriétaire de découverte de voisins |

## 6. Comment le dire juste

**À un collègue (FR) :** « Le trunk est monté, mais le VLAN natif n'est pas le même des deux côtés : 2 chez nous, 99 chez le voisin. Les trames non étiquetées du 99 arrivent dans le 2. »

**À un prestataire / éditeur (FR + EN) :**
- FR : « Pouvez-vous confirmer le VLAN natif configuré sur le port du lien montant ? Nous avons un message de désaccord CDP. »
- EN: "Could you confirm the native VLAN configured on the uplink port? We are seeing a CDP native VLAN mismatch message."

**Dans un ticket (FR + EN) :**
- FR : « Lien SW1 Fa0/1 – SW2 Fa0/1 : trunk 802.1Q actif, VLAN natif 2 côté SW1 et 99 côté SW2 (message CDP). Effet : trafic du VLAN 99 reçu dans le VLAN 2. Action : aligner le VLAN natif des deux côtés, relever les deux sorties de `show interfaces trunk`. »
- EN: "Link SW1 Fa0/1 – SW2 Fa0/1: 802.1Q trunk is up, native VLAN 2 on SW1 and 99 on SW2 (CDP message). Effect: VLAN 99 traffic received in VLAN 2. Action: align the native VLAN on both ends and capture `show interfaces trunk` from both."

## 7. Exercice d'observation (20 à 30 minutes, **lab uniquement**)

**Rappel :** Packet Tracer ou GNS3 sur ta machine. **Aucune manipulation sur le réseau de ton employeur.** Observation seulement : tu regardes, tu ne reconfigures pas pour apprendre sur un équipement réel.

Dans ton lab (`projet plateforme.pkt`) :
1. Choisis un lien trunk entre deux commutateurs. Relève, **des deux côtés**, la ligne du port dans `show interfaces trunk` (Status, Encapsulation, Native vlan).
2. Dans le mode simulation de Packet Tracer, envoie un ping entre deux machines du même VLAN, à travers ce trunk. Ouvre le détail d'une PDU au niveau de la couche 2 sur le lien trunk et note : **y a-t-il une étiquette 802.1Q ? Quel VID ?**
3. Fais la même chose pour une trame du **VLAN natif** du trunk. *Hypothèse à écrire avant de regarder : devrait-elle être étiquetée ?*
4. Écris, en deux phrases, ce qui arriverait à cette trame du VLAN natif si l'autre extrémité avait un VLAN natif différent.

<details><summary>Solution</summary>

Pour une trame d'un VLAN **non natif**, tu dois voir une étiquette avec le VID du VLAN. Pour une trame du VLAN natif, **aucune étiquette** : c'est la prédiction de la doc Cisco. (Je n'ai pas exécuté cet exercice : si Packet Tracer ne montre pas ce que décrit cette fiche, c'est la fiche qu'il faut questionner et me le dire.) Étape 4 : l'autre bout la classerait dans **son** VLAN natif ; la trame réapparaît dans un autre VLAN.
</details>

## 8. Révision espacée

**D'hier (synthèse du 2026-11-01) :**
1. Quelle est la différence entre la table MAC et la table ARP ?
2. Pourquoi un `EXPLAIN` qui annonce `rows = 2` ne prouve-t-il rien sur le nombre réel de lignes ?
3. Une CVE a le seuil `versionEndExcluding 10.0.17763.9376` : que dis-tu d'une machine en `9376` ?

**D'il y a 7 jours (fiche du 2026-10-26, trame vers MAC inconnue) :**
1. Que fait un commutateur quand la destination d'une trame est une MAC inconnue ?
2. Dans quel périmètre cette inondation se fait-elle ?
3. Qu'est-ce qui fait disparaître une entrée de la table MAC ?

<details><summary>Réponses</summary>

D'hier : (1) MAC : « quel port pour cette MAC ? » ; ARP : « quelle MAC pour cette IP ? ». (2) C'est une estimation du moteur. (3) Corrigée (borne exclue).
Du 26 : (1) Il l'envoie sur tous les ports du **même VLAN**, sauf celui d'entrée. (2) Le VLAN. (3) Le vieillissement (délai sans trame reçue de cette MAC ; 300 s par défaut dans la doc Catalyst 9500 citée ce jour-là, selon la plateforme).
</details>

## 9. Trois questions de contrôle

1. Où est insérée l'étiquette 802.1Q dans la trame, et quelle valeur de TPID l'identifie ?
2. Une trame arrive **sans étiquette** sur un trunk. Dans quel VLAN la classe le commutateur ?
3. VLAN natif 99 d'un côté, 2 de l'autre : quel trafic fuit, lequel passe normalement, et le trunk est-il « up » ?

<details><summary>Réponses</summary>

1. Entre l'adresse source et Type/Longueur ; TPID 0x8100. 2. Dans le VLAN natif configuré **sur son propre port**. 3. Les trames du VLAN 99 émises sans étiquette arrivent dans le VLAN 2 ; les VLAN étiquetés passent normalement ; oui, le trunk reste actif.
</details>

## 10. Sources (consultées le 2026-11-02)

- Cisco, « Inter-Switch Link and IEEE 802.1Q Frame Format » : https://www.cisco.com/c/en/us/support/docs/lan-switching/8021q/17056-741-4.html (structure de l'étiquette, TPID 0x8100, champs, 1522 octets, native non étiquetée, « même VLAN natif des deux côtés »).
- Cours Cisco Networking Academy, module 3.2.4.3 (copie hébergée par l'université de Tartu, **source secondaire**) : https://courses.cs.ut.ee/all/MTAT.08.003/mat/2mrs/course/module3/3.2.4.3/3.2.4.3.html (message `%CDP-4-NATIVE_VLAN_MISMATCH`, exemple 99 / 2, trunk actif malgré le désaccord).
- Non relu aujourd'hui, de mémoire : valeurs réservées 0 et 4095, renommage CFI → DEI, taille 1518 sans étiquette, astérisque de l'horodatage, forme exacte de `show interfaces trunk`, mot-clé `native` des sous-interfaces. Les pages communautaires Cisco citées par la recherche n'ont pas été lisibles (protection anti-robot) : je ne m'en sers pas.
