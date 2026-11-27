/**
 * La version de l'outil : une seule source, `version` dans package.json
 * (injectée par vite.config.ts). Elle donne aussi son nom au fichier livré :
 * topologie-reseau-v2.0.html (voir scripts/fichier.mjs).
 */
declare const __VERSION__: string;
const VERSION = typeof __VERSION__ === "string" ? __VERSION__ : "dev";
export const NOM_OUTIL = `Topologie réseau ${VERSION}`;
