import type { Genre } from "./saisie.ts";

/**
 * Pictogrammes au trait, dessinés dans un carré de 1 × 1. Écrits à la main
 * en SVG : aucune police d'icônes ni fichier à télécharger.
 */
export const PICTOS: Record<Genre, string> = {
  passerelle: `<rect x="0.08" y="0.5" width="0.84" height="0.32" rx="0.06"/><path d="M0.3 0.5 L0.22 0.18 M0.7 0.5 L0.78 0.18"/><circle cx="0.24" cy="0.66" r="0.03"/><circle cx="0.38" cy="0.66" r="0.03"/>`,
  parefeu: `<rect x="0.1" y="0.12" width="0.8" height="0.76" rx="0.06"/><path d="M0.1 0.37 H0.9 M0.1 0.62 H0.9 M0.37 0.12 V0.37 M0.63 0.37 V0.62 M0.37 0.62 V0.88"/>`,
  switch: `<rect x="0.06" y="0.3" width="0.88" height="0.4" rx="0.05"/><path d="M0.2 0.45 h0.1 M0.4 0.45 h0.1 M0.6 0.45 h0.1 M0.2 0.56 h0.1 M0.4 0.56 h0.1 M0.6 0.56 h0.1"/>`,
  camera: `<path d="M0.08 0.3 H0.68 L0.86 0.42 V0.58 L0.68 0.7 H0.08 Z"/><circle cx="0.72" cy="0.5" r="0.06"/><path d="M0.3 0.7 V0.86 M0.16 0.9 H0.44 M0.08 0.24 H0.74"/>`,
  nvr: `<rect x="0.06" y="0.3" width="0.88" height="0.42" rx="0.05"/><circle cx="0.22" cy="0.51" r="0.07"/><path d="M0.42 0.45 H0.82 M0.42 0.57 H0.7"/>`,
  borne: `<circle cx="0.5" cy="0.7" r="0.05"/><path d="M0.32 0.53 Q0.5 0.38 0.68 0.53 M0.2 0.4 Q0.5 0.16 0.8 0.4 M0.1 0.27 Q0.5 -0.06 0.9 0.27"/>`,
  serveur: `<rect x="0.18" y="0.08" width="0.64" height="0.26" rx="0.04"/><rect x="0.18" y="0.37" width="0.64" height="0.26" rx="0.04"/><rect x="0.18" y="0.66" width="0.64" height="0.26" rx="0.04"/><path d="M0.3 0.21 h0.2 M0.3 0.5 h0.2 M0.3 0.79 h0.2"/>`,
  nas: `<rect x="0.16" y="0.1" width="0.68" height="0.8" rx="0.06"/><path d="M0.3 0.26 H0.7 M0.3 0.42 H0.7 M0.3 0.58 H0.7"/><circle cx="0.5" cy="0.76" r="0.04"/>`,
  poste: `<rect x="0.08" y="0.12" width="0.84" height="0.54" rx="0.05"/><path d="M0.5 0.66 V0.82 M0.3 0.86 H0.7"/>`,
  imprimante: `<path d="M0.26 0.36 V0.1 H0.74 V0.36"/><rect x="0.08" y="0.36" width="0.84" height="0.34" rx="0.05"/><path d="M0.26 0.62 V0.9 H0.74 V0.62"/>`,
  telephone: `<rect x="0.12" y="0.36" width="0.76" height="0.5" rx="0.06"/><path d="M0.2 0.36 Q0.2 0.12 0.5 0.12 Q0.8 0.12 0.8 0.36"/><path d="M0.36 0.52 h0.06 M0.58 0.52 h0.06 M0.36 0.68 h0.06 M0.58 0.68 h0.06"/>`,
  onduleur: `<rect x="0.2" y="0.16" width="0.6" height="0.74" rx="0.06"/><path d="M0.4 0.08 H0.6 M0.54 0.32 L0.42 0.54 H0.58 L0.46 0.76"/>`,
  autre: `<circle cx="0.5" cy="0.5" r="0.36"/><path d="M0.5 0.32 V0.54 M0.5 0.66 V0.68"/>`,
};
