/**
 * Modèles à insérer dans l'onglet Texte : des blocs prêts à adapter, avec
 * des noms neutres à remplacer par les vôtres. Rien n'est inséré tant
 * qu'on ne clique pas.
 */
export const MODELES: { id: string; titre: string; detail: string; texte: string }[] = [
  {
    id: "site", titre: "Site", detail: "un site, sa passerelle, une baie",
    texte: `
site Mon site | passerelle=192.168.1.1

baie B1
  passerelle GW-1 | 192.168.1.1 | Box fibre | ports=4 | wan=1
  switch SW-1 | 192.168.1.2 | Modèle du switch | ports=24 | sfp=4 | sur GW-1:LAN1
`,
  },
  {
    id: "switchs", titre: "Switchs", detail: "plusieurs switchs aux noms différents",
    texte: `
switch SW-ACCUEIL, SW-ETAGE1, SW-ETAGE2 | 192.168.1.10, 192.168.1.11, 192.168.1.12 | ports=24 | sfp=2 | sur SW-1:Te1
`,
  },
  {
    id: "cameras", titre: "Caméras", detail: "des caméras branchées sur un switch",
    texte: `
camera CAM x6 | 192.168.30.11 | Modèle de caméra | sur SW-1:1 | vlan=30
`,
  },
  {
    id: "trunk", titre: "Trunk", detail: "lien entre deux switchs, fibre, VLAN",
    texte: `
SW-1:Te2 -> SW-2:Te1 | fibre | trunk | vlan=10,20,30
`,
  },
  {
    id: "lieu", titre: "Lieu", detail: "un bâtiment ou une école dans un site",
    texte: `
point Bâtiment 1 | passerelle=192.168.2.1
switch SW-BAT1 | 192.168.2.2 | ports=8 | sfp=2 | sur SW-1:Te3 | fibre
camera CAM-BAT1 x4 | 192.168.32.10 | sur SW-BAT1:1 | vlan=30
`,
  },
  {
    id: "inter", titre: "Entre sites", detail: "liaison fibre ou VPN entre deux sites",
    texte: `
SW-1:Te4 -> SW-AUTRE-SITE:Te1 | fibre | lien opérateur
GW-1:WAN -> GW-AUTRE-SITE:WAN | vpn | secours
`,
  },
];

/** Un exemple complet du langage, ouvert dans une carte à part. */
export const EXEMPLE_COMPLET = `# Exemple complet — à lire, puis à supprimer (bouton « Supprimer » en haut).
# Une ligne par équipement :  type NOM | IP | modèle | sur SWITCH:port | vlan=30
# Une ligne par liaison     :  NOM:port -> NOM:port | fibre | trunk | vlan=10,30
# « site », « point » et « baie » rangent les lignes qui suivent.

# ---------- Site A : le site principal ----------
site Site A | passerelle=10.1.0.1

baie A1
  parefeu FW-A | 10.1.0.1 | Pare-feu | ports=8 | wan=2
  switch SW-A-CORE | 10.1.0.2 | Switch cœur | ports=24 | sfp=4
  onduleur UPS-A1 | Onduleur 3000 VA

baie A2
  switch SW-A-CAM | 10.1.0.3 | Switch PoE | ports=24 | sfp=4
  nvr NVR-A | 10.1.0.40 | Enregistreur 32 voies | sur SW-A-CAM:1 | vlan=30

FW-A:LAN1 -> SW-A-CORE:Te1 | fibre | trunk | vlan=10,30
SW-A-CORE:Te2 -> SW-A-CAM:Te1 | fibre | trunk | vlan=30
camera CAM-A x6 | 10.1.30.11 | Bullet 8 MP | sur SW-A-CAM:2 | vlan=30 | passerelle=10.1.30.1
poste PC-A1, PC-A2 | 10.1.10.91, 10.1.10.95 | sur SW-A-CORE:1 | vlan=10

# ---------- Site B : deux bâtiments ----------
site Site B | passerelle=10.2.0.1

point Bâtiment 1
baie B1
  switch SW-B1 | 10.2.0.2 | Switch | ports=24 | sfp=4
camera CAM-B1 x3 | 10.2.30.10 | Dôme 4 MP | sur SW-B1:1 | vlan=30

point Bâtiment 2
switch SW-B2 | 10.2.1.2 | Petit switch PoE | ports=8 | sfp=2 | sur SW-B1:Te1 | fibre
camera CAM-B2 x2 | 10.2.31.10 | sur SW-B2:1 | vlan=30

# ---------- Entre les sites ----------
FW-A:WAN1 -> SW-B1:Te4 | fibre | lien opérateur
FW-A:WAN2 -> SW-B2:8 | vpn | secours
`;
