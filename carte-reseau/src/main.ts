import { APPARENCE, COULEUR_MEDIA, COULEUR_TRUNK } from "./apparence.ts";
import { disposer, type Disposition } from "./disposition.ts";
import { creerEditeur } from "./editeur.ts";
import { cheminPasserelle } from "./facade.ts";
import { elevations } from "./elevation.ts";
import { creerFormulaire } from "./formulaire.ts";
import { CLASSIFICATION, imprimer } from "./impression.ts";
import { creerPlan2D } from "./plan2d.ts";
import * as projets from "./projets.ts";
import { analyser, EXEMPLE, GENRES, MEDIAS, type Genre, type Inventaire, type Media } from "./saisie.ts";
import type { Vue3D } from "./vue3d.ts";

// Le modèle de la page, pris AVANT toute modification : il sert à produire
// la visionneuse autonome (même fichier, données incluses, lecture seule).
const MODELE = { head: document.head.innerHTML, body: document.body.innerHTML };
const EMBARQUE = (() => {
  const n = document.getElementById("carte-donnees");
  if (!n) return null;
  try { return JSON.parse(n.textContent ?? "") as { nom: string; texte: string; exporte: string }; } catch { return null; }
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
  if (m === "texte") editeur.focus();
  try { localStorage.setItem("carte-reseau:mode", m); } catch { /* sans importance */ }
}
$("m-form").addEventListener("click", () => mode("form"));
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
  document.title = `${active().nom} · Carte réseau`;
}
function ouvrirTopologie(id: string) {
  classeur.active = id;
  enregistrer();
  site = null; choisi = null;
  editeur.definir(active().texte);
  listerTopologies();
  recalculer();
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
    d.innerHTML = `<div><b>La carte est vide.</b><br>Écrivez à gauche, par exemple :<br><code>switch SW-1 | 10.0.0.2 | @Siège</code><br>ou ouvrez <b>Fichiers › Nouvelle topologie d'exemple</b>.</div>`;
    hote2d.appendChild(d);
  }
  plan.afficher(inv, disp, site);
  plan.selectionner(choisi);
  if (vue === "baies") dessinerBaies();
  v3?.afficher(inv, disp, site);
  v3?.selectionner(choisi);
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
  e.kv.filter(([k]) => !/^(ports?|sfp|wan)$/i.test(k)).forEach(([k, v]) => ligne(k, v));
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
  h.innerHTML = elevations(inv, disp, { site, camerasEnBaie: $<HTMLInputElement>("o-cams").checked });
  h.querySelectorAll(".b-eq").forEach((g) => g.classList.toggle("choisi", (g as SVGElement).dataset.nom === choisi));
}
$("hote-baies").addEventListener("click", (e) => {
  const g = (e.target as Element).closest<SVGElement>(".b-eq");
  choisir(g?.dataset.nom ?? null);
  $("hote-baies").querySelectorAll(".b-eq").forEach((x) => x.classList.toggle("choisi", (x as SVGElement).dataset.nom === choisi));
});

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
    m.options.camerasEnBaie = $<HTMLInputElement>("o-cams").checked;
    $<HTMLInputElement>("o-cams").onchange = (e) => { m.options.camerasEnBaie = (e.target as HTMLInputElement).checked; v3?.afficher(inv, disp, site); v3?.selectionner(choisi); };
    v3 = m.creerVue3D(hote3d, { choisir });
    v3.afficher(inv, disp, site);
    v3.selectionner(choisi);
    v3.cadrer();
  }
}

/* ---------------- événements ---------------- */

filtre.addEventListener("change", () => { site = filtre.value || null; dessiner(); plan.cadrer(); v3?.cadrer(); });
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
$<HTMLInputElement>("o-cams").addEventListener("change", () => { if (vue === "baies") dessinerBaies(); });
$("b-cadrer").addEventListener("click", () => (vue === "2d" ? plan.cadrer() : v3?.cadrer()));
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

$("b-sauvegarde").addEventListener("click", () => { fermerMenu(); telecharger(`carte-reseau-sauvegarde-${date()}.json`, projets.exporter(classeur), "application/json"); });
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
$("b-svg").addEventListener("click", () => { fermerMenu(); telecharger(`${nomFichier(active().nom)}-plan.svg`, plan.exporter(true), "image/svg+xml"); });
$("b-png").addEventListener("click", async () => {
  fermerMenu();
  if (vue === "3d") {
    const c = hote3d.querySelector("canvas");
    c?.toBlob((b) => b && telecharger(`${nomFichier(active().nom)}-3d.png`, b, "image/png"));
    return;
  }
  // Le plan 2D est rasterisé en local, sans rien envoyer.
  const svg = plan.exporter(true);
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
  elevations(inv, disp, { site, clair: true, camerasEnBaie: $<HTMLInputElement>("o-cams").checked })); });
$("b-glb").addEventListener("click", async () => {
  fermerMenu();
  if (!v3) await montrer("3d");
  const b = await v3!.exporterGLB();
  telecharger(`${nomFichier(active().nom)}-3d.glb`, b, "model/gltf-binary");
});
$("b-visionneuse").addEventListener("click", () => {
  fermerMenu();
  // Le même outil, la topologie incluse, en lecture seule : il s'ouvre sur
  // n'importe quel poste avec un navigateur, sans réseau ni installation.
  const donnees = JSON.stringify({ nom: active().nom, texte: editeur.valeur, exporte: new Date().toISOString(), classification: CLASSIFICATION })
    .replace(/</g, "\\u003c");
  const html = `<!doctype html>\n<html lang="fr">\n<head>${MODELE.head.replace(/<title>[^<]*<\/title>/, `<title>${active().nom.replace(/</g, "")} · Carte réseau</title>`)}</head>\n<body>\n<script type="application/json" id="carte-donnees">${donnees}</script>\n${MODELE.body}\n</body>\n</html>\n`;
  telecharger(`${nomFichier(active().nom)}-visionneuse.html`, html, "text/html;charset=utf-8");
});
$("b-exemple").addEventListener("click", () => { fermerMenu(); creer("Exemple · Siège et agence", EXEMPLE); });
document.addEventListener("click", (e) => { if (!(e.target as Element).closest("details.menu")) fermerMenu(); });

/* ---------------- démarrage ---------------- */

listerTopologies();
editeur.definir(active().texte);
recalculer();
plan.cadrer();
try { if (localStorage.getItem("carte-reseau:mode") === "texte" && !EMBARQUE) mode("texte"); } catch { /* sans importance */ }
if (EMBARQUE) {
  document.title = `${EMBARQUE.nom} · Carte réseau (lecture seule)`;
  $("etat").insertAdjacentHTML("afterbegin", `<span class="e">Lecture seule</span> · exporté le ${new Date(EMBARQUE.exporte).toLocaleString("fr-FR")} · `);
}
