/**
 * Ce que veut dire une ligne de texte, en français courant. Affiché sous
 * l'éditeur pour la ligne où se trouve le curseur : on écrit, l'outil répond
 * « j'ai compris : une caméra CAM-1, IP …, branchée sur SW-1 port 3 ».
 */
import { GENRES, MEDIAS, type Equipement, type Inventaire, type Liaison } from "./saisie.ts";

const bout = (nom: string, port?: string) => `${nom}${port ? ` port ${port}` : ""}`;

function decrireCable(l: Liaison): string {
  const t = [l.media ? MEDIAS[l.media].toLowerCase() : "", l.mode === "trunk" ? `trunk${l.vlans ? ` (VLAN ${l.vlans})` : ""}` : l.vlans ? `VLAN ${l.vlans}` : "", l.libelle ?? ""].filter(Boolean);
  return t.length ? ` — ${t.join(", ")}` : "";
}

function decrireEquipement(e: Equipement, inv: Inventaire, ligne: number): string {
  const val = (k: string) => e.kv.find(([c]) => c.toLowerCase() === k)?.[1];
  const ou = [e.site && `site « ${e.site} »`, e.point && `lieu « ${e.point} »`, e.baie && `baie ${e.baie}`].filter(Boolean).join(", ");
  const ports = [val("ports") && `${val("ports")} ports RJ45`, val("sfp") && Number(val("sfp")) > 0 && `${val("sfp")} SFP`, val("wan") && `${val("wan")} WAN`].filter(Boolean).join(" + ");
  const cable = inv.liaisons.find((l) => l.ligne === ligne && (l.a === e.nom || l.b === e.nom));
  const branche = cable ? (cable.a === e.nom ? bout(cable.b, cable.portB) : bout(cable.a, cable.portA)) : "";
  const morceaux = [
    `${GENRES[e.genre].libelle} « ${e.nom} »`,
    e.ip && `IP ${e.ip}`,
    e.infos[0] && `modèle ${e.infos[0]}`,
    ports,
    ou && `dans ${ou}`,
    branche && `branché sur ${branche}${cable ? decrireCable(cable) : ""}`,
    val("serie") && `n° de série ${val("serie")}`,
    val("mac") && `MAC ${val("mac")}`,
  ].filter(Boolean);
  return morceaux.join(" · ");
}

/** La ligne n (à partir de 1) expliquée ; "" si elle est vide. */
export function expliquer(texte: string, n: number, inv: Inventaire): { sens: string; alertes: string[] } {
  const brut = texte.split("\n")[n - 1] ?? "";
  const l = brut.trim();
  const alertes = inv.alertes.filter((a) => a.ligne === n).map((a) => a.msg);
  if (!l) return { sens: "Ligne vide. Écrivez un équipement (ex. : switch SW-1 | ip 10.0.0.2) ou un câble (ex. : câble SW-1 port 24 vers SW-2 port 24).", alertes };
  if (/^(#|\/\/)/.test(l)) return { sens: "Commentaire : une note pour vous, l'outil l'ignore.", alertes };
  const mot = l.split(/[\s|]/)[0].toLowerCase();
  if (mot === "site") return { sens: `Ouvre le site « ${l.slice(4).split("|")[0].trim()} » : les lignes suivantes y sont rangées.`, alertes };
  if (/^(point|lieu|batiment|bâtiment)$/.test(mot)) return { sens: `Ouvre le lieu « ${l.replace(/^\S+\s+/, "").split("|")[0].trim()} » dans le site en cours : les lignes suivantes y sont rangées.`, alertes };
  if (mot === "baie" || mot === "rack") return { sens: `Ouvre la baie « ${l.replace(/^\S+\s+/, "").split("|")[0].trim()} » : les lignes en retrait juste en dessous sont dedans.`, alertes };
  const eqs = inv.equipements.filter((e) => e.ligne === n);
  if (eqs.length === 1) return { sens: decrireEquipement(eqs[0], inv, n), alertes };
  if (eqs.length > 1) {
    const g = GENRES[eqs[0].genre].libelle.toLowerCase();
    const ips = eqs.map((e) => e.ip).filter(Boolean);
    const liens = inv.liaisons.filter((x) => x.ligne === n);
    const ports = liens.map((x) => (eqs.some((e) => e.nom === x.a) ? x.portB : x.portA)).filter(Boolean);
    const vers = liens[0] ? (eqs.some((e) => e.nom === liens[0].a) ? liens[0].b : liens[0].a) : "";
    return {
      sens: `${eqs.length} × ${g} : ${eqs.map((e) => e.nom).join(", ")}`
        + (ips.length ? ` · IP ${ips[0]} → ${ips[ips.length - 1]}` : "")
        + (vers ? ` · branchés sur ${vers}${ports.length ? ` ports ${ports.join(", ")}` : ""}` : ""),
      alertes,
    };
  }
  const cables = inv.liaisons.filter((x) => x.ligne === n);
  if (cables.length) return { sens: cables.map((c) => `Câble de ${bout(c.a, c.portA)} vers ${bout(c.b, c.portB)}${decrireCable(c)}`).join(" ; "), alertes };
  return { sens: alertes.length ? "Je ne comprends pas encore cette ligne :" : "", alertes };
}
