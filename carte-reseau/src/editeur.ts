/**
 * L'éditeur de saisie : coloration, numéros de ligne, erreurs soulignées et
 * suggestions pendant la frappe.
 *
 * Un <textarea> transparent est posé sur un <pre> qui porte la coloration :
 * on garde le comportement natif (sélection, copier-coller, annuler) et on
 * colore dessous. Police à chasse fixe, donc la position du curseur se
 * calcule sans mesurer le texte.
 *
 * Suggestions selon l'endroit où l'on tape :
 *   début de ligne       → types (switch, camera…) puis noms existants
 *   après « @ »          → sites
 *   après « sur », « -> » → équipements (switchs d'abord)
 *   après « SWITCH: »    → ports LIBRES de ce switch
 *   après « | »          → sur, @site, vlan=, trunk, ports=, sfp=
 */
import type { Disposition } from "./disposition.ts";
import { GENRES, TYPES, type Alerte, type Inventaire } from "./saisie.ts";

export type Contexte = () => { inv: Inventaire; disp: Disposition };
type Suggestion = { texte: string; detail: string; remplace: number; ajout?: string };

const echap = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const IP = /^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/;
const FLECHE = /(->|<->|<-|=>|→|--)/;
const MOTS_TYPES = new Set(Object.values(GENRES).flatMap((g) => g.mots));

/** Colore une ligne de saisie. */
function colorer(ligne: string): string {
  const m = ligne.match(/^(.*?)(\s#.*|^#.*|\s\/\/.*)$/);
  const code = m ? m[1] : ligne, com = m ? m[2] : "";
  if (!code.trim()) return `<span class="c-com">${echap(com)}</span>`;
  const morceaux = code.split(/(\s*[|;\t]\s*)/);
  let html = "";
  morceaux.forEach((p, i) => {
    if (i % 2 === 1) { html += `<span class="c-sep">${echap(p)}</span>`; return; }
    if (i === 0) { html += colorerTete(p); return; }
    const t = p.trim();
    if (!t) { html += echap(p); return; }
    if (IP.test(t) || (t.includes(",") && t.split(",").every((x) => IP.test(x.trim())))) html += `<span class="c-ip">${echap(p)}</span>`;
    else if (/^@/.test(t) || /^site\s*=/i.test(t)) html += `<span class="c-site">${echap(p)}</span>`;
    else if (/^(trunk|access)$/i.test(t)) html += `<span class="c-mode">${echap(p)}</span>`;
    else if (/^vlans?\s*[=: ]/i.test(t)) html += `<span class="c-vlan">${echap(p)}</span>`;
    else if (/^sur\s+/i.test(t)) html += p.replace(/^(\s*)(sur)(\s+)(.*)$/i, (_, a, b, c, d) => `${a}<span class="c-mot">${b}</span>${c}${extremite(d)}`);
    else if (/^[\w.\- ]+=/.test(t)) { const k = p.indexOf("="); html += `<span class="c-cle">${echap(p.slice(0, k + 1))}</span><span class="c-val">${echap(p.slice(k + 1))}</span>`; }
    else html += `<span class="c-info">${echap(p)}</span>`;
  });
  return html + (com ? `<span class="c-com">${echap(com)}</span>` : "");
}
function extremite(s: string) {
  const m = s.match(/^(\s*)([^:\s]+)(\s*:\s*\S+)?(.*)$/);
  if (!m) return echap(s);
  return `${m[1]}<span class="c-nom">${echap(m[2])}</span>${m[3] ? `<span class="c-port">${echap(m[3])}</span>` : ""}${echap(m[4])}`;
}
function colorerTete(p: string): string {
  if (FLECHE.test(p)) {
    const [a, f, b] = p.split(/(\s*(?:->|<->|<-|=>|→|--)\s*)/);
    return extremite(a) + `<span class="c-fleche">${echap(f ?? "")}</span>` + extremite(b ?? "");
  }
  const m = p.match(/^(\s*)(\S+)(.*)$/);
  if (!m) return echap(p);
  const mot = m[2].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (mot === "site" || mot === "baie" || mot === "rack") return `${m[1]}<span class="c-type">${echap(m[2])}</span><span class="c-site">${echap(m[3])}</span>`;
  if (MOTS_TYPES.has(mot)) {
    // Le nom, ou une liste de noms « SW-A, SW-B », puis un éventuel « x6 ».
    const r = m[3].match(/^(\s*:?\s*)(.*?)(\s+x\d+)?(\s*)$/i)!;
    return `${m[1]}<span class="c-type">${echap(m[2])}</span>${echap(r[1])}<span class="c-nom">${echap(r[2])}</span>` +
      (r[3] ? `<span class="c-qte">${echap(r[3])}</span>` : "") + echap(r[4]);
  }
  return `${m[1]}<span class="c-inconnu">${echap(m[2])}</span>${echap(m[3])}`;
}

export function creerEditeur(racine: HTMLElement, contexte: Contexte, surChange: (texte: string) => void) {
  racine.innerHTML = `
    <div class="gouttiere" aria-hidden="true"></div>
    <div class="zone">
      <pre class="coloration" aria-hidden="true"></pre>
      <textarea spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Inventaire : une ligne par équipement ou par liaison"
        aria-autocomplete="list" aria-controls="suggestions"></textarea>
    </div>
    <ul class="suggestions" id="suggestions" role="listbox" hidden></ul>`;
  const gouttiere = racine.querySelector<HTMLElement>(".gouttiere")!;
  const pre = racine.querySelector<HTMLElement>(".coloration")!;
  const ta = racine.querySelector<HTMLTextAreaElement>("textarea")!;
  const liste = racine.querySelector<HTMLUListElement>(".suggestions")!;
  let alertes: Alerte[] = [];
  let cleAlertes = "\u0000";
  let sugg: Suggestion[] = [];
  let choix = 0;

  function peindre() {
    const lignes = ta.value.split("\n");
    const parLigne = new Map<number, Alerte["niveau"]>();
    alertes.forEach((a) => { if (parLigne.get(a.ligne) !== "erreur") parLigne.set(a.ligne, a.niveau); });
    const msg = new Map<number, string>();
    alertes.forEach((a) => msg.set(a.ligne, (msg.get(a.ligne) ? msg.get(a.ligne) + "\n" : "") + a.msg));
    pre.innerHTML = lignes.map((l, i) => {
      const n = parLigne.get(i + 1);
      const c = colorer(l) || " ";
      return n ? `<span class="l-${n}">${c}</span>` : c;
    }).join("\n") + "\n";
    gouttiere.innerHTML = lignes.map((_, i) => {
      const n = parLigne.get(i + 1);
      return `<div class="${n ? `g-${n}` : ""}" ${n ? `title="${echap(msg.get(i + 1)!)}"` : ""}>${i + 1}</div>`;
    }).join("");
    synchro();
  }
  // Défilement mémorisé à chaque « scroll » : le relire juste après avoir
  // recoloré le texte forçait le navigateur à tout remettre en page (lent).
  let defX = 0, defY = 0;
  function synchro() {
    pre.style.transform = `translate(${-defX}px, ${-defY}px)`;
    gouttiere.style.transform = `translateY(${-defY}px)`;
  }

  /* ---------- suggestions ---------- */
  function calculer(): Suggestion[] {
    const pos = ta.selectionStart;
    if (pos !== ta.selectionEnd) return [];
    const debut = ta.value.lastIndexOf("\n", pos - 1) + 1;
    const avant = ta.value.slice(debut, pos);
    const { inv, disp } = contexte();
    const filtre = (mot: string, liste: { texte: string; detail: string; ajout?: string }[]) => {
      const m = mot.toLowerCase();
      return liste.filter((s) => s.texte.toLowerCase().startsWith(m) && s.texte.toLowerCase() !== m)
        .concat(liste.filter((s) => !s.texte.toLowerCase().startsWith(m) && s.texte.toLowerCase().includes(m) && m.length > 1))
        .slice(0, 12).map((s) => ({ ...s, remplace: mot.length }));
    };
    const equipements = () => [...inv.equipements]
      .sort((a, b) => Number(b.genre === "switch" || b.genre === "passerelle" || b.genre === "parefeu") - Number(a.genre === "switch" || a.genre === "passerelle" || a.genre === "parefeu"))
      .map((e) => ({ texte: e.nom, detail: `${GENRES[e.genre].libelle} · ${e.site}` }));

    // Ports libres après « NOM: »
    let m = avant.match(/(?:^|\s|->|→|sur\s)([^\s:|]+):([^\s|:]*)$/i);
    if (m) {
      const f = disp.facades.get(inv.equipements.find((e) => e.nom.toLowerCase() === m![1].toLowerCase())?.nom ?? "");
      if (f) {
        const pris = new Set([...f.branches.keys()].map((k) => f.parId.get(k)));
        const libres = f.ports.filter((p) => !pris.has(p)).map((p) => ({ texte: p.id, detail: `port libre · ${p.type === "sfp" ? "SFP" : p.type === "wan" ? "WAN" : "RJ45"}` }));
        return filtre(m[2], libres);
      }
    }
    // Sites après « @ »
    m = avant.match(/@([^|]*)$/);
    if (m) return filtre(m[1], inv.sites.map((s) => ({ texte: s.nom, detail: `${inv.equipements.filter((e) => e.site === s.nom).length} équipements` })));
    // Équipement après « sur » ou une flèche
    m = avant.match(/(?:\bsur\s+|->\s*|→\s*)([^\s:|]*)$/i);
    if (m) return filtre(m[1], equipements());
    // Après un séparateur, sur une ligne d'équipement
    m = avant.match(/^\s*(\S+).*[|;]\s*([\w=@-]*)$/);
    if (m && MOTS_TYPES.has(m[1].toLowerCase())) {
      return filtre(m[2], [
        { texte: "sur ", detail: "branché sur SWITCH:port" },
        { texte: "@", detail: "site de l'équipement" },
        { texte: "vlan=", detail: "VLAN du port" },
        { texte: "passerelle=", detail: "IP de la passerelle par défaut" },
        { texte: "trunk", detail: "lien trunk (plusieurs VLAN)" },
        { texte: "ports=", detail: "nombre de ports RJ45 (plusieurs switchs : 24, 8, 48)" },
        { texte: "sfp=", detail: "nombre de cages SFP (plusieurs : 4, 0, 2)" },
        { texte: "masque=", detail: "masque de sous-réseau (255.255.255.0 ou /24)" },
        { texte: "serie=", detail: "numéro de série (plusieurs : un par équipement)" },
        { texte: "mac=", detail: "adresse MAC (plusieurs : une par équipement)" },
      ]);
    }
    m = avant.match(/(?:->|→).*[|;]\s*([\w=]*)$/);
    if (m) return filtre(m[1], [{ texte: "trunk", detail: "plusieurs VLAN étiquetés" }, { texte: "access", detail: "un seul VLAN" }, { texte: "vlan=", detail: "VLAN transportés" }]);
    // Début de ligne : types, puis noms (pour écrire une liaison)
    m = avant.match(/^(\s*)([\w-]*)$/);
    if (m && m[2].length >= 1) {
      return filtre(m[2], [
        ...TYPES.map((t) => ({ texte: t, detail: "nouvel équipement", ajout: " " })),
        { texte: "site", detail: "ouvrir un site", ajout: " " }, { texte: "baie", detail: "ouvrir une baie", ajout: " " },
        ...equipements().map((e) => ({ ...e, detail: `liaison depuis ${e.texte}`, ajout: ":" })),
      ]);
    }
    return [];
  }

  function placerListe() {
    const pos = ta.selectionStart;
    const debut = ta.value.lastIndexOf("\n", pos - 1) + 1;
    const ligne = ta.value.slice(0, pos).split("\n").length - 1;
    const col = pos - debut;
    const cs = getComputedStyle(ta);
    const lh = parseFloat(cs.lineHeight) || 20;
    const cw = largeurCar(cs.font);
    const zone = ta.getBoundingClientRect(), hote = racine.getBoundingClientRect();
    let x = zone.left - hote.left + parseFloat(cs.paddingLeft) + col * cw - ta.scrollLeft;
    const y = zone.top - hote.top + parseFloat(cs.paddingTop) + (ligne + 1) * lh - ta.scrollTop + 2;
    x = Math.min(x, hote.width - 300);
    liste.style.left = `${Math.max(4, x)}px`;
    liste.style.top = `${y}px`;
  }
  let _cw = 0, _font = "";
  function largeurCar(font: string) {
    if (font === _font && _cw) return _cw;
    const c = document.createElement("canvas").getContext("2d")!;
    c.font = font;
    _font = font;
    _cw = c.measureText("MMMMMMMMMM").width / 10;
    return _cw;
  }

  function montrer() {
    sugg = calculer();
    if (!sugg.length || document.activeElement !== ta) { fermer(); return; }
    choix = 0;
    liste.innerHTML = sugg.map((s, i) =>
      `<li role="option" id="sg-${i}" aria-selected="${i === 0}"><b>${echap(s.texte.trim() || s.texte)}</b><span>${echap(s.detail)}</span></li>`).join("");
    liste.hidden = false;
    ta.setAttribute("aria-activedescendant", "sg-0");
    placerListe();
  }
  function fermer() { liste.hidden = true; sugg = []; ta.removeAttribute("aria-activedescendant"); }
  function surligner(i: number) {
    choix = (i + sugg.length) % sugg.length;
    liste.querySelectorAll("li").forEach((li, k) => li.setAttribute("aria-selected", String(k === choix)));
    liste.children[choix]?.scrollIntoView({ block: "nearest" });
    ta.setAttribute("aria-activedescendant", `sg-${choix}`);
  }
  function accepter(i = choix) {
    const s = sugg[i];
    if (!s) return;
    const pos = ta.selectionStart;
    ta.setSelectionRange(pos - s.remplace, pos);
    // execCommand garde l'historique d'annulation (Ctrl+Z) du navigateur.
    const insere = s.texte + (s.ajout ?? "");
    if (!document.execCommand("insertText", false, insere)) ta.setRangeText(insere, pos - s.remplace, pos, "end");
    fermer();
    changer();
    if (s.ajout === ":" || s.texte.endsWith(" ") || s.texte === "@" || s.texte.endsWith("=")) setTimeout(montrer, 0);
  }

  let minuteur = 0;
  function changer() {
    peindre();
    clearTimeout(minuteur);
    minuteur = window.setTimeout(() => surChange(ta.value), 180);
  }

  // La ligne du curseur : pour l'expliquer en français sous l'éditeur.
  let auCurseur: ((n: number) => void) | null = null;
  const signalerCurseur = () => auCurseur?.(ta.value.slice(0, ta.selectionStart).split("\n").length);
  ["keyup", "click", "focus", "select"].forEach((t) => ta.addEventListener(t, signalerCurseur));
  ta.addEventListener("input", () => { changer(); montrer(); signalerCurseur(); });
  ta.addEventListener("scroll", () => { defX = ta.scrollLeft; defY = ta.scrollTop; synchro(); if (!liste.hidden) placerListe(); });
  ta.addEventListener("blur", () => setTimeout(fermer, 120));
  ta.addEventListener("click", fermer);
  ta.addEventListener("keydown", (e) => {
    if (!liste.hidden && sugg.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); surligner(choix + 1); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); surligner(choix - 1); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); accepter(); return; }
      if (e.key === "Escape") { e.preventDefault(); fermer(); return; }
    }
    if (e.key === " " && e.ctrlKey) { e.preventDefault(); montrer(); return; }
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      if (!document.execCommand("insertText", false, "  ")) ta.setRangeText("  ", ta.selectionStart, ta.selectionEnd, "end");
      changer();
    }
  });
  liste.addEventListener("mousedown", (e) => {
    const li = (e.target as HTMLElement).closest("li");
    if (!li) return;
    e.preventDefault();
    accepter([...liste.children].indexOf(li));
  });

  return {
    get valeur() { return ta.value; },
    definir(v: string) { ta.value = v; ta.scrollTop = 0; defX = defY = 0; peindre(); },
    alertes(a: Alerte[]) {
      // Mêmes remarques qu'avant : le texte a déjà été recoloré à la frappe.
      const cle = a.map((x) => `${x.ligne}|${x.niveau}|${x.msg}`).join("\n");
      if (cle === cleAlertes) return;
      cleAlertes = cle;
      alertes = a;
      peindre();
    },
    allerLigne(n: number) {
      const lignes = ta.value.split("\n");
      const debut = lignes.slice(0, n - 1).reduce((t, l) => t + l.length + 1, 0);
      ta.focus();
      ta.setSelectionRange(debut, debut + (lignes[n - 1]?.length ?? 0));
      const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
      ta.scrollTop = Math.max(0, (n - 5) * lh);
      synchro();
    },
    focus() { ta.focus(); },
    /** Appelé avec le numéro de la ligne du curseur, à chaque déplacement. */
    surCurseur(f: (n: number) => void) { auCurseur = f; },
    ligneCurseur() { return ta.value.slice(0, ta.selectionStart).split("\n").length; },
    /** Insère un bloc au curseur (annulable avec Ctrl+Z), sur des lignes à lui. */
    inserer(bloc: string) {
      ta.focus();
      const pos = ta.selectionEnd;
      const avant = ta.value.slice(0, pos);
      let t = bloc.replace(/^\n+/, "");
      if (avant && !avant.endsWith("\n")) t = "\n" + t;
      if (avant && !/\n\s*\n$/.test(avant + (t.startsWith("\n") ? "\n" : ""))) t = "\n" + t;
      ta.setSelectionRange(pos, pos);
      if (!document.execCommand("insertText", false, t)) ta.setRangeText(t, pos, pos, "end");
      changer();
      synchro();
    },
  };
}
