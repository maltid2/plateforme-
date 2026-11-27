/** La fenêtre « Logo et nom de l'entreprise » (menu Fichiers › Outils, ou clic sur le logo). */
import { ecrireEntreprise, lireEntreprise, LOGO_MAX_OCTETS, marqueEntreprise } from "../entreprise.ts";
import { notifier } from "./toast.ts";

export function ouvrirEntreprise(apres: () => void) {
  let logo = lireEntreprise().logo;
  const d = document.createElement("dialog");
  d.className = "colonnes boite-entreprise";
  d.innerHTML = `<form method="dialog">
    <h2>Logo et nom de l'entreprise</h2>
    <p class="aide-col">En haut de l'outil et sur les documents (PDF, préconisations, visionneuses). Le logo reste sur ce poste : il n'est envoyé nulle part.</p>
    <label class="champ-entreprise">Nom <input name="nom" maxlength="40" autocomplete="off" /></label>
    <div class="apercu-entreprise"></div>
    <p class="boutons-logo"><button type="button" data-a="choisir">Choisir un logo (PNG, JPG, SVG)…</button> <button type="button" data-a="retirer">Retirer le logo</button></p>
    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden />
    <div class="boutons-col"><button type="button" data-fermer>Annuler</button><button value="ok" type="submit" class="primaire">Enregistrer</button></div>
  </form>`;
  const nom = d.querySelector<HTMLInputElement>("[name=nom]")!;
  const fichier = d.querySelector<HTMLInputElement>("input[type=file]")!;
  const apercu = () => { d.querySelector(".apercu-entreprise")!.innerHTML = marqueEntreprise({ nom: nom.value, logo }) || "<em>Aucun</em>"; };
  nom.value = lireEntreprise().nom;
  nom.addEventListener("input", apercu);
  d.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>("[data-a], [data-fermer]");
    if (a?.dataset.a === "choisir") fichier.click();
    if (a?.dataset.a === "retirer") { logo = ""; apercu(); }
    if (a?.hasAttribute("data-fermer")) d.close();
  });
  fichier.addEventListener("change", () => {
    const f = fichier.files?.[0];
    fichier.value = "";
    if (!f) return;
    if (f.size > LOGO_MAX_OCTETS) { notifier(`Logo trop lourd (${Math.round(f.size / 1024)} Ko) : ${LOGO_MAX_OCTETS / 1024} Ko au plus.`); return; }
    const r = new FileReader();
    r.onload = () => { logo = String(r.result); apercu(); };
    r.readAsDataURL(f);
  });
  d.addEventListener("close", () => {
    if (d.returnValue === "ok") { ecrireEntreprise({ nom: nom.value.trim(), logo }); apres(); notifier("Logo et nom de l'entreprise enregistrés."); }
    d.remove();
  });
  apercu();
  document.body.append(d);
  d.showModal();
  nom.focus();
}
