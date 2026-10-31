# Fiche — Ce que fait un commutateur quand une trame arrive pour une adresse MAC inconnue

Piste : réseau et commutation (rotation du lundi). Lecture : 25 à 30 minutes, exercice compris. Tu sais configurer, câbler et dépanner : ici, **ce qui se passe dans le commutateur** et les mots exacts pour le dire. Aucun tutoriel de configuration.

## 1. Pourquoi ce mécanisme, et ce qu'il change dans ton diagnostic

Trois symptômes de terrain se ramènent à la même mécanique : un trafic « qui arrive là où il ne devrait pas », un trafic qui ne passe que dans un sens, et une connectivité qui revient d'elle-même au bout de quelques minutes. Dans les trois cas, la question est : **qu'a appris le commutateur, sur quel port, pour quel VLAN, et depuis quand ?** Savoir répondre avec précision, c'est lire la table d'adresses MAC comme un témoin, pas comme une liste.

## 2. Le mécanisme, étape par étape

Une trame Ethernet arrive sur le port **P**. Le commutateur fait, dans cet ordre :

**Étape 1 — Classer la trame dans un VLAN.** Sur un port d'accès, le VLAN est celui du port ; sur un trunk, c'est celui de l'étiquette 802.1Q portée par la trame. Tout ce qui suit se fait **par VLAN** : une même adresse MAC est une entrée distincte dans chaque VLAN.

**Étape 2 — Apprendre (learning).** Le commutateur lit l'adresse **source** et la lie au port d'arrivée. Cisco l'écrit ainsi pour sa gamme Nexus : « The switch dynamically builds the address table by using the MAC source address of the frames received. » Si l'adresse était déjà connue, le minuteur de vieillissement de l'entrée est remis à zéro ; si elle était connue sur un **autre** port, l'entrée est mise à jour (un *déplacement de MAC*).

**Étape 3 — Chercher la destination** dans la table, **pour ce VLAN**. Trois cas :

| Cas | Ce que fait le commutateur |
|---|---|
| destination trouvée sur le port **Q ≠ P** | envoie la trame **uniquement** vers Q |
| destination trouvée sur **P** lui-même | ne la renvoie pas (le destinataire est déjà du même côté) : c'est le *filtrage* (comportement général, cité de mémoire) |
| destination **inconnue** (*unknown unicast*) | **inonde** (*floods*) : « it floods the frame to all LAN ports of the same VLAN except the port that received the frame » (Cisco, guide Nexus 3000) |

Une trame de **diffusion** (adresse destination `ffff.ffff.ffff`) est, elle aussi, envoyée sur tous les ports du VLAN sauf le port d'arrivée (comportement général, de mémoire).

**Étape 4 — Apprendre au retour.** Quand la machine destinataire répond, le commutateur lit **son** adresse source et l'apprend. Cisco le décrit pour ses Nexus : une fois la station répondue, le commutateur ajoute son adresse et son port. Les trames suivantes sont envoyées sur **un seul port**, « without flooding all LAN ports ».

**Étape 5 — Oublier (aging).** Une entrée dynamique est supprimée si la machine reste silencieuse trop longtemps. Pour la gamme Catalyst 9500 sous IOS XE 16.10, le guide de sécurité Cisco donne : durée de vieillissement par défaut **300 secondes**, réglable de **10 à 1 000 000 secondes**, **0 désactive le vieillissement**, et c'est « the length of time that a dynamic entry remains in the MAC address table after the entry is used or updated » ; les entrées **statiques** ne sont jamais vieillies. La valeur par défaut dépend de la plate-forme (le guide Nexus 3000 donne 300 s pour NX-OS 5500 et 1800 s pour les séries 5600 et 6000) : **vérifie la valeur de ton modèle**. Une fois l'entrée supprimée, la trame suivante vers cette machine **inonde de nouveau** jusqu'à ce qu'elle parle.

**Étape 6 — Où est la table ?** Sur les Catalyst 9000, Cisco distingue deux bases : la table **logicielle** (*IOS MATM*) et la table **matérielle** (*FED MATM*), celle qui commute réellement : « Locally switch traffic utilizes FED MATM to forward packets in hardware (Data Plane) ». Une adresse nouvelle est d'abord vue par le matériel, qui la remonte au logiciel, tout en l'écrivant lui-même. Cela explique qu'un diagnostic commence souvent par la table logicielle mais qu'une incohérence entre les deux puisse casser le trafic.

### MAC contre ARP : deux tables, deux questions
| | Table d'adresses MAC | Table ARP |
|---|---|---|
| Question | « sur quel **port** est cette adresse MAC ? » | « quelle adresse **MAC** correspond à cette adresse IP ? » |
| Tenue par | le commutateur (niveau 2) | l'hôte ou le routeur (niveau 3 vers 2) |
| Clé | VLAN + adresse MAC | adresse IP |

Les deux se complètent : l'hôte demande en diffusion « qui a 192.168.1.3 ? » (ARP, inondé dans le VLAN), apprend l'adresse MAC, puis envoie une trame unicast que le commutateur sait acheminer parce qu'il a appris l'adresse MAC source de la réponse ARP.

## 3. La lecture du réel

Extrait authentique du document Cisco « Troubleshoot Mac Address Table Manager on Catalyst 9000 Switches » (lu le 2026-10-26) :

```
Switch#show ip arp 192.168.1.3
Protocol  Address       Age (min)  Hardware Addr    Type  Interface
Internet  192.168.1.3   6          9c54.1631.8bd1   ARPA  Vlan100     <-- ARP résolu sur le VLAN 100

Switch#show mac address-table address 9c54.1631.8bd1
          Mac Address Table
-------------------------------------------
Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
 100    9c54.1631.8bd1    DYNAMIC     Te2/1/1
Total Mac Addresses for this criterion: 1
```

| Champ | Lecture |
|---|---|
| `Address` (ARP) | l'adresse IP résolue : 192.168.1.3 |
| `Age (min)` : 6 | cette entrée ARP a 6 minutes (durée côté ARP, distincte du vieillissement MAC) |
| `Hardware Addr` : 9c54.1631.8bd1 | l'adresse MAC liée à cette IP, point de jonction avec la table MAC |
| `Interface` : Vlan100 | l'interface de niveau 3 du VLAN 100 |
| `Vlan` : 100 | l'entrée MAC **est propre à ce VLAN** |
| `Type` : DYNAMIC | apprise par observation de l'adresse source ; une entrée STATIC aurait été saisie à la main |
| `Ports` : Te2/1/1 | le port derrière lequel le commutateur a vu cette adresse (TenGigabitEthernet 2/1/1) |
| `Total Mac Addresses for this criterion: 1` | une seule entrée correspond au filtre `address` |

La même page décrit un cas de panne : une passerelle (un SVI, interface virtuelle de VLAN) dont l'adresse MAC **n'apparaît pas** dans la table logicielle (« IOS does not have SVI 100 Mac Address programmed at all (unexpected) ») ; l'équipe Cisco le traduit par une absence de connectivité, et la méthode est instructive : on suit la **réponse** capturée, on compare l'adresse MAC **destination** de la trame (`70:6b:b9:29:f7:51`) avec celle de l'interface (`706b.b929.f751`), puis on cherche cette adresse dans la table.

Même document, décodage de trame capturée : les protocoles listés sont `eth:ethertype:vlan:ethertype:ip:icmp` (la présence de `vlan` montre une trame **étiquetée 802.1Q**), et pour l'adresse source le décodeur indique « LG bit: Globally unique address (factory default) » et « IG bit: Individual address (unicast) ». Ces deux bits sont des bits de l'adresse MAC elle-même : le premier dit si l'adresse est d'origine constructeur ou administrée localement, le second dit si elle est individuelle (unicast) ou de groupe (diffusion et multidiffusion) (le sens exact des bits est donné de mémoire, seule leur étiquette est lue).

## 4. Ce qui casse, et le symptôme

| Défaut | Symptôme sur le terrain | Comment remonter à la cause |
|---|---|---|
| Machine silencieuse ou **trafic asymétrique** (le commutateur ne voit jamais l'adresse source de la machine) | trafic vers elle **inondé en permanence** : charge inutile, autres hôtes du VLAN qui voient des trames qui ne leur sont pas destinées | l'adresse destination n'est pas dans la table : qui devrait l'avoir émise, et où ? |
| Vieillissement plus court que le cycle des échanges | « ralentissements » périodiques, retours de flood | comparer la durée de vieillissement au rythme du trafic ; côté Cisco, un message de communauté indique que la durée MAC doit être supérieure ou égale à l'ARP pour éviter l'inondation (cas d'un 3750, source secondaire non officielle) |
| **Même adresse MAC sur deux ports** qui alternent | entrée qui « saute » d'un port à l'autre, perte de paquets ; en pratique : boucle, adresse dupliquée, machine virtuelle déplacée | observer l'entrée à deux instants : le port change-t-il ? |
| Incohérence **table logicielle / matérielle** | connectivité absente alors que `show mac address-table` paraît correct | comparer la table logicielle avec la table matérielle (cas décrit par Cisco) |
| Table remplie par un attaquant (saturation, *MAC flooding*) | le commutateur ne peut plus apprendre et inonde davantage ; le trafic d'autres hôtes devient visible | nombre d'adresses par port ; défense classique : limiter le nombre d'adresses par port (de mémoire, non vérifié ici) |
| Changement de topologie de l'arbre recouvrant | quelques secondes d'inondation et de connectivité instable | ligne de journal, moment du changement ; les forums Cisco indiquent un vieillissement abaissé à 15 s avec 802.1D (secondaire, non officiel) |

Rappel de prudence : **n'essaie aucune de ces situations sur le réseau de ton employeur** (pas de boucle volontaire, pas de saturation de table). Tout se fait dans ton laboratoire.

## 5. Vocabulaire du jour (14 termes)

| Français | Anglais | Définition exacte / piège |
|---|---|---|
| table d'adresses MAC | *MAC address table* (souvent *CAM table*) | lie VLAN + adresse MAC à un port. *CAM* désigne la **mémoire** qui l'héberge, pas la table elle-même |
| apprentissage | *learning* | lire l'adresse **source** d'une trame et la lier au port d'arrivée |
| inondation | *flooding* | envoyer une trame sur tous les ports du VLAN sauf celui d'arrivée |
| unicast inconnu | *unknown unicast* | trame dont l'adresse destination individuelle n'est pas dans la table |
| diffusion | *broadcast* | trame à `ffff.ffff.ffff`, reçue par tout le VLAN |
| vieillissement | *aging* | suppression d'une entrée dynamique après inactivité |
| entrée dynamique / statique | *dynamic / static entry* | apprise automatiquement / saisie à la main, jamais vieillie |
| déplacement de MAC | *MAC move* | la même adresse apparaît sur un autre port |
| domaine de diffusion | *broadcast domain* | ensemble des ports qui reçoivent une diffusion : en pratique **un VLAN**. À ne pas confondre avec le *domaine de collision*, notion de l'Ethernet partagé que la commutation a fait disparaître sur les liens en duplex intégral |
| trame / paquet | *frame / packet* | trame = niveau 2 (Ethernet), paquet = niveau 3 (IP). Un commutateur traite des **trames** |
| table ARP | *ARP table / ARP cache* | lie une adresse IP à une adresse MAC ; **n'est pas** la table MAC |
| SVI | *Switch Virtual Interface* | interface de niveau 3 d'un VLAN sur un commutateur |
| bit I/G, bit U/L | *I/G bit, U/L bit* (affiché « IG », « LG » par le décodeur) | bits d'adresse : individuelle ou de groupe ; universelle (constructeur) ou locale |
| hub / commutateur / pont | *hub / switch / bridge* | un concentrateur répète sur tous les ports ; un commutateur apprend et sélectionne ; « pont » est le terme historique du même principe |

Faux amis et approximations du métier : « le switch apprend les IP » est faux, **il apprend des adresses MAC** (le commutateur de niveau 2 ne regarde pas l'IP) ; « le switch broadcast » désigne souvent à tort une inondation d'unicast inconnu ; « table CAM » dit en vrac pour « table MAC ».

## 6. Comment le dire juste

**Pour un collègue :** « Le switch n'a pas l'adresse MAC du serveur dans le VLAN 100, donc il inonde le trafic vers lui sur tous les ports du VLAN. Il l'apprendra dès que le serveur émettra. »

**Pour un prestataire ou un éditeur** (FR puis EN) :
- FR : « Nous observons une inondation d'unicast inconnu vers l'adresse 9c54.1631.8bd1 sur le VLAN 100 : l'entrée MAC disparaît, alors que le serveur répond. Pouvez-vous confirmer le temps de vieillissement et si la table matérielle correspond à la table logicielle ? »
- EN: "We see unknown-unicast flooding towards 9c54.1631.8bd1 in VLAN 100: the MAC entry disappears although the server replies. Could you confirm the aging time and whether the hardware table matches the software table?"

**Dans un ticket** (FR puis EN) :
- FR : « Symptôme : trafic vers 192.168.1.3 reçu sur des ports qui ne sont pas le sien. Constat : l'entrée MAC du VLAN 100 est absente par moments. Hypothèse : vieillissement ou trafic asymétrique. Vérifications : durée de vieillissement, présence de l'entrée sur deux relevés espacés, port d'apprentissage. »
- EN: "Symptom: traffic to 192.168.1.3 is received on ports other than its own. Finding: the VLAN 100 MAC entry is intermittently missing. Hypothesis: aging or asymmetric traffic. Checks: aging time, presence of the entry in two spaced readings, learning port."

## 7. Exercice de diagnostic (20 à 30 minutes, **dans ton laboratoire** Packet Tracer ou GNS3, jamais sur le réseau de l'employeur)

Table **inventée par MINERVE** (aucune mesure réelle) d'un commutateur à six ports :

```
Vlan   Mac Address      Type     Ports
10     aaaa.0000.0001   DYNAMIC  Fa0/1
10     aaaa.0000.0002   DYNAMIC  Fa0/2
10     aaaa.0000.0003   DYNAMIC  Gi0/1   (trunk, VLAN 10 et 20 autorisés)
20     aaaa.0000.0004   DYNAMIC  Fa0/4
```
Ports : Fa0/1 et Fa0/2 en VLAN 10 ; Fa0/3 en VLAN 10 ; Fa0/4 et Fa0/5 en VLAN 20 ; Gi0/1 en trunk (VLAN 10 et 20).

1. Une trame du VLAN 10 arrive sur Fa0/1 pour `aaaa.0000.0002`. Où sort-elle ?
2. Une trame du VLAN 10 arrive sur Fa0/1 pour `aaaa.0000.0009` (absente de la table). Où sort-elle ?
3. Une trame de diffusion arrive sur Fa0/4 (VLAN 20). Où sort-elle ?
4. L'adresse `aaaa.0000.0002` émet maintenant depuis Fa0/3 au lieu de Fa0/2. Que devient l'entrée ?
5. Dans **ton** lab : fais un ping entre deux PC d'un même VLAN, **commutateur éteint puis rallumé** (table vide). En mode **simulation**, suis la première trame ARP puis la première trame ICMP. Où chaque trame est-elle inondée, et à partir de quand devient-elle unicast ?

<details>
<summary>Solution</summary>

1. Uniquement sur Fa0/2 (destination connue, VLAN 10).
2. Sur tous les ports du VLAN 10 sauf Fa0/1 : Fa0/2, Fa0/3 et le trunk Gi0/1 (qui transporte le VLAN 10). Pas sur Fa0/4 ni Fa0/5 (VLAN 20).
3. Sur Fa0/5 (VLAN 20) et sur le trunk Gi0/1 (qui transporte le VLAN 20), pas sur Fa0/1, Fa0/2, Fa0/3 (VLAN 10).
4. L'entrée est mise à jour : `aaaa.0000.0002` est désormais liée à Fa0/3 (déplacement de MAC).
5. Observation attendue (à confirmer dans ton lab, je ne l'ai pas testé) : la requête ARP est une diffusion, donc inondée dans le VLAN ; la réponse ARP est unicast et fait apprendre l'adresse du répondant ; l'ICMP suivant est envoyé sur un seul port dès que le commutateur a appris les deux adresses.
</details>

## 8. Révision espacée

Fiche de la veille : la synthèse du 25 octobre. Il n'existe pas de fiche vieille de sept jours (la première date du 22 octobre) ; je reprends donc des questions des fiches des jours précédents.

1. (DHCP, 24 octobre) À quel moment un client renouvelle-t-il son bail, et que change-t-il à T2 ?
2. (Avis de dépendance, 23 octobre) Pourquoi `npm update` ne corrige-t-il pas Next 14.2.35 ?
3. (Synthèse, 25 octobre) Distingue gravité, exploitation et applicabilité.

<details>
<summary>Réponses</summary>

1. À T1 (0,5 × bail par défaut) auprès du serveur d'origine ; à T2 (0,875 × bail), il diffuse la demande à n'importe quel serveur.
2. La plage `^14.2.35` ne franchit pas le majeur et les correctifs ne sont listés que pour les branches 15 et 16.
3. Gravité : le score. Exploitation : catalogue CISA ou déclaration de l'éditeur. Applicabilité : les conditions de l'avis face à ta configuration.
</details>

## 9. Trois questions de contrôle

1. Quelle adresse un commutateur apprend-il dans une trame, la source ou la destination, et pourquoi ?
2. Quelle est la différence entre la table d'adresses MAC et la table ARP ?
3. Que se passe-t-il, dans l'ordre, quand une entrée MAC vieillit alors que la machine est encore là ?

<details>
<summary>Réponses</summary>

1. La **source** : c'est la seule qui dit qui a émis la trame et sur quel port ; la destination est ce qu'on cherche.
2. La table MAC (commutateur) lie VLAN + adresse MAC à un port ; la table ARP (hôte ou routeur) lie une adresse IP à une adresse MAC.
3. L'entrée est supprimée ; la prochaine trame vers cette machine est inondée dans le VLAN ; la machine répond ; le commutateur apprend de nouveau son adresse source ; les trames suivantes repassent en unicast.
</details>

## 10. Sources (consultées le 2026-10-26)

- Cisco, « Troubleshoot Mac Address Table Manager on Catalyst 9000 Switches » : https://www.cisco.com/c/en/us/support/docs/switches/catalyst-9300-series-switches/222060-troubleshoot-mac-address-table-manager-o.pdf — sorties `show ip arp` et `show mac address-table address`, table logicielle et matérielle, décodage de trame (LG/IG, VLAN), cas de panne du SVI.
- Cisco, Nexus 3000 NX-OS Layer 2 Switching Configuration Guide 10.1(x), « Configuring MAC Address Tables » : https://www.cisco.com/c/en/us/td/docs/switches/datacenter/nexus3000/sw/layer2/93x/configuration/guide/b-cisco-nexus-3000-nx-os-layer-2-configuration-guide-101x/b-cisco-nexus-3000-nx-os-layer-2-configuration-guide-93x_chapter_01011.html — apprentissage par l'adresse source, inondation vers les ports du même VLAN sauf l'entrant, destination connue = un seul port ; valeurs de vieillissement Nexus.
- Cisco, Security Configuration Guide, IOS XE Gibraltar 16.10.x (Catalyst 9500), « Port Security MAC Aging » : https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9500/software/release/16-10/configuration_guide/sec/b_1610_sec_9500_cg/b_1610_sec_9500_cg_chapter_0101011.html — vieillissement par défaut de 300 s, plage 10 à 1 000 000 s, 0 désactive, entrées statiques jamais vieillies.
- Source secondaire (non officielle, citée avec réserve) : Cisco Community, discussions sur le vieillissement et l'inondation d'unicast : https://community.cisco.com/t5/networking-knowledge-base/when-the-mac-address-is-deleted-on-a-catalyst-3750-series-switch/ta-p/3110015 (page refusée à la lecture ; contenu connu par un résumé de recherche web du 2026-10-26).
- Non vérifié aujourd'hui (de mémoire) : le comportement du filtrage quand destination et source sont sur le même port ; le traitement de la diffusion ; le détail exact des bits I/G et U/L ; la défense par limitation d'adresses par port ; la valeur de 15 s pendant un changement de topologie.
