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
import { lirePort } from "./facade.ts";
import type { Disposition } from "./disposition.ts";
import { PICTOS } from "./pictos.ts";
import { GENRES, lireMedia as lireMediaTexte, MEDIAS, ipPlus, type Equipement, type Genre, type Inventaire, type Liaison, type Media } from "./saisie.ts";

type Acces = {
  donnees: () => { inv: Inventaire; disp: Disposition };
  texte: () => string;
  /** Écrit le texte ; `annonce` : message affiché avec un bouton « Annuler ». */
  ecrire: (t: string, annonce?: string) => void;
  choisir: (nom: string) => void;
  versTexte: (ligne: number) => void;
};

const ORDRE: Genre[] = ["switch", "camera", "passerelle", "parefeu", "borne", "poste", "nvr", "serveur", "nas", "imprimante", "telephone", "onduleur", "autre"];
const PREFIXE: Record<Genre, string> = {
  passerelle: "GW", parefeu: "FW", switch: "SW", camera: "CAM", nvr: "NVR", borne: "AP", serveur: "SRV",
  nas: "NAS", poste: "PC", imprimante: "IMP", telephone: "TEL", onduleur: "UPS", autre: "EQ",
};
const echap = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** « Site A » → « SITE-A », « Nanterre » → « NANTERRE » : lisible, sans couper un mot au milieu. */
const code = (s: string) => {
  const mots = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  let r = "";
  for (const m of mots) { const t = r ? `${r}-${m}` : m; if (t.length > 14) break; r = t; }
  return r || (mots[0] ?? "").slice(0, 14);
};
// Les séparateurs de la syntaxe ne doivent pas se glisser dans une valeur.
const propre = (s: string) => s.replace(/[|;\t#]/g, " ").replace(/\s+/g, " ").trim();
const nomPropre = (s: string) => propre(s).replace(/\s+/g, "-");
const A_FACADE = new Set<Genre>(["switch", "passerelle", "parefeu"]);
/** Les ports d'un équipement qui n'a pas de façade dessinée, d'après « ports= » / « sfp= » / « wan= ». */
function portsDeclares(e: Equipement): string[] {
  const n = (re: RegExp) => Math.min(96, parseInt(e.kv.find(([k]) => re.test(k))?.[1] ?? "", 10) || 0);
  const rj = n(/^ports?$/i), sfp = n(/^sfp$/i), wan = n(/^wan$/i);
  return [...Array.from({ length: rj }, (_, i) => String(i + 1)), ...Array.from({ length: sfp }, (_, i) => `SFP${i + 1}`),
    ...Array.from({ length: wan }, (_, i) => (wan > 1 ? `WAN${i + 1}` : "WAN"))];
}

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
      <details class="f-plus">
        <summary>Passerelle du site</summary>
        <div class="f-ligne">
          <label>IP de la passerelle <small>(par défaut pour tout le site)</small><input data-c="gw" placeholder="10.0.0.1" autocomplete="off" spellcheck="false" /></label>
        </div>
      </details>
    </section>

    <section class="f-bloc f-ajout">
      <h3 class="f-titre-ajout">Ajouter un équipement</h3>
      <div class="f-types" role="radiogroup" aria-label="Type d'équipement"></div>
      <div class="f-ligne">
        <label class="large">Nom <small>(plusieurs : séparés par des virgules)</small><input data-f="nom" autocomplete="off" spellcheck="false" placeholder="SW-ACCUEIL, SW-ETAGE1, SW-ETAGE2" /></label>
        <label class="etroit">Nombre<input data-f="qte" type="number" min="1" max="200" value="1" /></label>
      </div>
      <div class="f-ligne">
        <label>Adresse IP <small>(une par équipement)</small><input data-f="ip" placeholder="10.0.0.2" autocomplete="off" spellcheck="false" /></label>
        <label>Modèle<input data-f="modele" placeholder="Cisco 9200, Dôme 4 MP…" autocomplete="off" /></label>
      </div>
      <details class="f-plus f-plus-eq">
        <summary>Plus de détails · passerelle, masque, n° de série, MAC</summary>
        <div class="f-ligne">
          <label>IP passerelle <small>(vide = celle du site)</small><input data-f="gw" autocomplete="off" spellcheck="false" /></label>
          <label>Masque<input data-f="masque" placeholder="255.255.255.0 ou /24" autocomplete="off" spellcheck="false" /></label>
        </div>
        <div class="f-ligne">
          <label>N° de série <small>(un par équipement)</small><input data-f="serie" autocomplete="off" spellcheck="false" /></label>
          <label>Adresse MAC <small>(une par équipement)</small><input data-f="mac" placeholder="00:11:22:AA:BB:CC" autocomplete="off" spellcheck="false" /></label>
        </div>
      </details>
      <div class="f-ligne f-switch">
        <label>Ports RJ45 <small>(un par switch : 24, 8, 48)</small><input data-f="ports" inputmode="numeric" list="l-rj45" value="24" autocomplete="off" spellcheck="false" /></label>
        <label>Cages SFP <small>(fibre · 4, 0, 2)</small><input data-f="sfp" inputmode="numeric" list="l-sfp" value="4" autocomplete="off" spellcheck="false" /></label>
        <label class="etroit f-wan">Ports WAN<input data-f="wan" inputmode="numeric" value="1" autocomplete="off" spellcheck="false" /></label>
        <datalist id="l-rj45"><option value="2"><option value="4"><option value="5"><option value="8"><option value="10"><option value="16"><option value="24"><option value="48"></datalist>
        <datalist id="l-sfp"><option value="0"><option value="1"><option value="2"><option value="4"><option value="8"></datalist>
      </div>
      <div class="f-detail" hidden>
        <p class="f-quand">Une ligne par équipement : changez l'IP ou les ports de chacun ici (ou avec des virgules dans les cases au-dessus).</p>
        <table><thead></thead><tbody></tbody></table>
      </div>
      <fieldset class="f-branche f-raccord">
        <legend><span class="f-pastille">A</span> Où est branché l'équipement que vous ajoutez ?</legend>
        <p class="f-quand">Le switch (ou l'enregistreur, le serveur…) et le port où arrive son câble.</p>
        <p class="f-aide-branche"></p>
        <div class="f-phrase">
          <span>Branché sur</span>
          <label class="large"><span class="sr">Switch où il est branché</span><select data-f="vers"></select></label>
          <label class="f-port1">port <select data-f="port"></select></label>
        </div>
        <div class="f-ports-groupe" hidden></div>
        <div class="f-phrase">
          <span>pour</span> <b class="f-moi">cet équipement</b> <small class="f-nouveau"></small>
          <label class="f-monport">port <select data-f="monport"></select></label>
        </div>
        <div class="f-schema" data-schema="branche" aria-hidden="true"></div>
        <div class="f-ligne">
          <label>Type de câble<select data-f="media"><option value="">Automatique (SFP = fibre, sinon RJ45)</option>${(Object.keys(MEDIAS) as Media[]).map((m) => `<option value="${m}">${MEDIAS[m]}</option>`).join("")}</select></label>
          <label class="etroit">VLAN<input data-f="vlan" placeholder="30" autocomplete="off" /></label>
        </div>
        <label class="f-case"><input type="checkbox" data-f="trunk" /> Trunk : le câble transporte plusieurs VLAN (lien entre deux switchs)</label>
      </fieldset>
      <p class="f-apercu" aria-live="polite"></p>
      <div class="f-boutons">
        <button type="button" class="primaire" data-a="ajouter">Ajouter</button>
        <button type="button" data-a="annuler" hidden>Annuler</button>
      </div>
    </section>

    <section class="f-bloc f-liaison">
      <h3><span class="f-pastille">B</span> Câble entre deux équipements déjà créés</h3>
      <p class="f-quand">Trunk entre deux switchs, lien entre deux lieux ou deux sites, VPN de secours…</p>
      <div class="f-boutons"><button type="button" class="primaire" data-a="nouveau-cable">＋ Ajouter un câble</button></div>
      <div hidden>
        <select data-l="a"></select><select data-l="pa"></select><select data-l="b"></select><select data-l="pb"></select>
        <select data-l="media"></select><input data-l="vlan" /><input data-l="libelle" /><input type="checkbox" data-l="trunk" />
        <div class="f-schema" data-schema="relier"></div>
      </div>
    </section>

    <section class="f-bloc f-inventaire">
      <h3>Inventaire</h3>
      <input type="search" data-f="filtre" placeholder="Filtrer par nom, IP, site…" />
      <div class="f-liste"></div>
    </section>`;

  const $ = <T extends HTMLElement>(sel: string) => racine.querySelector(sel) as T;
  const champ = <T extends HTMLElement = HTMLInputElement>(k: string) => $<T>(`[data-f="${k}"]`);
  const lienC = <T extends HTMLElement = HTMLSelectElement>(k: string) => $<T>(`[data-l="${k}"]`);
  // Valeur réservée de l'option « ＋ Nouveau… » (sans caractère de contrôle :
  // le navigateur remplace un caractère nul dans un attribut HTML).
  const NOUVEAU = "__nouveau__";

  /* ---------- listes ---------- */
  const options = (sel: HTMLSelectElement, valeurs: { v: string; t: string }[], courant: string) => {
    sel.innerHTML = valeurs.map((o) => `<option value="${echap(o.v)}"${o.v === courant ? " selected" : ""}>${echap(o.t)}</option>`).join("");
    if (!valeurs.some((o) => o.v === courant)) sel.selectedIndex = 0;
  };
  const portsLibres = (nom: string, garder?: string) => {
    const { disp, inv } = acces.donnees();
    const f = disp.facades.get(nom);
    if (f) {
      const pris = new Set([...f.branches.keys()].filter((k) => k !== garder).map((k) => f.parId.get(k)));
      return f.ports.filter((p) => !pris.has(p)).map((p) => p.id);
    }
    // Serveur, NAS, enregistreur, caméra… avec des ports déclarés (ports=2 | sfp=2).
    const e = inv.equipements.find((x) => x.nom === nom);
    const tous = e ? portsDeclares(e) : [];
    if (!tous.length) return [];
    const cle = (p: string) => { const l = lirePort(p); return l.n !== null ? `${l.type}:${l.n}` : p.toLowerCase(); };
    const pris = new Set(inv.liaisons.flatMap((l) => [l.a === nom ? l.portA : undefined, l.b === nom ? l.portB : undefined])
      .filter((p): p is string => !!p && p !== garder).map(cle));
    return tous.filter((p) => !pris.has(cle(p)));
  };

  function remplirOu() {
    const { inv } = acces.donnees();
    const sites = inv.sites.map((s) => s.nom);
    if (ctx.site && !sites.includes(ctx.site)) sites.push(ctx.site);
    if (!ctx.site && sites.length) ctx.site = sites[0];
    // Aucun site encore : une invite, pour que « ＋ Nouveau site… » se choisisse vraiment.
    options($('[data-c="site"]'), [...(sites.length ? [] : [{ v: "", t: "— aucun site —" }]),
      ...sites.map((s) => ({ v: s, t: s })), { v: NOUVEAU, t: "＋ Nouveau site…" }], ctx.site);
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
    return inv.equipements.filter((e) => (A_FACADE.has(e.genre) || portsDeclares(e).length > 0) && e.nom !== edition?.eq.nom)
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
  /** En modification, le port actuel de l'équipement sur ce switch : on le garde. */
  function portEnEdition(vers: string) {
    const l = edition?.lien;
    if (!l || !edition) return undefined;
    if (l.a === vers && l.b === edition.eq.nom) return l.portA;
    if (l.b === vers && l.a === edition.eq.nom) return l.portB;
    return undefined;
  }
  function remplirPorts(garderPort?: string) {
    const vers = champ<HTMLSelectElement>("vers").value;
    garderPort ??= portEnEdition(vers);
    const port = champ<HTMLSelectElement>("port");
    const libres = vers ? portsLibres(vers, garderPort) : [];
    const qte = combien();
    // Le port déjà choisi s'il est encore libre sur ce switch, sinon le
    // premier port RJ45 libre : on ne laisse jamais « sans port » par accident.
    const voulu = garderPort ?? (libres.includes(port.value) ? port.value : (["rj45", "sfp", "autre", "wan"] as const).map((t) => libres.find((p) => lirePort(p).type === t)).find(Boolean) ?? "");
    options(port, vers ? [{ v: "", t: "— sans port —" }, ...libres.map((p) => ({ v: p, t: qte > 1 ? `${p} (pour le 1er)` : p }))] : [{ v: "", t: "—" }], voulu);
    port.disabled = !vers;
    // Explication selon le cas : rien où se brancher, ou choix à faire.
    const aide = racine.querySelector<HTMLElement>(".f-aide-branche")!;
    const nCibles = champ<HTMLSelectElement>("vers").options.length - 1;
    aide.textContent = nCibles === 0
      ? "Rien où le brancher pour l'instant : c'est normal pour le premier équipement d'un site. Ajoutez-le, puis branchez les suivants dessus (ou reliez-les après avec le cadre B plus bas)."
      : vers ? `Choisissez le port de ${vers} où arrive le câble. Seuls les ports encore libres sont proposés.`
        : "Choisissez le switch ou la passerelle sur lequel cet équipement est branché, puis son port.";
    // Suggestions pour « son port à lui » : ses propres ports d'après RJ45 / SFP.
    const nRj = parseInt(champ("ports").value, 10) || 0, nSfp = parseInt(champ("sfp").value, 10) || 0;
    // « port » de l'équipement lui-même : ses vrais ports, d'après RJ45 / SFP.
    const monport = champ<HTMLSelectElement>("monport");
    const garde = monport.value;
    const siens = [...Array.from({ length: Math.min(nSfp, 16) }, (_, i) => `SFP${i + 1}`), ...Array.from({ length: Math.min(nRj, 96) }, (_, i) => String(nRj - i))];
    if (garde && !siens.includes(garde)) siens.unshift(garde);
    options(monport, [{ v: "", t: siens.length ? "— non précisé —" : "son port réseau" }, ...siens.map((v) => ({ v, t: v }))], garde);
    monport.disabled = !siens.length || combien() > 1;
    // Deux switchs reliés : trunk coché par défaut.
    const e = acces.donnees().inv.equipements.find((x) => x.nom === vers);
    if (!edition) champ<HTMLInputElement>("trunk").checked = genre === "switch" && e?.genre === "switch";
    apercu();
  }

  /** Le dernier nom proposé : on ne remplace que lui, jamais un nom tapé. */
  // Le nom proposé reste en grisé dans la case (jamais écrit à votre place) :
  // il ne sert que si vous laissez la case vide.
  function proposerNom() {
    champ<HTMLInputElement>("nom").placeholder = `${nomPropose()}  (nom proposé, tapez le vôtre)`;
  }
  function nomPropose() {
    const { inv } = acces.donnees();
    const base = (code(ctx.point || ctx.site) ? `${PREFIXE[genre]}-${code(ctx.point || ctx.site)}` : PREFIXE[genre]);
    const pris = new Set(inv.equipements.map((e) => e.nom.toUpperCase()));
    for (let i = 1; i < 1000; i++) { const n = `${base}-${i}`; if (!pris.has(n) && !pris.has(`${n}-1`)) return n; }
    return base;
  }

  /** Les noms tapés : un seul, ou une liste séparée par des virgules. */
  const nomsTapes = () => champ("nom").value.split(",").map((x) => nomPropre(x)).filter(Boolean);
  const listeNoms = () => { const n = nomsTapes(); return n.length ? n : edition ? [] : [Number(champ("qte").value) > 1 ? baseGroupe() : nomPropose()]; };
  /** Nom de base d'un groupe sans nom tapé : CAM-ECOLE → CAM-ECOLE-1, -2… */
  function baseGroupe() {
    const { inv } = acces.donnees();
    const base = (code(ctx.point || ctx.site) ? `${PREFIXE[genre]}-${code(ctx.point || ctx.site)}` : PREFIXE[genre]);
    const pris = new Set(inv.equipements.map((e) => e.nom.toUpperCase()));
    for (const suffixe of ["", ...Array.from({ length: 26 }, (_, i) => `-${String.fromCharCode(65 + i)}`)]) {
      const c = base + suffixe;
      if (!pris.has(c) && !pris.has(`${c}-1`)) return c;
    }
    return base;
  }
  /** Le nom de chacun des équipements qui seront créés (liste, ou NOM-1…NOM-n). */
  const nomsCrees = () => {
    const n = listeNoms();
    if (n.length > 1) return n;
    const q = combien();
    return q > 1 ? Array.from({ length: q }, (_, k) => `${n[0]}-${k + 1}`) : n;
  };
  /** Combien d'équipements seront créés : la liste de noms, sinon « Nombre ». */
  const combien = () => (listeNoms().length > 1 ? listeNoms().length : Math.max(1, Math.min(200, Number(champ("qte").value) || 1)));

  /* ---------- écriture des lignes ---------- */
  function ligneEquipement(): string | null {
    const noms = listeNoms();
    if (!noms.length) return null;
    const qte = Math.max(1, Math.min(200, Number(champ("qte").value) || 1));
    const p: string[] = [noms.length > 1 ? `${genre} ${noms.join(", ")}` : `${genre} ${noms[0]}${qte > 1 ? ` x${qte}` : ""}`];
    if (champ("ip").value.trim()) p.push(propre(champ("ip").value));
    if (champ("modele").value.trim()) p.push(propre(champ("modele").value));
    // « @Site/Lieu », sauf si un des noms contient lui-même « / » :
    // on écrit alors site=… et point=…, sans ambiguïté.
    if (ctx.site) {
      if (ctx.site.includes("/") || ctx.point.includes("/")) {
        p.push(`site=${propre(ctx.site)}`);
        if (ctx.point) p.push(`point=${propre(ctx.point)}`);
      } else p.push(`@${propre(ctx.site)}${ctx.point ? `/${propre(ctx.point)}` : ""}`);
    }
    if (ctx.baie) p.push(`baie=${propre(ctx.baie)}`);
    if (champ("gw").value.trim()) p.push(`passerelle=${propre(champ("gw").value)}`);
    if (champ("masque").value.trim()) p.push(`masque=${propre(champ("masque").value).replace(/\s+/g, "")}`);
    // N° de série et MAC : un par équipement, dans l'ordre des noms.
    for (const k of ["serie", "mac"]) {
      const v = champ(k).value.split(",").map((x) => propre(x).replace(/=/g, "-"));
      if (v.some(Boolean)) p.push(`${k}=${v.join(", ").replace(/(,\s*)+$/, "")}`);
    }
    // Ports tapés librement (2 RJ45, 3 SFP…) ; vide = déduit des branchements.
    {
      // « 24, 8, 48 » : un nombre par équipement (dans l'ordre des noms).
      const n = (k: string, max: number) => {
        const vals = champ(k).value.split(/[,;\s]+/).map((x) => parseInt(x, 10)).filter((v) => Number.isFinite(v) && v >= 0).map((v) => Math.min(v, max));
        if (!vals.length) return null;
        const nb = combien();
        const utiles = vals.slice(0, Math.max(1, nb));
        return utiles.every((v) => v === utiles[0]) ? String(utiles[0]) : utiles.join(",");
      };
      const rj = n("ports", 96), sfp = n("sfp", 48), wan = n("wan", 8);
      if (rj !== null && rj !== "0") p.push(`ports=${rj}`);
      // Switch, passerelle, pare-feu : « sfp=0 » se garde (façade dessinée) ; les autres : seulement s'il y en a.
      if (sfp !== null && (A_FACADE.has(genre) || sfp !== "0")) p.push(`sfp=${sfp}`);
      if (avecWan() && wan !== null && wan !== "0") p.push(`wan=${wan}`);
    }
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
    // Le port de l'équipement lui-même ne s'écrit que pour un seul équipement.
    if (mon && combien() === 1) return [l, ligneBranche(listeNoms()[0])!];
    let port = champ<HTMLSelectElement>("port").value;
    if (port && portsLigne && combien() > 1) {
      const n = combien(), liste = portsDuGroupe(n);
      portsLigne = null; const suite = portsDuGroupe(n); portsLigne = liste;
      if (liste.join() !== suite.join()) port = liste.join(",");
    }
    return [[l, `sur ${vers}${port ? `:${port}` : ""}`,
      ...optionsLien(champ<HTMLSelectElement>("media").value, champ("vlan").value, champ<HTMLInputElement>("trunk").checked)].join(" | ")];
  }

  /** Des ports RJ45 / SFP tapés pour cet équipement (au moins un). */
  const aDesPorts = () => ["ports", "sfp"].some((k) => champ(k).value.split(/[,;\s]+/).some((x) => parseInt(x, 10) > 0));
  const avecWan = () => genre === "passerelle" || genre === "parefeu";

  /* ---------- une case par équipement ---------- */
  // Port d'arrivée de chaque équipement d'un groupe (null = ports qui se suivent).
  let portsLigne: string[] | null = null;
  /** Ports d'arrivée de chacun : ceux choisis ligne par ligne, sinon à la suite. */
  function portsDuGroupe(n: number): string[] {
    const port = champ<HTMLSelectElement>("port").value;
    const m = port.match(/^(.*?)(\d+)$/);
    const suite = Array.from({ length: n }, (_, k) => (m ? `${m[1]}${Number(m[2]) + k}` : k ? "" : port));
    return suite.map((p, k) => portsLigne?.[k] ?? p);
  }
  const liste = (k: string) => champ(k).value.split(",").map((x) => x.trim());
  function tableau() { tableauHaut(); portsGroupe(); }
  function tableauHaut() {
    const box = $(".f-detail");
    const noms = nomsCrees();
    if (noms.length < 2 || noms.length > 60 || edition) { box.hidden = true; return; }
    box.hidden = false;
    const ports = A_FACADE.has(genre) || aDesPorts();
    const ips = liste("ip").filter(Boolean), rj = liste("ports").filter(Boolean), sfp = liste("sfp").filter(Boolean);
    const ipDe = (k: number) => ips.length > 1 ? (ips[k] ?? (ips.length ? ipPlus(ips[ips.length - 1], k - ips.length + 1) : "")) : ips[0] ? ipPlus(ips[0], k) : "";
    const de = (l: string[], k: number) => l[Math.min(k, l.length - 1)] ?? "";
    box.querySelector("thead")!.innerHTML = `<tr><th>Nom</th><th>IP</th>${ports ? "<th>Ports RJ45</th><th>Cages SFP</th>" : ""}<th>N° de série</th><th>MAC</th></tr>`;
    const series = liste("serie"), macs = liste("mac");
    box.querySelector("tbody")!.innerHTML = noms.map((n, k) => `<tr>
      <td><input data-d="nom" data-k="${k}" value="${echap(n)}" spellcheck="false" autocomplete="off" aria-label="Nom n°${k + 1}" /></td>
      <td><input data-d="ip" data-k="${k}" value="${echap(ipDe(k))}" placeholder="—" spellcheck="false" autocomplete="off" aria-label="IP de ${echap(n)}" /></td>
      ${ports ? `<td class="f-num"><input data-d="ports" data-k="${k}" inputmode="numeric" value="${echap(de(rj, k))}" aria-label="Ports RJ45 de ${echap(n)}" /></td>
      <td class="f-num"><input data-d="sfp" data-k="${k}" inputmode="numeric" value="${echap(de(sfp, k))}" aria-label="Cages SFP de ${echap(n)}" /></td>` : ""}
      <td><input data-d="serie" data-k="${k}" value="${echap(series[k] ?? "")}" placeholder="—" spellcheck="false" autocomplete="off" aria-label="N° de série de ${echap(n)}" /></td>
      <td><input data-d="mac" data-k="${k}" value="${echap(macs[k] ?? "")}" placeholder="—" spellcheck="false" autocomplete="off" aria-label="Adresse MAC de ${echap(n)}" /></td>
    </tr>`).join("");
  }
  /** Dans le cadre A : le port de chacun quand on en branche plusieurs. */
  const actifGroupe = (n: number, vers: string) => n > 1 && n <= 60 && !!vers && !edition;
  function portsGroupe() {
    const box = $(".f-ports-groupe");
    const noms = nomsCrees();
    const vers = champ<HTMLSelectElement>("vers").value;
    const actif = actifGroupe(noms.length, vers);
    box.hidden = !actif;
    racine.querySelector<HTMLElement>(".f-monport")!.hidden = noms.length > 1 || (!A_FACADE.has(genre) && !aDesPorts());
    racine.querySelector<HTMLElement>(".f-port1")!.hidden = actifGroupe(noms.length, vers);
    if (!actif) { box.innerHTML = ""; return; }
    const arrivee = portsDuGroupe(noms.length);
    const libres = portsLibres(vers);
    box.innerHTML = `<p class="f-quand">Le port de ${echap(vers)} pour chacun :</p>` + noms.map((n, k) => {
      const v = arrivee[k] ?? "";
      const l = v && !libres.includes(v) ? [v, ...libres] : libres;
      return `<label class="f-pg"><span>${echap(n)}</span><span class="f-fleche">→ ${echap(vers)} port</span>
        <select data-d="port" data-k="${k}" aria-label="Port de ${echap(n)} sur ${echap(vers)}"><option value="">—</option>${l.map((p) => `<option${p === v ? " selected" : ""}>${echap(p)}</option>`).join("")}</select></label>`;
    }).join("");
  }
  /** Une case du tableau a changé : on réécrit les champs à virgules au-dessus. */
  function depuisTableau() {
    const col = (d: string) => [...racine.querySelectorAll<HTMLInputElement>(`.f-detail [data-d="${d}"]`)].map((i) => i.value.trim());
    const ports = [...racine.querySelectorAll<HTMLSelectElement>('.f-ports-groupe [data-d="port"]')].map((x) => x.value);
    if (ports.length) portsLigne = ports;
    const noms = col("nom").map((x) => nomPropre(x));
    if (noms.every(Boolean)) { champ("nom").value = noms.join(", "); champ("qte").value = String(noms.length); champ<HTMLInputElement>("qte").disabled = true; }
    const ips = col("ip");
    champ("ip").value = ips.every(Boolean) ? ips.join(", ") : ips.filter(Boolean).join(", ");
    // Série / MAC : la place compte (une case vide garde sa place).
    for (const d of ["serie", "mac"]) champ(d).value = col(d).map((x) => x.replace(/,/g, " ")).join(", ").replace(/(,\s*)+$/, "");
    for (const d of ["ports", "sfp"]) {
      const v = col(d); if (!v.length) continue;
      const pleins = v.map((x) => x || v.find(Boolean) || "0");
      champ(d).value = pleins.every((x) => x === pleins[0]) ? pleins[0] : pleins.join(", ");
      champ(d).dataset.touche = "1";
    }
    remplirPorts();
    apercu();
  }

  function apercu() {
    const noms = listeNoms();
    const moi = racine.querySelector<HTMLElement>(".f-moi")!;
    moi.textContent = noms.length > 1 ? `chacun de ces ${noms.length} équipements` : noms[0] || "cet équipement";
    moi.title = "L'équipement que vous êtes en train d'ajouter (son nom se tape en haut, case « Nom »).";
    racine.querySelector<HTMLElement>(".f-nouveau")!.textContent = edition ? "(en modification)" : nomsTapes().length ? (nomsTapes().length > 1 ? "(les nouveaux équipements)" : "(le nouvel équipement)") : "(nom proposé, pas encore créé)";
    const nb = combien();
    const portsSw = nb > 1 ? portsDuGroupe(nb).filter(Boolean).join(", ") : champ<HTMLSelectElement>("port").value;
    const nomMoi = nb > 1 ? `les ${nb} nouveaux` : noms[0] ?? "";
    schema("branche", champ<HTMLSelectElement>("vers").value, portsSw,
      nomMoi, champ<HTMLSelectElement>("monport").value || (A_FACADE.has(genre) || aDesPorts() ? "" : `=${GENRES[genre].libelle}`), champ<HTMLSelectElement>("media").value,
      champ<HTMLInputElement>("trunk").checked, champ("vlan").value);
    const l = lignesAAjouter();
    let alerte = "";
    // Plusieurs caméras sur un switch : y a-t-il assez de ports qui se suivent ?
    const vers = champ<HTMLSelectElement>("vers").value, port = champ<HTMLSelectElement>("port").value;
    const qte = combien();
    if (vers && port && qte > 1) {
      const libres = new Set(portsLibres(vers, edition ? undefined : undefined));
      const voulus = portsDuGroupe(qte).filter(Boolean);
      const manquants = voulus.filter((p) => !libres.has(p));
      const doubles = voulus.filter((p, i) => voulus.indexOf(p) !== i);
      if (manquants.length) alerte = `<b class="f-alerte">⚠ Ports ${echap(manquants.join(", "))} déjà pris ou inexistants sur ${echap(vers)}.</b> `;
      if (doubles.length) alerte += `<b class="f-alerte">⚠ Port ${echap([...new Set(doubles)].join(", "))} choisi deux fois.</b> `;
    }
    // Liste d'IP : autant que d'équipements ?
    const listeIp = champ("ip").value.split(",").map((x) => x.trim()).filter(Boolean);
    if (listeIp.length > 1 && listeIp.length !== combien())
      alerte += `<b class="f-alerte">⚠ ${listeIp.length} IP pour ${combien()} équipement${combien() > 1 ? "s" : ""}${listeIp.length < combien() ? " : les suivantes continueront après la dernière" : " : les IP en trop seront ignorées"}.</b> `;
    $(".f-apercu").innerHTML = alerte + (l ? `<span>Ligne écrite :</span> <code title="${echap(l.join("\n"))}">${echap(l.join("  ⏎  "))}</code>` : "");
  }

  function vider() {
    edition = null;
    portsLigne = null;
    champ("nom").value = "";
    proposerNom();
    champ("qte").value = "1";
    champ("ip").value = "";
    champ("modele").value = "";
    champ("monport").value = "";
    champ("gw").value = "";
    for (const k of ["masque", "serie", "mac"]) champ(k).value = "";
    // Le type de câble choisi pour un équipement ne s'applique pas au suivant.
    champ<HTMLSelectElement>("media").value = "";
    // Nouveau formulaire : les nombres de ports reprennent les valeurs du type.
    (["ports", "sfp"] as const).forEach((k) => delete champ(k).dataset.touche);
    champ("vlan").value = genre === "camera" ? champ("vlan").value : "";
    $(".f-titre-ajout").textContent = "Ajouter un équipement";
    $('[data-a="ajouter"]').textContent = "Ajouter";
    $<HTMLButtonElement>('[data-a="annuler"]').hidden = true;
    champ("qte").removeAttribute("disabled");
    actualiserType();
  }

  function actualiserType() {
    queueMicrotask(tableau);
    racine.querySelectorAll<HTMLElement>(".f-types [data-g]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.g === genre)));
    // Ports RJ45 / SFP : en vue pour un switch, une passerelle, un pare-feu ; pour
    // une caméra, un poste… ils passent dans « Plus de détails » (rarement utiles).
    const ligneSw = racine.querySelector<HTMLElement>(".f-switch")!, details = $<HTMLDetailsElement>(".f-plus-eq");
    ligneSw.hidden = false;
    if (A_FACADE.has(genre)) { if (ligneSw.parentElement === details) details.before(ligneSw); }
    else if (ligneSw.parentElement !== details) details.append(ligneSw);
    details.querySelector("summary")!.textContent = A_FACADE.has(genre)
      ? "Plus de détails · passerelle, masque, n° de série, MAC"
      : "Plus de détails · passerelle, masque, n° de série, MAC, ports";
    racine.querySelector<HTMLElement>(".f-wan")!.hidden = !avecWan();
    const vide = A_FACADE.has(genre) ? "" : " (vide = un seul port)";
    racine.querySelector<HTMLElement>(".f-switch label:first-child small")!.textContent = `(un par équipement : 24, 8, 48)${vide}`;
    // Valeurs habituelles du type, tant qu'on ne les a pas modifiées.
    if (!edition) {
      const defaut = genre === "switch" ? { ports: "24", sfp: "4" } : A_FACADE.has(genre) ? { ports: "8", sfp: "0" } : { ports: "", sfp: "" };
      (["ports", "sfp"] as const).forEach((k) => {
        if (!champ(k).dataset.touche) champ(k).value = defaut[k];
      });
    }
    remplirBranche();
  }

  /* ---------- texte ---------- */
  function modifierTexte(fn: (lignes: string[]) => void, annonce?: string) {
    const lignes = acces.texte().split("\n");
    fn(lignes);
    acces.ecrire(lignes.join("\n"), annonce);
  }
  /** Sans site choisi, on demande son nom : chaque équipement est rangé dans un site à vous. */
  function demanderSite(): boolean {
    if (ctx.site) return true;
    const v = propre(prompt("Dans quel site ? Donnez son nom (ville, agence, client…) :") ?? "");
    if (!v) return false;
    ctx.site = v;
    remplirOu();
    if (!edition) proposerNom();
    return true;
  }

  function ajouter() {
    if (!demanderSite()) return;
    const l = lignesAAjouter();
    if (!l) { champ("nom").focus(); return; }
    const noms = listeNoms(), nom = noms[0];
    const qte = Number(champ("qte").value) || 1;
    // Les noms qui seront créés, pour vérifier qu'aucun n'existe déjà.
    const crees = noms.length > 1 ? noms : qte > 1 ? Array.from({ length: qte }, (_, k) => `${nom}-${k + 1}`) : [nom];
    const { inv } = acces.donnees();
    const doublons = crees.filter((n, i) => crees.indexOf(n) !== i || (!edition && inv.equipements.some((e) => e.nom.toLowerCase() === n.toLowerCase())));
    if (doublons.length) {
      alert(`Ces noms existent déjà : ${[...new Set(doublons)].join(", ")}. Choisissez d'autres noms.`);
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
        // Renommé : le nouveau nom remplace l'ancien partout où il sert
        // (« sur SW-B:1 », « SW-B:24 -> … »), sinon ces branchements cassent.
        if (nom && nom.toLowerCase() !== eq.nom.toLowerCase()) {
          const ancien = eq.nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const re = new RegExp(`(^|[\\s>,:|])${ancien}(?=$|[\\s:|,<]|->)`, "gi");
          lignes.forEach((ligne, i) => {
            if (ligne.replace(/#.*$/, "").includes("|") || /->|→|=>|<-/.test(ligne)) lignes[i] = ligne.replace(re, (_m, avant) => `${avant}${nom}`);
          });
        }
      }, `${nom} modifié.`);
    } else {
      modifierTexte((lignes) => {
        while (lignes.length && !lignes[lignes.length - 1].trim()) lignes.pop();
        lignes.push(...l, "");
      }, crees.length > 1 ? `${crees.length} équipements ajoutés (${crees[0]} … ${crees[crees.length - 1]}).` : `${crees[0]} ajouté.`);
    }
    const vise = crees[0];
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

  /** Le petit schéma du câble : départ (nom · port) ━━ type ━━ arrivée (nom · port). */
  function schema(cle: "branche" | "relier", a: string, pa: string, b: string, pb: string, media: string, trunk: boolean, vlan: string) {
    const el = racine.querySelector<HTMLElement>(`[data-schema="${cle}"]`)!;
    if (!a || !b) { el.innerHTML = ""; return; }
    const lirePortType = (p: string) => (p ? lirePort(p).type : "");
    const auto = [pa, pb].some((p) => lirePortType(p) === "sfp") ? "fibre" : "cuivre";
    const m = (media || auto) as Media;
    const etiquette = [MEDIAS[m] ?? "", trunk ? "trunk" : "", vlan ? `VLAN ${vlan}` : ""].filter(Boolean).join(" · ");
    el.innerHTML = `<div class="sc-boite"><b>${echap(a)}</b><span>${pa ? `port ${echap(pa)}` : "port ?"}</span></div>
      <div class="sc-cable sc-${m}${trunk ? " sc-trunk" : ""}"><i></i><span>${echap(etiquette)}</span></div>
      <div class="sc-boite"><b>${echap(b)}</b><span>${pb.startsWith("=") ? echap(pb.slice(1)) : pb ? `port ${echap(pb)}` : "port ?"}</span></div>`;
    el.querySelectorAll("span").forEach((x) => { if (x.textContent?.includes(", ")) x.textContent = x.textContent.replace(/^port /, "ports "); });
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
    schemaRelier();
  }
  function schemaRelier() {
    schema("relier", lienC("a").value, lienC("pa").value, lienC("b").value, lienC("pb").value,
      lienC("media").value, lienC<HTMLInputElement>("trunk").checked, lienC<HTMLInputElement>("vlan").value);
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
    const groupe = inv.equipements.filter((x) => x.ligne === e.ligne);
    if (groupe.length > 1) {
      // Un équipement créé avec d'autres sur une même ligne (« SW-A, SW-B » ou
      // « x6 ») : on sépare la ligne en une ligne par équipement, chacun avec
      // son IP et son port, puis on modifie celui-là seul.
      eclater(groupe, inv);
      modifier(nom);
      return;
    }
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
    for (const k of ["masque", "serie", "mac"]) champ(k).value = e.kv.find(([c]) => c === k)?.[1] ?? "";
    $<HTMLDetailsElement>(".f-plus-eq").open = ["gw", "masque", "serie", "mac"].some((k) => champ(k).value.trim());
    const kv = (re: RegExp) => e.kv.find(([k]) => re.test(k))?.[1] ?? "";
    champ("ports").value = kv(/^ports?$/i);
    champ("sfp").value = kv(/^sfp$/i);
    champ("wan").value = kv(/^wan$/i) || (e.genre === "switch" ? "" : "1");
    actualiserType();
    // Une caméra, un serveur… avec des ports déclarés : on montre ses ports.
    if (!A_FACADE.has(e.genre) && (champ("ports").value || champ("sfp").value)) $<HTMLDetailsElement>(".f-plus-eq").open = true;
    if (lien) {
      const [v, p, mon] = lien.a === e.nom ? [lien.b, lien.portB, lien.portA] : [lien.a, lien.portA, lien.portB];
      champ<HTMLSelectElement>("vers").value = v;
      remplirPorts(p);
      if (mon && ![...champ<HTMLSelectElement>("monport").options].some((o) => o.value === mon))
        champ<HTMLSelectElement>("monport").add(new Option(mon, mon));
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

  /** Remplace la ligne d'un groupe par une ligne par équipement, valeurs comprises. */
  function eclater(groupe: Equipement[], inv: Inventaire) {
    const n = groupe[0].ligne;
    modifierTexte((lignes) => {
      const brut = lignes[n - 1] ?? "";
      const retrait = brut.match(/^\s*/)?.[0] ?? "";
      const [tete, ...champs] = brut.trim().split(/\s*\|\s*/);
      const mot = tete.split(/\s+/)[0];
      const nouvelles = groupe.map((e) => {
        // Le branchement que cette ligne a créé pour cet équipement.
        const l = inv.liaisons.find((x) => x.ligne === n && (x.a === e.nom || x.b === e.nom));
        const sur = l ? (l.a === e.nom ? `sur ${l.b}${l.portB ? `:${l.portB}` : ""}` : `sur ${l.a}${l.portA ? `:${l.portA}` : ""}`) : "";
        const ch = champs.map((c) => {
          if (c.split(",").every((x) => /^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(x.trim()))) return e.ip ?? c;
          if (/^sur\s+/i.test(c)) return sur || c;
          // « ports=24,8,48 » : chacun reprend son propre nombre.
          const ms = c.match(/^(serie|mac)\s*=\s*(.*,.*)$/i);
          if (ms) { const v = e.kv.find(([k]) => k === ms[1].toLowerCase())?.[1]; return v ? `${ms[1]}=${v}` : ""; }
          const mk = c.match(/^(ports?|sfp|wan)\s*=\s*(.*,.*)$/i);
          if (mk) { const v = e.kv.find(([k]) => k.toLowerCase() === mk[1].toLowerCase())?.[1]; return v ? `${mk[1]}=${v}` : c; }
          return c;
        });
        return retrait + [`${mot} ${e.nom}`, ...ch.filter(Boolean)].join(" | ");
      });
      lignes.splice(n - 1, 1, ...nouvelles);
    });
  }

  function supprimer(nom: string) {
    const { inv } = acces.donnees();
    const e = inv.equipements.find((x) => x.nom === nom);
    if (!e) return;
    const groupe = inv.equipements.filter((x) => x.ligne === e.ligne);
    if (groupe.length > 1) {
      // Créé avec d'autres sur une même ligne : on sépare d'abord, puis on ne retire que lui.
      eclater(groupe, inv);
      supprimer(nom);
      return;
    }
    const liens = inv.liaisons.filter((l) => (l.a === e.nom || l.b === e.nom) && l.ligne !== e.ligne);
    // Les câbles écrits sur la ligne d'un AUTRE équipement (« camera CAM-1 | sur SW-1:3 ») :
    // on retire seulement le branchement, l'équipement reste.
    const lignesEq = new Set(inv.equipements.filter((x) => x.nom !== e.nom).map((x) => x.ligne));
    const nCables = liens.length;
    // Pas de confirmation : un message « Annuler » permet de revenir en arrière.
    const annonce = `${e.nom} supprimé${nCables ? ` (et ses ${nCables} câble${nCables > 1 ? "s" : ""} ; ce qui y était branché reste)` : ""}.`;
    modifierTexte((lignes) => {
      liens.filter((l) => lignesEq.has(l.ligne)).forEach((l) => {
        const brut = lignes[l.ligne - 1];
        const retrait = brut.match(/^\s*/)?.[0] ?? "";
        const [tete, ...champs] = brut.trim().split(/\s*\|\s*/);
        const garde = champs.filter((c) => !(/^sur\s+/i.test(c) && new RegExp(`^sur\\s+${e.nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(:|$)`, "i").test(c)) && !lireMediaTexte(c) && !/^(trunk|access)$/i.test(c));
        lignes[l.ligne - 1] = retrait + [tete, ...garde].join(" | ");
      });
      const aRetirer = [e.ligne, ...liens.filter((l) => !lignesEq.has(l.ligne)).map((l) => l.ligne)];
      [...new Set(aRetirer)].sort((a, b) => b - a).forEach((n) => lignes.splice(n - 1, 1));
    }, annonce);
    if (edition?.eq.nom === nom) vider();
  }

  /* ---------- un câble : le modifier ou le supprimer ---------- */
  const memeLien = (x: Liaison, l: Liaison) => x.a === l.a && x.b === l.b && (x.portA ?? "") === (l.portA ?? "") && (x.portB ?? "") === (l.portB ?? "");
  /** Retire un câble du texte. Renvoie le numéro de ligne où le réécrire (après l'équipement), ou null. */
  let equipementDuLien = "";   // l'équipement dont la ligne portait « sur … » (vide pour une ligne « A -> B »)
  function retirerLien(l0: Liaison, annonce?: string): number | null {
    equipementDuLien = "";
    let { inv } = acces.donnees();
    let l = inv.liaisons.find((x) => memeLien(x, l0));
    if (!l) return null;
    const sur = inv.equipements.filter((e) => e.ligne === l!.ligne);
    if (sur.length > 1) {
      // Câble créé par une ligne de groupe (« CAM x6 | sur SW:3 ») : une ligne par équipement d'abord.
      eclater(sur, inv);
      inv = acces.donnees().inv;
      l = inv.liaisons.find((x) => memeLien(x, l0));
      if (!l) return null;
    }
    const n = l.ligne;
    const eq = inv.equipements.find((e) => e.ligne === n);
    let ou: number | null = null;
    modifierTexte((lignes) => {
      if (!eq) { lignes.splice(n - 1, 1); ou = n; return; }           // ligne « A -> B » : on l'enlève
      // Ligne d'équipement « … | sur SW:3 | fibre | trunk | vlan=30 » : on retire le branchement.
      const brut = lignes[n - 1];
      const retrait = brut.match(/^\s*/)?.[0] ?? "";
      const [tete, ...champs] = brut.trim().split(/\s*\|\s*/);
      const garde = champs.filter((c) => !/^sur\s+/i.test(c) && !/^(->|→|=>)/.test(c) && !lireMediaTexte(c) && !/^(trunk|access)$/i.test(c) && !/^vlans?\s*[=: ]/i.test(c));
      lignes[n - 1] = retrait + [tete, ...garde].join(" | ");
      equipementDuLien = eq.nom;
      ou = n + 1;
    }, annonce);
    return ou;
  }
  function supprimerLien(l: Liaison) {
    retirerLien(l, `Câble ${l.a}${l.portA ? `:${l.portA}` : ""} ↔ ${l.b}${l.portB ? `:${l.portB}` : ""} supprimé.`);
  }
  /** Fenêtre « Câble » : les deux bouts, leurs ports, le type, VLAN, trunk, remarque. */
  function editerLien(l: Liaison) {
    const { inv } = acces.donnees();
    const tous = [...inv.equipements].sort((x, y) => x.site.localeCompare(y.site) || x.nom.localeCompare(y.nom));
    const d = document.createElement("dialog");
    d.className = "colonnes cable";
    const nouveau = !l.b;
    const optEq = (v: string) => (v ? "" : `<option value="">— choisir —</option>`) + tous.map((e) => `<option value="${echap(e.nom)}"${e.nom === v ? " selected" : ""}>${echap(e.nom)} · ${echap(e.site)}${e.point ? ` / ${echap(e.point)}` : ""}</option>`).join("");
    d.innerHTML = `<form method="dialog">
      <h2>${nouveau ? "Nouveau câble" : "Câble"}</h2>
      <p class="aide-col">Changez un bout, un port ou le type de câble, puis Enregistrer. Seuls les ports libres sont proposés.</p>
      <div class="blocs-col">
        <div class="f-phrase"><span>De</span><label class="large"><select data-c="a">${optEq(l.a)}</select></label><label>port <select data-c="pa"></select></label></div>
        <div class="f-phrase"><span>à</span><label class="large"><select data-c="b">${optEq(l.b)}</select></label><label>port <select data-c="pb"></select></label></div>
        <div class="f-ligne">
          <label>Type de câble<select data-c="media"><option value="">Automatique (SFP = fibre, sinon RJ45)</option>${(Object.keys(MEDIAS) as Media[]).map((m) => `<option value="${m}"${l.media === m ? " selected" : ""}>${MEDIAS[m]}</option>`).join("")}</select></label>
          <label class="etroit">VLAN<input data-c="vlan" value="${echap(l.vlans ?? "")}" placeholder="10,20" autocomplete="off" /></label>
          <label>Remarque<input data-c="libelle" value="${echap(l.libelle ?? "")}" autocomplete="off" /></label>
        </div>
        <label class="f-case"><input type="checkbox" data-c="trunk"${l.mode === "trunk" ? " checked" : ""} /> Trunk : plusieurs VLAN sur ce câble</label>
      </div>
      <div class="boutons-col">${nouveau ? "" : `<button type="button" class="danger" data-a="suppr">Supprimer ce câble</button>`}<span style="flex:1"></span><button value="annuler" type="submit">Annuler</button><button value="ok" type="submit" class="primaire">Enregistrer</button></div>
    </form>`;
    const q = <T extends HTMLElement>(k: string) => d.querySelector<T>(`[data-c="${k}"]`)!;
    const ports = (cote: "a" | "b", garder?: string) => {
      const nom = q<HTMLSelectElement>(cote).value;
      const memeNom = nom === (cote === "a" ? l.a : l.b);
      const liste = portsLibres(nom, memeNom ? garder : undefined);
      const v = memeNom ? garder ?? "" : "";
      const tout = v && !liste.includes(v) ? [v, ...liste] : liste;
      options(q<HTMLSelectElement>(cote === "a" ? "pa" : "pb"), [{ v: "", t: tout.length ? "— sans port —" : "—" }, ...tout.map((p) => ({ v: p, t: p }))], v);
    };
    ports("a", l.portA); ports("b", l.portB);
    d.addEventListener("change", (ev) => {
      const c = (ev.target as HTMLElement).dataset.c;
      if (c === "a") ports("a", l.portA);
      if (c === "b") ports("b", l.portB);
    });
    d.addEventListener("click", (ev) => {
      if ((ev.target as HTMLElement).dataset.a !== "suppr") return;
      d.close("rien");
      supprimerLien(l);
    });
    d.addEventListener("close", () => {
      const ok = d.returnValue === "ok";
      const v = {
        a: q<HTMLSelectElement>("a").value, pa: q<HTMLSelectElement>("pa").value, b: q<HTMLSelectElement>("b").value, pb: q<HTMLSelectElement>("pb").value,
        media: q<HTMLSelectElement>("media").value, vlan: q<HTMLInputElement>("vlan").value, trunk: q<HTMLInputElement>("trunk").checked, libelle: q<HTMLInputElement>("libelle").value,
      };
      d.remove();
      if (!ok) return;
      if (!v.a || !v.b || v.a === v.b) { alert("Choisissez deux équipements différents."); return; }
      const ligne = [`${v.a}${v.pa ? `:${v.pa}` : ""} -> ${v.b}${v.pb ? `:${v.pb}` : ""}`, ...optionsLien(v.media, v.vlan, v.trunk), propre(v.libelle)].filter(Boolean).join(" | ");
      const ou = nouveau ? null : retirerLien(l);
      const enLigne = ou && equipementDuLien && equipementDuLien === v.a && !v.pa;
      modifierTexte((lignes) => {
        // Câble d'une caméra, d'un poste… : il reste écrit sur sa ligne (« sur SW-1:10 »).
        if (enLigne) lignes[ou! - 2] = [lignes[ou! - 2], `sur ${v.b}${v.pb ? `:${v.pb}` : ""}`, ...optionsLien(v.media, v.vlan, v.trunk), propre(v.libelle)].filter(Boolean).join(" | ");
        else if (ou && ou <= lignes.length + 1) lignes.splice(ou - 1, 0, ligne);
        else { while (lignes.length && !lignes[lignes.length - 1].trim()) lignes.pop(); lignes.push(ligne, ""); }
      }, nouveau ? "Câble ajouté." : "Câble modifié.");
      acces.choisir(v.a);
    });
    document.body.append(d);
    d.showModal();
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
      if (c === "site") { ctx.point = ""; ctx.baie = ""; champ<HTMLSelectElement>("vers").value = ""; }
      if (c === "point") ctx.baie = "";
      remplirOu();
      if (!edition) proposerNom();
      remplirBranche();
      return;
    }
    if (t.dataset.d) { depuisTableau(); return; }
    if (t.dataset.f === "vers" || t.dataset.f === "port") { portsLigne = null; queueMicrotask(tableau); }
    if (t.dataset.f === "vers") { remplirPorts(); return; }
    if (t.dataset.l === "a" || t.dataset.l === "b") { remplirRelier(); return; }
    if (t.dataset.l) { schemaRelier(); return; }
    apercu();
  });
  racine.addEventListener("input", (ev) => {
    const t = ev.target as HTMLElement;
    if (t.dataset.f === "filtre") { remplirInventaire(); return; }
    if (t.dataset.d) { depuisTableau(); return; }
    if (["nom", "qte"].includes(t.dataset.f ?? "")) portsLigne = null;
    if (["nom", "qte", "ip", "ports", "sfp"].includes(t.dataset.f ?? "")) queueMicrotask(tableau);
    if (t.dataset.f === "ports" || t.dataset.f === "sfp") { t.dataset.touche = "1"; remplirPorts(); }
    if (t.dataset.f === "qte") remplirPorts();
    if (t.dataset.f === "nom") {
      // Une liste de noms fixe le nombre : le champ « Nombre » s'aligne dessus.
      const n = listeNoms().length;
      champ<HTMLInputElement>("qte").disabled = n > 1 || !!edition;
      if (n > 1) champ("qte").value = String(n);
      remplirPorts();
    }
    if (t.dataset.f) apercu();
    if (t.dataset.l) schemaRelier();
  });
  racine.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement;
    const g = t.closest<HTMLElement>("[data-g]");
    if (g) {
      genre = g.dataset.g as Genre;
      if (!edition) proposerNom();
      actualiserType();
      return;
    }
    const a = t.closest<HTMLElement>("[data-a]")?.dataset.a;
    const nom = t.closest<HTMLElement>(".f-eq")?.dataset.nom;
    if (a === "ajouter") ajouter();
    else if (a === "annuler") vider();
    else if (a === "relier") relier();
    else if (a === "nouveau-cable") editerLien({ a: "", b: "" } as unknown as Liaison);
    else if (a === "voir" && nom) acces.choisir(nom);
    else if (a === "modifier" && nom) modifier(nom);
    else if (a === "supprimer" && nom) supprimer(nom);
  });
  racine.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && (ev.target as HTMLElement).closest(".f-ajout") && (ev.target as HTMLElement).tagName === "INPUT") { ev.preventDefault(); ajouter(); }
  });

  remplirTypes();
  actualiserType();   // dès le départ : champs du type choisi (pas de « Ports WAN » pour un switch)

  return {
    /** À appeler quand l'inventaire change (frappe, import, changement de topologie). */
    actualiser() {
      remplirOu();
      remplirBranche(edition ? undefined : undefined);
      remplirRelier();
      remplirInventaire();
      if (!edition) proposerNom();
      apercu();
    },
    reinitialiser() { ctx.site = ""; ctx.point = ""; ctx.baie = ""; vider(); },
    modifier,
    supprimer,
    editerLien,
    supprimerLien,
  };
}
