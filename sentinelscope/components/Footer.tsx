import Link from "next/link";
import { Radar } from "lucide-react";
import { Container } from "./ui";

const COLUMNS = [
  {
    title: "Produit",
    links: [
      { label: "Analyse de sécurité", href: "/#features" },
      { label: "Score & note", href: "/#product" },
      { label: "Rapport détaillé", href: "/#product" },
      { label: "Contrôles vérifiés", href: "/#modules" },
      { label: "Questions fréquentes", href: "/#faq" },
    ],
  },
  {
    title: "Mentions légales",
    links: [
      { label: "Mentions légales", href: "/mentions-legales" },
      { label: "Vie privée & RGPD", href: "/confidentialite" },
      { label: "Conditions d'utilisation", href: "/conditions" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-line bg-bg2/40">
      <Container className="py-16">
        <div className="grid gap-12 md:grid-cols-[1.6fr_1fr_1fr]">
          {/* brand */}
          <div className="max-w-xs">
            <Link href="/#top" className="flex items-center gap-2.5 text-lg font-bold text-ink">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-acc-violet/12 ring-1 ring-acc-violet/25">
                <Radar className="h-[18px] w-[18px] text-acc-violet" strokeWidth={2.2} />
              </span>
              Sentinel<span className="text-acc-violet">Scope</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              L&apos;audit de sécurité de votre site en quelques minutes : un
              score clair, les vulnérabilités détectées et les actions à mener.
            </p>
          </div>

          {/* link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/80">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted transition-colors hover:text-ink"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-line pt-8 sm:flex-row">
          <p className="text-sm text-muted">
            © 2026 SentinelScope. Tous droits réservés.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-acc-green shadow-[0_0_8px_#FF7A1A]" />
            Tous les systèmes opérationnels
          </div>
        </div>
      </Container>
    </footer>
  );
}
