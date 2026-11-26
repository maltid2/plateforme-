/**
 * Le message en bas de l'écran, avec un bouton (« Annuler ») au besoin.
 * Créé au premier message : la page d'origine (modèle de la visionneuse) reste intacte.
 */
let toast: HTMLDivElement | null = null;
let minuteur = 0;

export function notifier(message: string, action?: { libelle: string; faire: () => void }) {
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    document.body.append(toast);
  }
  const t = toast;
  t.replaceChildren(document.createTextNode(message));
  if (action) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = action.libelle;
    b.onclick = () => { t.hidden = true; action.faire(); };
    t.append(b);
  }
  t.hidden = false;
  clearTimeout(minuteur);
  minuteur = window.setTimeout(() => { t.hidden = true; }, action ? 8000 : 3500);
}
