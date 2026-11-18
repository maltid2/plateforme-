# Topologie réseau v1 — outil interne, 100 % hors ligne

On renseigne ses sites, ses lieux (écoles, bâtiments…), ses baies, ses
switchs et ce qui est branché dessus, port par port. L'outil produit **deux
plans** :

- un **plan 2D professionnel** : vrais switchs en façade (ports numérotés,
  câble qui part du bon port), fibre et cuivre en deux couleurs, trunks et
  VLAN étiquetés, chaque site dans son cadre et chaque lieu dans son site ;
- une **vue « Baies »** : les baies de chaque lieu vues de face, côte à côte,
  chaque équipement à sa hauteur (numéros d'U), caméras sur leurs plateaux ;
- une **vue 3D interactive**, avec des salles réalistes (murs, sol technique en
  dalles, chemin de câbles en hauteur, voyants qui clignotent). Les caméras
  sont regroupées dans la baie de leur switch, ou sur les murs (menu
  « Caméras »), pour repérer où elles sont. La vue a deux niveaux. Dézoomé, chaque caméra est une
  pastille visible de loin, avec le nombre de caméras par site et par lieu ;
  un clic sur une pastille ou sur le sol d'un site **plonge dans la 3D
  détaillée**. En zoomant, les pastilles s'effacent et on retrouve : une salle par lieu, des baies avec les
  équipements montés dedans, les caméras rangées sur des plateaux en bas de
  baie et câblées au port de leur switch, les liaisons entre sites en arc.

Ce n'est pas de la découverte automatique : la carte est exactement ce que
vous avez renseigné. L'outil s'ouvre sur une carte vide : vous créez vos
sites avec les noms que vous voulez. Rien n'est obligatoire : un site peut n'avoir qu'un
switch, sans pare-feu ni onduleur.

## Installer : un seul fichier, rien d'autre

**`topologie-reseau-v1.html`** contient tout l'outil. On le copie sur le poste et on
l'ouvre en double-cliquant (Edge, Chrome ou Firefox). Pas d'installation, pas
de compte, pas de serveur.

### Sécurité (esprit ISO 27001)

- **Aucune connexion sortante possible** : le fichier embarque une politique de
  sécurité (`connect-src 'none'`, aucune ressource externe) ; le navigateur
  bloque toute tentative d'envoi. Vérifié : zéro requête réseau en usage.
- **Les données restent sur le poste**, dans le navigateur qui ouvre le fichier.
- **Intégrité** : `topologie-reseau-v1.html.sha256` donne l'empreinte du fichier
  livré. Avant de le déployer, vérifiez-la :
  ```powershell
  Get-FileHash .\topologie-reseau-v1.html -Algorithm SHA256
  ```
- **Marquage** : le dossier imprimé porte « Document interne — diffusion
  restreinte » sur chaque page.
- **Sauvegarde** : *Fichiers › Sauvegarder toutes les topologies (.json)*. C'est
  ce fichier qu'on classe dans vos logiciels / votre GED ; il se recharge avec
  *Restaurer une sauvegarde*. Un nettoyage du navigateur efface le stockage
  local : sauvegardez régulièrement.

## Saisir : le formulaire (pour tout le monde)

1. **Où ?** — choisir le site, le lieu (facultatif) et la baie (facultatif).
   Ils restent sélectionnés : on ne les ressaisit pas à chaque équipement.
2. **Ajouter** — cliquer le type (Switch, Caméra, Passerelle…), donner un nom
   (un nom est proposé), l'IP, le modèle. Pour plusieurs caméras d'un coup,
   mettre le **nombre** : les IP et les ports se suivent.
3. **Plusieurs switchs d'un coup** — avec plusieurs noms (`SW-A, SW-B, SW-C`)
   ou un nombre, **une ligne par équipement** apparaît : nom, IP, ports RJ45
   et cages SFP de chacun. On peut aussi taper `24, 8, 48` dans les cases.
   Si la case Nom reste vide, le nom proposé en grisé est utilisé.
   **Cadre A (vert) : où est branché l'équipement que vous ajoutez** — son
   câble à lui, enregistré en même temps que lui. Seuls les ports libres sont
   proposés ; câble automatique (SFP = fibre, sinon RJ45) ou forcé.
4. **Cadre B (violet) : câble en plus entre deux équipements déjà créés** —
   trunk entre deux switchs, lien entre deux lieux ou deux sites, VPN ou lien
   de secours. Deux switchs se relient en RJ45 comme en fibre.
5. **Inventaire** — la liste de tout ce qui est saisi, par site et par lieu ;
   ✎ pour modifier, ✕ pour supprimer, clic pour voir sur la carte.

Le formulaire écrit des lignes de texte : l'onglet **Texte** les montre et
permet d'aller plus vite quand on a l'habitude.

La **barre entre la saisie et la carte** se glisse pour élargir la zone
d'écriture (double-clic : grand / normal) ; la largeur est mémorisée.

## Saisir : le texte (pour aller vite)

```text
site Lyon                         # les lignes suivantes sont à Lyon
point École Jaurès                # … dans ce lieu
baie B1                           # … et dans cette baie (lignes en retrait)
  switch SW-JAURES | 10.20.1.2 | Netgear GS110TP | ports=8 | sfp=2 | sur SW-MAIRIE:Te1 | fibre
camera CAM-JAURES x4 | 10.20.31.10 | Dôme 4 MP | sur SW-JAURES:1 | vlan=30

SW-MAIRIE:Te3 -> SW-LILLE-1:Te2 | fibre | trunk | vlan=10,30
FW-SIEGE:WAN2 -> SW-LILLE-1:24 | vpn | secours
```

| Quoi | Comment |
| --- | --- |
| Équipement | `type NOM \| IP \| modèle \| @Site/Lieu \| baie=A1 \| sur SWITCH:port \| vlan=30` |
| Types | passerelle, parefeu, switch, camera, nvr, borne, serveur, nas, poste, imprimante, telephone, onduleur, autre |
| Switch | `ports=24` (RJ45) et `sfp=4` (cages fibre) dessinent la façade |
| Ports différents pour chacun | `switch SW-A, SW-B, SW-C \| ports=24, 8, 48 \| sfp=4, 0, 2` → 1er nombre au 1er nom, etc. (dans le formulaire aussi) |
| Liaison | `SW-1:24 -> SW-2:Te1 \| fibre \| trunk \| vlan=10,20 \| remarque` |
| Câble | `fibre`, `rj45` (ou `cuivre`), `radio`, `vpn` — sinon déduit (SFP = fibre) |
| Plusieurs noms différents | `switch SW-ACCUEIL, SW-ETAGE1, SW-ETAGE2 \| 10.0.0.10 \| sur SW-CORE:5` → IP et ports qui se suivent (dans le formulaire : noms séparés par des virgules) |
| Une IP précise pour chacun | `switch SW-A, SW-B, SW-C \| 10.0.0.5, 10.0.0.9, 10.0.0.20` → 1re IP au 1er nom, etc. (moins d'IP : la suite continue après la dernière) |
| Plusieurs d'un coup | `camera CAM x6 \| 10.0.30.11 \| sur SW:3` → CAM-1 à CAM-6, ports 3 à 8 |
| Site / lieu | `site Lyon`, `point École A` en blocs, ou `@Lyon/École A` sur la ligne |
| IP passerelle | `passerelle=10.20.0.1` sur l'équipement ; ou `site Lyon \| passerelle=…` / `point École A \| passerelle=…` pour tous les équipements du site ou du lieu (l'équipement garde la sienne s'il en a une) |

Au-dessus de l'éditeur, **« Insérer : »** écrit au curseur un bloc prêt à
adapter (Site, Switchs, Caméras, Trunk, Lieu, Entre sites), avec des noms
neutres à remplacer ; **« Exemple complet »** ouvre tout le langage dans une
carte à part (à supprimer ensuite), sans toucher à la vôtre.

L'éditeur colore la syntaxe, souligne les erreurs et propose les sites, les
équipements et **les ports libres** pendant la frappe (`Ctrl+Espace`).

## Naviguer dans le plan 2D

Dézoomé, chaque site et chaque lieu affiche une **carte résumé** (switchs,
baies, caméras, IP de passerelle) ; un clic dessus zoome sur ce site. En
zoomant, on retrouve les façades et les ports. Boutons ＋ − ⤢ et
**mini-carte** en bas à droite : cliquer ou glisser dessus pour se déplacer.

## Exporter (s'ouvre partout)

| Export | S'ouvre avec |
| --- | --- |
| **Dossier imprimable · PDF** — plan 2D A3 avec cartouche et légende, les baies vues de face côte à côte, puis le tableau des équipements par site | tout lecteur PDF ; choisir l'imprimante « Enregistrer au format PDF » |
| **Visionneuse interactive (.html)** — 2D + 3D, topologie incluse, lecture seule | n'importe quel navigateur, hors ligne |
| **Maquette 3D (.glb)** | Visionneuse 3D de Windows, PowerPoint, Blender… |
| **Plan 2D (.svg)** | navigateur, Inkscape, Illustrator, Visio, Word |
| **Image (.png)** | tout |

Le PDF et le SVG sont produits en version claire (fond blanc) pour
l'impression ; les façades de switch restent réalistes.

## Modifier l'outil (développeurs)

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # analyseur, façades, placement, lieux, supports
npm run fichier    # reconstruit topologie-reseau-v1.html et son empreinte SHA-256
```

| Fichier | Rôle |
| --- | --- |
| `src/saisie.ts` | lecture du texte : sites, lieux, liaisons, câbles, trunks, alertes |
| `src/facade.ts` | ports d'un switch et leur place, chemin vers la passerelle |
| `src/disposition.ts` | placement automatique : sites › lieux › équipements sous leur port |
| `src/plan2d.ts` | plan 2D en SVG (façades réalistes, version claire pour l'export) |
| `src/vue3d.ts` | salles, baies, plateaux à caméras, câbles ; export .glb |
| `src/formulaire.ts` | saisie simple par listes |
| `src/editeur.ts` | éditeur texte avec coloration et suggestions |
| `src/impression.ts` | dossier imprimable / PDF |
| `src/projets.ts` | topologies multiples, sauvegarde et import |
