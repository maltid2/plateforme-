/**
 * Le plan 2D, en SVG. Molette pour zoomer, glisser pour se déplacer, clic
 * sur un équipement pour sa fiche ; survoler un équipement fait ressortir
 * ses liaisons.
 */
import { APPARENCE, COULEUR_INTERSITE, COULEUR_LIEN } from "./apparence";
import type { Disposition, Point } from "./disposition";
import type { Inventaire, Liaison } from "./saisie";

const NS = "http://www.w3.org/2000/svg";
const W = 2.6, H = 1.4;

type Rappels = { choisir: (nom: string | null) => void };
export type Plan2D = {
  afficher: (inv: Inventaire, d: Disposition, site: string | null) => void;
  selectionner: (nom: string | null, centrer?: boolean) => void;
  cadrer: () => void;
  exporter: () => string;
};

function el<K extends keyof SVGElementTagNameMap>(nom: K, attrs: Record<string, string | number> = {}, parent?: Element) {
  const e = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}
const court = (s: string, n = 16) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function creerPlan2D(hote: HTMLElement, cb: Rappels): Plan2D {
  const svg = el("svg", { xmlns: NS });
  hote.appendChild(svg);
  const fond = el("rect", { fill: "#07090D", x: -1e4, y: -1e4, width: 2e4, height: 2e4 }, svg);
  const monde = el("g", {}, svg);

  let vb = { x: 0, y: 0, w: 10, h: 10 };
  let bornes = { x: 0, y: 0, w: 10, h: 10 };
  const noeuds = new Map<string, SVGGElement>();
  const liensDe = new Map<string, SVGElement[]>();
  let choisi: string | null = null;
  let pos = new Map<string, Point>();

  const appliquer = () => svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);

  function cadrer() {
    const r = hote.getBoundingClientRect();
    const ar = (r.width || 1) / (r.height || 1);
    let { x, y, w, h } = bornes;
    const m = 2;
    x -= m; y -= m; w += 2 * m; h += 2 * m;
    if (w / h < ar) { const nw = h * ar; x -= (nw - w) / 2; w = nw; } else { const nh = w / ar; y -= (nh - h) / 2; h = nh; }
    vb = { x, y, w, h };
    appliquer();
  }

  function courbe(a: Point, b: Point) {
    // Du bas du parent au haut de l'enfant ; à niveau égal, un arc par-dessous.
    if (Math.abs(a.y - b.y) < 0.5) {
      const y = a.y + H / 2, c = y + 1.6;
      return { d: `M ${a.x} ${y} C ${a.x} ${c}, ${b.x} ${c}, ${b.x} ${y}`, pa: { x: a.x, y: y + 0.45 }, pb: { x: b.x, y: y + 0.45 } };
    }
    const [h, bas] = a.y < b.y ? [a, b] : [b, a];
    const y1 = h.y + H / 2 + 0.85, y2 = bas.y - H / 2, m = (y1 + y2) / 2;
    const d = `M ${h.x} ${h.y + H / 2} L ${h.x} ${y1} C ${h.x} ${m}, ${bas.x} ${m}, ${bas.x} ${y2}`;
    // Les étiquettes de port se posent le long de la courbe : côté switch,
    // assez loin pour que les ports 2, 3, 4… ne s'empilent pas au même point.
    const sur = (t: number) => {
      const u = 1 - t;
      return { x: h.x * (u ** 3 + 3 * u * u * t) + bas.x * (3 * u * t * t + t ** 3), y: y1 * u ** 3 + 3 * m * u * t + y2 * t ** 3 };
    };
    const ph = sur(0.42), pbas = sur(0.9);
    return a.y < b.y ? { d, pa: ph, pb: pbas } : { d, pa: pbas, pb: ph };
  }

  function etiquettePort(g: Element, p: Point, port: string, couleur: string) {
    const t = court(port, 8);
    const w = 0.22 * t.length + 0.3;
    el("rect", { x: p.x - w / 2, y: p.y - 0.22, width: w, height: 0.44, rx: 0.2, fill: "#0D1118", stroke: couleur, "stroke-width": 0.04 }, g);
    const tx = el("text", { x: p.x, y: p.y + 0.13, "text-anchor": "middle", "font-size": 0.34, fill: "#C9D2DC",
      "font-family": "ui-monospace, monospace" }, g);
    tx.textContent = t;
  }

  function afficher(inv: Inventaire, d: Disposition, site: string | null) {
    monde.replaceChildren();
    noeuds.clear();
    liensDe.clear();
    pos = d.pos;
    const visibles = new Set(inv.equipements.filter((e) => !site || e.site === site).map((e) => e.nom));
    const siteDe = new Map(inv.equipements.map((e) => [e.nom, e.site]));
    const cadres = d.cadres.filter((c) => !site || c.nom === site);
    if (!cadres.length) { bornes = { x: 0, y: 0, w: 10, h: 10 }; cadrer(); return; }

    // Sites
    const gs = el("g", {}, monde);
    cadres.forEach((c) => {
      el("rect", { x: c.x, y: c.y, width: c.w, height: c.h, rx: 0.8, fill: "#0D1118", stroke: "rgba(255,255,255,0.12)", "stroke-width": 0.06 }, gs);
      const t = el("text", { x: c.x + 0.8, y: c.y + 1.25, "font-size": 0.75, "font-weight": 700, fill: "#F5F7FA" }, gs);
      t.textContent = c.nom;
      const n = inv.equipements.filter((e) => e.site === c.nom).length;
      const s = el("text", { x: c.x + 0.8 + c.nom.length * 0.44 + 0.6, y: c.y + 1.25, "font-size": 0.45, fill: "#8B98A8" }, gs);
      s.textContent = `${n} équipement${n > 1 ? "s" : ""}`;
    });

    // Liaisons
    const gl = el("g", {}, monde);
    const gp = el("g", {}, monde);
    const ajouterLien = (l: Liaison, e: SVGElement) => {
      [l.a, l.b].forEach((n) => { if (!liensDe.has(n)) liensDe.set(n, []); liensDe.get(n)!.push(e); });
    };
    inv.liaisons.forEach((l) => {
      if (!visibles.has(l.a) || !visibles.has(l.b)) return;
      const a = d.pos.get(l.a)!, b = d.pos.get(l.b)!;
      const inter = siteDe.get(l.a) !== siteDe.get(l.b);
      const g = el("g", {}, gl);
      if (inter) {
        const ytop = Math.min(a.y, b.y) - 4;
        const p = el("path", { class: "lien", d: `M ${a.x} ${a.y - H / 2} C ${a.x} ${ytop}, ${b.x} ${ytop}, ${b.x} ${b.y - H / 2}`,
          stroke: COULEUR_INTERSITE, "stroke-width": 0.1, "stroke-dasharray": "0.5 0.3", opacity: 0.9 }, g);
        ajouterLien(l, p);
        if (l.libelle) {
          const t = el("text", { x: (a.x + b.x) / 2, y: ytop + 0.9, "text-anchor": "middle", "font-size": 0.5, fill: "#C2B9FF", "font-weight": 600 }, gp);
          t.textContent = l.libelle;
        }
        if (l.portA) etiquettePort(gp, { x: a.x, y: a.y - H / 2 - 0.6 }, l.portA, COULEUR_INTERSITE);
        if (l.portB) etiquettePort(gp, { x: b.x, y: b.y - H / 2 - 0.6 }, l.portB, COULEUR_INTERSITE);
        return;
      }
      const c = courbe(a, b);
      const p = el("path", { class: "lien", d: c.d, stroke: COULEUR_LIEN, "stroke-width": 0.08, opacity: 0.85 }, g);
      el("title", {}, p).textContent =
        `${l.a}${l.portA ? `:${l.portA}` : ""} ↔ ${l.b}${l.portB ? `:${l.portB}` : ""}${l.libelle ? ` · ${l.libelle}` : ""}`;
      ajouterLien(l, p);
      if (l.portA) etiquettePort(gp, c.pa, l.portA, COULEUR_LIEN);
      if (l.portB) etiquettePort(gp, c.pb, l.portB, COULEUR_LIEN);
      if (l.libelle) {
        const t = el("text", { x: (a.x + b.x) / 2 + 0.2, y: (a.y + b.y) / 2, "font-size": 0.34, fill: "#8B98A8", "font-style": "italic" }, gp);
        t.textContent = l.libelle;
      }
    });

    // Équipements
    const gn = el("g", {}, monde);
    inv.equipements.forEach((e) => {
      if (!visibles.has(e.nom)) return;
      const p = d.pos.get(e.nom)!;
      const a = APPARENCE[e.genre];
      const g = el("g", { class: "noeud", transform: `translate(${p.x} ${p.y})`, tabindex: 0, role: "button",
        "aria-label": `${e.nom}${e.ip ? `, ${e.ip}` : ""}`, "data-nom": e.nom }, gn) as SVGGElement;
      el("title", {}, g).textContent = [e.nom, e.ip, ...e.infos].filter(Boolean).join("\n");
      el("rect", { class: "corps", x: -W / 2, y: -H / 2, width: W, height: H, rx: 0.25, fill: "#121821", stroke: a.couleur, "stroke-width": 0.07 }, g);
      el("rect", { x: -W / 2, y: -H / 2, width: 0.18, height: H, rx: 0.08, fill: a.couleur }, g);
      const s = el("text", { x: 0.09, y: -0.02, "text-anchor": "middle", "font-size": 0.5, "font-weight": 800, fill: a.couleur,
        "letter-spacing": 0.03 }, g);
      s.textContent = a.sigle;
      const ip = el("text", { x: 0.09, y: 0.46, "text-anchor": "middle", "font-size": 0.3, fill: "#8B98A8",
        "font-family": "ui-monospace, monospace" }, g);
      ip.textContent = e.ip ?? "";
      if (e.baie) {
        // La baie en pastille sur l'équipement : un cadre autour de la baie
        // couperait l'arbre, ses équipements n'étant pas au même niveau.
        const t = `▤ ${court(e.baie, 6)}`;
        const bw = 0.2 * t.length + 0.25;
        el("rect", { x: W / 2 - bw + 0.15, y: -H / 2 - 0.25, width: bw, height: 0.42, rx: 0.12, fill: "#1E1A3A", stroke: "#8D7CFF", "stroke-width": 0.03 }, g);
        const tb = el("text", { x: W / 2 - bw / 2 + 0.15, y: -H / 2 + 0.06, "text-anchor": "middle", "font-size": 0.28, fill: "#C2B9FF", "font-weight": 600 }, g);
        tb.textContent = t;
      }
      const t = el("text", { x: 0, y: H / 2 + 0.55, "text-anchor": "middle", "font-size": 0.4, "font-weight": 600, fill: "#F5F7FA",
        stroke: "#0D1118", "stroke-width": 0.14, "paint-order": "stroke" }, g);
      t.textContent = court(e.nom);
      g.addEventListener("pointerenter", () => survoler(e.nom));
      g.addEventListener("pointerleave", () => survoler(null));
      g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); cb.choisir(e.nom); } });
      noeuds.set(e.nom, g);
    });

    const xs = cadres.flatMap((c) => [c.x, c.x + c.w]), ys = cadres.flatMap((c) => [c.y, c.y + c.h]);
    const nouvelles = { x: Math.min(...xs), y: Math.min(...ys) - 3, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) + 3 };
    // On ne recadre que si l'emprise change : taper une IP ne doit pas faire sauter la vue.
    const change = Math.abs(nouvelles.w - bornes.w) > 0.01 || Math.abs(nouvelles.h - bornes.h) > 0.01 ||
      Math.abs(nouvelles.x - bornes.x) > 0.01 || Math.abs(nouvelles.y - bornes.y) > 0.01;
    bornes = nouvelles;
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

  /* ----- navigation ----- */
  const versMonde = (cx: number, cy: number) => {
    const r = svg.getBoundingClientRect();
    return { x: vb.x + ((cx - r.left) / r.width) * vb.w, y: vb.y + ((cy - r.top) / r.height) * vb.h };
  };
  svg.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const f = Math.exp(ev.deltaY * 0.0015);
    const p = versMonde(ev.clientX, ev.clientY);
    const w = Math.min(Math.max(vb.w * f, 4), 2000), k = w / vb.w;
    vb = { x: p.x - (p.x - vb.x) * k, y: p.y - (p.y - vb.y) * k, w, h: vb.h * k };
    appliquer();
  }, { passive: false });

  let glisse: { x: number; y: number; vb: typeof vb; bouge: boolean; id: number } | null = null;
  svg.addEventListener("pointerdown", (ev) => {
    glisse = { x: ev.clientX, y: ev.clientY, vb: { ...vb }, bouge: false, id: ev.pointerId };
  });
  svg.addEventListener("pointermove", (ev) => {
    if (!glisse || glisse.id !== ev.pointerId) return;
    const dx = ev.clientX - glisse.x, dy = ev.clientY - glisse.y;
    if (!glisse.bouge && Math.hypot(dx, dy) < 4) return;
    if (!glisse.bouge) { glisse.bouge = true; svg.setPointerCapture(ev.pointerId); svg.classList.add("saisi"); }
    const r = svg.getBoundingClientRect();
    vb = { ...glisse.vb, x: glisse.vb.x - (dx / r.width) * vb.w, y: glisse.vb.y - (dy / r.height) * vb.h };
    appliquer();
  });
  const finir = (ev: PointerEvent) => {
    if (!glisse || glisse.id !== ev.pointerId) return;
    const bouge = glisse.bouge;
    glisse = null;
    svg.classList.remove("saisi");
    if (bouge) return;
    const n = (ev.target as Element).closest?.(".noeud") as SVGGElement | null;
    cb.choisir(n?.dataset.nom ?? null);
  };
  svg.addEventListener("pointerup", finir);
  svg.addEventListener("pointercancel", () => { glisse = null; svg.classList.remove("saisi"); });
  new ResizeObserver(() => cadrer()).observe(hote);
  void fond;

  return {
    afficher,
    selectionner(nom, centrer = false) {
      choisi = nom;
      marquer(nom);
      if (nom && centrer) {
        const p = pos.get(nom);
        if (p) { const w = Math.min(vb.w, 30), k = w / vb.w; vb = { x: p.x - w / 2, y: p.y - (vb.h * k) / 2, w, h: vb.h * k }; appliquer(); }
      }
    },
    cadrer,
    exporter() {
      const c = svg.cloneNode(true) as SVGSVGElement;
      c.setAttribute("viewBox", `${bornes.x - 2} ${bornes.y - 2} ${bornes.w + 4} ${bornes.h + 4}`);
      c.setAttribute("width", String(Math.round((bornes.w + 4) * 40)));
      c.setAttribute("height", String(Math.round((bornes.h + 4) * 40)));
      c.setAttribute("font-family", "Inter, Segoe UI, sans-serif");
      return new XMLSerializer().serializeToString(c);
    },
  };
}
