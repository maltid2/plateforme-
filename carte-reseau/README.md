# Carte réseau — outil interne, 100 % local

On écrit à la main ses sites, ses baies, ses switchs et ce qui est branché
dessus, port par port. L'outil dessine la carte : un **plan 2D** avec de vrais
switchs en façade (ports numérotés, câbles qui partent du bon port, trunks
étiquetés) et une **vue 3D** avec les baies, les équipements montés dedans et
les câbles jusqu'aux caméras, bornes et postes.

Ce n'est pas de la découverte automatique : la carte est exactement ce que
vous avez renseigné.

## Utiliser l'outil : un seul fichier

**`carte-reseau.html`** contient tout l'outil (three.js compris). On le copie
sur un PC, on l'ouvre en double-cliquant dans Chrome, Edge ou Firefox.

- **Aucune connexion internet** : le fichier interdit lui-même toute connexion
  sortante (politique de sécurité intégrée). Rien n'est envoyé, nulle part.
- **Les données restent sur le PC**, dans le navigateur qui a ouvert le fichier.
- **Sauvegarde** : menu *Fichiers › Sauvegarder toutes les topologies (.json)*.
  C'est ce fichier `.json` qu'on classe avec ses documents ; il se recharge
  avec *Restaurer une sauvegarde*. Faites-en une régulièrement : un nettoyage
  du navigateur efface le stockage local.

## Plusieurs topologies

La liste en haut de l'écran permet d'avoir autant de cartes qu'il faut (un
client, un bâtiment, une version « avant / après »…) : *Nouvelle*, *Renommer*,
*Dupliquer*, *Supprimer*. Chaque topologie s'exporte aussi seule en `.txt`.

## Écrire une topologie

```text
site Nanterre | Siège

baie A1
  parefeu FW-NANTERRE | 10.14.0.1 | FortiGate 100F | ports=8
  switch SW-CORE  | 10.14.0.2 | Cisco Catalyst 9300-24T | ports=24 | sfp=4
  switch SW-CAM   | 10.14.0.4 | Aruba 2930F PoE+        | ports=24 | sfp=4

FW-NANTERRE:LAN1 -> SW-CORE:Te1 | trunk | vlan=10,20,30
SW-CORE:Te3 -> SW-CAM:Te1 | trunk | vlan=30

camera CAM-PARKING x6 | 10.14.30.11 | Bullet 8 MP | sur SW-CAM:3 | vlan=30

switch SW-LYON-1 | 10.20.0.2 | @Lyon | ports=24 | sur GW-LYON:LAN1
```

| Quoi | Comment |
| --- | --- |
| Équipement | `type NOM \| IP \| modèle \| @Site \| sur SWITCH:port \| vlan=20` |
| Types | passerelle, parefeu, switch, camera, nvr, borne, serveur, nas, poste, imprimante, telephone, onduleur, autre |
| Switch | `ports=24` (RJ45) et `sfp=4` (cages SFP) dessinent la façade ; sans eux, la taille se déduit des ports utilisés |
| Liaison | `SW-1:24 -> SW-2:Te1 \| trunk \| vlan=10,20` |
| Trunk | écrit `trunk`, ou plusieurs VLAN, ou deux switchs reliés entre eux |
| Plusieurs d'un coup | `camera CAM x6 \| 10.0.30.11 \| sur SW:3` → CAM-1 à CAM-6, IP et ports qui se suivent |
| Site | `site Lyon` en bloc, ou `@Lyon` sur la ligne (ordre libre) |
| Baie | `baie A1`, puis les lignes **en retrait** en dessous |
| Ports | `5`, `Gi1/0/5`, `Te1`, `SFP2`, `LAN1`, `WAN` |

**L'éditeur aide à bien écrire** : coloration, numéros de ligne, erreurs
soulignées en direct, et suggestions pendant la frappe. Après `@` il propose
les sites, après `sur` ou `->` les équipements, et après `SWITCH:` **les ports
encore libres** de ce switch. `↑ ↓` pour choisir, `Entrée`/`Tab` pour valider,
`Ctrl+Espace` pour rouvrir.

**La fiche d'un équipement** (clic sur la carte) donne son IP, son site, sa
baie, **sa passerelle et le port par lequel il y remonte**, une mini-façade
des ports utilisés et la table des liaisons. Cliquer un port branché ouvre
l'équipement au bout du câble.

## Modifier l'outil

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # analyseur, façades, placement
npm run fichier    # reconstruit carte-reseau.html
```

| Fichier | Rôle |
| --- | --- |
| `src/saisie.ts` | lecture du texte, liaisons, trunks, alertes |
| `src/facade.ts` | ports d'un switch et leur place, chemin vers la passerelle |
| `src/disposition.ts` | placement automatique, chaque équipement sous son port |
| `src/plan2d.ts` | plan 2D en SVG (façades réalistes) |
| `src/vue3d.ts` | baies et câbles en 3D (three.js) |
| `src/editeur.ts` | éditeur avec coloration et suggestions |
| `src/projets.ts` | topologies multiples, sauvegarde et import |
