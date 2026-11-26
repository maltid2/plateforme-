import type { Genre } from "./saisie.ts";

/** Une couleur et un sigle par type : la carte se lit avant les étiquettes. */
export const APPARENCE: Record<Genre, { couleur: string; sigle: string }> = {
  passerelle: { couleur: "#F97316", sigle: "GW" },
  parefeu:    { couleur: "#EF4444", sigle: "FW" },
  switch:     { couleur: "#4FA3FF", sigle: "SW" },
  camera:     { couleur: "#3DDC97", sigle: "CAM" },
  nvr:        { couleur: "#2BB39A", sigle: "NVR" },
  borne:      { couleur: "#F2C94C", sigle: "AP" },
  serveur:    { couleur: "#E07BD8", sigle: "SRV" },
  nas:        { couleur: "#D9A066", sigle: "NAS" },
  poste:      { couleur: "#9AA8B8", sigle: "PC" },
  imprimante: { couleur: "#7F8C9C", sigle: "IMP" },
  telephone:  { couleur: "#56CCF2", sigle: "TEL" },
  onduleur:   { couleur: "#6B7A8C", sigle: "UPS" },
  autre:      { couleur: "#8B98A8", sigle: "?" },
};

/** Un trunk se repère de loin : bleu clair, plus épais qu'un lien d'accès. */
export let COULEUR_TRUNK = "#93C5FD";

/**
 * Couleur d'un câble = son support. Fibre orange (la couleur des jarretières
 * multimode), cuivre bleu, radio jaune, VPN violet en pointillés. Le trunk se
 * lit à l'épaisseur et à son étiquette, pas à la couleur.
 */
export const COULEUR_MEDIA = { fibre: "#FF9F43", cuivre: "#4FC3F7", dac: "#2DD4BF", coax: "#D08C5B", serie: "#F472B6", usb: "#B8C4D6", radio: "#F2C94C", vpn: "#A99CFF", inconnu: "#8B98A8" } as const;

/* ---------- couleurs choisies par l'utilisateur ---------- */
export type Couleurs = { genres?: Partial<Record<Genre, string>>; medias?: Partial<Record<string, string>>; trunk?: string; theme?: "standard" | "studio" | "clair"; fondCarte?: string; fondInterface?: string; accent?: Accent; accentPerso?: string };
/** Couleur d'accent de l'interface : choisie pour rester lisible sur fond sombre (contraste AA)
 *  et ne pas se confondre avec les couleurs d'état (vert = OK, ambre = attention, rouge = erreur). */
export type Accent = "bleu" | "vert" | "cyan" | "graphite" | "violet" | "perso";
export const ACCENTS: Record<Accent, { nom: string; acc: string; rgb: string; clair: string; texte: string }> = {
  bleu:     { nom: "Bleu (recommandé)", acc: "#60A5FA", rgb: "96, 165, 250", clair: "#BFDBFE", texte: "#0B1220" },
  vert:     { nom: "Vert", acc: "#34D399", rgb: "52, 211, 153", clair: "#A7F3D0", texte: "#052016" },
  cyan:     { nom: "Cyan technique", acc: "#22D3EE", rgb: "34, 211, 238", clair: "#A5F3FC", texte: "#062028" },
  graphite: { nom: "Graphite (neutre)", acc: "#CBD5E1", rgb: "203, 213, 225", clair: "#F1F5F9", texte: "#0F172A" },
  violet:   { nom: "Violet", acc: "#8D7CFF", rgb: "141, 124, 255", clair: "#C9C1FF", texte: "#0B0A1A" },
  perso:    { nom: "Ma couleur", acc: "#60A5FA", rgb: "96, 165, 250", clair: "#BFDBFE", texte: "#0B1220" },
};
/** Une couleur libre → ses variantes : version claire, et texte noir ou blanc selon la luminosité (contraste). */
function accentDe(hex: string) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const clair = "#" + [r, g, b].map((v) => Math.round(v + (255 - v) * 0.6).toString(16).padStart(2, "0")).join("");
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return { nom: "Ma couleur", acc: hex, rgb: `${r}, ${g}, ${b}`, clair, texte: lum > 0.5 ? "#0B1220" : "#FFFFFF" };
}
/** Fond de la carte choisi (2D et 3D), ou null pour celui de l'apparence. */
export let FOND_CARTE: string | null = null;
/** Les couleurs d'origine, pour « Rétablir ». */
const COULEURS_DEFAUT = {
  genres: Object.fromEntries(Object.entries(APPARENCE).map(([g, a]) => [g, a.couleur])) as Record<Genre, string>,
  medias: { ...COULEUR_MEDIA } as Record<string, string>,
  trunk: COULEUR_TRUNK,
};
const HEX = /^#[0-9a-f]{6}$/i;
/** Applique des couleurs (celles qui manquent reprennent leur valeur d'origine). */
export function appliquerCouleurs(c: Couleurs | null | undefined) {
  (Object.keys(APPARENCE) as Genre[]).forEach((g) => {
    const v = c?.genres?.[g];
    APPARENCE[g].couleur = v && HEX.test(v) ? v : COULEURS_DEFAUT.genres[g];
  });
  const m = COULEUR_MEDIA as unknown as Record<string, string>;
  Object.keys(COULEURS_DEFAUT.medias).forEach((k) => {
    const v = c?.medias?.[k];
    m[k] = v && HEX.test(v) ? v : COULEURS_DEFAUT.medias[k];
  });
  COULEUR_TRUNK = c?.trunk && HEX.test(c.trunk) ? c.trunk : COULEURS_DEFAUT.trunk;
  // Apparence de l'interface : « Noir studio » = noir pur, majuscules espacées, sans arrondis.
  if (typeof document !== "undefined") {
    document.body.classList.toggle("theme-studio", c?.theme === "studio");
    document.body.classList.toggle("theme-clair", c?.theme === "clair");
    // Fonds choisis : carte (2D et 3D) et interface (panneaux, barre).
    FOND_CARTE = c?.fondCarte && HEX.test(c.fondCarte) ? c.fondCarte : null;
    const b = document.body.style;
    // L'apparence Noir studio reste monochrome (accent blanc) ; sinon, l'accent choisi.
    const a = c?.accent === "perso" && c.accentPerso && HEX.test(c.accentPerso) ? accentDe(c.accentPerso) : ACCENTS[c?.accent ?? "bleu"] ?? ACCENTS.bleu;
    if (c?.theme === "studio") ["--acc", "--acc-rgb", "--acc-clair", "--acc-texte"].forEach((k) => b.removeProperty(k));
    else { b.setProperty("--acc", a.acc); b.setProperty("--acc-rgb", a.rgb); b.setProperty("--acc-clair", a.clair); b.setProperty("--acc-texte", a.texte); }
    if (FOND_CARTE) b.setProperty("--fond-carte", FOND_CARTE); else b.removeProperty("--fond-carte");
    if (c?.fondInterface && HEX.test(c.fondInterface)) { b.setProperty("--bg", c.fondInterface); b.setProperty("--bg2", c.fondInterface); }
    else { b.removeProperty("--bg"); b.removeProperty("--bg2"); }
  }
}
