# Fiche — Table d'adresses MAC contre table ARP : qui apprend quoi, où, et pourquoi on les confond

*Piste : réseau et commutation · lundi 23 novembre 2026 · lecture : 25 min*

> **Rappel :** observations en **laboratoire** (Packet Tracer, GNS3, VM). Ne vide pas une table ARP ou MAC sur le réseau de ton employeur pour « voir ». Lire ces tables pour dépanner est de l'exploitation normale.
>
> **Transparence sur les sources :** la partie **ARP** repose sur la RFC 826, lue aujourd'hui. Les guides Cisco sur la table MAC m'ont renvoyé 404/403 : la partie **commutateur** est donc **connaissance générale, non revérifiée à la source**, signalée comme telle. Un résultat de recherche mentionne un délai de vieillissement par défaut de 300 s sur des Catalyst, sans que j'aie pu ouvrir la page : à confirmer sur ton matériel.

## 1. Pourquoi ce mécanisme
Deux tables, deux équipements, deux questions : « **sur quel port** est cette adresse MAC ? » (commutateur) et « **quelle MAC** correspond à cette adresse IP ? » (hôte ou routeur). Confondre les deux fait chercher au mauvais endroit : un poste « ne joint pas la passerelle » peut avoir une entrée ARP fausse, ou un commutateur qui inonde faute d'entrée MAC.

## 2. Le mécanisme
**Table ARP (couche 2/3, sur l'hôte ou le routeur), source RFC 826.** Avant d'envoyer une trame vers l'adresse IP du saut suivant, l'hôte cherche la paire `<type de protocole, adresse de protocole cible>` dans sa table de traduction. Absente : il **diffuse** (*broadcast*) une requête ARP (`ar$op` = 1) portant sa propre MAC (`ar$sha`), sa propre IP (`ar$spa`) et l'IP recherchée (`ar$tpa` ; `ar$tha` laissé indéterminé, ou mis à la diffusion). La machine dont l'IP correspond répond (`ar$op` = 2) **en monodiffusion** vers l'émetteur. Détail documenté : à la réception, le triplet `<protocole, IP émettrice, MAC émettrice>` est **fusionné dans la table avant même de regarder l'opcode** ; si une entrée existe déjà pour cette IP, **la nouvelle MAC remplace l'ancienne**. La RFC précise que le vieillissement et les délais d'expiration sont **hors du périmètre du protocole**.
**Table MAC (couche 2, sur le commutateur) — connaissance générale, non revérifiée aujourd'hui.** Le commutateur **apprend** en lisant l'adresse MAC **source** de chaque trame reçue et en l'associant au port d'entrée (et au VLAN). Pour une trame, il cherche la MAC **destination** : trouvée, il l'envoie sur ce port ; inconnue, il **inonde** le VLAN (sauf le port d'entrée). Les entrées dynamiques **vieillissent** si l'adresse ne parle plus (la valeur par défaut est un paramètre d'équipement à vérifier).
**La différence clé :** la table ARP relie **IP → MAC** ; la table MAC relie **MAC → port**. Elles sont indépendantes et sur des équipements différents ; une requête ARP, étant diffusée, **traverse** le commutateur par inondation, et c'est la **réponse** (monodiffusion) qui lui apprend, par son adresse source, où se trouve l'émetteur.

## 3. Lecture du réel
Extrait authentique de la RFC 826 (lu le 2026-11-23) : format du paquet : `ar$hrd` (type de matériel, Ethernet = 1), `ar$pro` (protocole), `ar$hln` (longueur adresse matérielle, 6 pour Ethernet), `ar$pln`, `ar$op` (1 requête / 2 réponse), `ar$sha`, `ar$spa`, `ar$tha`, `ar$tpa`. **Je n'ai pas de sortie `show mac address-table` ni `arp -a` authentique à te montrer** ; sur ton laboratoire, relève les deux et vérifie que chaque IP de `arp -a` a une MAC qui se retrouve dans la table du commutateur sur un port cohérent.

## 4. Ce qui casse, et le symptôme
| Symptôme | Où regarder |
|---|---|
| IP joint mais mauvais équipement qui répond | table ARP (deux machines revendiquent la même IP : la dernière réponse remplace l'entrée, selon la RFC) |
| Trafic inondé vers tous les ports d'un VLAN | table MAC : entrée absente ou vieillie |
| Poste déplacé qui reste injoignable un moment | entrée ARP ou MAC ancienne |
| Adresse MAC qui « saute » de port | table MAC : même MAC vue sur deux ports (boucle, double connexion) |
Remonter : l'IP donne-t-elle la bonne MAC (ARP) ? La MAC est-elle sur le bon port et le bon VLAN (commutateur) ?

## 5. Vocabulaire
| Français | English | Définition / piège |
|---|---|---|
| table ARP | ARP table / ARP cache | IP → MAC, sur hôte ou routeur |
| table d'adresses MAC | MAC address table / CAM table | MAC → port, sur commutateur |
| requête / réponse ARP | ARP request / reply | diffusée / monodiffusée |
| diffusion | broadcast | |
| monodiffusion | unicast | |
| inondation | flooding | envoi sur tous les ports sauf l'entrée |
| apprentissage | learning | lecture de la MAC **source** |
| vieillissement | aging | suppression d'une entrée inactive |
| entrée dynamique / statique | dynamic / static entry | apprise / saisie |
| adresse MAC | MAC address | 48 bits |
| passerelle par défaut | default gateway | |
| saut suivant | next hop | |
Faux amis : « table de routage » ≠ table ARP ; « la MAC » de la passerelle ne figure dans la table **MAC** du commutateur que si elle a émis ; ARP **n'est pas** un protocole de commutateur.

## 6. Comment le dire juste
- **Collègue :** « L'IP résout vers la mauvaise MAC : je regarde la table ARP du poste, puis où cette MAC est apprise sur le commutateur. »
- **Prestataire (EN) :** "The host resolves the gateway IP to an unexpected MAC address. Could you check on which port and VLAN that MAC is learned on the access switch?"
- **Ticket (EN) :** "Intermittent connectivity to 10.x.x.1. ARP cache on the client shows a different MAC than expected; checking the switch MAC address table for that MAC (port/VLAN) and for duplicate IP."

## 7. Exercice (laboratoire, 25 min, observation seulement)
Dans Packet Tracer : deux PC et un commutateur. **Avant tout ping**, écris ta prévision : (1) table ARP du PC1 ? (2) table MAC du commutateur ? Puis lance un seul ping PC1→PC2 et relève les deux tables.
<details><summary>Solution</summary>
Avant le ping : les deux tables sont vides (si rien n'a émis). Après : le PC1 a une entrée ARP pour l'IP du PC2 ; le commutateur a appris les MAC sources vues (celle de PC1 sur la requête diffusée, celle de PC2 sur la réponse). À vérifier dans ton outil : mon énoncé suit la RFC et le principe général, je ne l'ai pas rejoué.
</details>

## 8. Révision espacée
Hier (synthèse) : 1) Pourquoi « un correctif publié n'est pas un correctif appliqué » ? 2) Que fait la sonde NCSI en premier ? Il y a sept jours (16 nov, EtherChannel) : 3) Un agrégat répartit-il par paquet ou par flux ?

## 9. Questions de contrôle
1. Que relie la table ARP, que relie la table MAC ? 2. Comment le commutateur apprend-il une adresse ? 3. Que se passe-t-il quand la MAC destination est inconnue ?
<details><summary>Réponses</summary>
1. IP → MAC ; MAC → port. 2. Par la MAC **source** des trames reçues. 3. Il inonde le VLAN (hors port d'entrée) — connaissance générale.
</details>

## 10. Sources (consultées le 2026-11-23)
- RFC 826, « An Ethernet Address Resolution Protocol » : https://www.rfc-editor.org/rfc/rfc826.txt — format du paquet, génération/réception, fusion avant l'opcode, vieillissement hors protocole.
- Guides Cisco sur la table MAC (Catalyst 9300, 2960) : **non lisibles** (404/403) ; partie commutateur non revérifiée.
