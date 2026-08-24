/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
};

export default nextConfig;
