/**
 * Relevé de démonstration du jumeau 3D.
 *
 * Hiérarchie : Site → Étage → Baie → Équipement. C'est le modèle de données
 * autant que la navigation — et c'est ce fichier que remplit le technicien
 * après son passage sur site. Le reste du module n'en dépend que par cette
 * forme, donc un autre relevé s'y substitue sans toucher à la scène.
 *
 * Les deux CVE citées sont réelles et inscrites au catalogue CISA des failles
 * activement exploitées ; le reste des constats est plausible mais inventé,
 * d'où le bandeau « Données de démonstration » affiché en permanence.
 */

export type Severite = "crit" | "high" | "med";
export type Constat = { id: string; sev: Severite; score: string; txt: string };
export type Equipement = {
  id: string; u: number; kind: string; name: string; pos: string;
  coeur?: boolean; kv: [string, string][]; vulns: Constat[];
};
export type Baie = {
  id: string; nom: string; sous: string; x: number; z: number;
  pire?: Severite; devices: Equipement[];
};
export type Poste = {
  id: string; nom: string; ilot: string; x: number; z: number; rot: number;
  sev: Severite | null; kv: [string, string][]; vulns: Constat[];
};
export type Borne = {
  id: string; nom: string; x: number; z: number; portee: number;
  sev: Severite | null; kv: [string, string][]; vulns: Constat[];
};
export type Zone = {
  nom: string; x1: number; x2: number; z1: number; z2: number; teinte: number;
};
export type Etage = {
  id: string; num: string; nom: string; sous: string; pire: Severite;
  zones: Zone[]; cloison: { x: number; z1: number; z2: number; porte: [number, number] };
  baies: Baie[]; postes: Poste[]; bornes: Borne[];
};
export type Site = { nom: string; etages: Etage[] };

type Extra = Partial<Pick<Poste, "sev" | "kv" | "vulns">>;
const PC = (id: string, nom: string, ip: string, port: string, extra: Extra = {}) => ({
  id, nom, sev: null as Severite | null,
  kv: [["Système", "Windows 11 Pro 23H2"], ["Adresse", ip],
       ["Connecté sur", port], ["État", "à jour"]] as [string, string][],
  vulns: [] as Constat[], ...extra,
});

// Deux postes dos à dos autour de (ix,iz). Le premier regarde vers -z.
const ILOT = (nom: string, ix: number, iz: number,
              a: ReturnType<typeof PC>, b: ReturnType<typeof PC>): Poste[] => [
  { ...a, ilot: nom, x: ix, z: iz - 0.95, rot: Math.PI },
  { ...b, ilot: nom, x: ix, z: iz + 0.95, rot: 0 },
];

export const SITE: Site = { nom: 'Site de Nanterre', etages:[

{ id:'rdc', num:'RDC', nom:'Rez-de-chaussée', sous:'Salle technique · plateau commercial', pire:'crit',
  zones:[ { nom:'Local technique', x1:-11.5, x2:3.2, z1:-8.5, z2:8.5, teinte:0x0C1119 },
          { nom:'Open space',      x1:3.2,  x2:24,  z1:-8.5, z2:8.5, teinte:0x19222D } ],
  cloison:{ x:3.2, z1:-8.5, z2:8.5, porte:[-1.6,1.6] },
  baies:[
  { id:'A1', nom:'Baie A1', sous:'Cœur de réseau', x:-8.2, z:0, pire:'crit', devices:[
    { id:'pp1', u:1, kind:'Panneau de brassage', name:'Panneau 24 ports Cat6a', pos:'A1 · U24',
      kv:[['Type','passif'],['Ports','24 · RJ45 Cat6a'],['Occupés','19']], vulns:[] },
    { id:'sw1', u:1, kind:'Commutateur', name:'Cisco Catalyst 9300-24T', pos:'A1 · U22', coeur:true,
      kv:[['Système','IOS XE 17.6.4'],['Adresse','10.14.0.2'],['Ports','24 × 1 GbE + 4 × 10 GbE'],
          ['Actifs','19 / 24'],['Relevé','LLDP + SNMP v3']],
      vulns:[{ id:'CVE-2023-20198', sev:'crit', score:'10.0',
        txt:"Interface web d'IOS XE exposée : création d'un compte de niveau 15 sans authentification. Les versions 17.6 jusqu'à 17.6.6a sont concernées lorsque ip http server est actif. Inscrite au catalogue CISA des failles activement exploitées." }] },
    { id:'srv1', u:2, kind:'Serveur', name:'Dell PowerEdge R740', pos:'A1 · U19',
      kv:[['Système','Windows Server 2019 Standard'],['Adresse','10.14.0.11'],['Rôle','AD DS · DNS'],
          ['Disques','4 × 1,2 To SAS · RAID 10'],['Administration','iDRAC 9']],
      vulns:[{ id:'CVE-2021-21551', sev:'high', score:'7.8',
        txt:"Pilote Dell dbutil_2_3.sys : contrôle d'accès insuffisant permettant une élévation de privilèges par un utilisateur local authentifié. Inscrite au catalogue CISA des failles activement exploitées." }] },
    { id:'srv2', u:2, kind:'Serveur', name:'Dell PowerEdge R640', pos:'A1 · U16',
      kv:[['Système','Windows Server 2022 Standard'],['Adresse','10.14.0.12'],['Rôle','Fichiers · Sauvegarde'],
          ['Disques','6 × 2 To SAS · RAID 6'],['Administration','iDRAC 9']], vulns:[] },
    { id:'ups1', u:3, kind:'Onduleur', name:'Onduleur 3000 VA', pos:'A1 · U09',
      kv:[['Charge','41 %'],['Autonomie','24 min'],['Batteries','remplacées il y a 4 ans'],['Carte réseau','10.14.0.30']],
      vulns:[{ id:'Batteries', sev:'med', score:'',
        txt:"Batteries au-delà de la durée de vie recommandée de 3 à 5 ans. L'autonomie annoncée peut s'effondrer lors d'une coupure réelle." }] },
  ]},
  { id:'A2', nom:'Baie A2', sous:'Stockage et virtualisation', x:-2.4, z:0, pire:'med', devices:[
    { id:'pp2', u:1, kind:'Panneau de brassage', name:'Panneau 12 ports fibre OM4', pos:'A2 · U24',
      kv:[['Type','passif'],['Ports','12 · LC duplex'],['Occupés','6']], vulns:[] },
    { id:'sw2', u:1, kind:'Commutateur', name:'Zyxel XS1935-12F', pos:'A2 · U22',
      kv:[['Système','FaOS 1.00'],['Adresse','10.14.0.3'],['Ports','10 × SFP+ + 2 × multi-gig'],
          ['Liaison montante','Catalyst 9300 · Te1/1/1']],
      vulns:[{ id:'Administration', sev:'med', score:'',
        txt:"Interface d'administration accessible en HTTP. Activer HTTPS et désactiver HTTP sur l'interface de gestion." }] },
    { id:'esx1', u:2, kind:'Hyperviseur', name:'Dell PowerEdge R750', pos:'A2 · U19',
      kv:[['Système','VMware ESXi 8.0 U2'],['Adresse','10.14.0.21'],['Machines','14 actives'],
          ['Mémoire','384 Go'],['Administration','iDRAC 9']], vulns:[] },
    { id:'nas1', u:2, kind:'Stockage', name:'Baie de sauvegarde 8 disques', pos:'A2 · U16',
      kv:[['Capacité','8 × 4 To'],['Adresse','10.14.0.20'],['Protocole','SMB 3.1.1'],['Dernière sauvegarde','il y a 9 h']],
      vulns:[{ id:'Micrologiciel', sev:'med', score:'',
        txt:"Micrologiciel en retard de deux versions majeures. Aucune faille publique sur la version installée, mais l'écart d'entretien mérite une planification." }] },
    { id:'ups2', u:3, kind:'Onduleur', name:'Onduleur 2200 VA', pos:'A2 · U09',
      kv:[['Charge','58 %'],['Autonomie','17 min'],['Batteries','remplacées il y a 1 an'],['Carte réseau','10.14.0.31']], vulns:[] },
  ]}],
  postes:[
    ...ILOT('Îlot 1', 8.6,-4.6,
      PC('p01','Poste commercial 01','10.14.0.91','Catalyst 9300 · Gi1/0/5'),
      PC('p02','Poste commercial 02','10.14.0.92','Catalyst 9300 · Gi1/0/6')),
    ...ILOT('Îlot 2', 14.6,-4.6,
      PC('p03','Poste commercial 03','10.14.0.93','Catalyst 9300 · Gi1/0/7'),
      PC('p04','Poste commercial 04','10.14.0.94','Catalyst 9300 · Gi1/0/8', { sev:'high',
        kv:[['Système','Windows 10 Pro 21H2'],['Adresse','10.14.0.94'],
            ['Connecté sur','Catalyst 9300 · Gi1/0/8'],['État','fin de support']],
        vulns:[{ id:'Fin de support', sev:'high', score:'',
          txt:"Windows 10 21H2 ne reçoit plus de correctifs de sécurité. Toute faille publiée depuis la fin de support reste ouverte sur ce poste." }] })),
    ...ILOT('Îlot 3', 20.6,-4.6,
      PC('p05','Poste commercial 05','10.14.0.95','Catalyst 9300 · Gi1/0/9'),
      PC('p06','Poste commercial 06','10.14.0.96','Catalyst 9300 · Gi1/0/10')),
    ...ILOT('Îlot 4', 8.6, 4.6,
      PC('p07','Poste commercial 07','10.14.0.97','Catalyst 9300 · Gi1/0/11'),
      PC('p08','Poste commercial 08','10.14.0.98','Catalyst 9300 · Gi1/0/12')),
    ...ILOT('Îlot 5', 14.6, 4.6,
      PC('p09','Poste commercial 09','10.14.0.99','Catalyst 9300 · Gi1/0/13', { sev:'med',
        kv:[['Système','Windows 11 Pro 23H2'],['Adresse','10.14.0.99'],
            ['Connecté sur','Catalyst 9300 · Gi1/0/13'],['Chiffrement disque','désactivé']],
        vulns:[{ id:'BitLocker', sev:'med', score:'',
          txt:"Disque non chiffré sur un poste portable. En cas de vol, les données sont lisibles en montant le disque sur une autre machine." }] }),
      PC('p10','Poste commercial 10','10.14.0.100','Catalyst 9300 · Gi1/0/14')),
    ...ILOT('Îlot 6', 20.6, 4.6,
      PC('p11','Poste commercial 11','10.14.0.101','Catalyst 9300 · Gi1/0/15'),
      PC('p12','Poste commercial 12','10.14.0.102','Catalyst 9300 · Gi1/0/16')),
  ],
  bornes:[
    { id:'ap01', nom:'Borne Wi-Fi · accueil', x:10.6, z:0, portee:5.2, sev:'high',
      kv:[['Modèle','Aruba AP-515'],['Adresse','10.14.0.71'],
          ['Connecté sur','Catalyst 9300 · Gi1/0/20 · PoE+'],
          ['SSID','NANTERRE-CORP · NANTERRE-INVITE'],['Chiffrement','WPA2-PSK']],
      vulns:[{ id:'SSID invité', sev:'high', score:'',
        txt:"Le réseau invité est diffusé par la même borne que le réseau interne, sans VLAN dédié ni isolation client. Un visiteur connecté au Wi-Fi invité atteint le même réseau que les serveurs." },
             { id:'WPA2-PSK', sev:'med', score:'',
        txt:"Clé partagée unique pour tout le personnel : elle ne se révoque pas au départ d'un salarié et se recopie d'un téléphone à l'autre. WPA2-Entreprise (802.1X) lie l'accès au compte." }] },
    { id:'ap02', nom:'Borne Wi-Fi · fond de plateau', x:18.4, z:0, portee:5.2, sev:null,
      kv:[['Modèle','Aruba AP-515'],['Adresse','10.14.0.72'],
          ['Connecté sur','Catalyst 9300 · Gi1/0/21 · PoE+'],
          ['SSID','NANTERRE-CORP'],['Chiffrement','WPA2-Entreprise · 802.1X']], vulns:[] },
  ]},

{ id:'e1', num:'R+1', nom:'Étage 1', sous:'Local de brassage · plateau administratif', pire:'high',
  zones:[ { nom:'Local de brassage', x1:-8, x2:2.4, z1:-7.5, z2:7.5, teinte:0x0C1119 },
          { nom:'Open space',        x1:2.4, x2:23, z1:-8.5, z2:8.5, teinte:0x19222D } ],
  cloison:{ x:2.4, z1:-7.5, z2:7.5, porte:[-1.6,1.6] },
  baies:[
  { id:'B1', nom:'Baie B1', sous:'Distribution plateau', x:-3.4, z:0, pire:'high', devices:[
    { id:'pp3', u:1, kind:'Panneau de brassage', name:'Panneau 48 ports Cat6', pos:'B1 · U24',
      kv:[['Type','passif'],['Ports','48 · RJ45 Cat6'],['Occupés','31']], vulns:[] },
    { id:'sw3', u:1, kind:'Commutateur', name:'Aruba 2530-8G', pos:'B1 · U22',
      kv:[['Système','AOS-S YA.16.10.0009'],['Adresse','10.14.1.2'],['Ports','8 × 1 GbE + 2 SFP'],
          ['Liaison montante','Catalyst 9300 · Gi1/0/24'],['Relevé','LLDP + SNMP v2c']],
      vulns:[{ id:'SNMP v2c', sev:'high', score:'',
        txt:"Administration en SNMP v2c : la communauté circule en clair sur le réseau. Passer en SNMP v3 avec authentification et chiffrement." }] },
    { id:'sw4', u:1, kind:'Commutateur', name:'Aruba 2530-24G', pos:'B1 · U21',
      kv:[['Système','AOS-S YA.16.11.0003'],['Adresse','10.14.1.3'],['Ports','24 × 1 GbE + 4 SFP'],
          ['Actifs','21 / 24'],['Relevé','LLDP + SNMP v3']], vulns:[] },
    { id:'ups3', u:2, kind:'Onduleur', name:'Onduleur 1500 VA', pos:'B1 · U17',
      kv:[['Charge','33 %'],['Autonomie','31 min'],['Batteries','remplacées il y a 2 ans'],['Carte réseau','aucune']],
      vulns:[{ id:'Supervision', sev:'med', score:'',
        txt:"Onduleur sans carte réseau : aucune alerte en cas de coupure ou de batterie défaillante. L'incident se découvre après coup." }] },
  ]}],
  postes:[
    ...ILOT('Îlot A', 7.6,-4.6,
      PC('q01','Poste comptabilité 01','10.14.1.41','Aruba 2530-24G · port 5'),
      PC('q02','Poste comptabilité 02','10.14.1.42','Aruba 2530-24G · port 6')),
    ...ILOT('Îlot B', 13.6,-4.6,
      PC('q03','Poste paie','10.14.1.43','Aruba 2530-24G · port 7'),
      PC('q04','Poste RH','10.14.1.44','Aruba 2530-24G · port 8')),
    ...ILOT('Îlot C', 19.6,-4.6,
      PC('q05','Poste direction','10.14.1.45','Aruba 2530-24G · port 9'),
      PC('q06','Poste assistanat','10.14.1.46','Aruba 2530-24G · port 10')),
    ...ILOT('Îlot D', 7.6, 4.6,
      PC('q07','Poste accueil','10.14.1.47','Aruba 2530-24G · port 11'),
      PC('q08','Poste accueil 02','10.14.1.48','Aruba 2530-24G · port 12')),
    ...ILOT('Îlot E', 13.6, 4.6,
      PC('q09','Poste achats','10.14.1.49','Aruba 2530-24G · port 13', { sev:'med',
        kv:[['Système','Windows 11 Pro 22H2'],['Adresse','10.14.1.49'],
            ['Connecté sur','Aruba 2530-24G · port 13'],['Correctifs','en retard de 2 versions']],
        vulns:[{ id:'Mises à jour', sev:'med', score:'',
          txt:"Poste resté en 22H2 alors que le reste du plateau est en 23H2. L'écart de correctifs s'élargit à chaque Patch Tuesday." }] }),
      PC('q10','Poste juridique','10.14.1.50','Aruba 2530-24G · port 14')),
    { id:'q11', nom:'Imprimante réseau', ilot:'Îlot F', x:19.6, z:4.6, rot:0, sev:'med',
      kv:[['Modèle','Multifonction A3'],['Adresse','10.14.1.55'],
          ['Connecté sur','Aruba 2530-8G · port 4'],['État','micrologiciel ancien']],
      vulns:[{ id:'Micrologiciel', sev:'med', score:'',
        txt:"Micrologiciel d'imprimante non mis à jour depuis la mise en service. Les multifonctions exposent souvent une interface web et un service d'impression accessibles sans authentification." }] },
  ],
  bornes:[
    { id:'ap11', nom:'Borne Wi-Fi · plateau nord', x:9.6, z:0, portee:5.0, sev:'med',
      kv:[['Modèle','Cisco Catalyst 9115AX'],['Adresse','10.14.1.71'],
          ['Connecté sur','Aruba 2530-8G · port 7 · PoE+'],
          ['SSID','NANTERRE-CORP'],['Micrologiciel','17.3.4 · 3 ans']],
      vulns:[{ id:'Micrologiciel', sev:'med', score:'',
        txt:"Borne restée sur une version de 2021 alors que la branche 17.9 est publiée. Les correctifs Wi-Fi des trois dernières années ne sont pas appliqués." }] },
    { id:'ap12', nom:'Borne Wi-Fi · plateau sud', x:17.2, z:0, portee:5.0, sev:null,
      kv:[['Modèle','Cisco Catalyst 9115AX'],['Adresse','10.14.1.72'],
          ['Connecté sur','Aruba 2530-8G · port 8 · PoE+'],
          ['SSID','NANTERRE-CORP'],['Micrologiciel','17.9.5 · à jour']], vulns:[] },
  ]},
] };
