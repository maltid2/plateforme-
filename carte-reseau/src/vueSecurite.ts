/**
 * Le rapport de préconisations (bouton « Générer les préconisations »).
 * Court et lisible par tous : d'abord ce qu'il faut corriger en premier, puis
 * les mesures par classe (indispensable, recommandé, renforcé), chacune avec
 * son POURQUOI et son effet sur le dépannage. Le détail (équipements,
 * commandes) est replié ; il est déplié à l'impression.
 */
import { CLASSES, type Bilan, type Commande, type Element, type Etat, type Impact, type Mesure, type Panne } from "./securite.ts";
import { CLASSIFICATION } from "./impression.ts";
import { icone } from "./ui/icones.ts";

const echap = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pl = (x: number, mot: string, pluriel = `${mot}s`) => `${x} ${x > 1 ? pluriel : mot}`;
const ETAT: Record<Etat, string> = { "a-faire": "À faire", "a-verifier": "À vérifier", ok: "OK" };
const IMPACT: Record<Impact, string> = { "plus-rapide": "Dépannage plus rapide", aucun: "Sans effet sur le dépannage", faible: "Dépannage : un peu plus long", moyen: "Dépannage : plus long", fort: "Dépannage : beaucoup plus long" };

export function rapportSecurite(b: Bilan, o: { titre: string; impression?: boolean; date?: string; auteur?: string }): string {
  const puce = (nom: string) => !nom ? "" : o.impression ? `<span class="s-eq">${echap(nom)}</span>` : `<button type="button" class="s-eq" data-nom="${echap(nom)}" title="Voir ${echap(nom)} sur le plan">${echap(nom)}</button>`;
  const ouvert = o.impression ? " open" : "";
  const commande = (c: Commande) => `<div class="s-cmd"><div class="s-cmd-tete"><span>${echap(c.libelle)}</span>${o.impression ? "" : `<button type="button" data-s="copier" title="Copier ces commandes">${icone("copier")}Copier</button>`}</div><pre>${echap(c.lignes.join("\n"))}</pre></div>`;
  const element = (e: Element) => `<li>${e.cible ? `${puce(e.cible)} ` : ""}<span>${echap(e.texte)}</span>${e.commandes.map(commande).join("")}</li>`;
  const detail = (els: Element[]) => {
    if (!els.length) return "";
    const avecCmd = els.some((e) => e.commandes.length);
    return `<details class="s-detail"${ouvert}><summary>${icone("chevron")}Où et comment${avecCmd ? " (commandes)" : ""} · ${pl(els.length, "point")}</summary><ul class="s-elements">${els.map(element).join("")}</ul></details>`;
  };
  const mesure = (m: Mesure) => `
    <article class="s-mesure e-${m.etat}">
      <header><span class="s-etat">${ETAT[m.etat]}</span><h4>${echap(m.titre)}</h4></header>
      <p class="s-pourquoi"><b>Pourquoi :</b> ${echap(m.pourquoi)}</p>
      <p class="s-impact i-${m.impact}"><b>${IMPACT[m.impact]}</b> — ${echap(m.impactTexte)}</p>
      <p class="s-constat">${echap(m.constat)}</p>
      ${detail(m.elements)}
    </article>`;
  const classe = (c: Mesure["classe"]) => {
    const ms = b.mesures.filter((m) => m.classe === c);
    const aFaire = ms.filter((m) => m.etat === "a-faire").length;
    return `<section class="s-classe c-${c}"><h3><span class="s-num">${c}</span>${echap(CLASSES[c].nom)}${aFaire ? `<span class="s-nb">${aFaire} à faire</span>` : ""}</h3>
      <p class="s-note">${echap(CLASSES[c].texte)}</p><div class="s-mesures">${ms.map(mesure).join("")}</div></section>`;
  };
  const panne = (p: Panne) => `<li class="${p.critique ? "p-critique" : ""}"><div>${p.cible ? `${puce(p.cible)} ` : ""}<b>${echap(p.titre)}</b></div>${p.detail ? `<p>${echap(p.detail)}</p>` : ""}${p.commandes.length ? `<details class="s-detail"${ouvert}><summary>${icone("chevron")}Commandes</summary>${p.commandes.map(commande).join("")}</details>` : ""}</li>`;
  const n = (e: Etat) => b.mesures.filter((m) => m.etat === e).length;
  return `
  <div class="secu${o.impression ? " secu-imprime" : ""}">
    <header class="s-tete">
      ${o.impression ? `<div class="i-classif">${echap(CLASSIFICATION)}</div>` : ""}
      <h2>Préconisations — ${echap(o.titre)}</h2>
      <p class="s-note">Réseau vidéo isolé (sans Internet), cloisonné par VLAN (sans ACL). Calculé sur ce poste à partir de la carte${b.releve ? ", des relevés des switchs" : ""}${b.genetec.actif ? " et de l'export Genetec" : ""}${o.date ? ` · ${echap(o.date)}` : ""}${o.auteur ? ` · établi par ${echap(o.auteur)}` : ""}.</p>
      <div class="s-compteurs">
        <span class="g-critique">${n("a-faire")} à faire</span>
        <span class="g-importante">${n("a-verifier")} à vérifier</span>
        <span class="g-ok">${n("ok")} OK</span>
        ${b.pannes.length ? `<span class="g-conseil">${pl(b.pannes.length, "panne")}</span>` : ""}
        ${o.impression ? "" : `<span class="s-esp"></span><button type="button" data-s="genetec">${icone("video")}${b.genetec.actif ? "Mettre à jour l'export Genetec" : "Comparer avec un export Genetec"}</button><button type="button" data-s="imprimer">${icone("imprimer")}Imprimer / PDF</button>`}
      </div>
      ${b.releve ? "" : `<p class="s-alerte">Sans relevé des switchs, beaucoup de points restent « à vérifier ». Lancez « Relever les switchs.bat » puis Importer › Relevés des switchs.</p>`}
    </header>
    <section class="s-premiers"><h3>À corriger en premier</h3>
      ${b.premiers.length ? `<ol>${b.premiers.map((p) => `<li>${echap(p)}</li>`).join("")}</ol>` : `<p class="s-vide">Rien d'urgent dans les données de la carte.</p>`}</section>
    ${classe(1)}${classe(2)}${classe(3)}
    ${b.pannes.length ? `<section><h3>Pannes et anomalies relevées</h3><p class="s-note">Du dépannage plutôt que de la sécurité : à traiter à la prochaine intervention.</p><ul class="s-pannes">${b.pannes.map(panne).join("")}</ul></section>` : ""}
    ${sectionGenetec(b, puce, ouvert)}
    ${b.zones.length ? `<section><h3>Plan des VLAN</h3>
      <p class="s-note">À tenir à jour : sans ACL, c'est lui qui dit qui peut parler à qui.</p>
      <table class="s-table"><thead><tr><th>Groupe</th><th>VLAN</th><th>Réseaux IP</th><th>Équipements</th></tr></thead><tbody>
      ${b.zones.map((z) => `<tr><td>${echap(z.groupe)}</td><td class="m">${echap(z.vlans)}</td><td class="m">${echap(z.reseaux)}</td><td>${z.nombre}</td></tr>`).join("")}
      </tbody></table></section>` : ""}
    ${b.versions.length ? `<section><details class="s-detail"${ouvert}><summary>${icone("chevron")}<h3>Versions logicielles · ${pl(b.versions.length, "ligne")}</h3></summary>
      <table class="s-table"><thead><tr><th>Modèle</th><th>Version</th><th>Équipements</th><th>À faire</th></tr></thead><tbody>
      ${b.versions.map((v) => `<tr><td>${echap(v.modele)}</td><td class="m">${echap(v.version || "inconnue")}</td><td>${echap(v.equipements.length > 8 ? `${v.equipements.slice(0, 8).join(", ")} … (${v.equipements.length})` : v.equipements.join(", "))}</td><td>${echap(v.remarque)}</td></tr>`).join("")}
      </tbody></table>
      <p class="s-note">Les équipements n'ont pas Internet : les mises à jour se téléchargent sur le site du constructeur depuis un poste de l'entreprise, puis s'installent à la main, en fenêtre de maintenance.</p></details></section>` : ""}
    <p class="s-note">Commandes de modification : en fenêtre de maintenance, après une sauvegarde de la configuration.</p>
  </div>`;
}

/** Genetec ↔ réseau : l'état des caméras et les débits. */
function sectionGenetec(b: Bilan, puce: (n: string) => string, ouvert: string): string {
  const g = b.genetec;
  if (!g.actif) return `<section><h3>Vidéo : comparaison avec Genetec</h3><p class="s-vide">Pas d'export Genetec pour cette carte. Exportez de Security Center la liste des caméras (IP, MAC, état), puis « Comparer avec un export Genetec ».</p></section>`;
  const enLigne = g.rapproches.filter((r) => r.etat === "en ligne").length;
  const ligne = (r: Bilan["genetec"]["rapproches"][number]) => `<tr><td>${echap(r.unite.nom || "—")}</td><td>${r.eq ? puce(r.eq.nom) : "—"}</td><td class="m">${echap(r.unite.ip || "—")}</td>
    <td>${r.switch ? `${puce(r.switch)}${r.port ? ` <span class="m">port ${echap(r.port)}</span>` : ""}` : "—"}</td><td>${echap(r.unite.archiveur || "—")}</td><td>${echap(r.unite.etat || "—")}</td></tr>`;
  const tete = `<thead><tr><th>Nom Genetec</th><th>Sur la carte</th><th>IP</th><th>Switch · port</th><th>Archiveur</th><th>État Genetec</th></tr></thead>`;
  const mbps = (k: number) => `${(k / 1000).toFixed(k >= 100000 ? 0 : 1).replace(".", ",")} Mb/s`;
  return `<section><h3>Vidéo : comparaison avec Genetec</h3>
    <p class="s-note">Export${b.sourcesGenetec.length > 1 ? "s" : ""} : ${b.sourcesGenetec.map((x) => `${echap(x.nom)} (${x.type}, ${new Date(x.date).toLocaleDateString("fr-FR")})`).join(" · ")}</p>
    <div class="s-compteurs s-gen">
      <span>${pl(g.rapproches.length, "unité")} Genetec</span>
      <span class="g-ok">${enLigne} en ligne</span>
      <span class="g-critique">${g.horsLigne.length} hors ligne</span>
      <span class="g-importante">${pl(g.nonEnregistrees.length, "caméra non enregistrée", "caméras non enregistrées")}</span>
      <span class="g-conseil">${g.absentes.length} absente${g.absentes.length > 1 ? "s" : ""} de la carte</span>
    </div>
    ${g.ecartsNom.length && !ouvert ? `<p><button type="button" data-s="noms-genetec">${icone("crayon")}Reprendre les noms Genetec sur la carte (${g.ecartsNom.length})</button> <span class="s-note">Annulable (Ctrl+Z).</span></p>` : ""}
    ${g.horsLigne.length ? `<h4 class="s-sous">Hors ligne — où aller voir</h4><table class="s-table">${tete}<tbody>${g.horsLigne.map(ligne).join("")}</tbody></table>` : ""}
    ${g.absentes.length ? `<details class="s-detail"${ouvert}><summary>${icone("chevron")}Dans Genetec, introuvables sur la carte · ${g.absentes.length}</summary><table class="s-table">${tete}<tbody>${g.absentes.map(ligne).join("")}</tbody></table></details>` : ""}
    ${g.debitParSwitch.length ? `<details class="s-detail"${ouvert}><summary>${icone("chevron")}Débit vidéo par switch</summary><table class="s-table"><thead><tr><th>Switch</th><th>Caméras</th><th>Débit</th><th>Lien montant</th><th>Charge</th></tr></thead><tbody>
      ${g.debitParSwitch.map((d) => { const pc = d.capaciteMbps ? Math.round(d.kbps / 10 / d.capaciteMbps) : null; return `<tr><td>${puce(d.switch)}</td><td>${d.cameras}</td><td class="m">${mbps(d.kbps)}</td><td class="m">${echap(d.lien ? `${d.lien} (${d.capaciteMbps! >= 1000 ? `${d.capaciteMbps! / 1000} Gb/s` : `${d.capaciteMbps} Mb/s`})` : "plusieurs liens ou vitesse inconnue")}</td><td>${pc === null ? "—" : `<span class="s-dec ${pc > 70 ? "d-non" : pc > 50 ? "d-lim" : "d-ok"}">${pc} %</span>`}</td></tr>`; }).join("")}
      </tbody></table>
      ${g.debitParArchiveur.length ? `<table class="s-table"><thead><tr><th>Archiveur</th><th>Caméras</th><th>Débit connu</th></tr></thead><tbody>
      ${g.debitParArchiveur.map((a) => `<tr><td>${echap(a.archiveur)}</td><td>${a.cameras}</td><td class="m">${a.kbps ? mbps(a.kbps) : "—"}</td></tr>`).join("")}</tbody></table>` : ""}</details>` : ""}
  </section>`;
}
