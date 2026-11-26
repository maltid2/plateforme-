/**
 * Le rapport de préconisations (bouton « Générer les préconisations ») : sécurité, Genetec, zones, matrice de flux, versions à
 * vérifier, points à contrôler sur place. Le même contenu s'imprime (PDF).
 */
import type { Bilan, Gravite } from "./securite.ts";
import { CLASSIFICATION } from "./impression.ts";
import { icone } from "./ui/icones.ts";

const echap = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const LIBELLE: Record<Gravite, string> = { critique: "Critique", importante: "Importante", conseil: "Conseil" };

export function rapportSecurite(b: Bilan, o: { titre: string; impression?: boolean; date?: string; auteur?: string }): string {
  const n = (g: Gravite) => b.precos.filter((p) => p.gravite === g).length;
  const pl = (x: number, mot: string) => `${x} ${mot}${x > 1 ? "s" : ""}`;
  const puce = (nom: string) => o.impression ? `<span class="s-eq">${echap(nom)}</span>` : `<button type="button" class="s-eq" data-nom="${echap(nom)}" title="Voir ${echap(nom)} sur le plan">${echap(nom)}</button>`;
  const precos = b.precos.length ? b.precos.map((p) => `
    <article class="s-preco g-${p.gravite}">
      <div class="s-preco-tete"><span class="s-badge">${LIBELLE[p.gravite]}</span><span class="s-dom">${echap(p.domaine)}</span></div>
      <h4>${echap(p.titre)}</h4>
      <p><b>Constat</b> — ${echap(p.constat)}</p>
      <p><b>À faire</b> — ${echap(p.preco)}</p>
      ${p.equipements.length ? `<div class="s-eqs">${p.equipements.slice(0, 30).map(puce).join("")}${p.equipements.length > 30 ? `<span class="s-plus">+ ${p.equipements.length - 30}</span>` : ""}</div>` : ""}
      <small>${echap(p.reference)}</small>
    </article>`).join("") : `<p class="s-vide">Aucune préconisation : rien d'anormal dans les données de la carte.</p>`;
  const decision = (d: string) => `<span class="s-dec d-${d === "Autoriser" ? "ok" : d === "Interdire" ? "non" : "lim"}">${d}</span>`;
  return `
  <div class="secu${o.impression ? " secu-imprime" : ""}">
    <header class="s-tete">
      ${o.impression ? `<div class="i-classif">${echap(CLASSIFICATION)}</div>` : ""}
      <h2>Préconisations sécurité et flux — ${echap(o.titre)}</h2>
      <p class="s-note">Analyse faite sur ce poste, à partir des données de la carte (saisie, import et relevés des switchs)${o.date ? ` · ${echap(o.date)}` : ""}${o.auteur ? ` · établi par ${echap(o.auteur)}` : ""}.
        Pas de base de vulnérabilités (CVE) embarquée : sans connexion elle serait vite périmée ; les versions à comparer aux avis du CERT-FR sont listées plus bas.</p>
      <div class="s-compteurs">
        <span class="g-critique">${pl(n("critique"), "critique")}</span>
        <span class="g-importante">${pl(n("importante"), "importante")}</span>
        <span class="g-conseil">${pl(n("conseil"), "conseil")}</span>
        ${o.impression ? "" : `<span class="s-esp"></span><button type="button" data-s="genetec">${icone("video")}${b.genetec.actif ? "Mettre à jour l'export Genetec" : "Comparer avec un export Genetec"}</button><button type="button" data-s="imprimer">${icone("imprimer")}Imprimer / PDF</button>`}
      </div>
    </header>
    <section><h3>Préconisations</h3>${precos}</section>
    ${sectionGenetec(b, puce)}
    ${b.zones.length ? `<section><h3>Zones du réseau</h3>
      <table class="s-table"><thead><tr><th>Groupe</th><th>VLAN</th><th>Réseaux IP</th><th>Équipements</th></tr></thead><tbody>
      ${b.zones.map((z) => `<tr><td>${echap(z.groupe)}</td><td class="m">${echap(z.vlans)}</td><td class="m">${echap(z.reseaux)}</td><td>${z.nombre}</td></tr>`).join("")}
      </tbody></table><p class="s-note">Réseau IP calculé avec le masque quand il est connu, sinon en /24.</p></section>` : ""}
    <section><h3>Matrice des flux préconisée</h3>
      <table class="s-table"><thead><tr><th>Source</th><th>Destination</th><th>Flux</th><th>Décision</th><th>Pourquoi</th></tr></thead><tbody>
      ${b.flux.map((f) => `<tr><td>${echap(f.source)}</td><td>${echap(f.destination)}</td><td class="mf">${echap(f.flux)}</td><td>${decision(f.decision)}</td><td>${echap(f.motif)}</td></tr>`).join("")}
      </tbody></table>
      <p class="s-note">À appliquer sur le pare-feu ou les ACL du cœur de réseau, puis à valider avec l'exploitant (les ports du logiciel vidéo dépendent de l'éditeur).</p></section>
    <section><h3>Versions à vérifier (failles connues)</h3>
      ${b.versions.length ? `<table class="s-table"><thead><tr><th>Modèle</th><th>Version</th><th>Équipements</th><th>À faire</th></tr></thead><tbody>
      ${b.versions.map((v) => `<tr><td>${echap(v.modele)}</td><td class="m">${echap(v.version || "inconnue")}</td><td>${echap(v.equipements.length > 8 ? `${v.equipements.slice(0, 8).join(", ")} … (${v.equipements.length})` : v.equipements.join(", "))}</td><td>${echap(v.remarque)}</td></tr>`).join("")}
      </tbody></table>` : `<p class="s-vide">Aucun modèle ni version renseigné.</p>`}
      <p class="s-note">Avis de sécurité : CERT-FR (cert.ssi.gouv.fr, rubrique « Avis ») et pages sécurité des constructeurs. À consulter depuis un poste connecté, en recopiant le modèle et la version.</p></section>
    <section><h3>À vérifier sur place</h3><ul class="s-liste">${b.verifications.map((v) => `<li>${echap(v)}</li>`).join("")}</ul></section>
  </div>`;
}

/** Genetec ↔ réseau : l'état des caméras, où aller voir, et les débits. */
function sectionGenetec(b: Bilan, puce: (n: string) => string): string {
  const g = b.genetec;
  if (!g.actif) return `<section><h3>Vidéo : comparaison avec Genetec</h3><p class="s-vide">Aucun export Genetec pour cette carte. Exportez depuis Genetec Security Center l'inventaire matériel (rapport « Inventaire matériel » ou liste des caméras avec IP / MAC / état) et, pour les débits, la configuration des caméras ; puis « Comparer avec un export Genetec ».</p></section>`;
  const n = (x: number, mot: string, pluriel = `${mot}s`) => `${x} ${x > 1 ? pluriel : mot}`;
  const enLigne = g.rapproches.filter((r) => r.etat === "en ligne").length;
  const ligne = (r: Bilan["genetec"]["rapproches"][number]) => `<tr><td>${echap(r.unite.nom || "—")}</td><td>${r.eq ? puce(r.eq.nom) : "—"}</td><td class="m">${echap(r.unite.ip || "—")}</td>
    <td>${r.switch ? `${puce(r.switch)}${r.port ? ` <span class="m">port ${echap(r.port)}</span>` : ""}` : "—"}</td><td>${echap(r.unite.archiveur || "—")}</td><td>${echap(r.unite.etat || "—")}</td></tr>`;
  const tete = `<thead><tr><th>Nom Genetec</th><th>Sur la carte</th><th>IP</th><th>Switch · port</th><th>Archiveur</th><th>État Genetec</th></tr></thead>`;
  const mbps = (k: number) => `${(k / 1000).toFixed(k >= 100000 ? 0 : 1).replace(".", ",")} Mb/s`;
  return `<section><h3>Vidéo : comparaison avec Genetec</h3>
    <p class="s-note">Export${b.sourcesGenetec.length > 1 ? "s" : ""} : ${b.sourcesGenetec.map((x) => `${echap(x.nom)} (${x.type}, ${new Date(x.date).toLocaleDateString("fr-FR")})`).join(" · ")}</p>
    <div class="s-compteurs s-gen">
      <span>${n(g.rapproches.length, "unité")} Genetec</span>
      <span class="g-ok">${n(enLigne, "en ligne", "en ligne")}</span>
      <span class="g-critique">${n(g.horsLigne.length, "hors ligne", "hors ligne")}</span>
      <span class="g-importante">${n(g.nonEnregistrees.length, "caméra non enregistrée", "caméras non enregistrées")}</span>
      <span class="g-conseil">${n(g.absentes.length, "absente", "absentes")} de la carte</span>
    </div>
    ${g.ecartsNom.length && puce("x").startsWith("<button") ? `<p><button type="button" data-s="noms-genetec">Renommer sur la carte avec les noms Genetec (${g.ecartsNom.length})</button> <span class="s-note">Ex. : ${echap(g.ecartsNom.slice(0, 3).map((r) => `${r.eq!.nom} → ${r.unite.nom.split(" / ")[0]}`).join(", "))}. Annulable (Ctrl+Z).</span></p>` : ""}
    ${g.horsLigne.length ? `<h4 class="s-sous">Hors ligne — où aller voir</h4><table class="s-table">${tete}<tbody>${g.horsLigne.map(ligne).join("")}</tbody></table>` : ""}
    ${g.nonEnregistrees.length && g.rapproches.length ? `<h4 class="s-sous">Sur le réseau, absentes de Genetec (non enregistrées)</h4><div class="s-eqs">${g.nonEnregistrees.map((e) => puce(e.nom)).join("")}</div>` : ""}
    ${g.absentes.length ? `<h4 class="s-sous">Dans Genetec, introuvables sur la carte</h4><table class="s-table">${tete}<tbody>${g.absentes.map(ligne).join("")}</tbody></table>` : ""}
    ${g.debitParSwitch.length ? `<h4 class="s-sous">Débit vidéo par switch</h4><table class="s-table"><thead><tr><th>Switch</th><th>Caméras</th><th>Débit</th><th>Lien montant</th><th>Charge</th></tr></thead><tbody>
      ${g.debitParSwitch.map((d) => { const pc = d.capaciteMbps ? Math.round(d.kbps / 10 / d.capaciteMbps) : null; return `<tr><td>${puce(d.switch)}</td><td>${d.cameras}</td><td class="m">${mbps(d.kbps)}</td><td class="m">${echap(d.lien ? `${d.lien} (${d.capaciteMbps! >= 1000 ? `${d.capaciteMbps! / 1000} Gb/s` : `${d.capaciteMbps} Mb/s`})` : "plusieurs liens ou vitesse inconnue")}</td><td>${pc === null ? "—" : `<span class="s-dec ${pc > 70 ? "d-non" : pc > 50 ? "d-lim" : "d-ok"}">${pc} %</span>`}</td></tr>`; }).join("")}
      </tbody></table>` : ""}
    ${g.debitParArchiveur.length ? `<h4 class="s-sous">Par archiveur</h4><table class="s-table"><thead><tr><th>Archiveur</th><th>Caméras</th><th>Débit connu</th></tr></thead><tbody>
      ${g.debitParArchiveur.map((a) => `<tr><td>${echap(a.archiveur)}</td><td>${a.cameras}</td><td class="m">${a.kbps ? mbps(a.kbps) : "—"}</td></tr>`).join("")}</tbody></table>` : ""}
  </section>`;
}
