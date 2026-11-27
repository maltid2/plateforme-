/**
 * L'entreprise qui établit les documents : son nom (INEO par défaut) et son
 * logo, affichés en haut de l'outil et sur tout ce qui s'imprime ou s'exporte
 * (PDF, préconisations, visionneuse).
 *
 * Le logo est choisi sur le poste (PNG, JPG, SVG) et gardé dans ce navigateur,
 * en image « data: » : rien n'est téléchargé ni envoyé. La visionneuse
 * exportée emporte le nom et le logo de celui qui l'a produite.
 */
export type Entreprise = { nom: string; logo: string };
export const ENTREPRISE_DEFAUT: Entreprise = { nom: "INEO", logo: "" };
/** Un logo plus lourd alourdirait chaque visionneuse exportée. */
export const LOGO_MAX_OCTETS = 300 * 1024;

const CLE = "carte-reseau:entreprise";
let figee: Entreprise | null = null;

const propre = (e: Partial<Entreprise> | null | undefined): Entreprise => ({
  nom: String(e?.nom ?? ENTREPRISE_DEFAUT.nom).replace(/[<>]/g, "").slice(0, 40),
  // Seules des images incluses sont acceptées (pas d'adresse distante).
  logo: /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(String(e?.logo ?? "")) ? String(e!.logo) : "",
});

export function lireEntreprise(): Entreprise {
  if (figee) return figee;
  try { const t = localStorage.getItem(CLE); return t ? propre(JSON.parse(t)) : ENTREPRISE_DEFAUT; } catch { return ENTREPRISE_DEFAUT; }
}
export function ecrireEntreprise(e: Partial<Entreprise>) {
  try { localStorage.setItem(CLE, JSON.stringify(propre(e))); } catch { /* stockage indisponible : réglage non retenu */ }
}
/** Visionneuse : on garde l'entreprise de celui qui l'a exportée. */
export function figerEntreprise(e?: Partial<Entreprise> | null) { figee = e ? propre(e) : null; }

const echap = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Le logo s'il y en a un, sinon le nom en toutes lettres. */
export function marqueEntreprise(e = lireEntreprise()): string {
  if (!e.nom && !e.logo) return "";
  return `<span class="entreprise">${e.logo ? `<img src="${e.logo}" alt="${echap(e.nom)}" />` : `<span class="entreprise-nom">${echap(e.nom)}</span>`}</span>`;
}
