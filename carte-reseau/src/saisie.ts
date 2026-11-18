/**
 * Lecture de la saisie manuelle.
 *
 * On écrit l'inventaire comme on le noterait sur site, une ligne par
 * équipement ou par liaison. Ce module n'a aucune dépendance au rendu : il
 * rend une liste de sites, d'équipements et de liaisons, plus les alertes à
 * corriger (nom inconnu, port déjà pris…), chacune avec son numéro de ligne.
 */

export type Genre =
  | "passerelle" | "parefeu" | "switch" | "camera" | "nvr" | "borne"
  | "serveur" | "nas" | "poste" | "imprimante" | "telephone" | "onduleur" | "autre";

export type Equipement = {
  nom: string;
  genre: Genre;
  site: string;
  baie?: string;
  ip?: string;
  infos: string[];          // texte libre après le nom (modèle, remarques…)
  kv: [string, string][];   // clé=valeur
  ligne: number;
};

export type Liaison = {
  a: string; portA?: string;
  b: string; portB?: string;
  /** trunk : plusieurs VLAN étiquetés (lien entre switchs) ; access : un seul VLAN. */
  mode?: "trunk" | "access";
  vlans?: string;
  libelle?: string;
  ligne: number;
};

export type Site = { nom: string; infos: string[]; ligne: number };
export type Alerte = { ligne: number; niveau: "erreur" | "attention"; msg: string };
export type Inventaire = { sites: Site[]; equipements: Equipement[]; liaisons: Liaison[]; alertes: Alerte[] };

export const GENRES: Record<Genre, { libelle: string; mots: string[] }> = {
  passerelle: { libelle: "Passerelle / routeur", mots: ["passerelle", "gateway", "gw", "routeur", "router", "box"] },
  parefeu:    { libelle: "Pare-feu",            mots: ["parefeu", "pare-feu", "firewall", "fw", "utm"] },
  switch:     { libelle: "Switch",              mots: ["switch", "sw", "commutateur"] },
  camera:     { libelle: "Caméra",              mots: ["camera", "cam", "cameras"] },
  nvr:        { libelle: "Enregistreur (NVR)",  mots: ["nvr", "enregistreur", "dvr"] },
  borne:      { libelle: "Borne Wi-Fi",         mots: ["borne", "bornes", "wifi", "wi-fi", "ap"] },
  serveur:    { libelle: "Serveur",             mots: ["serveur", "server", "srv", "hyperviseur", "esx", "esxi"] },
  nas:        { libelle: "NAS / stockage",      mots: ["nas", "stockage", "san"] },
  poste:      { libelle: "Poste",               mots: ["poste", "postes", "pc", "ordinateur", "portable"] },
  imprimante: { libelle: "Imprimante",          mots: ["imprimante", "imprimantes", "copieur", "multifonction"] },
  telephone:  { libelle: "Téléphone IP",        mots: ["telephone", "tel", "voip", "ipbx", "standard"] },
  onduleur:   { libelle: "Onduleur",            mots: ["onduleur", "ups"] },
  autre:      { libelle: "Autre",               mots: ["equipement", "autre", "iot", "badgeuse", "automate", "capteur"] },
};

const simple = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const GENRE_PAR_MOT = new Map<string, Genre>();
(Object.keys(GENRES) as Genre[]).forEach((g) => GENRES[g].mots.forEach((m) => GENRE_PAR_MOT.set(m, g)));

const IP = /^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/;
const FLECHE = /\s*(?:->|<->|<-|—|–|--|=>|→)\s*/;

function ipPlus(ip: string, k: number) {
  const [adr, masque] = ip.split("/");
  const o = adr.split(".").map(Number);
  const n = (((o[0] << 24) >>> 0) + (o[1] << 16) + (o[2] << 8) + o[3] + k) >>> 0;
  return [24, 16, 8, 0].map((d) => (n >>> d) & 255).join(".") + (masque ? `/${masque}` : "");
}

type OptionsLien = { mode?: "trunk" | "access"; vlans?: string; libelle?: string };

/** « trunk », « access », « vlan=10,20 », « vlan 30 » ; le reste fait le libellé. */
function lireOptionsLien(champs: string[]): OptionsLien & { reste: string[] } {
  const o: OptionsLien & { reste: string[] } = { reste: [] };
  for (const brut of champs) {
    const c = brut.trim();
    if (!c) continue;
    if (/^trunk$/i.test(c)) o.mode = "trunk";
    else if (/^access$/i.test(c)) o.mode = "access";
    else if (/^vlans?\s*[=: ]\s*\S/i.test(c)) o.vlans = c.replace(/^vlans?\s*[=: ]\s*/i, "").replace(/\s+/g, "");
    else o.reste.push(c);
  }
  // Plusieurs VLAN sur un lien, c'est un trunk même si on ne l'a pas écrit.
  if (!o.mode && o.vlans && /[,\-]/.test(o.vlans)) o.mode = "trunk";
  if (o.reste.length) o.libelle = o.reste.join(" · ");
  return o;
}

/** « SW1:5 », « SW1 port 5 », « SW1 » → { nom, port } */
function lireExtremite(s: string): { nom: string; port?: string } {
  const t = s.trim();
  const m = t.match(/^(.+?)\s+port\s+(\S+)$/i) ?? t.match(/^([^:\s]+)\s*:\s*(\S+)$/);
  if (m) return { nom: m[1].trim(), port: m[2].trim() };
  return { nom: t };
}

/** Un port numérique s'incrémente pour un groupe (« CAM-* -> SW:2 » → 2, 3, 4…). */
const portPlus = (p: string | undefined, k: number) => {
  if (!p || k === 0) return p;
  const m = p.match(/^(.*?)(\d+)$/);
  return m ? `${m[1]}${Number(m[2]) + k}` : p;
};

export function analyser(texte: string): Inventaire {
  const sites: Site[] = [];
  const equipements: Equipement[] = [];
  const liaisons: Liaison[] = [];
  const alertes: Alerte[] = [];
  let siteCourant: string | null = null;
  let baieCourante: string | undefined;
  const brutes: ({ de: string; vers: string; ligne: number } & OptionsLien)[] = [];

  const assurerSite = (ligne: number) => {
    if (!siteCourant) {
      siteCourant = "Site principal";
      sites.push({ nom: siteCourant, infos: [], ligne });
    }
    return siteCourant;
  };

  texte.split(/\r?\n/).forEach((brut, i) => {
    const ligne = i + 1;
    const l = brut.replace(/(^|\s)(#|\/\/).*$/, "").trim();
    if (!l) return;

    const [tete, ...champs] = l.split(/\s*[|;\t]\s*/);

    // ----- liaison : « A:port -> B:port | libellé » -----
    if (FLECHE.test(tete)) {
      const [de, vers] = tete.split(FLECHE);
      if (!de || !vers) {
        alertes.push({ ligne, niveau: "erreur", msg: "Liaison incomplète : écrire  EQUIPEMENT:port -> EQUIPEMENT:port" });
        return;
      }
      const { reste: _r, ...opts } = lireOptionsLien(champs);
      brutes.push({ de, vers, ...opts, ligne });
      return;
    }

    const mots = tete.split(/\s+/);
    const mot = simple(mots[0]).replace(/:$/, "");
    const reste = tete.slice(mots[0].length).replace(/^\s*:?\s*/, "").trim();

    if (mot === "site") {
      if (!reste) { alertes.push({ ligne, niveau: "erreur", msg: "Site sans nom : écrire  site Nanterre" }); return; }
      if (sites.some((s) => simple(s.nom) === simple(reste)))
        alertes.push({ ligne, niveau: "attention", msg: `Le site « ${reste} » est déclaré deux fois : les équipements s'ajoutent au premier.` });
      else sites.push({ nom: reste, infos: champs.filter(Boolean), ligne });
      siteCourant = sites.find((s) => simple(s.nom) === simple(reste))!.nom;
      baieCourante = undefined;
      return;
    }
    if (mot === "baie" || mot === "rack") {
      assurerSite(ligne);
      baieCourante = reste || undefined;
      return;
    }
    if (mot === "fin" && /^baie$/i.test(reste)) { baieCourante = undefined; return; }

    // Seules les lignes en retrait sous « baie X » sont dans la baie : une
    // ligne collée à gauche en sort, comme on l'écrirait sur papier.
    if (!/^\s/.test(brut)) baieCourante = undefined;

    const genre = GENRE_PAR_MOT.get(mot);
    if (!genre) {
      alertes.push({ ligne, niveau: "erreur",
        msg: `« ${mots[0]} » n'est pas un type connu. Types : site, baie, passerelle, parefeu, switch, camera, nvr, borne, serveur, nas, poste, imprimante, telephone, onduleur, autre — ou une liaison A -> B.` });
      return;
    }

    // « camera CAM-PARKING x4 » → CAM-PARKING-1 … CAM-PARKING-4
    let nom = reste;
    let qte = 1;
    const mq = nom.match(/^(.*?)\s+x(\d+)$/i);
    if (mq) { nom = mq[1].trim(); qte = Math.max(1, Math.min(500, Number(mq[2]))); }
    if (!nom) {
      alertes.push({ ligne, niveau: "erreur", msg: `Il manque le nom : écrire  ${mots[0]} NOM | adresse IP | infos` });
      return;
    }
    if (/\s/.test(nom))
      alertes.push({ ligne, niveau: "attention", msg: `« ${nom} » contient des espaces : préférez CAM-ENTREE à « CAM ENTREE », c'est le nom qu'on réutilise dans les liaisons.` });

    let ip: string | undefined;
    const infos: string[] = [];
    const kv: [string, string][] = [];
    let versInline: string | undefined;
    let siteLigne: string | undefined;
    const optsInline: OptionsLien = {};
    for (const c of champs) {
      if (!c) continue;
      if (IP.test(c)) ip = c;
      else if (/^trunk$/i.test(c)) optsInline.mode = "trunk";
      else if (/^access$/i.test(c)) optsInline.mode = "access";
      else if (/^vlans?\s*[=: ]\s*\S/i.test(c)) {
        optsInline.vlans = lireOptionsLien([c]).vlans;
        kv.push(["VLAN", optsInline.vlans!]);
      }
      else if (FLECHE.test(` ${c}`) && /^(->|→|=>|--)/.test(c.trim())) versInline = c.trim().replace(/^(->|→|=>|--)\s*/, "");
      else if (/^sur\s+/i.test(c)) versInline = c.replace(/^sur\s+/i, "");
      // « site=Lyon » ou « @Lyon » : le site se donne sur la ligne même,
      // sans ouvrir de bloc. Le site est créé s'il n'existe pas encore.
      else if (/^site\s*=/i.test(c)) siteLigne = c.replace(/^site\s*=\s*/i, "").trim();
      else if (/^@\S/.test(c)) siteLigne = c.slice(1).trim();
      else if (c.includes("=")) { const k = c.indexOf("="); kv.push([c.slice(0, k).trim(), c.slice(k + 1).trim()]); }
      else infos.push(c);
    }

    let site: string;
    if (siteLigne) {
      const connu = sites.find((x) => simple(x.nom) === simple(siteLigne!));
      if (!connu) sites.push({ nom: siteLigne, infos: [], ligne });
      site = connu?.nom ?? siteLigne;
    } else site = assurerSite(ligne);
    for (let k = 0; k < qte; k++) {
      const n = qte > 1 ? `${nom}-${k + 1}` : nom;
      if (equipements.some((e) => simple(e.nom) === simple(n))) {
        alertes.push({ ligne, niveau: "erreur", msg: `« ${n} » existe déjà : chaque équipement doit avoir un nom unique (il sert dans les liaisons).` });
        continue;
      }
      equipements.push({ nom: n, genre, site, baie: baieCourante, ip: ip && ipPlus(ip, k), infos, kv, ligne });
      if (versInline) {
        const v = lireExtremite(versInline);
        brutes.push({ de: n, vers: v.port ? `${v.nom}:${portPlus(v.port, k)}` : v.nom, ligne, ...optsInline });
      }
    }
  });

  // ----- résolution des liaisons, une fois tous les équipements connus -----
  const parNom = new Map(equipements.map((e) => [simple(e.nom), e]));
  const trouver = (motif: string): Equipement[] => {
    if (motif.endsWith("*")) {
      const p = simple(motif.slice(0, -1));
      return equipements.filter((e) => simple(e.nom).startsWith(p));
    }
    const e = parNom.get(simple(motif));
    return e ? [e] : [];
  };
  const portsPris = new Map<string, number>();

  for (const r of brutes) {
    const A = lireExtremite(r.de), B = lireExtremite(r.vers);
    const as = trouver(A.nom), bs = trouver(B.nom);
    if (!as.length) { alertes.push({ ligne: r.ligne, niveau: "erreur", msg: `Liaison : « ${A.nom} » n'est déclaré nulle part.` }); continue; }
    if (!bs.length) { alertes.push({ ligne: r.ligne, niveau: "erreur", msg: `Liaison : « ${B.nom} » n'est déclaré nulle part.` }); continue; }
    if (as.length > 1 && bs.length > 1) {
      alertes.push({ ligne: r.ligne, niveau: "erreur", msg: "Liaison : un seul des deux côtés peut être un groupe (NOM*)." }); continue;
    }
    const n = Math.max(as.length, bs.length);
    for (let k = 0; k < n; k++) {
      const a = as[Math.min(k, as.length - 1)], b = bs[Math.min(k, bs.length - 1)];
      if (a === b) { alertes.push({ ligne: r.ligne, niveau: "erreur", msg: `« ${a.nom} » est relié à lui-même.` }); continue; }
      const l: Liaison = {
        a: a.nom, portA: as.length > 1 ? A.port : portPlus(A.port, k),
        b: b.nom, portB: bs.length > 1 ? B.port : portPlus(B.port, k),
        mode: r.mode, vlans: r.vlans, libelle: r.libelle, ligne: r.ligne,
      };
      // Deux switchs reliés entre eux : par défaut c'est un trunk.
      const genreDe = (nom: string) => parNom.get(simple(nom))?.genre;
      if (!l.mode && genreDe(l.a) === "switch" && genreDe(l.b) === "switch") l.mode = "trunk";
      for (const [eq, port] of [[l.a, l.portA], [l.b, l.portB]] as const) {
        if (!port) continue;
        const cle = `${simple(eq)}:${simple(port)}`;
        const deja = portsPris.get(cle);
        if (deja) alertes.push({ ligne: r.ligne, niveau: "attention", msg: `Port ${port} de ${eq} déjà utilisé (ligne ${deja}).` });
        else portsPris.set(cle, r.ligne);
      }
      liaisons.push(l);
    }
  }

  // Un équipement sans aucune liaison est souvent un oubli.
  const relies = new Set(liaisons.flatMap((l) => [l.a, l.b]));
  equipements.forEach((e) => {
    if (!relies.has(e.nom) && e.genre !== "onduleur")
      alertes.push({ ligne: e.ligne, niveau: "attention", msg: `« ${e.nom} » n'est relié à rien.` });
  });

  alertes.sort((x, y) => x.ligne - y.ligne);
  return { sites, equipements, liaisons, alertes };
}

export const TYPES = (Object.keys(GENRES) as Genre[]).map((g) => GENRES[g].mots[0]);

export const EXEMPLE = `# Une ligne par équipement, une ligne par liaison.
# Équipement : type NOM | IP | modèle | @Site | sur SWITCH:port | vlan=20
# Liaison    : NOM:port -> NOM:port | trunk | vlan=10,20,30

# ---------- Siège : 3 switchs en cascade ----------
site Nanterre | Siège

baie A1
  parefeu FW-NANTERRE | 10.14.0.1 | FortiGate 100F | ports=8
  switch SW-CORE | 10.14.0.2 | Cisco Catalyst 9300-24T | ports=24 | sfp=4
  switch SW-ETAGE | 10.14.0.3 | Cisco Catalyst 9200-24P | ports=24 | sfp=4
  switch SW-CAM | 10.14.0.4 | Aruba 2930F-24G PoE+ | ports=24 | sfp=4
  serveur SRV-AD | 10.14.0.11 | Dell PowerEdge R650
  nvr NVR-1 | 10.14.0.40 | Hikvision 32 voies
  onduleur UPS-A1 | APC Smart-UPS 3000

FW-NANTERRE:LAN1 -> SW-CORE:Te1 | trunk | vlan=10,20,30
SW-CORE:Te2 -> SW-ETAGE:Te1 | trunk | vlan=10,20
SW-CORE:Te3 -> SW-CAM:Te1 | trunk | vlan=30
SRV-AD -> SW-CORE:1 | vlan=10
NVR-1 -> SW-CAM:1 | vlan=30

camera CAM-ACCUEIL | 10.14.30.10 | Dôme 4 MP | sur SW-CAM:2 | vlan=30
camera CAM-PARKING x6 | 10.14.30.11 | Bullet 8 MP | sur SW-CAM:3 | vlan=30
borne AP-RDC x2 | 10.14.20.71 | Aruba AP-515 | sur SW-ETAGE:1 | vlan=20
poste PC-COMPTA x4 | 10.14.10.91 | sur SW-ETAGE:5 | vlan=10
imprimante IMP-RDC | 10.14.10.55 | sur SW-ETAGE:12 | vlan=10
telephone TEL-ACCUEIL | 10.14.10.60 | sur SW-ETAGE:13 | vlan=10

# ---------- Lyon : 2 switchs ----------
site Lyon | Agence

baie L1
  passerelle GW-LYON | 10.20.0.1 | Box fibre pro | ports=4
  switch SW-LYON-1 | 10.20.0.2 | Netgear GS724T | ports=24 | sfp=2 | sur GW-LYON:LAN1
  switch SW-LYON-2 | 10.20.0.3 | Netgear GS110TP PoE | ports=8 | sfp=2

SW-LYON-1:24 -> SW-LYON-2:8 | trunk | vlan=10,30
camera CAM-LYON x3 | 10.20.30.10 | sur SW-LYON-2:1 | vlan=30
poste PC-LYON x3 | 10.20.10.91 | sur SW-LYON-1:1 | vlan=10

# ---------- entre sites ----------
FW-NANTERRE:WAN1 -> GW-LYON:WAN | VPN IPsec
`;
