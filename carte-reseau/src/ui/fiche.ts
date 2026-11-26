/**
 * La fiche d'un équipement (à droite de la carte) : IP, emplacement,
 * passerelle et chemin jusqu'à elle (dépannage), informations, mini-façade
 * des ports, câbles avec leurs actions, et les boutons Modifier / Câble /
 * Supprimer. En visionneuse (lecture seule), sans les actions.
 */
import { APPARENCE, COULEUR_TRUNK } from "../apparence.ts";
import type { Disposition } from "../disposition.ts";
import { cheminPasserelle, lirePort } from "../facade.ts";
import { GENRES, LIBELLE_CLE, MEDIAS, type Equipement, type Inventaire, type Liaison } from "../saisie.ts";

export type ContexteFiche = {
  eq: Equipement | null; inv: Inventaire; disp: Disposition; lectureSeule: boolean;
  choisir: (nom: string | null, centrer?: boolean) => void;
  modifier: (nom: string) => void;
  supprimer: (nom: string) => void;
  editerLien: (l: Liaison) => void;
  supprimerLien: (l: Liaison) => void;
  versLigne: (n: number) => void;
};

export function dessinerFiche(fiche: HTMLElement, ctx: ContexteFiche) {
  const { eq: e, inv, disp, choisir } = ctx;
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
  ligne("Emplacement", [e.site, e.point, e.baie && `baie ${e.baie}`].filter(Boolean).join(" · "));
  const ch = cheminPasserelle(e.nom, inv);
  // Passerelle : une seule ligne (IP de passerelle, et l'équipement qui la porte s'il est sur la carte).
  if (e.passerelleIp || ch) {
    const p = document.createElement("span");
    if (e.passerelleIp) p.append(e.passerelleIp);
    if (ch) p.append(e.passerelleIp ? " · " : "", lien(ch.passerelle.nom), !e.passerelleIp && ch.passerelle.ip ? ` (${ch.passerelle.ip})` : "");
    ligne("Passerelle", p);
  } else if (e.genre !== "passerelle" && e.genre !== "parefeu") ligne("Passerelle", "aucune déclarée sur ce site");
  if (ch) {
    // Dépannage : chaque saut jusqu'à la passerelle, avec ses ports (allumé aussi sur le plan).
    const etapes = [e.nom, ...ch.sauts];
    const ol = document.createElement("ol");
    ol.className = "chemin";
    for (let i = 0; i + 1 < etapes.length; i++) {
      const a = etapes[i], b = etapes[i + 1];
      const l = inv.liaisons.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
      const [pa, pb] = l ? (l.a === a ? [l.portA, l.portB] : [l.portB, l.portA]) : [undefined, undefined];
      const li = document.createElement("li");
      li.append(lien(a), pa ? ` port ${pa}` : "", " → ", lien(b), pb ? ` port ${pb}` : "",
        l?.media ? ` · ${MEDIAS[l.media]}` : "", l?.mode === "trunk" ? ` · trunk${l.vlans ? ` ${l.vlans}` : ""}` : l?.vlans ? ` · VLAN ${l.vlans}` : "");
      ol.append(li);
    }
    ligne("Chemin", ol);
  }
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

  fiche.append(h("h3", "", `Câbles (${liens.length})`));
  if (!liens.length) fiche.append(h("p", "vide-fiche", "Aucun câble déclaré."));
  else {
    const tab = document.createElement("table");
    tab.innerHTML = `<thead><tr><th>Port</th><th>Branché sur</th><th>Câble · VLAN</th>${ctx.lectureSeule ? "" : "<th></th>"}</tr></thead>`;
    const tb = document.createElement("tbody");
    liens.sort((x, y) => (x.monPort ?? "").localeCompare(y.monPort ?? "", "fr", { numeric: true })).forEach((x) => {
      const tr = document.createElement("tr");
      const td = (v: string | Node, cls = "") => { const c = h("td", cls); c.append(v); tr.append(c); };
      td(x.monPort ?? "—", "mono");
      td(lien(x.autre, x.sonPort));
      // « trunk · VLAN 10,30 », « VLAN 30 », le type de câble s'il est précisé, la remarque.
      td([x.l.media ? MEDIAS[x.l.media] : "", x.l.mode === "trunk" ? "trunk" : "", x.l.vlans ? `VLAN ${x.l.vlans}` : "", x.l.libelle ?? ""].filter(Boolean).join(" · ") || "—",
        x.l.mode === "trunk" ? "trunk" : "");
      if (!ctx.lectureSeule) {
        // Chaque câble se modifie ou se supprime d'ici.
        const act = h("td", "act");
        const b1 = h("button", "", "✎") as HTMLButtonElement; b1.type = "button"; b1.title = "Modifier ce câble"; b1.onclick = () => ctx.editerLien(x.l);
        const b2 = h("button", "danger", "✕") as HTMLButtonElement; b2.type = "button"; b2.title = "Supprimer ce câble"; b2.onclick = () => ctx.supprimerLien(x.l);
        act.append(b1, b2); tr.append(act);
      }
      tb.append(tr);
    });
    tab.append(tb);
    fiche.append(tab);
  }
  if (!ctx.lectureSeule) {
    // Les actions simples, en haut de la fiche : modifier, ajouter un câble, supprimer.
    const actions = h("div", "actions-fiche");
    const bouton = (txt: string, titre: string, f: () => void, cls = "") => {
      const b = h("button", cls, txt) as HTMLButtonElement; b.type = "button"; b.title = titre; b.onclick = f; actions.append(b);
    };
    bouton("✎ Modifier", "Modifier cet équipement dans le formulaire", () => ctx.modifier(e.nom));
    bouton("＋ Câble", "Ajouter un câble depuis cet équipement", () => ctx.editerLien({ a: e.nom, b: "", mode: undefined, ligne: 0, vlans: undefined, libelle: undefined, media: undefined } as unknown as Liaison));
    bouton("🗑 Supprimer", "Supprimer cet équipement", () => ctx.supprimer(e.nom), "danger");
    tete.after(actions);
  }
  const aller = h("button", "modifier", `Voir la ligne ${e.ligne} dans le texte`) as HTMLButtonElement;
  aller.type = "button";
  aller.onclick = () => ctx.versLigne(e.ligne);
  fiche.append(aller);
  fiche.hidden = false;
}
