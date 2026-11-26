import { APPARENCE, appliquerCouleurs, COULEUR_MEDIA, COULEUR_TRUNK, type Couleurs } from "./apparence.ts";
import { disposer, type Disposition } from "./disposition.ts";
import { creerEditeur } from "./editeur.ts";
import { cheminPasserelle } from "./facade.ts";
import { elevations } from "./elevation.ts";
import { confirmer, demander, informer } from "./boites.ts";
import { cartoVersTexte, estExportCarto } from "./carto.ts";
import { creerFormulaire } from "./formulaire.ts";
import { expliquer } from "./explication.ts";
import { lireTableur, modeleCsv, tableurVersTexte } from "./tableur.ts";
import { EXEMPLE_COMPLET, MODELES } from "./modeles.ts";
import { creerPlan2D } from "./plan2d.ts";
import * as projets from "./projets.ts";
import { analyser, GENRES, MEDIAS, type Genre, type Inventaire, type Liaison, type Media } from "./saisie.ts";
import type { Vue3D } from "./vue3d.ts";
import { choisirColonnes, LIBELLE_COLONNE } from "./ui/colonnes.ts";
import { lireCouleurs, ouvrirCouleurs } from "./ui/couleurs.ts";
import { dessinerFiche } from "./ui/fiche.ts";
import { $, dateDuJour, fermerMenu, nomFichier, pl, surFichiers, telecharger } from "./ui/outils.ts";
import { creerPreconisations } from "./ui/preconisations.ts";
import { importerReleves, telechargerScript } from "./ui/releves.ts";
import { installerExports } from "./ui/exports.ts";
import { installerLargeurSaisie } from "./ui/largeur.ts";
import { notifier } from "./ui/toast.ts";

// Le modèle de la page, pris AVANT toute modification : il sert à produire
// la visionneuse autonome (même fichier, données incluses, lecture seule).
const MODELE = { head: document.head.innerHTML, body: document.body.innerHTML };
const EMBARQUE = (() => {
  const n = document.getElementById("carte-donnees");
  if (!n) return null;
  try { return JSON.parse(n.textContent ?? "") as { nom: string; texte: string; exporte: string; auteur?: string; couleurs?: Couleurs }; } catch { return null; }
})();
// Couleurs choisies (menu « Couleurs ») : retenues dans ce navigateur, et
// emportées dans la visionneuse exportée.
let couleurs: Couleurs = (EMBARQUE ? EMBARQUE.couleurs : lireCouleurs()) ?? {};
appliquerCouleurs(couleurs);
if (EMBARQUE) document.body.classList.add("lecture");

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
type Vue = "2d" | "3d" | "baies";
let vue: Vue = "2d";
let v3: Vue3D | null = null;

const active = () => classeur.topologies.find((t) => t.id === classeur.active)!;
const plan = creerPlan2D(hote2d, {
  choisir,
  lien: (l) => { if (!EMBARQUE) formulaire.editerLien(l); },
  margeDroite: () => (fiche.hidden ? 0 : fiche.offsetWidth + 24),
});
const editeur = creerEditeur($("editeur"), () => ({ inv, disp }), (texte) => {
  const t = active();
  t.texte = texte;
  t.modifie = Date.now();
  enregistrer();
  recalculer();
});
/* ---------------- annulation des changements faits par l'outil ---------------- */
// Supprimer, modifier un câble, ajouter… passent par le texte : on garde les
// versions précédentes pour revenir en arrière (bouton « Annuler » ou Ctrl+Z).
const pileAnnuler: string[] = [];
let gesteEnCours = false;
function annuler() {
  const t = pileAnnuler.pop();
  if (t === undefined) { notifier("Rien à annuler."); return; }
  ecrireTexte(t, undefined, false);
  notifier("Modification annulée.");
}

/** Le formulaire écrit dans le texte : même chemin que la frappe. */
function ecrireTexte(texte: string, annonce?: string, memoriser = true) {
  // Plusieurs écritures dans un même geste (séparer un groupe puis supprimer) = une seule annulation.
  if (memoriser && texte !== editeur.valeur && !gesteEnCours) {
    pileAnnuler.push(editeur.valeur); if (pileAnnuler.length > 50) pileAnnuler.shift();
    gesteEnCours = true; queueMicrotask(() => { gesteEnCours = false; });
  }
  editeur.definir(texte);
  const t = active();
  t.texte = texte;
  t.modifie = Date.now();
  enregistrer();
  recalculer();
  if (annonce) notifier(annonce, { libelle: "Annuler", faire: annuler });
}
const formulaire = creerFormulaire($("formulaire"), {
  donnees: () => ({ inv, disp }),
  texte: () => editeur.valeur,
  ecrire: ecrireTexte,
  choisir: (nom) => choisir(nom, true),
  versTexte: (ligne) => { mode("texte"); editeur.allerLigne(ligne); },
});

/* ---------------- la ligne du curseur, expliquée en français ---------------- */
const boiteExplication = $("explication");
function expliquerLigne(n = editeur.ligneCurseur()) {
  const { sens, alertes, compris } = expliquer(editeur.valeur, n, inv);
  boiteExplication.replaceChildren();
  const t = document.createElement("div");
  t.className = "sens";
  t.innerHTML = `<span class="n">Ligne ${n}</span>`;
  t.append(document.createTextNode(compris ? `J'ai compris : ${sens}` : sens));
  if (!sens && !alertes.length) t.append(document.createTextNode("—"));
  boiteExplication.append(t);
  alertes.forEach((a) => { const d = document.createElement("div"); d.className = "alerte-ligne"; d.textContent = `⚠ ${a}`; boiteExplication.append(d); });
}
editeur.surCurseur((n) => expliquerLigne(n));

/* ---------------- formulaire / texte ---------------- */
function mode(m: "form" | "texte") {
  $("m-form").setAttribute("aria-selected", String(m === "form"));
  $("m-texte").setAttribute("aria-selected", String(m === "texte"));
  $("formulaire").hidden = m !== "form";
  document.body.classList.toggle("mode-texte", m === "texte");   // « L.12 » ne parle qu'en mode Texte
  if (m === "form" && formulairePerime) { formulairePerime = false; formulaire.actualiser(); }
  $("editeur").hidden = m !== "texte";
  $("modeles").hidden = m !== "texte";
  $("explication").hidden = m !== "texte";
  if (m === "texte") { editeur.focus(); expliquerLigne(); }
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

installerLargeurSaisie();
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
  cadrerPlan();
  v3?.cadrer();
}
function creer(nom: string, texte: string) {
  const t = projets.nouvelle(nom, texte);
  classeur.topologies.push(t);
  ouvrirTopologie(t.id);
}
selTopo.addEventListener("change", () => ouvrirTopologie(selTopo.value));
$("t-nouvelle").addEventListener("click", async () => {
  fermerMenu();
  const nom = await demander({ titre: "Nouvelle topologie", texte: "Une carte de plus : un client, un site, un projet…", valeur: "Nouvelle topologie", ok: "Créer" });
  if (nom) creer(nom, "");
});
$("t-renommer").addEventListener("click", async () => {
  fermerMenu();
  const nom = await demander({ titre: "Renommer la topologie", valeur: active().nom, ok: "Renommer" });
  if (!nom) return;
  active().nom = nom;
  enregistrer(); listerTopologies();
});
$("t-dupliquer").addEventListener("click", () => { fermerMenu(); creer(`${active().nom} (copie)`, active().texte); });
$("t-supprimer").addEventListener("click", async () => {
  fermerMenu();
  if (!(await confirmer({ titre: `Supprimer « ${active().nom} » ?`, texte: "Toute cette topologie est effacée de ce poste. C'est définitif, sauf si vous en avez une sauvegarde (.json).", ok: "Supprimer", danger: true }))) return;
  classeur.topologies = classeur.topologies.filter((t) => t.id !== classeur.active);
  if (!classeur.topologies.length) classeur.topologies.push(projets.nouvelle("Nouvelle topologie", ""));
  ouvrirTopologie(classeur.topologies[0].id);
});

/* ---------------- rendu ---------------- */

const dernieresCles = { sites: "", noms: "", alertes: "\u0000" };
let formulairePerime = false;
function recalculer() {
  inv = analyser(editeur.valeur);
  disp = disposer(inv);
  if (site && !inv.sites.some((s) => s.nom === site)) site = null;
  if (choisi && !inv.equipements.some((e) => e.nom === choisi)) choisi = null;

  filtre.hidden = inv.sites.length < 2;   // un seul site : rien à filtrer
  // Listes refaites seulement si elles changent (grand réseau : chaque frappe compte).
  const cleSites = inv.sites.map((s) => s.nom).join("\n") + "\n" + (site ?? "");
  if (cleSites !== dernieresCles.sites) {
    dernieresCles.sites = cleSites;
    filtre.replaceChildren(new Option(`Tous les sites (${inv.sites.length})`, ""),
      ...inv.sites.map((s) => new Option(s.nom, s.nom, false, s.nom === site)));
  }
  const cleNoms = inv.equipements.map((e) => e.nom).join("\n");
  if (cleNoms !== dernieresCles.noms) {
    dernieresCles.noms = cleNoms;
    $("noms").replaceChildren(...inv.equipements.map((e) => new Option(e.nom)));
  }

  const err = inv.alertes.filter((a) => a.niveau === "erreur").length;
  const att = inv.alertes.length - err;
  const nSw = inv.equipements.filter((e) => e.genre === "switch").length;
  const nTrunk = inv.liaisons.filter((l) => l.mode === "trunk").length;
  // Carte vide : rien à compter (l'accueil propose de commencer).
  etat.hidden = !inv.equipements.length && !inv.alertes.length;
  const compte = (n: number, mot: string) => `<b>${n}</b> ${mot}${n > 1 ? "s" : ""}`;
  etat.innerHTML = [
    compte(inv.sites.length, "site"),
    nSw ? compte(nSw, "switch") : "",
    compte(inv.equipements.length, "équipement"),
    inv.liaisons.length ? `${compte(inv.liaisons.length, "câble")}${nTrunk ? ` dont ${compte(nTrunk, "trunk")}` : ""}` : "aucun câble",
  ].filter(Boolean).join(" · ")
    + (err ? ` · <span class="e">${err} erreur${err > 1 ? "s" : ""}</span>` : "")
    + (att ? ` · <span class="a">${att} remarque${att > 1 ? "s" : ""}</span>` : "")
    + (!err && !att && inv.equipements.length ? ` · <span class="ok">tout est relié ✓</span>` : "");
  const cleAlertes = inv.alertes.map((a) => `${a.ligne}|${a.niveau}|${a.msg}`).join("\n");
  if (cleAlertes !== dernieresCles.alertes) listeAlertes.replaceChildren(...inv.alertes.map((a) => {
    const li = document.createElement("li");
    li.className = a.niveau;
    li.innerHTML = `<span class="n">L.${a.ligne}</span><span class="p">●</span><span></span>`;
    (li.lastChild as HTMLElement).textContent = a.msg;
    li.title = "Voir où c'est";
    li.addEventListener("click", () => {
      // Formulaire : l'équipement concerné sur la carte. Texte : la ligne.
      if (!$("formulaire").hidden) {
        const nom = inv.equipements.find((x) => x.ligne === a.ligne)?.nom ?? inv.liaisons.find((x) => x.ligne === a.ligne)?.a;
        if (nom) { choisir(nom, true); return; }
        mode("texte");
      }
      editeur.allerLigne(a.ligne);
    });
    return li;
  }));
  dernieresCles.alertes = cleAlertes;
  editeur.alertes(inv.alertes);
  // Formulaire caché (onglet Texte) : remis à jour quand on y revient.
  if ($("formulaire").hidden) formulairePerime = true;
  else { formulairePerime = false; formulaire.actualiser(); }

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
  // Carte vide : un accueil avec les trois façons de commencer.
  $("accueil").hidden = !!inv.equipements.length || !!EMBARQUE;
  planPerime = true;
  if (vue === "2d") planAJour();
  if (vue === "baies") dessinerBaies();
  preconisations.rafraichir();
  maj3D();
}
/* ---------------- préconisations (sécurité, flux, Genetec) ---------------- */
// Pas sur la carte : un bouton, une fois la carte faite, ouvre le rapport.
const preconisations = creerPreconisations({
  inv: () => inv,
  topologie: active,
  enregistrer,
  voir: (nom) => { void montrer(vue === "3d" ? "3d" : "2d").then(() => choisir(nom, true)); },
  texte: () => editeur.valeur,
  ecrireTexte,
  auteur: () => auteur(),
});
$("a-precos").addEventListener("click", () => { fermerMenu(); preconisations.ouvrir(); });
$("b-genetec").addEventListener("click", () => { fermerMenu(); $("f-genetec").click(); });
surFichiers("f-genetec", preconisations.importerGenetec);

/**
 * Le plan 2D n'est redessiné que s'il est affiché : en 3D ou dans les baies,
 * il l'est au retour sur l'onglet 2D, ou juste avant un export.
 */
let planPerime = false, planACadrer = false;
function planAJour() {
  if (!planPerime) return;
  planPerime = false;
  plan.afficher(inv, disp, site);
  plan.selectionner(choisi);
  if (planACadrer) { planACadrer = false; plan.cadrer(); }
}
function cadrerPlan() { if (planPerime) planACadrer = true; else plan.cadrer(); }

/* ---------------- fiche ---------------- */

function choisir(nom: string | null, centrer = false) {
  choisi = nom;
  const e = nom ? inv.equipements.find((x) => x.nom === nom) : null;
  if (e && site && e.site !== site) { site = null; filtre.value = ""; dessiner(); }
  remplirFiche();   // d'abord : le centrage tient compte de la place prise par la fiche
  plan.selectionner(nom, centrer && vue === "2d");
  v3?.selectionner(nom, centrer && vue === "3d");
  marquerBaies();
}

function remplirFiche() {
  dessinerFiche(fiche, {
    eq: choisi ? inv.equipements.find((x) => x.nom === choisi) ?? null : null, inv, disp, lectureSeule: !!EMBARQUE, choisir,
    modifier: (nom) => { mode("form"); formulaire.modifier(nom); },
    supprimer: (nom) => formulaire.supprimer(nom),
    editerLien: (l) => formulaire.editerLien(l),
    supprimerLien: (l) => formulaire.supprimerLien(l),
    versLigne: (n) => { mode("texte"); editeur.allerLigne(n); },
  });
}

/* ---------------- vues ---------------- */

/** Les baies vues de face, côte à côte, par site et par lieu. */
function dessinerBaies() {
  const h = $("hote-baies");
  h.innerHTML = elevations(inv, disp, { site, camerasEnBaie: $<HTMLSelectElement>("o-cams").value === "baie" });
  marquerBaies();
}
/** Baies : l'équipement choisi encadré, et son chemin jusqu'à la passerelle (dépannage). */
function marquerBaies() {
  const ch = choisi ? cheminPasserelle(choisi, inv) : null;
  const chemin = new Set(ch ? ch.sauts : []);
  $("hote-baies").querySelectorAll<SVGElement>(".b-eq").forEach((g) => {
    g.classList.toggle("choisi", g.dataset.nom === choisi);
    g.classList.toggle("sur-chemin", chemin.has(g.dataset.nom ?? ""));
  });
}
$("hote-baies").addEventListener("click", (e) => {
  const g = (e.target as Element).closest<SVGElement>(".b-eq");
  choisir(g?.dataset.nom ?? null);
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

async function montrer(v: Vue) {
  vue = v;
  $("v-2d").setAttribute("aria-selected", String(v === "2d"));
  $("v-3d").setAttribute("aria-selected", String(v === "3d"));
  $("v-baies").setAttribute("aria-selected", String(v === "baies"));
  hote2d.hidden = v !== "2d";
  hote3d.hidden = v !== "3d";
  $("hote-baies").hidden = v !== "baies";
  if (v === "2d") planAJour();   // rattrape les changements faits pendant que le plan était caché
  if (v === "baies") dessinerBaies();
  $("l-cams").hidden = v === "2d";   // où poser les caméras : 3D et baies
  legende.hidden = v === "baies";      // les baies ne dessinent pas de câbles
  $("b-png").textContent = v === "3d" ? "Image de la vue 3D (.png)" : "Image du plan 2D (.png)";
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

filtre.addEventListener("change", () => { site = filtre.value || null; dessiner(); maj3D(true); cadrerPlan(); v3?.cadrer(); });
// Recherche : à la validation (Entrée, même pour relancer la même recherche)
// ou au choix dans la liste ; un message si rien ne correspond.
let derniereRecherche = "";
function chercher(forcer: boolean) {
  const q = recherche.value.trim().toLowerCase();
  if (!q) return;
  // « change » arrive aussi quand on quitte la case : on ne relance pas la même
  // recherche (elle reconstruirait la fiche sous le clic). Entrée, elle, relance toujours.
  if (!forcer && q === derniereRecherche) return;
  derniereRecherche = q;
  const e = inv.equipements.find((x) => x.nom.toLowerCase() === q || x.ip === q)
    ?? inv.equipements.find((x) => x.nom.toLowerCase().includes(q) || (x.ip ?? "").startsWith(q));
  if (e) choisir(e.nom, true);
  else notifier(`Aucun équipement « ${recherche.value.trim()} ».`);
}
recherche.addEventListener("change", () => chercher(false));
recherche.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); chercher(true); } });
$("v-2d").addEventListener("click", () => montrer("2d"));
$("v-3d").addEventListener("click", () => montrer("3d"));
$("v-baies").addEventListener("click", () => montrer("baies"));
$<HTMLSelectElement>("o-cams").addEventListener("change", () => { if (vue === "baies") dessinerBaies(); });
$("b-cadrer").addEventListener("click", () => (vue === "2d" ? plan.cadrer(false) : v3?.cadrer()));
/* Aide : une fenêtre, un onglet par usage, ouverte sur le mode en cours. */
const aide = $<HTMLDialogElement>("aide");
function ongletAide(k: string) {
  aide.querySelectorAll<HTMLButtonElement>("[data-aide]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.aide === k)));
  aide.querySelectorAll<HTMLElement>("[data-partie]").forEach((p) => { p.hidden = p.dataset.partie !== k; });
}
aide.addEventListener("click", (e) => {
  if (e.target === aide) { aide.close(); return; }   // clic à côté : on ferme
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-aide]");
  if (b) ongletAide(b.dataset.aide!);
});
if (EMBARQUE) aide.querySelectorAll<HTMLElement>('[data-aide="form"], [data-aide="texte"]').forEach((b) => { b.hidden = true; });
$("b-aide").addEventListener("click", () => {
  ongletAide(EMBARQUE ? "carte" : $("formulaire").hidden ? "texte" : "form");
  aide.showModal();
});
document.addEventListener("keydown", (e) => {
  const saisie = /^(TEXTAREA|INPUT|SELECT)$/.test(document.activeElement?.tagName ?? "") || !!document.querySelector("dialog[open]");
  if (e.key === "Escape" && choisi && !saisie) choisir(null);
  // Ctrl+Z hors d'un champ : annule le dernier changement fait par l'outil.
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z" && !saisie && !EMBARQUE && pileAnnuler.length) { e.preventDefault(); annuler(); return; }
  // Suppr : supprimer l'équipement choisi sur la carte (on peut annuler).
  if ((e.key === "Delete" || e.key === "Backspace") && choisi && !saisie && !EMBARQUE) { e.preventDefault(); formulaire.supprimer(choisi); }
});

/* ---------------- actions principales (au-dessus de la carte) ---------------- */
const versAjout = () => {
  mode("form");
  const f = document.querySelector<HTMLElement>(".f-ajout");
  f?.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => f?.querySelector<HTMLInputElement>('[data-f="nom"]')?.focus(), 350);
};
// Le menu ⋯ (renommer, dupliquer, supprimer) se referme dès qu'on a choisi.
document.querySelector(".menu-topo .menu-corps")?.addEventListener("click", () => setTimeout(fermerMenu, 0));
$("a-equipement").addEventListener("click", versAjout);
$("a-cable").addEventListener("click", () => formulaire.editerLien({ a: choisi ?? "", b: "" } as unknown as Liaison));
$("a-excel").addEventListener("click", () => $("f-tableur").click());
$("a-releves").addEventListener("click", () => $("f-dossier").click());
$("a-pdf").addEventListener("click", () => $("b-pdf").click());
$("accueil").addEventListener("click", (e) => {
  const k = (e.target as HTMLElement).closest<HTMLElement>("[data-accueil]")?.dataset.accueil;
  if (k === "excel") $("f-tableur").click();
  else if (k === "releves") $("f-dossier").click();
  else if (k === "equipement") versAjout();
  else if (k === "exemple") creer("Exemple (à supprimer)", EXEMPLE_COMPLET);
});

/* ---------------- fichiers ---------------- */


$("b-sauvegarde").addEventListener("click", () => { fermerMenu(); telecharger(`topologie-reseau-sauvegarde-${dateDuJour()}.json`, projets.exporter(classeur, auteur()), "application/json"); });

/* ---------------- signature ---------------- */
// En visionneuse, c'est la signature de celui qui l'a exportée ; sinon celle du poste.
const auteur = () => (EMBARQUE ? EMBARQUE.auteur ?? "" : projets.lireAuteur());
function afficherSignature() {
  const b = $<HTMLButtonElement>("b-signature");
  b.textContent = `Signature des documents : ${auteur() || "aucune"}`;
  b.hidden = !!EMBARQUE;
  b.disabled = !!EMBARQUE;
}
$("b-signature").addEventListener("click", async () => {
  fermerMenu();
  const v = await demander({ titre: "Signature des documents", texte: "Écrite sur les PDF, les plans et les visionneuses. Laissez vide pour ne rien signer.", valeur: projets.lireAuteur(), ok: "Enregistrer", vide: true });
  if (v === null) return;
  projets.ecrireAuteur(v.replace(/[<>]/g, "").slice(0, 60));
  afficherSignature();
  notifier(v ? `Les documents seront signés « ${projets.lireAuteur()} ».` : "Les documents ne seront plus signés.");
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
    notifier(ajoutees ? `${ajoutees} topologie${ajoutees > 1 ? "s" : ""} ajoutée${ajoutees > 1 ? "s" : ""} (menu des topologies).` : "Rien de nouveau dans ce fichier : ces topologies sont déjà là.");
  } catch (err) { void informer("Sauvegarde illisible", (err as Error).message || "Ce fichier n'est pas une sauvegarde de l'outil (.json)."); }
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
    // Export Excel de « Cartographie Réseau » (relevé automatique des switchs) :
    // son format est connu, pas besoin de vérifier les colonnes.
    const carto = estExportCarto(feuilles);
    // Sinon : ce que l'outil a compris de chaque colonne, à corriger si besoin.
    const corrections = carto ? null : await choisirColonnes(feuilles);
    if (!carto && !corrections) return;
    const r = carto ? cartoVersTexte(feuilles) : tableurVersTexte(feuilles, corrections!);
    if (!r.equipements) { void informer("Aucun équipement trouvé", "Vérifiez que la colonne « Nom » est remplie, puis réessayez."); return; }
    creer(f.name.replace(/\.(xlsx|xls|csv|txt)$/i, ""), r.texte);
    const nb = inv.alertes.filter((a) => a.niveau === "erreur").length;
    void informer(carto ? "Relevé Cartographie Réseau importé" : "Tableau importé", `${pl(r.equipements, "équipement")} et ${pl(r.liaisons, "câble")} dans une nouvelle topologie « ${active().nom} ».`
      + (r.onglets.length > 1 ? `\n\nOnglets :\n${r.onglets.map((o) => `  • ${o.nom} : ${o.lu}`).join("\n")}` : "")
      + (r.ignorees ? `\n\n${pl(r.ignorees, "ligne")} sans nom ou en double ignorée${r.ignorees > 1 ? "s" : ""}.` : "")
      + (r.manquantes.length ? `\nColonnes absentes (facultatives) : ${r.manquantes.map((c) => LIBELLE_COLONNE[c] ?? c).join(", ")}.` : "")
      + (nb ? `\n${pl(nb, "point")} à corriger : voir la liste sous la saisie.` : ""));
  } catch (err) { void informer("Fichier illisible", (err as Error).message || "Ce fichier ne peut pas être lu. Enregistrez-le en .xlsx ou .csv, puis réessayez."); }
});
/* ---------- relevés des switchs (« Relever les switchs.bat ») ---------- */
$("b-releves-dossier").addEventListener("click", () => { fermerMenu(); $("f-dossier").click(); });
$("b-releves").addEventListener("click", () => { fermerMenu(); $("f-releves").click(); });
const contexteReleves = { creer, ajouterGenetec: preconisations.ajouterGenetec, enregistrer };
surFichiers("f-dossier", (l) => importerReleves(l, contexteReleves));
surFichiers("f-releves", (l) => importerReleves(l, contexteReleves));
$("b-script").addEventListener("click", () => { fermerMenu(); void telechargerScript(); });

/* ---------- couleurs ---------- */
$("b-couleurs").addEventListener("click", () => ouvrirCouleurs({
  lire: () => couleurs,
  ecrire: (c) => { couleurs = c; },
  redessiner: () => { recalculer(); maj3D(true); },
}));

installerExports({
  plan, planAJour, inv: () => inv, disp: () => disp, site: () => site, vue: () => vue,
  v3: () => v3, montrer3D: () => montrer("3d"), topologie: active, texte: () => editeur.valeur,
  auteur: () => auteur(), couleurs: () => couleurs, modele: MODELE,
});
document.addEventListener("click", (e) => { if (!(e.target as Element).closest("details.menu")) fermerMenu(); });
// Un seul menu ouvert à la fois (Fichiers ou ⋯).
document.querySelectorAll<HTMLDetailsElement>("details.menu").forEach((m) => m.addEventListener("toggle", () => {
  if (m.open) document.querySelectorAll<HTMLDetailsElement>("details.menu").forEach((x) => { if (x !== m) x.open = false; });
}));

/* ---------------- démarrage ---------------- */

listerTopologies();
editeur.definir(active().texte);
recalculer();
plan.cadrer();
try { if (localStorage.getItem("carte-reseau:mode") === "texte" && !EMBARQUE) mode("texte"); } catch { /* sans importance */ }
if (EMBARQUE) {
  document.title = `${EMBARQUE.nom} · Topologie réseau v1 (lecture seule)`;
  // Bandeau visible dans la barre du haut : on sait tout de suite qu'on regarde une copie figée.
  const bandeau = document.createElement("span");
  bandeau.className = "bandeau-lecture";
  bandeau.textContent = `Lecture seule · exportée le ${new Date(EMBARQUE.exporte).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}${EMBARQUE.auteur ? ` · établie par ${EMBARQUE.auteur}` : ""}`;
  document.querySelector(".marque")?.append(bandeau);
}
