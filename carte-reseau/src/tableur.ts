/**
 * Import d'un tableau Excel (.xlsx) ou CSV : une ligne par équipement.
 *
 * Tout se fait dans le navigateur, sans bibliothèque ni connexion : le .xlsx
 * est un zip de fichiers XML, décompressé avec DecompressionStream (intégré
 * aux navigateurs) puis lu avec de simples expressions régulières.
 *
 * Les colonnes sont reconnues par leur titre, quel que soit l'ordre :
 * Type, Nom, IP, Modèle, Site, Lieu, Baie, Branché sur, Port, Port local,
 * VLAN, Ports RJ45, SFP, WAN, Passerelle, Câble, Remarque.
 */
import { GENRES, genreDe, type Genre } from "./saisie.ts";

/* ---------------- lecture du fichier ---------------- */

/** Un onglet du classeur : son nom et ses lignes de cellules (texte). */
export type Feuille = { nom: string; lignes: string[][] };

/** Lit un .xlsx (tous ses onglets, dans l'ordre) ou un .csv (un seul). */
export async function lireTableur(nom: string, donnees: ArrayBuffer): Promise<Feuille[]> {
  const octets = new Uint8Array(donnees);
  // « PK » : un zip, donc un classeur Excel.
  if (octets[0] === 0x50 && octets[1] === 0x4b) return lireXlsx(octets);
  if (/\.xls$/i.test(nom)) throw new Error("Ancien format Excel (.xls) : dans Excel, « Enregistrer sous » › Classeur Excel (.xlsx) ou CSV, puis importez ce fichier.");
  return [{ nom: nom.replace(/\.[^.]+$/, ""), lignes: lireCsv(new TextDecoder("utf-8").decode(octets).replace(/^\uFEFF/, "")) }];
}

/** CSV d'Excel : séparateur « ; » (Excel français), « , » ou tabulation ; guillemets. */
export function lireCsv(texte: string): string[][] {
  const premiere = texte.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", "\t", ","].map((s) => [s, premiere.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const lignes: string[][] = [];
  let ligne: string[] = [], cell = "", guill = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guill) {
      if (c === '"' && texte[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') guill = false;
      else cell += c;
    } else if (c === '"' && cell === "") guill = true;
    else if (c === sep) { ligne.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(cell); lignes.push(ligne); ligne = []; cell = "";
    } else cell += c;
  }
  if (cell || ligne.length) { ligne.push(cell); lignes.push(ligne); }
  return lignes;
}

/* --- zip minimal : on ne lit que les fichiers dont on a besoin --- */
async function fichiersZip(o: Uint8Array): Promise<Map<string, string>> {
  const dv = new DataView(o.buffer, o.byteOffset, o.byteLength);
  // Fin du répertoire central : signature 0x06054b50, cherchée depuis la fin.
  let fin = -1;
  for (let i = o.length - 22; i >= Math.max(0, o.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw new Error("Classeur illisible (zip abîmé).");
  const n = dv.getUint16(fin + 10, true);
  let p = dv.getUint32(fin + 16, true);
  const res = new Map<string, string>();
  const dec = new TextDecoder("utf-8");
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const methode = dv.getUint16(p + 10, true);
    const taille = dv.getUint32(p + 20, true);
    const lnom = dv.getUint16(p + 28, true), lext = dv.getUint16(p + 30, true), lcom = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const nom = dec.decode(o.subarray(p + 46, p + 46 + lnom));
    p += 46 + lnom + lext + lcom;
    if (!/^xl\/(sharedStrings\.xml|workbook\.xml|worksheets\/sheet\d+\.xml|_rels\/workbook\.xml\.rels)$/.test(nom)) continue;
    const debut = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const brut = o.subarray(debut, debut + taille);
    if (methode === 0) res.set(nom, dec.decode(brut));
    else if (methode === 8) {
      const flux = new Blob([brut.slice()]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      res.set(nom, await new Response(flux).text());
    }
  }
  return res;
}

const entites = (s: string) => s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, "&");
/** Le texte d'un élément <si> ou <is> : tous ses <t>, mis bout à bout. */
const texteDe = (xml: string) => entites([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));

/** Colonne « AB » → 27 (base 0 : 27). */
const colonne = (ref: string) => [...ref.replace(/\d+/g, "")].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

async function lireXlsx(o: Uint8Array): Promise<Feuille[]> {
  const f = await fichiersZip(o);
  const partages = [...(f.get("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texteDe(m[1]));
  // Les onglets dans l'ordre du classeur, avec leur nom (les onglets masqués sont sautés).
  const wb = f.get("xl/workbook.xml") ?? "", rels = f.get("xl/_rels/workbook.xml.rels") ?? "";
  const cibles = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = m[1].match(/\bId="([^"]+)"/)?.[1], t = m[1].match(/\bTarget="([^"]+)"/)?.[1];
    if (id && t) cibles.set(id, t.startsWith("/") ? t.slice(1) : `xl/${t.replace(/^\.\//, "")}`);
  }
  const onglets = [...wb.matchAll(/<sheet\b([^>]*)\/?>/g)].map((m) => ({
    nom: entites(m[1].match(/\bname="([^"]*)"/)?.[1] ?? ""),
    chemin: cibles.get(m[1].match(/\br:id="([^"]+)"/)?.[1] ?? "") ?? "",
    cache: /\bstate="(hidden|veryHidden)"/.test(m[1]),
  })).filter((x) => !x.cache && f.has(x.chemin));
  if (!onglets.length) [...f.keys()].filter((k) => k.startsWith("xl/worksheets/")).sort()
    .forEach((k, i) => onglets.push({ nom: `Feuille ${i + 1}`, chemin: k, cache: false }));
  if (!onglets.length) throw new Error("Aucune feuille trouvée dans ce classeur.");
  return onglets.map(({ nom, chemin }) => ({ nom, lignes: lignesDe(f.get(chemin)!, partages) }));
}

function lignesDe(feuille: string, partages: string[]): string[][] {
  const lignes: string[][] = [];
  for (const r of feuille.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const ligne: string[] = [];
    for (const c of (r[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], corps = c[2] ?? "";
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const t = attrs.match(/\bt="(\w+)"/)?.[1];
      const v = corps.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let val = "";
      if (t === "s" && v !== undefined) val = partages[Number(v)] ?? "";
      else if (t === "inlineStr") val = texteDe(corps);
      else if (v !== undefined) val = entites(v);
      const i = ref ? colonne(ref) : ligne.length;
      while (ligne.length < i) ligne.push("");
      ligne[i] = val;
    }
    lignes.push(ligne);
  }
  return lignes;
}

/* ---------------- tableau → texte de topologie ---------------- */

type Champ = "de" | "type" | "nom" | "ip" | "modele" | "site" | "lieu" | "baie" | "vers" | "port" | "monport"
  | "vlan" | "ports" | "sfp" | "wan" | "passerelle" | "cable" | "remarque";

const plat = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Titres de colonnes reconnus (sans accents, en minuscules). L'ordre compte : le plus précis d'abord. */
const TITRES: [Champ, RegExp][] = [
  // Onglet de liaisons : « De / Port A / Vers / Port B ».
  ["de", /^(de|depuis|equipement a|extremite a|origine|cote a|equipement 1|equipement source)$/],
  ["passerelle", /^(ip )?(passerelle|gateway|gw|default gateway|passerelle par defaut)( ip)?$/],
  ["monport", /^(port (local|de l equipement|equipement|source|depart)|mon port|son port|port a|local port)$/],
  ["port", /^(port( du)?( switch)?|port sw|port arrivee|port b|n port|no port|numero de port|interface|remote port)$/],
  ["vers", /^(branche sur|branche|connecte a|connecte sur|relie a|switch|sw|switch amont|uplink|amont|parent|equipement amont|vers|destination|raccorde a|sur|equipement b|extremite b|cote b|equipement 2|equipement destination)$/],
  ["ports", /^((nb|nombre)( de)? )?ports?( rj45| cuivre)?$|^rj45$/],
  ["sfp", /^((nb|nombre)( de)? )?(sfp|cages? sfp|ports? sfp|ports? fibre|fibre)$/],
  ["wan", /^((nb|nombre)( de)? )?(ports? )?wan$/],
  ["type", /^(type|genre|categorie|famille|type d equipement|nature)$/],
  ["nom", /^(nom|name|hostname|nom d hote|equipement|designation|libelle|identifiant|id|nom equipement)$/],
  ["ip", /^((adresse )?ip|adresse|ip address|adresse ip v4|ipv4)$/],
  ["modele", /^(modele|model|reference|ref|marque|marque modele|materiel)$/],
  ["site", /^(site|ville|agence|client|etablissement|commune)$/],
  ["lieu", /^(lieu|batiment|emplacement|point|local|salle|localisation|ecole|zone|etage)$/],
  ["baie", /^(baie|rack|armoire|baie de brassage)$/],
  ["vlan", /^(vlans?|vlan id)$/],
  ["cable", /^(cable|media|support|type de cable|liaison|lien)$/],
  ["remarque", /^(remarques?|commentaires?|notes?|observations?|description|info|infos)$/],
];

/** Les séparateurs de la syntaxe ne doivent pas entrer dans une valeur. */
const propre = (s: string) => String(s ?? "").replace(/[|;\t#]/g, " ").replace(/\s+/g, " ").trim();
const nomPropre = (s: string) => propre(s).replace(/\s*,\s*/g, "-").replace(/\s+/g, "-");

/** Le type d'après la colonne Type, sinon d'après le début du nom (CAM-…, SW-…). */
function deviner(type: string, nom: string): Genre | undefined {
  const t = plat(type);
  if (t) {
    const g = genreDe(t) ?? genreDe(t.split(" ")[0]) ?? genreDe(t.replace(/s$/, ""));
    if (g) return g;
    if (/camera|video|dome|bullet|ptz/.test(t)) return "camera";
    if (/switch|commutateur/.test(t)) return "switch";
    if (/routeur|router|box|passerelle/.test(t)) return "passerelle";
    if (/wifi|borne|point d acces/.test(t)) return "borne";
  }
  const debut = nom.toLowerCase().match(/^[a-z]+/)?.[0] ?? "";
  return genreDe(debut);
}

export type ResultatImport = {
  texte: string; equipements: number; liaisons: number; ignorees: number;
  onglets: { nom: string; lu: string }[];   // ce qui a été fait de chaque onglet
  manquantes: string[];
};

/** Noms d'onglet qui ne disent rien du site (« Feuil1 », « Inventaire »…). */
const ONGLET_BANAL = /^(feuil|feuille|sheet|onglet|tableau|inventaire|equipements?|materiels?|liste|donnees|data|reseau|export|tous|global)\s*\d*$/;

/** Transforme les onglets du classeur en texte de topologie (que l'outil lit ensuite). */
export function tableurVersTexte(entree: Feuille[] | string[][]): ResultatImport {
  const feuilles: Feuille[] = entree.length && Array.isArray(entree[0]) ? [{ nom: "", lignes: entree as string[][] }] : (entree as Feuille[]);
  const sortie: string[] = [];
  const liaisons: string[] = [];
  const onglets: ResultatImport["onglets"] = [];
  const vus = new Set<string>();
  const vuesCol = new Set<Champ>();
  let equipements = 0, ignorees = 0, nbLiens = 0;

  for (const { nom: onglet, lignes } of feuilles) {
    const pleines = lignes.filter((l) => l.some((c) => String(c ?? "").trim()));
    const champsDe = (l: string[]) => l.map((c) => TITRES.find(([, re]) => re.test(plat(String(c ?? ""))))?.[0]);
    const iTitre = pleines.findIndex((l) => {
      const c = champsDe(l);
      return c.includes("nom") || (c.includes("de") && c.includes("vers")) || (c.includes("ip") && c.includes("type"));
    });
    if (iTitre < 0) { onglets.push({ nom: onglet, lu: pleines.length ? "ignoré (pas de colonne « Nom »)" : "vide" }); continue; }
    const col = new Map<Champ, number>();
    champsDe(pleines[iTitre]).forEach((c, i) => { if (c && !col.has(c)) col.set(c, i); });
    col.forEach((_v, k) => vuesCol.add(k));
    const lire = (l: string[], c: Champ) => (col.has(c) ? propre(l[col.get(c)!] ?? "") : "");
    const media = (l: string[]) => {
      const c = plat(lire(l, "cable"));
      return /fibre|fiber|optique|sfp/.test(c) ? "fibre" : /rj|cuivre|copper|ethernet/.test(c) ? "rj45" : /radio|wifi|4g|5g/.test(c) ? "radio" : /vpn/.test(c) ? "vpn" : "";
    };
    const po = plat(onglet);

    // Onglet de liaisons (De / Vers, sans colonne Nom).
    if (!col.has("nom") && col.has("de")) {
      let n = 0;
      for (const l of pleines.slice(iTitre + 1)) {
        const a = nomPropre(lire(l, "de")), b = nomPropre(lire(l, "vers"));
        if (!a || !b) { ignorees++; continue; }
        const pa = lire(l, "monport").replace(/\s+/g, ""), pb = lire(l, "port").replace(/\s+/g, "");
        const vlan = lire(l, "vlan").replace(/\s+/g, ""), rem = lire(l, "remarque").replace(/=/g, "-");
        liaisons.push([`${a}${pa ? `:${pa}` : ""} -> ${b}${pb ? `:${pb}` : ""}`, media(l), vlan ? `vlan=${vlan}` : "", rem].filter(Boolean).join(" | "));
        n++;
      }
      nbLiens += n;
      onglets.push({ nom: onglet, lu: `${n} liaison${n > 1 ? "s" : ""}` });
      continue;
    }

    // Le nom de l'onglet sert de type (« Caméras ») ou de site (« Lyon ») quand la colonne manque.
    const genreOnglet = po ? genreDe(po) ?? genreDe(po.replace(/s$/, "")) ?? genreDe((po.split(" ")[0] ?? "").replace(/s$/, "")) : undefined;
    const siteOnglet = !col.has("site") && onglet && !genreOnglet && !ONGLET_BANAL.test(po) ? propre(onglet) : "";
    sortie.push("", `# Onglet « ${onglet || "tableau"} »`);
    let n = 0;
    for (const l of pleines.slice(iTitre + 1)) {
      const nom = nomPropre(lire(l, "nom"));
      if (!nom) { ignorees++; continue; }
      if (vus.has(nom.toLowerCase())) { sortie.push(`# Déjà vu, ignoré : ${nom}`); ignorees++; continue; }
      vus.add(nom.toLowerCase());
      const genre = deviner(lire(l, "type"), nom) ?? genreOnglet ?? "autre";
      const p: string[] = [`${genre} ${nom}`];
      const ip = lire(l, "ip").match(/\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?/)?.[0];
      if (ip) p.push(ip);
      const modele = lire(l, "modele"); if (modele) p.push(modele.replace(/=/g, "-"));
      p.push(`site=${lire(l, "site") || siteOnglet || "Site importé"}`);
      const lieu = lire(l, "lieu"); if (lieu) p.push(`point=${lieu}`);
      const baie = lire(l, "baie"); if (baie) p.push(`baie=${baie}`);
      const gw = lire(l, "passerelle").match(/\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?/)?.[0]; if (gw) p.push(`passerelle=${gw}`);
      const nombre = (c: Champ) => lire(l, c).match(/^\d+/)?.[0];
      if (nombre("ports")) p.push(`ports=${nombre("ports")}`);
      if (nombre("sfp")) p.push(`sfp=${nombre("sfp")}`);
      if (nombre("wan")) p.push(`wan=${nombre("wan")}`);
      const vlan = lire(l, "vlan").replace(/\s+/g, "");
      const vers = nomPropre(lire(l, "vers"));
      const port = lire(l, "port").replace(/\s+/g, "");
      const monport = lire(l, "monport").replace(/\s+/g, "");
      const opts = [media(l), vlan ? `vlan=${vlan}` : ""].filter(Boolean);
      if (vers && monport) {
        // Port à port (deux switchs) : une liaison à part, écrite après tous les équipements.
        liaisons.push([`${nom}:${monport} -> ${vers}${port ? `:${port}` : ""}`, ...opts].join(" | "));
        nbLiens++;
      } else if (vers) {
        p.push(`sur ${vers}${port ? `:${port}` : ""}`, ...opts);
        nbLiens++;
      } else if (vlan) p.push(`vlan=${vlan}`);
      const rem = lire(l, "remarque"); if (rem) p.push(rem.replace(/=/g, "-"));
      sortie.push(p.join(" | "));
      n++;
    }
    equipements += n;
    onglets.push({ nom: onglet, lu: `${n} équipement${n > 1 ? "s" : ""}${siteOnglet ? ` (site « ${siteOnglet} »)` : genreOnglet && !col.has("type") ? ` (type « ${GENRES[genreOnglet].libelle} »)` : ""}` });
  }
  if (!equipements && !liaisons.length)
    throw new Error("Je ne trouve pas la ligne de titres : il faut au moins une colonne « Nom » (ou « Équipement », « Hostname »).");
  if (liaisons.length) sortie.push("", "# Liaisons", ...liaisons);
  const entete = `# Importé d'un tableau : ${onglets.filter((o) => /\d/.test(o.lu)).map((o) => `${o.nom || "tableau"} (${o.lu})`).join(", ")}.`;
  const manquantes = (["type", "ip", "site", "vers", "port"] as Champ[]).filter((c) => !vuesCol.has(c));
  return { texte: [entete, ...sortie].join("\n") + "\n", equipements, liaisons: nbLiens, ignorees, onglets, manquantes };
}

/** Un modèle de tableau à remplir dans Excel (CSV « ; », comme l'Excel français). */
export function modeleCsv(): string {
  const l = [
    ["Type", "Nom", "IP", "Modèle", "Site", "Lieu", "Baie", "Branché sur", "Port", "Port local", "Câble", "VLAN", "Ports RJ45", "SFP", "Passerelle", "Remarque"],
    ["switch", "SW-CORE", "10.0.0.2", "Cisco 9300", "Site A", "Bâtiment 1", "Baie A1", "", "", "", "", "", "48", "4", "10.0.0.1", "cœur de réseau"],
    ["switch", "SW-ETAGE1", "10.0.0.3", "Cisco 9200", "Site A", "Bâtiment 1", "Baie A1", "SW-CORE", "SFP1", "SFP1", "fibre", "", "24", "2", "", ""],
    ["camera", "CAM-ENTREE", "10.0.30.11", "Dôme 4 MP", "Site A", "Bâtiment 1", "", "SW-ETAGE1", "3", "", "", "30", "", "", "", ""],
    ["camera", "CAM-PARKING", "10.0.30.12", "Bullet 4 MP", "Site A", "Bâtiment 1", "", "SW-ETAGE1", "7", "", "", "30", "", "", "", ""],
    ["borne", "AP-HALL", "10.0.40.5", "", "Site A", "Bâtiment 1", "", "SW-ETAGE1", "12", "", "", "40", "", "", "", ""],
  ];
  return "﻿" + l.map((r) => r.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";")).join("\r\n") + "\r\n";
}
