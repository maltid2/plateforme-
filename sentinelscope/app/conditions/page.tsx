import type { Metadata } from "next";
import LegalShell from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description: "Conditions générales d'utilisation du service SentinelScope.",
};

export default function Conditions() {
  return (
    <LegalShell title="Conditions d'utilisation" updated="septembre 2026">
      <p>
        Les présentes conditions régissent l&apos;utilisation du service
        SentinelScope. En utilisant le service, vous acceptez ces conditions.
      </p>

      <h2>Objet du service</h2>
      <p>
        SentinelScope propose un audit de sécurité automatisé et non intrusif
        d&apos;un site web accessible publiquement : contrôle du chiffrement
        (SSL/TLS), des en-têtes de sécurité, des fichiers exposés, de la
        réputation, des vulnérabilités connues (CVE) et d&apos;éléments de
        conformité. Le résultat est fourni à titre informatif.
      </p>

      <h2>Usage autorisé</h2>
      <p>
        Vous vous engagez à n&apos;analyser que des sites dont vous êtes
        propriétaire ou pour lesquels vous disposez d&apos;une autorisation
        explicite. Toute utilisation du service pour analyser un site sans
        autorisation, ou à des fins malveillantes, est strictement interdite et
        relève de votre seule responsabilité.
      </p>

      <h2>Limitation de responsabilité</h2>
      <p>
        L&apos;audit est fourni « en l&apos;état », sans garantie
        d&apos;exhaustivité. Un résultat favorable ne garantit pas
        l&apos;absence de toute vulnérabilité, et l&apos;éditeur ne saurait être
        tenu responsable des dommages directs ou indirects résultant de
        l&apos;utilisation ou de l&apos;impossibilité d&apos;utiliser le service.
      </p>

      <h2>Disponibilité</h2>
      <p>
        L&apos;éditeur s&apos;efforce d&apos;assurer la disponibilité du service
        mais ne garantit pas un fonctionnement ininterrompu. Le service peut
        être modifié, suspendu ou interrompu à tout moment.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Le service, son interface et son contenu sont protégés. Toute
        reproduction non autorisée est interdite.
      </p>

      <h2>Droit applicable</h2>
      <p>
        Les présentes conditions sont soumises au droit français. En cas de
        litige, et à défaut de résolution amiable, les tribunaux compétents
        seront ceux du ressort du siège de l&apos;éditeur.
      </p>

      <h2>Contact</h2>
      <p>Pour toute question : [À compléter : adresse e-mail de contact].</p>
    </LegalShell>
  );
}
