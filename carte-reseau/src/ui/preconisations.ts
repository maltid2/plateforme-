/**
 * Le rapport de préconisations (bouton « ⚑ Générer les préconisations ») :
 * sécurité, flux et comparaison avec Genetec, dans une grande fenêtre
 * imprimable. L'export Genetec est gardé avec la topologie.
 */
import { analyserSecurite } from "../securite.ts";
import { rapportSecurite } from "../vueSecurite.ts";
import type { Inventaire } from "../saisie.ts";
import type { Topologie } from "../projets.ts";
import { lireTableur } from "../tableur.ts";
import { lireTexte, pl } from "./outils.ts";
import { notifier } from "./toast.ts";

export type ContextePreconisations = {
  inv: () => Inventaire;
  topologie: () => Topologie;
  enregistrer: () => void;
  /** Montrer un équipement sur la carte (le rapport se ferme). */
  voir: (nom: string) => void;
  texte: () => string;
  ecrireTexte: (texte: string, annonce?: string) => void;
  auteur: () => string;
};

export function creerPreconisations(ctx: ContextePreconisations) {
  let fenetre: HTMLDialogElement | null = null;
  const bilan = () => analyserSecurite(ctx.inv(), ctx.topologie().genetec);

  function remplir() {
    const corps = fenetre!.querySelector<HTMLElement>(".rapport-corps")!;
    const haut = corps.scrollTop;
    corps.innerHTML = ctx.inv().equipements.length
      ? rapportSecurite(bilan(), { titre: ctx.topologie().nom })
      : `<p class="s-vide">La carte est vide : ajoutez des équipements, importez un Excel ou les relevés des switchs, puis générez les préconisations.</p>`;
    corps.scrollTop = haut;
  }

  function ouvrir() {
    if (!fenetre) {
      fenetre = document.createElement("dialog");
      fenetre.className = "colonnes rapport";
      fenetre.innerHTML = `<form method="dialog"><div class="rapport-corps"></div><div class="boutons-col"><button value="ok" type="submit" class="primaire">Fermer</button></div></form>`;
      fenetre.addEventListener("click", (e) => {
        const t = e.target as HTMLElement;
        if (t === fenetre) { fenetre!.close(); return; }   // clic à côté : on ferme
        const nom = t.closest<HTMLElement>("[data-nom]")?.dataset.nom;
        if (nom) { fenetre!.close(); ctx.voir(nom); return; }
        const a = t.closest<HTMLElement>("[data-s]")?.dataset.s;
        if (a === "imprimer") imprimer();
        if (a === "genetec") document.getElementById("f-genetec")?.click();
        if (a === "noms-genetec") renommerGenetec();
      });
      document.body.append(fenetre);
    }
    remplir();
    fenetre.showModal();
  }

  function imprimer() {
    document.getElementById("impression")?.remove();
    const d = document.createElement("div");
    d.id = "impression";
    d.innerHTML = `<section class="i-page i-secu">${rapportSecurite(bilan(), {
      titre: ctx.topologie().nom, impression: true, auteur: ctx.auteur(),
      date: new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) })}</section>`;
    document.body.append(d);
    const fin = () => { d.remove(); window.removeEventListener("afterprint", fin); };
    window.addEventListener("afterprint", fin);
    setTimeout(() => window.print(), 50);
  }

  /** Les noms de Genetec remplacent ceux de la carte (« axis-accc8e010001 » → « CAM-BATA-Couloir-1 »). */
  function renommerGenetec() {
    const pris = new Set(ctx.inv().equipements.map((e) => e.nom.toLowerCase()));
    const paires: [string, string][] = [];
    bilan().genetec.ecartsNom.forEach((r) => {
      const nouveau = r.unite.nom.split(/\s*\/\s*/)[0].replace(/[\s:|#]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      if (!nouveau || pris.has(nouveau.toLowerCase())) return;
      pris.add(nouveau.toLowerCase());
      paires.push([r.eq!.nom, nouveau]);
    });
    if (!paires.length) { notifier("Aucun nom à reprendre (déjà utilisés sur la carte)."); return; }
    let texte = ctx.texte();
    for (const [ancien, nouveau] of paires) {
      const re = new RegExp(`(^|[\\s>,:|])${ancien.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[\\s:|,<]|->)`, "gim");
      texte = texte.replace(re, (_m, avant) => `${avant}${nouveau}`);
    }
    ctx.ecrireTexte(texte, `${pl(paires.length, "équipement")} ${paires.length > 1 ? "renommés" : "renommé"} avec les noms Genetec.`);
  }

  /** Un export Genetec (.csv / .xlsx) ajouté à la topologie affichée. */
  async function ajouterGenetec(f: File): Promise<string> {
    const { lireGenetec, lignesCsv } = await import("../genetecLecture.ts");
    const tableaux = /\.xlsx$/i.test(f.name)
      ? (await lireTableur(f.name, await f.arrayBuffer())).map((x) => x.lignes)
      : [lignesCsv(await lireTexte(f))];
    const r = lireGenetec(tableaux, f.name, ctx.topologie().genetec);
    ctx.topologie().genetec = r.genetec;
    return r.msg;
  }

  async function importerGenetec(fichiers: File[]) {
    const msgs: string[] = [];
    for (const f of fichiers) {
      try { msgs.push(`${f.name} : ${await ajouterGenetec(f)}`); } catch (err) { msgs.push((err as Error).message); }
    }
    ctx.enregistrer();
    if (fenetre?.open) remplir();
    else notifier(`Genetec : ${msgs.join(" · ")}. Comparaison dans « ⚑ Générer les préconisations ».`);
  }

  return {
    ouvrir,
    /** Après une modification de la carte : le rapport ouvert suit. */
    rafraichir() { if (fenetre?.open) remplir(); },
    ajouterGenetec,
    importerGenetec,
  };
}
