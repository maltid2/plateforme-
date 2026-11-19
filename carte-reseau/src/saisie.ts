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
  /** IP de la passerelle par défaut : écrite sur la ligne, ou héritée du lieu / du site. */
  passerelleIp?: string;
  passerelleHeritee?: "lieu" | "site";
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

export type Site = { nom: string; infos: string[]; ligne: number; passerelleIp?: string };
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
/** « Caméra », « switch », « AP »… → type d'équipement (ou undefined). */
export const genreDe = (mot: string): Genre | undefined => GENRE_PAR_MOT.get(simple(mot.trim()));
(Object.keys(GENRES) as Genre[]).forEach((g) => GENRES[g].mots.forEach((m) => GENRE_PAR_MOT.set(m, g)));

const IP = /^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/;
const FLECHE = /\s*(?:->|<->|<-|—|–|--|=>|→)\s*/;

export function ipPlus(ip: string, k: number) {
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

const CLE_PASSERELLE = /^(passerelle|gw|gateway|pass|gtw)\s*=\s*/i;
/** « passerelle=10.0.0.1 » parmi des champs ; signale une valeur qui n'est pas une IP. */
function lirePasserelle(champs: string[], ligne: number, alertes: Alerte[]): string | undefined {
  const c = champs.find((x) => CLE_PASSERELLE.test(x.trim()));
  if (!c) return undefined;
  const v = c.trim().replace(CLE_PASSERELLE, "").trim();
  if (!IP.test(v)) {
    alertes.push({ ligne, niveau: "erreur", msg: `IP de passerelle « ${v} » illisible : écrire par exemple  passerelle=10.0.0.1` });
    return undefined;
  }
  return v;
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
  const passerellesLieux = new Map<string, string>();
  const sitesDeclares = new Set<string>();
  const brutes: ({ de: string; vers: string; ligne: number } & OptionsLien)[] = [];

  // Site créé faute de mieux (aucun « site … » ni « @… » avant la ligne) : ses
  // équipements rejoindront plus bas le site de ce qui leur est relié.
  const SITE_DEFAUT = "Site principal";
  const sansSite = new Set<string>();
  const assurerSite = (ligne: number) => {
    if (!siteCourant) {
      siteCourant = SITE_DEFAUT;
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
      if (!reste) { alertes.push({ ligne, niveau: "erreur", msg: "Site sans nom : écrire  site NomDuSite" }); return; }
      if (sitesDeclares.has(simple(reste)))
        alertes.push({ ligne, niveau: "attention", msg: `Le site « ${reste} » est déclaré deux fois : les équipements s'ajoutent au premier.` });
      else if (!sites.some((s) => simple(s.nom) === simple(reste)))
        sites.push({ nom: reste, infos: champs.filter((c) => c && !CLE_PASSERELLE.test(c.trim())), ligne });
      sitesDeclares.add(simple(reste));
      const leSite = sites.find((s) => simple(s.nom) === simple(reste))!;
      const gwSite = lirePasserelle(champs, ligne, alertes);
      if (gwSite) leSite.passerelleIp = gwSite;
      siteCourant = leSite.nom;
      baieCourante = undefined;
      pointCourant = undefined;
      return;
    }
    // « point École Jaurès » : les lignes suivantes sont dans ce lieu du site.
    if (mot === "point" || mot === "lieu" || mot === "batiment" || mot === "bâtiment") {
      const s0 = assurerSite(ligne);
      pointCourant = reste || undefined;
      baieCourante = undefined;
      const gwPoint = lirePasserelle(champs, ligne, alertes);
      if (gwPoint && pointCourant) passerellesLieux.set(`${simple(s0)}§${simple(pointCourant)}`, gwPoint);
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
    // « switch SW-ACCUEIL, SW-ETAGE1, SW-ETAGE2 » : plusieurs noms différents
    // sur une ligne ; IP et ports se suivent comme pour « x3 ».
    let noms: string[];
    if (nom.includes(",")) {
      noms = nom.split(",").map((x) => x.trim()).filter(Boolean);
      if (mq) alertes.push({ ligne, niveau: "attention", msg: `Une liste de noms et « x${qte} » sur la même ligne : c'est la liste qui compte (${noms.length} équipements).` });
    } else noms = Array.from({ length: qte }, (_, k) => (qte > 1 ? `${nom}-${k + 1}` : nom));
    noms.filter((x) => /\s/.test(x)).forEach((x) =>
      alertes.push({ ligne, niveau: "attention", msg: `« ${x} » contient des espaces : préférez CAM-ENTREE à « CAM ENTREE », c'est le nom qu'on réutilise dans les liaisons.` }));

    let ip: string | undefined;
    let ips: string[] | undefined;   // « 10.0.0.5, 10.0.0.9 » : une IP par équipement, dans l'ordre
    const infos: string[] = [];
    const kv: [string, string][] = [];
    let versInline: string | undefined;
    let siteLigne: string | undefined;
    let pointLigne: string | undefined;
    let baieLigne: string | undefined;
    let passerelleLigne: string | undefined;
    const optsInline: OptionsLien = {};
    for (const c of champs) {
      if (!c) continue;
      if (IP.test(c)) ip = c;
      else if (c.includes(",") && c.split(",").every((x) => IP.test(x.trim()))) ips = c.split(",").map((x) => x.trim());
      else if (/^trunk$/i.test(c)) optsInline.mode = "trunk";
      else if (/^access$/i.test(c)) optsInline.mode = "access";
      else if (/^vlans?\s*[=: ]\s*\S/i.test(c)) {
        optsInline.vlans = lireOptionsLien([c]).vlans;
        kv.push(["VLAN", optsInline.vlans!]);
      }
      else if (FLECHE.test(` ${c}`) && /^(->|→|=>|--)/.test(c.trim())) versInline = c.trim().replace(/^(->|→|=>|--)\s*/, "");
      else if (/^sur\s+/i.test(c)) versInline = c.replace(/^sur\s+/i, "");
      // « site=NomDuSite » ou « @NomDuSite » : le site se donne sur la ligne même,
      // sans ouvrir de bloc. Le site est créé s'il n'existe pas encore.
      else if (lireMedia(c)) optsInline.media = lireMedia(c);
      else if (/^site\s*=/i.test(c)) siteLigne = c.replace(/^site\s*=\s*/i, "").trim();
      else if (/^point\s*=/i.test(c)) pointLigne = c.replace(/^point\s*=\s*/i, "").trim();
      else if (/^baie\s*=/i.test(c)) baieLigne = c.replace(/^baie\s*=\s*/i, "").trim() || undefined;
      // « @Site » ou « @Site/Lieu » : site, et lieu dans le site.
      else if (/^@\S/.test(c)) {
        // Un nom de site peut contenir « / » (« ILM / Issy ») : on reconnaît
        // d'abord un site déjà connu au début, sinon on coupe au premier « / ».
        const v = c.slice(1).trim();
        const connu = [...sites].sort((x, y) => y.nom.length - x.nom.length)
          .find((s0) => simple(v) === simple(s0.nom) || simple(v).startsWith(simple(s0.nom) + "/") || simple(v).startsWith(simple(s0.nom) + " /"));
        if (connu) {
          siteLigne = connu.nom;
          pointLigne = v.slice(connu.nom.length).replace(/^\s*\/\s*/, "").trim() || undefined;
        } else {
          const [sNom, ...pNom] = v.split("/");
          siteLigne = sNom.trim();
          pointLigne = pNom.join("/").trim() || undefined;
        }
      }
      else if (CLE_PASSERELLE.test(c.trim())) passerelleLigne = lirePasserelle([c], ligne, alertes);
      else if (c.includes("=")) { const k = c.indexOf("="); kv.push([c.slice(0, k).trim(), c.slice(k + 1).trim()]); }
      else infos.push(c);
    }

    let site: string;
    if (siteLigne) {
      const connu = sites.find((x) => simple(x.nom) === simple(siteLigne!));
      if (!connu) sites.push({ nom: siteLigne, infos: [], ligne });
      site = connu?.nom ?? siteLigne;
    } else site = assurerSite(ligne);
    const implicite = !siteLigne && site === SITE_DEFAUT && !sitesDeclares.has(simple(SITE_DEFAUT));
    if (ips && ips.length !== noms.length)
      alertes.push({ ligne, niveau: "attention", msg: ips.length > noms.length
        ? `${ips.length} IP pour ${noms.length} équipement${noms.length > 1 ? "s" : ""} : les IP en trop sont ignorées.`
        : `${ips.length} IP pour ${noms.length} équipements : les suivantes continuent à partir de ${ips[ips.length - 1]}.` });
    // « ports=24, 8, 48 » / « sfp=4, 0, 2 » : un nombre par équipement, dans
    // l'ordre des noms (moins de valeurs : la dernière vaut pour la suite).
    const CLE_LISTE = /^(ports?|sfp|wan)$/i;
    for (const [cle, v] of kv) {
      if (!CLE_LISTE.test(cle) || !v.includes(",")) continue;
      const vals = v.split(",").map((x) => x.trim()).filter(Boolean);
      if (vals.some((x) => !/^\d+$/.test(x)))
        alertes.push({ ligne, niveau: "erreur", msg: `« ${cle}=${v} » : des nombres séparés par des virgules, par exemple ${cle}=24, 8, 48.` });
      else if (vals.length !== noms.length)
        alertes.push({ ligne, niveau: "attention", msg: vals.length > noms.length
          ? `${vals.length} valeurs de ${cle} pour ${noms.length} équipement${noms.length > 1 ? "s" : ""} : les valeurs en trop sont ignorées.`
          : `${vals.length} valeurs de ${cle} pour ${noms.length} équipements : ${vals[vals.length - 1]} pour les suivants.` });
    }
    const kvDe = (k: number): [string, string][] => kv.map(([cle, v]) => {
      if (!CLE_LISTE.test(cle) || !v.includes(",")) return [cle, v];
      const vals = v.split(",").map((x) => x.trim()).filter(Boolean);
      return [cle, vals[Math.min(k, vals.length - 1)] ?? ""];
    });
    for (let k = 0; k < noms.length; k++) {
      const n = noms[k];
      if (equipements.some((e) => simple(e.nom) === simple(n))) {
        alertes.push({ ligne, niveau: "erreur", msg: `« ${n} » existe déjà : chaque équipement doit avoir un nom unique (il sert dans les liaisons).` });
        continue;
      }
      // Un « @Site » explicite remet le lieu à zéro, sauf s'il en donne un.
      const point = pointLigne ?? (siteLigne ? undefined : pointCourant);
      // IP de la liste à son rang ; au-delà, on continue à partir de la dernière.
      const ipK = ips ? (k < ips.length ? ips[k] : ipPlus(ips[ips.length - 1], k - ips.length + 1)) : ip && ipPlus(ip, k);
      if (implicite) sansSite.add(n);
      equipements.push({ nom: n, genre, site, ...(point ? { point } : {}), baie: baieLigne ?? baieCourante, ip: ipK, ...(passerelleLigne ? { passerelleIp: passerelleLigne } : {}), infos, kv: kvDe(k), ligne });
      if (versInline) {
        // « sur SW-1:3, 7, 9 » : un port par équipement, dans l'ordre des noms
        // (au-delà de la liste, on continue après le dernier).
        const v = lireExtremite(versInline.replace(/\s*,\s*/g, ","));
        const lp = v.port?.split(",").filter(Boolean) ?? [];
        if (k === 0 && lp.length > 1 && lp.length !== noms.length)
          alertes.push({ ligne, niveau: "attention", msg: lp.length > noms.length
            ? `${lp.length} ports pour ${noms.length} équipement${noms.length > 1 ? "s" : ""} : les ports en trop sont ignorés.`
            : `${lp.length} ports pour ${noms.length} équipements : les suivants continuent après ${lp[lp.length - 1]}.` });
        const pk = lp.length > 1 ? (k < lp.length ? lp[k] : portPlus(lp[lp.length - 1], k - lp.length + 1)) : portPlus(v.port, k);
        brutes.push({ de: n, vers: v.port ? `${v.nom}:${pk}` : v.nom, ligne, ...optsInline });
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

  // Un équipement écrit sans site (« passerelle GW-1 | 10.0.0.1 ») va dans le
  // site de ce à quoi il est relié, plutôt que dans un « Site principal » à part.
  if (sansSite.size) {
    const parNomEq = new Map(equipements.map((e) => [e.nom, e]));
    for (let tour = 0, change = true; change && tour < 20; tour++) {
      change = false;
      for (const l of liaisons) {
        for (const [x, y] of [[l.a, l.b], [l.b, l.a]] as const) {
          const ex = parNomEq.get(x), ey = parNomEq.get(y);
          if (ex && ey && sansSite.has(x) && !sansSite.has(y)) { ex.site = ey.site; delete ex.point; sansSite.delete(x); change = true; }
        }
      }
    }
    if (!equipements.some((e) => e.site === SITE_DEFAUT) && !sitesDeclares.has(simple(SITE_DEFAUT))) {
      const i = sites.findIndex((x) => x.nom === SITE_DEFAUT);
      if (i >= 0) sites.splice(i, 1);
    }
  }

  // IP de passerelle héritée : du lieu d'abord, sinon du site.
  equipements.forEach((e) => {
    if (e.passerelleIp) return;
    // L'équipement qui EST la passerelle du site n'en hérite pas.
    const pasSoi = (gw?: string) => (gw && gw.split("/")[0] !== e.ip?.split("/")[0] ? gw : undefined);
    const duLieu = pasSoi(e.point ? passerellesLieux.get(`${simple(e.site)}§${simple(e.point)}`) : undefined);
    const duSite = pasSoi(sites.find((s) => s.nom === e.site)?.passerelleIp);
    if (duLieu) { e.passerelleIp = duLieu; e.passerelleHeritee = "lieu"; }
    else if (duSite) { e.passerelleIp = duSite; e.passerelleHeritee = "site"; }
  });
  // Contrôles : la passerelle n'est pas l'équipement lui-même, et elle est
  // dans son réseau quand le masque est écrit (10.14.30.11/24).
  const versNombre = (ip: string) => ip.split("/")[0].split(".").reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
  equipements.forEach((e) => {
    if (!e.passerelleIp || !e.ip) return;
    if (e.ip.split("/")[0] === e.passerelleIp.split("/")[0]) {
      alertes.push({ ligne: e.ligne, niveau: "attention", msg: `${e.nom} a pour passerelle sa propre adresse (${e.passerelleIp}).` });
      return;
    }
    const masque = Number(e.ip.split("/")[1]);
    if (Number.isFinite(masque) && masque > 0 && masque <= 32) {
      const m = masque === 32 ? 0xffffffff : (0xffffffff << (32 - masque)) >>> 0;
      if (((versNombre(e.ip) & m) >>> 0) !== ((versNombre(e.passerelleIp) & m) >>> 0))
        alertes.push({ ligne: e.ligne, niveau: "attention", msg: `Passerelle ${e.passerelleIp} hors du réseau de ${e.nom} (${e.ip}).` });
    }
  });

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

