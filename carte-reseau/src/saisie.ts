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
  const brutes: { de: string; vers: string; libelle?: string; ligne: number }[] = [];

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
      brutes.push({ de, vers, libelle: champs.join(" · ") || undefined, ligne });
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
    for (const c of champs) {
      if (!c) continue;
      if (IP.test(c)) ip = c;
      else if (FLECHE.test(` ${c}`) && /^(->|→|=>|--)/.test(c.trim())) versInline = c.trim().replace(/^(->|→|=>|--)\s*/, "");
      else if (/^sur\s+/i.test(c)) versInline = c.replace(/^sur\s+/i, "");
      else if (c.includes("=")) { const k = c.indexOf("="); kv.push([c.slice(0, k).trim(), c.slice(k + 1).trim()]); }
      else infos.push(c);
    }

    const site = assurerSite(ligne);
    for (let k = 0; k < qte; k++) {
      const n = qte > 1 ? `${nom}-${k + 1}` : nom;
      if (equipements.some((e) => simple(e.nom) === simple(n))) {
        alertes.push({ ligne, niveau: "erreur", msg: `« ${n} » existe déjà : chaque équipement doit avoir un nom unique (il sert dans les liaisons).` });
        continue;
      }
      equipements.push({ nom: n, genre, site, baie: baieCourante, ip: ip && ipPlus(ip, k), infos, kv, ligne });
      if (versInline) {
        const v = lireExtremite(versInline);
        brutes.push({ de: n, vers: v.port ? `${v.nom}:${portPlus(v.port, k)}` : v.nom, ligne });
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
        libelle: r.libelle, ligne: r.ligne,
      };
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

export const EXEMPLE = `# Une ligne par équipement, une ligne par liaison.
# Format :  type NOM | adresse IP | infos libres | clé=valeur
# Liaison : NOM:port -> NOM:port | libellé

site Nanterre | Siège · 12 rue des Lilas

baie A1
  passerelle GW-NANTERRE | 10.14.0.1 | Fortinet FortiGate 60F
  switch SW-CORE | 10.14.0.2 | Cisco Catalyst 9300-24T | ports=24
  serveur SRV-AD | 10.14.0.11 | Windows Server 2022 | rôle=AD · DNS
  nas NAS-SAUV | 10.14.0.20 | Synology RS1221+
  onduleur UPS-A1 | APC 3000 VA

baie A2
  switch SW-CAM | 10.14.0.3 | Switch PoE 16 ports
  nvr NVR-1 | 10.14.0.40 | Hikvision 16 voies

camera CAM-ENTREE | 10.14.0.50 | Dôme 4 MP
camera CAM-PARKING x4 | 10.14.0.51 | Bullet 4 MP
borne AP-ACCUEIL | 10.14.0.71 | Aruba AP-515
poste PC-ACCUEIL | 10.14.0.91
imprimante IMP-RDC | 10.14.0.55

# liaisons
GW-NANTERRE:LAN1 -> SW-CORE:1
SW-CORE:24 -> SW-CAM:16 | uplink
SRV-AD -> SW-CORE:2
NAS-SAUV -> SW-CORE:3
NVR-1 -> SW-CAM:1
CAM-ENTREE -> SW-CAM:2
CAM-PARKING* -> SW-CAM:3
AP-ACCUEIL -> SW-CORE:10 | PoE+
PC-ACCUEIL -> SW-CORE:11
IMP-RDC -> SW-CORE:12

site Lyon | Agence

passerelle GW-LYON | 10.20.0.1 | Box fibre
switch SW-LYON | 10.20.0.2 | Netgear GS724T | sur GW-LYON:LAN1
camera CAM-LYON x2 | 10.20.0.50 | sur SW-LYON:5
poste PC-LYON x3 | 10.20.0.91 | sur SW-LYON:10

# entre sites
GW-NANTERRE:WAN -> GW-LYON:WAN | VPN IPsec
`;
