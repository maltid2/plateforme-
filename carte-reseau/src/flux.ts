/**
 * Flux vidéo : par où passe la vidéo de chaque caméra, et combien.
 *
 * Chaque caméra envoie son flux vers son archiveur (celui que donne Genetec,
 * sinon le serveur vidéo le plus proche sur la carte). On suit le chemin le
 * plus court sur les liaisons de la carte et on additionne les débits sur
 * chaque tronçon (deux switchs reliés par plusieurs câbles = un tronçon
 * agrégé). Le débit d'une caméra vient de l'export Genetec (configuration des
 * flux) ; à défaut il est estimé (DEBIT_ESTIME_KBPS), et c'est signalé.
 *
 * On en tire : la charge de chaque tronçon et de chaque archiveur (si la
 * vitesse est connue : libellé « 1G », « 10G » ou nom du port Gi / Te…),
 * les caméras à fort débit, et les points uniques de panne : un tronçon dont
 * la coupure isole des caméras de leur archiveur.
 */
import type { Equipement, Genre, Inventaire, Liaison } from "./saisie.ts";
import type { Comparaison } from "./genetec.ts";

/** Débit retenu pour une caméra sans chiffre Genetec : 1080p, H.264, 15 images/s. */
export const DEBIT_ESTIME_KBPS = 4000;
/** Au-delà, le débit d'une caméra mérite un coup d'œil au profil d'encodage. */
export const DEBIT_FORT_KBPS = 8000;
/** Nombre de caméras à partir duquel un lien unique mérite d'être doublé. */
export const SEUIL_REDONDANCE = 4;

export type Troncon = {
  a: string; b: string;
  /** Les ports, côté a → côté b, pour chaque câble. */
  ports: string[];
  capaciteMbps?: number;
  kbps: number; cameras: number; estimees: number;
  /** En % de la capacité, si elle est connue. */
  charge?: number;
};
export type ChargeArchiveur = { nom: string; eq?: string; cameras: number; kbps: number; capaciteMbps?: number; charge?: number };
/** Un switch dont les caméras ne tiennent qu'à un seul tronçon. */
export type Dependance = {
  sw: string; vers: string; port?: string; cameras: number; kbps: number;
  /** Câbles déjà en place sur ce tronçon (2 et plus : agrégés). */
  cables: number;
  /** Le switch où brancher un 2e lien : un switch qui rejoint l'archiveur sans passer par `vers` ; sinon `vers` (2e câble agrégé). */
  secours: string;
};
export type BilanFlux = {
  /** D'où viennent les débits. */
  source: "genetec" | "mixte" | "estimation";
  /** Un archiveur (ou serveur vidéo) est-il sur la carte ? Sans lui, pas de chemin. */
  destination: boolean;
  cameras: number; estimees: number; totalKbps: number;
  /** Les tronçons entre équipements réseau et serveurs (pas les câbles des caméras), du plus chargé au moins chargé. */
  troncons: Troncon[];
  archiveurs: ChargeArchiveur[];
  sansChemin: string[];
  fortes: { nom: string; kbps: number }[];
  dependances: Dependance[];
};

const RESEAU: Genre[] = ["switch", "passerelle", "parefeu", "borne"];
const SERVEURS: Genre[] = ["nvr", "serveur", "nas"];
const plier = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const cle = (a: string, b: string) => (a < b ? `${a}§${b}` : `${b}§${a}`);

/** Vitesse d'un câble en Mb/s : son libellé (« 10G », « 1 Gb/s », « 100M »), sinon le nom d'un de ses ports. */
export function capaciteLien(l: Liaison): number | undefined {
  const m = String(l.libelle ?? "").match(/(\d+(?:[.,]\d+)?)\s*([GM])/i);
  if (m) return Number(m[1].replace(",", ".")) * (/g/i.test(m[2]) ? 1000 : 1);
  for (const p of [l.portA, l.portB]) {
    const t = String(p ?? "").toLowerCase();
    if (/^(hu|hundred)/.test(t)) return 100000;
    if (/^(fo|forty)/.test(t)) return 40000;
    if (/^(tf|twentyfive)/.test(t)) return 25000;
    if (/^(te|tengig|xe-|sfp-?sfpplus|sfp\+)/.test(t)) return 10000;
    if (/^(fi|five)/.test(t)) return 5000;
    if (/^(tw|twogig)/.test(t)) return 2500;
    if (/^(gi|ge-|gigabit|ether)/.test(t)) return 1000;
    if (/^(fa|fast)/.test(t)) return 100;
  }
  return undefined;
}

export function analyserFlux(inv: Inventaire, cg: Comparaison): BilanFlux {
  const parNom = new Map(inv.equipements.map((e) => [e.nom, e]));
  const genre = (n: string) => parNom.get(n)?.genre ?? "autre";
  const cameras = inv.equipements.filter((e) => e.genre === "camera");
  const serveurs = inv.equipements.filter((e) => SERVEURS.includes(e.genre));

  // Tronçons : les câbles entre deux mêmes équipements sont regroupés (agrégation).
  const troncons = new Map<string, { a: string; b: string; liens: Liaison[] }>();
  inv.liaisons.forEach((l) => {
    if (l.a === l.b) return;
    const k = cle(l.a, l.b);
    const t = troncons.get(k) ?? { a: l.a, b: l.b, liens: [] };
    t.liens.push(l); troncons.set(k, t);
  });
  const voisins = new Map<string, Set<string>>();
  troncons.forEach((t) => {
    voisins.set(t.a, (voisins.get(t.a) ?? new Set()).add(t.b));
    voisins.set(t.b, (voisins.get(t.b) ?? new Set()).add(t.a));
  });

  /** Parcours en largeur depuis `depart` ; on ne traverse que les équipements réseau. `sauf` : un tronçon coupé. */
  const parcours = (depart: string, sauf?: string) => {
    const parent = new Map<string, string | null>([[depart, null]]);
    const file = [depart];
    while (file.length) {
      const n = file.shift()!;
      if (n !== depart && !RESEAU.includes(genre(n))) continue;   // une caméra, un poste : fin de chemin
      voisins.get(n)?.forEach((v) => {
        if (parent.has(v) || (sauf && cle(n, v) === sauf)) return;
        parent.set(v, n); file.push(v);
      });
    }
    return parent;
  };
  const arbres = new Map(serveurs.map((s) => [s.nom, parcours(s.nom)]));
  const chemin = (de: string, arbre: Map<string, string | null>) => {
    const out: string[] = [];
    for (let n: string | null | undefined = de; n != null; n = arbre.get(n)) out.push(n);
    return out;
  };

  // L'archiveur de chaque caméra : celui de Genetec s'il est sur la carte, sinon le serveur le plus proche.
  const archiveurGenetec = new Map<string, string>();
  cg.rapproches.forEach((r) => { if (r.eq && r.unite.archiveur) archiveurGenetec.set(r.eq.nom, r.unite.archiveur); });
  const serveurNomme = (nom: string) => serveurs.find((s) => { const a = plier(s.nom), b = plier(nom); return a === b || (b.length >= 4 && (a.includes(b) || b.includes(a))) || s.ip?.split("/")[0] === nom; });
  const versServeur = (c: Equipement) => {
    const g = archiveurGenetec.get(c.nom), s = g ? serveurNomme(g) : undefined;
    if (s && arbres.get(s.nom)!.has(c.nom)) return s.nom;
    return [...arbres].filter(([, a]) => a.has(c.nom)).sort((x, y) => chemin(c.nom, x[1]).length - chemin(c.nom, y[1]).length)[0]?.[0];
  };

  const charge = new Map<string, { kbps: number; cameras: number; estimees: number }>();
  const parArchiveur = new Map<string, ChargeArchiveur>();
  const passages = new Map<string, Set<string>>();   // switch → caméras dont la vidéo le traverse
  const sansChemin: string[] = [];
  const cheminDe = new Map<string, string[]>();
  let total = 0, estimees = 0;
  cameras.forEach((c) => {
    const reel = cg.debitParCamera.get(c.nom);
    const kbps = reel ?? DEBIT_ESTIME_KBPS;
    total += kbps; if (reel === undefined) estimees++;
    const srv = versServeur(c);
    const nomArch = archiveurGenetec.get(c.nom) ?? srv;
    if (nomArch) {
      const a = parArchiveur.get(nomArch) ?? { nom: nomArch, eq: srv && (archiveurGenetec.has(c.nom) ? serveurNomme(nomArch)?.nom : srv), cameras: 0, kbps: 0 };
      a.cameras++; a.kbps += kbps; parArchiveur.set(nomArch, a);
    }
    if (!srv) { if (serveurs.length) sansChemin.push(c.nom); return; }
    const ch = chemin(c.nom, arbres.get(srv)!);
    cheminDe.set(c.nom, ch);
    for (let i = 0; i + 1 < ch.length; i++) {
      const x = charge.get(cle(ch[i], ch[i + 1])) ?? { kbps: 0, cameras: 0, estimees: 0 };
      x.kbps += kbps; x.cameras++; if (reel === undefined) x.estimees++;
      charge.set(cle(ch[i], ch[i + 1]), x);
      if (i > 0 && genre(ch[i]) === "switch") passages.set(ch[i], (passages.get(ch[i]) ?? new Set()).add(c.nom));
    }
  });

  const capacite = (t: { liens: Liaison[] }) => {
    const c = t.liens.map(capaciteLien);
    return c.every((x) => x !== undefined) ? c.reduce((s, x) => s! + x!, 0) : undefined;
  };
  const pc = (kbps: number, mbps?: number) => (mbps ? Math.round(kbps / 10 / mbps) : undefined);
  const infra = (k: string) => { const t = troncons.get(k)!; return genre(t.a) !== "camera" && genre(t.b) !== "camera"; };
  const liste: Troncon[] = [...charge].filter(([k]) => infra(k)).map(([k, x]) => {
    const t = troncons.get(k)!;
    const cap = capacite(t);
    return { a: t.a, b: t.b, ports: t.liens.map((l) => (l.a === t.a ? `${l.portA ?? "?"} → ${l.portB ?? "?"}` : `${l.portB ?? "?"} → ${l.portA ?? "?"}`)), capaciteMbps: cap, ...x, charge: pc(x.kbps, cap) };
  }).sort((x, y) => (y.charge ?? -1) - (x.charge ?? -1) || y.kbps - x.kbps);

  // Charge de la carte réseau de l'archiveur : le tronçon qui le relie au réseau.
  parArchiveur.forEach((a) => {
    if (!a.eq) return;
    const lien = [...troncons.values()].filter((t) => t.a === a.eq || t.b === a.eq);
    if (lien.length !== 1) return;
    a.capaciteMbps = capacite(lien[0]); a.charge = pc(a.kbps, a.capaciteMbps);
  });

  // Points uniques de panne : le tronçon montant d'un switch, si le couper isole ses caméras de l'archiveur.
  const dependances: Dependance[] = [];
  passages.forEach((cams, sw) => {
    // Le tronçon montant : celui qu'emprunte la vidéo en sortant du switch (le même pour toutes, chemins en arbre).
    const ch = cheminDe.get([...cams][0])!;
    const i = ch.indexOf(sw), haut = ch[i + 1], srv = ch[ch.length - 1];
    if (!haut || SERVEURS.includes(genre(haut))) return;
    if (cams.size < SEUIL_REDONDANCE) return;
    const coupe = cle(sw, haut);
    if (parcours(sw, coupe).has(srv)) return;   // il existe déjà un autre chemin
    // Un secours utile rejoint l'archiveur sans passer par le switch d'en face.
    const cote = parcours(srv, coupe);
    const autres = [...cote.keys()].filter((n) => genre(n) === "switch" && n !== haut && n !== sw && !chemin(n, cote).includes(haut))
      .sort((x, y) => (voisins.get(y)?.size ?? 0) - (voisins.get(x)?.size ?? 0));
    const t = troncons.get(coupe)!;
    const l = t.liens[0];
    if (t.liens.length > 1 && !autres.length) return;   // déjà doublé, et pas d'autre chemin possible
    dependances.push({ sw, vers: haut, port: l.a === sw ? l.portA : l.portB, cameras: cams.size, cables: t.liens.length,
      kbps: [...cams].reduce((s, c) => s + (cg.debitParCamera.get(c) ?? DEBIT_ESTIME_KBPS), 0), secours: autres[0] ?? haut });
  });
  // Sans archiveur sur la carte, pas de chemin : on repère au moins les switchs à caméras qui n'ont qu'un lien montant.
  if (!serveurs.length) {
    const parSw = new Map<string, number>();
    cameras.forEach((c) => {
      const l = inv.liaisons.find((x) => (x.a === c.nom && genre(x.b) === "switch") || (x.b === c.nom && genre(x.a) === "switch"));
      if (l) { const sw = l.a === c.nom ? l.b : l.a; parSw.set(sw, (parSw.get(sw) ?? 0) + 1); }
    });
    parSw.forEach((n, sw) => {
      const montants = [...troncons.values()].filter((t) => (t.a === sw || t.b === sw) && RESEAU.includes(genre(t.a === sw ? t.b : t.a)));
      if (n < SEUIL_REDONDANCE || montants.length !== 1 || montants[0].liens.length > 1) return;
      const t = montants[0], l = t.liens[0], haut = t.a === sw ? t.b : t.a;
      dependances.push({ sw, vers: haut, port: l.a === sw ? l.portA : l.portB, cameras: n, cables: t.liens.length, kbps: n * DEBIT_ESTIME_KBPS, secours: haut });
    });
  }
  dependances.sort((a, b) => b.cameras - a.cameras);

  const fortes = [...cg.debitParCamera].filter(([n, k]) => k > DEBIT_FORT_KBPS && parNom.get(n)?.genre === "camera")
    .map(([nom, kbps]) => ({ nom, kbps })).sort((a, b) => b.kbps - a.kbps);
  return {
    source: !estimees ? "genetec" : estimees === cameras.length ? "estimation" : "mixte",
    destination: serveurs.length > 0,
    cameras: cameras.length, estimees, totalKbps: total,
    troncons: liste,
    archiveurs: [...parArchiveur.values()].sort((a, b) => b.kbps - a.kbps),
    sansChemin, fortes, dependances,
  };
}

/** « 12 288 kb/s » → « 12,3 Mb/s ». */
export const mbps = (kbps: number) => `${(kbps / 1000).toFixed(kbps >= 100000 ? 0 : 1).replace(".", ",")} Mb/s`;
/** 1000 → « 1 Gb/s », 100 → « 100 Mb/s ». */
export const vitesse = (mbps: number) => (mbps >= 1000 ? `${String(mbps / 1000).replace(".", ",")} Gb/s` : `${mbps} Mb/s`);
