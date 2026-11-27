// Le fichier livré porte le numéro de version : topologie-reseau-v<majeur.mineur>.html
// (+ son empreinte SHA-256). Les fichiers des versions précédentes sont retirés du
// dossier : leur historique reste dans git. Lancé par « npm run fichier ».
import { createHash } from "node:crypto";
import { copyFileSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const nom = `topologie-reseau-v${version.split(".").slice(0, 2).join(".")}.html`;
for (const f of readdirSync(".")) if (/^topologie-reseau-v[\d.]+\.html(\.sha256)?$/.test(f) && !f.startsWith(nom)) rmSync(f);
copyFileSync("dist/index.html", nom);
const h = createHash("sha256").update(readFileSync(nom)).digest("hex");
writeFileSync(`${nom}.sha256`, `${h}  ${nom}\n`);
console.log(nom, "· SHA-256", h);
