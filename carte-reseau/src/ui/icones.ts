/**
 * Les icônes de l'interface, au trait (24 × 24, dans l'esprit de Lucide),
 * incluses dans le fichier : rien n'est téléchargé. Elles prennent la couleur
 * du texte. Dans le HTML : <i data-ic="plus"></i>, remplacé au démarrage.
 */
const TRACES: Record<string, string> = {
  plus: "M12 5v14M5 12h14",
  moins: "M5 12h14",
  cable: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  importer: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  imprimer: "M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z",
  bouclier: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
  crayon: "M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z",
  corbeille: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  fermer: "M18 6 6 18M6 6l12 12",
  plus3: "M5 12h.01M12 12h.01M19 12h.01",
  dossier: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  palette: "M12 22a10 10 0 1 1 10-10c0 2.5-2 3.5-4 3.5h-2.5a2 2 0 0 0-1.5 3.3A1.6 1.6 0 0 1 12 22zM7.5 10.5h.01M10.5 6.5h.01M15.5 7.5h.01",
  aide: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01",
  recentrer: "M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3",
  reseau: "M9 2h6v6H9zM3 16h6v6H3zM15 16h6v6h-6zM12 8v4M6 16v-2h12v2",
  tableau: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9h18M3 15h18M9 3v18",
  video: "M16 10l6-4v12l-6-4M2 6h14v12H2z",
  exemple: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3z",
  chevron: "M6 9l6 6 6-6",
  copier: "M9 9h11v11H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1",
  liste: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
};

/** Le SVG d'une icône (décorative : le texte du bouton, ou son aria-label, dit ce qu'il fait). */
export function icone(nom: keyof typeof TRACES | string): string {
  const d = TRACES[nom];
  if (!d) return "";
  return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
}

/** Remplace chaque <i data-ic="…"> de la page par son icône. */
export function poserIcones(racine: ParentNode = document) {
  racine.querySelectorAll<HTMLElement>("i[data-ic]").forEach((i) => { i.outerHTML = icone(i.dataset.ic!); });
}
