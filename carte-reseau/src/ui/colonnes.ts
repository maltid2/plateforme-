/**
 * La fenêtre « Ce que l'outil a compris de votre tableau » : avant un import
 * Excel / CSV, chaque colonne avec ce que l'outil y a reconnu, à corriger au
 * besoin. Les corrections sont retenues sur ce poste pour les imports suivants.
 */
import { colonnesDe, SENS, type Feuille, type Sens } from "../tableur.ts";

const CLE_COLONNES = "carte-reseau:colonnes";
function lireCorrections(): Map<string, Sens> {
  try { return new Map(Object.entries(JSON.parse(localStorage.getItem(CLE_COLONNES) ?? "{}")) as [string, Sens][]); } catch { return new Map(); }
}
export function choisirColonnes(feuilles: Feuille[]): Promise<Map<string, Sens> | null> {
  const memo = lireCorrections();
  const blocs = colonnesDe(feuilles, memo);
  if (!blocs.length) return Promise.resolve(memo);
  const auto = new Map(colonnesDe(feuilles).flatMap((b) => b.colonnes.map((c) => [c.cle, c.sens] as const)));
  const choix = new Map<string, Sens>(blocs.flatMap((b) => b.colonnes.map((c) => [c.cle, c.sens] as const)));
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const d = document.createElement("dialog");
  d.className = "colonnes";
  d.innerHTML = `<form method="dialog">
    <h2>Ce que l'outil a compris de votre tableau</h2>
    <p class="aide-col">Vérifiez chaque colonne : si une colonne est mal comprise, choisissez ce qu'elle contient. Vos choix sont retenus pour les prochains imports. Rien ne quitte ce PC.</p>
    <div class="blocs-col">${blocs.map((b) => `<section>
      <h3>${esc(b.bloc)}${b.reconnu ? "" : ` <span class="attention-col">⚠ aucune colonne « Nom » reconnue : indiquez-la ci-dessous</span>`}</h3>
      <table><thead><tr><th>Colonne de votre fichier</th><th>Exemples</th><th>Ce qu'elle contient</th></tr></thead><tbody>
      ${b.colonnes.map((c) => `<tr class="${c.sens === "info" ? "col-info" : c.sens === "ignorer" ? "col-ignoree" : ""}"><td><b>${esc(c.titre)}</b></td>
        <td class="ex-col">${c.exemples.filter(Boolean).map(esc).join(" · ") || "—"}</td>
        <td><select data-cle="${esc(c.cle)}">${SENS.map(([v, t]) => `<option value="${v}"${v === c.sens ? " selected" : ""}>${t}</option>`).join("")}</select></td></tr>`).join("")}
      </tbody></table></section>`).join("")}</div>
    <div class="boutons-col"><button type="button" data-fermer>Annuler</button><button value="ok" type="submit" class="primaire">Importer</button></div>
  </form>`;
  document.body.append(d);
  d.addEventListener("click", (ev) => { if ((ev.target as Element).closest("[data-fermer]")) d.close("annuler"); });
  d.addEventListener("change", (ev) => {
    const sel = ev.target as HTMLSelectElement;
    const cle = sel.dataset.cle;
    if (!cle) return;
    choix.set(cle, sel.value as Sens);
    // Le même titre dans un autre onglet suit le même choix.
    d.querySelectorAll<HTMLSelectElement>("select[data-cle]").forEach((x) => { if (x.dataset.cle === cle) x.value = sel.value; });
    d.querySelectorAll<HTMLSelectElement>("select[data-cle]").forEach((x) => x.closest("tr")!.className = x.value === "info" ? "col-info" : x.value === "ignorer" ? "col-ignoree" : "");
  });
  return new Promise((ok) => {
    d.addEventListener("close", () => {
      const v = d.returnValue;
      d.remove();
      if (v !== "ok") { ok(null); return; }
      // On ne retient que ce qui diffère de la lecture automatique.
      const garder = new Map(memo);
      choix.forEach((sens, cle) => { if (auto.get(cle) !== sens) garder.set(cle, sens); else garder.delete(cle); });
      try { localStorage.setItem(CLE_COLONNES, JSON.stringify(Object.fromEntries(garder))); } catch { /* stockage indisponible : tant pis */ }
      ok(new Map([...garder, ...choix]));
    });
    d.showModal();
  });
}
export const LIBELLE_COLONNE: Record<string, string> = { type: "Type", ip: "IP", site: "Site", vers: "Branché sur", port: "Port" };
