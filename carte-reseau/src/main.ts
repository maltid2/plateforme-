import { APPARENCE } from "./apparence";
import { disposer, type Disposition } from "./disposition";
import { creerPlan2D } from "./plan2d";
import { analyser, EXEMPLE, GENRES, type Genre, type Inventaire } from "./saisie";
import type { Vue3D } from "./vue3d";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const texte = $<HTMLTextAreaElement>("texte");
const etat = $("etat"), listeAlertes = $("alertes"), fiche = $("fiche"), legende = $("legende");
const filtre = $<HTMLSelectElement>("filtre-site"), recherche = $<HTMLInputElement>("recherche");
const hote2d = $("hote-2d"), hote3d = $("hote-3d");

const CLE = "carte-reseau:saisie";
const lire = () => { try { return localStorage.getItem(CLE); } catch { return null; } };
const ecrire = (v: string) => { try { localStorage.setItem(CLE, v); } catch { /* navigation privée */ } };

let inv: Inventaire = analyser("");
let disp: Disposition = disposer(inv);
let site: string | null = null;
let choisi: string | null = null;
let vue: "2d" | "3d" = "2d";
let v3: Vue3D | null = null;

const plan = creerPlan2D(hote2d, { choisir });

/* ---------------- rendu ---------------- */

function recalculer() {
  inv = analyser(texte.value);
  disp = disposer(inv);
  if (site && !inv.sites.some((s) => s.nom === site)) site = null;
  if (choisi && !inv.equipements.some((e) => e.nom === choisi)) choisi = null;

  filtre.replaceChildren(new Option(`Tous les sites (${inv.sites.length})`, ""),
    ...inv.sites.map((s) => new Option(s.nom, s.nom, false, s.nom === site)));
  $("noms").replaceChildren(...inv.equipements.map((e) => new Option(e.nom)));

  const err = inv.alertes.filter((a) => a.niveau === "erreur").length;
  const att = inv.alertes.length - err;
  etat.textContent = `${inv.sites.length} site${inv.sites.length > 1 ? "s" : ""} · ${inv.equipements.length} équipements · ${inv.liaisons.length} liaisons`
    + (err ? ` · ${err} erreur${err > 1 ? "s" : ""}` : "") + (att ? ` · ${att} remarque${att > 1 ? "s" : ""}` : "")
    + (!err && !att && inv.equipements.length ? " · tout est relié ✓" : "");
  listeAlertes.replaceChildren(...inv.alertes.map((a) => {
    const li = document.createElement("li");
    li.className = a.niveau;
    li.innerHTML = `<span class="n">L.${a.ligne}</span><span class="p">●</span><span></span>`;
    (li.lastChild as HTMLElement).textContent = a.msg;
    li.title = "Aller à la ligne";
    li.addEventListener("click", () => allerLigne(a.ligne));
    return li;
  }));

  const presents = new Set(inv.equipements.map((e) => e.genre));
  legende.replaceChildren(...(Object.keys(APPARENCE) as Genre[]).filter((g) => presents.has(g)).map((g) => {
    const s = document.createElement("span");
    s.innerHTML = `<i style="background:${APPARENCE[g].couleur}"></i>`;
    s.append(GENRES[g].libelle);
    return s;
  }));

  dessiner();
  remplirFiche();
}

function dessiner() {
  const vide = !inv.equipements.length;
  hote2d.querySelector(".vide")?.remove();
  if (vide) {
    const d = document.createElement("div");
    d.className = "vide";
    d.textContent = "Écrivez vos équipements à gauche — ou cliquez sur « Exemple » — et la carte se dessine ici.";
    hote2d.appendChild(d);
  }
  plan.afficher(inv, disp, site);
  plan.selectionner(choisi);
  v3?.afficher(inv, disp, site);
  v3?.selectionner(choisi);
}

/* ---------------- fiche ---------------- */

function choisir(nom: string | null, centrer = false) {
  choisi = nom;
  plan.selectionner(nom, centrer && vue === "2d");
  v3?.selectionner(nom, centrer && vue === "3d");
  remplirFiche();
}

function remplirFiche() {
  const e = choisi ? inv.equipements.find((x) => x.nom === choisi) : null;
  if (!e) { fiche.hidden = true; return; }
  const liens = inv.liaisons.filter((l) => l.a === e.nom || l.b === e.nom).map((l) => {
    const moi = l.a === e.nom;
    return { monPort: moi ? l.portA : l.portB, autre: moi ? l.b : l.a, sonPort: moi ? l.portB : l.portA, libelle: l.libelle };
  }).sort((x, y) => (x.monPort ?? "").localeCompare(y.monPort ?? "", "fr", { numeric: true }));

  fiche.replaceChildren();
  const h = (tag: string, cls = "", txt = "") => { const n = document.createElement(tag); if (cls) n.className = cls; n.textContent = txt; return n; };
  const fermer = h("button", "fermer", "×") as HTMLButtonElement;
  fermer.type = "button"; fermer.setAttribute("aria-label", "Fermer la fiche");
  fermer.onclick = () => choisir(null);
  fiche.append(fermer, h("div", "genre", GENRES[e.genre].libelle), h("h2", "", e.nom),
    h("div", "ou", [e.site, e.baie && `baie ${e.baie}`].filter(Boolean).join(" · ")));

  const dl = document.createElement("dl");
  const ligne = (k: string, v: string) => dl.append(h("dt", "", k), h("dd", "", v));
  if (e.ip) ligne("Adresse IP", e.ip);
  e.infos.forEach((i, k) => ligne(k === 0 ? "Infos" : "", i));
  e.kv.forEach(([k, v]) => ligne(k, v));
  if (dl.childElementCount) fiche.append(dl);

  fiche.append(h("h3", "", `Liaisons (${liens.length})`));
  if (!liens.length) fiche.append(h("p", "ou", "Aucune liaison déclarée."));
  else {
    const ul = document.createElement("ul");
    liens.forEach((l) => {
      const li = document.createElement("li");
      li.append(l.monPort ? `port ${l.monPort} → ` : "→ ");
      const a = h("a", "", l.autre);
      a.setAttribute("role", "button"); a.tabIndex = 0;
      a.onclick = () => choisir(l.autre, true);
      li.append(a, l.sonPort ? `:${l.sonPort}` : "", l.libelle ? ` · ${l.libelle}` : "");
      ul.append(li);
    });
    fiche.append(ul);
  }
  const aller = h("button", "ligne", `Modifier (ligne ${e.ligne})`) as HTMLButtonElement;
  aller.type = "button";
  aller.onclick = () => allerLigne(e.ligne);
  fiche.append(aller);
  fiche.hidden = false;
}

function allerLigne(n: number) {
  const lignes = texte.value.split("\n");
  const debut = lignes.slice(0, n - 1).reduce((t, l) => t + l.length + 1, 0);
  texte.focus();
  texte.setSelectionRange(debut, debut + (lignes[n - 1]?.length ?? 0));
  const hl = parseFloat(getComputedStyle(texte).lineHeight) || 20;
  texte.scrollTop = Math.max(0, (n - 4) * hl);
}

/* ---------------- vues ---------------- */

async function montrer(v: "2d" | "3d") {
  vue = v;
  $("v-2d").setAttribute("aria-selected", String(v === "2d"));
  $("v-3d").setAttribute("aria-selected", String(v === "3d"));
  hote2d.hidden = v !== "2d";
  hote3d.hidden = v !== "3d";
  if (v === "3d" && !v3) {
    const { creerVue3D } = await import("./vue3d");
    v3 = creerVue3D(hote3d, { choisir });
    v3.afficher(inv, disp, site);
    v3.selectionner(choisi);
    v3.cadrer();
  }
}

/* ---------------- événements ---------------- */

let minuteur = 0;
texte.addEventListener("input", () => {
  clearTimeout(minuteur);
  minuteur = window.setTimeout(() => { ecrire(texte.value); recalculer(); }, 250);
});
// Tabulation = deux espaces, comme dans l'exemple.
texte.addEventListener("keydown", (e) => {
  if (e.key !== "Tab" || e.shiftKey) return;
  e.preventDefault();
  texte.setRangeText("  ", texte.selectionStart, texte.selectionEnd, "end");
  texte.dispatchEvent(new Event("input"));
});

filtre.addEventListener("change", () => {
  site = filtre.value || null;
  dessiner();
  plan.cadrer();
  v3?.cadrer();
});
recherche.addEventListener("change", () => {
  const q = recherche.value.trim().toLowerCase();
  if (!q) return;
  const e = inv.equipements.find((x) => x.nom.toLowerCase() === q)
    ?? inv.equipements.find((x) => x.nom.toLowerCase().includes(q) || x.ip === q);
  if (!e) return;
  if (site && e.site !== site) { site = null; filtre.value = ""; dessiner(); }
  choisir(e.nom, true);
});
$("v-2d").addEventListener("click", () => montrer("2d"));
$("v-3d").addEventListener("click", () => montrer("3d"));
$("b-cadrer").addEventListener("click", () => (vue === "2d" ? plan.cadrer() : v3?.cadrer()));

$("b-exemple").addEventListener("click", () => {
  if (texte.value.trim() && !confirm("Remplacer la saisie actuelle par l'exemple ?")) return;
  texte.value = EXEMPLE; ecrire(EXEMPLE); recalculer(); plan.cadrer(); v3?.cadrer();
});
$("b-aide").addEventListener("click", (e) => {
  const aide = $("aide");
  aide.hidden = !aide.hidden;
  (e.currentTarget as HTMLElement).setAttribute("aria-expanded", String(!aide.hidden));
});

function telecharger(nom: string, contenu: string, type: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nom });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const nomFichier = () => (inv.sites.map((s) => s.nom).join("-") || "carte").replace(/[^\w-]+/g, "_").slice(0, 60);
$("b-enregistrer").addEventListener("click", () => telecharger(`${nomFichier()}.txt`, texte.value, "text/plain;charset=utf-8"));
$("b-svg").addEventListener("click", () => telecharger(`${nomFichier()}.svg`, plan.exporter(), "image/svg+xml"));
$("b-ouvrir").addEventListener("click", () => $("fichier").click());
$<HTMLInputElement>("fichier").addEventListener("change", async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  texte.value = await f.text();
  ecrire(texte.value);
  recalculer(); plan.cadrer(); v3?.cadrer();
  (e.target as HTMLInputElement).value = "";
});

/* ---------------- démarrage ---------------- */

texte.value = lire() ?? EXEMPLE;
recalculer();
plan.cadrer();
