/**
 * La saisie simple : on choisit dans des listes, l'outil écrit la ligne.
 *
 * Rien à apprendre : on clique le type, on donne un nom, on choisit sur quel
 * switch et quel port c'est branché (seuls les ports libres sont proposés).
 * Le site, le lieu et la baie restent sélectionnés d'un ajout à l'autre :
 * on ne les ressaisit pas.
 *
 * Le texte reste la référence : le formulaire ne fait qu'y ajouter, modifier
 * ou retirer des lignes. Les deux modes restent donc toujours d'accord.
 */
import { APPARENCE } from "./apparence.ts";
import type { Disposition } from "./disposition.ts";
import { PICTOS } from "./pictos.ts";
import { GENRES, MEDIAS, type Equipement, type Genre, type Inventaire, type Liaison, type Media } from "./saisie.ts";

type Acces = {
  donnees: () => { inv: Inventaire; disp: Disposition };
  texte: () => string;
  ecrire: (t: string) => void;
  choisir: (nom: string) => void;
  versTexte: (ligne: number) => void;
};

const ORDRE: Genre[] = ["switch", "camera", "passerelle", "parefeu", "borne", "poste", "nvr", "serveur", "nas", "imprimante", "telephone", "onduleur", "autre"];
const PREFIXE: Record<Genre, string> = {
  passerelle: "GW", parefeu: "FW", switch: "SW", camera: "CAM", nvr: "NVR", borne: "AP", serveur: "SRV",
  nas: "NAS", poste: "PC", imprimante: "IMP", telephone: "TEL", onduleur: "UPS", autre: "EQ",
};
const echap = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const code = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "").toUpperCase().slice(0, 6);
// Les séparateurs de la syntaxe ne doivent pas se glisser dans une valeur.
const propre = (s: string) => s.replace(/[|;\t#]/g, " ").replace(/\s+/g, " ").trim();
const nomPropre = (s: string) => propre(s).replace(/\s+/g, "-");
const A_FACADE = new Set<Genre>(["switch", "passerelle", "parefeu"]);

export function creerFormulaire(racine: HTMLElement, acces: Acces) {
  // Ce qui reste sélectionné d'un ajout à l'autre.
  const ctx = { site: "", point: "", baie: "" };
  let genre: Genre = "switch";
  let edition: { eq: Equipement; lien?: Liaison } | null = null;

  racine.innerHTML = `
    <section class="f-bloc f-ou">
      <h3>Où ?</h3>
      <div class="f-ligne">
        <label>Site<select data-c="site"></select></label>
        <label>Lieu <small>(école, bâtiment…)</small><select data-c="point"></select></label>
        <label>Baie<select data-c="baie"></select></label>
      </div>
      <div class="f-ligne">
        <label>Passerelle du site <small>(IP par défaut de tout le site)</small><input data-c="gw" placeholder="10.0.0.1" autocomplete="off" spellcheck="false" /></label>
      </div>
    </section>

    <section class="f-bloc f-ajout">
      <h3 class="f-titre-ajout">Ajouter un équipement</h3>
      <div class="f-types" role="radiogroup" aria-label="Type d'équipement"></div>
      <div class="f-ligne">
        <label class="large">Nom<input data-f="nom" autocomplete="off" spellcheck="false" /></label>
        <label class="etroit">Nombre<input data-f="qte" type="number" min="1" max="200" value="1" /></label>
      </div>
      <div class="f-ligne">
        <label>Adresse IP <small>(la 1re si plusieurs)</small><input data-f="ip" placeholder="10.0.0.2" autocomplete="off" spellcheck="false" /></label>
        <label>Modèle<input data-f="modele" placeholder="Cisco 9200, Dôme 4 MP…" autocomplete="off" /></label>
      </div>
      <div class="f-ligne">
        <label>IP passerelle <small>(vide = celle du site)</small><input data-f="gw" autocomplete="off" spellcheck="false" /></label>
      </div>
      <div class="f-ligne f-switch">
        <label>Ports RJ45<select data-f="ports"><option>8</option><option>12</option><option>16</option><option selected>24</option><option>48</option></select></label>
        <label>Cages SFP (fibre)<select data-f="sfp"><option>0</option><option>2</option><option selected>4</option><option>8</option></select></label>
      </div>
      <fieldset class="f-branche">
        <legend>Branché sur</legend>
        <div class="f-ligne">
          <label class="large">Switch ou passerelle<select data-f="vers"></select></label>
          <label>Port<select data-f="port"></select></label>
        </div>
        <div class="f-ligne">
          <label class="f-monport">Port de cet équipement <small>(facultatif)</small><input data-f="monport" placeholder="Te1, 24…" autocomplete="off" /></label>
          <label>Câble<select data-f="media"><option value="">Automatique</option>${(Object.keys(MEDIAS) as Media[]).map((m) => `<option value="${m}">${MEDIAS[m]}</option>`).join("")}</select></label>
          <label class="etroit">VLAN<input data-f="vlan" placeholder="30" autocomplete="off" /></label>
        </div>
        <label class="f-case"><input type="checkbox" data-f="trunk" /> Trunk (plusieurs VLAN, lien entre switchs)</label>
      </fieldset>
      <p class="f-apercu" aria-live="polite"></p>
      <div class="f-boutons">
        <button type="button" class="primaire" data-a="ajouter">Ajouter</button>
        <button type="button" data-a="annuler" hidden>Annuler</button>
      </div>
    </section>

    <section class="f-bloc">
      <h3>Relier deux équipements <small>(trunk, inter-sites…)</small></h3>
      <div class="f-ligne">
        <label class="large">De<select data-l="a"></select></label><label>Port<select data-l="pa"></select></label>
      </div>
      <div class="f-ligne">
        <label class="large">Vers<select data-l="b"></select></label><label>Port<select data-l="pb"></select></label>
      </div>
      <div class="f-ligne">
        <label>Câble<select data-l="media"><option value="">Automatique</option>${(Object.keys(MEDIAS) as Media[]).map((m) => `<option value="${m}">${MEDIAS[m]}</option>`).join("")}</select></label>
        <label class="etroit">VLAN<input data-l="vlan" placeholder="10,20" autocomplete="off" /></label>
        <label>Remarque<input data-l="libelle" placeholder="lien opérateur…" autocomplete="off" /></label>
      </div>
      <label class="f-case"><input type="checkbox" data-l="trunk" /> Trunk</label>
      <div class="f-boutons"><button type="button" class="primaire" data-a="relier">Relier</button></div>
    </section>

    <section class="f-bloc f-inventaire">
      <h3>Inventaire</h3>
      <input type="search" data-f="filtre" placeholder="Filtrer par nom, IP, site…" />
      <div class="f-liste"></div>
    </section>`;

  const $ = <T extends HTMLElement>(sel: string) => racine.querySelector(sel) as T;
  const champ = <T extends HTMLElement = HTMLInputElement>(k: string) => $<T>(`[data-f="${k}"]`);
  const lienC = <T extends HTMLElement = HTMLSelectElement>(k: string) => $<T>(`[data-l="${k}"]`);
  const NOUVEAU = "\u0000nouveau";

  /* ---------- listes ---------- */
  const options = (sel: HTMLSelectElement, valeurs: { v: string; t: string }[], courant: string) => {
    sel.innerHTML = valeurs.map((o) => `<option value="${echap(o.v)}"${o.v === courant ? " selected" : ""}>${echap(o.t)}</option>`).join("");
    if (!valeurs.some((o) => o.v === courant)) sel.selectedIndex = 0;
  };
  const portsLibres = (nom: string, garder?: string) => {
    const { disp } = acces.donnees();
    const f = disp.facades.get(nom);
    if (!f) return [];
    const pris = new Set([...f.branches.keys()].filter((k) => k !== garder).map((k) => f.parId.get(k)));
    return f.ports.filter((p) => !pris.has(p)).map((p) => p.id);
  };

  function remplirOu() {
    const { inv } = acces.donnees();
    const sites = inv.sites.map((s) => s.nom);
    if (ctx.site && !sites.includes(ctx.site)) sites.push(ctx.site);
    if (!ctx.site && sites.length) ctx.site = sites[0];
    options($('[data-c="site"]'), [...sites.map((s) => ({ v: s, t: s })), { v: NOUVEAU, t: "＋ Nouveau site…" }], ctx.site);
    const eqSite = inv.equipements.filter((e) => e.site === ctx.site);
    const points = [...new Set(eqSite.map((e) => e.point).filter(Boolean) as string[])];
    if (ctx.point && !points.includes(ctx.point)) points.push(ctx.point);
    options($('[data-c="point"]'), [{ v: "", t: "— aucun —" }, ...points.map((p) => ({ v: p, t: p })), { v: NOUVEAU, t: "＋ Nouveau lieu…" }], ctx.point);
    const baies = [...new Set(eqSite.filter((e) => (e.point ?? "") === ctx.point).map((e) => e.baie).filter(Boolean) as string[])];
    if (ctx.baie && !baies.includes(ctx.baie)) baies.push(ctx.baie);
    options($('[data-c="baie"]'), [{ v: "", t: "— aucune —" }, ...baies.map((b) => ({ v: b, t: b })), { v: NOUVEAU, t: "＋ Nouvelle baie…" }], ctx.baie);
    const gwSite = inv.sites.find((s) => s.nom === ctx.site)?.passerelleIp ?? "";
    const champGwSite = $<HTMLInputElement>('[data-c="gw"]');
    if (document.activeElement !== champGwSite) champGwSite.value = gwSite;
    champ("gw").placeholder = gwSite ? `${gwSite} (celle du site)` : "10.0.0.1";
  }

  function remplirTypes() {
    $(".f-types").innerHTML = ORDRE.map((g) => `
      <button type="button" role="radio" aria-checked="${g === genre}" data-g="${g}" style="--c:${APPARENCE[g].couleur}" title="${GENRES[g].libelle}">
        <svg viewBox="0 0 1 1" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="0.08" stroke-linecap="round" stroke-linejoin="round">${PICTOS[g]}</g></svg>
        <span>${GENRES[g].libelle.replace(/ \(.*\)| \/.*/, "")}</span>
      </button>`).join("");
  }

  /** Équipements à façade, ceux du site courant d'abord. */
  function cibles() {
    const { inv } = acces.donnees();
    return inv.equipements.filter((e) => A_FACADE.has(e.genre) && e.nom !== edition?.eq.nom)
      .sort((a, b) => Number(b.site === ctx.site) - Number(a.site === ctx.site) || Number((b.point ?? "") === ctx.point) - Number((a.point ?? "") === ctx.point));
  }

  function remplirBranche(garderPort?: string) {
    const vers = champ<HTMLSelectElement>("vers");
    const avant = vers.value;
    const cs = cibles();
    options(vers, [{ v: "", t: "— pas branché —" }, ...cs.map((e) => ({ v: e.nom, t: `${e.nom} · ${e.site}${e.point ? ` / ${e.point}` : ""}` }))],
      avant || (cs[0]?.site === ctx.site ? cs[0].nom : ""));
    remplirPorts(garderPort);
  }
  function remplirPorts(garderPort?: string) {
    const vers = champ<HTMLSelectElement>("vers").value;
    const port = champ<HTMLSelectElement>("port");
    const libres = vers ? portsLibres(vers, garderPort) : [];
    const qte = Number(champ("qte").value) || 1;
    // Le port déjà choisi s'il est encore libre sur ce switch, sinon le
    // premier port RJ45 libre : on ne laisse jamais « sans port » par accident.
    const voulu = garderPort ?? (libres.includes(port.value) ? port.value : libres.find((p) => /^\d+$/.test(p)) ?? libres[0] ?? "");
    options(port, vers ? [{ v: "", t: "— sans port —" }, ...libres.map((p) => ({ v: p, t: qte > 1 ? `${p} (et suivants)` : p }))] : [{ v: "", t: "—" }], voulu);
    port.disabled = !vers;
    // Deux switchs reliés : trunk coché par défaut.
    const e = acces.donnees().inv.equipements.find((x) => x.nom === vers);
    if (!edition) champ<HTMLInputElement>("trunk").checked = genre === "switch" && e?.genre === "switch";
    apercu();
  }

  function nomPropose() {
    const { inv } = acces.donnees();
    const base = `${PREFIXE[genre]}-${code(ctx.point || ctx.site) || "X"}`;
    const pris = new Set(inv.equipements.map((e) => e.nom.toUpperCase()));
    for (let i = 1; i < 1000; i++) { const n = `${base}-${i}`; if (!pris.has(n) && !pris.has(`${n}-1`)) return n; }
    return base;
  }

  /* ---------- écriture des lignes ---------- */
  function ligneEquipement(): string | null {
    const nom = nomPropre(champ("nom").value);
    if (!nom) return null;
    const qte = Math.max(1, Math.min(200, Number(champ("qte").value) || 1));
    const p: string[] = [`${genre} ${nom}${qte > 1 ? ` x${qte}` : ""}`];
    if (champ("ip").value.trim()) p.push(propre(champ("ip").value));
    if (champ("modele").value.trim()) p.push(propre(champ("modele").value));
    if (ctx.site) p.push(`@${propre(ctx.site)}${ctx.point ? `/${propre(ctx.point)}` : ""}`);
    if (ctx.baie) p.push(`baie=${propre(ctx.baie)}`);
    if (champ("gw").value.trim()) p.push(`passerelle=${propre(champ("gw").value)}`);
    if (genre === "switch") p.push(`ports=${champ<HTMLSelectElement>("ports").value}`, `sfp=${champ<HTMLSelectElement>("sfp").value}`);
    return p.join(" | ");
  }
  function optionsLien(media: string, vlan: string, trunk: boolean) {
    const o: string[] = [];
    if (media) o.push(media);
    if (trunk) o.push("trunk");
    if (vlan.trim()) o.push(`vlan=${propre(vlan).replace(/\s+/g, "")}`);
    return o;
  }
  function ligneBranche(nom: string): string | null {
    const vers = champ<HTMLSelectElement>("vers").value;
    if (!vers) return null;
    const port = champ<HTMLSelectElement>("port").value;
    const mon = propre(champ("monport").value);
    return [`${nom}${mon ? `:${mon}` : ""} -> ${vers}${port ? `:${port}` : ""}`,
      ...optionsLien(champ<HTMLSelectElement>("media").value, champ("vlan").value, champ<HTMLInputElement>("trunk").checked)].join(" | ");
  }
  /** Une ligne d'équipement avec son branchement : « sur … » quand c'est possible. */
  function lignesAAjouter(): string[] | null {
    const l = ligneEquipement();
    if (!l) return null;
    const vers = champ<HTMLSelectElement>("vers").value;
    if (!vers) return [l];
    const mon = propre(champ("monport").value);
    if (mon) return [l, ligneBranche(nomPropre(champ("nom").value))!];
    const port = champ<HTMLSelectElement>("port").value;
    return [[l, `sur ${vers}${port ? `:${port}` : ""}`,
      ...optionsLien(champ<HTMLSelectElement>("media").value, champ("vlan").value, champ<HTMLInputElement>("trunk").checked)].join(" | ")];
  }

  function apercu() {
    const l = lignesAAjouter();
    let alerte = "";
    // Plusieurs caméras sur un switch : y a-t-il assez de ports qui se suivent ?
    const vers = champ<HTMLSelectElement>("vers").value, port = champ<HTMLSelectElement>("port").value;
    const qte = Number(champ("qte").value) || 1;
    if (vers && port && qte > 1) {
      const libres = new Set(portsLibres(vers, edition ? undefined : undefined));
      const m = port.match(/^(.*?)(\d+)$/);
      const manquants = m ? Array.from({ length: qte }, (_, k) => `${m[1]}${Number(m[2]) + k}`).filter((p) => !libres.has(p)) : [];
      if (manquants.length) alerte = `<b class="f-alerte">⚠ Ports ${echap(manquants.join(", "))} déjà pris ou inexistants sur ${echap(vers)}.</b> `;
    }
    $(".f-apercu").innerHTML = alerte + (l ? `<span>Ligne écrite :</span> <code>${echap(l.join("  ⏎  "))}</code>` : `<span>Donnez un nom pour ajouter.</span>`);
  }

  function vider() {
    edition = null;
    champ("nom").value = nomPropose();
    champ("qte").value = "1";
    champ("ip").value = "";
    champ("modele").value = "";
    champ("monport").value = "";
    champ("gw").value = "";
    champ("vlan").value = genre === "camera" ? champ("vlan").value : "";
    $(".f-titre-ajout").textContent = "Ajouter un équipement";
    $('[data-a="ajouter"]').textContent = "Ajouter";
    $<HTMLButtonElement>('[data-a="annuler"]').hidden = true;
    champ("qte").removeAttribute("disabled");
    actualiserType();
  }

  function actualiserType() {
    racine.querySelectorAll<HTMLElement>(".f-types [data-g]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.g === genre)));
    racine.querySelector<HTMLElement>(".f-switch")!.hidden = genre !== "switch";
    remplirBranche();
  }

  /* ---------- texte ---------- */
  function modifierTexte(fn: (lignes: string[]) => void) {
    const lignes = acces.texte().split("\n");
    fn(lignes);
    acces.ecrire(lignes.join("\n"));
  }
  function ajouter() {
    const l = lignesAAjouter();
    if (!l) { champ("nom").focus(); return; }
    const nom = nomPropre(champ("nom").value);
    const qte = Number(champ("qte").value) || 1;
    const premier = qte > 1 ? `${nom}-1` : nom;
    const { inv } = acces.donnees();
    if (!edition && inv.equipements.some((e) => e.nom.toLowerCase() === premier.toLowerCase() || e.nom.toLowerCase() === nom.toLowerCase())) {
      alert(`« ${nom} » existe déjà. Choisissez un autre nom.`);
      champ("nom").focus();
      return;
    }
    if (edition) {
      const { eq, lien } = edition;
      modifierTexte((lignes) => {
        // On garde le retrait d'origine : une ligne dans un bloc « baie » y reste,
        // et les lignes suivantes du bloc aussi.
        const retrait = (n: number) => lignes[n - 1]?.match(/^\s*/)?.[0] ?? "";
        const rEq = retrait(eq.ligne);
        // Le branchement écrit sur une autre ligne est remplacé à sa place.
        if (lien && lien.ligne !== eq.ligne) {
          const nouvelle = ligneBranche(nom);
          lignes[eq.ligne - 1] = rEq + ligneEquipement()!;
          if (nouvelle) lignes[lien.ligne - 1] = retrait(lien.ligne) + nouvelle; else lignes.splice(lien.ligne - 1, 1);
        } else {
          lignes.splice(eq.ligne - 1, 1, ...l.map((x) => rEq + x));
        }
      });
    } else {
      modifierTexte((lignes) => {
        while (lignes.length && !lignes[lignes.length - 1].trim()) lignes.pop();
        lignes.push(...l, "");
      });
    }
    const vise = qte > 1 ? `${nom}-1` : nom;
    vider();
    acces.choisir(vise);
  }

  function relier() {
    const a = lienC("a").value, b = lienC("b").value;
    if (!a || !b || a === b) { alert("Choisissez deux équipements différents."); return; }
    const pa = lienC("pa").value, pb = lienC("pb").value;
    const l = [`${a}${pa ? `:${pa}` : ""} -> ${b}${pb ? `:${pb}` : ""}`,
      ...optionsLien(lienC("media").value, lienC<HTMLInputElement>("vlan").value, lienC<HTMLInputElement>("trunk").checked)];
    if (lienC<HTMLInputElement>("libelle").value.trim()) l.push(propre(lienC<HTMLInputElement>("libelle").value));
    modifierTexte((lignes) => {
      while (lignes.length && !lignes[lignes.length - 1].trim()) lignes.pop();
      lignes.push(l.join(" | "), "");
    });
    lienC<HTMLInputElement>("libelle").value = "";
    acces.choisir(a);
  }

  function remplirRelier() {
    const { inv } = acces.donnees();
    const tous = [...inv.equipements].sort((x, y) => Number(A_FACADE.has(y.genre)) - Number(A_FACADE.has(x.genre)) || x.site.localeCompare(y.site));
    const opts = [{ v: "", t: "— choisir —" }, ...tous.map((e) => ({ v: e.nom, t: `${e.nom} · ${e.site}${e.point ? ` / ${e.point}` : ""}` }))];
    (["a", "b"] as const).forEach((k) => {
      const sel = lienC(k), avant = sel.value;
      options(sel, opts, avant);
      const port = lienC(k === "a" ? "pa" : "pb"), pav = port.value;
      const libres = sel.value ? portsLibres(sel.value) : [];
      options(port, [{ v: "", t: libres.length ? "— sans port —" : "—" }, ...libres.map((p) => ({ v: p, t: p }))], pav);
    });
    const ea = inv.equipements.find((e) => e.nom === lienC("a").value), eb = inv.equipements.find((e) => e.nom === lienC("b").value);
    if (ea && eb) lienC<HTMLInputElement>("trunk").checked = ea.genre === "switch" && eb.genre === "switch";
  }

  /* ---------- inventaire ---------- */
  function remplirInventaire() {
    const { inv } = acces.donnees();
    const q = champ("filtre").value.trim().toLowerCase();
    const brancheDe = (e: Equipement) => {
      const l = inv.liaisons.find((x) => (x.a === e.nom || x.b === e.nom) && inv.equipements.some((y) => A_FACADE.has(y.genre) && y.nom === (x.a === e.nom ? x.b : x.a)));
      if (!l) return "";
      const [v, p] = l.a === e.nom ? [l.b, l.portB] : [l.a, l.portA];
      return `${v}${p ? `:${p}` : ""}`;
    };
    const html: string[] = [];
    inv.sites.forEach((s) => {
      const eqs = inv.equipements.filter((e) => e.site === s.nom &&
        (!q || [e.nom, e.ip ?? "", e.site, e.point ?? "", e.baie ?? ""].some((v) => v.toLowerCase().includes(q))));
      if (!eqs.length) return;
      html.push(`<h4>${echap(s.nom)} <small>${eqs.length}</small></h4>`);
      const points = [...new Set(eqs.map((e) => e.point ?? ""))];
      points.forEach((p) => {
        if (points.length > 1 || p) html.push(`<h5>⌖ ${echap(p || "Central")}</h5>`);
        eqs.filter((e) => (e.point ?? "") === p).forEach((e) => {
          const b = brancheDe(e);
          html.push(`<div class="f-eq" data-nom="${echap(e.nom)}" style="--c:${APPARENCE[e.genre].couleur}">
            <button type="button" class="f-voir" data-a="voir" title="Voir sur la carte"><i></i><b>${echap(e.nom)}</b><span>${echap(e.ip ?? "")}</span>${b ? `<em>→ ${echap(b)}</em>` : ""}</button>
            <button type="button" class="f-mini" data-a="modifier" title="Modifier" aria-label="Modifier ${echap(e.nom)}">✎</button>
            <button type="button" class="f-mini danger" data-a="supprimer" title="Supprimer" aria-label="Supprimer ${echap(e.nom)}">✕</button>
          </div>`);
        });
      });
    });
    $(".f-liste").innerHTML = html.join("") || `<p class="f-vide">${q ? "Aucun résultat." : "Rien encore : ajoutez un premier switch ci-dessus."}</p>`;
  }

  function modifier(nom: string) {
    const { inv, disp } = acces.donnees();
    const e = inv.equipements.find((x) => x.nom === nom);
    if (!e) return;
    const groupe = inv.equipements.filter((x) => x.ligne === e.ligne).length > 1;
    if (groupe) { acces.versTexte(e.ligne); return; }  // un groupe « x6 » se modifie dans le texte
    const lien = inv.liaisons.find((l) => (l.a === e.nom || l.b === e.nom) && disp.facades.has(l.a === e.nom ? l.b : l.a) &&
      !(A_FACADE.has(e.genre) && inv.equipements.find((x) => x.nom === (l.a === e.nom ? l.b : l.a))?.site !== e.site));
    edition = { eq: e, lien };
    genre = e.genre;
    ctx.site = e.site; ctx.point = e.point ?? ""; ctx.baie = e.baie ?? "";
    remplirOu();
    champ("nom").value = e.nom;
    champ("qte").value = "1";
    champ("qte").setAttribute("disabled", "");
    champ("ip").value = e.ip ?? "";
    champ("modele").value = e.infos[0] ?? "";
    champ("gw").value = e.passerelleHeritee ? "" : e.passerelleIp ?? "";
    const ports = e.kv.find(([k]) => /^ports?$/i.test(k))?.[1], sfp = e.kv.find(([k]) => /^sfp$/i.test(k))?.[1];
    if (ports) champ<HTMLSelectElement>("ports").value = ports;
    if (sfp) champ<HTMLSelectElement>("sfp").value = sfp;
    actualiserType();
    if (lien) {
      const [v, p, mon] = lien.a === e.nom ? [lien.b, lien.portB, lien.portA] : [lien.a, lien.portA, lien.portB];
      champ<HTMLSelectElement>("vers").value = v;
      remplirPorts(p);
      champ("monport").value = mon ?? "";
      champ<HTMLSelectElement>("media").value = lien.media && lien.media !== "cuivre" ? lien.media : "";
      champ("vlan").value = lien.vlans ?? "";
      champ<HTMLInputElement>("trunk").checked = lien.mode === "trunk";
    } else champ<HTMLSelectElement>("vers").value = "";
    $(".f-titre-ajout").textContent = `Modifier ${e.nom}`;
    $('[data-a="ajouter"]').textContent = "Enregistrer";
    $<HTMLButtonElement>('[data-a="annuler"]').hidden = false;
    apercu();
    $(".f-ajout").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function supprimer(nom: string) {
    const { inv } = acces.donnees();
    const e = inv.equipements.find((x) => x.nom === nom);
    if (!e) return;
    const groupe = inv.equipements.filter((x) => x.ligne === e.ligne);
    const liens = inv.liaisons.filter((l) => groupe.some((g) => g.nom === l.a || g.nom === l.b) && l.ligne !== e.ligne);
    const msg = groupe.length > 1
      ? `Cette ligne crée ${groupe.length} équipements (${groupe[0].nom} … ${groupe[groupe.length - 1].nom}). Les supprimer tous ?`
      : `Supprimer ${e.nom} ?`;
    if (!confirm(msg + (liens.length ? `\n\n${liens.length} liaison(s) écrite(s) à part seront aussi retirées.` : ""))) return;
    modifierTexte((lignes) => {
      [...new Set([e.ligne, ...liens.map((l) => l.ligne)])].sort((a, b) => b - a).forEach((n) => lignes.splice(n - 1, 1));
    });
    if (edition?.eq.nom === nom) vider();
  }

  /** La passerelle par défaut du site : sur la ligne « site … », créée au besoin. */
  function passerelleDuSite(v: string) {
    const ip = propre(v);
    if (ip && !/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(ip)) { alert(`« ${ip} » n'est pas une adresse IP.`); return; }
    if (!ctx.site) return;
    const echappe = ctx.site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^(\\s*site\\s+${echappe})\\s*(\\|.*)?$`, "i");
    modifierTexte((lignes) => {
      const i = lignes.findIndex((l) => re.test(l));
      if (i < 0) {
        if (!ip) return;
        // Pas encore de ligne « site » : on l'ajoute à la fin, où elle ne
        // change le site d'aucune ligne existante.
        while (lignes.length && !lignes[lignes.length - 1].trim()) lignes.pop();
        lignes.push("", `site ${ctx.site} | passerelle=${ip}`, "");
        return;
      }
      const [, tete, reste = ""] = lignes[i].match(re)!;
      const champs = reste.split("|").map((x) => x.trim()).filter((x) => x && !/^(passerelle|gw|gateway|pass|gtw)\s*=/i.test(x));
      if (ip) champs.push(`passerelle=${ip}`);
      lignes[i] = [tete, ...champs].join(" | ");
    });
  }

  /* ---------- événements ---------- */
  racine.addEventListener("change", (ev) => {
    const t = ev.target as HTMLElement;
    if (t.dataset.c === "gw") { passerelleDuSite((t as HTMLInputElement).value); return; }
    const c = t.dataset.c as keyof typeof ctx | undefined;
    if (c) {
      const sel = t as HTMLSelectElement;
      if (sel.value === NOUVEAU) {
        const libelle = c === "site" ? "Nom du nouveau site (ville, agence…) :" : c === "point" ? "Nom du nouveau lieu (école, bâtiment…) :" : "Nom de la nouvelle baie :";
        const v = propre(prompt(libelle) ?? "");
        if (v) ctx[c] = v;
      } else ctx[c] = sel.value;
      if (c === "site") { ctx.point = ""; ctx.baie = ""; }
      if (c === "point") ctx.baie = "";
      remplirOu();
      if (!edition) champ("nom").value = nomPropose();
      remplirBranche();
      return;
    }
    if (t.dataset.f === "vers") { remplirPorts(); return; }
    if (t.dataset.l === "a" || t.dataset.l === "b") { remplirRelier(); return; }
    apercu();
  });
  racine.addEventListener("input", (ev) => {
    const t = ev.target as HTMLElement;
    if (t.dataset.f === "filtre") { remplirInventaire(); return; }
    if (t.dataset.f === "qte") remplirPorts();
    if (t.dataset.f) apercu();
  });
  racine.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement;
    const g = t.closest<HTMLElement>("[data-g]");
    if (g) {
      genre = g.dataset.g as Genre;
      if (!edition) champ("nom").value = nomPropose();
      actualiserType();
      return;
    }
    const a = t.closest<HTMLElement>("[data-a]")?.dataset.a;
    const nom = t.closest<HTMLElement>(".f-eq")?.dataset.nom;
    if (a === "ajouter") ajouter();
    else if (a === "annuler") vider();
    else if (a === "relier") relier();
    else if (a === "voir" && nom) acces.choisir(nom);
    else if (a === "modifier" && nom) modifier(nom);
    else if (a === "supprimer" && nom) supprimer(nom);
  });
  racine.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && (ev.target as HTMLElement).closest(".f-ajout") && (ev.target as HTMLElement).tagName === "INPUT") { ev.preventDefault(); ajouter(); }
  });

  remplirTypes();

  return {
    /** À appeler quand l'inventaire change (frappe, import, changement de topologie). */
    actualiser() {
      remplirOu();
      remplirBranche(edition ? undefined : undefined);
      remplirRelier();
      remplirInventaire();
      if (!edition && !champ("nom").value) champ("nom").value = nomPropose();
      apercu();
    },
    reinitialiser() { ctx.site = ""; ctx.point = ""; ctx.baie = ""; vider(); },
    modifier,
  };
}
