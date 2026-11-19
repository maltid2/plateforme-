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
export type Feuille = {
  nom: string; lignes: string[][];
  /** Tableaux Excel (« Mettre sous forme de tableau ») : nom et plage, ex. A3:H12. */
  tableaux?: { nom: string; ref: string; total?: number }[];
};

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
    if (!/^xl\/(sharedStrings\.xml|workbook\.xml|worksheets\/sheet\d+\.xml|worksheets\/_rels\/sheet\d+\.xml\.rels|tables\/table\d+\.xml|_rels\/workbook\.xml\.rels)$/.test(nom)) continue;
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
  return onglets.map(({ nom, chemin }) => ({ nom, lignes: lignesDe(f.get(chemin)!, partages), tableaux: tableauxDe(f, chemin) }));
}

/** Les tableaux Excel posés sur une feuille (xl/tables/tableN.xml, via les liens de la feuille). */
function tableauxDe(f: Map<string, string>, chemin: string): NonNullable<Feuille["tableaux"]> {
  const rels = f.get(chemin.replace(/([^/]+)$/, "_rels/$1.rels")) ?? "";
  const res: NonNullable<Feuille["tableaux"]> = [];
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    if (!/Type="[^"]*\/table"/.test(m[1])) continue;
    const cible = m[1].match(/\bTarget="([^"]+)"/)?.[1] ?? "";
    const fichier = cible.startsWith("/") ? cible.slice(1) : `xl/${cible.replace(/^(\.\.\/)+/, "")}`;
    const xml = f.get(fichier);
    const entete = xml?.match(/<table\b([^>]*)>/)?.[1] ?? xml?.match(/<table\b([^>]*)\/>/)?.[1];
    if (!entete) continue;
    const ref = entete.match(/\bref="([A-Z]+\d+:[A-Z]+\d+)"/)?.[1];
    const nom = entites(entete.match(/\bdisplayName="([^"]*)"/)?.[1] ?? entete.match(/\bname="([^"]*)"/)?.[1] ?? "");
    // Ligne « Total » en bas du tableau (Création de tableau › Ligne Total) : ce n'est pas un équipement.
    const total = Number(entete.match(/\btotalsRowCount="(\d+)"/)?.[1] ?? 0);
    if (ref) res.push({ nom, ref, total });
  }
  return res.sort((a, b) => ligneDe(a.ref) - ligneDe(b.ref) || colonne(a.ref) - colonne(b.ref));
}

const ligneDe = (ref: string) => Number(ref.match(/\d+/)?.[0] ?? 1) - 1;

function lignesDe(feuille: string, partages: string[]): string[][] {
  const lignes: string[][] = [];
  for (const r of feuille.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    // Les lignes vides n'existent pas dans le fichier : on les remet à leur place.
    const num = Number(r[1].match(/\br="(\d+)"/)?.[1] ?? lignes.length + 1) - 1;
    while (lignes.length < num) lignes.push([]);
    const ligne: string[] = [];
    for (const c of (r[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
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
  | "vlan" | "ports" | "sfp" | "wan" | "passerelle" | "cable" | "remarque" | "serie" | "mac" | "masque";

const plat = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Titres de colonnes reconnus (sans accents, en minuscules). L'ordre compte : le plus précis d'abord. */
const TITRES: [Champ, RegExp][] = [
  // Onglet de liaisons : « De / Port A / Vers / Port B ».
  ["de", /^(de|depuis|equipement a|extremite a|origine|cote a|equipement 1|equipement source)$/],
  ["passerelle", /^(ip )?(passerelle|gateway|gw|default gateway|passerelle par defaut)( ip)?$/],
  ["monport", /^(port (local|de l equipement|equipement|source|depart)|mon port|son port|port a|local port)$/],
  ["port", /^(port( du)?( switch)?|port sw|port arrivee|port b|n port|no port|numero de port|interface|remote port)$/],
  ["vers", /^(branche sur|branche|connecte a|connecte sur|relie a|switch|sw|switch amont|uplink|amont|parent|equipement amont|vers|destination|raccorde a|sur|equipement b|extremite b|cote b|equipement 2|equipement destination)$/],
  ["ports", /^((nb|nombre|total)( de)? )?ports?( rj45| cuivre| ethernet| total)?$|^(ports? )?(rj45|cuivre)$|^capacite( ports?)?$|^nb ports? rj45$/],
  ["sfp", /^((nb|nombre)( de)? )?(sfp\+?|cages? sfp|ports? sfp|ports? fibre|fibre|uplinks? sfp)$/],
  ["wan", /^((nb|nombre)( de)? )?(ports? )?wan$/],
  ["serie", /^(n(o|um|umero)? ?(de )?serie|serie|s n|sn|serial( number)?|numero de serie|n serie)$/],
  ["mac", /^((adresse )?mac|mac address|adresse physique|adr mac)$/],
  ["masque", /^(masque( de sous reseau)?|netmask|subnet( mask)?|mask|sous reseau|cidr)$/],
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
const propre = (s: string) => String(s ?? "").replace(/->|<-|→|=>/g, "-").replace(/[|;\t#]/g, " ").replace(/\s+/g, " ").trim();
const nomPropre = (s: string) => propre(s).replace(/\s*,\s*/g, "-").replace(/\s+/g, "-");

/** Un port tel qu'on l'écrit dans Excel → tel que l'outil le lit :
 *  « RJ45 9 », « Port 9 », « n°9 », « 9 » → 9 ; « SFP 2 », « Fibre 1 » → SFP2 ;
 *  « WAN 1 » → WAN1 ; « Gi1/0/9 », « Te1 » restent tels quels. */
export function portExcel(v: string): string {
  const t = String(v ?? "").trim();
  if (!t) return "";
  const s = t.toLowerCase().replace(/[°º]/g, "").replace(/\s+/g, " ");
  const n = s.match(/(\d+)\s*$/)?.[1];
  if (/^(port\s*)?(sfp\+?|fibre|fiber|optique|uplink sfp)\b/.test(s) || /^(port\s*)?sfp\+?\d/.test(s)) return n ? `SFP${n}` : "SFP1";
  if (/^(port\s*)?wan\b/.test(s) || /^wan\d/.test(s)) return `WAN${n ?? ""}`;
  // « RJ45 9 », « RJ-45 n 9 », « port 9 », « n 9 », « LAN 9 », « cuivre 9 »
  if (/^(port|n|no|num|numero|rj\s*-?\s*45|cuivre|ethernet|lan)\b|^rj\s*-?\s*45/.test(s) && n && !/\//.test(s)) {
    const reste = s.replace(/rj\s*-?\s*45/g, " ").replace(/(^|\s)(port|n|no|num|numero|cuivre|ethernet|lan)(?=\s|\d|$)/g, " ").replace(/[-:#.]/g, " ").trim();
    if (/^\d+$/.test(reste)) return reste;
  }
  return t.replace(/\s+/g, "");
}

/** Un nombre de ports écrit « 24 », « 24 ports », « RJ45 24 » ou « 24 x RJ45 ». */
const nombreDe = (v: string) => v.replace(/rj\s*-?\s*45/gi, " ").match(/\d+/)?.[0];

/** « 24 + 4 SFP », « 48 RJ45 / 4 SFP+ » dans une seule case : RJ45 et SFP séparés. */
export function portsEtSfp(caseRj: string, caseSfp: string): { rj?: string; sfp?: string } {
  const sfpDansRj = caseRj.match(/(\d+)\s*(?:x\s*)?(?:cages?\s*)?(?:sfp\+?|fibre|10g)/i);
  const rj = nombreDe(sfpDansRj ? caseRj.replace(sfpDansRj[0], " ") : caseRj);
  return { rj, sfp: (caseSfp ? nombreDe(caseSfp) : undefined) ?? sfpDansRj?.[1] };
}

/** VLAN d'une ou plusieurs cases : « 10, 20 », « 10 / 20 », « 10 et 30 », « 10 Vidéo ; 20 Admin »,
 *  plage « 100-110 » → « 10,20 » (numéros 1 à 4094, sans doublon). */
export function vlansDe(cases: string[]): string {
  const vus: string[] = [];
  for (const c of cases) for (const m of String(c ?? "").matchAll(/(\d{1,4})(?:\s*-\s*(\d{1,4})(?!\d))?/g)) {
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : NaN;
    if (a < 1 || a > 4094) continue;
    const v = Number.isFinite(b) && b > a && b <= 4094 ? `${a}-${b}` : String(a);
    if (!vus.includes(v)) vus.push(v);
  }
  return vus.join(",");
}

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

/** Noms d'onglet ou de tableau qui ne disent rien du site (« Feuil1 », « Tableau1 »…). */
const ONGLET_BANAL = /^(feuil|feuille|sheet|onglet|tableau|table|tab|tbl|inventaire|equipements?|materiels?|liste|donnees|data|reseau|export|tous|global)\s*\d*$/;

/** Un bloc à lire : un tableau Excel, ou une partie de feuille sous sa ligne de titres. */
type Bloc = { onglet: string; nom: string; titre: string; lignes: string[][] };

const nbCases = (l: string[]) => l.filter((c) => String(c ?? "").trim()).length;
const champsDe = (l: string[]) => l.map((c) => TITRES.find(([, re]) => re.test(plat(String(c ?? ""))))?.[0]);
const estEntete = (l: string[]) => {
  const c = champsDe(l);
  return c.includes("nom") || (c.includes("de") && c.includes("vers")) || (c.includes("ip") && c.includes("type"));
};
/** Le titre posé au-dessus d'un tableau (1 ou 2 cases remplies sur la ligne). */
function titreAuDessus(lignes: string[][], haut: number, plancher: number): { texte: string; ligne: number } {
  for (let k = haut - 1; k >= Math.max(plancher, haut - 3); k--) {
    const l = lignes[k] ?? [];
    const n = nbCases(l);
    if (!n) continue;
    if (n <= 2 && !estEntete(l)) return { texte: l.map((c) => String(c ?? "").trim()).filter(Boolean).join(" "), ligne: k };
    break;
  }
  return { texte: "", ligne: haut };
}

/** Une feuille → ses blocs : les tableaux Excel s'il y en a, sinon un bloc par ligne de titres. */
function blocs(f: Feuille): Bloc[] {
  if (f.tableaux?.length) {
    let plancher = 0;
    return f.tableaux.map((t) => {
      const [a, b] = t.ref.split(":");
      const r1 = ligneDe(a), r2 = ligneDe(b), c1 = colonne(a), c2 = colonne(b);
      const titre = titreAuDessus(f.lignes.map((l) => l.slice(c1, c2 + 1)), r1, plancher).texte;
      plancher = r2 + 1;
      return { onglet: f.nom, nom: t.nom, titre, lignes: f.lignes.slice(r1, r2 + 1 - (t.total ?? 0)).map((l) => l.slice(c1, c2 + 1)) };
    });
  }
  const entetes = f.lignes.map((l, i) => (estEntete(l) ? i : -1)).filter((i) => i >= 0);
  if (!entetes.length) return [{ onglet: f.nom, nom: "", titre: "", lignes: f.lignes }];
  // Plusieurs tableaux l'un sous l'autre : chacun commence à sa ligne de titres,
  // et le titre posé juste au-dessus (« Site : Nanterre ») lui appartient.
  const titres = entetes.map((h, k) => titreAuDessus(f.lignes, h, k ? entetes[k - 1] + 1 : 0));
  return entetes.map((h, k) => ({
    onglet: f.nom, nom: "", titre: titres[k].texte,
    lignes: f.lignes.slice(h, k + 1 < entetes.length ? titres[k + 1].ligne : f.lignes.length),
  }));
}

/** « Site : Nanterre », « Tableau_Nanterre » → « Nanterre ». */
const nettoyer = (brut: string) => {
  // « Tableau_Nanterre », « TableauNanterre » → « Nanterre » ; « Tableau1 » reste banal.
  const m = brut.match(/^(?:[Tt]ableau|[Tt]able|[Tt]bl|[Tt]ab)(?:[_\s-]+|(?=[A-ZÀ-Ý]))(.+)$/);
  const v = m && !/^\d+$/.test(m[1]) ? m[1] : brut;
  return propre(v.replace(/_/g, " ")).replace(/^(site|agence|ville|lieu de)\s*[:\-–—]\s*/i, "").trim();
};

/** Transforme les onglets du classeur en texte de topologie (que l'outil lit ensuite). */
export function tableurVersTexte(entree: Feuille[] | string[][]): ResultatImport {
  const feuilles: Feuille[] = entree.length && Array.isArray(entree[0]) ? [{ nom: "", lignes: entree as string[][] }] : (entree as Feuille[]);
  const sortie: string[] = [];
  const liaisons: string[] = [];
  const onglets: ResultatImport["onglets"] = [];
  const vus = new Set<string>();
  const vuesCol = new Set<Champ>();
  let equipements = 0, ignorees = 0, nbLiens = 0;

  for (const bloc of feuilles.flatMap(blocs)) {
    const { onglet } = bloc;
    const etiquette = [onglet, bloc.titre || bloc.nom].filter(Boolean).join(" › ") || "tableau";
    const pleines = bloc.lignes.filter((l) => nbCases(l));
    const iTitre = pleines.findIndex(estEntete);
    if (iTitre < 0) { onglets.push({ nom: etiquette, lu: pleines.length ? "ignoré (pas de colonne « Nom »)" : "vide" }); continue; }
    const col = new Map<Champ, number>();
    champsDe(pleines[iTitre]).forEach((c, i) => { if (c && !col.has(c)) col.set(c, i); });
    col.forEach((_v, k) => vuesCol.add(k));
    // Toutes les colonnes « VLAN… » (VLAN 1, VLAN 2, VLAN vidéo…) comptent.
    const colsVlan = pleines[iTitre].map((t, i) => (/^vlan/.test(plat(String(t ?? ""))) ? i : -1)).filter((i) => i >= 0);
    if (colsVlan.length) vuesCol.add("vlan");
    const lire = (l: string[], c: Champ) => (col.has(c) ? propre(l[col.get(c)!] ?? "") : "");
    // Colonnes non reconnues, gardées telles quelles (« Garantie », « Firmware »…).
    // Câbles en plus sur la même ligne : « Branché sur 2 », « Port 2 », « Port local 2 », « Câble 2 »…
    // (un serveur à deux cartes, un switch avec deux uplinks).
    const groupes = new Map<number, Partial<Record<"vers" | "port" | "monport" | "cable", number>>>();
    pleines[iTitre].forEach((t, i) => {
      const m = plat(String(t ?? "")).match(/^(.*\S)\s+([2-9])$/);
      if (!m || col.get("nom") === i) return;
      const c = TITRES.find(([, re]) => re.test(m[1]))?.[0];
      if (c === "vers" || c === "port" || c === "monport" || c === "cable") {
        const g = groupes.get(Number(m[2])) ?? {};
        g[c] ??= i;
        groupes.set(Number(m[2]), g);
      }
    });
    const pris = new Set([...col.values(), ...colsVlan, ...[...groupes.values()].flatMap((g) => Object.values(g))]);
    const autres: [number, string][] = pleines[iTitre].map((t, i): [number, string] => [i, propre(String(t ?? "")).replace(/[=:]/g, " ").trim()])
      .filter(([i, t]) => t && !pris.has(i) && !/^colonne\s*\d+$/i.test(t) && !/^(site|point|baie|ports?|sfp|wan|vlans?|passerelle|sur|trunk|access)$/i.test(t));
    const vlanDe = (l: string[]) => vlansDe(colsVlan.map((i) => l[i] ?? ""));
    const media = (l: string[], i?: number) => {
      const c = plat(i === undefined ? lire(l, "cable") : propre(l[i] ?? ""));
      return /dac|twinax|direct attach/.test(c) ? "dac" : /fibre|fiber|optique|sfp/.test(c) ? "fibre" : /coax|bnc|rg ?59|rg ?6\b/.test(c) ? "coax"
        : /rs ?232|rs ?485|rs ?422|serie|modbus|\bcom\b/.test(c) ? "serie" : /usb/.test(c) ? "usb"
        : /rj|cuivre|copper|ethernet/.test(c) ? "rj45" : /radio|wifi|4g|5g/.test(c) ? "radio" : /vpn/.test(c) ? "vpn" : "";
    };

    // Bloc de liaisons (De / Vers, sans colonne Nom).
    if (!col.has("nom") && col.has("de")) {
      let n = 0;
      for (const l of pleines.slice(iTitre + 1)) {
        if (estEntete(l)) continue;
        const a = nomPropre(lire(l, "de")), b = nomPropre(lire(l, "vers"));
        if (!a || !b) { ignorees++; continue; }
        const pa = portExcel(lire(l, "monport")), pb = portExcel(lire(l, "port"));
        const vlan = vlanDe(l), rem = lire(l, "remarque").replace(/=/g, "-");
        liaisons.push([`${a}${pa ? `:${pa}` : ""} -> ${b}${pb ? `:${pb}` : ""}`, media(l), vlan ? `vlan=${vlan}` : "", rem].filter(Boolean).join(" | "));
        n++;
      }
      nbLiens += n;
      onglets.push({ nom: etiquette, lu: `${n} liaison${n > 1 ? "s" : ""}` });
      continue;
    }

    // Titre au-dessus du tableau, nom du tableau, puis nom de l'onglet : le
    // premier qui parle donne le site (« Nanterre ») ou le type (« Caméras »).
    let genreBloc: Genre | undefined, siteBloc = "";
    for (const brut of [bloc.titre, bloc.nom, onglet]) {
      const v = nettoyer(brut ?? ""), pv = plat(v);
      if (!pv || ONGLET_BANAL.test(pv)) continue;
      const g = genreDe(pv) ?? genreDe(pv.replace(/s$/, "")) ?? genreDe((pv.split(" ")[0] ?? "").replace(/s$/, ""));
      if (g) { genreBloc ??= g; continue; }
      if (!siteBloc) siteBloc = v;
    }
    if (siteBloc) vuesCol.add("site");
    sortie.push("", `# ${etiquette}`);
    let dernierSite = "";
    let n = 0;
    for (const l of pleines.slice(iTitre + 1)) {
      if (estEntete(l)) continue;
      const nom = nomPropre(lire(l, "nom"));
      if (!nom) { ignorees++; continue; }
      if (vus.has(nom.toLowerCase())) { sortie.push(`# Déjà vu, ignoré : ${nom}`); ignorees++; continue; }
      vus.add(nom.toLowerCase());
      const genre = deviner(lire(l, "type"), nom) ?? genreBloc ?? "autre";
      const p: string[] = [`${genre} ${nom}`];
      const ip = lire(l, "ip").match(/\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?/)?.[0];
      if (ip) p.push(ip);
      const modele = lire(l, "modele"); if (modele) p.push(modele.replace(/=/g, "-"));
      // Case Site vide : le site du tableau (titre, nom), sinon celui de la ligne
      // du dessus (cellules fusionnées). Sans site du tout, l'équipement
      // rejoint le site de ce à quoi il est branché.
      const siteLu = lire(l, "site") || siteBloc || dernierSite;
      if (siteLu) { p.push(`site=${siteLu}`); dernierSite = siteLu; }
      const lieu = lire(l, "lieu"); if (lieu) p.push(`point=${lieu}`);
      const baie = lire(l, "baie"); if (baie) p.push(`baie=${baie}`);
      const gw = lire(l, "passerelle").match(/\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?/)?.[0]; if (gw) p.push(`passerelle=${gw}`);
      const { rj, sfp } = portsEtSfp(lire(l, "ports"), lire(l, "sfp"));
      if (rj) p.push(`ports=${rj}`);
      if (sfp) p.push(`sfp=${sfp}`);
      const wan = nombreDe(lire(l, "wan")); if (wan) p.push(`wan=${wan}`);
      const vlan = vlanDe(l);
      const vers = nomPropre(lire(l, "vers"));
      const port = portExcel(lire(l, "port"));
      const monport = portExcel(lire(l, "monport"));
      const opts = [media(l), vlan ? `vlan=${vlan}` : ""].filter(Boolean);
      if (vers && monport) {
        // Port à port (deux switchs) : une liaison à part, écrite après tous les équipements.
        liaisons.push([`${nom}:${monport} -> ${vers}${port ? `:${port}` : ""}`, ...opts].join(" | "));
        if (vlan) p.push(`vlan=${vlan}`);
        nbLiens++;
      } else if (vers) {
        p.push(`sur ${vers}${port ? `:${port}` : ""}`, ...opts);
        nbLiens++;
      } else if (vlan) p.push(`vlan=${vlan}`);
      const masque = lire(l, "masque"); if (masque) p.push(`masque=${masque}`);
      const serie = lire(l, "serie").replace(/[,=]/g, " ").trim(); if (serie) p.push(`serie=${serie}`);
      const mac = lire(l, "mac").replace(/[,=]/g, " ").trim(); if (mac) p.push(`mac=${mac}`);
      // Les autres colonnes (date de pose, garantie, firmware…) restent en informations.
      for (const [i, cle] of autres) { const v = propre(l[i] ?? "").replace(/=/g, "-"); if (v) p.push(`${cle}=${v}`); }
      for (const g of groupes.values()) {
        const v2 = g.vers !== undefined ? nomPropre(propre(l[g.vers] ?? "")) : "";
        if (!v2) continue;
        const p2 = g.port !== undefined ? portExcel(propre(l[g.port] ?? "")) : "";
        const m2 = g.monport !== undefined ? portExcel(propre(l[g.monport] ?? "")) : "";
        liaisons.push([`${nom}${m2 ? `:${m2}` : ""} -> ${v2}${p2 ? `:${p2}` : ""}`, g.cable !== undefined ? media(l, g.cable) : ""].filter(Boolean).join(" | "));
        nbLiens++;
      }
      const rem = lire(l, "remarque"); if (rem) p.push(rem.replace(/=/g, "-"));
      sortie.push(p.join(" | "));
      n++;
    }
    equipements += n;
    onglets.push({ nom: etiquette, lu: `${n} équipement${n > 1 ? "s" : ""}${siteBloc && !col.has("site") ? ` (site « ${siteBloc} »)` : ""}${genreBloc && !col.has("type") ? ` (type « ${GENRES[genreBloc].libelle} »)` : ""}` });
  }
  if (!equipements && !liaisons.length)
    throw new Error("Je ne trouve pas la ligne de titres : il faut au moins une colonne « Nom » (ou « Équipement », « Hostname »).");
  if (liaisons.length) sortie.push("", "# Liaisons", ...liaisons);
  const entete = `# Importé d'un tableau : ${onglets.filter((o) => /\d/.test(o.lu)).map((o) => `${o.nom} (${o.lu})`).join(", ")}.`;
  const manquantes = (["type", "ip", "site", "vers", "port"] as Champ[]).filter((c) => !vuesCol.has(c));
  return { texte: [entete, ...sortie].join("\n") + "\n", equipements, liaisons: nbLiens, ignorees, onglets, manquantes };
}

/** Un modèle de tableau à remplir dans Excel (CSV « ; », comme l'Excel français). */
export function modeleCsv(): string {
  const l = [
    ["Type", "Nom", "IP", "Masque", "Modèle", "N° de série", "Adresse MAC", "Site", "Lieu", "Baie", "Branché sur", "Port", "Port local", "Câble", "VLAN", "Ports RJ45", "SFP", "Passerelle", "Remarque", "Branché sur 2", "Port 2", "Port local 2", "Câble 2"],
    ["switch", "SW-CORE", "10.0.0.2", "255.255.255.0", "Cisco 9300", "FOC0000A1", "00:11:22:00:00:01", "Site A", "Bâtiment 1", "Baie A1", "", "", "", "", "10, 20, 30", "48", "4", "10.0.0.1", "cœur de réseau"],
    ["switch", "SW-ETAGE1", "10.0.0.3", "255.255.255.0", "Cisco 9200", "FOC0000B2", "00:11:22:00:00:02", "Site A", "Bâtiment 1", "Baie A1", "SW-CORE", "SFP1", "SFP1", "fibre", "10, 30", "24", "2", "", ""],
    ["camera", "CAM-ENTREE", "10.0.30.11", "255.255.255.0", "Dôme 4 MP", "", "", "Site A", "Bâtiment 1", "", "SW-ETAGE1", "3", "", "", "30", "", "", "", ""],
    ["camera", "CAM-PARKING", "10.0.30.12", "255.255.255.0", "Bullet 4 MP", "", "", "Site A", "Bâtiment 1", "", "SW-ETAGE1", "7", "", "", "30", "", "", "", ""],
    ["borne", "AP-HALL", "10.0.40.5", "255.255.255.0", "", "", "", "Site A", "Bâtiment 1", "", "SW-ETAGE1", "12", "", "", "40", "", "", "", ""],
    ["serveur", "SRV-VIDEO", "10.0.0.20", "255.255.255.0", "Dell R650", "", "", "Site A", "Bâtiment 1", "Baie A1", "SW-CORE", "SFP2", "SFP1", "DAC", "10, 30", "2", "2", "", "2 cartes réseau", "SW-ETAGE1", "20", "1", "RJ45"],
    ["nvr", "NVR-1", "10.0.30.2", "255.255.255.0", "", "", "", "Site A", "Bâtiment 1", "Baie A1", "SW-ETAGE1", "21", "", "", "30", "8", "", "", "8 ports PoE"],
    ["camera", "CAM-COUR", "10.0.30.13", "255.255.255.0", "Dôme", "", "", "Site A", "Bâtiment 1", "", "NVR-1", "RJ45 3", "", "", "30", "", "", "", ""],
  ];
  return "﻿" + l.map((r) => r.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";")).join("\r\n") + "\r\n";
}
