/**
 * Relevés des switchs → carte.
 *
 * « Relever les switchs.bat » (dossier `releve/`) se connecte aux switchs et
 * écrit un fichier texte par switch dans `Sites/<site>/Log Switch/`. Ici, on
 * lit ces fichiers avec le moteur d'analyse de Cartographie Réseau v3.2,
 * repris tel quel (`src/releve/`) : marque reconnue, CDP/LLDP, tables MAC et
 * ARP, VLAN, trunks, PoE, anomalies. Le résultat passe par la même lecture
 * que l'export Excel de cet outil (carto.ts), puis devient le texte de la carte.
 *
 * Rien ne se connecte ici : on lit des fichiers déjà enregistrés sur le poste.
 * Les sauvegardes de configuration (`Config Switch`, mots de passe possibles)
 * ne sont jamais lues.
 */
import "./releve/carto-core.js";
import "./releve/carto-v2.js";
import { cartoVersTexte } from "./carto.ts";
import type { Feuille, ResultatImport } from "./tableur.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
const C = (globalThis as any).CartoCore;
const V = (globalThis as any).CartoV2;

export type FichierReleve = { nom: string; chemin?: string; texte: string };
export type Anomalie = { gravite: "critique" | "attention" | "info"; equipement: string; port: string; texte: string };
export type ResultatReleve = ResultatImport & { site: string; anomalies: Anomalie[]; fichiers: { nom: string; lu: string }[] };

const ETAT_RELEVE: Record<string, string> = { ok: "Relevé OK", partiel: "Relevé partiel", echec: "Non relevé", inconnu: "Marque inconnue" };

/** « # Relevé Carto Réseau - 10.0.0.1 - 25/11/2026 12:02 - site : Melun - script : v5.2 - marque : HP » → « Melun ». */
export function siteDuReleve(t: string): string {
  const m = String(t).slice(0, 400).match(/^\uFEFF?#\s*Relev\S*\s+Carto R\S+seau\b.*?\bsite\s*:\s*(.+?)\s+-\s+(?:script|marque)\b/m);
  return m ? m[1].trim() : "";
}

/** Fichiers à laisser de côté : configurations sauvegardées, journaux, anciens relevés. */
export function aIgnorer(f: { nom: string; chemin?: string }): string | null {
  const c = `${f.chemin ?? ""}/${f.nom}`.replace(/\\/g, "/");
  // Sauvegardes de configuration (mots de passe possibles) : rangées dans « Config Switch »,
  // nommées « SW-01 (10.0.0.1) - 2026-11-20 1000.txt ».
  if (/(^|\/)config switch\//i.test(c) || / - \d{4}-\d\d-\d\d \d{4}\.txt$/i.test(f.nom)) return "configuration sauvegardée (jamais lue)";
  if (/^_|^commandes|^switchs\.txt$|^dernier-site|identifiant/i.test(f.nom)) return "fichier du script";
  if (/ - ancien \d{4}-\d\d-\d\d/i.test(f.nom)) return "ancien relevé (remplacé)";
  if (!/\.(txt|log|json|csv)$/i.test(f.nom)) return "format non lu";
  return null;
}

export function relevesVersTexte(fichiers: FichierReleve[]): ResultatReleve {
  const S: any = { version: 2, siteName: "", switches: [], decouverte: null, manualLinks: [], exclusions: [], genetec: null, gconfig: null, positions: {}, opts: {}, cfg: { ...V.DEF_CFG } };
  const lus: { nom: string; lu: string }[] = [];
  for (const f of fichiers) {
    const raison = aIgnorer(f);
    if (raison) { lus.push({ nom: f.nom, lu: `ignoré : ${raison}` }); continue; }
    const texte = f.texte.replace(/^\uFEFF/, "");
    if (/^#\s*Configuration \(/.test(texte)) { lus.push({ nom: f.nom, lu: "ignoré : configuration sauvegardée (jamais lue)" }); continue; }
    try {
      if (/\.json$/i.test(f.nom)) {
        const J = JSON.parse(texte);
        if (J.format !== "carto-reseau-decouverte") { lus.push({ nom: f.nom, lu: "ignoré : JSON non reconnu" }); continue; }
        const r = V.importDecouverte(J);
        S.switches.push(...r.switches); S.decouverte = r.decouverte;
        lus.push({ nom: f.nom, lu: `${r.switches.length} switchs (découverte)` });
      } else if (/\.csv$/i.test(f.nom)) {
        // Export Genetec (inventaire ou configuration) : les vrais noms des caméras.
        const r = V.importGenetecRows(S, C.parseCsvText(texte), f.nom, new Date().toISOString());
        lus.push({ nom: f.nom, lu: `Genetec : ${r.msg}` });
      } else {
        const site = siteDuReleve(texte);
        if (site && !S.siteName) S.siteName = site;
        const s = V.parseReleveV2(texte, f.nom);
        const i = S.switches.findIndex((x: any) => x.name.toLowerCase() === s.name.toLowerCase() && (!x.mgmtIp || !s.mgmtIp || x.mgmtIp === s.mgmtIp));
        if (i >= 0) S.switches[i] = s; else S.switches.push(s);
        lus.push({ nom: f.nom, lu: `${s.name} (${V.VENDOR_LABEL[s.vendor] || s.vendor || "marque ?"})${site && S.siteName && site !== S.siteName ? ` — site « ${site} »` : ""}` });
      }
    } catch (e) {
      lus.push({ nom: f.nom, lu: `illisible : ${(e as Error).message}` });
    }
  }
  if (!S.switches.length) throw new Error("Aucun relevé de switch dans ces fichiers. Choisissez les .txt du dossier « Log Switch » (créés par « Relever les switchs.bat »).");

  const SV = V.appliquerExclusions(S);
  const M = C.analyze(SV);
  const A: any[] = V.computeAnomalies(SV, M, S.cfg);
  const site = S.siteName || "Site relevé";

  // Les mêmes onglets que l'export Excel de Cartographie Réseau.
  const feuilles: Feuille[] = [
    { nom: "Synthèse", lignes: [["Élément", "Valeur"], ["Site", site]] },
    { nom: "Switchs", lignes: [["Nom", "IP", "Marque", "Modèle", "N° série", "Firmware", "Emplacement", "Relevé", "Raison"],
      ...SV.switches.map((s: any) => [s.name, s.mgmtIp || (s.ips || [])[0] || "", V.VENDOR_LABEL[s.vendor] || s.vendor || "", s.model || "", s.serial || "",
        s.ext?.firmware || "", s.location || "", ETAT_RELEVE[V.statusOfSwitch(s)] || "", s.ext?.releve?.raison || ""])] },
    { nom: "Trunks", lignes: [["Switch", "Port", "VLAN natif", "VLAN autorisés"],
      ...SV.switches.flatMap((s: any) => Object.values(s.ext?.trunks || {}).map((t: any) => [s.name, t.port, t.native || "", t.allowed ? V.compactVlans(t.allowed) : ""]))] },
    { nom: "Liens", lignes: [["De", "Port", "Vers", "Port distant", "Vu des deux côtés", "Média", "Vitesse"],
      ...M.links.map((L: any) => [M.nodeName(L.a), L.aPort || "", M.nodeName(L.b), L.bPort || L.bPortRaw || "", L.both ? "oui" : "non", L.media || "", V.speedLabel(L.speed) || ""])] },
    { nom: "Équipements", lignes: [["Type", "Nom (Genetec si connu)", "Nom réseau (LLDP)", "Archiveur", "IP", "MAC", "Fabricant", "Switch", "Port", "VLAN", "Raccordement"],
      ...M.devices.map((x: any) => [C.CAT_LABEL[x.cat] || x.cat || "", x.name || "", x.gen ? x.netName || "" : "", x.gen ? x.gen.archiver || "" : "", x.ip || "", C.fmtMac(x.mac),
        x.vendor || "", x.loc ? M.nodeName("sw:" + x.loc.sw) || nomSwitch(SV, x.loc.sw) : "", x.loc ? x.loc.port : "", x.vlan || "", x.conf || ""])] },
  ];
  const r = cartoVersTexte(feuilles);

  const anomalies: Anomalie[] = A.map((a) => ({
    gravite: a.sev === "crit" ? "critique" : a.sev === "warn" ? "attention" : "info",
    equipement: a.sw || "", port: a.port || "", texte: a.simple || a.titre || "",
  }));
  // Les anomalies du relevé : sur la fiche de chaque switch, et toutes à la fin du texte.
  let texte = r.texte;
  const parSwitch = new Map<string, Anomalie[]>();
  anomalies.filter((a) => a.gravite !== "info" && a.equipement).forEach((a) => parSwitch.set(a.equipement, [...(parSwitch.get(a.equipement) ?? []), a]));
  texte = texte.split("\n").map((l) => {
    const m = l.match(/^switch (\S+) \|/);
    const liste = m ? parSwitch.get(m[1]) : undefined;
    if (!liste) return l;
    const crit = liste.filter((a) => a.gravite === "critique").length;
    // Sur la fiche du switch : le nombre, puis chaque anomalie en clair (les critiques d'abord).
    const tri = [...liste].sort((x, y) => Number(y.gravite === "critique") - Number(x.gravite === "critique"));
    const detail = tri.map((a) => `${a.gravite === "critique" ? "⛔ " : "⚠ "}${a.port ? `${a.port} : ` : ""}${a.texte}`.replace(/[|\r\n]+/g, " ").trim()).join(" · ");
    return `${l} | anomalies=${liste.length}${crit ? ` dont ${crit} critique${crit > 1 ? "s" : ""}` : ""} — ${detail}`;
  }).join("\n");
  if (anomalies.length) {
    const net = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
    texte += [
      "", `# ---- Anomalies du relevé (${anomalies.length}) — analyse de Cartographie Réseau ----`,
      ...["critique", "attention", "info"].flatMap((g) => anomalies.filter((a) => a.gravite === g)
        .map((a) => `# [${g}] ${a.equipement || "réseau"}${a.port ? ` port ${a.port}` : ""} : ${net(a.texte)}`)),
      "",
    ].join("\n");
  }
  texte = texte
    .replace("# Importé de Cartographie Réseau (export Excel)", `# Importé des relevés de switchs (${lus.filter((x) => !x.lu.startsWith("ignoré")).length} fichiers), analysés avec le moteur de Cartographie Réseau`)
    .replace("# Le relevé a été fait par l'autre outil ; ici, rien ne se connecte aux switchs.", "# Relevés faits par « Relever les switchs.bat » ; cette page ne se connecte à rien.");
  return { ...r, texte, site, anomalies, fichiers: lus };
}

function nomSwitch(SV: any, id: string): string {
  return SV.switches.find((s: any) => s.id === id)?.name ?? "";
}
