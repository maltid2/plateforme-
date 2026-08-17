import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SentinelScope — See every exposed asset before attackers do",
  description:
    "Discover your external attack surface, continuously test your applications, and turn security findings into clear, prioritized actions.",
  metadataBase: new URL("https://sentinelscope.example"),
  openGraph: {
    title: "SentinelScope",
    description:
      "Continuous attack surface intelligence for teams that cannot afford blind spots.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
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
