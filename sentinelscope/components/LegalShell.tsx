import Link from "next/link";
import { ArrowLeft, Radar } from "lucide-react";
import { Container } from "./ui";
import Footer from "./Footer";

/** Gabarit commun aux pages légales : en-tête sobre (logo + retour) + contenu. */
export default function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-line bg-bg/70 backdrop-blur-xl">
        <Container className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-bold text-ink">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-acc-violet/12 ring-1 ring-acc-violet/25">
              <Radar className="h-[18px] w-[18px] text-acc-violet" strokeWidth={2.2} />
            </span>
            Sentinel<span className="text-acc-violet">Scope</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l&apos;accueil
          </Link>
        </Container>
      </header>

      <main>
        <Container className="max-w-3xl py-16 sm:py-20">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {title}
          </h1>
          {updated && (
            <p className="mt-3 text-sm text-muted">Dernière mise à jour : {updated}</p>
          )}
          <div className="legal mt-8">{children}</div>
        </Container>
      </main>

      <Footer />
    </>
  );
}
