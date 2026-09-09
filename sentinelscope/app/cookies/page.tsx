import type { Metadata } from "next";
import LegalShell from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Politique cookies",
  description: "Utilisation des cookies sur SentinelScope.",
};

export default function Cookies() {
  return (
    <LegalShell title="Politique cookies" updated="septembre 2026">
      <p>
        Cette page explique l&apos;utilisation des cookies et technologies
        similaires sur SentinelScope.
      </p>

      <h2>Qu&apos;est-ce qu&apos;un cookie ?</h2>
      <p>
        Un cookie est un petit fichier déposé sur votre appareil lors de la
        visite d&apos;un site. Il permet notamment d&apos;assurer le bon
        fonctionnement du site ou de mémoriser des préférences.
      </p>

      <h2>Cookies utilisés</h2>
      <p>
        SentinelScope privilégie une approche minimale. Le service fonctionne
        sans compte et n&apos;utilise pas de cookies publicitaires ni de suivi à
        des fins marketing. Seuls des cookies strictement nécessaires au
        fonctionnement et à la sécurité peuvent être utilisés ; ceux-ci ne
        requièrent pas de consentement.
      </p>

      <h2>Mesure d&apos;audience</h2>
      <p>
        Si un outil de mesure d&apos;audience respectueux de la vie privée était
        ajouté à l&apos;avenir, il serait mentionné ici et, le cas échéant,
        soumis à votre consentement préalable.
      </p>

      <h2>Gérer les cookies</h2>
      <p>
        Vous pouvez à tout moment configurer votre navigateur pour refuser ou
        supprimer les cookies. Le blocage des cookies strictement nécessaires
        peut toutefois affecter le fonctionnement du site.
      </p>

      <h2>Contact</h2>
      <p>
        Pour toute question relative aux cookies : [À compléter : adresse
        e-mail de contact]. Voir aussi notre{" "}
        <a href="/confidentialite">politique de confidentialité</a>.
      </p>
    </LegalShell>
  );
}
