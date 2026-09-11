import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://sentinelscope-pied.vercel.app";

const DESCRIPTION =
  "SentinelScope réalise un audit de sécurité web réel en quelques minutes : entrez l'adresse de votre site et obtenez un score clair, les vulnérabilités détectées (SSL/TLS, en-têtes, fichiers exposés, RGPD) et les actions à mener — sans installation.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SentinelScope — Audit de sécurité de votre site web",
    template: "%s · SentinelScope",
  },
  description: DESCRIPTION,
  applicationName: "SentinelScope",
  keywords: [
    "audit de sécurité",
    "sécurité site web",
    "scan de vulnérabilités",
    "SSL TLS",
    "en-têtes de sécurité",
    "RGPD",
    "surface d'attaque",
    "cybersécurité",
    "SentinelScope",
  ],
  authors: [{ name: "SentinelScope" }],
  creator: "SentinelScope",
  publisher: "SentinelScope",
  category: "technology",
  alternates: { canonical: "/" },
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    siteName: "SentinelScope",
    title: "SentinelScope — Audit de sécurité de votre site web",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "SentinelScope — Audit de sécurité de votre site web",
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#07090D",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "SentinelScope",
      url: SITE_URL,
      description: DESCRIPTION,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "SentinelScope",
      description: DESCRIPTION,
      inLanguage: "fr-FR",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      name: "SentinelScope",
      applicationCategory: "SecurityApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description: DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          // Données structurées statiques (aucune donnée utilisateur) — SEO.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased bg-bg text-ink selection:bg-acc-violet/30">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
