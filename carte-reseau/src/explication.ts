/**
 * Ce que veut dire une ligne de texte, en français courant. Affiché sous
 * l'éditeur pour la ligne où se trouve le curseur : on écrit, l'outil répond
 * « j'ai compris : caméra « CAM-1 », IP …, branchée sur SW-1 port 3 ».
 */
import { MEDIAS, type Equipement, type Genre, type Inventaire, type Liaison } from "./saisie.ts";

const bout = (nom: string, port?: string) => `${nom}${port ? ` port ${port}` : ""}`;

/** Accord : une caméra est « branchée », un switch est « branché ». */
const FEMININ = new Set<Genre>(["camera", "passerelle", "borne", "imprimante"]);
/** Le type, comme on le dit dans une phrase. */
const UN: Record<Genre, string> = {
  passerelle: "une passerelle", parefeu: "un pare-feu", switch: "un switch", camera: "une caméra", nvr: "un enregistreur (NVR)",
  borne: "une borne Wi-Fi", serveur: "un serveur", nas: "un NAS", poste: "un poste", imprimante: "une imprimante",
  telephone: "un téléphone IP", onduleur: "un onduleur", autre: "un équipement",
};
/** Le type au pluriel, en minuscules sauf les sigles. */
const PLURIEL: Record<Genre, string> = {
  passerelle: "passerelles", parefeu: "pare-feu", switch: "switchs", camera: "caméras", nvr: "enregistreurs",
  borne: "bornes Wi-Fi", serveur: "serveurs", nas: "NAS", poste: "postes", imprimante: "imprimantes",
  telephone: "téléphones IP", onduleur: "onduleurs", autre: "équipements",
};

function decrireCable(l: Liaison): string {
  const t = [l.media ? MEDIAS[l.media] : "", l.mode === "trunk" ? `trunk${l.vlans ? ` (VLAN ${l.vlans})` : ""}` : l.vlans ? `VLAN ${l.vlans}` : "", l.libelle ?? ""].filter(Boolean);
  return t.length ? ` — ${t.join(", ")}` : "";
}

/** « 3, 4, 5, 6 » → « 3 à 6 » quand les numéros se suivent. */
function plage(ports: string[]): string {
  const n = ports.map(Number);
  const suivis = n.length > 2 && n.every((x, i) => Number.isInteger(x) && (i === 0 || x === n[i - 1] + 1));
  return suivis ? `${ports[0]} à ${ports[ports.length - 1]}` : ports.join(", ");
}

function emplacement(e: Equipement): string {
  return [e.site && `sur le site « ${e.site} »`, e.point && `lieu « ${e.point} »`, e.baie && `baie ${e.baie}`].filter(Boolean).join(", ");
}

function decrireEquipement(e: Equipement, inv: Inventaire, ligne: number): string {
  const val = (k: string) => e.kv.find(([c]) => c.toLowerCase() === k)?.[1];
  const ports = [val("ports") && `${val("ports")} ports RJ45`, val("sfp") && Number(val("sfp")) > 0 && `${val("sfp")} SFP`, val("wan") && `${val("wan")} WAN`].filter(Boolean).join(" + ");
  const cable = inv.liaisons.find((l) => l.ligne === ligne && (l.a === e.nom || l.b === e.nom));
  const branche = cable ? (cable.a === e.nom ? bout(cable.b, cable.portB) : bout(cable.a, cable.portA)) : "";
  const morceaux = [
    `${UN[e.genre]} « ${e.nom} »`,
    e.ip && `IP ${e.ip}`,
    e.infos[0] && `modèle ${e.infos[0]}`,
    ports,
    emplacement(e),
    branche && `${FEMININ.has(e.genre) ? "branchée" : "branché"} sur ${branche}${cable ? decrireCable(cable) : ""}`,
    val("serie") && `n° de série ${val("serie")}`,
    val("mac") && `MAC ${val("mac")}`,
  ].filter(Boolean);
  return morceaux.join(" · ");
}

/**
 * La ligne n (à partir de 1) expliquée. `compris` : la ligne décrit un
 * équipement ou un câble (l'interface écrit alors « J'ai compris : … »).
 */
export function expliquer(texte: string, n: number, inv: Inventaire): { sens: string; alertes: string[]; compris: boolean } {
  const brut = texte.split("\n")[n - 1] ?? "";
  const l = brut.trim();
  const alertes = inv.alertes.filter((a) => a.ligne === n).map((a) => a.msg);
  const dit = (sens: string, compris = false) => ({ sens, alertes, compris });
  if (!l) return dit("Ligne vide. Écrivez un équipement (ex. : switch SW-1 | ip 10.0.0.2) ou un câble (ex. : câble SW-1 port 24 vers SW-2 port 24).");
  if (/^(#|\/\/)/.test(l)) return dit("Note pour vous : l'outil ne la lit pas.");
  const mot = l.split(/[\s|]/)[0].toLowerCase();
  const nom = () => l.replace(/^\S+\s+/, "").split("|")[0].trim();
  if (mot === "site") return dit(`Début du site « ${nom()} » : les lignes suivantes y sont rangées.`);
  if (/^(point|lieu|batiment|bâtiment)$/.test(mot)) return dit(`Début du lieu « ${nom()} », dans le site en cours : les lignes suivantes y sont rangées.`);
  if (mot === "baie" || mot === "rack") return dit(`Début de la baie « ${nom()} » : les lignes en retrait juste en dessous sont dedans.`);
  const eqs = inv.equipements.filter((e) => e.ligne === n);
  if (eqs.length === 1) return dit(decrireEquipement(eqs[0], inv, n), true);
  if (eqs.length > 1) {
    const g = eqs[0].genre;
    const ips = eqs.map((e) => e.ip).filter(Boolean);
    const liens = inv.liaisons.filter((x) => x.ligne === n);
    const ports = liens.map((x) => (eqs.some((e) => e.nom === x.a) ? x.portB : x.portA)).filter((p): p is string => !!p);
    const vers = liens[0] ? (eqs.some((e) => e.nom === liens[0].a) ? liens[0].b : liens[0].a) : "";
    const noms = eqs.length > 4 ? `${eqs[0].nom} à ${eqs[eqs.length - 1].nom}` : eqs.map((e) => e.nom).join(", ");
    return dit(`${eqs.length} ${PLURIEL[g]} : ${noms}`
      + (ips.length > 1 ? ` · IP ${ips[0]} à ${ips[ips.length - 1]}` : ips.length ? ` · IP ${ips[0]}` : "")
      + (emplacement(eqs[0]) ? ` · ${emplacement(eqs[0])}` : "")
      + (vers ? ` · ${FEMININ.has(g) ? "branchées" : "branchés"} sur ${vers}${ports.length ? `, ${ports.length > 1 ? "ports" : "port"} ${plage(ports)}` : ""}` : ""), true);
  }
  const cables = inv.liaisons.filter((x) => x.ligne === n);
  if (cables.length) return dit(cables.map((c) => `un câble de ${bout(c.a, c.portA)} vers ${bout(c.b, c.portB)}${decrireCable(c)}`).join(" ; "), true);
  // Un câble dont un bout n'existe pas (faute de frappe, équipement pas encore écrit).
  if (/->|→|=>|<-|\bvers\b/i.test(l) || /^c[aâ]ble\b/i.test(l)) return dit(alertes.length ? "Câble non créé :" : "Câble pas encore complet : il faut un équipement à chaque bout.");
  return dit(alertes.length ? "Ligne pas comprise :" : "");
}
