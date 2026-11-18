/**
 * Les baies : ce qui y est monté, dans quel ordre, et les plateaux à
 * caméras en bas. Mêmes règles pour la vue 3D et pour la vue de face
 * (« Baies » et dossier imprimé), pour que les deux disent la même chose.
 */
import { APPARENCE } from "./apparence.ts";
import type { Equipement, Genre, Inventaire } from "./saisie.ts";

export const EN_BAIE = new Set<Genre>(["passerelle", "parefeu", "switch", "serveur", "nas", "nvr", "onduleur"]);
export const HAUTEUR_U: Partial<Record<Genre, number>> = { serveur: 2, nas: 2, nvr: 2, onduleur: 2 };
export const CAM_PAR_PLATEAU = 6, U_PLATEAU = 2;


/* ---------- façades simples (serveur, NVR, onduleur) ---------- */
export function svgSimple(e: Equipement, u: number): string {
  const w = 22, h = 3 * u, c = APPARENCE[e.genre].couleur;
  const nom = e.nom.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  let detail = "";
  if (e.genre === "serveur" || e.genre === "nas") {
    for (let i = 0; i < 8; i++)
      detail += `<rect x="${8 + i * 1.6}" y="0.5" width="1.4" height="${h - 1}" rx="0.1" fill="#161b22" stroke="#4a5361" stroke-width="0.06"/>
        <rect x="${8.4 + i * 1.6}" y="${h - 1.1}" width="0.3" height="0.18" fill="${i < 6 ? "#3DDC97" : "#2a313b"}"/>`;
  } else if (e.genre === "onduleur") {
    detail = `<rect x="8" y="${h / 2 - 1}" width="5" height="2" rx="0.2" fill="#0d2a1f" stroke="#3DDC97" stroke-width="0.08"/>
      <text x="10.5" y="${h / 2 + 0.35}" font-size="1" text-anchor="middle" fill="#3DDC97" font-family="monospace">100%</text>
      <circle cx="15" cy="${h / 2}" r="0.4" fill="#3DDC97"/><circle cx="16.4" cy="${h / 2}" r="0.4" fill="#FFD166"/>`;
  } else {
    detail = `<rect x="8" y="${h / 2 - 0.5}" width="10" height="1" rx="0.2" fill="#0b0e12"/>` +
      Array.from({ length: 4 }, (_, i) => `<circle cx="${19 + i * 0.7}" cy="${h / 2}" r="0.2" fill="#3DDC97"/>`).join("");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="1024" height="${Math.round((1024 * h) / w)}" font-family="Arial, sans-serif">
    <defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4350"/><stop offset="1" stop-color="#181d24"/></linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#c)"/><rect x="0.3" y="0.3" width="0.25" height="${h - 0.6}" fill="${c}"/>
    <text x="0.9" y="${h / 2 - 0.1}" font-size="1.05" font-weight="700" fill="#F5F7FA">${nom}</text>
    <text x="0.9" y="${h / 2 + 1}" font-size="0.75" fill="#B9C3CF" font-family="monospace">${e.ip ?? ""}</text>${detail}</svg>`;
}


export type Baie = {
  site: string;
  point: string;            // "" : pas de lieu
  nom: string;              // « A1 », ou « Baie » si rien n'est précisé
  equipements: Equipement[];// du haut vers le bas, dans l'ordre de la saisie
  cameras: Equipement[];    // rangées sur les plateaux du bas
  nbU: number;
};

/** Toutes les baies, lieu par lieu, avec leurs caméras rattachées. */
export function composerBaies(inv: Inventaire, camerasEnBaie = true): Baie[] {
  const baies: Baie[] = [];
  const parCle = new Map<string, Baie>();
  inv.equipements.filter((e) => EN_BAIE.has(e.genre)).forEach((e) => {
    const cle = `${e.site}§${e.point ?? ""}§${e.baie ?? "Baie"}`;
    let b = parCle.get(cle);
    if (!b) {
      b = { site: e.site, point: e.point ?? "", nom: e.baie ?? "Baie", equipements: [], cameras: [], nbU: 0 };
      parCle.set(cle, b);
      baies.push(b);
    }
    b.equipements.push(e);
  });
  const baieDe = new Map<string, Baie>();
  baies.forEach((b) => b.equipements.forEach((e) => baieDe.set(e.nom, b)));
  if (camerasEnBaie) {
    inv.equipements.filter((e) => e.genre === "camera").forEach((e) => {
      // La caméra va dans la baie de son switch, s'il est dans le même lieu.
      const l = inv.liaisons.find((x) => (x.a === e.nom && baieDe.has(x.b)) || (x.b === e.nom && baieDe.has(x.a)));
      const b = l && baieDe.get(l.a === e.nom ? l.b : l.a);
      if (b && b.site === e.site && b.point === (e.point ?? "")) b.cameras.push(e);
    });
  }
  baies.forEach((b) => {
    const plateaux = Math.ceil(b.cameras.length / CAM_PAR_PLATEAU);
    b.nbU = Math.max(12, b.equipements.reduce((t, e) => t + (HAUTEUR_U[e.genre] ?? 1), 0) + plateaux * U_PLATEAU + 3);
  });
  return baies;
}
