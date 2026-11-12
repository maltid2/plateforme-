# Fiche — Le poste qui n'obtient pas d'adresse : cycle de vie DHCP côté client et repli en 169.254

Piste : poste de travail et support (rotation du samedi). Lecture : 25 à 30 minutes, exercice compris. Pas de configuration : ce qui se passe sur le fil et dans la tête du client.

## 1. Pourquoi ce mécanisme, et ce qu'il change dans ton diagnostic

Le ticket classique : « le poste n'a plus de réseau ». Tu regardes l'adresse du poste et tu vois **169.254.x.x**. Beaucoup de techniciens disent alors « problème DHCP ». C'est juste, mais incomplet : tu dois pouvoir dire **quel message n'est pas passé, entre quels équipements, et pourquoi le poste s'est donné une adresse tout seul**. Dans ton lab Packet Tracer (`Read Me Exercice Packet Tracer Cisco`), le DHCP est servi par le routeur, avec un réseau segmenté en VLAN et un routage inter-VLAN en *router-on-a-stick* : tu as donc déjà configuré ce que cette fiche explique de l'intérieur. Ici, pas de commande : le mécanisme et les mots.

## 2. Le mécanisme, étape par étape

### 2.1 Obtenir une adresse (quatre messages)
Le poste n'a aucune adresse et ne connaît aucun serveur. Il parle donc à **tout le monde sur son segment** :

1. **DHCPDISCOVER** : le client envoie en **diffusion** (*broadcast*) sur son réseau local physique : « y a-t-il un serveur DHCP ? » (RFC 2131, §3.1, étape 1 : « The client broadcasts a DHCPDISCOVER message on its local physical subnet »).
2. **DHCPOFFER** : un ou plusieurs serveurs proposent une adresse. Le client « collecte les offres pendant un certain temps et en choisit une » ; le critère est laissé à l'implémentation (RFC 2131, §4.4.1 : par exemple la première offre reçue, ou celle du serveur déjà utilisé précédemment).
3. **DHCPREQUEST** : le client accepte une offre précise (ce message est diffusé : les autres serveurs comprennent que leur offre est déclinée, point que je cite de mémoire sans l'avoir relu dans la RFC).
4. **DHCPACK** : le serveur confirme et fixe les paramètres (adresse, masque, passerelle, DNS, durée du bail).

Avant d'utiliser l'adresse, le client « SHOULD perform a final check on the parameters (e.g., ARP for allocated network address) » ; si l'adresse est déjà utilisée, il « MUST send a DHCPDECLINE message to the server and restart the configuration process » (RFC 2131, §3.1, étape 5). C'est le mécanisme derrière le message de Windows « adresse IP en conflit ».

### 2.2 Le bail et ses deux horloges
L'adresse est **prêtée** pour une durée : le **bail** (*lease*). Le client ne reste pas silencieux jusqu'à l'expiration :

| État | Déclencheur | Ce que fait le client |
|---|---|---|
| **BOUND** | bail obtenu | utilise l'adresse |
| **RENEWING** | horloge **T1** | demande au serveur qui l'a accordé de prolonger (DHCPREQUEST adressé à lui) |
| **REBINDING** | horloge **T2**, sans réponse | demande à **n'importe quel** serveur, en diffusion (« This message MUST be broadcast to the 0xffffffff IP broadcast address », RFC 2131, §4.3.2) |
| **retour au départ** | bail expiré | abandonne l'adresse et recommence par un DHCPDISCOVER |

D'après la RFC 2131 (page 40, lue dans le texte officiel) : **T1 vaut par défaut 0,5 × la durée du bail, T2 vaut 0,875 × la durée du bail**, avec un peu d'aléa pour éviter que tous les clients renouvellent en même temps ; les serveurs peuvent changer ces valeurs par options. Exemple (arithmétique, pas une mesure) : pour un bail de 8 heures, T1 tombe à 4 h et T2 à 7 h.

### 2.3 Traverser un routeur : le relais
Le DISCOVER est une diffusion : un routeur ne la transmet pas. Si le serveur n'est pas sur le même réseau local que le client, un **agent de relais** (*relay agent*, « a host or router that passes DHCP messages between clients and servers », RFC 2131, §1.5) reçoit la diffusion et la transmet au serveur en écrivant sa propre adresse dans le champ `giaddr` ; le serveur répond alors au relais (§4.1 : quand `giaddr` n'est pas nul, il envoie les réponses au port serveur du relais). Sur Cisco, on met en général en œuvre cette fonction avec la commande `ip helper-address` (citée de mémoire, non vérifiée aujourd'hui).

### 2.4 Quand personne ne répond : l'adresse « de lien » 169.254
Si aucun serveur ne répond, certains systèmes se donnent une adresse tout seuls. La documentation Microsoft appelle cela **APIPA** (*Automatic Private IP Addressing*) ; la norme IETF (RFC 3927) parle d'**adresses IPv4 de lien local** (*link-local*). Ce que dit la RFC 3927 (texte lu) :
- le préfixe **169.254/16** est réservé à cet usage ; un poste choisit au hasard entre 169.254.1.0 et 169.254.254.255 (les 256 premières et dernières adresses sont réservées) ;
- avant de la prendre, il envoie **3 sondes ARP** (*PROBE_NUM* = 3), espacées au hasard de 1 à 2 secondes, après une attente aléatoire d'au plus 1 seconde ; s'il reçoit une réponse, il en tire une autre et recommence ;
- **un routeur ne doit jamais transmettre un paquet dont la source ou la destination est en 169.254** (« A router MUST NOT forward a packet with an IPv4 Link-Local source or destination address »).

Conséquence directe pour le support : un poste en 169.254.x.x peut au mieux parler à d'autres machines du **même segment**. Il n'atteindra ni la passerelle (pas de passerelle par défaut) ni Internet, et il n'a **aucun** moyen de t'indiquer *pourquoi* le DHCP a échoué : il le sait seulement parce qu'il n'a rien reçu.

## 3. La lecture du réel

Extrait authentique du texte de la RFC 2131 (Table 1 : champs d'un message DHCP), commenté champ par champ :

```
op      1  1 = BOOTREQUEST, 2 = BOOTREPLY
htype   1  type de matériel (1 = Ethernet 10 Mb)
hlen    1  longueur de l'adresse matérielle (6 pour Ethernet)
hops    1  « Client sets to zero, optionally used by relay agents »
xid     4  numéro de transaction, « a random number chosen by the client »
secs    2  secondes écoulées depuis le début de l'acquisition ou du renouvellement
flags   2  le bit de gauche = BROADCAST (B)
ciaddr  4  adresse IP du client ; « only filled in if client is in BOUND, RENEW or REBINDING state and can respond to ARP requests »
yiaddr  4  « 'your' (client) IP address » : l'adresse offerte
siaddr  4  adresse du serveur pour l'étape suivante du démarrage réseau
giaddr  4  adresse de l'agent de relais
chaddr 16  adresse matérielle du client
```

| Champ | Ce que ça t'apprend en diagnostic |
|---|---|
| `xid` | associe une offre à une demande : une trame DHCPOFFER dont le `xid` ne correspond à aucun DISCOVER est ignorée |
| `secs` | un `secs` qui grandit dans des DISCOVER répétés = le client insiste, personne ne répond |
| `ciaddr` | à zéro dans un DISCOVER (le client n'a pas d'adresse) ; renseigné dans un renouvellement |
| `yiaddr` | l'adresse que le serveur propose : à comparer avec le réseau attendu pour le VLAN |
| `giaddr` | à zéro si le serveur est sur le même segment ; sinon l'adresse de l'interface du relais : elle indique **par quel réseau** la requête est arrivée, et donc **quel pool** le serveur choisit |
| `chaddr` | l'adresse MAC du client, clé de ses liaisons |

Lecture complémentaire, documentation Microsoft de `ipconfig` (lue) : `ipconfig /all` affiche la configuration complète de chaque carte ; `/release` envoie un DHCPRELEASE (message de libération) et, pour une carte configurée en automatique, « désactive TCP/IP » pour cette carte ; `/renew` renouvelle la configuration DHCP ; la page précise que la commande sert à voir quelles valeurs viennent de DHCP, d'APIPA ou d'une configuration alternative.

Je n'ai **pas** de sortie authentique de `show ip dhcp binding` ou d'`ipconfig /all` : la page de référence Cisco que j'ai essayée n'existe pas à cette adresse et la page d'un manuel est refusée. Je préfère ne pas t'en inventer une. Dans ton lab, tu obtiendras ces sorties toi-même (exercice 7).

## 4. Ce qui casse, et le symptôme

| Défaut classique | Symptôme observable | Comment remonter à la cause |
|---|---|---|
| Le DISCOVER n'atteint pas le serveur (mauvais VLAN du port, VLAN absent de la liste autorisée du trunk, sous-interface du routeur éteinte ou mal étiquetée) | poste en **169.254.x.x** ; le journal du serveur ne voit rien | suivre la trame de diffusion port par port : où disparaît-elle ? |
| Le serveur reçoit, mais n'a pas de pool pour ce réseau | idem : aucune offre | le `giaddr` ou l'interface d'arrivée détermine le pool : le pool du VLAN existe-t-il ? |
| Pool épuisé (tous les baux pris) | postes anciens fonctionnent, **nouveaux** postes en 169.254 | table des baux du serveur vs taille du pool |
| Conflit d'adresse (une machine en adresse fixe dans la plage dynamique) | message de conflit, DHCPDECLINE, adresse changée | le DECLINE du client + sonde ARP : qui répond pour cette adresse ? |
| Poste déplacé dans un autre VLAN, bail encore valide | garde l'**ancienne adresse** (mauvais réseau) jusqu'au renouvellement : à T1 il joint un serveur qui ne répond plus, à T2 il diffuse | `ipconfig /release` puis `/renew`, ou attendre ; l'adresse ne correspond pas au réseau du port |
| Relais absent (serveur sur un autre réseau) | 169.254 partout, sur ce segment seulement | la diffusion ne traverse pas le routeur (§2.3) |

Raisonnement appliqué à ton lab (déduction à partir de ton compte-rendu, **non observée** par moi) : avec un routeur en *router-on-a-stick*, le DHCP d'un VLAN dépend de la sous-interface de ce VLAN ; si l'étiquette 802.1Q d'un trunk ne correspond pas, le DISCOVER n'arrive jamais sur la bonne sous-interface et le poste retombe en 169.254.

## 5. Vocabulaire du jour (14 termes)

| Français | Anglais | Définition exacte / piège |
|---|---|---|
| bail | *lease* | durée pendant laquelle une adresse est prêtée. Faux ami : *rental* n'est pas utilisé |
| diffusion | *broadcast* | message à toutes les machines du segment ; **ne franchit pas un routeur** |
| domaine de diffusion / de collision | *broadcast domain / collision domain* | un domaine de diffusion = tout ce qui reçoit une diffusion (un VLAN) ; la collision est un concept d'Ethernet partagé, quasi disparu en commutation. Ne pas les confondre |
| agent de relais | *relay agent* | équipement qui transmet les messages DHCP entre clients et serveur situés sur des réseaux différents |
| transaction | *transaction (xid)* | identifiant aléatoire qui associe réponse et demande |
| renouvellement | *renewal (T1)* | demande de prolongation au serveur d'origine |
| réassociation | *rebinding (T2)* | demande de prolongation à n'importe quel serveur |
| libération | *release* | le client rend son adresse (DHCPRELEASE) |
| refus | *decline* | le client refuse une adresse déjà utilisée (DHCPDECLINE) |
| adresse de lien local | *link-local address* | adresse valable sur un seul segment, jamais routée (169.254/16) |
| APIPA | *Automatic Private IP Addressing* | nom Microsoft de l'attribution automatique en 169.254 |
| sonde ARP | *ARP probe* | requête ARP avec adresse source à zéro pour tester si une adresse est libre |
| liaison | *binding* | association adresse IP / identifiant client conservée par le serveur |
| étendue / pool | *scope / pool* | plage d'adresses distribuables. *Scope* chez Microsoft, *pool* chez Cisco |

Pièges et approximations du métier : « DHCP ne marche pas » ne dit pas **quel message** manque ; « l'IP est en APIPA » est du vocabulaire Microsoft, la norme dit *link-local* ; « le bail est de 8 h » ne dit pas quand le poste renouvelle (T1, à mi-bail).

## 6. Comment le dire juste

**Pour un collègue :** « Le poste est en 169.254 : son DISCOVER n'a obtenu aucune offre. Je vérifie si la diffusion arrive sur la sous-interface du VLAN et si le pool existe. »

**Pour un prestataire ou un éditeur** (FR puis EN) :
- FR : « Sur le VLAN 20, les clients restent en 169.254.x.x ; le serveur ne journalise aucun DHCPDISCOVER. Pouvez-vous confirmer que le relais est configuré pour ce VLAN ? »
- EN: "On VLAN 20, clients fall back to 169.254.x.x and the server logs no DHCPDISCOVER. Could you confirm the relay is configured for this VLAN?"

**Dans un ticket** (FR puis EN) :
- FR : « Symptôme : poste en adresse de lien local 169.254.x.x, passerelle absente. Hypothèse : le DHCPDISCOVER n'atteint pas le serveur. Vérifications : VLAN du port, liste des VLAN autorisés sur le trunk, état de la sous-interface, pool du VLAN. »
- EN: "Symptom: workstation has a link-local address (169.254.x.x) and no default gateway. Hypothesis: the DHCPDISCOVER does not reach the server. Checks: port VLAN, trunk allowed-VLAN list, sub-interface state, VLAN pool."

## 7. Exercice de diagnostic (20 à 30 minutes, **dans ton laboratoire** Packet Tracer ou GNS3, jamais sur le réseau de l'employeur)

Scénario **inventé par MINERVE** (aucune mesure réelle) : un PC du VLAN 20 affiche l'adresse 169.254.37.12, le masque 255.255.0.0 et aucune passerelle. La sous-interface du routeur pour le VLAN 20 est active, un pool 192.168.20.0/24 existe sur le routeur, et la liste des VLAN autorisés sur le trunk entre le commutateur d'accès et le routeur contient les VLAN 10 et 30.

1. Quel message le PC a-t-il envoyé, et lequel n'a-t-il jamais reçu ?
2. Pourquoi 169.254.37.12 et pas 192.168.20.x ? Combien de sondes ARP le PC a-t-il envoyées avant de s'attribuer cette adresse ?
3. Quelle est ton hypothèse la plus probable ? Quelles **trois observations** en mode **simulation** de Packet Tracer la confirmeraient (par exemple : où la trame de diffusion s'arrête) ?
4. Dans ton lab, ouvre `ipconfig /all` sur un PC en DHCP qui fonctionne : repère l'adresse du serveur DHCP et la durée du bail. Calcule T1 et T2 (0,5 et 0,875 du bail).

<details>
<summary>Solution</summary>

1. Il a envoyé un DHCPDISCOVER (diffusion) et n'a reçu aucun DHCPOFFER.
2. Parce que, sans offre, il s'est attribué une adresse de lien local dans 169.254/16 (RFC 3927) ; il a envoyé 3 sondes ARP avant de la prendre (PROBE_NUM = 3).
3. Hypothèse : le VLAN 20 n'est pas autorisé sur le trunk, donc la diffusion du VLAN 20 est supprimée avant d'atteindre le routeur. Observations en simulation : (a) la trame de diffusion (DISCOVER) part du PC et arrive sur le commutateur d'accès ; (b) elle est abandonnée au niveau du port trunk au lieu d'atteindre la sous-interface ; (c) aucune trame ne revient au PC. Autre hypothèse à écarter : la sous-interface n'a pas la bonne encapsulation 802.1Q.
4. Exemple arithmétique : bail de 8 h → T1 = 4 h, T2 = 7 h. Le bail réel dépend de ta configuration ; l'affichage exact d'`ipconfig /all` dans Packet Tracer est à vérifier dans ton lab (je ne l'ai pas testé).
</details>

## 8. Révision espacée

Fiche d'hier (2026-10-23) : « Lire un avis de vulnérabilité de dépendance ». Il n'existe pas de fiche vieille de sept jours ; je reprends donc une question de la fiche « De l'URL à la réponse » (22 octobre).

1. Pourquoi `npm update` ne corrige-t-il pas Next 14.2.35 pour les avis critiques ?
2. Distingue gravité, exploitation et applicabilité, avec un exemple.
3. (Fiche du 22 octobre) Dans l'ordre, quelles sont les quatre étapes entre une URL et une réponse, et à quelle étape intervient la résolution de nom ?

<details>
<summary>Réponses</summary>

1. La plage `^14.2.35` ne franchit pas le majeur, et les versions corrigées ne sont listées que pour les branches 15 et 16 : il faut changer la plage dans `package.json`.
2. Gravité : le score (9,5). Exploitation : catalogue KEV ou déclaration de l'éditeur. Applicabilité : les conditions de l'avis face à ta configuration (Windows seulement pour GHSA-p293).
3. DNS, TCP, TLS, HTTP ; la résolution de nom est la première étape (DNS) : c'est elle qui donne l'adresse sur laquelle TCP se connecte.
</details>

## 9. Trois questions de contrôle

1. Pourquoi un poste en 169.254.x.x ne peut-il pas atteindre la passerelle, même si elle est allumée ?
2. À quel moment un client renouvelle-t-il son bail, et que change-t-il à T2 ?
3. Pourquoi le champ `giaddr` est-il important pour le choix du pool ?

<details>
<summary>Réponses</summary>

1. Il n'a pas de passerelle par défaut, et les paquets en 169.254 ne doivent jamais être routés (RFC 3927, §7) : il ne communique qu'avec son propre segment.
2. À T1 (0,5 × bail par défaut), il demande à son serveur d'origine ; à T2 (0,875 × bail), s'il n'a pas eu de réponse, il diffuse la demande à n'importe quel serveur.
3. Il contient l'adresse de l'agent de relais, donc le réseau par lequel la requête est arrivée ; le serveur s'en sert pour choisir le bon pool.
</details>

## 10. Sources (consultées le 2026-10-24)

- RFC 2131, DHCP : https://www.rfc-editor.org/rfc/rfc2131.html (et texte brut) — messages DISCOVER/OFFER/REQUEST/ACK, DISCOVER diffusé (§3.1), contrôle ARP et DHCPDECLINE (§3.1), choix des offres (§4.4.1), REBINDING diffusé (§4.3.2), relais et `giaddr` (§1.5, §4.1), T1 = 0,5 et T2 = 0,875 × bail (p. 40), Table 1 des champs.
- RFC 3927, adresses IPv4 de lien local : https://www.rfc-editor.org/rfc/rfc3927.html — 169.254/16, plage 169.254.1.0 à 169.254.254.255, 3 sondes ARP de 1 à 2 s, interdiction de routage (§7).
- Microsoft Learn, commande `ipconfig` : https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/ipconfig — `/all`, `/release`, `/renew`, mention d'APIPA.
- Dépôt : `Read Me Exercice Packet Tracer Cisco` (lab VLAN, trunks, router-on-a-stick, DHCP sur routeur, Wi-Fi).
- Non vérifié aujourd'hui (de mémoire) : usage d'`ip helper-address` pour le relais Cisco ; comportement exact d'`ipconfig /all` dans Packet Tracer ; la sécurisation DHCP par des mécanismes de commutateur (non traitée ici).
