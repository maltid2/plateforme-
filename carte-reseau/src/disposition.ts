/**
 * Placement automatique : personne ne pose les équipements à la main.
 *
 * Dans chaque site, l'arbre part de la passerelle (ou du pare-feu) : les
 * switchs viennent en dessous, puis ce qui est branché sur eux. Le niveau
 * d'un équipement est sa distance en liaisons depuis la passerelle ; dans un
 * niveau, chacun se range sous son parent pour que les câbles ne se croisent
 * pas. Les sites se posent côte à côte. Mêmes coordonnées pour la 2D et la
 * 3D (x vers la droite, y vers le bas → z en 3D).
 */
import type { Equipement, Genre, Inventaire } from "./saisie";

export type Point = { x: number; y: number };
export type Cadre = { nom: string; x: number; y: number; w: number; h: number };
export type Disposition = { pos: Map<string, Point>; cadres: Cadre[]; largeur: number; hauteur: number };

const PAS_X = 3.4, PAS_Y = 4.2, PAR_RANG = 10, MARGE = 2.4, ECART_SITES = 5;

const NIVEAU_DEFAUT: Record<Genre, number> = {
  passerelle: 0, parefeu: 0, switch: 1, nvr: 2, serveur: 2, nas: 2, onduleur: 2,
  camera: 3, borne: 3, poste: 3, imprimante: 3, telephone: 3, autre: 3,
};

export function disposer(inv: Inventaire): Disposition {
  const pos = new Map<string, Point>();
  const cadres: Cadre[] = [];
  let curseurX = 0, curseurY = 0, hauteurRangee = 0;
  const LARGEUR_MAX = 110;

  for (const site of inv.sites) {
    const eqs = inv.equipements.filter((e) => e.site === site.nom);
    const noms = new Set(eqs.map((e) => e.nom));
    const voisins = new Map<string, string[]>(eqs.map((e) => [e.nom, []]));
    inv.liaisons.forEach((l) => {
      if (noms.has(l.a) && noms.has(l.b)) { voisins.get(l.a)!.push(l.b); voisins.get(l.b)!.push(l.a); }
    });

    // Racines : passerelles et pare-feu ; à défaut, le switch le plus relié.
    let racines = eqs.filter((e) => e.genre === "passerelle" || e.genre === "parefeu");
    if (!racines.length) {
      const cands = eqs.filter((e) => e.genre === "switch");
      const pool = cands.length ? cands : eqs;
      const max = pool.reduce<Equipement | null>((m, e) => (!m || voisins.get(e.nom)!.length > voisins.get(m.nom)!.length ? e : m), null);
      racines = max ? [max] : [];
    }

    // Parcours en largeur : niveau = distance à la racine.
    const niveau = new Map<string, number>();
    const parent = new Map<string, string>();
    const file: string[] = [];
    racines.forEach((r) => { niveau.set(r.nom, 0); file.push(r.nom); });
    while (file.length) {
      const n = file.shift()!;
      for (const v of voisins.get(n)!) {
        if (niveau.has(v)) continue;
        niveau.set(v, niveau.get(n)! + 1);
        parent.set(v, n);
        file.push(v);
      }
    }
    // Ce qui n'est relié à rien prend le niveau habituel de son type, et
    // ses éventuels voisins (îlot isolé) suivent.
    eqs.forEach((e) => {
      if (niveau.has(e.nom)) return;
      niveau.set(e.nom, NIVEAU_DEFAUT[e.genre]);
      const f = [e.nom];
      while (f.length) {
        const n = f.shift()!;
        for (const v of voisins.get(n)!) if (!niveau.has(v)) { niveau.set(v, niveau.get(n)! + 1); parent.set(v, n); f.push(v); }
      }
    });

    // Rangement niveau par niveau, chacun sous son parent.
    const parNiveau = new Map<number, Equipement[]>();
    eqs.forEach((e) => {
      const n = niveau.get(e.nom)!;
      if (!parNiveau.has(n)) parNiveau.set(n, []);
      parNiveau.get(n)!.push(e);
    });
    const ordre = new Map<string, number>();
    const local = new Map<string, Point>();
    let y = 0, largeur = 0;
    [...parNiveau.keys()].sort((a, b) => a - b).forEach((n) => {
      const liste = parNiveau.get(n)!;
      liste.sort((a, b) => {
        const pa = ordre.get(parent.get(a.nom) ?? "") ?? Infinity, pb = ordre.get(parent.get(b.nom) ?? "") ?? Infinity;
        return pa - pb || eqs.indexOf(a) - eqs.indexOf(b);
      });
      // Un niveau trop large (40 caméras sur un switch) passe sur plusieurs rangs.
      for (let i = 0; i < liste.length; i += PAR_RANG) {
        const rang = liste.slice(i, i + PAR_RANG);
        rang.forEach((e, k) => {
          ordre.set(e.nom, i + k);
          local.set(e.nom, { x: k * PAS_X, y });
        });
        largeur = Math.max(largeur, (rang.length - 1) * PAS_X);
        y += PAS_Y * (i + PAR_RANG < liste.length ? 0.75 : 1);
      }
    });
    const hauteur = Math.max(0, y - PAS_Y);

    // Chaque rang est centré sur la largeur du site.
    const rangs = new Map<number, string[]>();
    local.forEach((p, nom) => { const k = Math.round(p.y * 100); if (!rangs.has(k)) rangs.set(k, []); rangs.get(k)!.push(nom); });
    rangs.forEach((liste) => {
      const w = (liste.length - 1) * PAS_X;
      liste.forEach((nom) => { local.get(nom)!.x += (largeur - w) / 2; });
    });

    const w = Math.max(largeur + MARGE * 2, 12), h = hauteur + MARGE * 2 + 1.2;
    if (curseurX > 0 && curseurX + w > LARGEUR_MAX) { curseurX = 0; curseurY += hauteurRangee + ECART_SITES; hauteurRangee = 0; }
    const ox = curseurX + (w - largeur) / 2, oy = curseurY + MARGE + 1.2;
    local.forEach((p, nom) => pos.set(nom, { x: ox + p.x, y: oy + p.y }));
    cadres.push({ nom: site.nom, x: curseurX, y: curseurY, w, h });
    curseurX += w + ECART_SITES;
    hauteurRangee = Math.max(hauteurRangee, h);
  }

  const largeur = Math.max(1, ...cadres.map((c) => c.x + c.w));
  const hauteur = Math.max(1, ...cadres.map((c) => c.y + c.h));
  return { pos, cadres, largeur, hauteur };
}
