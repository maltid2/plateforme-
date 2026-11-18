import { defineConfig } from "vite";

// base relative : le dossier dist/ s'ouvre depuis n'importe quel serveur
// interne (ou un partage réseau) sans configuration.
export default defineConfig({ base: "./", build: { chunkSizeWarningLimit: 700 } });
