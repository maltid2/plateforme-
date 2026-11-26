/**
 * La fenêtre « Couleurs » : apparence (standard, claire, noir studio), accent
 * de l'interface, fonds, couleurs des câbles et des équipements. Les choix
 * s'appliquent tout de suite et sont retenus sur ce poste.
 */
import { ACCENTS, APPARENCE, appliquerCouleurs, COULEUR_MEDIA, COULEUR_TRUNK, type Accent, type Couleurs } from "../apparence.ts";
import { GENRES, MEDIAS, type Genre, type Media } from "../saisie.ts";

const CLE_COULEURS = "carte-reseau:couleurs";
/** Fond par défaut de chaque apparence (carte et interface). */
const FOND = { standard: "#07090d", clair: "#f5f7fa", studio: "#000000" } as const;

export function lireCouleurs(): Couleurs | null {
  try { return JSON.parse(localStorage.getItem(CLE_COULEURS) ?? "null"); } catch { return null; }
}

export function ouvrirCouleurs(ctx: { lire: () => Couleurs; ecrire: (c: Couleurs) => void; redessiner: () => void }) {
  let couleurs = ctx.lire();
  const changer = (c: Couleurs) => { couleurs = c; ctx.ecrire(c); };
  const fondDefaut = () => FOND[couleurs.theme ?? "standard"];
  const d = document.createElement("dialog");
  d.className = "colonnes couleurs";
  const ligne = (cle: string, libelle: string, valeur: string, pastille: "trait" | "carre") =>
    `<label class="coul"><input type="color" data-cle="${cle}" value="${valeur}" /><i class="${pastille}"></i><span>${libelle}</span></label>`;
  const rendre = () => {
    d.innerHTML = `<form method="dialog">
      <h2>Couleurs</h2>
      <p class="aide-col">Cliquez une pastille pour changer sa couleur : le plan 2D, la 3D, le PDF, le SVG et la visionneuse suivent. Vos couleurs sont retenues sur ce poste.</p>
      <div class="blocs-col">
        <h3>Apparence</h3><div class="grille-coul themes">
          <label class="coul"><input type="radio" name="theme" value="standard" ${!couleurs.theme || couleurs.theme === "standard" ? "checked" : ""} /><span>Standard (sombre)</span></label>
          <label class="coul"><input type="radio" name="theme" value="clair" ${couleurs.theme === "clair" ? "checked" : ""} /><span>Clair — fond blanc, 2D et 3D</span></label>
          <label class="coul"><input type="radio" name="theme" value="studio" ${couleurs.theme === "studio" ? "checked" : ""} /><span>Noir studio — noir pur, majuscules, sans arrondis</span></label>
        </div>
        <h3>Accent de l'interface</h3><div class="grille-coul themes">
          ${(Object.keys(ACCENTS) as Accent[]).filter((k) => k !== "perso").map((k) => `<label class="coul"><input type="radio" name="accent" value="${k}" ${(couleurs.accent ?? "bleu") === k ? "checked" : ""} /><i class="carre" style="display:inline-block;width:16px;height:16px;border-radius:4px;background:${ACCENTS[k].acc}"></i><span>${ACCENTS[k].nom}</span></label>`).join("")}
          <label class="coul"><input type="radio" name="accent" value="perso" ${couleurs.accent === "perso" ? "checked" : ""} /><input type="color" data-cle="a:perso" value="${couleurs.accentPerso ?? "#22C55E"}" /><span>Ma couleur (au choix)</span></label>
        </div>
        <h3>Fonds</h3><div class="grille-coul">
          ${ligne("f:carte", "Fond de la carte (2D et 3D)", couleurs.fondCarte ?? fondDefaut(), "carre")}
          ${ligne("f:interface", "Fond de l'interface", couleurs.fondInterface ?? fondDefaut(), "carre")}
        </div>
        <h3>Câbles</h3><div class="grille-coul">
          ${(Object.keys(MEDIAS) as Media[]).map((m) => ligne(`m:${m}`, MEDIAS[m], (COULEUR_MEDIA as Record<string, string>)[m], "trait")).join("")}
          ${ligne("t:trunk", "Trunk (étiquettes, liseré)", COULEUR_TRUNK, "trait")}
        </div>
        <h3>Équipements</h3><div class="grille-coul">
          ${(Object.keys(GENRES) as Genre[]).map((g) => ligne(`g:${g}`, GENRES[g].libelle, APPARENCE[g].couleur, "carre")).join("")}
        </div>
      </div>
      <div class="boutons-col"><button type="button" data-a="defaut">Couleurs d'origine</button><button value="ok" type="submit" class="primaire">Fermer</button></div>
    </form>`;
  };
  rendre();
  let minuteur = 0;
  const enregistrer = () => {
    appliquerCouleurs(couleurs);
    try { localStorage.setItem(CLE_COULEURS, JSON.stringify(couleurs)); } catch { /* stockage indisponible */ }
    clearTimeout(minuteur);
    minuteur = window.setTimeout(ctx.redessiner, 120);
  };
  d.addEventListener("input", (ev) => {
    const i = ev.target as HTMLInputElement;
    if (i.name === "theme") {
      // Changer d'apparence remet les fonds de l'apparence (sinon un fond sombre choisi resterait sur le thème clair).
      const { fondCarte: _fc, fondInterface: _fi, ...reste } = couleurs;
      changer({ ...reste, theme: i.value as "standard" | "studio" | "clair" });
      enregistrer();
      d.querySelectorAll<HTMLInputElement>('input[data-cle^="f:"]').forEach((x) => { x.value = FOND[i.value as keyof typeof FOND]; });
      return;
    }
    if (i.name === "accent") { changer({ ...couleurs, accent: i.value as Accent }); enregistrer(); return; }
    const [t, k] = (i.dataset.cle ?? "").split(":");
    if (!k) return;
    if (t === "m") changer({ ...couleurs, medias: { ...couleurs.medias, [k]: i.value } });
    else if (t === "g") changer({ ...couleurs, genres: { ...couleurs.genres, [k]: i.value } });
    else if (t === "a") { changer({ ...couleurs, accent: "perso", accentPerso: i.value }); d.querySelector<HTMLInputElement>('input[name="accent"][value="perso"]')!.checked = true; }
    else if (t === "f") changer({ ...couleurs, [k === "carte" ? "fondCarte" : "fondInterface"]: i.value });
    else changer({ ...couleurs, trunk: i.value });
    enregistrer();
  });
  d.addEventListener("click", (ev) => {
    if ((ev.target as HTMLElement).dataset.a !== "defaut") return;
    changer({ theme: couleurs.theme, accent: couleurs.accent });   // l'apparence et l'accent choisis restent
    enregistrer();
    rendre();
  });
  d.addEventListener("close", () => d.remove());
  document.body.append(d);
  d.showModal();
}
