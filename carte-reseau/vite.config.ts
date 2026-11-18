import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Tout tient dans UN fichier HTML : scripts, styles, three.js compris.
// On le copie sur un PC, on l'ouvre en double-cliquant, il marche sans
// réseau. La politique de sécurité du fichier (index.html) interdit en plus
// toute connexion sortante.
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
  build: { cssCodeSplit: false, assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 2000 },
});
