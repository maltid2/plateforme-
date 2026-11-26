/**
 * Relevés des switchs → carte. Le script « Relever les switchs.bat » se
 * connecte aux switchs ; cette page, elle, lit seulement les fichiers qu'il a
 * écrits. Les sauvegardes de configuration (« Config Switch ») ne sont jamais
 * lues. Un dossier « Sites » entier donne une topologie par site.
 */
import { informer } from "../boites.ts";
import { lireTexte, pl, telecharger } from "./outils.ts";

export type ContexteReleves = {
  /** Crée une topologie et l'affiche. */
  creer: (nom: string, texte: string) => void;
  /** Ajoute un export Genetec à la topologie affichée. */
  ajouterGenetec: (f: File) => Promise<string>;
  enregistrer: () => void;
};

export async function importerReleves(liste: File[], ctx: ContexteReleves) {
  try {
    const { relevesVersTexte, aIgnorer, siteDuReleve } = await import("../releve.ts");
    const fichiers = await Promise.all(liste.map(async (f) => {
      const chemin = ((f as File & { webkitRelativePath?: string }).webkitRelativePath ?? "").split("/").slice(0, -1).join("/");
      const base = { nom: f.name, chemin };
      return aIgnorer(base) ? { ...base, texte: "" } : { ...base, texte: await lireTexte(f) };
    }));
    // Une topologie par site (le dossier « Sites » peut en contenir plusieurs).
    const siteDe = (f: { chemin: string; texte: string }) => siteDuReleve(f.texte) || f.chemin.match(/(?:^|\/)Sites\/([^/]+)/i)?.[1] || "";
    const sites = [...new Set(fichiers.map(siteDe).filter(Boolean))];
    const groupes = sites.length
      ? sites.map((s) => ({ site: s, fichiers: fichiers.filter((f) => siteDe(f) === s || (!siteDe(f) && sites.length === 1)) }))
      : [{ site: "", fichiers }];
    const bilans: string[] = [];
    let crees = 0;
    for (const g of groupes) {
      try {
        const r = relevesVersTexte(g.fichiers);
        ctx.creer(r.site, r.texte);
        crees++;
        // Un export Genetec dans le lot (pas le _bilan.csv du script) : gardé pour la comparaison.
        for (const f of liste.filter((x) => /\.(csv|xlsx)$/i.test(x.name) && !aIgnorer({ nom: x.name }))) {
          try { await ctx.ajouterGenetec(f); } catch { /* pas un export Genetec */ }
        }
        ctx.enregistrer();
        const nSw = r.onglets.find((o) => o.nom === "Switchs")?.lu ?? "";
        const crit = r.anomalies.filter((a) => a.gravite === "critique").length;
        const nonPlaces = r.onglets.find((o) => o.nom === "Équipements" && /non placés/.test(o.lu));
        bilans.push(`Site « ${r.site} » : ${nSw} relevés, ${pl(r.equipements, "équipement")}, ${pl(r.liaisons, "câble")}.`
          + (r.anomalies.length ? `\n${pl(r.anomalies.length, "anomalie")}${crit ? ` dont ${pl(crit, "critique")}` : ""} : sur la fiche des switchs et à la fin du texte.` : "")
          + (nonPlaces ? `\n${nonPlaces.lu}.` : ""));
      } catch (err) { bilans.push(`${g.site ? `Site « ${g.site} » : ` : ""}${(err as Error).message}`); }
    }
    const configs = fichiers.filter((f) => /configuration/.test(aIgnorer(f) ?? "")).length;
    void informer(crees ? (crees > 1 ? `${crees} sites importés` : "Relevés importés") : "Aucun relevé lu", bilans.join("\n\n")
      + (configs ? `\n\n${pl(configs, "sauvegarde")} de configuration ${configs > 1 ? "laissées" : "laissée"} de côté (jamais ${configs > 1 ? "lues" : "lue"}).` : ""));
  } catch (err) { void informer("Relevés illisibles", (err as Error).message); }
}

/** Le script de relevé, identique à l'original (fins de ligne Windows), et le mode d'emploi. */
export async function telechargerScript() {
  const { default: script } = await import("../../releve-switchs/Relever les switchs.bat?raw");
  telecharger("Relever les switchs.bat", script.replace(/\r?\n/g, "\r\n"), "application/octet-stream");
  void informer("Script de relevé des switchs", "1. Créez un dossier (ex. « Carto Réseau ») et mettez-y « Relever les switchs.bat » et plink.exe (outil de PuTTY).\n"
    + "2. Double-cliquez le script sur un PC du réseau des switchs : il demande le site, les IP des switchs et les identifiants, puis relève chaque switch.\n"
    + "3. Ici : Importer › Relevés des switchs, et choisissez le dossier « Sites › votre site » (ou « Log Switch »).\n\n"
    + "Le script ne fait que lire (show …). Les sauvegardes de configuration qu'il range dans « Config Switch » ne sont jamais lues par cette page.");
}
