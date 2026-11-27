import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { readFileSync } from "node:fs";

// La version (package.json) : « v2.0 » dans le titre, l'interface et le nom du fichier livré.
const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const VERSION = `v${version.split(".").slice(0, 2).join(".")}`;

// Tout tient dans UN fichier HTML : scripts, styles, three.js compris.
// On le copie sur un PC, on l'ouvre en double-cliquant, il marche sans
// réseau. La politique de sécurité du fichier (index.html) interdit en plus
// toute connexion sortante.
export default defineConfig({
  base: "./",
  define: { __VERSION__: JSON.stringify(VERSION) },
  plugins: [viteSingleFile(), { name: "version", transformIndexHtml: (html: string) => html.replaceAll("%VERSION%", VERSION) }],
  build: { cssCodeSplit: false, assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 2000 },
});
