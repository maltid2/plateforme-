import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SentinelScope — Voyez chaque actif exposé avant les attaquants",
  description:
    "Découvrez votre surface d'attaque externe, testez vos applications en continu et transformez les résultats de sécurité en actions claires et priorisées.",
  metadataBase: new URL("https://sentinelscope.example"),
  openGraph: {
    title: "SentinelScope",
    description:
      "Le renseignement continu sur la surface d'attaque pour les équipes qui ne peuvent se permettre aucun angle mort.",
    type: "website",
  },
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
      </head>
      <body className="font-sans antialiased bg-bg text-ink selection:bg-acc-violet/30">
        {children}
      </body>
    </html>
  );
}
