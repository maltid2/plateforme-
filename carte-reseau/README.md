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
   et cages SFP de chacun, et **le port où chacun est branché** (une fois le
   switch choisi dans le cadre A). On peut aussi taper `24, 8, 48` dans les cases.
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

## Importer un tableau Excel ou CSV

*Importer › Tableau Excel ou CSV* (au-dessus de la carte) : une ligne par équipement, et
la topologie se dessine dans une **nouvelle topologie** (la vôtre n'est pas
touchée). Le fichier est lu dans le navigateur ; rien n'est envoyé.

**Avant l'import, une fenêtre montre ce que l'outil a compris de chaque
colonne** (avec des exemples tirés du fichier) : une colonne mal comprise se
corrige d'un clic, et ces choix sont retenus pour les imports suivants. Une
colonne au titre inconnu est comprise **d'après son contenu** : des adresses IP
→ IP, des MAC → MAC, des masques → masque, les noms d'autres lignes →
« Branché sur », des numéros à côté → port, des mots comme switch / caméra →
type.

Les colonnes sont reconnues **par leur titre**, dans n'importe quel ordre, et
la ligne de titres peut être sous un titre de page :

| Colonne | Titres reconnus (exemples) |
| --- | --- |
| Nom *(seule obligatoire)* | Nom, Équipement, Hostname, Désignation |
| Type | Type, Catégorie — sinon deviné d'après le nom (CAM-…, SW-…, AP-…) |
| IP, Modèle | IP, Adresse IP · Modèle, Référence, Marque |
| Site, Lieu, Baie | Site, Ville, Agence · Lieu, Bâtiment, Emplacement, Salle · Baie, Rack |
| Branché sur, Port | Branché sur, Switch, Connecté à, Uplink · Port, Port switch |
| Port local | Port local, Port de l'équipement — pour un switch relié port à port |
| *Façon d'écrire un port* | `9`, `RJ45 9`, `Port 9`, `n°9` → port 9 · `SFP 2`, `Fibre 1` → SFP2 · `WAN 1` · `Gi1/0/9`, `Te1` tels quels |
| Câble, VLAN | Câble (fibre, RJ45, radio, VPN) · VLAN |
| Ports RJ45, SFP, WAN | Nb ports, Ports RJ45 · SFP, Cages SFP · WAN |
| Passerelle, Remarque | Passerelle, Gateway · Remarque, Commentaire |
| Masque, N° de série, MAC | Masque, Masque de sous-réseau, Netmask · N° de série, S/N, Serial · Adresse MAC, MAC |
| Câbles en plus sur la même ligne | Branché sur 2 / Port 2 / Port local 2 / Câble 2 (jusqu'à 9) — serveur à deux cartes, switch à deux uplinks |
| *Autres colonnes* | gardées telles quelles dans la fiche de l'équipement (Garantie, Firmware, Date de pose…) |

**Plusieurs onglets** : tous les onglets visibles sont lus, chacun avec sa
propre ligne de titres. Sans colonne Site, le **nom de l'onglet devient le
site** (« Lyon », « Lille ») ; un onglet « Caméras », « Switchs », « Bornes »…
donne le **type** quand la colonne Type manque. Un onglet **De / Port A / Vers /
Port B** (avec Câble, VLAN) décrit des liaisons. Les onglets sans colonne Nom
(notes, sommaire) et les onglets masqués sont ignorés ; un nom déjà vu dans un
autre onglet n'est pas recréé. À la fin, l'outil dit ce qu'il a lu dans
chaque onglet.

**Mis en forme de tableau** (*Accueil › Mettre sous forme de tableau*) :
chaque tableau Excel est lu à part, même s'il y en a plusieurs sur une
feuille. Sans colonne Site, le site vient du **titre posé juste au-dessus**
du tableau (« Nanterre », « Site : Nanterre »), sinon du **nom du tableau**
(*Création de tableau › Nom du tableau* : `Tableau_Nanterre` → Nanterre),
sinon du nom de l'onglet. Sans objet Tableau, des plages empilées sur une
feuille (titre, ligne de titres, lignes) sont reconnues de la même façon.

**Ports, pour tous les équipements** (switch, serveur, NAS, enregistreur, caméra…) : `24`, `RJ45 24`, ou les deux dans une case : `24 + 4 SFP`,
`48 RJ45 / 4 SFP+`. **VLAN** : plusieurs par équipement, dans une case
(`10, 20`, `10 / 20`, `10 et 30`, `100-110`) ou dans plusieurs colonnes
(`VLAN 1`, `VLAN 2`, `VLAN vidéo`…). Sur un switch relié à un autre, ils
passent sur le lien (trunk).

*Fichiers › Modèle de tableau à remplir* donne un CSV prêt à ouvrir dans
Excel. Formats lus : `.xlsx` (tous les onglets) et `.csv` ; un ancien `.xls`
s'enregistre d'abord en `.xlsx` depuis Excel.

### Relever les switchs automatiquement

Le relevé automatique de **Cartographie Réseau** est intégré à l'outil.

1. **Fichiers › Script de relevé des switchs** donne `Relever les switchs.bat`
   (aussi dans `releve-switchs/`). Mettez-le dans un dossier avec `plink.exe`
   (outil de PuTTY) et lancez-le **sur un PC du réseau des switchs** : il
   demande le site, les IP et les identifiants, reconnaît la marque (Cisco,
   Aruba CX, HP/ProCurve, Planet, Netgear, ComNet, MikroTik, Huawei, Juniper,
   Ruckus, Dell, Allied, Extreme, D-Link, Zyxel, TP-Link) et n'envoie que des
   commandes de lecture (`show …`). Il range un fichier par switch dans
   `Sites › <site> › Log Switch`.
2. Ici : **Importer › Relevés des switchs** (au-dessus de la carte) et choisissez le
   dossier du site, `Log Switch`, ou même `Sites` entier (une topologie par
   site). On peut aussi choisir des `.txt` un par un (*Importer › Relevés : fichiers .txt un par un*), ou le `.json` du collecteur, et un export Genetec
   (`.csv`) pour les vrais noms des caméras.

L'analyse est celle de Cartographie Réseau v3.2, reprise **sans modification**
(`src/releve/`) : CDP/LLDP, tables MAC et ARP, VLAN, trunks, LAG, PoE,
erreurs. La carte reprend les switchs (IP, modèle, n° de série, firmware,
emplacement → bâtiment), les câbles entre switchs avec leurs ports, la fibre
ou le cuivre, la vitesse et les VLAN des trunks, et les caméras / serveurs
**branchés directement** (IP, MAC, VLAN). Les ports RJ45 / SFP sont déduits du
modèle (« C9300-48P » → 48) et les ports d'uplink (« 1/1/49 », « Gi1/1/1 »)
deviennent les cages SFP. Les **anomalies** du relevé (liaison agrégée
dégradée, VLAN natif différent, port en erreur, PoE presque saturé, switch
non relevé…) s'affichent sur la fiche de chaque switch et sont listées à la
fin du texte. Un équipement vu seulement derrière un lien entre switchs n'est
pas placé : on ne sait pas où il est branché.

**Sécurité** : la page ne se connecte toujours à rien ; elle lit les fichiers
que le script a écrits. Les **sauvegardes de configuration** (`Config Switch`,
qui peuvent contenir des mots de passe) ne sont **jamais lues**, même choisies
par erreur (reconnues à leur dossier, leur nom et leur en-tête). Le script, lui,
se connecte aux switchs : lancez-le seulement sur le réseau des switchs, avec
un compte en lecture si possible.

L'export Excel de Cartographie Réseau (onglets Switchs, Liens, Équipements…)
s'importe aussi avec **Importer › Tableau Excel ou CSV**.

## Saisir : le texte (pour aller vite)

**Une ligne = un équipement ou un câble.** On peut l'écrire en français
courant ; sous l'éditeur, l'outil **explique la ligne où se trouve le curseur**
(« J'ai compris : Caméra « CAM-1 » · IP … · branché sur SW-1 port 3 ») et
signale ce qui ne va pas, en proposant le bon nom en cas de faute de frappe.

```text
site Lyon
switch SW-1 | ip 10.0.0.2 | 24 ports | 4 sfp | baie A1 | modèle Cisco 9200
camera CAM x6 | ip 10.0.30.11 | branchées sur SW-1 port 3 | vlan 30
câble SW-1 port SFP1 vers SW-2 port SFP1 | fibre | trunk | vlan 10,30
```

L'écriture courte ci-dessous marche aussi (les deux se mélangent librement).


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
| Câble | `rj45` (ou `cuivre`), `fibre`, `dac` (twinax, SFP direct), `coax` (BNC), `rs485` / `rs232` (série), `usb`, `radio`, `vpn` — sinon déduit (SFP = fibre) |
| Ports de tous les équipements | `serveur SRV-1 \| ports=2 \| sfp=2`, `nvr NVR-1 \| ports=8`… puis `SRV-1:SFP1 -> SW-1:SFP1 \| dac`, `camera CAM-1 \| sur NVR-1:3` ; dans le formulaire, *Ports RJ45 / Cages SFP* existe pour tous les types |
| Plusieurs noms différents | `switch SW-ACCUEIL, SW-ETAGE1, SW-ETAGE2 \| 10.0.0.10 \| sur SW-CORE:5` → IP et ports qui se suivent (dans le formulaire : noms séparés par des virgules) |
| Une IP précise pour chacun | `switch SW-A, SW-B, SW-C \| 10.0.0.5, 10.0.0.9, 10.0.0.20` → 1re IP au 1er nom, etc. (moins d'IP : la suite continue après la dernière) |
| Plusieurs d'un coup | `camera CAM x6 \| 10.0.30.11 \| sur SW:3` → CAM-1 à CAM-6, ports 3 à 8 |
| Un port précis pour chacun | `camera CAM-A, CAM-B, CAM-C \| sur SW-1:3, 7, 12` → 1er port au 1er nom, etc. |
| Site / lieu | `site Lyon`, `point École A` en blocs, ou `@Lyon/École A` sur la ligne |
| N° de série, MAC, masque | `masque=255.255.255.0` (ou `/24`), `serie=FOC1234`, `mac=00:11:22:AA:BB:CC` (toute écriture de MAC est acceptée) ; plusieurs équipements : `serie=A1, A2, A3`, un par nom. MAC illisible, masque faux, MAC / n° de série / IP en double sont signalés |
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
zoomant, on retrouve les façades et les ports. Molette ou boutons ＋ − pour
zoomer, glisser pour se déplacer, **Recentrer** pour tout revoir ; la
**mini-carte** (en bas à droite, quand la carte dépasse l'écran) se clique ou
se glisse.

## Aide

Bouton **Aide** (en haut à droite) : une fenêtre à onglets — *Formulaire*,
*Texte*, *Carte et dépannage*, *Clavier* — qui s'ouvre sur le mode en cours.
Elle est aussi dans la visionneuse (onglets utiles à la lecture seulement).

## Modifier ou supprimer depuis la carte

- **Cliquer un câble** sur le plan 2D ouvre la fenêtre *Câble* : changer un
  bout, un port (seuls les ports libres sont proposés), le type, les VLAN, le
  trunk, une remarque — ou **Supprimer ce câble**.
- **Cliquer un équipement** ouvre sa fiche : **✎ Modifier** (formulaire),
  **＋ Câble**, **🗑 Supprimer** ; dans la liste de ses câbles, ✎ et ✕ sur
  chaque ligne. La touche **Suppr** supprime l'équipement choisi.
- Supprimer un switch ne supprime pas ce qui y est branché : seuls les câbles
  sont retirés (les équipements sont alors signalés « non reliés »).
- **Tout se rattrape** : après une suppression ou une modification, le message
  en bas de l'écran propose **Annuler** ; `Ctrl+Z` (hors d'un champ) revient
  aussi en arrière, plusieurs fois de suite.
- Les questions de l'outil (nom d'un nouveau site, confirmation avant de
  supprimer une topologie, résultat d'un import) s'affichent dans ses
  propres fenêtres : `Entrée` valide, `Échap` annule.
- Liste des remarques sous la saisie : en mode *Formulaire*, un clic montre
  l'équipement concerné sur la carte ; en mode *Texte*, il va à la ligne
  (« L.12 »). Un conflit de port nomme les deux équipements : « Port 3 de
  SW-1 déjà utilisé par CAM-1 : AP-1 doit aller sur un autre port ».
- Au-dessus de la carte, sur une ligne : **Équipement**, **Câble**, **Importer**
  (relevés des switchs, tableau Excel ou CSV, export Genetec), **PDF**, et à
  droite **Générer les préconisations**. Carte vide : un accueil propose les
  relevés, un Excel, le formulaire ou un exemple. Renommer / dupliquer /
  supprimer une topologie : menu **⋯** à côté de son nom. Le menu **Fichiers**
  est rangé en trois parties : documents à partager, topologies, outils.
- Les remarques sous la saisie se replient sur trois lignes quand elles sont
  nombreuses (**Tout voir**), et la légende de la carte se replie d'un clic :
  le formulaire et le plan gardent leur place. Ces choix sont retenus.

## Dépannage

Cliquer un équipement (ou le chercher par nom ou IP) **allume son chemin
jusqu'à la passerelle** — sur le plan 2D (équipements et câbles traversés,
le reste estompé), dans les **Baies** (équipements du chemin encadrés) et en
**3D** (câbles du chemin en or, équipements encadrés). Sa fiche détaille le chemin saut par saut, avec les
ports, le type de câble et les VLAN : « CAM-13 → SW-ACC1 port 5 · RJ45 ·
VLAN 30 », « SW-ACC1 port SFP1 → SW-CORE port SFP1 · fibre · trunk 10,30 »…

## Préconisations : sécurité et Genetec

Elles ne s'affichent pas sur la carte : une fois la carte faite, le bouton
**⚑ Générer les préconisations** (au bout de la barre d'actions) ouvre le
rapport, calculé sur le poste à partir de tout ce que la carte contient
(saisie, Excel, relevés des switchs, export Genetec). Il est recalculé à chaque
ouverture : rien à mettre à jour.

Le rapport part de **notre cas** : un réseau vidéo **isolé, sans accès à
Internet**, et **sans ACL** — la séparation repose uniquement sur des VLAN bien
configurés. Il ne parle donc ni de pare-feu, ni de matrice de flux, ni de mises
à jour automatiques.

**Comparaison avec Genetec.** Dans le rapport (ou *Importer › Export Genetec*), ajoutez l'export de Security Center : l'inventaire matériel
(nom, IP, MAC, modèle, firmware, archiveur, **état**) et, pour les débits, la
configuration des caméras (flux, débit, résolution). Colonnes reconnues en
français ou en anglais, .csv ou .xlsx ; l'export est gardé avec la carte. Un
export Genetec placé dans le dossier des relevés est pris aussi. Le rapport
rapproche chaque caméra Genetec de la carte (MAC, puis IP, puis nom) et donne :
les caméras **hors ligne avec le switch et le port où aller voir**, celles de
Genetec introuvables sur le réseau, celles du réseau **absentes de Genetec (non
enregistrées)**, les écarts d'IP ou de nom (bouton pour reprendre les noms
Genetec sur la carte, annulable), les IP en double, le **débit vidéo par
switch** (charge du lien montant quand il est unique et que sa vitesse est
connue) et par archiveur, et les versions des caméras.

**Présentation** — courte, lisible par tous :

1. **À corriger en premier** : 5 phrases au plus (pannes critiques, puis
   mesures indispensables à faire).
2. **Les mesures, par classe.** Chaque mesure dit **pourquoi** la mettre (une
   phrase simple), **son effet sur le dépannage et la maintenance**, et son
   **état** sur la carte : *À faire*, *À vérifier* (sur place, ou faute de
   relevé) ou *OK*. Le détail — équipements concernés (un clic les montre sur
   le plan) et **commandes à copier** pour leur marque (Cisco IOS / IOS-XE,
   Aruba CX, HP / ArubaOS-Switch ; sinon « dans l'interface web ») — est replié
   sous « Où et comment » et déplié à l'impression.
   - **Classe 1 · Indispensable** (ne ralentit pas le dépannage, souvent
     l'accélère) : un nom de switch qui dit où il est (nom par défaut ou sans
     le local → nom proposé `SW-<lieu>-<numéro>`, commandes `hostname` et
     emplacement SNMP) ; pas de boucle réseau (STP, MAC qui change de port,
     plusieurs racines STP, switchs reliés en anneau, câbles doublés non
     agrégés) ; une IP pour un seul équipement ; des IP fixes (écart avec
     Genetec) ; chaque usage dans son VLAN (VLAN 1, postes dans le VLAN
     caméras, administration mélangée) ; les mêmes VLAN aux deux bouts de
     chaque lien (VLAN natif ou VLAN autorisés différents, VLAN des caméras
     absent du lien montant, caméras réparties sur plusieurs VLAN, trunk vers
     une caméra) ; mots de passe d'usine changés ; tous les switchs relevés.
   - **Classe 2 · Recommandé** (un peu de travail en plus) : ports libres
     désactivés, VLAN natif 999, VLAN autorisés limités sur les trunks, pas de
     petit switch caché, même version logicielle par modèle, heure commune
     (serveur de temps interne), double lien pour les switchs chargés.
   - **Classe 3 · Renforcé — à décider** (dépannage nettement plus long) :
     verrouillage des ports par adresse MAC (seulement pour les caméras
     accessibles au public : parking, extérieur), 802.1X (déconseillé ici),
     et garder LLDP/CDP actifs (les couper aveuglerait le relevé et la carte).
3. **Pannes et anomalies relevées** (caméras hors ligne avec le switch et le
   port, liaison agrégée dégradée, erreurs de câble, PoE…), avec les commandes
   de contrôle puis de redémarrage PoE.
4. **Genetec**, **plan des VLAN**, **versions logicielles** (repliées).

Exemples : « SW-COEUR-1 : Gi1/0/1, Gi1/0/5, Gi1/0/14, Te1/1/4 » sous *Désactiver
les ports qui ne servent pas* ; « HP-2530-24G : nom par défaut → proposé :
SW-BATA-R0-01 » ; « Gi1/0/2… — à faire en même temps en face : SW-PARKING
port 25 » sous *VLAN natif 999*. Les commandes de modification sont à passer en
fenêtre de maintenance, après une sauvegarde de la configuration. **Imprimer /
PDF** produit le rapport.

**Versions.** Pas de base de failles embarquée : sans connexion, elle serait
vite périmée. Les équipements n'ayant pas Internet, les mises à jour se
téléchargent chez le constructeur depuis un poste de l'entreprise, puis
s'installent à la main.

## Couleurs

Dans **Couleurs › Apparence** : *Standard* (sombre), *Clair* (fond blanc, 2D et 3D), ou *Noir studio* (inspiré des
sites d'agences de design : noir pur, texte gris clair en majuscules
espacées, sans arrondis ni ombres, filets fins, beaucoup de vide).

Bouton **Couleurs** (en haut) : l'**accent de l'interface** — Bleu (par défaut), Vert, Cyan technique, Graphite neutre, Violet ou une couleur libre, choisis pour rester lisibles sur fond sombre et ne pas se confondre avec les couleurs d'état (vert = OK, ambre = attention, rouge = erreur) — ; le **fond de la carte** (2D et 3D) et le **fond de l'interface**, puis une pastille par type de câble (RJ45, fibre,
DAC, coaxial, série, USB, radio, VPN, trunk) et par type d'équipement. Le plan
2D, la 3D, le PDF, le SVG et la visionneuse exportée suivent ; les couleurs
sont retenues sur le poste, et **Couleurs d'origine** revient aux réglages de
départ.

En 3D, chaque bâtiment (lieu) a la taille de ce qu'il contient — la rangée de
baies au fond, l'espace devant, les équipements posés au sol — et les
bâtiments d'un site sont regroupés côte à côte.

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

**Signature des documents** (*Fichiers › Signature des documents*) : le nom
écrit sur le PDF, le SVG et la visionneuse (« établi par … »). Laissez-la
vide pour ne rien signer.

La **visionneuse** s'ouvre avec un bandeau « Lecture seule · exportée le … » :
on sait tout de suite qu'on regarde une copie figée, sans menu d'édition.

## Rapide, même sur un grand réseau

Testé avec 12 sites et 350 équipements. Pendant la frappe, l'outil attend une
courte pause avant de redessiner, et ne redessine que la vue affichée (le
plan 2D, la 3D ou le formulaire cachés sont mis à jour quand on y revient, ou
juste avant un export). La 3D n'est dessinée que lorsque quelque chose bouge :
au repos, la carte graphique ne travaille pas. Sur ce réseau de test, une
modification coûte environ 0,07 s en 2D et 0,4 s avec la 3D ouverte.

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
| `src/tableur.ts` | import Excel (.xlsx) / CSV, sans bibliothèque |
| `src/carto.ts` | lecture de l'export Excel de Cartographie Réseau (relevé automatique) |
| `src/releve.ts` | relevés des switchs (.txt du script) → carte, anomalies |
| `src/releve/` | moteur d'analyse de Cartographie Réseau v3.2, repris tel quel |
| `src/securite.ts`, `src/vueSecurite.ts` | préconisations par classe (pourquoi, effet sur le dépannage, état), pannes, VLAN, versions ; rapport |
| `src/commandes.ts` | commandes par marque de switch (Cisco, Aruba CX, HP) pour appliquer les préconisations |
| `src/genetec.ts`, `src/genetecLecture.ts` | export Genetec : lecture, comparaison avec le réseau, débits |
| `releve-switchs/` | `Relever les switchs.bat` et `commandes.txt` (le script qui interroge les switchs) |
| `src/main.ts` | l'état de l'application et l'orchestration : rendu, vues, recherche, topologies, annulation |
| `src/ui/fiche.ts` | la fiche d'un équipement (chemin de dépannage, ports, câbles, actions) |
| `src/ui/preconisations.ts` | la fenêtre des préconisations, l'import et la comparaison Genetec |
| `src/ui/releves.ts` | import des relevés des switchs, téléchargement du script |
| `src/ui/exports.ts` | exports SVG, PNG, PDF, GLB et visionneuse |
| `src/ui/couleurs.ts`, `src/ui/colonnes.ts` | fenêtres « Couleurs » et « Ce que l'outil a compris de votre tableau » |
| `src/ui/outils.ts`, `src/ui/toast.ts`, `src/ui/largeur.ts` | outils communs, message en bas de l'écran, largeur de la saisie |
| `src/explication.ts` | la ligne du curseur expliquée en français (mode Texte) |
| `src/boites.ts` | petites fenêtres de l'outil (à la place de alert / prompt / confirm) |
| `src/baies.ts`, `src/elevation.ts` | contenu des baies et vue de face (onglet Baies, PDF) |
| `src/apparence.ts` | couleurs, apparences (standard, claire, noir studio), accents |
