/**
 * Le dossier imprimable : cartouche, plan 2D, légende et tableau des
 * équipements par site. On l'imprime, ou on l'enregistre en PDF avec
 * l'imprimante « Enregistrer au format PDF » du navigateur : le PDF s'ouvre
 * partout, sans logiciel particulier, et il est produit sur le poste, sans
 * service en ligne.
 */
import { APPARENCE, COULEUR_MEDIA } from "./apparence.ts";
import { cheminPasserelle } from "./facade.ts";
import { GENRES, MEDIAS, type Genre, type Inventaire, type Media } from "./saisie.ts";

const echap = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const CLASSIFICATION = "Document interne — diffusion restreinte";

export function imprimer(inv: Inventaire, svgPlan: string, titre: string, site: string | null, baies = "") {
  document.getElementById("impression")?.remove();
  const date = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const sites = inv.sites.filter((s) => !site || s.nom === site);
  const eqs = inv.equipements.filter((e) => !site || e.site === site);
  const brancheDe = (nom: string) => {
    const l = inv.liaisons.find((x) => (x.a === nom || x.b === nom) &&
      ["switch", "passerelle", "parefeu"].includes(inv.equipements.find((y) => y.nom === (x.a === nom ? x.b : x.a))?.genre ?? ""));
    if (!l) return { txt: "—", l: undefined };
    const [v, p] = l.a === nom ? [l.b, l.portB] : [l.a, l.portA];
    return { txt: `${v}${p ? ` · port ${p}` : ""}`, l };
  };
  const presents = new Set(eqs.map((e) => e.genre));
  const medias = new Set(inv.liaisons.map((l) => l.media).filter(Boolean) as Media[]);

  const tableau = sites.map((s) => {
    const lignes = eqs.filter((e) => e.site === s.nom).map((e) => {
      const b = brancheDe(e.nom);
      const gw = cheminPasserelle(e.nom, inv);
      return `<tr>
        <td><i style="background:${APPARENCE[e.genre].couleur}"></i>${echap(GENRES[e.genre].libelle)}</td>
        <td><b>${echap(e.nom)}</b>${e.infos[0] ? `<br><small>${echap(e.infos[0])}</small>` : ""}</td>
        <td class="m">${echap(e.ip ?? "—")}</td>
        <td>${echap([e.point, e.baie && `baie ${e.baie}`].filter(Boolean).join(" · ") || "—")}</td>
        <td>${echap(b.txt)}</td>
        <td>${echap([b.l?.mode === "trunk" ? "trunk" : "", b.l?.vlans ? `VLAN ${b.l.vlans}` : ""].filter(Boolean).join(" · ") || "—")}</td>
        <td>${b.l?.media ? echap(MEDIAS[b.l.media]) : "—"}</td>
        <td>${gw ? echap(`${gw.passerelle.nom}${gw.via ? ` (port ${gw.via})` : ""}`) : "—"}</td>
      </tr>`;
    }).join("");
    return `<h2>${echap(s.nom)}</h2>
      <table><thead><tr><th>Type</th><th>Nom</th><th>Adresse IP</th><th>Lieu / baie</th><th>Branché sur</th><th>VLAN</th><th>Câble</th><th>Passerelle</th></tr></thead><tbody>${lignes}</tbody></table>`;
  }).join("");

  const inter = inv.liaisons.filter((l) => {
    const a = inv.equipements.find((e) => e.nom === l.a), b = inv.equipements.find((e) => e.nom === l.b);
    return a && b && (a.site !== b.site || (a.point ?? "") !== (b.point ?? "")) && (!site || a.site === site || b.site === site);
  });
  const tableInter = inter.length ? `<h2>Liaisons entre sites et entre lieux</h2>
    <table><thead><tr><th>De</th><th>Vers</th><th>Câble</th><th>Mode</th><th>Remarque</th></tr></thead><tbody>${inter.map((l) => `<tr>
      <td>${echap(`${l.a}${l.portA ? ` · ${l.portA}` : ""}`)}</td><td>${echap(`${l.b}${l.portB ? ` · ${l.portB}` : ""}`)}</td>
      <td>${l.media ? echap(MEDIAS[l.media]) : "—"}</td><td>${echap([l.mode, l.vlans && `VLAN ${l.vlans}`].filter(Boolean).join(" · ") || "—")}</td>
      <td>${echap(l.libelle ?? "")}</td></tr>`).join("")}</tbody></table>` : "";

  const d = document.createElement("div");
  d.id = "impression";
  d.innerHTML = `
    <section class="i-page i-plan">
      <header class="i-cartouche">
        <div><div class="i-classif">${echap(CLASSIFICATION)}</div><h1>${echap(titre)}</h1>
          <div class="i-sous">${site ? `Site : ${echap(site)}` : `${sites.length} site${sites.length > 1 ? "s" : ""}`} · ${eqs.length} équipements · ${inv.liaisons.length} liaisons</div></div>
        <dl><dt>Date</dt><dd>${date}</dd><dt>Plan</dt><dd>Topologie réseau 2D</dd><dt>Version</dt><dd>${new Date().toISOString().slice(0, 16).replace("T", " ")}</dd></dl>
      </header>
      <div class="i-svg">${svgPlan.replace(/^(<svg[^>]*?) width="[\d.]+" height="[\d.]+"/, "$1")}</div>
      <footer class="i-legende">
        ${(Object.keys(APPARENCE) as Genre[]).filter((g) => presents.has(g)).map((g) => `<span><i style="background:${APPARENCE[g].couleur}"></i>${echap(GENRES[g].libelle)}</span>`).join("")}
        ${[...medias].map((m) => `<span><i class="t" style="background:${COULEUR_MEDIA[m]}"></i>${echap(MEDIAS[m])}</span>`).join("")}
        <span><i class="t epais"></i>Trunk</span>
      </footer>
    </section>
    ${baies && !baies.includes("b-vide") ? `<section class="i-page i-baies">
      <div class="i-classif">${echap(CLASSIFICATION)} · ${echap(titre)} · ${date}</div>
      <h2 class="i-titre-baies">Baies — vue de face</h2>${baies}
    </section>` : ""}
    <section class="i-page i-tableau">
      <div class="i-classif">${echap(CLASSIFICATION)} · ${echap(titre)} · ${date}</div>
      ${tableau}${tableInter}
    </section>`;
  document.body.append(d);
  // Le plan en noir sur fond sombre gâche l'encre : on le garde tel quel à
  // l'écran mais le cartouche et le tableau sont en clair.
  const fin = () => { d.remove(); window.removeEventListener("afterprint", fin); };
  window.addEventListener("afterprint", fin);
  setTimeout(() => window.print(), 50);
}
