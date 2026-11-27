/**
 * Genetec ↔ réseau : ce que dit le logiciel vidéo, comparé à la carte.
 *
 * On importe un export Genetec (inventaire matériel : nom, IP, MAC, modèle,
 * firmware, archiveur, état ; ou configuration des flux : débit, résolution,
 * images/s). Il est gardé avec la topologie et rapproché des équipements de
 * la carte par adresse MAC, puis IP, puis nom. On sait alors :
 *   - quelles caméras sont hors ligne, et sur quel switch / port aller voir ;
 *   - lesquelles sont dans Genetec mais pas sur le réseau (débranchées,
 *     déplacées, switch non relevé) ;
 *   - lesquelles sont sur le réseau mais pas dans Genetec (non enregistrées) ;
 *   - les écarts d'IP ou de nom ; le débit de chaque caméra (charge des liens : flux.ts).
 */
import type { Equipement, Inventaire } from "./saisie.ts";

export type UniteGenetec = { nom: string; ip: string; mac: string; fabricant: string; modele: string; firmware: string; archiveur: string; etat: string; source: string };
export type FluxGenetec = { camera: string; flux: string; kbps: number; resolution: string; fps: string; source: string };
export type Genetec = {
  sources: { nom: string; date: string; type: "inventaire" | "configuration"; lignes: number }[];
  unites: UniteGenetec[];
  flux: FluxGenetec[];
};

const plier = (s: string) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const macSimple = (s: string) => { const h = String(s ?? "").toLowerCase().replace(/[^0-9a-f]/g, ""); return h.length === 12 ? h : ""; };

export type EtatGenetec = "en ligne" | "hors ligne" | "autre" | "inconnu";
export function etatDe(t: string): EtatGenetec {
  const s = plier(t);
  if (!s) return "inconnu";
  if (/horsligne|offline|deconnect|disconnect|injoignable|unreachable|perdu|lost|nonconnect|absent|down|panne|erreur|error|failed/.test(s)) return "hors ligne";
  if (/enligne|online|connecte|connected|actif|active|^ok$|running|enregistr|recording|up$/.test(s)) return "en ligne";
  return "autre";
}

export type Rapprochement = {
  unite: UniteGenetec; eq: Equipement | null; par: "mac" | "ip" | "nom" | null;
  etat: EtatGenetec; switch?: string; port?: string;
};
export type Comparaison = {
  actif: boolean;
  rapproches: Rapprochement[];
  horsLigne: Rapprochement[];
  absentes: Rapprochement[];              // dans Genetec, introuvables sur la carte
  nonEnregistrees: Equipement[];          // caméras de la carte absentes de Genetec
  ecartsIp: Rapprochement[];              // même MAC, IP différente
  ecartsNom: Rapprochement[];
  doublonsIp: { ip: string; noms: string[] }[];
  debitParCamera: Map<string, number>;    // nom carte → kb/s (enregistrement + direct) ; la charge des liens : flux.ts
};

const valeur = (e: Equipement, k: string) => e.kv.find(([c]) => c.toLowerCase() === k)?.[1];
const RESEAU = ["switch", "passerelle", "parefeu", "borne"];

export function comparerGenetec(inv: Inventaire, g?: Genetec | null): Comparaison {
  const vide: Comparaison = { actif: false, rapproches: [], horsLigne: [], absentes: [], nonEnregistrees: [], ecartsIp: [], ecartsNom: [], doublonsIp: [], debitParCamera: new Map() };
  if (!g || (!g.unites.length && !g.flux.length)) return vide;
  const parMac = new Map<string, Equipement>(), parIp = new Map<string, Equipement>(), parNom = new Map<string, Equipement>();
  inv.equipements.forEach((e) => {
    const m = macSimple(valeur(e, "mac") ?? "");
    if (m) parMac.set(m, e);
    if (e.ip) parIp.set(e.ip.split("/")[0], e);
    parNom.set(plier(e.nom), e);
    const lldp = valeur(e, "lldp"); if (lldp) parNom.set(plier(lldp), e);
  });
  const parEq = new Map(inv.equipements.map((e) => [e.nom, e]));
  const brancheDe = (e: Equipement) => {
    const l = inv.liaisons.find((x) => (x.a === e.nom || x.b === e.nom) && RESEAU.includes(parEq.get(x.a === e.nom ? x.b : x.a)?.genre ?? ""));
    return l ? (l.a === e.nom ? { switch: l.b, port: l.portB } : { switch: l.a, port: l.portA }) : {};
  };
  const rapproches: Rapprochement[] = g.unites.map((u) => {
    const noms = u.nom.split(/\s*\/\s*/).filter(Boolean);
    let eq: Equipement | null = null, par: Rapprochement["par"] = null;
    const m = macSimple(u.mac);
    if (m && parMac.has(m)) { eq = parMac.get(m)!; par = "mac"; }
    else if (u.ip && parIp.has(u.ip)) { eq = parIp.get(u.ip)!; par = "ip"; }
    else { const n = noms.find((x) => parNom.has(plier(x))); if (n) { eq = parNom.get(plier(n))!; par = "nom"; } }
    return { unite: u, eq, par, etat: etatDe(u.etat), ...(eq ? brancheDe(eq) : {}) };
  });
  const vus = new Set(rapproches.filter((r) => r.eq).map((r) => r.eq!.nom));
  const ips = new Map<string, string[]>();
  g.unites.forEach((u) => { if (u.ip) ips.set(u.ip, [...(ips.get(u.ip) ?? []), u.nom || u.mac]); });

  // Débits : somme des flux de chaque caméra (enregistrement + direct).
  const debitParCamera = new Map<string, number>();
  const nomCarte = (camera: string) => {
    const r = rapproches.find((x) => x.eq && x.unite.nom.split(/\s*\/\s*/).some((n) => plier(n) === plier(camera)));
    return r?.eq?.nom ?? parNom.get(plier(camera))?.nom ?? null;
  };
  g.flux.forEach((f) => {
    const n = nomCarte(f.camera);
    if (n && f.kbps > 0) debitParCamera.set(n, (debitParCamera.get(n) ?? 0) + f.kbps);
  });
  return {
    actif: true,
    rapproches,
    horsLigne: rapproches.filter((r) => r.etat === "hors ligne"),
    absentes: rapproches.filter((r) => !r.eq),
    nonEnregistrees: inv.equipements.filter((e) => e.genre === "camera" && !vus.has(e.nom)),
    ecartsIp: rapproches.filter((r) => r.eq && r.par === "mac" && r.unite.ip && r.eq.ip && r.eq.ip.split("/")[0] !== r.unite.ip),
    ecartsNom: rapproches.filter((r) => r.eq && r.par !== "nom" && r.unite.nom && !r.unite.nom.split(/\s*\/\s*/).some((n) => plier(n) === plier(r.eq!.nom))),
    doublonsIp: [...ips].filter(([, n]) => n.length > 1).map(([ip, noms]) => ({ ip, noms })),
    debitParCamera,
  };
}
