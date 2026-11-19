/**
 * La façade d'un équipement à ports (switch, passerelle, pare-feu).
 *
 * Un même modèle sert au plan 2D (SVG) et à la 3D (texture dessinée sur un
 * canvas) : chaque port a une place fixe, donc un câble part du port qu'on a
 * écrit, et pas du milieu de la boîte.
 *
 * Disposition d'un vrai switch : les ports RJ45 vont par paires, impairs en
 * haut, pairs en bas, par blocs de 12 ; les cages SFP sont à droite. Une
 * passerelle a ses ports WAN à part, à gauche des ports LAN.
 *
 * Unités : celles du plan 2D. La 3D met tout à l'échelle.
 */
import type { Equipement, Inventaire, Liaison } from "./saisie.ts";

export type TypePort = "rj45" | "sfp" | "wan" | "autre";
export type Port = {
  id: string;          // tel qu'affiché : « 5 », « Te1 », « WAN », « LAN2 »
  type: TypePort;
  x: number; y: number; // centre, relatif au coin haut-gauche de la façade
  haut: boolean;       // rangée du haut (le câble sort vers le haut)
};
export type Branchement = { port: string; vers: string; portVers?: string; liaison: Liaison };
export type Facade = {
  w: number; h: number;
  ports: Port[];
  parId: Map<string, Port>;
  branches: Map<string, Branchement>;   // id de port → ce qui y est branché
};

export const A_FACADE = new Set(["switch", "passerelle", "parefeu"]);
export const aFacade = (e: Equipement) => A_FACADE.has(e.genre);

export const PAS = 0.62, PW = 0.5, PH = 0.42, ETIQ = 2.9, FH = 2.0;
const RANG_HAUT = 0.62, RANG_BAS = 1.38;

/** « Gi1/0/5 » → rj45 5 ; « Te1 », « SFP+2 », « xe-0/0/1 » → sfp ; « WAN2 » → wan 2 ; « LAN3 » → rj45 3. */
export function lirePort(p: string): { type: TypePort; n: number | null } {
  const s = p.trim().toLowerCase();
  const n = s.match(/(\d+)$/)?.[1];
  const num = n ? Number(n) : null;
  if (/^wan/.test(s)) return { type: "wan", n: num ?? 1 };
  if (/^(sfp|te|xe|tengig|tengigabit|x|uplink|up|fibre|fiber|mgig)/.test(s)) return { type: "sfp", n: num };
  if (/^rj-?45./.test(s)) { const m = s.match(/^rj-?45\D+(\d+)$/); return { type: "rj45", n: m ? Number(m[1]) : null }; }
  if (/^(\d+|gi|ge|fa|eth|et|port|p|lan|g|f|ge-)/.test(s) && num !== null) return { type: "rj45", n: num };
  return { type: "autre", n: num };
}

const arrondi = (n: number, pas: number[]) => pas.find((p) => p >= n) ?? Math.ceil(n / 8) * 8;
const nombre = (e: Equipement, cle: RegExp) => {
  const v = e.kv.find(([k]) => cle.test(k))?.[1];
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 96) : null;
};

/** La façade d'un équipement : ses ports, leur place, ce qui y est branché. */
export function facade(e: Equipement, inv: Inventaire): Facade {
  const branches = new Map<string, Branchement>();
  const utilises: string[] = [];
  inv.liaisons.forEach((l) => {
    if (l.a === e.nom && l.portA) { branches.set(l.portA, { port: l.portA, vers: l.b, portVers: l.portB, liaison: l }); utilises.push(l.portA); }
    if (l.b === e.nom && l.portB) { branches.set(l.portB, { port: l.portB, vers: l.a, portVers: l.portA, liaison: l }); utilises.push(l.portB); }
  });
  const lus = utilises.map((p) => ({ id: p, ...lirePort(p) }));
  const max = (t: TypePort) => Math.max(0, ...lus.filter((p) => p.type === t).map((p) => p.n ?? 0));

  const passerelle = e.genre !== "switch";
  const nRj = nombre(e, /^ports?$/i) ?? (passerelle ? Math.max(4, max("rj45")) : arrondi(Math.max(max("rj45"), 8), [8, 12, 16, 24, 48]));
  const nSfp = nombre(e, /^sfp$/i) ?? (max("sfp") ? arrondi(max("sfp"), [2, 4, 8]) : passerelle ? 0 : 0);
  const nWan = passerelle ? Math.max(1, max("wan"), nombre(e, /^wan$/i) ?? 0) : 0;

  // Nom affiché d'un port : on garde l'écriture de l'utilisateur quand le
  // port est branché, sinon une forme courte (« 7 », « SFP2 », « WAN »).
  const ecrit = new Map<string, string>();
  lus.forEach((p) => { if (p.n !== null) ecrit.set(`${p.type}:${p.n}`, p.id); });
  const nomDe = (t: TypePort, n: number) =>
    ecrit.get(`${t}:${n}`) ?? (t === "rj45" ? (passerelle ? `LAN${n}` : String(n)) : t === "sfp" ? `SFP${n}` : nWan > 1 ? `WAN${n}` : "WAN");

  const ports: Port[] = [];
  // La zone d'étiquette s'élargit avec le nom : il ne doit pas mordre sur les ports.
  let x = Math.max(ETIQ, Math.min(e.nom.length, 13) * 0.27 + 0.6, (e.ip?.length ?? 0) * 0.17 + 0.6);
  // WAN (passerelle / pare-feu) : à part, sur une seule rangée.
  for (let i = 1; i <= nWan; i++) { ports.push({ id: nomDe("wan", i), type: "wan", x: x + PW / 2, y: FH / 2, haut: true }); x += PAS; }
  if (nWan) x += 0.35;
  // RJ45 : impairs en haut, pairs en bas, blocs de 12 (6 colonnes). Une
  // passerelle à 8 ports ou moins les aligne sur une rangée.
  const uneRangee = passerelle && nRj <= 8;
  for (let i = 1; i <= nRj; i++) {
    const col = uneRangee ? i - 1 : Math.floor((i - 1) / 2);
    const bloc = uneRangee ? 0 : Math.floor(col / 6);
    const px = x + col * PAS + bloc * 0.3 + PW / 2;
    const haut = uneRangee ? true : (i - 1) % 2 === 0;
    ports.push({ id: nomDe("rj45", i), type: "rj45", x: px, y: uneRangee ? FH / 2 : haut ? RANG_HAUT : RANG_BAS, haut });
  }
  const colsRj = uneRangee ? nRj : Math.ceil(nRj / 2);
  x += colsRj * PAS + Math.max(0, Math.ceil(colsRj / 6) - 1) * 0.3;
  if (nSfp) x += 0.45;
  // SFP : cages plus larges, deux rangées.
  for (let i = 1; i <= nSfp; i++) {
    const col = Math.floor((i - 1) / 2), haut = (i - 1) % 2 === 0;
    ports.push({ id: nomDe("sfp", i), type: "sfp", x: x + col * (PAS + 0.12) + (PW + 0.1) / 2, y: haut ? RANG_HAUT : RANG_BAS, haut });
  }
  if (nSfp) x += Math.ceil(nSfp / 2) * (PAS + 0.12);
  // Ports au nom libre (« console », « mgmt »…) : à la suite.
  const connus = new Set(ports.map((p) => p.id.toLowerCase()));
  const autres = utilises.filter((p) => !connus.has(p.toLowerCase()) &&
    !ports.some((q) => { const l = lirePort(p); return l.n !== null && q.type === l.type && lirePort(q.id).n === l.n; }));
  if (autres.length) x += 0.35;
  autres.forEach((id, k) => { ports.push({ id, type: "autre", x: x + PW / 2, y: k % 2 ? RANG_BAS : RANG_HAUT, haut: k % 2 === 0 }); if (k % 2) x += PAS; });
  if (autres.length % 2) x += PAS;

  // Rattache chaque branchement à son port dessiné, même écrit autrement
  // (« Gi1/0/5 » sur le port 5).
  const parId = new Map<string, Port>();
  ports.forEach((p) => parId.set(p.id, p));
  utilises.forEach((u) => {
    if (parId.has(u)) return;
    const l = lirePort(u);
    const q = ports.find((p) => p.type === l.type && lirePort(p.id).n === l.n) ?? ports.find((p) => p.id.toLowerCase() === u.toLowerCase());
    if (q) parId.set(u, q);
  });

  return { w: x + 0.45, h: FH, ports, parId, branches };
}

/** Le port d'un branchement, ou rien si l'équipement n'a pas de façade. */
export function portDe(f: Facade | undefined, id: string | undefined) {
  return f && id ? f.parId.get(id) : undefined;
}

/**
 * Le chemin vers la passerelle : de proche en proche jusqu'à une passerelle
 * ou un pare-feu, en notant le port de sortie de l'équipement de départ.
 */
export function cheminPasserelle(nom: string, inv: Inventaire): { passerelle: Equipement; via?: string; sauts: string[] } | null {
  const parNom = new Map(inv.equipements.map((e) => [e.nom, e]));
  const depart = parNom.get(nom);
  if (!depart || depart.genre === "passerelle" || depart.genre === "parefeu") return null;
  const prec = new Map<string, { de: string; port?: string }>();
  const file = [nom];
  const vus = new Set([nom]);
  while (file.length) {
    const n = file.shift()!;
    for (const l of inv.liaisons) {
      const [moi, autre, monPort] = l.a === n ? [l.a, l.b, l.portA] : l.b === n ? [l.b, l.a, l.portB] : [null, null, null];
      if (!moi || !autre || vus.has(autre)) continue;
      // On ne traverse pas un autre site pour trouver sa passerelle.
      if (parNom.get(autre)?.site !== depart.site) continue;
      vus.add(autre);
      prec.set(autre, { de: n, port: monPort ?? undefined });
      const e = parNom.get(autre)!;
      if (e.genre === "passerelle" || e.genre === "parefeu") {
        const sauts: string[] = [];
        let c = autre, via: string | undefined;
        while (c !== nom) { const p = prec.get(c)!; sauts.unshift(c); if (p.de === nom) via = p.port; c = p.de; }
        return { passerelle: e, via, sauts };
      }
      file.push(autre);
    }
  }
  return null;
}
