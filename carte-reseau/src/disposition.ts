/**
 * Placement automatique : personne ne pose les équipements à la main.
 *
 * Dans chaque site, l'arbre part de l'équipement de tête : la passerelle ou
 * le pare-feu s'il y en a un, sinon le switch qui remonte vers les autres
 * sites. Le niveau d'un équipement est sa distance en liaisons depuis la
 * tête ; dans un niveau, chacun se range sous son parent pour que les câbles
 * ne se croisent pas.
 *
 * Les sites forment ensuite une grille commune ; le site le plus relié aux
 * autres (le siège, en général) prend la case du centre, pour que les
 * liaisons inter-sites rayonnent au lieu de traverser toute la carte.
 *
 * Mêmes coordonnées pour la 2D et la 3D (x vers la droite, y vers le bas → z).
 */
import { aFacade, facade, FH, type Facade } from "./facade.ts";
import type { Equipement, Genre, Inventaire } from "./saisie.ts";

export type Point = { x: number; y: number };
export type Cadre = { nom: string; x: number; y: number; w: number; h: number };
export type Disposition = {
  pos: Map<string, Point>;            // centre de chaque équipement
  facades: Map<string, Facade>;       // switchs, passerelles, pare-feu
  cadres: Cadre[]; largeur: number; hauteur: number;
};

/** Une carte d'équipement simple (caméra, poste…) : boîte + nom dessous. */
export const CARTE_W = 3.2, CARTE_H = 1.6, NOM_H = 1.0;
const MARGE = 2.4, ECART_SITES = 7, ENTETE = 1.6, ECART_NOEUDS = 0.7, ECART_RANGS = 3.4, LARGEUR_RANG = 64;

const NIVEAU_DEFAUT: Record<Genre, number> = {
  passerelle: 0, parefeu: 0, switch: 1, nvr: 2, serveur: 2, nas: 2, onduleur: 2,
  camera: 3, borne: 3, poste: 3, imprimante: 3, telephone: 3, autre: 3,
};

type Local = { pos: Map<string, Point>; w: number; h: number };

/** Dispose un site seul, origine en haut à gauche de son cadre. */
function disposerSite(eqs: Equipement[], inv: Inventaire, siteDe: Map<string, string>, facades: Map<string, Facade>): Local {
  const largeurDe = (e: Equipement) => facades.get(e.nom)?.w ?? CARTE_W;
  const hauteurDe = (e: Equipement) => (facades.has(e.nom) ? FH + 0.7 : CARTE_H + NOM_H);
  const noms = new Set(eqs.map((e) => e.nom));
  const voisins = new Map<string, string[]>(eqs.map((e) => [e.nom, []]));
  const versAilleurs = new Map<string, number>(eqs.map((e) => [e.nom, 0]));
  inv.liaisons.forEach((l) => {
    if (noms.has(l.a) && noms.has(l.b)) { voisins.get(l.a)!.push(l.b); voisins.get(l.b)!.push(l.a); }
    else if (noms.has(l.a) && siteDe.has(l.b)) versAilleurs.set(l.a, versAilleurs.get(l.a)! + 1);
    else if (noms.has(l.b) && siteDe.has(l.a)) versAilleurs.set(l.b, versAilleurs.get(l.b)! + 1);
  });

  // Tête du site : passerelle / pare-feu ; sinon l'équipement qui remonte
  // vers les autres sites, puis celui qui porte le plus de switchs.
  let racines = eqs.filter((e) => e.genre === "passerelle" || e.genre === "parefeu");
  if (!racines.length) {
    const genreDe = new Map(eqs.map((e) => [e.nom, e.genre]));
    const score = (e: Equipement) =>
      versAilleurs.get(e.nom)! * 1000 +
      voisins.get(e.nom)!.filter((v) => genreDe.get(v) === "switch").length * 10 +
      voisins.get(e.nom)!.length;
    const cands = eqs.filter((e) => e.genre === "switch");
    const pool = cands.length ? cands : eqs;
    const max = pool.reduce<Equipement | null>((m, e) => (!m || score(e) > score(m) ? e : m), null);
    racines = max ? [max] : [];
  }

  // Parcours en largeur : niveau = distance à la tête.
  const niveau = new Map<string, number>();
  const parent = new Map<string, string>();
  const etendre = (depart: string[]) => {
    const file = [...depart];
    while (file.length) {
      const n = file.shift()!;
      for (const v of voisins.get(n)!) {
        if (niveau.has(v)) continue;
        niveau.set(v, niveau.get(n)! + 1);
        parent.set(v, n);
        file.push(v);
      }
    }
  };
  racines.forEach((r) => niveau.set(r.nom, 0));
  etendre(racines.map((r) => r.nom));
  // Ce qui n'est pas relié à la tête prend le niveau habituel de son type.
  eqs.forEach((e) => {
    if (niveau.has(e.nom)) return;
    niveau.set(e.nom, NIVEAU_DEFAUT[e.genre]);
    etendre([e.nom]);
  });

  // Chaque niveau se pose sous le précédent. Un équipement vise l'aplomb du
  // port où il est branché ; on le décale seulement s'il chevauche son voisin.
  const parNiveau = new Map<number, Equipement[]>();
  eqs.forEach((e) => {
    const n = niveau.get(e.nom)!;
    if (!parNiveau.has(n)) parNiveau.set(n, []);
    parNiveau.get(n)!.push(e);
  });
  const centre = new Map<string, Point>();
  const ancre = (e: Equipement): number | null => {
    const p = parent.get(e.nom);
    if (!p || !centre.has(p)) return null;
    const c = centre.get(p)!, f = facades.get(p);
    if (!f) return c.x;
    const l = inv.liaisons.find((x) => (x.a === p && x.b === e.nom) || (x.b === p && x.a === e.nom));
    const port = l ? f.parId.get((l.a === p ? l.portA : l.portB) ?? "") : undefined;
    return port ? c.x - f.w / 2 + port.x : c.x;
  };
  let y = 0;
  [...parNiveau.keys()].sort((a, b) => a - b).forEach((n) => {
    const liste = parNiveau.get(n)!.map((e, i) => ({ e, i, v: ancre(e) }));
    let suivant = 0;
    liste.forEach((it) => { if (it.v === null) it.v = (suivant += 1) * 3; });
    liste.sort((a, b) => a.v! - b.v! || a.i - b.i);
    // Rangées : on coupe quand la largeur dépasse ce qu'on lit d'un coup d'œil.
    const rangees: typeof liste[] = [[]];
    let larg = 0;
    liste.forEach((it) => {
      const w = largeurDe(it.e) + ECART_NOEUDS;
      if (larg + w > LARGEUR_RANG && rangees[rangees.length - 1].length) { rangees.push([]); larg = 0; }
      rangees[rangees.length - 1].push(it);
      larg += w;
    });
    rangees.forEach((rg) => {
      const xs: number[] = [];
      let droite = -Infinity;
      rg.forEach((it) => {
        const w = largeurDe(it.e);
        const x = Math.max(it.v!, droite + ECART_NOEUDS + w / 2);
        xs.push(x);
        droite = x + w / 2;
      });
      // Le décalage dû aux chevauchements se répartit des deux côtés.
      const derive = rg.reduce((t, it, k) => t + (xs[k] - it.v!), 0) / Math.max(1, rg.length);
      const hRang = Math.max(...rg.map((it) => hauteurDe(it.e)));
      rg.forEach((it, k) => centre.set(it.e.nom, { x: xs[k] - derive, y: y + hRang / 2 }));
      y += hRang + ECART_RANGS;
    });
  });

  const gauches = eqs.map((e) => centre.get(e.nom)!.x - largeurDe(e) / 2);
  const droites = eqs.map((e) => centre.get(e.nom)!.x + largeurDe(e) / 2);
  const x0 = Math.min(...gauches, 0), x1 = Math.max(...droites, 0);
  const contenuW = x1 - x0, contenuH = Math.max(0, y - ECART_RANGS);
  const w = Math.max(contenuW + MARGE * 2, 14), h = contenuH + MARGE * 2 + ENTETE;
  const pos = new Map<string, Point>();
  centre.forEach((p, nom) => pos.set(nom, { x: p.x - x0 + (w - contenuW) / 2, y: p.y + MARGE + ENTETE }));
  return { pos, w, h };
}

export function disposer(inv: Inventaire): Disposition {
  const siteDe = new Map(inv.equipements.map((e) => [e.nom, e.site]));
  const facades = new Map<string, Facade>();
  inv.equipements.forEach((e) => { if (aFacade(e)) facades.set(e.nom, facade(e, inv)); });
  const locaux = inv.sites.map((s) => disposerSite(inv.equipements.filter((e) => e.site === s.nom), inv, siteDe, facades));
  const n = inv.sites.length;

  // Le site le plus relié aux autres prend la case centrale.
  const liensSite = new Map(inv.sites.map((s) => [s.nom, 0]));
  inv.liaisons.forEach((l) => {
    const a = siteDe.get(l.a), b = siteDe.get(l.b);
    if (a && b && a !== b) { liensSite.set(a, liensSite.get(a)! + 1); liensSite.set(b, liensSite.get(b)! + 1); }
  });
  const cols = Math.max(1, Math.min(n, Math.ceil(Math.sqrt(n * 1.3))));
  const rows = Math.max(1, Math.ceil(n / cols));
  const cases = Array.from({ length: rows * cols }, (_, k) => ({ r: Math.floor(k / cols), c: k % cols }));
  let hub = -1;
  if (n > 2) {
    const max = Math.max(...liensSite.values());
    if (max >= 2) hub = inv.sites.findIndex((s) => liensSite.get(s.nom) === max);
  }
  const caseDe: { r: number; c: number }[] = new Array(n);
  if (hub >= 0) {
    // Case centrale de la grille (en restant dans les cases occupées).
    const cr = (rows - 1) / 2, cc = (cols - 1) / 2;
    const libres = cases.slice(0, n);
    const centre = libres.reduce((m, k) => (Math.hypot(k.r - cr, k.c - cc) < Math.hypot(m.r - cr, m.c - cc) ? k : m));
    caseDe[hub] = centre;
    const autres = libres.filter((k) => k !== centre);
    inv.sites.forEach((_, i) => { if (i !== hub) caseDe[i] = autres.shift()!; });
  } else inv.sites.forEach((_, i) => { caseDe[i] = cases[i]; });

  // Largeur de chaque colonne, hauteur de chaque rangée.
  const largCol = new Array(cols).fill(0), hautRang = new Array(rows).fill(0);
  locaux.forEach((l, i) => {
    largCol[caseDe[i].c] = Math.max(largCol[caseDe[i].c], l.w);
    hautRang[caseDe[i].r] = Math.max(hautRang[caseDe[i].r], l.h);
  });
  const x0 = largCol.map((_, c) => largCol.slice(0, c).reduce((t, v) => t + v + ECART_SITES, 0));
  const y0 = hautRang.map((_, r) => hautRang.slice(0, r).reduce((t, v) => t + v + ECART_SITES, 0));

  const pos = new Map<string, Point>();
  const cadres: Cadre[] = inv.sites.map((s, i) => {
    const l = locaux[i], { r, c } = caseDe[i];
    // Centré dans sa case : les colonnes n'ont pas toutes la même largeur.
    const x = x0[c] + (largCol[c] - l.w) / 2, y = y0[r] + (hautRang[r] - l.h) / 2;
    l.pos.forEach((p, nom) => pos.set(nom, { x: x + p.x, y: y + p.y }));
    return { nom: s.nom, x, y, w: l.w, h: l.h };
  });

  const largeur = Math.max(1, ...cadres.map((c) => c.x + c.w));
  const hauteur = Math.max(1, ...cadres.map((c) => c.y + c.h));
  return { pos, facades, cadres, largeur, hauteur };
}
