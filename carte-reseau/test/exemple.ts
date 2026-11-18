/**
 * Jeu d'essai des tests automatiques : un réseau fictif à trois sites.
 * Il ne fait pas partie de l'outil, qui démarre sur une carte vide.
 */
export const EXEMPLE = `# Une ligne par équipement :  type NOM | IP | modèle | sur SWITCH:port | vlan=30
# Une ligne par liaison     :  NOM:port -> NOM:port | fibre | trunk | vlan=10,30
# « site », « point » et « baie » rangent les lignes qui suivent : pas besoin de les répéter.
# « passerelle=IP » sur un site ou un lieu vaut pour tous ses équipements (sauf s'ils en ont une).

# ---------- Siège ----------
site Nanterre | passerelle=10.14.0.1

baie A1
  parefeu FW-SIEGE | 10.14.0.1 | FortiGate 100F | ports=8
  switch SW-CORE | 10.14.0.2 | Cisco Catalyst 9300-24T | ports=24 | sfp=4
  onduleur UPS-A1 | APC Smart-UPS 3000

baie A2
  switch SW-CAM | 10.14.0.4 | Aruba 2930F-24G PoE+ | ports=24 | sfp=4
  nvr NVR-SIEGE | 10.14.0.40 | Hikvision 32 voies

FW-SIEGE:LAN1 -> SW-CORE:Te1 | fibre | trunk | vlan=10,20,30
SW-CORE:Te3 -> SW-CAM:Te1 | fibre | trunk | vlan=30
NVR-SIEGE -> SW-CAM:1 | vlan=30
camera CAM-SIEGE x8 | 10.14.30.11 | Bullet 8 MP | sur SW-CAM:2 | vlan=30 | passerelle=10.14.30.1
poste PC-ACCUEIL x2 | 10.14.10.91 | sur SW-CORE:1 | vlan=10

# ---------- Ville de Lyon : trois écoles qui remontent à la mairie ----------
site Lyon | passerelle=10.20.0.1

point Mairie
baie M1
  switch SW-MAIRIE | 10.20.0.2 | Cisco Catalyst 9200-24P | ports=24 | sfp=4
camera CAM-MAIRIE x2 | 10.20.30.10 | Dôme 4 MP | sur SW-MAIRIE:1 | vlan=30

point École Jaurès | passerelle=10.20.1.1
switch SW-JAURES | 10.20.1.2 | Netgear GS110TP PoE | ports=8 | sfp=2 | sur SW-MAIRIE:Te1 | fibre
camera CAM-JAURES x4 | 10.20.31.10 | sur SW-JAURES:1 | vlan=30

point École Ferry
switch SW-FERRY | 10.20.2.2 | Netgear GS110TP PoE | ports=8 | sfp=2 | sur SW-MAIRIE:Te2 | fibre
camera CAM-FERRY x3 | 10.20.32.10 | sur SW-FERRY:1 | vlan=30

point École Curie
switch SW-CURIE | 10.20.3.2 | Netgear GS108PE | ports=8 | sur SW-MAIRIE:20 | radio
camera CAM-CURIE x2 | 10.20.33.10 | sur SW-CURIE:1 | vlan=30

# ---------- Agence de Lille : ni pare-feu ni onduleur, rien n'est obligatoire ----------
site Lille | passerelle=10.30.0.1
switch SW-LILLE-1 | 10.30.0.2 | HPE 1820-24G | ports=24 | sfp=2
switch SW-LILLE-2 | 10.30.0.3 | HPE 1820-8G PoE | ports=8 | sfp=2
SW-LILLE-1:Te1 -> SW-LILLE-2:Te1 | fibre | trunk | vlan=10,30
camera CAM-LILLE x6 | 10.30.30.10 | sur SW-LILLE-2:1 | vlan=30
poste PC-LILLE x3 | 10.30.10.91 | sur SW-LILLE-1:1 | vlan=10

# ---------- Entre sites : Lyon remonte au siège, Lille passe par Lyon ----------
FW-SIEGE:WAN1 -> SW-MAIRIE:Te4 | fibre | lien opérateur
SW-MAIRIE:Te3 -> SW-LILLE-1:Te2 | fibre | trunk | vlan=10,30
FW-SIEGE:WAN2 -> SW-LILLE-1:24 | vpn | secours
`;
