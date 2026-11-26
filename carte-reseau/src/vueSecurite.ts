/**
 * L'onglet « Sécurité » : préconisations, zones, matrice de flux, versions à
 * vérifier, points à contrôler sur place. Le même contenu s'imprime (PDF).
 */
import type { Bilan, Gravite } from "./securite.ts";
import { CLASSIFICATION } from "./impression.ts";

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
      <h2>Sécurité et flux${o.impression ? ` — ${echap(o.titre)}` : ""}</h2>
      <p class="s-note">Analyse faite sur ce poste, à partir des données de la carte (saisie, import et relevés des switchs)${o.date ? ` · ${echap(o.date)}` : ""}${o.auteur ? ` · établi par ${echap(o.auteur)}` : ""}.
        Pas de base de vulnérabilités (CVE) embarquée : sans connexion elle serait vite périmée ; les versions à comparer aux avis du CERT-FR sont listées plus bas.</p>
      <div class="s-compteurs">
        <span class="g-critique">${pl(n("critique"), "critique")}</span>
        <span class="g-importante">${pl(n("importante"), "importante")}</span>
        <span class="g-conseil">${pl(n("conseil"), "conseil")}</span>
        ${o.impression ? "" : `<span class="s-esp"></span><button type="button" data-s="imprimer">⎙ Imprimer / PDF</button>`}
      </div>
    </header>
    <section><h3>Préconisations</h3>${precos}</section>
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
