"use client";

import Scene3D from "@/components/espace/Scene3D";

// Référence stable : l'effet de chargement ne doit pas se relancer à chaque rendu.
const charger = () => import("@/components/espace/agentshield/scene.js");

export default function Module() {
  return (
    <Scene3D
      charger={charger}
      classe="esp-agents"
      titre="AgentShield"
      texte="Une analyse de configuration lancée chez vous : quels outils chaque agent atteint, et où aucune règle ne l'arrête."
      apercu={{ src: "/espace/agentshield-apercu.webp", alt: "Anneau d'agents autour d'un noyau d'outils : une seule règle en place, dix-sept chemins ouverts.", largeur: 1200, hauteur: 720 }}
    />
  );
}
