import type { Metadata } from "next";
import Accueil from "./Accueil";

export const metadata: Metadata = {
  title: "Espace client",
  description: "Votre espace SentinelScope : le jumeau 3D de votre infrastructure, l'audit de vos agents IA et la veille commerce de votre boutique.",
};

export default function Page() {
  return <Accueil />;
}
