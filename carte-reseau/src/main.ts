import { APPARENCE, COULEUR_MEDIA, COULEUR_TRUNK } from "./apparence.ts";
import { disposer, type Disposition } from "./disposition.ts";
import { creerEditeur } from "./editeur.ts";
import { cheminPasserelle, lirePort } from "./facade.ts";
import { elevations } from "./elevation.ts";
import { creerFormulaire } from "./formulaire.ts";
import { colonnesDe, lireTableur, modeleCsv, SENS, tableurVersTexte, type Feuille, type Sens } from "./tableur.ts";
import { EXEMPLE_COMPLET, MODELES } from "./modeles.ts";
import { CLASSIFICATION, imprimer } from "./impression.ts";
import { creerPlan2D } from "./plan2d.ts";
import * as projets from "./projets.ts";
import { analyser, GENRES, MEDIAS, type Genre, type Inventaire, type Media, LIBELLE_CLE } from "./saisie.ts";
import type { Vue3D } from "./vue3d.ts";

// Le modèle de la page, pris AVANT toute modification : il sert à produire
// la visionneuse autonome (même fichier, données incluses, lecture seule).
const MODELE = { head: document.head.innerHTML, body: document.body.innerHTML };
const EMBARQUE = (() => {
  const n = document.getElementById("carte-donnees");
  if (!n) return null;
  try { return JSON.parse(n.textContent ?? "") as { nom: string; texte: string; exporte: string; auteur?: string }; } catch { return null; }
})();
if (EMBARQUE) document.body.classList.add("lecture");

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const etat = $("etat"), listeAlertes = $("alertes"), fiche = $("fiche"), legende = $("legende");
const filtre = $<HTMLSelectElement>("filtre-site"), recherche = $<HTMLInputElement>("recherche");
const selTopo = $<HTMLSelectElement>("topologie");
const hote2d = $("hote-2d"), hote3d = $("hote-3d");

// En visionneuse, la topologie vient du fichier lui-même et rien n'est
// écrit dans le navigateur.
let classeur: projets.Classeur = EMBARQUE
  ? { version: 1, active: "embarquee", topologies: [{ id: "embarquee", nom: EMBARQUE.nom, texte: EMBARQUE.texte, modifie: 0 }] }
  : projets.charger();
let inv: Inventaire = analyser("");
let disp: Disposition = disposer(inv);
let site: string | null = null;
let choisi: string | null = null;
let vue: "2d" | "3d" | "baies" = "2d";
let v3: Vue3D | null = null;

const active = () => classeur.topologies.find((t) => t.id === classeur.active)!;
const plan = creerPlan2D(hote2d, { choisir });
const editeur = creerEditeur($("editeur"), () => ({ inv, disp }), (texte) => {
  const t = active();
  t.texte = texte;
  t.modifie = Date.now();
  enregistrer();
  recalculer();
});
/** Le formulaire écrit dans le texte : même chemin que la frappe. */
function ecrireTexte(texte: string) {
  editeur.definir(texte);
  const t = active();
  t.texte = texte;
  t.modifie = Date.now();
  enregistrer();
  recalculer();
}
const formulaire = creerFormulaire($("formulaire"), {
  donnees: () => ({ inv, disp }),
  texte: () => editeur.valeur,
  ecrire: ecrireTexte,
  choisir: (nom) => choisir(nom, true),
  versTexte: (ligne) => { mode("texte"); editeur.allerLigne(ligne); },
});

/* ---------------- formulaire / texte ---------------- */
function mode(m: "form" | "texte") {
  $("m-form").setAttribute("aria-selected", String(m === "form"));
  $("m-texte").setAttribute("aria-selected", String(m === "texte"));
  $("formulaire").hidden = m !== "form";
  $("editeur").hidden = m !== "texte";
  $("modeles").hidden = m !== "texte";
  if (m === "texte") editeur.focus();
  try { localStorage.setItem("carte-reseau:mode", m); } catch { /* sans importance */ }
}
$("m-form").addEventListener("click", () => mode("form"));

/* ---------------- modèles à insérer (onglet Texte) ---------------- */
{
  const barre = $("modeles");
  MODELES.forEach((m) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = m.titre; b.title = `Insérer : ${m.detail}`;
    b.addEventListener("click", () => editeur.inserer(m.texte));
    barre.append(b);
  });
  const ex = document.createElement("button");
  ex.type = "button"; ex.className = "exemple"; ex.textContent = "Exemple complet ↗";
  ex.title = "Ouvre un exemple de tout le langage dans une carte à part (votre carte n'est pas touchée)";
  ex.addEventListener("click", () => creer("Exemple (à supprimer)", EXEMPLE_COMPLET));
  barre.append(ex);
}

/* ---------------- largeur de la saisie ---------------- */
// Barre à glisser entre la saisie et la carte, mémorisée sur le poste.
{
  const atelier = document.querySelector<HTMLElement>(".atelier")!;
  const sep = $("separateur");
  const CLE_L = "carte-reseau:largeur-saisie";
  const borner = (px: number) => Math.round(Math.max(300, Math.min(window.innerWidth - 360, px)));
  const appliquerL = (px: number, garder = true) => {
    const v = borner(px);
    atelier.style.setProperty("--largeur-saisie", `${v}px`);
    sep.setAttribute("aria-valuenow", String(v));
    if (garder) try { localStorage.setItem(CLE_L, String(v)); } catch { /* sans importance */ }
  };
  const actuelle = () => document.querySelector<HTMLElement>(".saisie")!.getBoundingClientRect().width;
  try { const v = Number(localStorage.getItem(CLE_L)); if (v > 0) appliquerL(v, false); } catch { /* sans importance */ }
  let depart: { x: number; l: number } | null = null;
  sep.addEventListener("pointerdown", (e) => {
    depart = { x: e.clientX, l: actuelle() };
    sep.setPointerCapture(e.pointerId);
    sep.classList.add("actif"); document.body.classList.add("redim");
  });
  sep.addEventListener("pointermove", (e) => { if (depart) appliquerL(depart.l + e.clientX - depart.x); });
  const fin = () => { depart = null; sep.classList.remove("actif"); document.body.classList.remove("redim"); };
  sep.addEventListener("pointerup", fin);
  sep.addEventListener("pointercancel", fin);
  // Double-clic : grand (70 % de l'écran) ou normal.
  sep.addEventListener("dblclick", () => appliquerL(actuelle() > window.innerWidth * 0.55 ? window.innerWidth * 0.38 : window.innerWidth * 0.7));
  sep.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); appliquerL(actuelle() + (e.key === "ArrowRight" ? 40 : -40)); }
  });
  window.addEventListener("resize", () => { const v = Number(atelier.style.getPropertyValue("--largeur-saisie").replace("px", "")); if (v) appliquerL(v, false); });
}
$("m-texte").addEventListener("click", () => mode("texte"));

function enregistrer() {
  if (EMBARQUE) return;
  if (!projets.sauver(classeur)) etat.dataset.alerte = "Le navigateur refuse l'enregistrement local : pensez à « Sauvegarder (.json) ».";
}

/* ---------------- topologies ---------------- */

function listerTopologies() {
  selTopo.replaceChildren(...[...classeur.topologies]
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
    .map((t) => new Option(t.nom, t.id, false, t.id === classeur.active)));
  document.title = `${active().nom} · Topologie réseau v1`;
}
function ouvrirTopologie(id: string) {
  classeur.active = id;
  enregistrer();
  site = null; choisi = null;
  editeur.definir(active().texte);
  listerTopologies();
  recalculer();
  maj3D(true);
  plan.cadrer();
  v3?.cadrer();
}
function creer(nom: string, texte: string) {
  const t = projets.nouvelle(nom, texte);
  classeur.topologies.push(t);
  ouvrirTopologie(t.id);
}
selTopo.addEventListener("change", () => ouvrirTopologie(selTopo.value));
$("t-nouvelle").addEventListener("click", () => {
  const nom = prompt("Nom de la nouvelle topologie :", "Nouvelle topologie");
  if (nom?.trim()) creer(nom.trim(), "# Écrivez vos équipements ici. Commencez par :  site NOM\n\n");
  editeur.focus();
});
$("t-renommer").addEventListener("click", () => {
  const nom = prompt("Nouveau nom :", active().nom);
  if (!nom?.trim()) return;
  active().nom = nom.trim();
  enregistrer(); listerTopologies();
});
$("t-dupliquer").addEventListener("click", () => creer(`${active().nom} (copie)`, active().texte));
$("t-supprimer").addEventListener("click", () => {
  if (!confirm(`Supprimer la topologie « ${active().nom} » ?\n\nCette action est définitive (sauf si vous avez une sauvegarde .json).`)) return;
  classeur.topologies = classeur.topologies.filter((t) => t.id !== classeur.active);
  if (!classeur.topologies.length) classeur.topologies.push(projets.nouvelle("Nouvelle topologie", ""));
  ouvrirTopologie(classeur.topologies[0].id);
});

/* ---------------- rendu ---------------- */

function recalculer() {
  inv = analyser(editeur.valeur);
  disp = disposer(inv);
  if (site && !inv.sites.some((s) => s.nom === site)) site = null;
  if (choisi && !inv.equipements.some((e) => e.nom === choisi)) choisi = null;

  filtre.replaceChildren(new Option(`Tous les sites (${inv.sites.length})`, ""),
    ...inv.sites.map((s) => new Option(s.nom, s.nom, false, s.nom === site)));
  $("noms").replaceChildren(...inv.equipements.map((e) => new Option(e.nom, e.ip ? `${e.nom}` : e.nom)));

  const err = inv.alertes.filter((a) => a.niveau === "erreur").length;
  const att = inv.alertes.length - err;
  const nSw = inv.equipements.filter((e) => e.genre === "switch").length;
  const nTrunk = inv.liaisons.filter((l) => l.mode === "trunk").length;
  etat.innerHTML = `<b>${inv.sites.length}</b> site${inv.sites.length > 1 ? "s" : ""} · <b>${nSw}</b> switch${nSw > 1 ? "s" : ""} · <b>${inv.equipements.length}</b> équipements · <b>${inv.liaisons.length}</b> liaisons dont <b>${nTrunk}</b> trunk${nTrunk > 1 ? "s" : ""}`
    + (err ? ` · <span class="e">${err} erreur${err > 1 ? "s" : ""}</span>` : "")
    + (att ? ` · <span class="a">${att} remarque${att > 1 ? "s" : ""}</span>` : "")
    + (!err && !att && inv.equipements.length ? ` · <span class="ok">tout est relié ✓</span>` : "");
  listeAlertes.replaceChildren(...inv.alertes.map((a) => {
    const li = document.createElement("li");
    li.className = a.niveau;
    li.innerHTML = `<span class="n">L.${a.ligne}</span><span class="p">●</span><span></span>`;
    (li.lastChild as HTMLElement).textContent = a.msg;
    li.title = "Aller à la ligne";
    li.addEventListener("click", () => editeur.allerLigne(a.ligne));
    return li;
  }));
  editeur.alertes(inv.alertes);
  formulaire.actualiser();

  const presents = new Set(inv.equipements.map((e) => e.genre));
  legende.replaceChildren(...(Object.keys(APPARENCE) as Genre[]).filter((g) => presents.has(g)).map((g) => {
    const s = document.createElement("span");
    s.innerHTML = `<i style="background:${APPARENCE[g].couleur}"></i>`;
    s.append(GENRES[g].libelle);
    return s;
  }));
  // Les supports présents : fibre, cuivre, radio, VPN.
  (Object.keys(MEDIAS) as Media[]).filter((m) => inv.liaisons.some((l) => l.media === m)).forEach((m) => {
    const s = document.createElement("span");
    s.innerHTML = `<i class="trait ${m === "vpn" || m === "radio" ? "tirets" : ""}" style="background:${COULEUR_MEDIA[m]}"></i>`;
    s.append(MEDIAS[m]);
    legende.append(s);
  });
  if (nTrunk) {
    const s = document.createElement("span");
    s.innerHTML = `<i class="trait epais" style="background:${COULEUR_TRUNK}"></i>`;
    s.append("Trunk (épais)");
    legende.append(s);
  }

  dessiner();
  remplirFiche();
}

function dessiner() {
  hote2d.querySelector(".vide")?.remove();
  if (!inv.equipements.length) {
    const d = document.createElement("div");
    d.className = "vide";
    d.innerHTML = `<div><b>La carte est vide : créez votre premier site.</b><br>
      Dans le <b>Formulaire</b> : Site › <b>＋ Nouveau site…</b>, donnez-lui le nom que vous voulez,<br>
      puis ajoutez ses switchs et ses caméras.<br>
      Ou en <b>Texte</b> : <code>site NomDuSite</code> puis <code>switch SW-1 | 10.0.0.2</code></div>`;
    hote2d.appendChild(d);
  }
  plan.afficher(inv, disp, site);
  plan.selectionner(choisi);
  if (vue === "baies") dessinerBaies();
  maj3D();
}

/* ---------------- fiche ---------------- */

function choisir(nom: string | null, centrer = false) {
  choisi = nom;
  const e = nom ? inv.equipements.find((x) => x.nom === nom) : null;
  if (e && site && e.site !== site) { site = null; filtre.value = ""; dessiner(); }
  plan.selectionner(nom, centrer && vue === "2d");
  v3?.selectionner(nom, centrer && vue === "3d");
  remplirFiche();
}

function remplirFiche() {
  const e = choisi ? inv.equipements.find((x) => x.nom === choisi) : null;
  if (!e) { fiche.hidden = true; return; }
  const f = disp.facades.get(e.nom);
  const h = (tag: string, cls = "", txt = "") => { const n = document.createElement(tag); if (cls) n.className = cls; n.textContent = txt; return n; };
  const lien = (nom: string, port?: string) => {
    const s = document.createElement("span");
    const a = h("a", "", nom);
    a.setAttribute("role", "button"); a.tabIndex = 0;
    a.onclick = () => choisir(nom, true);
    a.onkeydown = (ev) => { if (ev.key === "Enter") choisir(nom, true); };
    s.append(a, port ? h("span", "port", `:${port}`) : "");
    return s;
  };

  fiche.replaceChildren();
  const fermer = h("button", "fermer", "×") as HTMLButtonElement;
  fermer.type = "button"; fermer.setAttribute("aria-label", "Fermer la fiche");
  fermer.onclick = () => choisir(null);
  const tete = h("div", "tete");
  tete.style.setProperty("--c", APPARENCE[e.genre].couleur);
  tete.append(h("div", "genre", GENRES[e.genre].libelle), h("h2", "", e.nom), h("div", "modele", e.infos[0] ?? ""));
  fiche.append(fermer, tete);

  const dl = document.createElement("dl");
  const ligne = (k: string, v: string | Node) => { const dd = h("dd"); dd.append(v); dl.append(h("dt", "", k), dd); };
  ligne("Adresse IP", e.ip ?? "—");
  if (e.passerelleIp) ligne("IP passerelle", `${e.passerelleIp}${e.passerelleHeritee ? ` · celle du ${e.passerelleHeritee}` : ""}`);
  ligne("Site", e.site);
  if (e.baie) ligne("Baie", e.baie);
  const ch = cheminPasserelle(e.nom, inv);
  if (ch) {
    const p = document.createElement("span");
    p.append(lien(ch.passerelle.nom), ch.passerelle.ip ? ` (${ch.passerelle.ip})` : "");
    ligne("Équipement passerelle", p);
    if (ch.via) ligne("Remonte par", `port ${ch.via}${ch.sauts.length > 1 ? ` · via ${ch.sauts.slice(0, -1).join(" › ")}` : ""}`);
  } else if (e.genre !== "passerelle" && e.genre !== "parefeu" && !e.passerelleIp) ligne("Passerelle", "aucune déclarée sur ce site");
  e.infos.slice(1).forEach((i) => ligne("Info", i));
  // N° de série, MAC, masque d'abord, puis les autres informations (colonnes Excel en plus…).
  const rang = (k: string) => { const i = ["masque", "serie", "mac"].indexOf(k); return i < 0 ? 9 : i; };
  e.kv.filter(([k]) => !/^(ports?|sfp|wan)$/i.test(k))
    .sort(([a], [b]) => rang(a) - rang(b))
    .forEach(([k, v]) => ligne(LIBELLE_CLE[k] ?? k, v));
  fiche.append(dl);

  const liens = inv.liaisons.filter((l) => l.a === e.nom || l.b === e.nom).map((l) => {
    const moi = l.a === e.nom;
    return { monPort: moi ? l.portA : l.portB, autre: moi ? l.b : l.a, sonPort: moi ? l.portB : l.portA, l };
  });

  if (f) {
    const total = f.ports.filter((p) => p.type !== "autre").length;
    const occupes = new Set([...f.branches.keys()].map((k) => f.parId.get(k)));
    fiche.append(h("h3", "", `Ports · ${occupes.size} / ${total} utilisés`));
    // Mini-façade cliquable : un carré par port.
    const mini = h("div", "mini");
    f.ports.forEach((p) => {
      const b = [...f.branches.values()].find((x) => f.parId.get(x.port) === p);
      const c = h("button", `p ${p.haut ? "h" : "b"} ${b ? "pris" : ""} ${b?.liaison.mode === "trunk" ? "trunk" : ""}`, "") as HTMLButtonElement;
      c.type = "button";
      c.title = b ? `${p.id} → ${b.vers}${b.liaison.vlans ? ` · VLAN ${b.liaison.vlans}` : ""}` : `${p.id} · libre`;
      if (b) {
        c.style.setProperty("--c", b.liaison.mode === "trunk" ? COULEUR_TRUNK : APPARENCE[inv.equipements.find((x) => x.nom === b.vers)?.genre ?? "autre"].couleur);
        c.onclick = () => choisir(b.vers, true);
      }
      mini.append(c);
    });
    fiche.append(mini);
  } else {
    // Serveur, NAS, enregistreur… avec des ports déclarés : la liste, libres ou pris.
    const n = (re: RegExp) => Math.min(96, parseInt(e.kv.find(([k]) => re.test(k))?.[1] ?? "", 10) || 0);
    const rj = n(/^ports?$/i), sfp = n(/^sfp$/i), wan = n(/^wan$/i);
    const tous = [...Array.from({ length: rj }, (_, i) => String(i + 1)), ...Array.from({ length: sfp }, (_, i) => `SFP${i + 1}`),
      ...Array.from({ length: wan }, (_, i) => (wan > 1 ? `WAN${i + 1}` : "WAN"))];
    if (tous.length) {
      const cle = (p?: string) => { if (!p) return ""; const l = lirePort(p); return l.n !== null ? `${l.type}:${l.n}` : p.toLowerCase(); };
      const pris = new Map(liens.filter((x) => x.monPort).map((x) => [cle(x.monPort), x]));
      fiche.append(h("h3", "", `Ports · ${tous.filter((p) => pris.has(cle(p))).length} / ${tous.length} utilisés`));
      const mini = h("div", "mini");
      tous.forEach((p) => {
        const b = pris.get(cle(p));
        const c = h("button", `p h ${b ? "pris" : ""} ${b?.l.mode === "trunk" ? "trunk" : ""}`, "") as HTMLButtonElement;
        c.type = "button";
        c.title = b ? `${p} → ${b.autre}${b.sonPort ? ` port ${b.sonPort}` : ""}` : `${p} · libre`;
        if (b) { c.style.setProperty("--c", APPARENCE[inv.equipements.find((x) => x.nom === b.autre)?.genre ?? "autre"].couleur); c.onclick = () => choisir(b.autre, true); }
        mini.append(c);
      });
      fiche.append(mini);
    }
  }

  fiche.append(h("h3", "", `Liaisons (${liens.length})`));
  if (!liens.length) fiche.append(h("p", "vide-fiche", "Aucune liaison déclarée."));
  else {
    const tab = document.createElement("table");
    tab.innerHTML = `<thead><tr><th>Port</th><th>Branché sur</th><th>Mode</th></tr></thead>`;
    const tb = document.createElement("tbody");
    liens.sort((x, y) => (x.monPort ?? "").localeCompare(y.monPort ?? "", "fr", { numeric: true })).forEach((x) => {
      const tr = document.createElement("tr");
      const td = (v: string | Node, cls = "") => { const c = h("td", cls); c.append(v); tr.append(c); };
      td(x.monPort ?? "—", "mono");
      td(lien(x.autre, x.sonPort));
      td(`${x.l.mode === "trunk" ? "trunk" : x.l.mode ?? ""}${x.l.vlans ? ` ${x.l.vlans}` : ""}${x.l.libelle ? ` · ${x.l.libelle}` : ""}`, x.l.mode === "trunk" ? "trunk" : "");
      tb.append(tr);
    });
    tab.append(tb);
    fiche.append(tab);
  }
  const aller = h("button", "modifier", `✎ Modifier la ligne ${e.ligne}`) as HTMLButtonElement;
  aller.type = "button";
  aller.onclick = () => editeur.allerLigne(e.ligne);
  fiche.append(aller);
  fiche.hidden = false;
}

/* ---------------- vues ---------------- */

/** Les baies vues de face, côte à côte, par site et par lieu. */
function dessinerBaies() {
  const h = $("hote-baies");
  h.innerHTML = elevations(inv, disp, { site, camerasEnBaie: $<HTMLSelectElement>("o-cams").value === "baie" });
  h.querySelectorAll(".b-eq").forEach((g) => g.classList.toggle("choisi", (g as SVGElement).dataset.nom === choisi));
}
$("hote-baies").addEventListener("click", (e) => {
  const g = (e.target as Element).closest<SVGElement>(".b-eq");
  choisir(g?.dataset.nom ?? null);
  $("hote-baies").querySelectorAll(".b-eq").forEach((x) => x.classList.toggle("choisi", (x as SVGElement).dataset.nom === choisi));
});

/**
 * La 3D n'est reconstruite que si elle est affichée, et après une courte
 * pause dans la frappe : sur un grand réseau, la reconstruire à chaque
 * touche (même onglet caché) ralentissait la saisie.
 */
let a3D = false, minuteur3D = 0;
function maj3D(immediat = false) {
  a3D = true;
  if (!v3 || vue !== "3d") return;
  clearTimeout(minuteur3D);
  const faire = () => { if (!a3D || !v3) return; a3D = false; v3.afficher(inv, disp, site); v3.selectionner(choisi); };
  if (immediat) faire(); else minuteur3D = window.setTimeout(faire, 450);
}

async function montrer(v: "2d" | "3d" | "baies") {
  vue = v;
  $("v-2d").setAttribute("aria-selected", String(v === "2d"));
  $("v-3d").setAttribute("aria-selected", String(v === "3d"));
  $("v-baies").setAttribute("aria-selected", String(v === "baies"));
  hote2d.hidden = v !== "2d";
  hote3d.hidden = v !== "3d";
  $("hote-baies").hidden = v !== "baies";
  if (v === "baies") dessinerBaies();
  $("l-cams").hidden = v === "2d";
  if (v === "3d" && !v3) {
    const m = await import("./vue3d.ts");
    m.options.cameras = $<HTMLSelectElement>("o-cams").value as "murs" | "baie";
    $<HTMLSelectElement>("o-cams").addEventListener("change", (e) => {
      m.options.cameras = (e.target as HTMLSelectElement).value as "murs" | "baie";
      maj3D(true);
    });
    v3 = m.creerVue3D(hote3d, { choisir });
    maj3D(true);
    v3.cadrer();
  } else if (v === "3d") maj3D(true);   // rattrape les changements faits pendant que la 3D était cachée
}

/* ---------------- événements ---------------- */

filtre.addEventListener("change", () => { site = filtre.value || null; dessiner(); maj3D(true); plan.cadrer(); v3?.cadrer(); });
recherche.addEventListener("change", () => {
  const q = recherche.value.trim().toLowerCase();
  if (!q) return;
  const e = inv.equipements.find((x) => x.nom.toLowerCase() === q || x.ip === q)
    ?? inv.equipements.find((x) => x.nom.toLowerCase().includes(q) || (x.ip ?? "").startsWith(q));
  if (e) choisir(e.nom, true);
});
$("v-2d").addEventListener("click", () => montrer("2d"));
$("v-3d").addEventListener("click", () => montrer("3d"));
$("v-baies").addEventListener("click", () => montrer("baies"));
$<HTMLSelectElement>("o-cams").addEventListener("change", () => { if (vue === "baies") dessinerBaies(); });
$("b-cadrer").addEventListener("click", () => (vue === "2d" ? plan.cadrer(false) : v3?.cadrer()));
$("b-aide").addEventListener("click", (e) => {
  const aide = $("aide");
  aide.hidden = !aide.hidden;
  (e.currentTarget as HTMLElement).setAttribute("aria-expanded", String(!aide.hidden));
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && choisi && document.activeElement?.tagName !== "TEXTAREA") choisir(null);
});

/* ---------------- fichiers ---------------- */

function telecharger(nom: string, contenu: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nom });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const nomFichier = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_").slice(0, 60) || "carte";
const date = () => new Date().toISOString().slice(0, 10);
const fermerMenu = () => document.querySelector("details.menu")?.removeAttribute("open");

$("b-sauvegarde").addEventListener("click", () => { fermerMenu(); telecharger(`topologie-reseau-sauvegarde-${date()}.json`, projets.exporter(classeur, auteur()), "application/json"); });

/* ---------------- signature ---------------- */
// En visionneuse, c'est la signature de celui qui l'a exportée ; sinon celle du poste.
const auteur = () => (EMBARQUE ? EMBARQUE.auteur ?? "" : projets.lireAuteur());
function afficherSignature() {
  const b = $<HTMLButtonElement>("b-signature");
  b.textContent = auteur() ? `✎ ${auteur()}` : "";
  b.hidden = !auteur();
  b.disabled = !!EMBARQUE;
}
$("b-signature").addEventListener("click", () => {
  const v = prompt("Signature apposée sur les documents (PDF, plans, visionneuse) :", projets.lireAuteur());
  if (v === null) return;
  projets.ecrireAuteur(v.replace(/[<>]/g, "").slice(0, 60));
  afficherSignature();
});
afficherSignature();
$("b-restaurer").addEventListener("click", () => { fermerMenu(); $("f-json").click(); });
$<HTMLInputElement>("f-json").addEventListener("change", async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = "";
  if (!f) return;
  try {
    const { ajoutees } = projets.importer(classeur, await f.text());
    enregistrer(); listerTopologies();
    alert(ajoutees ? `${ajoutees} topologie${ajoutees > 1 ? "s" : ""} ajoutée${ajoutees > 1 ? "s" : ""}.` : "Rien de nouveau dans ce fichier.");
  } catch (err) { alert((err as Error).message || "Fichier illisible."); }
});
$("b-enregistrer").addEventListener("click", () => { fermerMenu(); telecharger(`${nomFichier(active().nom)}.txt`, editeur.valeur, "text/plain;charset=utf-8"); });
$("b-ouvrir").addEventListener("click", () => { fermerMenu(); $("f-txt").click(); });
$<HTMLInputElement>("f-txt").addEventListener("change", async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = "";
  if (f) creer(f.name.replace(/\.txt$/i, ""), await f.text());
});
// Tableau Excel / CSV → nouvelle topologie (lu dans le navigateur, rien n'est envoyé).
$("b-tableur").addEventListener("click", () => { fermerMenu(); $("f-tableur").click(); });
$("b-modele-tableur").addEventListener("click", () => { fermerMenu(); telecharger("modele-topologie.csv", modeleCsv(), "text/csv;charset=utf-8"); });
$<HTMLInputElement>("f-tableur").addEventListener("change", async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = "";
  if (!f) return;
  try {
    const feuilles = await lireTableur(f.name, await f.arrayBuffer());
    // Avant d'importer : ce que l'outil a compris de chaque colonne, à corriger si besoin.
    const corrections = await choisirColonnes(feuilles);
    if (!corrections) return;
    const r = tableurVersTexte(feuilles, corrections);
    if (!r.equipements) { alert("Aucun équipement trouvé : vérifiez que la colonne « Nom » est remplie."); return; }
    creer(f.name.replace(/\.(xlsx|xls|csv|txt)$/i, ""), r.texte);
    const nb = inv.alertes.filter((a) => a.niveau === "erreur").length;
    const pl = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
    alert(`${pl(r.equipements, "équipement")} et ${pl(r.liaisons, "câble")} importés dans une nouvelle topologie « ${active().nom} ».`
      + (r.onglets.length > 1 ? `\n\nOnglets :\n${r.onglets.map((o) => `  • ${o.nom} : ${o.lu}`).join("\n")}` : "")
      + (r.ignorees ? `\n\n${pl(r.ignorees, "ligne")} sans nom ou en double ignorée${r.ignorees > 1 ? "s" : ""}.` : "")
      + (r.manquantes.length ? `\nColonnes absentes (facultatives) : ${r.manquantes.map((c) => LIBELLE_COLONNE[c] ?? c).join(", ")}.` : "")
      + (nb ? `\n${nb} point${nb > 1 ? "s" : ""} à corriger : voir la liste sous la saisie.` : ""));
  } catch (err) { alert((err as Error).message || "Fichier illisible."); }
});
/* ---------- fenêtre « ce que l'outil a compris de votre tableau » ---------- */
const CLE_COLONNES = "carte-reseau:colonnes";
function lireCorrections(): Map<string, Sens> {
  try { return new Map(Object.entries(JSON.parse(localStorage.getItem(CLE_COLONNES) ?? "{}")) as [string, Sens][]); } catch { return new Map(); }
}
function choisirColonnes(feuilles: Feuille[]): Promise<Map<string, Sens> | null> {
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
    <div class="boutons-col"><button value="annuler" type="submit">Annuler</button><button value="ok" type="submit" class="primaire">Importer</button></div>
  </form>`;
  document.body.append(d);
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
const LIBELLE_COLONNE: Record<string, string> = { type: "Type", ip: "IP", site: "Site", vers: "Branché sur", port: "Port" };
$("b-svg").addEventListener("click", () => { fermerMenu(); telecharger(`${nomFichier(active().nom)}-plan.svg`, plan.exporter(true, auteur()), "image/svg+xml"); });
$("b-png").addEventListener("click", async () => {
  fermerMenu();
  if (vue === "3d") {
    const c = hote3d.querySelector("canvas");
    c?.toBlob((b) => b && telecharger(`${nomFichier(active().nom)}-3d.png`, b, "image/png"));
    return;
  }
  // Le plan 2D est rasterisé en local, sans rien envoyer.
  const svg = plan.exporter(true, auteur());
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, 8000 / Math.max(img.width, img.height));
    const c = Object.assign(document.createElement("canvas"), { width: img.width * k, height: img.height * k });
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    c.toBlob((b) => b && telecharger(`${nomFichier(active().nom)}-plan.png`, b, "image/png"));
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
});
$("b-pdf").addEventListener("click", () => { fermerMenu(); imprimer(inv, plan.exporter(true), active().nom, site,
  elevations(inv, disp, { site, clair: true, camerasEnBaie: $<HTMLSelectElement>("o-cams").value === "baie" }), auteur()); });
$("b-glb").addEventListener("click", async () => {
  fermerMenu();
  if (!v3 || vue !== "3d") await montrer("3d");
  const b = await v3!.exporterGLB();
  telecharger(`${nomFichier(active().nom)}-3d.glb`, b, "model/gltf-binary");
});
$("b-visionneuse").addEventListener("click", () => {
  fermerMenu();
  // Le même outil, la topologie incluse, en lecture seule : il s'ouvre sur
  // n'importe quel poste avec un navigateur, sans réseau ni installation.
  const donnees = JSON.stringify({ nom: active().nom, texte: editeur.valeur, exporte: new Date().toISOString(), classification: CLASSIFICATION, auteur: auteur() })
    .replace(/</g, "\\u003c");
  const html = `<!doctype html>\n<html lang="fr">\n<head>${MODELE.head.replace(/<title>[^<]*<\/title>/, `<title>${active().nom.replace(/</g, "")} · Topologie réseau v1</title>`)}</head>\n<body>\n<script type="application/json" id="carte-donnees">${donnees}</script>\n${MODELE.body}\n</body>\n</html>\n`;
  telecharger(`${nomFichier(active().nom)}-visionneuse.html`, html, "text/html;charset=utf-8");
});
document.addEventListener("click", (e) => { if (!(e.target as Element).closest("details.menu")) fermerMenu(); });

/* ---------------- démarrage ---------------- */

listerTopologies();
editeur.definir(active().texte);
recalculer();
plan.cadrer();
try { if (localStorage.getItem("carte-reseau:mode") === "texte" && !EMBARQUE) mode("texte"); } catch { /* sans importance */ }
if (EMBARQUE) {
  document.title = `${EMBARQUE.nom} · Topologie réseau v1 (lecture seule)`;
  $("etat").insertAdjacentHTML("afterbegin", `<span class="e">Lecture seule</span> · exporté le ${new Date(EMBARQUE.exporte).toLocaleString("fr-FR")}${EMBARQUE.auteur ? ` par ${EMBARQUE.auteur.replace(/[<>&]/g, "")}` : ""} · `);
}
