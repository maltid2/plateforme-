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
/** Le cadre d'un site, ou d'un lieu dans un site (point : "" pour le lieu central). */
export type Cadre = { type: "site" | "point"; nom: string; site: string; point?: string; x: number; y: number; w: number; h: number };
export type Disposition = {
  pos: Map<string, Point>;            // centre de chaque équipement
  facades: Map<string, Facade>;       // switchs, passerelles, pare-feu
  cadres: Cadre[]; largeur: number; hauteur: number;
};

/** Une carte d'équipement simple (caméra, poste…) : boîte + nom dessous. */
export const CARTE_W = 3.2, CARTE_H = 1.6, NOM_H = 1.0;
const MARGE = 1.6, ECART_SITES = 7, ENTETE = 1.4, ECART_NOEUDS = 0.7, ECART_RANGS = 3.4, LARGEUR_RANG = 64;

const NIVEAU_DEFAUT: Record<Genre, number> = {
  passerelle: 0, parefeu: 0, switch: 1, nvr: 2, serveur: 2, nas: 2, onduleur: 2,
  camera: 3, borne: 3, poste: 3, imprimante: 3, telephone: 3, autre: 3,
};

type Local = { pos: Map<string, Point>; w: number; h: number };

/** Dispose un site seul, origine en haut à gauche de son cadre. */
function disposerSite(eqs: Equipement[], inv: Inventaire, siteDe: Map<string, unknown>, facades: Map<string, Facade>): Local {
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
    // Un switch « branché sur » un autre switch n'est pas la tête : la tête est
    // celui qui ne remonte vers aucun autre (le cœur de réseau).
    const aFac = new Set(eqs.filter((e) => facades.has(e.nom)).map((e) => e.nom));
    const remonte = new Set(inv.liaisons.filter((l) => noms.has(l.a) && aFac.has(l.b) && aFac.has(l.a)).map((l) => l.a));
    const switchs = eqs.filter((e) => e.genre === "switch");
    const cands = switchs.filter((e) => !remonte.has(e.nom)).length ? switchs.filter((e) => !remonte.has(e.nom)) : switchs;
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
  // Un switch qui n'est pas relié à la tête de ce cadre (il remonte vers un
  // autre lieu, ou il est seul) est une tête lui aussi : il se pose en haut,
  // ses caméras dessous, et non au milieu des caméras d'un autre switch.
  const aFacade2 = new Set(eqs.filter((e) => facades.has(e.nom)).map((e) => e.nom));
  const remonteIci = new Set(inv.liaisons.filter((l) => noms.has(l.a) && noms.has(l.b) && aFacade2.has(l.a) && aFacade2.has(l.b)).map((l) => l.a));
  const niveauTete = racines.some((r) => r.genre === "passerelle" || r.genre === "parefeu") ? 1 : 0;
  eqs.filter((e) => !niveau.has(e.nom) && e.genre === "switch" && !remonteIci.has(e.nom)).forEach((e) => {
    if (niveau.has(e.nom)) return;
    niveau.set(e.nom, niveauTete);
    etendre([e.nom]);
  });
  // Ce qui reste prend le niveau habituel de son type.
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

/**
 * Range des blocs (sites, ou lieux d'un site) en grille. Le bloc le plus
 * relié aux autres prend la case centrale : les liaisons rayonnent depuis
 * lui au lieu de traverser toute la carte.
 */
function ranger(blocs: { cle: string; w: number; h: number }[], liens: Map<string, number>, ecart: number, prefere?: string) {
  const n = blocs.length;
  const cols = Math.max(1, Math.min(n, Math.ceil(Math.sqrt(n * 1.3))));
  const rows = Math.max(1, Math.ceil(n / cols));
  const cases = Array.from({ length: rows * cols }, (_, k) => ({ r: Math.floor(k / cols), c: k % cols })).slice(0, n);
  let hub = prefere !== undefined ? blocs.findIndex((b) => b.cle === prefere) : -1;
  if (hub < 0 && n > 2) {
    const max = Math.max(...blocs.map((b) => liens.get(b.cle) ?? 0));
    if (max >= 2) hub = blocs.findIndex((b) => (liens.get(b.cle) ?? 0) === max);
  }
  const caseDe: { r: number; c: number }[] = new Array(n);
  if (hub >= 0 && n > 2) {
    const cr = (rows - 1) / 2, cc = (cols - 1) / 2;
    const centre = cases.reduce((m, k) => (Math.hypot(k.r - cr, k.c - cc) < Math.hypot(m.r - cr, m.c - cc) ? k : m));
    caseDe[hub] = centre;
    const autres = cases.filter((k) => k !== centre);
    blocs.forEach((_, i) => { if (i !== hub) caseDe[i] = autres.shift()!; });
  } else blocs.forEach((_, i) => { caseDe[i] = cases[i]; });

  const largCol = new Array(cols).fill(0), hautRang = new Array(rows).fill(0);
  blocs.forEach((b, i) => {
    largCol[caseDe[i].c] = Math.max(largCol[caseDe[i].c], b.w);
    hautRang[caseDe[i].r] = Math.max(hautRang[caseDe[i].r], b.h);
  });
  const x0 = largCol.map((_, c) => largCol.slice(0, c).reduce((t, v) => t + v + ecart, 0));
  const y0 = hautRang.map((_, r) => hautRang.slice(0, r).reduce((t, v) => t + v + ecart, 0));
  const place = new Map<string, Point>();
  // Centré dans sa case : les colonnes n'ont pas toutes la même largeur.
  blocs.forEach((b, i) => {
    const { r, c } = caseDe[i];
    place.set(b.cle, { x: x0[c] + (largCol[c] - b.w) / 2, y: y0[r] + (hautRang[r] - b.h) / 2 });
  });
  const w = largCol.reduce((t, v) => t + v, 0) + ecart * (cols - 1);
  const h = hautRang.reduce((t, v) => t + v, 0) + ecart * (rows - 1);
  return { place, w, h };
}

const MARGE_SITE = 1.4, ENTETE_SITE = 2.2, ECART_POINTS = 3;

export function disposer(inv: Inventaire): Disposition {
  const tous = new Map(inv.equipements.map((e) => [e.nom, e]));
  const facades = new Map<string, Facade>();
  inv.equipements.forEach((e) => { if (aFacade(e)) facades.set(e.nom, facade(e, inv)); });
  const pos = new Map<string, Point>();
  const cadres: Cadre[] = [];

  // Chaque site : soit un seul bloc, soit plusieurs lieux (écoles, bâtiments)
  // rangés dans le cadre du site, le lieu central au milieu.
  const sites = inv.sites.map((s) => {
    const eqs = inv.equipements.filter((e) => e.site === s.nom);
    const points = [...new Set(eqs.map((e) => e.point ?? ""))];
    if (points.length <= 1 && !points[0]) {
      const l = disposerSite(eqs, inv, tous, facades);
      return {
        cle: s.nom, w: l.w, h: l.h,
        poser: (x: number, y: number) => {
          l.pos.forEach((p, nom) => pos.set(nom, { x: x + p.x, y: y + p.y }));
          cadres.push({ type: "site", nom: s.nom, site: s.nom, x, y, w: l.w, h: l.h });
        },
      };
    }
    const locaux = new Map(points.map((p) => [p, disposerSite(eqs.filter((e) => (e.point ?? "") === p), inv, tous, facades)]));
    const liens = new Map<string, number>();
    inv.liaisons.forEach((l) => {
      const a = tous.get(l.a), b = tous.get(l.b);
      if (a?.site !== s.nom || b?.site !== s.nom || (a.point ?? "") === (b.point ?? "")) return;
      [a.point ?? "", b.point ?? ""].forEach((k) => liens.set(k, (liens.get(k) ?? 0) + 1));
    });
    const r = ranger(points.map((p) => ({ cle: p, w: locaux.get(p)!.w, h: locaux.get(p)!.h })), liens, ECART_POINTS,
      points.includes("") ? "" : undefined);
    const w = r.w + MARGE_SITE * 2, h = r.h + MARGE_SITE * 2 + ENTETE_SITE;
    return {
      cle: s.nom, w, h,
      poser: (x: number, y: number) => {
        cadres.push({ type: "site", nom: s.nom, site: s.nom, x, y, w, h });
        points.forEach((p) => {
          const l = locaux.get(p)!, o = r.place.get(p)!;
          const px = x + MARGE_SITE + o.x, py = y + ENTETE_SITE + MARGE_SITE + o.y;
          l.pos.forEach((q, nom) => pos.set(nom, { x: px + q.x, y: py + q.y }));
          cadres.push({ type: "point", nom: p || "Central", point: p, site: s.nom, x: px, y: py, w: l.w, h: l.h });
        });
      },
    };
  });

  const liensSite = new Map<string, number>();
  inv.liaisons.forEach((l) => {
    const a = tous.get(l.a)?.site, b = tous.get(l.b)?.site;
    if (a && b && a !== b) { liensSite.set(a, (liensSite.get(a) ?? 0) + 1); liensSite.set(b, (liensSite.get(b) ?? 0) + 1); }
  });
  const r = ranger(sites, liensSite, ECART_SITES);
  sites.forEach((s) => { const o = r.place.get(s.cle)!; s.poser(o.x, o.y); });

  const largeur = Math.max(1, ...cadres.map((c) => c.x + c.w));
  const hauteur = Math.max(1, ...cadres.map((c) => c.y + c.h));
  return { pos, facades, cadres, largeur, hauteur };
}
