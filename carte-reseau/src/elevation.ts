/**
 * Les baies vues de face, côte à côte : ce qu'un technicien voit en ouvrant
 * la porte. Chaque équipement à sa hauteur (U), avec sa vraie façade, et
 * les caméras sur leurs plateaux en bas. Sert à l'onglet « Baies » et au
 * dossier imprimé.
 */
import { APPARENCE } from "./apparence.ts";
import { CAM_PAR_PLATEAU, composerBaies, HAUTEUR_U, svgSimple, U_PLATEAU, type Baie } from "./baies.ts";
import type { Disposition } from "./disposition.ts";
import { FH } from "./facade.ts";
import { PICTOS } from "./pictos.ts";
import { svgFacade } from "./plan2d.ts";
import type { Inventaire } from "./saisie.ts";

const L = 19, HU = 1.75, MONTANT = 1.6, HAUT = 2.6, BAS = 1.2;
const echap = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const court = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Une façade SVG autonome, posée dans un rectangle de la baie (étirée à la hauteur des U). */
function poser(svg: string, x: number, y: number, w: number, h: number) {
  return svg.replace(/^<svg[^>]*?viewBox="([^"]+)"[^>]*>/, (_m, vb) =>
    `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb}" preserveAspectRatio="none">`);
}

function dessinerBaie(b: Baie, inv: Inventaire, d: Disposition, clair: boolean, k: string, echelle: [number, string]): string {
  const W = L + MONTANT * 2, H = HAUT + b.nbU * HU + BAS;
  const cadre = clair ? "#9aa5b1" : "#3a4350", fond = clair ? "#e9edf1" : "#0b0e13", texte = clair ? "#111418" : "#f5f7fa", sourd = clair ? "#56606c" : "#8b98a8";
  const o: string[] = [];
  o.push(`<rect x="0" y="${HAUT - 0.4}" width="${W}" height="${H - HAUT + 0.4}" rx="0.4" fill="${clair ? "#c5ccd4" : "#1b2129"}"/>`);
  o.push(`<rect x="${MONTANT}" y="${HAUT}" width="${L}" height="${b.nbU * HU}" fill="${fond}"/>`);
  o.push(`<text x="${W / 2}" y="1.1" text-anchor="middle" font-size="1.05" font-weight="800" fill="${texte}">▤ ${echap(b.nom)}</text>`);
  o.push(`<text x="${W / 2}" y="2.0" text-anchor="middle" font-size="0.62" fill="${sourd}">${b.nbU} U · ${b.equipements.length} équipement${b.equipements.length > 1 ? "s" : ""}${b.cameras.length ? ` · ${b.cameras.length} caméra${b.cameras.length > 1 ? "s" : ""}` : ""}</text>`);
  // Numéros d'U, de 1 en bas à nbU en haut, et repères des emplacements.
  for (let u = 0; u < b.nbU; u++) {
    const y = HAUT + (b.nbU - 1 - u) * HU;
    o.push(`<text x="${MONTANT - 0.25}" y="${y + HU * 0.68}" text-anchor="end" font-size="0.6" fill="${sourd}" font-family="monospace">${u + 1}</text>`);
    o.push(`<line x1="${MONTANT}" y1="${y + HU}" x2="${MONTANT + L}" y2="${y + HU}" stroke="${clair ? "#d5dbe1" : "#151a21"}" stroke-width="0.05"/>`);
  }
  [MONTANT - 0.15, MONTANT + L + 0.15].forEach((x) => o.push(`<line x1="${x}" y1="${HAUT}" x2="${x}" y2="${HAUT + b.nbU * HU}" stroke="${cadre}" stroke-width="0.3"/>`));

  // Les équipements, du haut vers le bas, un U d'air sous le toit.
  let uHaut = b.nbU - 1;
  b.equipements.forEach((e) => {
    const u = HAUTEUR_U[e.genre] ?? 1;
    const y = HAUT + (b.nbU - 1 - uHaut) * HU + 0.05;
    const h = u * HU - 0.1;
    const f = d.facades.get(e.nom);
    const svg = f ? svgFacade(e, f, inv, 1200) : svgSimple(e, u);
    // Identifiants propres à chaque façade : plusieurs façades dans un même document.
    const p = `b${k}${e.nom.replace(/[^\w]/g, "")}-`;
    o.push(`<g class="b-eq" data-nom="${echap(e.nom)}"><title>${echap(`${e.nom}${e.ip ? ` · ${e.ip}` : ""} · U${uHaut - u + 2}${u > 1 ? `-${uHaut + 1}` : ""}`)}</title>${poser(svg, MONTANT, y, L, h).replace(/id="(g-|c)/g, `id="${p}$1`).replace(/url\(#(g-|c)/g, `url(#${p}$1`)}</g>`);
    o.push(`<rect x="${MONTANT - 0.45}" y="${y}" width="0.4" height="${h}" fill="${cadre}"/><rect x="${MONTANT + L + 0.05}" y="${y}" width="0.4" height="${h}" fill="${cadre}"/>`);
    void FH;
    uHaut -= u;
  });

  // Plateaux à caméras, en bas.
  const plateaux = Math.ceil(b.cameras.length / CAM_PAR_PLATEAU);
  for (let i = 0; i < plateaux; i++) {
    const y = HAUT + (b.nbU - (i + 1) * U_PLATEAU) * HU;
    const h = U_PLATEAU * HU;
    o.push(`<rect x="${MONTANT + 0.1}" y="${y + h - 0.35}" width="${L - 0.2}" height="0.3" fill="${clair ? "#8a96a3" : "#4a5361"}"/>`);
    b.cameras.slice(i * CAM_PAR_PLATEAU, (i + 1) * CAM_PAR_PLATEAU).forEach((c, j) => {
      const cx = MONTANT + 1.6 + j * ((L - 3.2) / (CAM_PAR_PLATEAU - 1));
      const col = APPARENCE.camera.couleur;
      o.push(`<g class="b-eq" data-nom="${echap(c.nom)}"><title>${echap(`${c.nom}${c.ip ? ` · ${c.ip}` : ""}`)}</title>
        <rect x="${cx - 1.3}" y="${y + 0.1}" width="2.6" height="${h - 0.5}" rx="0.25" fill="${clair ? "#ffffff" : "#121821"}" stroke="${col}" stroke-width="0.08"/>
        <g transform="translate(${cx - 0.5} ${y + 0.25}) scale(1)" fill="none" stroke="${col}" stroke-width="0.08" stroke-linecap="round" stroke-linejoin="round">${PICTOS.camera}</g>
        <text x="${cx}" y="${y + h - 0.65}" text-anchor="middle" font-size="0.36" font-weight="700" fill="${texte}">${echap(court(c.nom, 13))}</text></g>`);
    });
  }
  // Taille fixe : une baie de 12 U et une de 42 U gardent la même échelle, côte à côte.
  const [k2, unite] = echelle;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.6 0 ${W + 1.2} ${H}" width="${((W + 1.2) * k2).toFixed(1)}${unite}" height="${(H * k2).toFixed(1)}${unite}" class="b-baie" font-family="Inter, Segoe UI, Arial, sans-serif">${o.join("")}</svg>`;
}

/** Toutes les baies, groupées par site puis par lieu, côte à côte. */
export function elevations(inv: Inventaire, d: Disposition, opts: { site?: string | null; clair?: boolean; camerasEnBaie?: boolean } = {}): string {
  // À l'écran en pixels ; à l'impression en millimètres (une baie de 42 U tient sur une page A3).
  const baies = composerBaies(inv, opts.camerasEnBaie ?? true).filter((b) => !opts.site || b.site === opts.site);
  // La plus haute baie tient sur la hauteur utile d'une page A3 paysage (≈ 230 mm).
  const hMax = Math.max(1, ...baies.map((b) => HAUT + b.nbU * HU + BAS));
  const echelle: [number, string] = opts.clair ? [Math.min(8, 230 / hMax), "mm"] : [13, "px"];
  if (!baies.length) return `<p class="b-vide">Aucune baie : déclarez une baie (<code>baie A1</code>) ou un switch, il apparaîtra ici.</p>`;
  // Préfixe propre à ce rendu : la page peut contenir deux fois les mêmes
  // baies (onglet et impression), leurs dégradés ne doivent pas se mélanger.
  const graine = Math.random().toString(36).slice(2, 7);
  let k = 0;
  return inv.sites.filter((s) => baies.some((b) => b.site === s.nom)).map((s) => {
    const duSite = baies.filter((b) => b.site === s.nom);
    const lieux = [...new Set(duSite.map((b) => b.point))];
    return `<section class="b-site"><h3>${echap(s.nom)}</h3>${lieux.map((p) => `
      ${lieux.length > 1 || p ? `<h4>⌖ ${echap(p || "Central")}</h4>` : ""}
      <div class="b-rangee">${duSite.filter((b) => b.point === p).map((b) => dessinerBaie(b, inv, d, !!opts.clair, `${graine}${k++}`, echelle)).join("")}</div>`).join("")}
    </section>`;
  }).join("");
}
