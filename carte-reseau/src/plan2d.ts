/**
 * Le plan 2D, en SVG.
 *
 * Les switchs, passerelles et pare-feu sont dessinés en façade, comme on les
 * voit dans la baie : oreilles de fixation, ports RJ45 par paires, cages SFP,
 * voyants. Chaque câble part du port écrit dans la saisie. Les autres
 * équipements (caméras, postes…) sont des cartes avec leur pictogramme.
 *
 * Molette : zoom. Glisser : déplacement. Clic : fiche. Survol d'un port :
 * ce qui y est branché.
 */
import { APPARENCE, COULEUR_MEDIA } from "./apparence.ts";
import { CARTE_H, CARTE_W, NOM_H, type Disposition, type Point } from "./disposition.ts";
import { FH, PH, PW, type Facade, type Port } from "./facade.ts";
import { PICTOS } from "./pictos.ts";
import type { Equipement, Inventaire, Liaison } from "./saisie.ts";

const NS = "http://www.w3.org/2000/svg";

type Rappels = { choisir: (nom: string | null) => void };
export type Plan2D = {
  afficher: (inv: Inventaire, d: Disposition, site: string | null) => void;
  selectionner: (nom: string | null, centrer?: boolean) => void;
  cadrer: (immediat?: boolean) => void;
  /** Le plan en SVG autonome ; « clair » : fond blanc pour l'impression et les documents. */
  exporter: (clair?: boolean, signature?: string) => string;
};

function el<K extends keyof SVGElementTagNameMap>(nom: K, attrs: Record<string, string | number> = {}, parent?: Element) {
  const e = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}
const texte = (parent: Element, t: string, attrs: Record<string, string | number>) => {
  const e = el("text", attrs, parent);
  e.textContent = t;
  return e;
};
const court = (s: string, n = 18) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Ce que le câble dit de lui-même au survol. */
const decrireLien = (l: Liaison) =>
  `${l.a}${l.portA ? `:${l.portA}` : ""} ↔ ${l.b}${l.portB ? `:${l.portB}` : ""}` +
  (l.mode ? ` · ${l.mode}` : "") + (l.vlans ? ` · VLAN ${l.vlans}` : "") + (l.libelle ? ` · ${l.libelle}` : "");

/** Dégradés et ombre partagés par le plan et par les textures 3D. */
const DEFS = `
    <linearGradient id="g-chassis" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a4350"/><stop offset="0.08" stop-color="#2b323c"/>
      <stop offset="0.92" stop-color="#1d232b"/><stop offset="1" stop-color="#14181e"/>
    </linearGradient>
    <linearGradient id="g-oreille" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#4a5361"/><stop offset="1" stop-color="#2c333d"/>
    </linearGradient>
    <linearGradient id="g-sfp" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9aa5b1"/><stop offset="1" stop-color="#5d6773"/>
    </linearGradient>
    <linearGradient id="g-carte" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#18202b"/><stop offset="1" stop-color="#111720"/>
    </linearGradient>
    <pattern id="g-grille" width="2" height="2" patternUnits="userSpaceOnUse">
      <path d="M 2 0 L 0 0 0 2" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="0.04"/>
    </pattern>
    <filter id="g-ombre" x="-10%" y="-20%" width="120%" height="160%">
      <feDropShadow dx="0" dy="0.18" stdDeviation="0.18" flood-color="#000" flood-opacity="0.55"/>
    </filter>`;

/* ---------------- façade ---------------- */

function dessinerFacade(g: SVGGElement, e: Equipement, f: Facade, inv: Inventaire) {
  const a = APPARENCE[e.genre];
  const x0 = -f.w / 2, y0 = -FH / 2;
  const corps = el("g", { filter: "url(#g-ombre)" }, g);
  // Oreilles de fixation en baie, avec leurs vis.
  [x0 - 0.42, x0 + f.w].forEach((ox) => {
    el("rect", { x: ox, y: y0 + 0.08, width: 0.42, height: FH - 0.16, rx: 0.06, fill: "url(#g-oreille)", stroke: "#1a1f26", "stroke-width": 0.03 }, corps);
    [0.42, FH - 0.42].forEach((oy) => el("circle", { cx: ox + 0.21, cy: y0 + oy, r: 0.09, fill: "#14181e", stroke: "#5b6573", "stroke-width": 0.025 }, corps));
  });
  el("rect", { class: "corps", x: x0, y: y0, width: f.w, height: FH, rx: 0.1, fill: "url(#g-chassis)", stroke: "#465060", "stroke-width": 0.04 }, corps);
  // Liseré de couleur du type et zone d'étiquette.
  el("rect", { x: x0 + 0.12, y: y0 + 0.16, width: 0.07, height: FH - 0.32, rx: 0.03, fill: a.couleur }, g);
  const modele = e.infos[0] ?? (e.genre === "switch" ? "Switch" : e.genre === "parefeu" ? "Pare-feu" : "Passerelle");
  texte(g, court(modele.toUpperCase(), 22), { x: x0 + 0.34, y: y0 + 0.46, "font-size": 0.21, fill: "#8B98A8", "font-weight": 700, "letter-spacing": 0.02 });
  texte(g, court(e.nom, 13), { x: x0 + 0.34, y: y0 + 0.98, "font-size": 0.42, fill: "#F5F7FA", "font-weight": 800 });
  texte(g, e.ip ?? "IP non renseignée", { x: x0 + 0.34, y: y0 + 1.38, "font-size": 0.27, fill: e.ip ? "#B9C3CF" : "#6B7A8C",
    "font-family": "ui-monospace, monospace" });
  // Voyants d'état.
  [0, 1].forEach((k) => el("circle", { cx: x0 + 0.4 + k * 0.2, cy: y0 + 1.7, r: 0.055, fill: "#3DDC97" }, g));
  // IP de la passerelle par défaut, sous l'IP de l'équipement.
  if (e.passerelleIp)
    texte(g, `GW ${e.passerelleIp}`, { x: x0 + 0.75, y: y0 + 1.75, "font-size": 0.17, fill: "#A99CFF", "font-family": "ui-monospace, monospace" });

  const parNom = new Map(inv.equipements.map((x) => [x.nom, x]));
  const brancheDe = new Map<Port, ReturnType<Facade["branches"]["get"]>>();
  f.branches.forEach((b, id) => { const p = f.parId.get(id); if (p) brancheDe.set(p, b); });

  f.ports.forEach((p) => {
    const br = brancheDe.get(p);
    const px = x0 + p.x, py = y0 + p.y;
    const gp = el("g", br ? { class: "port", "data-vers": br.vers } : { class: "port" }, g);
    const trunk = br?.liaison.mode === "trunk";
    // Fiche branchée : couleur du support pour un trunk (fibre orange, cuivre
    // bleu), sinon couleur de ce qui est au bout (caméra, poste…).
    const couleur = br ? (trunk ? COULEUR_MEDIA[br.liaison.media ?? "inconnu"] : APPARENCE[parNom.get(br.vers)?.genre ?? "autre"].couleur) : "";
    if (p.type === "sfp") {
      el("rect", { x: px - (PW + 0.1) / 2, y: py - PH / 2 - 0.02, width: PW + 0.1, height: PH + 0.04, rx: 0.03, fill: "url(#g-sfp)" }, gp);
      el("rect", { x: px - PW / 2 + 0.02, y: py - PH / 2 + 0.07, width: PW - 0.04, height: PH - 0.14, fill: br ? couleur : "#0b0e12" }, gp);
      if (br) el("rect", { x: px - 0.12, y: py - 0.05, width: 0.24, height: 0.1, fill: "#0b0e12", opacity: 0.6 }, gp);
    } else {
      const wan = p.type === "wan";
      el("rect", { x: px - PW / 2, y: py - PH / 2, width: PW, height: PH, rx: 0.03, fill: "#07090c",
        stroke: wan ? "#FF9F43" : "#5a6472", "stroke-width": 0.035 }, gp);
      // Encoche du loquet : en bas pour la rangée du haut, en haut pour celle du bas.
      const ny = p.haut ? py + PH / 2 - 0.1 : py - PH / 2;
      el("rect", { x: px - 0.09, y: ny, width: 0.18, height: 0.1, fill: "#1d232b" }, gp);
      // La fiche branchée : un capuchon de la couleur de ce qui est au bout.
      if (br) el("rect", { x: px - PW / 2 + 0.06, y: py - PH / 2 + 0.06, width: PW - 0.12, height: PH - 0.12, rx: 0.03, fill: couleur }, gp);
    }
    // Voyant de lien au-dessus (rangée haute) ou en dessous (rangée basse).
    const ly = p.haut ? py - PH / 2 - 0.1 : py + PH / 2 + 0.1;
    el("rect", { x: px - 0.07, y: ly - 0.035, width: 0.14, height: 0.07, fill: br ? (trunk ? "#FFD166" : "#3DDC97") : "#2a313b" }, gp);
    // Numéro du port : au-dessus de la rangée haute, en dessous de la basse.
    const ty = p.haut ? py - PH / 2 - 0.2 : py + PH / 2 + 0.33;
    texte(gp, court(p.id.replace(/^(Gi|Fa|Te)\d+\/\d+\//i, ""), 5), { x: px, y: ty, "text-anchor": "middle", "font-size": 0.15,
      fill: br ? "#F5F7FA" : "#6B7A8C", "font-weight": br ? 700 : 400, "font-family": "ui-monospace, monospace" });
    el("title", {}, gp).textContent = br
      ? `Port ${p.id} → ${br.vers}${br.portVers ? `:${br.portVers}` : ""}${br.liaison.mode ? ` · ${br.liaison.mode}` : ""}${br.liaison.vlans ? ` · VLAN ${br.liaison.vlans}` : ""}`
      : `Port ${p.id} · libre`;
  });
  const occupes = brancheDe.size, total = f.ports.filter((p) => p.type !== "autre").length;
  // À gauche, sous le nom : les câbles partent des ports, plus à droite.
  texte(g, `${occupes}/${total} ports utilisés`, { x: x0, y: y0 + FH + (e.baie ? 1.0 : 0.62), "font-size": 0.26, fill: "#6B7A8C" });
  if (e.baie) texte(g, `▤ baie ${e.baie}`, { x: x0, y: y0 + FH + 0.62, "font-size": 0.26, fill: "#A99CFF", "font-weight": 600 });
}

/* ---------------- carte simple ---------------- */

function dessinerCarte(g: SVGGElement, e: Equipement) {
  const a = APPARENCE[e.genre];
  const x0 = -CARTE_W / 2, y0 = -CARTE_H / 2;
  el("rect", { class: "corps", x: x0, y: y0, width: CARTE_W, height: CARTE_H, rx: 0.28, fill: "url(#g-carte)",
    stroke: a.couleur, "stroke-width": 0.06, filter: "url(#g-ombre)" }, g);
  el("rect", { x: x0 + 0.18, y: y0 + 0.2, width: 1.2, height: 1.2, rx: 0.22, fill: a.couleur, opacity: 0.14 }, g);
  const ic = el("g", { transform: `translate(${x0 + 0.33} ${y0 + 0.35}) scale(0.9)`, fill: "none", stroke: a.couleur,
    "stroke-width": 0.075, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
  ic.innerHTML = PICTOS[e.genre];
  texte(g, a.sigle, { x: x0 + 1.55, y: y0 + 0.62, "font-size": 0.34, "font-weight": 800, fill: a.couleur });
  texte(g, e.ip ?? "", { x: x0 + 1.55, y: y0 + 1.05, "font-size": 0.22, fill: "#B9C3CF", "font-family": "ui-monospace, monospace" });
  const vlan = e.kv.find(([k]) => /^vlan$/i.test(k))?.[1];
  if (vlan) texte(g, `VLAN ${vlan}`, { x: x0 + 1.55, y: y0 + 1.3, "font-size": 0.18, fill: "#8B98A8" });
  if (e.passerelleIp) texte(g, `GW ${e.passerelleIp}`, { x: x0 + 1.55, y: y0 + 1.5, "font-size": 0.16, fill: "#A99CFF", "font-family": "ui-monospace, monospace" });
  texte(g, court(e.nom), { class: "nom-carte", x: 0, y: y0 + CARTE_H + 0.5, "text-anchor": "middle", "font-size": 0.38, "font-weight": 600, fill: "#F5F7FA",
    stroke: "#0D1118", "stroke-width": 0.14, "paint-order": "stroke" });
}


/**
 * Une façade seule, en SVG autonome : la 3D la dessine sur un canvas et la
 * plaque sur l'avant du switch monté en baie. Même dessin qu'en 2D.
 */
export function svgFacade(e: Equipement, f: Facade, inv: Inventaire, largeurPx = 2048): string {
  const svg = el("svg", { xmlns: NS, viewBox: `${-f.w / 2} ${-FH / 2} ${f.w} ${FH}`,
    width: largeurPx, height: Math.round((largeurPx * FH) / f.w), "font-family": "Inter, Segoe UI, Arial, sans-serif" });
  el("defs", {}, svg).innerHTML = DEFS;
  const g = el("g", {}, svg) as SVGGElement;
  dessinerFacade(g, e, f, inv);
  return new XMLSerializer().serializeToString(svg);
}

/**
 * Version claire pour l'impression : fond blanc, cadres gris clair, textes
 * sombres. Les façades et les cartes d'équipement gardent leur aspect
 * (on reconnaît le matériel), seuls leurs noms passent en sombre.
 */
const CLAIR: Record<string, string> = {
  "#07090d": "#ffffff", "#0d1118": "#f4f6f8", "#141922": "#ffffff", "#0a0e14": "#eef1f4", "#0f141c": "#ffffff",
  "#f5f7fa": "#111418", "#8b98a8": "#56606c", "#e3f9ee": "#0d4f33", "#c2b9ff": "#4b3cc4",
  "rgba(255,255,255,0.11)": "#c5ccd4", "rgba(255,255,255,0.12)": "#c5ccd4", "rgba(141,124,255,0.09)": "rgba(141,124,255,0.12)",
  "rgba(61,220,151,0.28)": "#7fd6ae", "url(#g-grille)": "none",
};
function eclaircir(svg: SVGSVGElement) {
  svg.querySelectorAll<SVGElement>("*").forEach((n) => {
    const dansNoeud = !!n.closest(".noeud");
    if (dansNoeud && !n.classList.contains("nom-carte")) return;
    for (const a of ["fill", "stroke"]) {
      const v = n.getAttribute(a)?.toLowerCase().replace(/\s+/g, "");
      if (v && CLAIR[v]) n.setAttribute(a, CLAIR[v]);
    }
    // Gaine des câbles : sombre sur fond sombre, blanche sur fond blanc.
    if (n.tagName === "path" && n.getAttribute("stroke")?.toLowerCase() === "#f4f6f8") n.setAttribute("stroke", "#ffffff");
    if (n.classList.contains("nom-carte")) { n.setAttribute("fill", "#111418"); n.setAttribute("stroke", "#ffffff"); }
  });
}

export function creerPlan2D(hote: HTMLElement, cb: Rappels): Plan2D {
  const svg = el("svg", { xmlns: NS });
  hote.appendChild(svg);
  const defs = el("defs", {}, svg);
  defs.innerHTML = DEFS;
  el("rect", { fill: "#07090D", x: -1e5, y: -1e5, width: 2e5, height: 2e5 }, svg);
  el("rect", { fill: "url(#g-grille)", x: -1e5, y: -1e5, width: 2e5, height: 2e5 }, svg);
  const monde = el("g", {}, svg);

  let vb = { x: 0, y: 0, w: 10, h: 10 };
  let bornes = { x: 0, y: 0, w: 10, h: 10 };
  const noeuds = new Map<string, SVGGElement>();
  const liensDe = new Map<string, SVGElement[]>();
  let choisi: string | null = null;
  let pos = new Map<string, Point>();
  let cadresAffiches: Disposition["cadres"] = [];

  // Mini-carte et boutons de zoom : hors du SVG du plan, ils ne partent
  // jamais dans les exports.
  const outils = document.createElement("div");
  outils.className = "plan-outils";
  outils.innerHTML = `
    <div class="zooms" role="group" aria-label="Zoom">
      <button type="button" data-z="plus" title="Zoomer" aria-label="Zoomer">＋</button>
      <button type="button" data-z="moins" title="Dézoomer" aria-label="Dézoomer">−</button>
      <button type="button" data-z="tout" title="Tout afficher" aria-label="Tout afficher">⤢</button>
    </div>
    <svg class="minicarte" xmlns="${NS}" aria-label="Mini-carte : cliquer pour s'y rendre"><g class="mc-cadres"></g><rect class="mc-vue"/></svg>`;
  hote.appendChild(outils);
  const mini = outils.querySelector<SVGSVGElement>(".minicarte")!;
  const miniCadres = mini.querySelector<SVGGElement>(".mc-cadres")!;
  const miniVue = mini.querySelector<SVGRectElement>(".mc-vue")!;

  /**
   * Zoom intelligent : quand les ports deviennent trop petits pour être lus,
   * on passe en « résumé » — une carte lisible par site et par lieu, le
   * détail estompé dessous. En zoomant, le détail revient.
   */
  const SEUIL_RESUME = 8; // pixels par unité du plan
  const appliquer = () => {
    svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    const pxParUnite = (svg.clientWidth || 1) / vb.w;
    svg.classList.toggle("resume", pxParUnite < SEUIL_RESUME);
    miniVue.setAttribute("x", String(vb.x)); miniVue.setAttribute("y", String(vb.y));
    miniVue.setAttribute("width", String(vb.w)); miniVue.setAttribute("height", String(vb.h));
  };

  let anim = 0;
  /** Déplacement doux vers un cadre (x, y, w, h) ajusté au rapport de l'écran. */
  function allerA(cible: { x: number; y: number; w: number; h: number }, immediat = false) {
    const r = hote.getBoundingClientRect();
    const ar = (r.width || 1) / (r.height || 1);
    let { x, y, w, h } = cible;
    if (w / h < ar) { const nw = h * ar; x -= (nw - w) / 2; w = nw; } else { const nh = w / ar; y -= (nh - h) / 2; h = nh; }
    cancelAnimationFrame(anim);
    if (immediat) { vb = { x, y, w, h }; appliquer(); return; }
    const depart = { ...vb }, t0 = performance.now();
    const pas = () => {
      const t = Math.min(1, (performance.now() - t0) / 420);
      const k = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      vb = { x: depart.x + (x - depart.x) * k, y: depart.y + (y - depart.y) * k, w: depart.w + (w - depart.w) * k, h: depart.h + (h - depart.h) * k };
      appliquer();
      if (t < 1) anim = requestAnimationFrame(pas);
    };
    anim = requestAnimationFrame(pas);
  }
  function cadrer(immediat = true) {
    const m = 2;
    allerA({ x: bornes.x - m, y: bornes.y - m, w: bornes.w + 2 * m, h: bornes.h + 2 * m }, immediat);
  }

  /* ---------------- câbles ---------------- */

  /**
   * Point d'attache d'une extrémité. Sur une façade : le port lui-même, puis
   * une sortie par le bord ; un port de la rangée du haut qui sort par le bas
   * (ou l'inverse) se décale pour ne pas recouvrir le câble du port voisin de
   * la même colonne. Sur une carte : le bord, décalé de `dx` quand plusieurs
   * câbles arrivent sur la même carte (sinon ils se rejoignent en un point).
   */
  function attache(nom: string, port: string | undefined, versLeBas: boolean, d: Disposition, dx = 0) {
    const c = d.pos.get(nom)!;
    const f = d.facades.get(nom);
    const p = f && port ? f.parId.get(port) : undefined;
    const dir = versLeBas ? 1 : -1;
    if (f && p) {
      const x = c.x - f.w / 2 + p.x;
      const traverse = versLeBas ? p.haut : !p.haut;
      return { x, y: c.y - FH / 2 + p.y, sx: x + (traverse ? -0.17 : 0), bord: c.y + dir * FH / 2, dir, port: p.id, decale: !!traverse };
    }
    const h = f ? FH : CARTE_H;
    // Sous une carte, le nom de l'équipement : le câble et son étiquette passent dessous.
    const sousNom = !f && versLeBas ? NOM_H : 0;
    return { x: c.x + dx, y: c.y + dir * h * 0.3, sx: c.x + dx, bord: c.y + dir * h / 2 + sousNom, dir, port: port ?? "", decale: false };
  }

  type Bout = ReturnType<typeof attache>;
  /** Longueur de la sortie droite avant la courbe : de la place pour l'étiquette du port. */
  const sortieDe = (b: Bout) => (b.port ? (b.decale ? 1.75 : 1.3) : 0.45);

  function chemin(l: Liaison, d: Disposition, dxA = 0, dxB = 0) {
    const ca = d.pos.get(l.a)!, cb = d.pos.get(l.b)!;
    const memeRang = Math.abs(ca.y - cb.y) < 0.6;
    const aEnHaut = memeRang || ca.y < cb.y;
    const A = attache(l.a, l.portA, memeRang ? true : aEnHaut, d, dxA), B = attache(l.b, l.portB, memeRang ? true : !aEnHaut, d, dxB);
    const ya = A.bord + A.dir * sortieDe(A), yb = B.bord + B.dir * sortieDe(B);
    const debut = `M ${A.x} ${A.y} L ${A.sx} ${A.bord + A.dir * 0.12} L ${A.sx} ${ya}`;
    const fin = `L ${B.sx} ${B.bord + B.dir * 0.12} L ${B.x} ${B.y}`;
    if (memeRang) {
      // Même rangée : un arc par-dessous.
      const ybas = Math.max(ya, yb) + 1.2;
      return { d: `${debut} C ${A.sx} ${ybas}, ${B.sx} ${ybas}, ${B.sx} ${yb} ${fin}`, milieu: { x: (A.sx + B.sx) / 2, y: ybas - 0.3 }, A, B };
    }
    const ym = (ya + yb) / 2;
    return { d: `${debut} C ${A.sx} ${ym}, ${B.sx} ${ym}, ${B.sx} ${yb} ${fin}`, milieu: { x: (A.sx + B.sx) / 2, y: ym }, A, B };
  }

  /* ---------------- rendu ---------------- */

  function afficher(inv: Inventaire, d: Disposition, site: string | null) {
    monde.replaceChildren();
    noeuds.clear();
    liensDe.clear();
    pos = d.pos;
    const visibles = new Set(inv.equipements.filter((e) => !site || e.site === site).map((e) => e.nom));
    const parNom = new Map(inv.equipements.map((e) => [e.nom, e]));
    const cadres = d.cadres.filter((c) => !site || c.site === site);
    // Carte vide : ni mini-carte ni boutons, il n'y a rien à parcourir.
    outils.hidden = !cadres.length;
    if (!cadres.length) { bornes = { x: 0, y: 0, w: 10, h: 10 }; cadrer(); return; }
    const cadreSite = new Map(cadres.filter((c) => c.type === "site").map((c) => [c.site, c]));
    const cadrePoint = new Map(cadres.filter((c) => c.type === "point").map((c) => [`${c.site}§${c.point}`, c]));
    /** Le cadre le plus proche d'un équipement : son lieu s'il en a un, sinon son site. */
    const cadreDe = (nom: string) => { const e = parNom.get(nom)!; return cadrePoint.get(`${e.site}§${e.point ?? ""}`) ?? cadreSite.get(e.site)!; };
    const ajouterLien = (l: Liaison, e: SVGElement) => {
      [l.a, l.b].forEach((n) => { if (!liensDe.has(n)) liensDe.set(n, []); liensDe.get(n)!.push(e); });
    };
    const sortie = (p: Point, q: Point, c: { x: number; y: number; w: number; h: number }) => {
      const dx = q.x - p.x, dy = q.y - p.y;
      const tx = dx > 0 ? (c.x + c.w - p.x) / dx : dx < 0 ? (c.x - p.x) / dx : Infinity;
      const ty = dy > 0 ? (c.y + c.h - p.y) / dy : dy < 0 ? (c.y - p.y) / dy : Infinity;
      const t = Math.min(tx, ty, 1);
      return { x: p.x + dx * t, y: p.y + dy * t };
    };
    const dedans = (p: Point) => cadres.some((c) => p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + c.h);
    const styleMedia = (l: Liaison) => {
      const m = l.media ?? "inconnu";
      return { stroke: COULEUR_MEDIA[m], ...(m === "vpn" ? { "stroke-dasharray": "0.7 0.35" } : m === "radio" ? { "stroke-dasharray": "0.25 0.2" } : m === "serie" ? { "stroke-dasharray": "0.12 0.12" } : {}) };
    };

    // Ordre des couches : liaisons entre sites, cadres des sites, liaisons
    // entre lieux d'un site, cadres des lieux, câbles, équipements. Une
    // liaison longue ne se voit ainsi qu'entre les cadres qu'elle relie.
    const gInterSites = el("g", { class: "detail" }, monde);
    const gs = el("g", {}, monde);
    const gInterPoints = el("g", { class: "detail" }, monde);
    const gpt = el("g", {}, monde);
    const avecPoints = new Set(cadres.filter((c) => c.type === "point").map((c) => c.site));
    cadres.forEach((c) => {
      const eqs = inv.equipements.filter((e) => e.site === c.site && (c.type === "site" || (e.point ?? "") === c.point));
      const nSw = eqs.filter((e) => e.genre === "switch").length;
      const resume = `${eqs.length} équipement${eqs.length > 1 ? "s" : ""} · ${nSw} switch${nSw > 1 ? "s" : ""}`;
      if (c.type === "site") {
        el("rect", { class: "cadre-site", x: c.x, y: c.y, width: c.w, height: c.h, rx: 0.9, fill: avecPoints.has(c.site) ? "#0A0E14" : "#0D1118",
          stroke: "rgba(255,255,255,0.12)", "stroke-width": 0.06 }, gs);
        el("path", { class: "cadre-entete", d: `M ${c.x} ${c.y + 1.6} V ${c.y + 0.9} Q ${c.x} ${c.y} ${c.x + 0.9} ${c.y} H ${c.x + c.w - 0.9} Q ${c.x + c.w} ${c.y} ${c.x + c.w} ${c.y + 0.9} V ${c.y + 1.6} Z`,
          fill: "rgba(141,124,255,0.09)" }, gs);
        texte(gs, c.nom, { x: c.x + 0.9, y: c.y + 1.08, "font-size": 0.72, "font-weight": 800, fill: "#F5F7FA" });
        const nPts = cadres.filter((x) => x.type === "point" && x.site === c.site).length;
        texte(gs, nPts ? `${nPts} lieux · ${resume}` : resume, { x: c.x + c.w - 0.9, y: c.y + 1.04, "text-anchor": "end", "font-size": 0.38, fill: "#8B98A8" });
      } else {
        el("rect", { class: "cadre-point", x: c.x, y: c.y, width: c.w, height: c.h, rx: 0.7, fill: "#0F141C", stroke: "rgba(61,220,151,0.28)", "stroke-width": 0.05 }, gpt);
        el("circle", { cx: c.x + 0.85, cy: c.y + 0.82, r: 0.2, fill: "none", stroke: "#3DDC97", "stroke-width": 0.07 }, gpt);
        el("circle", { cx: c.x + 0.85, cy: c.y + 0.82, r: 0.06, fill: "#3DDC97" }, gpt);
        texte(gpt, c.nom, { x: c.x + 1.25, y: c.y + 0.98, "font-size": 0.5, "font-weight": 700, fill: "#E3F9EE" });
        texte(gpt, resume, { x: c.x + c.w - 0.7, y: c.y + 0.96, "text-anchor": "end", "font-size": 0.32, fill: "#8B98A8" });
      }
    });

    const gl = el("g", { class: "detail" }, monde);
    const gn = el("g", { class: "detail" }, monde);
    const gp = el("g", { class: "detail" }, monde);

    // Plusieurs câbles qui arrivent par le même bord d'une carte (ou d'une
    // façade sans port précisé) : on les répartit le long du bord, dans
    // l'ordre de leur autre extrémité, pour qu'ils ne se croisent pas.
    const decalage = new Map<string, number>();
    {
      const groupes = new Map<string, { cle: string; x: number }[]>();
      inv.liaisons.forEach((l, i) => {
        if (!visibles.has(l.a) || !visibles.has(l.b) || cadreDe(l.a) !== cadreDe(l.b)) return;
        const ca = d.pos.get(l.a)!, cb = d.pos.get(l.b)!;
        const memeRang = Math.abs(ca.y - cb.y) < 0.6, aEnHaut = memeRang || ca.y < cb.y;
        ([[l.a, l.portA, memeRang ? true : aEnHaut, `${i}a`, l.b, l.portB], [l.b, l.portB, memeRang ? true : !aEnHaut, `${i}b`, l.a, l.portA]] as const)
          .forEach(([nom, port, bas, cle, autre, portAutre]) => {
            const f = d.facades.get(nom);
            if (f && port && f.parId.get(port)) return;
            const k = `${nom}|${bas}`;
            if (!groupes.has(k)) groupes.set(k, []);
            groupes.get(k)!.push({ cle, x: attache(autre, portAutre, !bas, d).x });
          });
      });
      groupes.forEach((liste, k) => {
        if (liste.length < 2) return;
        const nom = k.split("|")[0];
        const w = d.facades.get(nom)?.w ?? CARTE_W;
        const pas = Math.min(0.55, (w * 0.8) / liste.length);
        liste.sort((a, b) => a.x - b.x).forEach((it, j) => decalage.set(it.cle, (j - (liste.length - 1) / 2) * pas));
      });
    }
    // Étiquettes déjà posées : une nouvelle étiquette se décale au lieu de recouvrir.
    const posees: { x: number; y: number; w: number; h: number }[] = [];
    const placer = (x: number, y: number, w: number, h: number) => {
      const chevauche = (yy: number) => posees.some((r) => Math.abs(r.x - x) * 2 < r.w + w && Math.abs(r.y - yy) * 2 < r.h + h);
      let yy = y;
      for (let k = 1; k <= 8 && chevauche(yy); k++) yy = y + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (h + 0.1);
      posees.push({ x, y: yy, w, h });
      return yy;
    };
    /** Le numéro du port écrit sur le câble, juste à sa sortie. */
    const etiquettePort = (b: Bout, couleur: string) => {
      if (!b.port) return;
      const t = court(b.port, 8);
      const w = t.length * 0.15 + 0.24;
      const y = placer(b.sx, b.bord + b.dir * (b.decale ? 1.3 : 0.85), w, 0.36);
      el("rect", { x: b.sx - w / 2, y: y - 0.18, width: w, height: 0.36, rx: 0.12, fill: "#0D1118", stroke: couleur, "stroke-width": 0.04, class: "port-etiq" }, gp);
      texte(gp, t, { x: b.sx, y: y + 0.09, "text-anchor": "middle", "font-size": 0.24, "font-weight": 700, fill: "#F5F7FA", class: "port-etiq" });
    };

    inv.liaisons.forEach((l, i) => {
      if (!visibles.has(l.a) || !visibles.has(l.b)) return;
      const trunk = l.mode === "trunk";
      const ea = parNom.get(l.a)!, eb = parNom.get(l.b)!;
      const ca = cadreDe(l.a), cb2 = cadreDe(l.b);
      const sm = styleMedia(l);
      if (ca !== cb2) {
        // Entre deux lieux ou deux sites.
        const A = attache(l.a, l.portA, false, d), B = attache(l.b, l.portB, false, d);
        const trait = { ...sm, "stroke-width": trunk ? 0.2 : 0.15, opacity: 0.92 };
        const memeSite = ea.site === eb.site;
        const plein = el("line", { class: "lien", x1: A.x, y1: A.y, x2: B.x, y2: B.y, ...trait }, memeSite ? gInterPoints : gInterSites);
        el("title", {}, plein).textContent = decrireLien(l);
        ajouterLien(l, plein);
        const sa = sortie(A, B, ca), sb = sortie(B, A, cb2);
        [[A, sa], [B, sb]].forEach(([p, s2]) => {
          const bout = el("line", { class: "lien", x1: p.x, y1: p.y, x2: s2.x, y2: s2.y, ...trait }, gl);
          el("title", {}, bout).textContent = decrireLien(l);
          ajouterLien(l, bout);
        });
        if (!memeSite) {
          // Du bord du lieu au bord du site : visible dans le site, entre ses lieux.
          ([[A, ea], [B, eb]] as const).forEach(([p, e]) => {
            const cs = cadreSite.get(e.site)!;
            if (cadreDe(e.nom) === cs) return;
            const q = p === A ? B : A;
            const s2 = sortie(p, q, cs);
            const seg = el("line", { class: "lien", x1: p.x, y1: p.y, x2: s2.x, y2: s2.y, ...trait }, gInterPoints);
            ajouterLien(l, seg);
          });
        }
        // Le port de chaque bout, posé sur la ligne juste après le port.
        ([[A, B, l.a], [B, A, l.b]] as const).forEach(([p, q, nom]) => {
          if (!p.port) return;
          // Juste après le bord de l'équipement, pas sur sa façade.
          const L = Math.hypot(q.x - p.x, q.y - p.y) || 1, ux = (q.x - p.x) / L, uy = (q.y - p.y) / L;
          const c0 = d.pos.get(nom)!, fw = (d.facades.get(nom)?.w ?? CARTE_W) / 2, fh = (d.facades.has(nom) ? FH : CARTE_H) / 2;
          const tx = ux > 0 ? (c0.x + fw - p.x) / ux : ux < 0 ? (c0.x - fw - p.x) / ux : Infinity;
          const ty = uy > 0 ? (c0.y + fh - p.y) / uy : uy < 0 ? (c0.y - fh - p.y) / uy : Infinity;
          const k = Math.min(Math.min(tx, ty) + 0.7, L / 2);
          const t = court(p.port, 8), w = t.length * 0.15 + 0.24;
          const x = p.x + ((q.x - p.x) / L) * k, y = placer(x, p.y + ((q.y - p.y) / L) * k, w, 0.36);
          el("rect", { x: x - w / 2, y: y - 0.18, width: w, height: 0.36, rx: 0.12, fill: "#0D1118", stroke: sm.stroke, "stroke-width": 0.04, class: "port-etiq" }, gp);
          texte(gp, t, { x, y: y + 0.09, "text-anchor": "middle", "font-size": 0.24, "font-weight": 700, fill: "#F5F7FA", class: "port-etiq" });
        });
        const m = { x: (sa.x + sb.x) / 2, y: (sa.y + sb.y) / 2 };
        const t = [l.libelle, trunk ? `trunk${l.vlans ? ` ${l.vlans}` : ""}` : l.vlans ? `VLAN ${l.vlans}` : ""].filter(Boolean).join(" · ");
        if (t && !dedans(m))
          texte(gp, t, { x: m.x, y: m.y - 0.3, "text-anchor": "middle", "font-size": 0.42, fill: sm.stroke, "font-weight": 700,
            stroke: "#07090D", "stroke-width": 0.14, "paint-order": "stroke" });
        return;
      }
      const c = chemin(l, d, decalage.get(`${i}a`) ?? 0, decalage.get(`${i}b`) ?? 0);
      etiquettePort(c.A, sm.stroke);
      etiquettePort(c.B, sm.stroke);
      // Gaine sombre plus large puis le câble : il se détache même quand il
      // croise un autre câble. Un trunk est un câble épais à liseré central.
      el("path", { d: c.d, fill: "none", stroke: "#0D1118", "stroke-width": trunk ? 0.38 : 0.22 }, gl);
      const p = el("path", { class: "lien", d: c.d, fill: "none", ...sm, "stroke-width": trunk ? 0.2 : 0.085, opacity: trunk ? 1 : 0.8 }, gl);
      el("title", {}, p).textContent = decrireLien(l);
      ajouterLien(l, p);
      if (trunk) {
        el("path", { d: c.d, fill: "none", stroke: "#0D1118", "stroke-width": 0.05, opacity: 0.85, "pointer-events": "none" }, gl);
        const t = `TRUNK${l.vlans ? ` · VLAN ${l.vlans}` : ""}${l.media === "fibre" ? " · FIBRE" : ""}`;
        const w = t.length * 0.165 + 0.45;
        const my = placer(c.milieu.x, c.milieu.y, w, 0.5);
        el("rect", { x: c.milieu.x - w / 2, y: my - 0.25, width: w, height: 0.5, rx: 0.25, fill: "#141922", stroke: sm.stroke, "stroke-width": 0.05 }, gp);
        texte(gp, t, { x: c.milieu.x, y: my + 0.1, "text-anchor": "middle", "font-size": 0.27, "font-weight": 700, fill: "#F5F7FA" });
      } else if (l.libelle) {
        texte(gp, l.libelle, { x: c.milieu.x + 0.2, y: c.milieu.y, "font-size": 0.3, fill: "#8B98A8", "font-style": "italic",
          stroke: "#0D1118", "stroke-width": 0.1, "paint-order": "stroke" });
      }
    });

    inv.equipements.forEach((e) => {
      if (!visibles.has(e.nom)) return;
      const p = d.pos.get(e.nom)!;
      const g = el("g", { class: "noeud", transform: `translate(${p.x} ${p.y})`, tabindex: 0, role: "button",
        "aria-label": `${e.nom}${e.ip ? `, ${e.ip}` : ""}`, "data-nom": e.nom }, gn) as SVGGElement;
      const f = d.facades.get(e.nom);
      if (f) dessinerFacade(g, e, f, inv); else dessinerCarte(g, e);
      g.addEventListener("pointerenter", () => survoler(e.nom));
      g.addEventListener("pointerleave", () => survoler(null));
      g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); cb.choisir(e.nom); } });
      noeuds.set(e.nom, g);
    });

    // Cartes résumé, visibles quand on est dézoomé.
    const gr = el("g", { class: "g-resume" }, monde);
    const resumer = (eqs: typeof inv.equipements) => {
      const n = (g: string) => eqs.filter((e) => e.genre === g).length;
      const baies = new Set(eqs.filter((e) => e.baie).map((e) => `${e.point ?? ""}§${e.baie}`)).size;
      const autres = eqs.length - n("switch") - n("camera");
      const gws = [...new Set(eqs.map((e) => e.passerelleIp).filter(Boolean))];
      return [
        `${n("switch")} switch${n("switch") > 1 ? "s" : ""}${baies ? ` · ${baies} baie${baies > 1 ? "s" : ""}` : ""}`,
        `${n("camera")} caméra${n("camera") > 1 ? "s" : ""}${autres > 0 ? ` · ${autres} autre${autres > 1 ? "s" : ""}` : ""}`,
        gws.length === 1 ? `GW ${gws[0]}` : gws.length > 1 ? `${gws.length} passerelles` : "",
      ].filter(Boolean);
    };
    cadres.forEach((c, i) => {
      const aDesLieux = c.type === "site" && avecPoints.has(c.site);
      const eqs = inv.equipements.filter((e) => e.site === c.site && (c.type === "site" || (e.point ?? "") === c.point));
      const g = el("g", { class: "carte-resume", "data-cadre": i }, gr);
      if (aDesLieux) {
        // Site à plusieurs lieux : son nom en grand dans le bandeau, les lieux ont leur propre carte.
        const fs = Math.min(c.w / 14, 3.2);
        texte(g, `${c.nom}`, { x: c.x + c.w / 2, y: c.y + Math.min(2.2, fs * 0.9), "text-anchor": "middle", "font-size": fs * 0.62, "font-weight": 800, fill: "#F5F7FA" });
        return;
      }
      const fs = Math.min(c.w / 8.5, (c.h - 1) / 5.4, 4.5);
      const w = c.w * 0.86, h = fs * 5.2, x = c.x + (c.w - w) / 2, y = c.y + (c.h - h) / 2 + (c.type === "point" ? 0.4 : 0.6);
      el("rect", { x, y, width: w, height: h, rx: fs * 0.5, fill: "#121821", stroke: c.type === "point" ? "#3DDC97" : "#8D7CFF", "stroke-width": fs * 0.06 }, g);
      texte(g, c.type === "point" ? `⌖ ${c.nom}` : c.nom, { x: x + w / 2, y: y + fs * 1.45, "text-anchor": "middle", "font-size": fs * 1.05, "font-weight": 800, fill: "#F5F7FA" });
      resumer(eqs).forEach((ligne, k) => texte(g, ligne, { x: x + w / 2, y: y + fs * (2.75 + k * 1.05), "text-anchor": "middle",
        "font-size": fs * 0.72, fill: k === 2 ? "#C2B9FF" : "#B9C3CF", "font-family": k === 2 ? "ui-monospace, monospace" : "inherit" }));
    });
    cadresAffiches = cadres;

    // Mini-carte : les cadres des sites et des lieux, à l'échelle.
    miniCadres.replaceChildren();
    cadres.forEach((c) => el("rect", { x: c.x, y: c.y, width: c.w, height: c.h, rx: Math.min(c.w, c.h) * 0.04,
      class: c.type === "point" ? "mc-lieu" : "mc-site" }, miniCadres));

    const xs = cadres.flatMap((c) => [c.x, c.x + c.w]), ys = cadres.flatMap((c) => [c.y, c.y + c.h]);
    const nouvelles = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    // On ne recadre que si l'emprise change : taper une IP ne doit pas faire sauter la vue.
    const change = (["x", "y", "w", "h"] as const).some((k) => Math.abs(nouvelles[k] - bornes[k]) > 0.01);
    bornes = nouvelles;
    const mm = Math.max(bornes.w, bornes.h) * 0.04;
    mini.setAttribute("viewBox", `${bornes.x - mm} ${bornes.y - mm} ${bornes.w + 2 * mm} ${bornes.h + 2 * mm}`);
    if (change) cadrer();
    if (choisi) marquer(choisi);
  }

  function survoler(nom: string | null) {
    liensDe.forEach((l) => l.forEach((e) => e.classList.remove("actif")));
    const cible = nom ?? choisi;
    if (cible) liensDe.get(cible)?.forEach((e) => e.classList.add("actif"));
  }
  function marquer(nom: string | null) {
    noeuds.forEach((g) => g.classList.remove("choisi"));
    if (nom) noeuds.get(nom)?.classList.add("choisi");
    survoler(null);
  }

  /* ---------------- navigation ---------------- */
  const versMonde = (cx: number, cy: number) => {
    const r = svg.getBoundingClientRect();
    return { x: vb.x + ((cx - r.left) / r.width) * vb.w, y: vb.y + ((cy - r.top) / r.height) * vb.h };
  };
  const zoomer = (f: number, cx: number, cy: number) => {
    const p = versMonde(cx, cy);
    const w = Math.min(Math.max(vb.w * f, 3), 3000), k = w / vb.w;
    vb = { x: p.x - (p.x - vb.x) * k, y: p.y - (p.y - vb.y) * k, w, h: vb.h * k };
    appliquer();
  };
  svg.addEventListener("wheel", (ev) => { ev.preventDefault(); zoomer(Math.exp(ev.deltaY * 0.0015), ev.clientX, ev.clientY); }, { passive: false });

  let glisse: { x: number; y: number; vb: typeof vb; bouge: boolean; id: number } | null = null;
  svg.addEventListener("pointerdown", (ev) => { glisse = { x: ev.clientX, y: ev.clientY, vb: { ...vb }, bouge: false, id: ev.pointerId }; });
  svg.addEventListener("pointermove", (ev) => {
    if (!glisse || glisse.id !== ev.pointerId) return;
    const dx = ev.clientX - glisse.x, dy = ev.clientY - glisse.y;
    if (!glisse.bouge && Math.hypot(dx, dy) < 4) return;
    if (!glisse.bouge) { glisse.bouge = true; svg.setPointerCapture(ev.pointerId); svg.classList.add("saisi"); }
    const r = svg.getBoundingClientRect();
    vb = { ...glisse.vb, x: glisse.vb.x - (dx / r.width) * vb.w, y: glisse.vb.y - (dy / r.height) * vb.h };
    appliquer();
  });
  svg.addEventListener("pointerup", (ev) => {
    if (!glisse || glisse.id !== ev.pointerId) return;
    const bouge = glisse.bouge;
    glisse = null;
    svg.classList.remove("saisi");
    if (bouge) return;
    const cible = ev.target as Element;
    // Dézoomé, un clic sur une carte résumé zoome sur ce site ou ce lieu.
    if (svg.classList.contains("resume")) {
      const carte = cible.closest?.("[data-cadre]") as SVGElement | null;
      const c = carte ? cadresAffiches[Number(carte.dataset.cadre)] : undefined;
      if (c) { allerA({ x: c.x - 1, y: c.y - 1, w: c.w + 2, h: c.h + 2 }); return; }
    }
    // Un clic sur un port branché ouvre ce qui est au bout du câble.
    const port = cible.closest?.("[data-vers]") as SVGElement | null;
    if (port) { cb.choisir(port.dataset.vers!); return; }
    const n = cible.closest?.(".noeud") as SVGGElement | null;
    cb.choisir(n?.dataset.nom ?? null);
  });
  svg.addEventListener("pointercancel", () => { glisse = null; svg.classList.remove("saisi"); });
  svg.addEventListener("dblclick", (ev) => zoomer(0.5, ev.clientX, ev.clientY));
  new ResizeObserver(() => cadrer()).observe(hote);

  outils.addEventListener("click", (ev) => {
    const z = (ev.target as HTMLElement).closest<HTMLElement>("[data-z]")?.dataset.z;
    if (!z) return;
    if (z === "tout") { cadrer(false); return; }
    const k = z === "plus" ? 0.6 : 1 / 0.6;
    const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
    allerA({ x: cx - (vb.w * k) / 2, y: cy - (vb.h * k) / 2, w: vb.w * k, h: vb.h * k });
  });
  // Mini-carte : cliquer ou glisser pour déplacer la vue.
  let miniSaisi = false;
  const miniAller = (ev: PointerEvent, doux: boolean) => {
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(mini.getScreenCTM()!.inverse());
    allerA({ x: p.x - vb.w / 2, y: p.y - vb.h / 2, w: vb.w, h: vb.h }, !doux);
  };
  mini.addEventListener("pointerdown", (ev) => { miniSaisi = true; mini.setPointerCapture(ev.pointerId); miniAller(ev, true); });
  mini.addEventListener("pointermove", (ev) => { if (miniSaisi) miniAller(ev, false); });
  mini.addEventListener("pointerup", () => { miniSaisi = false; });

  return {
    afficher,
    selectionner(nom, centrer = false) {
      choisi = nom;
      marquer(nom);
      if (nom && centrer) {
        const p = pos.get(nom);
        if (p) { const w = Math.min(vb.w, 34), k = w / vb.w; allerA({ x: p.x - w / 2, y: p.y - (vb.h * k) / 2, w, h: vb.h * k }); }
      }
    },
    cadrer,
    exporter(clair = false, signature = "") {
      const c = svg.cloneNode(true) as SVGSVGElement;
      // Signature en bas à droite du plan exporté.
      if (signature) {
        const t = el("text", { x: bornes.x + bornes.w, y: bornes.y + bornes.h + 1.4, "text-anchor": "end", "font-size": 0.7,
          fill: clair ? "#56606C" : "#8B98A8", "font-style": "italic" }, c);
        t.textContent = `Topologie réseau v1 · établi par ${signature} · ${new Date().toLocaleDateString("fr-FR")}`;
      }
      // L'export garde tout le détail : pas de cartes résumé ni d'estompage.
      c.classList.remove("resume", "saisi");
      c.querySelector(".g-resume")?.remove();
      if (clair) eclaircir(c);
      const m = 2;
      c.setAttribute("viewBox", `${bornes.x - m} ${bornes.y - m} ${bornes.w + 2 * m} ${bornes.h + 2 * m}`);
      c.setAttribute("width", String(Math.round((bornes.w + 2 * m) * 40)));
      c.setAttribute("height", String(Math.round((bornes.h + 2 * m) * 40)));
      c.setAttribute("font-family", "Inter, Segoe UI, sans-serif");
      // Identifiants propres à cet export : collé dans une page qui contient
      // déjà le plan (impression), il ne doit pas emprunter ses dégradés.
      const k = `e${Math.random().toString(36).slice(2, 7)}-`;
      return new XMLSerializer().serializeToString(c).replace(/id="g-/g, `id="${k}`).replace(/url\(#g-/g, `url(#${k}`);
    },
  };
}
