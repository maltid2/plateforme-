/**
 * Lecture de la saisie manuelle.
 *
 * On écrit l'inventaire comme on le noterait sur site, une ligne par
 * équipement ou par liaison. Ce module n'a aucune dépendance au rendu : il
 * rend une liste de sites, d'équipements et de liaisons, plus les alertes à
 * corriger (nom inconnu, port déjà pris…), chacune avec son numéro de ligne.
 */

import { lirePort } from "./facade.ts";

export type Genre =
  | "passerelle" | "parefeu" | "switch" | "camera" | "nvr" | "borne"
  | "serveur" | "nas" | "poste" | "imprimante" | "telephone" | "onduleur" | "autre";

export type Equipement = {
  nom: string;
  genre: Genre;
  site: string;
  /** Un lieu dans le site : une école dans une ville, un bâtiment sur un campus. */
  point?: string;
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
  /** Le support physique : fibre et cuivre (RJ45) ne se confondent pas sur la carte. */
  media?: Media;
  libelle?: string;
  ligne: number;
};

export type Media = "fibre" | "cuivre" | "radio" | "vpn";
export const MEDIAS: Record<Media, string> = {
  fibre: "Fibre optique", cuivre: "Cuivre RJ45", radio: "Radio / sans fil", vpn: "VPN / internet",
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

type OptionsLien = { mode?: "trunk" | "access"; vlans?: string; media?: Media; libelle?: string };

/** « fibre », « rj45 », « vpn »… → support de la liaison. */
export function lireMedia(c: string): Media | undefined {
  if (/^(fibre|fiber|fo|optique|monomode|multimode|om\d|os\d)$/i.test(c)) return "fibre";
  if (/^(cuivre|rj45|rj-45|cu|copper|ethernet)$/i.test(c)) return "cuivre";
  if (/^(radio|wifi|wi-fi|4g|5g|lte|faisceau|hertzien)$/i.test(c)) return "radio";
  if (/^vpn\b/i.test(c)) return "vpn";
  return undefined;
}

/** « trunk », « access », « vlan=10,20 », « vlan 30 » ; le reste fait le libellé. */
function lireOptionsLien(champs: string[]): OptionsLien & { reste: string[] } {
  const o: OptionsLien & { reste: string[] } = { reste: [] };
  for (const brut of champs) {
    const c = brut.trim();
    if (!c) continue;
    if (/^trunk$/i.test(c)) o.mode = "trunk";
    else if (/^access$/i.test(c)) o.mode = "access";
    else if (/^vlans?\s*[=: ]\s*\S/i.test(c)) o.vlans = c.replace(/^vlans?\s*[=: ]\s*/i, "").replace(/\s+/g, "");
    else if (lireMedia(c)) {
      o.media = lireMedia(c);
      // « VPN IPsec » dit aussi quelque chose : on le garde en libellé.
      if (o.media === "vpn" && !/^vpn$/i.test(c)) o.reste.push(c);
    }
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
  let pointCourant: string | undefined;
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
      pointCourant = undefined;
      return;
    }
    // « point École Jaurès » : les lignes suivantes sont dans ce lieu du site.
    if (mot === "point" || mot === "lieu" || mot === "batiment" || mot === "bâtiment") {
      assurerSite(ligne);
      pointCourant = reste || undefined;
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
    let pointLigne: string | undefined;
    let baieLigne: string | undefined;
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
      else if (lireMedia(c)) optsInline.media = lireMedia(c);
      else if (/^site\s*=/i.test(c)) siteLigne = c.replace(/^site\s*=\s*/i, "").trim();
      else if (/^point\s*=/i.test(c)) pointLigne = c.replace(/^point\s*=\s*/i, "").trim();
      else if (/^baie\s*=/i.test(c)) baieLigne = c.replace(/^baie\s*=\s*/i, "").trim() || undefined;
      // « @Lyon » ou « @Lyon/École Jaurès » : site, et lieu dans le site.
      else if (/^@\S/.test(c)) {
        const [sNom, ...pNom] = c.slice(1).split("/");
        siteLigne = sNom.trim();
        pointLigne = pNom.join("/").trim() || undefined;
      }
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
      // Un « @Site » explicite remet le lieu à zéro, sauf s'il en donne un.
      const point = pointLigne ?? (siteLigne ? undefined : pointCourant);
      equipements.push({ nom: n, genre, site, ...(point ? { point } : {}), baie: baieLigne ?? baieCourante, ip: ip && ipPlus(ip, k), infos, kv, ligne });
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
        mode: r.mode, vlans: r.vlans, media: r.media, libelle: r.libelle, ligne: r.ligne,
      };
      // Support déduit des ports : une cage SFP, c'est de la fibre ; un port
      // RJ45 ou une caméra au bout, c'est du cuivre.
      if (!l.media) {
        const types = [l.portA, l.portB].filter(Boolean).map((p) => lirePort(p!).type);
        const aFace = (x: Equipement) => ["switch", "passerelle", "parefeu"].includes(x.genre);
        if (types.includes("sfp")) l.media = "fibre";
        else if (types.includes("rj45") || !aFace(a) || !aFace(b)) l.media = "cuivre";
      }
      // Deux switchs reliés entre eux : par défaut c'est un trunk.
      const genreDe = (nom: string) => parNom.get(simple(nom))?.genre;
      if (!l.mode && genreDe(l.a) === "switch" && genreDe(l.b) === "switch") l.mode = "trunk";
      for (const [eq, port] of [[l.a, l.portA], [l.b, l.portB]] as const) {
        if (!port) continue;
        // Un port au-delà de ce que le switch déclare (« ports=8 », « sfp=2 »).
        const e = parNom.get(simple(eq))!;
        const lu = lirePort(port);
        const max = (cle: RegExp) => Number(e.kv.find(([k]) => cle.test(k))?.[1] ?? NaN);
        const borne = lu.type === "rj45" ? max(/^ports?$/i) : lu.type === "sfp" ? max(/^sfp$/i) : NaN;
        if (lu.n !== null && Number.isFinite(borne) && lu.n > borne)
          alertes.push({ ligne: r.ligne, niveau: "attention",
            msg: `Le port ${port} n'existe pas sur ${eq} : ${borne} ${lu.type === "sfp" ? "cages SFP" : "ports RJ45"} déclarés.` });
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

export const EXEMPLE = `# Une ligne par équipement :  type NOM | IP | modèle | sur SWITCH:port | vlan=30
# Une ligne par liaison     :  NOM:port -> NOM:port | fibre | trunk | vlan=10,30
# « site », « point » et « baie » rangent les lignes qui suivent : pas besoin de les répéter.

# ---------- Siège ----------
site Nanterre

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
camera CAM-SIEGE x8 | 10.14.30.11 | Bullet 8 MP | sur SW-CAM:2 | vlan=30
poste PC-ACCUEIL x2 | 10.14.10.91 | sur SW-CORE:1 | vlan=10

# ---------- Ville de Lyon : trois écoles qui remontent à la mairie ----------
site Lyon

point Mairie
baie M1
  switch SW-MAIRIE | 10.20.0.2 | Cisco Catalyst 9200-24P | ports=24 | sfp=4
camera CAM-MAIRIE x2 | 10.20.30.10 | Dôme 4 MP | sur SW-MAIRIE:1 | vlan=30

point École Jaurès
switch SW-JAURES | 10.20.1.2 | Netgear GS110TP PoE | ports=8 | sfp=2 | sur SW-MAIRIE:Te1 | fibre
camera CAM-JAURES x4 | 10.20.31.10 | sur SW-JAURES:1 | vlan=30

point École Ferry
switch SW-FERRY | 10.20.2.2 | Netgear GS110TP PoE | ports=8 | sfp=2 | sur SW-MAIRIE:Te2 | fibre
camera CAM-FERRY x3 | 10.20.32.10 | sur SW-FERRY:1 | vlan=30

point École Curie
switch SW-CURIE | 10.20.3.2 | Netgear GS108PE | ports=8 | sur SW-MAIRIE:20 | radio
camera CAM-CURIE x2 | 10.20.33.10 | sur SW-CURIE:1 | vlan=30

# ---------- Agence de Lille : ni pare-feu ni onduleur, rien n'est obligatoire ----------
site Lille
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
