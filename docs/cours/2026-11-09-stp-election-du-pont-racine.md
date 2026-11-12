# Fiche — Arbre recouvrant (STP) : comment les commutateurs élisent le pont racine, et ce que ça change à ton diagnostic

Piste : réseau et commutation (rotation du lundi). Lecture + exercice : 25 à 30 minutes. Pas de tutoriel : tu sais lire `show spanning-tree`. Cette fiche explique **ce que les commutateurs se disent** pour désigner la racine, comment les ports reçoivent un rôle, et pourquoi une racine « par défaut » est un risque.

## 1. Pourquoi ce mécanisme

Dans ton lab Packet Tracer (`Read Me Exercice Packet Tracer Cisco`), les commutateurs sont reliés en étoile par des trunks. Sur un réseau réel, dès qu'il y a des liens redondants, l'arbre recouvrant décide **quels liens servent et lesquels sont bloqués**. Question de diagnostic : « le trafic passe-t-il par le chemin que je crois ? ». Sans règle explicite, la racine est choisie par une **règle d'égalité** (la plus petite adresse MAC), c'est-à-dire par un hasard de fabrication, pas par ton architecture.

## 2. Le mécanisme, pas à pas

*(Sources : cours Cisco Networking Academy, module « Spanning Tree Concepts », copie hébergée par une université, lue le 2026-11-09 ; **source secondaire**, voir §10.)*

### 2.1 Le but
STP désigne un commutateur comme **pont racine** (*root bridge*), point de référence de tous les calculs, puis bloque les chemins redondants. D'après le cours : « chaque instance d'arbre recouvrant (réseau local commuté ou domaine de diffusion) a un commutateur désigné comme pont racine ».

### 2.2 L'identifiant de pont (BID) : trois champs
Le BID est composé de : **priorité de pont**, **identifiant de système étendu** (*extended system ID*) et **adresse MAC** du commutateur. Le plus petit BID gagne.
- **Priorité** : valeur par défaut **32768** sur les commutateurs Cisco, plage 0 à 61440, **par pas de 4096**.
- **Pourquoi des pas de 4096 ?** Le champ de priorité fait 16 bits ; **12 bits** sont pris par l'identifiant de système étendu (qui porte le **numéro de VLAN**), il ne reste que **4 bits** pour la priorité, soit des multiples de 2^12 = 4096. C'est le cours qui l'écrit.
- **Conséquence visible :** pour le VLAN 1, la priorité affichée vaut 32768 + 1 = **32769** (le cours note que dans son exemple « la priorité de tous les commutateurs est 32769 » pour cette raison).
- **Égalité :** à priorité et identifiant étendu égaux, le commutateur dont l'**adresse MAC a la plus petite valeur hexadécimale** a le plus petit BID.

### 2.3 L'élection, étape par étape (BPDU)
Une **BPDU** (*bridge protocol data unit*) est le message que les commutateurs échangent. D'après le cours :
1. **Au démarrage, chaque commutateur se croit racine** : ses BPDU portent son propre BID comme identifiant de racine.
2. **Les BPDU partent toutes les deux secondes** par défaut (minuteur *hello*).
3. À la réception, un commutateur **compare l'identifiant de racine reçu au sien**. Si celui du message est **plus petit**, il met à jour son identifiant de racine et ses propres BPDU annoncent désormais cette racine (avec le coût de chemin mis à jour). S'il est **plus grand**, le message est **ignoré**.
4. De proche en proche, l'information « la plus petite racine » **se propage** : à la fin, tous les commutateurs désignent le même pont racine, celui qui a le plus petit BID.
5. Le cours rappelle : **la priorité décide d'abord ; à priorité égale, la plus petite MAC l'emporte**.
6. Il y a **une racine par instance d'arbre recouvrant**, donc potentiellement plusieurs racines distinctes selon les VLAN (l'identifiant étendu intervient dans la définition des instances).

### 2.4 Le coût de chemin et les rôles des ports
Une fois la racine connue, chaque commutateur calcule le **chemin le moins coûteux** vers elle.
- **Coût par port** selon la vitesse (valeurs par défaut du cours) : 10 Gb/s = 2 ; 1 Gb/s = 4 ; 100 Mb/s = 19 ; 10 Mb/s = 100. Le **coût de chemin** est la **somme** des coûts des ports traversés.
- **Rôles** (d'après le cours) :
  - **Port racine** (*root port*) : le port le plus proche de la racine, **un par commutateur**.
  - **Port désigné** (*designated port*) : tout port non racine qui peut encore faire passer du trafic ; choisi **par lien** ; si une extrémité d'un lien est port racine, l'autre est désignée ; **tous les ports du pont racine sont désignés**.
  - **Port alternatif / de secours** : en état **bloquant** pour éviter la boucle ; un seul bout du lien est bloqué.
  - **Port désactivé** : arrêté.
- Exemple chiffré du cours : de S2 vers la racine S1, le chemin 1 coûte 19 et le chemin 2 coûte 38 ; le chemin 1 est préféré, l'autre est bloqué.

### 2.5 Ce qui n'est pas dans la source lue
Les minuteurs *max age* (20 s) et *forward delay* (15 s) et les états *listening* / *learning* de 802.1D, ainsi que les variantes rapides (RSTP, 802.1w), sont de **ma mémoire** et **non relus** aujourd'hui. Le cours lu précise seulement le minuteur *hello* de 2 secondes.

## 3. Lecture du réel

### 3.1 La trame BPDU authentique décrite par le cours (capture Wireshark commentée)
- **Adresse MAC de destination `01:80:C2:00:00:00`** : adresse multicast du groupe d'arbre recouvrant ; « chaque commutateur configuré pour STP accepte et lit la trame ; tous les autres équipements l'ignorent ».
- **12 champs** : les quatre premiers identifient protocole, version, type de message et indicateurs ; les quatre suivants identifient la **racine** et le **coût du chemin** vers elle ; les quatre derniers sont des **minuteurs** (fréquence d'envoi et durée de conservation de l'information).
- Dans la capture du cours, « l'identifiant de racine et le BID sont les mêmes » : **la trame vient du pont racine**. À retenir : *root ID = BID* dans une BPDU = « c'est la racine qui parle ».

### 3.2 `show spanning-tree` : la forme à reconnaître
Je n'ai pas de sortie réelle copiée aujourd'hui (la figure n'est pas lisible en texte). Le cours dit seulement que « le champ **Cost**, près du haut de la sortie, est le coût total du chemin vers la racine » et que chaque interface affiche un coût de port (19 pour du 100 Mb/s dans son exemple). Voici la **forme** que tu dois retrouver, **écrite de ma mémoire, valeurs inventées, à vérifier sur ton lab** :
```
VLAN0001
  Root ID    Priority    32769
             Address     0001.xxxx.xxxx        <- adresse MAC du pont racine
             Cost        19                    <- coût total vers la racine
             Port        1 (FastEthernet0/1)   <- ton port racine
  Bridge ID  Priority    32769 (priority 32768 sys-id-ext 1)
             Address     0002.yyyy.yyyy        <- ta propre adresse
Interface   Role   Sts   Cost  Prio.Nbr
Fa0/1       Root   FWD   19    128.1
Fa0/2       Altn   BLK   19    128.2
```
Lecture : si `Root ID` et `Bridge ID` portent **la même adresse**, ce commutateur **est** la racine. Sinon, la ligne `Port` te dit par où part le chemin vers la racine. `Role` / `Sts` : rôle du port et son état (`FWD` = fait suivre, `BLK` = bloqué).

## 4. Ce qui casse, symptôme, remontée

| Défaut | Symptôme | Comment remonter |
|---|---|---|
| Racine **non voulue** (aucune priorité réglée) | Trafic qui passe par un petit commutateur d'accès, performances inégales | `show spanning-tree` : l'adresse `Root ID` est celle de quel commutateur ? |
| Ajout d'un commutateur « neuf » avec une MAC plus petite | Il devient racine, la topologie change, coupure brève | Le cours le dit : régler une priorité basse sur la racine voulue « garantit aussi » que l'ajout de nouveaux commutateurs ne change pas l'élection |
| Mélange d'équipements avec et sans identifiant de système étendu | Élections inattendues (finesse différente du BID) | Comparer les priorités affichées (32768 + n° de VLAN) |
| Port bloqué qu'on croyait actif | Un lien redondant « ne sert à rien » | Le port est en rôle alternatif/bloquant : c'est normal, c'est la fonction |
| Boucle de couche 2 si STP désactivé ou mal accordé | Tempête de diffusion, saturation | (Mécanisme : fiche du 26 octobre, inondation de trames) |
| Racines différentes selon les VLAN | Chemins différents par VLAN | Une instance par VLAN : comparer `Root ID` par VLAN |

**Piège de raisonnement :** « tous les liens sont verts donc l'arbre est bon » : un lien actif ne dit rien de **qui est racine**. Lis `Root ID` avant le reste.

## 5. Vocabulaire (FR / EN)

| FR | EN | Définition, piège |
|---|---|---|
| arbre recouvrant | *Spanning Tree Protocol (STP)* | **Piège :** *spanning tree* se traduit « arbre recouvrant », pas « arbre d'étendue » |
| pont racine | *root bridge* | « pont » = *bridge*, vocabulaire hérité ; désigne un commutateur |
| identifiant de pont | *bridge ID (BID)* | priorité + id de système étendu + MAC |
| BPDU | *bridge protocol data unit* | message STP, destination `01:80:C2:00:00:00` |
| priorité de pont | *bridge priority* | défaut 32768, pas de 4096 |
| identifiant de système étendu | *extended system ID* | 12 bits, porte le n° de VLAN |
| coût de port / de chemin | *port cost / path cost* | somme des coûts des ports vers la racine |
| port racine | *root port* | un par commutateur non racine |
| port désigné | *designated port* | un par lien ; tous les ports de la racine |
| port alternatif | *alternate port* | bloquant ; **piège :** ≠ port désactivé |
| état bloquant | *blocking state* | ne fait pas suivre le trafic |
| minuteur d'accueil | *hello timer* | 2 s par défaut (cours lu) |
| convergence | *convergence* | temps pour que tous s'accordent sur l'arbre |
| boucle de couche 2 | *Layer 2 loop* | tempête de diffusion possible |
| faux ami : *bridge* | = pont (équipement ou concept), pas « bridge » du jeu de cartes | |

## 6. Comment le dire juste

**À un collègue (FR) :** « Personne n'avait réglé de priorité : la racine est le commutateur qui a la plus petite adresse MAC, un vieux commutateur d'étage. On fixe une priorité basse sur le cœur, comme ça la racine est celle qu'on veut. »

**À un prestataire / éditeur (FR + EN) :**
- FR : « Pouvez-vous confirmer quel commutateur est pont racine pour le VLAN 10 et quelle priorité est configurée sur le cœur de réseau ? »
- EN: "Can you confirm which switch is the root bridge for VLAN 10 and what priority is configured on the core switch?"

**Dans un ticket (FR + EN) :**
- FR : « Constat : le pont racine du VLAN 10 est SW-ETAGE-2 (priorité 32778, MAC la plus basse du domaine). Effet : chemin sous-optimal. Hypothèse : aucune priorité réglée sur le cœur. Vérification : `show spanning-tree vlan 10` sur chaque commutateur. »
- EN: "Finding: the root bridge for VLAN 10 is SW-FLOOR-2 (priority 32778, lowest MAC in the domain). Effect: suboptimal path. Hypothesis: no priority configured on the core. Check: `show spanning-tree vlan 10` on every switch."
*(Noms et chiffres de ces phrases : illustrations de format, pas des mesures.)*

## 7. Exercice d'observation (20 à 30 minutes, **lab uniquement**)

**Rappel :** Packet Tracer ou GNS3 sur ta machine. **Aucune manipulation sur le réseau de ton employeur** : n'observe pas l'arbre recouvrant de son réseau pour apprendre, c'est ton lab ici.

Dans `projet plateforme.pkt` (3 commutateurs en étoile d'après ton README) :
1. Sur chaque commutateur, relève : `show spanning-tree` pour un VLAN de ton choix. Note pour chacun : `Root ID` (priorité, adresse), `Bridge ID` (priorité, adresse), et pour chaque port : rôle et état.
2. **Hypothèse à écrire avant de regarder les adresses :** « le pont racine est celui qui a la plus petite adresse MAC ; les priorités sont toutes égales ». Vérifie sur les trois sorties.
3. Combien de ports sont en état bloquant ? Si ton étoile n'a pas de lien redondant, **aucun** n'est attendu : pourquoi ?
4. Écris la phrase de ticket (§6) avec **tes** valeurs.
5. Question de réflexion (aucune modification demandée) : si tu ajoutais un lien entre deux commutateurs d'accès, quel port deviendrait bloquant, et selon quel critère (coût de chemin, puis égalité) ?

<details><summary>Solution</summary>

Résultat attendu (**non exécuté par moi**) : si les priorités sont égales, la racine est le commutateur de plus petite adresse MAC ; sur la racine tous les ports sont désignés ; sur les autres, le port vers la racine est « racine » ; dans une étoile sans boucle, rien n'est bloqué. Pour la réflexion : le lien redondant crée une boucle ; le port qui offre le chemin au coût le plus élevé vers la racine passe en alternatif. En cas d'égalité des coûts, d'autres critères départagent (non couverts par la source lue). Si ta sortie diffère de ce schéma, dis-le-moi : je corrige la fiche.
</details>

## 8. Révision espacée

**D'hier (synthèse du 2026-11-08) :**
1. Cite deux des trois fils rouges de la semaine du 2 au 8 novembre.
2. Quelle différence entre *bypass* et *workaround* ?
3. Sur le texte à trous : quel mot complète « no ___ are available » (SonicWall) ?

**D'il y a 7 jours (fiche du 2026-11-02, 802.1Q et VLAN natif) :**
1. Où l'étiquette 802.1Q est-elle insérée et quel est son TPID ?
2. Dans quel VLAN un commutateur place-t-il une trame arrivée sans étiquette sur un trunk ?
3. Avec un VLAN natif 99 d'un côté et 2 de l'autre, le trunk est-il « up » ?

<details><summary>Réponses</summary>

D'hier : (1) Par exemple : le chemin implicite à rendre visible ; déclaré autant que mesuré ; les accès distants exposés. (2) *Bypass* = contourner une protection (l'attaque) ; *workaround* = solution de contournement (la parade temporaire). (3) *workarounds*.
Du 2 : (1) Entre l'adresse source et Type/Longueur ; TPID 0x8100. (2) Dans le VLAN natif de son propre port. (3) Oui, il reste actif.
</details>

## 9. Trois questions de contrôle

1. Quelles sont les trois composantes du BID et dans quel ordre départagent-elles deux commutateurs ?
2. Pourquoi la priorité se règle-t-elle par pas de 4096 ?
3. Un commutateur reçoit une BPDU dont l'identifiant de racine est plus grand que le sien : que fait-il ?

<details><summary>Réponses</summary>

1. Priorité, identifiant de système étendu (n° de VLAN), adresse MAC ; la priorité d'abord, puis, à égalité, la plus petite MAC. 2. 12 des 16 bits du champ sont pris par l'identifiant étendu : il reste 4 bits, donc des multiples de 4096. 3. Il ignore (écarte) la BPDU ; il garde sa propre racine.
</details>

## 10. Sources (consultées le 2026-11-09)

- Cours Cisco Networking Academy (CCNA 3, module 2), copie hébergée par l'université indonésienne qui l'héberge, **source secondaire** : https://ccna.ilkom.unsri.ac.id/3/course/module2/2.1.2.7/2.1.2.7.html (BID et identifiant étendu, priorité) ; …/2.1.2.2/2.1.2.2.html (rôles des ports) ; …/2.1.2.3/2.1.2.3.html (pont racine) ; …/2.1.2.4/2.1.2.4.html (coût de chemin) ; …/2.1.2.5/2.1.2.5.html (format de la BPDU) ; …/2.1.2.6/2.1.2.6.html (propagation des BPDU).
- Je n'ai **pas** pu lire la documentation Cisco originale sur STP : une URL tentée (`…/5234-5.html`) renvoie une page sans rapport (programme de remplacement de composants mémoire) ; je ne m'en sers pas.
- **Non relu aujourd'hui, de ma mémoire :** minuteurs *max age* et *forward delay*, états *listening* / *learning*, RSTP, critères de départage au-delà du coût de chemin, forme exacte de `show spanning-tree`.
