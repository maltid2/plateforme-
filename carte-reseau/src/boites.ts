/**
 * Les petites fenêtres de l'outil, à la place des boîtes du navigateur
 * (alert, prompt, confirm) : même apparence que le reste de l'interface,
 * un vrai titre, des boutons qui disent ce qu'ils font. Tout reste dans
 * la page : rien n'est envoyé nulle part.
 */
const echap = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Ouvre la fenêtre ; rend le bouton choisi (« » si on ferme avec Échap). */
function ouvrir(corps: string, boutons: string, apres: (d: HTMLDialogElement) => void): Promise<string> {
  return new Promise((fin) => {
    const d = document.createElement("dialog");
    d.className = "colonnes boite";
    d.innerHTML = `<form method="dialog">${corps}<div class="boutons-col">${boutons}</div></form>`;
    d.addEventListener("close", () => { fin(d.returnValue); d.remove(); });
    // « Annuler » n'est pas un bouton d'envoi : Entrée dans le champ valide, elle n'annule pas.
    d.addEventListener("click", (e) => { if ((e.target as Element).closest("[data-fermer]")) d.close("annuler"); });
    document.body.append(d);
    d.showModal();
    apres(d);
  });
}

/** Demande un nom (nouveau site, signature…). `null` si l'on annule. */
export async function demander(o: { titre: string; texte?: string; valeur?: string; exemple?: string; ok?: string; vide?: boolean }): Promise<string | null> {
  let champ!: HTMLInputElement;
  const choix = await ouvrir(
    `<h2>${echap(o.titre)}</h2>${o.texte ? `<p class="aide-col">${echap(o.texte)}</p>` : ""}
     <div class="blocs-col"><input name="v" value="${echap(o.valeur ?? "")}" placeholder="${echap(o.exemple ?? "")}" autocomplete="off" maxlength="80"${o.vide ? "" : " required"} /></div>`,
    `<button type="button" data-fermer>Annuler</button><button value="ok" type="submit" class="primaire">${echap(o.ok ?? "Valider")}</button>`,
    (d) => { champ = d.querySelector("input")!; champ.select(); },
  );
  return choix === "ok" ? champ.value.trim() : null;
}

/** Demande de confirmer une action (supprimer…). Le bouton « Annuler » a le focus. */
export async function confirmer(o: { titre: string; texte?: string; ok: string; danger?: boolean }): Promise<boolean> {
  const choix = await ouvrir(
    `<h2>${echap(o.titre)}</h2>${o.texte ? `<p class="aide-col boite-texte">${echap(o.texte)}</p>` : ""}`,
    `<button type="button" data-fermer>Annuler</button><button value="ok" type="submit" class="${o.danger ? "danger plein" : "primaire"}">${echap(o.ok)}</button>`,
    (d) => d.querySelector<HTMLButtonElement>("[data-fermer]")!.focus(),
  );
  return choix === "ok";
}

/** Un message à lire (résultat d'un import, saisie à corriger…). */
export async function informer(titre: string, texte = ""): Promise<void> {
  await ouvrir(
    `<h2>${echap(titre)}</h2>${texte ? `<p class="aide-col boite-texte">${echap(texte)}</p>` : ""}`,
    `<button value="ok" type="submit" class="primaire">OK</button>`,
    (d) => d.querySelector<HTMLButtonElement>("button")!.focus(),
  );
}
