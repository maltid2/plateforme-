/** @type {import('next').NextConfig} */

// En-têtes de sécurité appliqués à toutes les réponses.
// CSP construite à partir des sources réellement utilisées :
//  - 'self' pour l'app et l'API (même origine)
//  - Google Fonts (le site charge Inter via fonts.googleapis / fonts.gstatic)
//  - 'unsafe-inline' pour les styles/scripts inline de Next et Framer Motion
//    (pas de nonce middleware ici) ; PAS de 'unsafe-eval' (inutile en prod)
//  - images en data:/blob: (SVG, rapport ouvert en Blob URL)
//  - frame-ancestors 'none' : le site ne doit jamais être mis en iframe
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
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
  // Le token `__non_webpack_require__` (require natif au runtime) déclenche
  // une règle ESLint no-undef ; on n'échoue pas le build pour autant.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Le moteur d'audit (audit-engine) est chargé au runtime par le require
  // natif de Node, pas par webpack. On force donc son inclusion dans la
  // fonction serverless /api/audit (fichiers .js + la base fingerprints.json).
  experimental: {
    outputFileTracingIncludes: {
      "/api/audit": ["./audit-engine/**/*"],
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
