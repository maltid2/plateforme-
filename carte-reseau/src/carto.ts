/**
 * Export Excel de « Cartographie Réseau » (v3.x) → texte de la carte.
 *
 * Le relevé des switchs (script « Relever les switchs.bat ») et son analyse
 * (CDP/LLDP, tables MAC et ARP) se font dans cet autre outil ; son export
 * Excel contient déjà ce qu'il faut pour dessiner la carte :
 *   - « Switchs »     : nom, IP, marque, modèle, n° de série, emplacement ;
 *   - « Liens »       : De / Port / Vers / Port distant / Média ;
 *   - « Équipements » : caméras, serveurs… avec leur switch et leur port ;
 *   - « Trunks »      : VLAN autorisés sur les ports en trunk ;
 *   - « Synthèse »    : le nom du site.
 * Les autres onglets (Ports, VLAN, PoE, Anomalies…) servent au diagnostic,
 * pas au dessin : ils sont laissés de côté.
 *
 * Ici, aucune connexion à quoi que ce soit : on lit un fichier, c'est tout.
 */
import type { Feuille, ResultatImport } from "./tableur.ts";

const simple = (s: string) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const propre = (s: string) => String(s ?? "").replace(/[|#\r\n]/g, " ").replace(/\s+/g, " ").trim();
/** Un nom utilisable dans la carte : pas d'espace, pas de « : » ni de « | ». */
const nomCarte = (s: string) => propre(s).replace(/\s*\/\s*/g, "/").split("/")[0].replace(/[\s:]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
/** Un port tel que l'écrit le switch (Gi1/0/10, 1/1/49, Te1/1/1…), sans espace ni « : ». */
const portCarte = (s: string) => propre(s).replace(/[\s:]+/g, "");

type Tableau = { titres: string[]; lignes: string[][] };

function tableau(f: Feuille | undefined): Tableau | null {
  if (!f) return null;
  const i = f.lignes.findIndex((l) => l.filter((c) => String(c ?? "").trim()).length >= 2);
  if (i < 0) return null;
  return { titres: f.lignes[i].map((c) => simple(c)), lignes: f.lignes.slice(i + 1).filter((l) => l.some((c) => String(c ?? "").trim())) };
}
const feuille = (fs: Feuille[], ...noms: string[]) => fs.find((f) => noms.includes(simple(f.nom)));
/** La valeur de la colonne dont le titre commence par l'un des mots donnés. */
function lecteur(t: Tableau) {
  return (l: string[], ...titres: string[]) => {
    const i = t.titres.findIndex((x) => titres.some((m) => x === m || x.startsWith(m + " ")));
    return i < 0 ? "" : propre(l[i] ?? "");
  };
}

/** Le fichier vient-il de l'export Excel de Cartographie Réseau ? */
export function estExportCarto(fs: Feuille[]): boolean {
  const liens = tableau(feuille(fs, "liens"));
  const switchs = tableau(feuille(fs, "switchs"));
  return !!liens && !!switchs
    && ["de", "port", "vers", "port distant"].every((m) => liens.titres.includes(m))
    && switchs.titres.includes("nom");
}

/** Ports RJ45 et SFP d'un switch, d'après son modèle (« C9300-48P », « 6200F 48G 4SFP+ », « M4300-28G »). */
export function portsDuModele(modele: string): { rj?: number; sfp?: number } {
  const m = ` ${modele.toUpperCase()} `;
  const sfp = m.match(/(\d)\s*X?\s*SFP/)?.[1];
  const n = m.match(/(?:^|[^0-9])(8|10|12|16|24|28|48|52)(?=[^0-9])/)?.[1];
  if (!n) return sfp ? { sfp: Number(sfp) } : {};
  const total = Number(n);
  // 28 / 52 / 10 ports = 24 / 48 / 8 en cuivre + 4 / 4 / 2 cages SFP.
  const rj = total === 28 ? 24 : total === 52 ? 48 : total === 10 ? 8 : total;
  return { rj, sfp: sfp ? Number(sfp) : total !== rj ? total - rj : undefined };
}

/** Type d'un équipement d'après la colonne « Type » ou, à défaut, son nom (FW-…, AP-…). */
function genreDe(type: string, nom: string): string | null {
  const t = simple(type);
  if (/camera|dome|bullet/.test(t)) return "camera";
  if (/serveur|server|\bvm\b/.test(t)) return "serveur";
  if (/archiveur|enregistreur|nvr/.test(t)) return "nvr";
  if (/borne|wifi|point d acces|\bap\b/.test(t)) return "borne";
  if (/pare feu|firewall/.test(t)) return "parefeu";
  if (/routeur|passerelle|gateway/.test(t)) return "passerelle";
  if (/imprimante/.test(t)) return "imprimante";
  if (/poste|pc|ordinateur/.test(t)) return "poste";
  if (/telephone|voip/.test(t)) return "telephone";
  if (/onduleur|ups/.test(t)) return "onduleur";
  if (/stockage|nas/.test(t)) return "nas";
  if (/mac virtuelle/.test(t)) return null;   // adresse aléatoire : pas un équipement à dessiner
  if (/switch|commutateur/.test(t)) return "switch";
  const n = nom.toUpperCase();
  if (/^(SW|SWITCH)\b|^SW[-_]/.test(n)) return "switch";
  if (/^(FW|PF|FIREWALL)[-_]/.test(n)) return "parefeu";
  if (/^(AP|WIFI|BORNE)[-_]/.test(n)) return "borne";
  if (/^(CAM|CAMERA)[-_]/.test(n)) return "camera";
  if (/^(GW|RTR|ROUTEUR|BOX)[-_]/.test(n)) return "passerelle";
  if (/^(SRV|SERVEUR|VMS)[-_]/.test(n)) return "serveur";
  if (/^(NVR|ARCH)[-_]/.test(n)) return "nvr";
  return type && !/inconnu|equipement reseau/.test(t) ? "autre" : null;
}
const PREFIXE: Record<string, string> = { camera: "CAM", serveur: "SRV", nvr: "NVR", borne: "AP", parefeu: "FW", passerelle: "GW", imprimante: "IMP", poste: "PC", telephone: "TEL", onduleur: "UPS", nas: "NAS", switch: "SW", autre: "EQ" };

export function cartoVersTexte(fs: Feuille[]): ResultatImport {
  const sortie: string[] = [];
  const onglets: ResultatImport["onglets"] = [];
  let ignorees = 0;

  // Le site : « Synthèse › Site ».
  let site = "";
  let exemple = false;
  const syn = feuille(fs, "synthese");
  syn?.lignes.forEach((l) => {
    const cle = simple(l[0] ?? "");
    if (cle === "site") site = propre(l[1] ?? "");
    if (cle.startsWith("donnees d exemple") && /oui/i.test(l[1] ?? "")) exemple = true;
  });
  site = propre(site.replace(/\(donn[ée]es simul[ée]es\)/i, "")) || "Site relevé";
  if (syn) onglets.push({ nom: syn.nom, lu: `site « ${site} »` });

  const connus = new Map<string, string>();   // nom simplifié → nom écrit
  const lieuDe = new Map<string, string>();   // switch → emplacement
  const reserve = (nom: string) => {
    let n = nom, k = 2;
    while (connus.has(simple(n))) n = `${nom}-${k++}`;
    connus.set(simple(n), n);
    return n;
  };
  const nomConnu = (s: string) => connus.get(simple(nomCarte(s)));

  /* ---------- switchs ---------- */
  const tSw = tableau(feuille(fs, "switchs"))!;
  const v = lecteur(tSw);
  const lignesSw: string[] = [];
  const nonReleves: string[] = [];
  const modeles = new Map<string, { rj?: number; sfp?: number }>();
  tSw.lignes.forEach((l) => {
    const brut = v(l, "nom");
    if (!brut) { ignorees++; return; }
    const nom = reserve(nomCarte(brut));
    const modele = v(l, "modele") || "";
    const marque = v(l, "marque");
    const lieu = v(l, "emplacement");
    if (lieu) lieuDe.set(nom, lieu);
    const p = portsDuModele(modele);
    modeles.set(nom, p);
    const releve = v(l, "releve"), raison = v(l, "raison");
    if (releve && !/ok/i.test(releve)) nonReleves.push(`${nom} : ${releve.toLowerCase()}${raison ? ` (${raison})` : ""}`);
    lignesSw.push([
      `switch ${nom}`,
      v(l, "ip") && `ip ${v(l, "ip")}`,
      modele ? `modèle ${modele}` : marque && !/inconnu/i.test(marque) ? `modèle ${marque}` : "",
      marque && !/inconnu/i.test(marque) ? `marque=${marque}` : "",
      p.rj && `ports=${p.rj}`,
      p.sfp && `sfp=${p.sfp}`,
      v(l, "n serie", "numero de serie", "serie") && `serie=${v(l, "n serie", "numero de serie", "serie")}`,
      lieu && `point=${lieu}`,
      v(l, "firmware") && `firmware=${v(l, "firmware")}`,
      releve && !/ok/i.test(releve) ? `releve=${releve}${raison ? ` (${raison})` : ""}` : "",
    ].filter(Boolean).join(" | "));
  });
  onglets.push({ nom: feuille(fs, "switchs")!.nom, lu: `${lignesSw.length} switchs` });

  /* ---------- VLAN des trunks ---------- */
  const trunks = new Map<string, string>();   // « SW|port » → VLAN autorisés
  const tTr = tableau(feuille(fs, "trunks"));
  if (tTr) {
    const t = lecteur(tTr);
    tTr.lignes.forEach((l) => {
      const sw = nomConnu(t(l, "switch")), port = portCarte(t(l, "port"));
      if (sw && port) trunks.set(`${sw}|${simple(port)}`, t(l, "vlan autorises", "vlans autorises").replace(/\s+/g, ""));
    });
    onglets.push({ nom: feuille(fs, "trunks")!.nom, lu: `VLAN de ${trunks.size} ports en trunk` });
  }

  /**
   * Un port écrit par le switch, rendu lisible par la façade : sur un
   * switch de 48 ports, « 1/1/49 » (Aruba) est la 1re cage SFP ; chez Cisco,
   * « Gi1/1/1 » (module d'uplink) aussi.
   */
  const port = (sw: string, p: string) => {
    const s = portCarte(p);
    if (!s || /^(po|port-channel|lag|ae|trk|bagg)\d/i.test(s)) return s;
    const cisco = s.match(/^(gi|ge|fa|gigabitethernet|fastethernet)[a-z]*\d+\/([1-9]\d*)\/(\d+)$/i);
    if (cisco) return `SFP${cisco[3]}`;
    const num = s.match(/^\d+\/\d+\/(\d+)$|^(\d+)$/);
    const rj = modeles.get(sw)?.rj;
    const n = num ? Number(num[1] ?? num[2]) : NaN;
    if (rj && n > rj) return `SFP${n - rj}`;
    return s;
  };

  /* ---------- liens entre équipements réseau ---------- */
  const lignesLiens: string[] = [];
  const ajoutes: string[] = [];
  const pris = new Set<string>();   // « SW|port » déjà câblés (un équipement vu derrière n'y est pas branché)
  const tLi = tableau(feuille(fs, "liens"))!;
  const li = lecteur(tLi);
  const extremite = (brut: string) => {
    const connu = nomConnu(brut);
    if (connu) return connu;
    // Un voisin vu par LLDP/CDP mais pas dans « Switchs » (pare-feu, borne, switch non géré…).
    const nom = reserve(nomCarte(brut));
    const g = genreDe("", nom) ?? "autre";
    ajoutes.push(`${g} ${nom} | source=voisin LLDP/CDP`);
    return nom;
  };
  tLi.lignes.forEach((l) => {
    const de = li(l, "de"), vers = li(l, "vers");
    if (!de || !vers) { ignorees++; return; }
    const a = extremite(de), b = extremite(vers);
    const pa = port(a, li(l, "port")), pb = port(b, li(l, "port distant"));
    const media = simple(li(l, "media"));
    const vl = trunks.get(`${a}|${simple(pa)}`) ?? trunks.get(`${b}|${simple(pb)}`);
    lignesLiens.push([
      `${a}${pa ? `:${pa}` : ""} -> ${b}${pb ? `:${pb}` : ""}`,
      media.startsWith("fibre") ? "fibre" : media.startsWith("cuivre") ? "cuivre" : "",
      vl ? `trunk | vlan=${vl}` : "",
      li(l, "vitesse"),   // la vitesse s'écrit sur le câble (« 10G · trunk 1,20 »)
    ].filter(Boolean).join(" | "));
    if (pa) pris.add(`${a}|${simple(pa)}`);
    if (pb) pris.add(`${b}|${simple(pb)}`);
  });
  onglets.push({ nom: feuille(fs, "liens")!.nom, lu: `${lignesLiens.length} liens` });

  /* ---------- équipements branchés (caméras, serveurs…) ---------- */
  const lignesEq: string[] = [];
  const tEq = tableau(feuille(fs, "equipements"));
  let ecartes = 0;
  if (tEq) {
    const e = lecteur(tEq);
    tEq.lignes.forEach((l) => {
      const racc = simple(e(l, "raccordement"));
      // Vu seulement à travers un lien entre switchs : on ne sait pas où il est branché.
      if (racc && !racc.startsWith("branche directement")) { ecartes++; return; }
      const sw = nomConnu(e(l, "switch"));
      const p = sw ? port(sw, e(l, "port")) : "";
      if (sw && p && pris.has(`${sw}|${simple(p)}`)) { ecartes++; return; }
      const nomBrut = e(l, "nom") || e(l, "nom reseau");
      const g = genreDe(e(l, "type"), nomCarte(nomBrut));
      if (!g) { ecartes++; return; }
      const ip = e(l, "ip"), mac = e(l, "mac");
      const repli = ip ? ip.split(".").slice(-2).join("-") : mac.replace(/[^0-9a-f]/gi, "").slice(-4).toUpperCase();
      const nom = reserve(nomCarte(nomBrut) || `${PREFIXE[g]}-${repli || "SANS-NOM"}`);
      const autres = propre(nomBrut).split(/\s*\/\s*/).slice(1).filter(Boolean);
      const lieu = sw ? lieuDe.get(sw) : undefined;
      lignesEq.push([
        `${g} ${nom}`,
        ip && `ip ${ip}`,
        e(l, "fabricant") && !/virtuelle/i.test(e(l, "fabricant")) ? `modèle ${e(l, "fabricant")}` : "",
        mac && `mac=${mac}`,
        lieu && `point=${lieu}`,
        sw && `sur ${sw}${p ? `:${p}` : ""}`,
        e(l, "vlan") && /^\d/.test(e(l, "vlan")) && `vlan=${e(l, "vlan")}`,
        e(l, "archiveur") && `archiveur=${e(l, "archiveur")}`,
        e(l, "nom reseau") && simple(e(l, "nom reseau")) !== simple(nom) ? `lldp=${e(l, "nom reseau")}` : "",
        autres.length ? `aussi nommé ${autres.join(", ")}` : "",
      ].filter(Boolean).join(" | "));
    });
    onglets.push({ nom: feuille(fs, "equipements")!.nom, lu: `${lignesEq.length} équipements${ecartes ? ` (${ecartes} vus seulement derrière un lien entre switchs, non placés)` : ""}` });
  }
  fs.filter((f) => !["synthese", "switchs", "liens", "trunks", "equipements"].includes(simple(f.nom)))
    .forEach((f) => onglets.push({ nom: f.nom, lu: "diagnostic, non dessiné" }));

  sortie.push(
    `# Importé de Cartographie Réseau (export Excel)${exemple ? " — DONNÉES D'EXEMPLE SIMULÉES" : ""}.`,
    "# Le relevé a été fait par l'autre outil ; ici, rien ne se connecte aux switchs.",
    "",
    `site ${site}`,
    "",
    "# Switchs relevés",
    ...lignesSw,
  );
  if (nonReleves.length) sortie.push("", "# Non relevés (vérifier sur place) :", ...nonReleves.map((x) => `#   ${x}`));
  if (ajoutes.length) sortie.push("", "# Voisins vus en LLDP/CDP, absents de la liste des switchs", ...ajoutes);
  if (lignesEq.length) sortie.push("", "# Équipements branchés", ...lignesEq);
  sortie.push("", "# Liens entre équipements réseau (LLDP/CDP)", ...lignesLiens, "");

  return {
    texte: sortie.join("\n"),
    equipements: lignesSw.length + ajoutes.length + lignesEq.length,
    liaisons: lignesLiens.length + lignesEq.filter((x) => x.includes(" | sur ")).length,
    ignorees,
    onglets,
    manquantes: [],
  };
}
