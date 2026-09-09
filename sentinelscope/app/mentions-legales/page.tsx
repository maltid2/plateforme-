import type { Metadata } from "next";
import LegalShell from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales de SentinelScope.",
};

export default function MentionsLegales() {
  return (
    <LegalShell title="Mentions légales" updated="septembre 2026">
      <p>
        Conformément à la loi n° 2004-575 du 21 juin 2004 pour la confiance dans
        l&apos;économie numérique, les informations suivantes sont portées à la
        connaissance des utilisateurs du site SentinelScope.
      </p>

      <h2>Éditeur du site</h2>
      <p>
        <strong>SentinelScope</strong>
        <br />
        [À compléter : raison sociale / nom de l&apos;éditeur]
        <br />
        Statut : [À compléter : auto-entrepreneur, SAS, SASU…]
        <br />
        Adresse : [À compléter : adresse du siège]
        <br />
        SIRET : [À compléter]
        <br />
        Contact : [À compléter : adresse e-mail de contact]
        <br />
        Directeur de la publication : [À compléter : nom]
      </p>

      <h2>Hébergement</h2>
      <p>
        Le site est hébergé par <strong>Vercel Inc.</strong>, 340 S Lemon Ave
        #4133, Walnut, CA 91789, États-Unis —{" "}
        <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">
          vercel.com
        </a>
        .
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble des éléments du site (textes, logo, interface, code,
        graphismes) est la propriété de l&apos;éditeur, sauf mention contraire.
        Toute reproduction ou représentation, totale ou partielle, sans
        autorisation écrite préalable est interdite.
      </p>

      <h2>Responsabilité</h2>
      <p>
        SentinelScope fournit un audit de sécurité automatisé à titre
        informatif. L&apos;éditeur s&apos;efforce d&apos;assurer l&apos;exactitude
        des informations mais ne saurait être tenu responsable des conséquences
        liées à leur utilisation. L&apos;utilisation du service est soumise aux{" "}
        <a href="/conditions">conditions d&apos;utilisation</a>.
      </p>

      <h2>Contact</h2>
      <p>
        Pour toute question relative au site : [À compléter : adresse e-mail de
        contact].
      </p>
    </LegalShell>
  );
}
