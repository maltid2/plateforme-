/**
 * Les exports du menu Fichiers : plan 2D (SVG, PNG), image de la 3D, dossier
 * PDF, maquette 3D (GLB) et visionneuse autonome en lecture seule. Tout est
 * produit sur le poste : rien n'est envoyé.
 */
import type { Couleurs } from "../apparence.ts";
import type { Disposition } from "../disposition.ts";
import { elevations } from "../elevation.ts";
import { CLASSIFICATION, imprimer } from "../impression.ts";
import type { Plan2D } from "../plan2d.ts";
import type { Topologie } from "../projets.ts";
import type { Inventaire } from "../saisie.ts";
import type { Vue3D } from "../vue3d.ts";
import { $, fermerMenu, nomFichier, telecharger } from "./outils.ts";

export type ContexteExports = {
  plan: Plan2D; planAJour: () => void;
  inv: () => Inventaire; disp: () => Disposition; site: () => string | null;
  vue: () => "2d" | "3d" | "baies"; v3: () => Vue3D | null; montrer3D: () => Promise<void>;
  topologie: () => Topologie; texte: () => string; auteur: () => string; couleurs: () => Couleurs;
  /** La page d'origine (avant toute modification), modèle de la visionneuse. */
  modele: { head: string; body: string };
};

export function installerExports(ctx: ContexteExports) {
  $("b-svg").addEventListener("click", () => { fermerMenu(); ctx.planAJour(); telecharger(`${nomFichier(ctx.topologie().nom)}-plan.svg`, ctx.plan.exporter(true, ctx.auteur()), "image/svg+xml"); });
  $("b-png").addEventListener("click", async () => {
    fermerMenu();
    const v3 = ctx.v3();
    if (ctx.vue() === "3d" && v3) {
      // Capture dessinée à l'instant : sans cela, l'image WebGL sort vide.
      const b = await v3.capturer();
      if (b) telecharger(`${nomFichier(ctx.topologie().nom)}-3d.png`, b, "image/png");
      return;
    }
    // Le plan 2D est rasterisé en local, sans rien envoyer.
    ctx.planAJour();
    const svg = ctx.plan.exporter(true, ctx.auteur());
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 8000 / Math.max(img.width, img.height));
      const c = Object.assign(document.createElement("canvas"), { width: img.width * k, height: img.height * k });
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => b && telecharger(`${nomFichier(ctx.topologie().nom)}-plan.png`, b, "image/png"));
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
  $("b-pdf").addEventListener("click", () => { fermerMenu(); ctx.planAJour(); imprimer(ctx.inv(), ctx.plan.exporter(true), ctx.topologie().nom, ctx.site(),
    elevations(ctx.inv(), ctx.disp(), { site: ctx.site(), clair: true, camerasEnBaie: $<HTMLSelectElement>("o-cams").value === "baie" }), ctx.auteur()); });
  $("b-glb").addEventListener("click", async () => {
    fermerMenu();
    if (!ctx.v3() || ctx.vue() !== "3d") await ctx.montrer3D();
    const b = await ctx.v3()!.exporterGLB();
    telecharger(`${nomFichier(ctx.topologie().nom)}-3d.glb`, b, "model/gltf-binary");
  });
  $("b-visionneuse").addEventListener("click", () => {
    fermerMenu();
    // Le même outil, la topologie incluse, en lecture seule : il s'ouvre sur
    // n'importe quel poste avec un navigateur, sans réseau ni installation.
    const donnees = JSON.stringify({ nom: ctx.topologie().nom, texte: ctx.texte(), exporte: new Date().toISOString(), classification: CLASSIFICATION, auteur: ctx.auteur(), couleurs: ctx.couleurs() })
      .replace(/</g, "\\u003c");
    const html = `<!doctype html>\n<html lang="fr">\n<head>${ctx.modele.head.replace(/<title>[^<]*<\/title>/, `<title>${ctx.topologie().nom.replace(/</g, "")} · Topologie réseau v1</title>`)}</head>\n<body>\n<script type="application/json" id="carte-donnees">${donnees}</script>\n${ctx.modele.body}\n</body>\n</html>\n`;
    telecharger(`${nomFichier(ctx.topologie().nom)}-visionneuse.html`, html, "text/html;charset=utf-8");
  });
}
