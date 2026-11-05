/** @type {import('next').NextConfig} */

// En-têtes de sécurité appliqués à toutes les réponses.
// CSP construite à partir des sources réellement utilisées :
//  - 'self' pour l'app et l'API (même origine)
//  - Google Fonts (le site charge Inter via fonts.googleapis / fonts.gstatic)
//  - 'unsafe-inline' pour les styles/scripts inline de Next et Framer Motion
//    (pas de nonce middleware ici) ; PAS de 'unsafe-eval' en production
//  - images en data:/blob: (SVG, rapport ouvert en Blob URL)
//  - frame-ancestors 'none' : le site ne doit jamais être mis en iframe
//
// Exception développement : webpack enveloppe chaque module dans un eval()
// pour les source maps, et le Fast Refresh de React fait de même. Sans
// 'unsafe-eval' en dev, tout le JavaScript client est refusé par le
// navigateur : la page s'affiche vide (seul le HTML rendu côté serveur
// reste visible, sans aucune animation ni formulaire fonctionnel).
// La CSP de production, elle, ne change pas d'un caractère.
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  scriptSrc,
  isDev ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Le moteur d'audit (audit-engine) est chargé au runtime par le require
  // natif de Node, pas par webpack. On force donc son inclusion dans la
  // fonction serverless /api/audit (fichiers .js + la base fingerprints.json).
  outputFileTracingIncludes: {
    "/api/audit": ["./audit-engine/**/*"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
