import type { Metadata } from "next";
import LegalShell from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Comment SentinelScope traite les données personnelles, conformément au RGPD.",
};

export default function Confidentialite() {
  return (
    <LegalShell title="Politique de confidentialité" updated="septembre 2026">
      <p>
        La présente politique décrit la manière dont SentinelScope traite les
        données à caractère personnel, conformément au Règlement général sur la
        protection des données (RGPD) et à la loi Informatique et Libertés.
      </p>

      <h2>Responsable du traitement</h2>
      <p>
        Le responsable du traitement est l&apos;éditeur du site (voir les{" "}
        <a href="/mentions-legales">mentions légales</a>). Pour toute question :
        [À compléter : adresse e-mail de contact].
      </p>

      <h2>Données collectées</h2>
      <p>SentinelScope est conçu pour minimiser la collecte de données :</p>
      <ul>
        <li>
          <strong>Aucun compte n&apos;est requis</strong> pour lancer un audit.
        </li>
        <li>
          <strong>L&apos;adresse du site à auditer</strong> que vous saisissez
          est utilisée uniquement pour réaliser l&apos;analyse demandée.
        </li>
        <li>
          Des <strong>données techniques</strong> minimales (adresse IP,
          journaux serveur) peuvent être traitées de façon temporaire pour la
          sécurité et le bon fonctionnement du service.
        </li>
      </ul>

      <h2>Finalités et base légale</h2>
      <ul>
        <li>
          Réaliser l&apos;audit demandé — base légale : exécution du service à
          votre demande.
        </li>
        <li>
          Assurer la sécurité et prévenir les abus (limitation du nombre de
          requêtes) — base légale : intérêt légitime.
        </li>
      </ul>

      <h2>Conservation</h2>
      <p>
        Les analyses sont réalisées de manière éphémère : le rapport est généré
        à la volée et n&apos;est pas conservé durablement par le service. Les
        journaux techniques sont conservés pour une durée limitée nécessaire à
        la sécurité.
      </p>

      <h2>Partage avec des tiers</h2>
      <p>
        Pour enrichir l&apos;audit, certaines vérifications interrogent des
        services tiers (par exemple les bases de vulnérabilités publiques et des
        services de réputation). Aucune donnée personnelle n&apos;est vendue.
        L&apos;hébergement est assuré par Vercel.
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous disposez d&apos;un droit d&apos;accès, de rectification,
        d&apos;effacement, de limitation et d&apos;opposition. Pour les exercer,
        écrivez à : [À compléter : adresse e-mail de contact]. Vous pouvez
        également introduire une réclamation auprès de la CNIL (
        <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">
          cnil.fr
        </a>
        ).
      </p>

      <h2>Cookies</h2>
      <p>
        L&apos;usage des cookies est détaillé dans notre{" "}
        <a href="/cookies">politique cookies</a>.
      </p>
    </LegalShell>
  );
}
