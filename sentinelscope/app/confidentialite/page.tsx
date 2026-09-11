import type { Metadata } from "next";
import LegalShell from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Confidentialité — Vie privée & RGPD",
  description:
    "Notre engagement sur votre vie privée, et le cadre légal RGPD (vos droits), clairement séparés.",
};

function PartLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 mt-2 inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-acc-violet">
      <span className="h-1.5 w-1.5 rounded-full bg-acc-violet shadow-[0_0_10px_#8D7CFF]" />
      {children}
    </div>
  );
}

export default function Confidentialite() {
  return (
    <LegalShell title="Politique de confidentialité" updated="septembre 2026">
      <p>
        Cette page se lit en <strong>deux temps</strong>, volontairement séparés
        pour plus de clarté : d&apos;abord notre <strong>engagement concret</strong>{" "}
        sur votre vie privée (en langage simple), puis le <strong>cadre légal</strong>{" "}
        (RGPD) et l&apos;exercice de vos droits.
      </p>

      {/* ─────────── PARTIE 1 : VIE PRIVÉE ─────────── */}
      <div className="mt-10">
        <PartLabel>Partie 1 · Votre vie privée</PartLabel>
      </div>

      <h2>Ce que nous faisons pour la protéger</h2>
      <ul>
        <li>
          <strong>Aucun compte requis</strong> : vous lancez un audit sans
          inscription ni identifiant.
        </li>
        <li>
          <strong>L&apos;adresse que vous saisissez</strong> sert uniquement à
          réaliser l&apos;audit demandé ; le rapport est généré à la volée et
          n&apos;est pas conservé durablement.
        </li>
        <li>
          <strong>Aucun cookie publicitaire</strong> ni traçage à des fins
          marketing (voir la <a href="/cookies">politique cookies</a>).
        </li>
        <li>
          <strong>Audit non intrusif</strong> : nous observons, nous ne
          modifions rien sur le site analysé.
        </li>
      </ul>

      <h2>Ce que nous ne faisons pas</h2>
      <ul>
        <li>Nous ne vendons ni ne louons vos données à des tiers.</li>
        <li>Nous ne faisons pas de profilage publicitaire.</li>
        <li>Nous ne créons pas de dossier durable sur vous.</li>
      </ul>

      <hr className="my-10 border-line" />

      {/* ─────────── PARTIE 2 : RGPD ─────────── */}
      <div>
        <PartLabel>Partie 2 · RGPD &amp; vos droits</PartLabel>
      </div>

      <p>
        Cette partie décrit le traitement des données personnelles au sens du
        Règlement général sur la protection des données (RGPD) et de la loi
        Informatique et Libertés.
      </p>

      <h2>Responsable du traitement</h2>
      <p>
        Le responsable du traitement est l&apos;éditeur du site (voir les{" "}
        <a href="/mentions-legales">mentions légales</a>). Contact : [À
        compléter : adresse e-mail de contact].
      </p>

      <h2>Données traitées et base légale</h2>
      <ul>
        <li>
          <strong>Adresse du site à auditer</strong> — pour exécuter le service
          à votre demande (base légale : exécution du service).
        </li>
        <li>
          <strong>Données techniques minimales</strong> (adresse IP, journaux)
          — pour la sécurité et la prévention des abus (base légale : intérêt
          légitime).
        </li>
      </ul>

      <h2>Durée de conservation</h2>
      <p>
        Les analyses sont éphémères (aucune conservation durable du rapport).
        Les journaux techniques sont conservés pour une durée limitée
        strictement nécessaire à la sécurité.
      </p>

      <h2>Destinataires et sous-traitants</h2>
      <p>
        Certaines vérifications interrogent des services tiers (bases de
        vulnérabilités publiques, services de réputation). L&apos;hébergement
        est assuré par Vercel. Aucune donnée personnelle n&apos;est vendue.
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous disposez des droits d&apos;accès, de rectification,
        d&apos;effacement, de limitation, d&apos;opposition et de portabilité.
        Pour les exercer : [À compléter : adresse e-mail de contact]. Vous
        pouvez aussi saisir la CNIL (
        <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">
          cnil.fr
        </a>
        ).
      </p>
    </LegalShell>
  );
}
