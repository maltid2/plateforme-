"use client";

import Scene3D from "@/components/espace/Scene3D";
import RechercheMobile from "@/components/espace/commerce/RechercheMobile";

const charger = () => import("@/components/espace/commerce/scene.js");

export default function Module() {
  return (
    <Scene3D
      charger={charger}
      classe="esp-commerce"
      titre="Veille commerce"
      texte="Cherchez un produit chez vos concurrents Shopify : prix, stock et promotions, lus en direct sur leurs vitrines publiques."
      mobile={<RechercheMobile />}
      apercu={{ src: "/espace/commerce-apercu.webp", alt: "Rubans de prix des concurrents autour d'une surface violette qui représente votre prix ; deux concurrents passent en dessous.", largeur: 1200, hauteur: 560 }}
    />
  );
}
