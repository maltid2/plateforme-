import type { Genre } from "./saisie.ts";

/** Une couleur et un sigle par type : la carte se lit avant les étiquettes. */
export const APPARENCE: Record<Genre, { couleur: string; sigle: string }> = {
  passerelle: { couleur: "#8D7CFF", sigle: "GW" },
  parefeu:    { couleur: "#FF7A59", sigle: "FW" },
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

export const COULEUR_LIEN = "#5E7A9B";
export const COULEUR_INTERSITE = "#8D7CFF";
/** Un trunk se repère de loin : violet clair, plus épais qu'un lien d'accès. */
export const COULEUR_TRUNK = "#B4A6FF";

/**
 * Couleur d'un câble = son support. Fibre orange (la couleur des jarretières
 * multimode), cuivre bleu, radio jaune, VPN violet en pointillés. Le trunk se
 * lit à l'épaisseur et à son étiquette, pas à la couleur.
 */
export const COULEUR_MEDIA = { fibre: "#FF9F43", cuivre: "#4FC3F7", dac: "#2DD4BF", coax: "#D08C5B", serie: "#F472B6", usb: "#B8C4D6", radio: "#F2C94C", vpn: "#A99CFF", inconnu: "#8B98A8" } as const;
