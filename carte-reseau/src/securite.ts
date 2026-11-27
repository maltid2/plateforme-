/**
 * Préconisations sécurité pour un réseau vidéo ISOLÉ (aucun accès à Internet)
 * et SANS ACL : la séparation repose uniquement sur des VLAN bien configurés.
 *
 * Les mesures sont rangées en trois classes :
 *   1 · Indispensable — le basique. Aucun effet sur le dépannage, ou il le
 *       rend plus rapide. À avoir partout.
 *   2 · Recommandé — un peu de travail en plus en maintenance, gain net.
 *   3 · Renforcé — plus de sécurité, mais chaque dépannage prend plus de
 *       temps : à décider au cas par cas (zones accessibles au public…).
 * Chaque mesure dit POURQUOI la mettre, ce qu'elle COÛTE en dépannage et en
 * maintenance, et son état sur le réseau de la carte (fait, à faire, à
 * vérifier sur place), avec les équipements concernés et les commandes.
 *
 * À part : les pannes trouvées (caméras hors ligne, liens en erreur…), qui
 * relèvent du dépannage plutôt que de la sécurité.
 */
import { lireMasque, type Equipement, type Genre, type Inventaire } from "./saisie.ts";
import { comparerGenetec, type Comparaison, type Genetec, type Rapprochement } from "./genetec.ts";
import {
  accesVlan, controlerLien, controlerPort, desactiverPorts, emplacement, macDuPort, marqueDe, relancerPoe,
  renommer, trunkAutorises, verrouillageMac, vlanNatif, type Marque,
} from "./commandes.ts";

export type Commande = { libelle: string; lignes: string[] };
export type Etat = "a-faire" | "a-verifier" | "ok";
export type Impact = "plus-rapide" | "aucun" | "faible" | "moyen" | "fort";
/** Ce qu'il faut faire à un endroit précis. `cible` : un équipement de la carte, ou "" pour tout le réseau. */
export type Element = { cible: string; texte: string; commandes: Commande[] };
export type Mesure = {
  id: string;
  classe: 1 | 2 | 3;
  titre: string;
  /** Pourquoi, en une phrase que tout le monde comprend. */
  pourquoi: string;
  /** Ce que la mesure coûte (ou fait gagner) en dépannage et en maintenance. */
  impact: Impact;
  impactTexte: string;
  etat: Etat;
  /** Ce qui a été constaté sur la carte. */
  constat: string;
  elements: Element[];
};
export type Panne = { cible: string; critique: boolean; titre: string; detail: string; commandes: Commande[] };
export type Version = { modele: string; version: string; equipements: string[]; remarque: string };
export type Bilan = {
  mesures: Mesure[];
  pannes: Panne[];
  /** À corriger en premier : quelques phrases courtes. */
  premiers: string[];
  zones: { groupe: string; vlans: string; reseaux: string; nombre: number }[];
  versions: Version[];
  genetec: Comparaison; sourcesGenetec: Genetec["sources"];
  /** Des relevés de switchs ont-ils été importés ? (sinon beaucoup de points restent « à vérifier ») */
  releve: boolean;
};

export const CLASSES: Record<Mesure["classe"], { nom: string; texte: string }> = {
  1: { nom: "Indispensable", texte: "Le basique, à avoir partout. Ne ralentit pas le dépannage, souvent l'accélère." },
  2: { nom: "Recommandé", texte: "Un peu de travail en plus en maintenance, pour un vrai gain." },
  3: { nom: "Renforcé — à décider", texte: "Plus de sécurité, mais chaque dépannage prend plus de temps. Au cas par cas." },
};

const val = (e: Equipement, k: string) => e.kv.find(([c]) => c.toLowerCase() === k)?.[1];
const pl = (n: number, mot: string, pluriel = `${mot}s`) => `${n} ${n > 1 ? pluriel : mot}`;
const ports = (v?: string) => (!v || /^\d+$/.test(v) ? [] : v.split(",").map((x) => x.replace(/…$/, "").trim()).filter(Boolean));
const compteDe = (v?: string) => (!v ? 0 : /^\d+$/.test(v) ? Number(v) : ports(v).length);
const simple = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** « Gi1/0/2 : texte » → « Gi1/0/2 ». */
const portDe = (t: string) => t.match(/^([A-Za-z-]{0,12}\d[\d/.]*)\s*:/)?.[1];
const sansPuce = (t: string) => t.replace(/^[⛔⚠]\s*/, "");

function reseau(e: Equipement): string | null {
  if (!e.ip) return null;
  const [ip, suffixe] = e.ip.split("/");
  const o = ip.split(".").map(Number);
  if (o.length !== 4 || o.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return null;
  const bits = (suffixe ? Number(suffixe) : null) ?? (val(e, "masque") ? lireMasque(val(e, "masque")!) : null) ?? 24;
  const n = ((o[0] << 24) >>> 0) + (o[1] << 16) + (o[2] << 8) + o[3];
  const m = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  const r = (n & m) >>> 0;
  return `${r >>> 24}.${(r >> 16) & 255}.${(r >> 8) & 255}.${r & 255}/${bits}`;
}
function compareVersions(a: string, b: string) {
  const x = a.split(/[^0-9]+/).filter(Boolean).map(Number), y = b.split(/[^0-9]+/).filter(Boolean).map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] ?? 0) - (y[i] ?? 0); if (d) return d; }
  return 0;
}
/** « 1,10,20-30 » → l'ensemble des numéros de VLAN. */
function vlans(t?: string): Set<string> {
  const s = new Set<string>();
  (t ?? "").split(/[,\s]+/).filter(Boolean).forEach((p) => {
    const m = p.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) return;
    const a = Number(m[1]), b = Math.min(Number(m[2] ?? m[1]), 4094);
    for (let i = a; i <= b; i++) s.add(String(i));
  });
  return s;
}

/** Nom laissé par défaut ou générique : « Switch », « HP-2530-24G », « Aruba-6200F », une IP, « SW1 »… */
export function nomParDefaut(nom: string): boolean {
  const n = nom.trim();
  return /^(switch|sw|hp|hpe|aruba|cisco|procurve|netgear|planet|comnet|d-?link|tp-?link|zyxel|core|coeur|access|acces|default|new)[-_ ]?\d*([-_ ]\d+)?$/i.test(n)
    || /^(\d{1,3}[-_.]){3}\d{1,3}$/.test(n)
    || /^(hp|hpe|aruba|cisco|procurve)?[-_ ]?(2530|2540|2920|2930[FM]?|3810|5400|6[0-4]00[FM]?|C9[23]\d\d|WS-C\w+|JL\d{3}A|J\d{4}A)/i.test(n);
}
/** Le nom contient-il l'emplacement (un mot de son local ou de sa baie) ? */
function nomAvecEmplacement(e: Equipement): boolean {
  const mots = (e.point || "").split(/[^A-Za-z0-9À-ÿ+]+/)
    .map(simple).filter((w) => w.length >= 2 && !/^(local|site|baie|batiment|bat|niveau|etage|salle|zone|de|du|la|le|les)$/.test(w));
  const n = simple(e.nom).replace(/[^a-z0-9+]/g, "");
  // « SW-BAT-A » pour « Bâtiment A - local R+0 » : le code du lieu (BATA) suffit.
  if (e.point && codeLieu(e.point).split("-").some((c) => c.length >= 3 && n.includes(c.toLowerCase()))) return true;
  return mots.some((w) => n.includes(w.replace(/\+/g, "")) || (w.length >= 5 && n.includes(w.slice(0, 4))));
}
/** Un code court pour un lieu : « Bâtiment A - local R+0 » → « BATA-R0 ». */
export function codeLieu(t: string): string {
  const mots = simple(t).replace(/batiment|bat\./g, "bat").split(/[^a-z0-9+]+/)
    .filter((w) => w && !/^(de|du|des|la|le|les|l|d|et|local|salle|baie|site)$/.test(w));
  const parties = mots.map((w) => (/^\d/.test(w) || w.length <= 3 ? w : w.slice(0, 4)).replace(/\+/g, "").toUpperCase());
  // On colle les petits morceaux (« BAT » + « A ») et on sépare les autres par des tirets.
  const out: string[] = [];
  parties.forEach((p) => { if (out.length && (p.length === 1 || out[out.length - 1].length <= 3)) out[out.length - 1] += p; else out.push(p); });
  return out.join("-").slice(0, 14) || "SITE";
}

const RESEAU: Genre[] = ["switch", "passerelle", "parefeu", "borne"];
const VIDEO_SRV: Genre[] = ["nvr", "serveur", "nas"];
const FINAUX: Genre[] = ["camera", "poste", "imprimante", "telephone"];
const EST_BOUCLE = /boucle|MAC .*sur \d+ ports|flapp|change sans cesse de port|STP|chefs? d.orchestre|racine/i;
const EST_VLAN = /natif|m[êe]mes r[ée]seaux|mode diff|mal configur/i;
const EST_IP = /m[êe]me adresse IP|IP .* port[ée]e par/i;

/** Agrégation entre deux switchs : les commandes de vérification. */
function verifierAgregation(m: Marque): string[] | null {
  if (m === "cisco") return ["show etherchannel summary", "show spanning-tree blockedports"];
  if (m === "arubacx") return ["show lacp aggregates", "show spanning-tree"];
  if (m === "hp") return ["show trunks", "show spanning-tree"];
  return null;
}

export function analyserSecurite(inv: Inventaire, genetec?: Genetec | null): Bilan {
  const eq = inv.equipements;
  const parNom = new Map(eq.map((e) => [e.nom, e]));
  const de = (g: Genre[]) => eq.filter((e) => g.includes(e.genre));
  const voisin = (e: Equipement) => /voisin/i.test(val(e, "source") ?? "");
  const cameras = de(["camera"]), switchs = de(["switch"]).filter((s) => !voisin(s)), serveurs = de(VIDEO_SRV);
  const releve = switchs.some((s) => val(s, "ports-relevés") || val(s, "firmware") || val(s, "releve-date"));
  const cg = comparerGenetec(inv, genetec);
  const mq = (nom: string): Marque => { const e = parNom.get(nom); return e ? marqueDe(e) : "autre"; };
  const cmd = (libelle: string, lignes: string[] | null): Commande[] => (lignes?.length ? [{ libelle, lignes }] : []);
  const web = (nom: string) => (mq(nom) === "autre" ? " (à faire dans l'interface web du switch)" : "");
  const autreBout = (l: Inventaire["liaisons"][number], nom: string) => parNom.get(l.a === nom ? l.b : l.a);
  const liensDe = (nom: string) => inv.liaisons.filter((l) => l.a === nom || l.b === nom);
  const lienReseau = (e: Equipement) => liensDe(e.nom).find((l) => RESEAU.includes(autreBout(l, e.nom)?.genre ?? "autre"));
  const vlanDe = (e: Equipement): string | undefined => {
    // Un seul VLAN : « 1,20 » (un trunk) ne dit pas dans quel VLAN est l'équipement.
    const un = (v?: string) => (v && /^\d+$/.test(v.trim()) ? v.trim() : undefined);
    const l = lienReseau(e);
    return un(val(e, "vlan")) ?? (l && l.mode !== "trunk" ? un(l.vlans) : undefined);
  };
  const brancheSur = (e: Equipement) => { const l = lienReseau(e); return l ? (l.a === e.nom ? { sw: l.b, port: l.portB } : { sw: l.a, port: l.portA }) : null; };
  const enFace = (sw: string, port: string) => {
    const l = inv.liaisons.find((x) => (x.a === sw && x.portA === port) || (x.b === sw && x.portB === port));
    return l ? (l.a === sw ? `${l.b}${l.portB ? ` port ${l.portB}` : ""}` : `${l.a}${l.portA ? ` port ${l.portA}` : ""}`) : null;
  };
  const anomalies = (s: Equipement) => (val(s, "anomalies") ?? "").split(" — ").slice(1).join(" — ").split(" · ").map((x) => x.trim()).filter(Boolean);
  /** Les anomalies des relevés qui passent le filtre, une seule fois chacune (certaines concernent plusieurs switchs). */
  const anomaliesDe = (garder: (t: string) => boolean) => {
    const vues = new Map<string, { switchs: string[]; texte: string; critique: boolean; port?: string }>();
    switchs.forEach((s) => anomalies(s).filter(garder).forEach((x) => {
      const t = sansPuce(x), a = vues.get(t);
      if (a) a.switchs.push(s.nom); else vues.set(t, { switchs: [s.nom], texte: t, critique: x.startsWith("⛔"), port: portDe(t) });
    }));
    return [...vues.values()].map((a) => ({ ...a, cible: a.switchs.length === 1 ? a.switchs[0] : "", texte: a.switchs.length === 1 ? a.texte : `${a.switchs.join(", ")} : ${a.texte}` }));
  };
  const comptes = new Map<string, number>();
  cameras.forEach((c) => { const v = vlanDe(c); if (v && v !== "1") comptes.set(v, (comptes.get(v) ?? 0) + 1); });
  const vlanVideo = [...comptes].sort((a, b) => b[1] - a[1])[0]?.[0];

  const mesures: Mesure[] = [];
  /** `sansReleve` : ce que la carte seule ne permet pas de voir. */
  const mesure = (m: Omit<Mesure, "etat" | "constat"> & { etat?: Etat; constat?: string; sansReleve?: string }) => {
    const { sansReleve, ...x } = m;
    const etat = x.etat ?? (x.elements.length ? "a-faire" : sansReleve && !releve ? "a-verifier" : "ok");
    const constat = x.constat ?? (etat === "a-faire" ? `${pl(x.elements.length, "point")} à traiter.` : etat === "a-verifier" ? sansReleve ?? "À contrôler sur place." : "Rien à signaler sur la carte.");
    mesures.push({ ...x, etat, constat });
  };
  const RELEVE = "Se voit avec un relevé des switchs (« Relever les switchs.bat ») : à importer.";

  /* ======================= CLASSE 1 · INDISPENSABLE ======================= */

  // Noms des switchs : clairs, avec l'emplacement.
  const numeros = new Map<string, number>();
  const elNoms: Element[] = [];
  switchs.forEach((s) => {
    // Le lieu, c'est le local ou la baie (« point ») ; le site seul ne dit pas où aller.
    const lieu = s.point || s.site;
    const defaut = nomParDefaut(s.nom);
    if (!defaut && (!s.point || nomAvecEmplacement(s))) {
      if (!s.point) elNoms.push({ cible: s.nom, texte: "on ne sait pas dans quel local il est : le noter sur la carte (champ « Où ») et dans le switch", commandes: cmd("Écrire l'emplacement dans le switch", emplacement(mq(s.nom), "<bâtiment - local - baie>")) });
      return;
    }
    const k = codeLieu(s.point || "SITE");
    const n = (numeros.get(k) ?? 0) + 1; numeros.set(k, n);
    const propose = `SW-${k}-${String(n).padStart(2, "0")}`;
    elNoms.push({ cible: s.nom, texte: `${defaut ? "nom par défaut" : `le nom ne dit pas où il est (${s.point})`} → proposé : ${propose}${web(s.nom)}`,
      commandes: [...cmd(`Renommer en ${propose}`, renommer(mq(s.nom), propose)), ...(lieu ? cmd("Écrire l'emplacement", emplacement(mq(s.nom), lieu)) : [])] });
  });
  anomaliesDe((t) => /m[êe]me nom|nomm[ée]s /i.test(t)).forEach((a) => elNoms.push({ cible: a.cible, texte: a.texte, commandes: [] }));
  mesure({ id: "noms", classe: 1, titre: "Chaque switch a un nom qui dit où il est",
    pourquoi: "En panne, on sait tout de suite dans quel bâtiment et quelle baie aller. Convention proposée : SW-<lieu>-<numéro>, par exemple SW-BATA-R0-01.",
    impact: "plus-rapide", impactTexte: "Fait gagner du temps à chaque intervention.",
    constat: elNoms.length ? `${pl(elNoms.length, "switch", "switchs")} à renommer ou à situer.` : undefined, elements: elNoms });

  // Pas de boucle réseau.
  const elBoucles: Element[] = [];
  anomaliesDe((t) => EST_BOUCLE.test(t)).forEach((a) => elBoucles.push({ cible: a.cible, texte: a.texte,
    commandes: a.cible && a.port ? cmd(`Voir ce qui est branché sur ${a.port}`, macDuPort(mq(a.cible), a.port)) : [] }));
  // Boucle physique : des switchs reliés en cercle (sans danger seulement si le STP coupe un chemin).
  const chef = new Map<string, string>();
  const racine = (x: string): string => { const p = chef.get(x) ?? x; if (p === x) return x; const r = racine(p); chef.set(x, r); return r; };
  const cables = new Map<string, number>();
  const fermetures: string[] = [];
  inv.liaisons.forEach((l) => {
    if (parNom.get(l.a)?.genre !== "switch" || parNom.get(l.b)?.genre !== "switch") return;
    const k = [l.a, l.b].sort().join(" ↔ ");
    cables.set(k, (cables.get(k) ?? 0) + 1);
    if (cables.get(k)! > 1) return;   // plusieurs câbles entre deux switchs : traité juste après
    const ra = racine(l.a), rb = racine(l.b);
    if (ra === rb) fermetures.push(k); else chef.set(ra, rb);
  });
  if (fermetures.length) elBoucles.push({ cible: "", texte: `les switchs forment un anneau (fermé par ${fermetures.join(", ")}) : vérifier que la protection anti-boucle (STP) est active sur tous, elle doit couper un des chemins`,
    commandes: cmd("Sur chaque switch de l'anneau", verifierAgregation(mq(fermetures[0].split(" ↔ ")[0]))) });
  [...cables].filter(([, n]) => n > 1).forEach(([k, n]) => {
    const [a, b] = k.split(" ↔ ");
    // Le relevé a vu une agrégation (Port-channel, LAG) entre eux : c'est voulu.
    const agrege = [a, b].some((x) => parNom.get(x) && anomalies(parNom.get(x)!).some((t) => /agr[ée]g|\b(po|lag|trk)\d/i.test(t)));
    if (!agrege) elBoucles.push({ cible: a, texte: `${n} câbles entre ${k} : vérifier qu'ils sont agrégés (LACP), sinon c'est une boucle`, commandes: cmd("Vérifier l'agrégation", verifierAgregation(mq(a))) });
  });
  mesure({ id: "boucles", classe: 1, titre: "Pas de boucle réseau",
    pourquoi: "Une boucle fait tourner les trames sans fin : le réseau sature et toutes les caméras tombent en même temps, souvent après un simple câble branché au mauvais endroit.",
    impact: "plus-rapide", impactTexte: "Évite la panne la plus longue à trouver.",
    constat: elBoucles.length ? undefined : releve ? "Aucune boucle vue dans les relevés." : undefined, sansReleve: RELEVE, elements: elBoucles });

  // Une IP = un seul équipement.
  const ips = new Map<string, string[]>();
  eq.forEach((e) => { const ip = e.ip?.split("/")[0]; if (ip) ips.set(ip, [...(ips.get(ip) ?? []), e.nom]); });
  const elIp: Element[] = [...ips].filter(([, n]) => n.length > 1).map(([ip, n]) => ({ cible: n[0], texte: `${ip} est utilisée par ${n.join(" et ")}`, commandes: [] }));
  cg.doublonsIp.forEach((d) => elIp.push({ cible: "", texte: `${d.ip} est utilisée par ${d.noms.join(" et ")} dans Genetec`, commandes: [] }));
  anomaliesDe((t) => EST_IP.test(t)).forEach((a) => elIp.push({ cible: a.cible, texte: a.texte, commandes: [] }));
  mesure({ id: "ip", classe: 1, titre: "Une adresse IP pour un seul équipement",
    pourquoi: "Deux équipements avec la même IP se coupent l'un l'autre : la caméra « disparaît » par moments, et c'est long à comprendre.",
    impact: "plus-rapide", impactTexte: "Supprime des pannes intermittentes.", elements: elIp });

  // Des IP fixes.
  const elFixes: Element[] = cg.ecartsIp.map((r) => ({ cible: r.eq!.nom, texte: `${r.eq!.ip} sur le réseau, ${r.unite.ip} dans Genetec : l'IP a changé (DHCP ?). Lui donner une IP fixe et corriger Genetec.`, commandes: [] }));
  mesure({ id: "ip-fixes", classe: 1, titre: "Des IP fixes pour les caméras et les serveurs",
    pourquoi: "Une caméra dont l'IP change est perdue par Genetec : plus d'image, plus d'enregistrement.",
    impact: "plus-rapide", impactTexte: "Une caméra garde toujours la même adresse : on la retrouve.",
    etat: elFixes.length ? "a-faire" : cg.actif ? "ok" : "a-verifier",
    constat: elFixes.length ? undefined : cg.actif ? "Les IP du réseau et de Genetec concordent." : "Se voit avec un export Genetec : « Comparer avec un export Genetec ».", elements: elFixes });

  // Chaque usage dans son VLAN : sans ACL, c'est la seule séparation.
  const elVlan: Element[] = [];
  const vlansCam = new Set(cameras.map(vlanDe).filter((v): v is string => !!v));
  if (cameras.length && !vlansCam.size) elVlan.push({ cible: "", texte: `aucun VLAN connu pour les ${pl(cameras.length, "caméra")} : créer un VLAN vidéo dédié (ou le noter sur la carte s'il existe)`, commandes: [] });
  eq.filter((e) => !["camera", ...RESEAU, ...VIDEO_SRV].includes(e.genre) && vlansCam.has(vlanDe(e) ?? "§")).forEach((e) => {
    const b = brancheSur(e);
    elVlan.push({ cible: e.nom, texte: `${e.genre} dans le VLAN des caméras (${vlanDe(e)})${b ? `, sur ${b.sw} port ${b.port ?? "?"}` : ""} : à déplacer`, commandes: [] });
  });
  const resUtil = new Set(eq.filter((e) => FINAUX.includes(e.genre)).map(reseau).filter((r): r is string => !!r));
  const adminMelange = switchs.filter((s) => resUtil.has(reseau(s) ?? "§"));
  if (adminMelange.length) elVlan.push({ cible: adminMelange.length === 1 ? adminMelange[0].nom : "", texte: `l'administration de ${adminMelange.map((s) => s.nom).join(", ")} est dans le même réseau que des caméras ou des postes : la mettre dans un VLAN d'administration`, commandes: [] });
  switchs.forEach((s) => {
    const decl = eq.filter((e) => !RESEAU.includes(e.genre) && vlanDe(e) === "1" && brancheSur(e)?.sw === s.nom);
    const p1 = [...new Set([...ports(val(s, "acces-vlan1")), ...decl.map((e) => brancheSur(e)!.port).filter((p): p is string => !!p)])];
    if (!p1.length) return;
    const cible = vlanVideo && (!decl.length || decl.every((e) => e.genre === "camera")) ? vlanVideo : "<vlan>";
    elVlan.push({ cible: s.nom, texte: `${pl(p1.length, "port")} dans le VLAN 1 (celui de tout port non configuré) : ${p1.join(", ")}${web(s.nom)}`, commandes: cmd(`Passer dans le VLAN ${cible}`, accesVlan(mq(s.nom), p1, cible)) });
  });
  mesure({ id: "vlan-usage", classe: 1, titre: "Chaque usage dans son VLAN : caméras, serveurs, administration",
    pourquoi: "Sans ACL, le VLAN est la seule barrière : un PC branché dans le VLAN des caméras les voit toutes. Le VLAN 1 est celui où tombe tout port oublié.",
    impact: "aucun", impactTexte: "Aucun, tant que le plan des VLAN est tenu à jour (voir plus bas).", elements: elVlan });

  // Les mêmes VLAN aux deux bouts (« deux VLAN différents »).
  const elCoherence: Element[] = [];
  anomaliesDe((t) => EST_VLAN.test(t) && !EST_BOUCLE.test(t)).forEach((a) => {
    const face = a.cible && a.port ? enFace(a.cible, a.port) : null;
    elCoherence.push({ cible: a.cible, texte: `${a.texte}${face ? ` (autre bout : ${face})` : ""}`, commandes: a.cible && a.port ? cmd(`Comparer les deux bouts de ${a.port}`, controlerLien(mq(a.cible), a.port)) : [] });
  });
  switchs.forEach((s) => {
    const vCams = new Set(cameras.filter((c) => brancheSur(c)?.sw === s.nom).map(vlanDe).filter((v): v is string => !!v && v !== "1"));
    const montants = liensDe(s.nom).filter((l) => l.mode === "trunk" && l.vlans && autreBout(l, s.nom)?.genre === "switch");
    if (!vCams.size || !montants.length) return;
    const passent = new Set(montants.flatMap((l) => [...vlans(l.vlans)]));
    const manquants = [...vCams].filter((v) => !passent.has(v));
    if (manquants.length) elCoherence.push({ cible: s.nom, texte: `ses caméras sont en VLAN ${manquants.join(", ")}, mais ce VLAN ne passe pas par ses liens vers les autres switchs (autorisés : ${[...new Set(montants.map((l) => l.vlans))].join(" / ")}) : les images n'arrivent pas à l'archiveur`, commandes: [] });
  });
  if (comptes.size > 1) {
    const autres = cameras.filter((c) => { const v = vlanDe(c); return v && v !== vlanVideo && v !== "1"; });
    elCoherence.push({ cible: "", texte: `les caméras sont dans ${comptes.size} VLAN différents (${[...comptes].map(([v, n]) => `VLAN ${v} : ${n}`).join(", ")}). Si ce n'est pas voulu (un VLAN par site, par exemple), passer ${autres.slice(0, 6).map((c) => c.nom).join(", ")}${autres.length > 6 ? "…" : ""} dans le VLAN ${vlanVideo}`, commandes: [] });
  }
  inv.liaisons.filter((l) => l.mode === "trunk").forEach((l) => {
    const [sw, autre, port] = parNom.get(l.a)?.genre === "switch" ? [parNom.get(l.a), parNom.get(l.b), l.portA] : [parNom.get(l.b), parNom.get(l.a), l.portB];
    if (!sw || sw.genre !== "switch" || !autre || !FINAUX.includes(autre.genre) || !port) return;
    const v = vlanDe(autre) ?? (autre.genre === "camera" ? vlanVideo : undefined) ?? "<vlan>";
    elCoherence.push({ cible: sw.nom, texte: `port ${port} en trunk vers ${autre.nom} : un équipement final n'a besoin que d'un VLAN`, commandes: cmd("Passer en port d'accès", accesVlan(mq(sw.nom), [port], v)) });
  });
  mesure({ id: "vlan-coherence", classe: 1, titre: "Les mêmes VLAN aux deux bouts de chaque lien",
    pourquoi: "Un lien qui n'a pas les mêmes VLAN des deux côtés empêche des caméras d'atteindre l'archiveur, ou mélange deux VLAN sans qu'on le voie.",
    impact: "plus-rapide", impactTexte: "Évite les « caméras qui ne remontent plus » après une intervention.",
    constat: elCoherence.length ? undefined : releve ? "VLAN cohérents dans les relevés." : undefined, sansReleve: RELEVE, elements: elCoherence });

  // Comptes et mots de passe : sur place.
  mesure({ id: "comptes", classe: 1, titre: "Mots de passe d'usine changés, un compte par intervenant",
    pourquoi: "Les mots de passe d'usine des caméras et des switchs se trouvent dans leur notice : n'importe qui branché sur le réseau peut les modifier.",
    impact: "aucun", impactTexte: "Aucun, si les mots de passe sont rangés dans le coffre de l'équipe.",
    etat: "a-verifier", constat: "Ne se voit pas sur la carte : à contrôler sur les switchs, les caméras et Genetec.", elements: [] });

  // Tout relevé, carte et sauvegardes à jour.
  const elAJour: Element[] = [];
  eq.filter((e) => voisin(e) && RESEAU.includes(e.genre)).forEach((e) => {
    const l = liensDe(e.nom)[0];
    const ou = l ? (l.a === e.nom ? `${l.b} port ${l.portB ?? "?"}` : `${l.a} port ${l.portA ?? "?"}`) : "";
    elAJour.push({ cible: e.nom, texte: `vu${ou ? ` sur ${ou}` : ""} mais pas relevé : ajouter son IP dans switchs.txt`, commandes: [] });
  });
  switchs.filter((s) => /non relev|marque|partiel|cl[ée] d.h[ôo]te|[ée]chec/i.test(val(s, "releve") ?? "")).forEach((s) =>
    elAJour.push({ cible: s.nom, texte: `relevé incomplet : ${val(s, "releve")}`, commandes: [] }));
  const dates = switchs.map((s) => val(s, "releve-date")).filter((d): d is string => !!d).sort();
  if (dates.length) {
    const jours = Math.floor((Date.now() - new Date(dates[0]).getTime()) / 864e5);
    if (jours > 90) elAJour.push({ cible: "", texte: `le plus ancien relevé date de ${jours} jours : le refaire`, commandes: [] });
  }
  mesure({ id: "a-jour", classe: 1, titre: "Tous les switchs relevés, carte et sauvegardes à jour",
    pourquoi: "Ce qui n'est pas relevé n'est ni contrôlé ni sauvegardé : en cas de panne, on repart de zéro.",
    impact: "plus-rapide", impactTexte: "Une carte juste et une configuration sauvegardée raccourcissent chaque intervention.",
    constat: elAJour.length ? undefined : releve ? "Tous les switchs de la carte sont relevés." : undefined, sansReleve: RELEVE, elements: elAJour });

  /* ======================= CLASSE 2 · RECOMMANDÉ ======================= */

  let nLibres = 0;
  const elLibres: Element[] = switchs.filter((s) => compteDe(val(s, "ports-libres-actifs"))).map((s) => {
    const p = ports(val(s, "ports-libres-actifs")), n = compteDe(val(s, "ports-libres-actifs"));
    nLibres += n;
    return { cible: s.nom, texte: p.length ? `${p.join(", ")}${web(s.nom)}` : `${pl(n, "port")} (relancer le relevé pour avoir la liste)`, commandes: cmd("Désactiver", desactiverPorts(mq(s.nom), p)) };
  });
  mesure({ id: "ports-libres", classe: 2, titre: "Désactiver les ports qui ne servent pas",
    pourquoi: "Un port actif dans une baie, c'est une prise où n'importe qui peut brancher un PC sur le réseau des caméras.",
    impact: "faible", impactTexte: "Faible : pour ajouter une caméra, réactiver le port (une commande).",
    constat: elLibres.length ? `${pl(nLibres, "port libre", "ports libres")} encore ${nLibres > 1 ? "actifs" : "actif"} sur ${pl(elLibres.length, "switch", "switchs")}.` : undefined, sansReleve: RELEVE, elements: elLibres });

  const elNatif: Element[] = switchs.filter((s) => ports(val(s, "trunk-natif-vlan1")).length).map((s) => {
    const p = ports(val(s, "trunk-natif-vlan1"));
    const faces = p.map((x) => enFace(s.nom, x)).filter(Boolean);
    return { cible: s.nom, texte: `${p.join(", ")}${faces.length ? ` — à faire en même temps en face : ${faces.join(", ")}` : ""}${web(s.nom)}`, commandes: cmd("VLAN natif 999", vlanNatif(mq(s.nom), p)) };
  });
  mesure({ id: "natif", classe: 2, titre: "Un VLAN natif inutilisé (999) sur les liens entre switchs",
    pourquoi: "Avec le VLAN 1 en natif, une erreur de configuration peut faire passer du trafic d'un VLAN à l'autre.",
    impact: "faible", impactTexte: "Faible, mais à faire aux deux bouts du lien en même temps, sinon le lien est coupé.",
    sansReleve: RELEVE, elements: elNatif });

  const elTrunks: Element[] = switchs.filter((s) => ports(val(s, "trunk-tous-vlan")).length).map((s) => {
    const p = ports(val(s, "trunk-tous-vlan"));
    const vl = [...new Set(p.flatMap((x) => inv.liaisons.filter((l) => (l.a === s.nom && l.portA === x) || (l.b === s.nom && l.portB === x)).map((l) => l.vlans ?? "")).filter(Boolean))].join(",");
    return { cible: s.nom, texte: `${p.join(", ")} laissent passer tous les VLAN${web(s.nom)}`, commandes: cmd("Ne garder que les VLAN utiles", trunkAutorises(mq(s.nom), p, vl || "<vlans>")) };
  });
  mesure({ id: "trunks", classe: 2, titre: "Les liens entre switchs ne transportent que les VLAN utiles",
    pourquoi: "Un VLAN qui n'a rien à faire sur un switch n'y passe pas : une erreur reste limitée à un endroit.",
    impact: "moyen", impactTexte: "Moyen : un nouveau VLAN doit être ajouté sur chaque lien de son chemin.",
    sansReleve: RELEVE, elements: elTrunks });

  const elCaches: Element[] = switchs.filter((s) => ports(val(s, "multi-mac")).length).map((s) => {
    const p = ports(val(s, "multi-mac"));
    return { cible: s.nom, texte: p.join(", "), commandes: p.slice(0, 3).flatMap((x) => cmd(`Ce qui est derrière ${x.split(" ")[0]}`, macDuPort(mq(s.nom), x.split(" ")[0]))) };
  });
  mesure({ id: "non-geres", classe: 2, titre: "Pas de petit switch caché derrière une prise",
    pourquoi: "Plusieurs appareils derrière un seul port : un switch « de bureau » invisible sur la carte, qui peut créer une boucle.",
    impact: "plus-rapide", impactTexte: "Ce qui est caché est ce qui fait perdre le plus de temps en dépannage.",
    sansReleve: RELEVE, elements: elCaches });

  const parModele = new Map<string, { nom: string; v: string }[]>();
  switchs.forEach((s) => { const v = val(s, "firmware"); if (v && s.infos[0]) parModele.set(s.infos[0], [...(parModele.get(s.infos[0]) ?? []), { nom: s.nom, v }]); });
  const elVersions: Element[] = [];
  switchs.forEach((s) => {
    const v = val(s, "firmware");
    const mieux = (s.infos[0] ? parModele.get(s.infos[0]) ?? [] : []).filter((x) => v && compareVersions(x.v, v) > 0).sort((a, b) => compareVersions(b.v, a.v))[0];
    if (v && mieux) elVersions.push({ cible: s.nom, texte: `${v} → ${mieux.v} (version de ${mieux.nom})`, commandes: [] });
  });
  mesure({ id: "versions", classe: 2, titre: "La même version logicielle pour un même modèle",
    pourquoi: "Deux switchs identiques avec deux versions ne réagissent pas pareil : ce qui marche sur l'un ne s'explique pas sur l'autre. Sans Internet, les mises à jour se font à la main.",
    impact: "faible", impactTexte: "Faible : une mise à jour par switch, en fenêtre de maintenance.",
    sansReleve: RELEVE, elements: elVersions });

  mesure({ id: "ntp", classe: 2, titre: "Tout le monde à la même heure (serveur de temps interne)",
    pourquoi: "Sans Internet, il faut une horloge de référence sur le réseau (souvent le serveur Genetec). Une vidéo avec une heure fausse ne vaut rien comme preuve.",
    impact: "plus-rapide", impactTexte: "Les journaux des switchs et des caméras se recoupent à la seconde.",
    etat: "a-verifier", constat: "À contrôler sur place (show clock sur les switchs, date et heure des caméras).", elements: [] });

  const elRedondance: Element[] = [];
  switchs.forEach((s) => {
    const l = liensDe(s.nom);
    const nCams = l.filter((x) => autreBout(x, s.nom)?.genre === "camera").length;
    const nLiens = l.filter((x) => RESEAU.includes(autreBout(x, s.nom)?.genre ?? "autre")).length;
    if (nLiens === 1 && nCams >= 8) elRedondance.push({ cible: s.nom, texte: `${nCams} caméras derrière un seul câble vers le reste du réseau`, commandes: [] });
  });
  mesure({ id: "redondance", classe: 2, titre: "Doubler le lien des switchs qui portent beaucoup de caméras",
    pourquoi: "Si l'unique câble (ou son module SFP) lâche, toutes les caméras du switch tombent d'un coup.",
    impact: "aucun", impactTexte: "Aucun en maintenance (deux câbles agrégés) ; un câble et deux ports de plus.", elements: elRedondance });

  /* ======================= CLASSE 3 · RENFORCÉ (à décider) ======================= */

  const exterieur = (t: string) => /parking|exter|ext\b|portail|quai|cour\b|toit|facade|entree|guerite|parvis|barriere/i.test(simple(t));
  const portsExt = new Map<string, string[]>();
  cameras.forEach((c) => {
    const b = brancheSur(c);
    if (b?.port && exterieur(`${c.nom} ${c.point} ${c.infos.join(" ")}`)) portsExt.set(b.sw, [...(portsExt.get(b.sw) ?? []), b.port]);
  });
  const elMac: Element[] = [...portsExt].map(([sw, p]) => ({ cible: sw, texte: `caméras en zone accessible au public : ports ${p.join(", ")}`, commandes: cmd("Exemple Cisco (à adapter)", verrouillageMac(mq(sw), p)) }));
  mesure({ id: "mac", classe: 3, titre: "Verrouiller les ports des caméras sur leur adresse MAC",
    pourquoi: "Quelqu'un qui débranche une caméra extérieure pour brancher un PC à la place est bloqué.",
    impact: "fort", impactTexte: "Fort : à chaque remplacement de caméra, le port reste bloqué tant qu'on n'a pas effacé l'ancienne adresse sur le switch (15 à 30 min de plus, accès au switch obligatoire). À réserver aux caméras accessibles au public (parking, extérieur).",
    etat: elMac.length ? "a-verifier" : "ok",
    constat: elMac.length ? "À décider pour les caméras ci-dessous." : "Pas de caméra en zone accessible repérée d'après les noms : rien à faire.", elements: elMac });
  mesure({ id: "8021x", classe: 3, titre: "Authentifier chaque équipement branché (802.1X)",
    pourquoi: "Seul un équipement reconnu peut se connecter, quel que soit le port.",
    impact: "fort", impactTexte: "Très fort : il faut un serveur d'authentification sur le réseau isolé, et chaque caméra remplacée doit y être enregistrée. Déconseillé ici, sauf exigence du client.",
    etat: "ok", constat: "Non conseillé pour ce réseau.", elements: [] });
  mesure({ id: "lldp", classe: 3, titre: "Laisser LLDP / CDP actifs",
    pourquoi: "On lit parfois qu'il faut les couper pour cacher les voisins d'un switch : le gain est faible sur un réseau isolé.",
    impact: "fort", impactTexte: "Les couper empêcherait le relevé et la carte de voir les liens : dépannage beaucoup plus long. À ne pas faire.",
    etat: "ok", constat: "Ne rien changer.", elements: [] });

  /* ======================= PANNES (dépannage) ======================= */
  const pannes: Panne[] = [];
  const horsLigne = new Map<string, Rapprochement[]>();
  cg.horsLigne.filter((r) => r.eq && r.switch).forEach((r) => horsLigne.set(r.switch!, [...(horsLigne.get(r.switch!) ?? []), r]));
  horsLigne.forEach((hl, sw) => {
    const m = mq(sw), ps = hl.map((r) => r.port).filter((p): p is string => !!p);
    pannes.push({ cible: sw, critique: true, titre: `${pl(hl.length, "caméra hors ligne", "caméras hors ligne")} : ${hl.map((r) => `${r.eq!.nom} (port ${r.port ?? "?"})`).join(", ")}`,
      detail: "Port éteint ou PoE à 0 W : câble, prise ou alimentation. Port actif avec l'adresse MAC de la caméra : le problème est côté Genetec (identifiants, archiveur).",
      commandes: [...cmd("1. Contrôler (lecture seule)", ps.flatMap((p) => controlerPort(m, p) ?? [])), ...cmd("2. Redémarrer la caméra (coupe le PoE)", relancerPoe(m, ps))] });
  });
  cg.horsLigne.filter((r) => !r.eq || !r.switch).forEach((r) => pannes.push({ cible: "", critique: false, titre: `${r.unite.nom || r.unite.mac} hors ligne dans Genetec, introuvable sur le réseau`,
    detail: `${r.unite.ip ? `IP ${r.unite.ip}. ` : ""}Aucun switch relevé ne la voit : câble arraché, caméra déposée ou switch non relevé.`, commandes: [] }));
  // Le reste des anomalies des relevés (déjà classées ailleurs : boucles, VLAN, IP, noms, relevé, versions).
  anomaliesDe((t) => !EST_BOUCLE.test(t) && !EST_VLAN.test(t) && !EST_IP.test(t) && !/m[êe]me nom|nomm[ée]s |relev|m[êe]me version|firmware diff/i.test(t)).forEach((a) => {
    const face = a.cible && a.port ? enFace(a.cible, a.port) : null;
    const lien = !!a.port && (/^(te|tw|fo|hu|xe|po|lag|sfp|trk)/i.test(a.port) || !!face);
    pannes.push({ cible: a.cible, critique: a.critique, titre: a.texte, detail: face && lien ? `Contrôler aussi l'autre bout : ${face}.` : "",
      commandes: a.cible && a.port ? cmd(`Contrôler ${a.port}`, lien ? controlerLien(mq(a.cible), a.port) : controlerPort(mq(a.cible), a.port)) : [] });
  });
  if (cg.actif && cg.nonEnregistrees.length && cg.rapproches.length) {
    pannes.push({ cible: "", critique: false, titre: `${pl(cg.nonEnregistrees.length, "caméra branchée", "caméras branchées")} mais absente${cg.nonEnregistrees.length > 1 ? "s" : ""} de Genetec : pas d'enregistrement`,
      detail: `${cg.nonEnregistrees.slice(0, 10).map((e) => { const b = brancheSur(e); return `${e.nom}${b ? ` (${b.sw} port ${b.port ?? "?"})` : ""}`; }).join(", ")}${cg.nonEnregistrees.length > 10 ? "…" : ""}. Les ajouter dans Config Tool, ou les débrancher si elles ne sont pas du site.`, commandes: [] });
  }
  pannes.sort((a, b) => Number(b.critique) - Number(a.critique));

  /* ======================= à corriger en premier ======================= */
  const premiers = [
    ...pannes.filter((p) => p.critique).map((p) => `${p.cible ? `${p.cible} : ` : ""}${p.titre}`),
    ...mesures.filter((x) => x.classe === 1 && x.etat === "a-faire").map((x) => `${x.titre} — ${x.constat}`),
  ].slice(0, 5);

  /* ======================= plan des VLAN et versions ======================= */
  const zone = (groupe: string, l: Equipement[]) => {
    const vl = [...new Set(l.map(vlanDe).filter((v): v is string => !!v))].sort((a, b) => Number(a) - Number(b));
    const res = [...new Set(l.map(reseau).filter((r): r is string => !!r))].sort();
    return { groupe, vlans: vl.join(", ") || "—", reseaux: res.length > 4 ? `${res.slice(0, 4).join(", ")}…` : res.join(", ") || "—", nombre: l.length };
  };
  const zones = [zone("Caméras", cameras), zone("Archiveurs et serveurs", serveurs), zone("Administration (switchs…)", de(RESEAU).filter((e) => !voisin(e))),
    zone("Postes", de(["poste"])), zone("Téléphones", de(["telephone"])), zone("Imprimantes", de(["imprimante"]))].filter((x) => x.nombre);

  const parVersion = new Map<string, Version>();
  const ajouter = (k: string, modele: string, version: string, nom: string) => {
    const v = parVersion.get(k) ?? { modele, version, equipements: [], remarque: "" };
    v.equipements.push(nom); parVersion.set(k, v);
  };
  const vusGenetec = new Set(cg.rapproches.filter((r) => r.eq && r.unite.firmware).map((r) => r.eq!.nom));
  eq.filter((e) => (e.infos[0] || val(e, "firmware")) && !vusGenetec.has(e.nom) && !voisin(e))
    .forEach((e) => ajouter(`${e.infos[0] ?? ""}§${val(e, "firmware") ?? ""}`, e.infos[0] || "(modèle inconnu)", val(e, "firmware") ?? "", e.nom));
  (genetec?.unites ?? []).filter((u) => u.firmware || u.modele).forEach((u) => {
    const modele = [u.fabricant, u.modele].filter(Boolean).join(" ") || "(modèle inconnu)";
    ajouter(`G§${modele}§${u.firmware}`, modele, u.firmware, cg.rapproches.find((x) => x.unite === u)?.eq?.nom ?? (u.nom || u.ip));
  });
  const versions = [...parVersion.values()].sort((a, b) => a.modele.localeCompare(b.modele) || compareVersions(a.version, b.version));
  versions.forEach((v) => {
    const max = versions.filter((x) => x.modele === v.modele && x.version).sort((a, b) => compareVersions(b.version, a.version))[0];
    v.remarque = !v.version ? "Version inconnue." : max && max.version !== v.version ? `Passer en ${max.version} (déjà sur ${max.equipements[0]}).` : "—";
  });

  return { mesures, pannes, premiers, zones, versions, genetec: cg, sourcesGenetec: genetec?.sources ?? [], releve };
}
