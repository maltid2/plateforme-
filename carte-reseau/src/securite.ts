/**
 * Préconisations sécurité et flux, tirées des données de la carte.
 *
 * Elles sont rangées PAR ÉQUIPEMENT : chaque switch a sa fiche, avec des
 * actions précises (les ports concernés, l'autre bout du lien quand il faut
 * le traiter aussi) et les commandes à taper pour sa marque (commandes.ts).
 * Ce qui concerne tout le réseau, la vidéo (Genetec) ou l'inventaire a sa
 * propre fiche. En tête : les actions par lesquelles commencer.
 *
 * Tout est calculé sur le poste. Pas de base de vulnérabilités (CVE)
 * embarquée : sans connexion, elle serait périmée en quelques semaines. À la
 * place, chaque couple modèle / version est listé pour être comparé aux avis
 * du CERT-FR et du constructeur.
 *
 * Références : ISO/IEC 27001:2022, annexe A (A.5.9 inventaire, A.8.8
 * vulnérabilités, A.8.9 configuration, A.8.14 redondance, A.8.15
 * journalisation, A.8.16 surveillance, A.8.17 horloges, A.8.20 sécurité des
 * réseaux, A.8.22 cloisonnement) et guide d'hygiène informatique de l'ANSSI.
 */
import { lireMasque, type Equipement, type Genre, type Inventaire } from "./saisie.ts";
import { comparerGenetec, type Comparaison, type Genetec, type Rapprochement } from "./genetec.ts";
import { accesVlan, controlerLien, controlerPort, desactiverPorts, macDuPort, marqueDe, NOM_MARQUE, relancerPoe, trunkAutorises, vlanNatif, type Marque } from "./commandes.ts";

export type Gravite = "critique" | "importante" | "conseil";
export type Commande = { libelle: string; lignes: string[] };
export type Action = {
  gravite: Gravite;
  /** Ce qu'il faut faire, avec les ports ou les équipements précis. */
  titre: string;
  /** Pourquoi, et comment le vérifier. */
  detail: string;
  commandes: Commande[];
  /** À faire en même temps ailleurs (l'autre bout d'un lien…). */
  aussi?: string;
  equipements: string[];
  reference: string;
};
export type Fiche = {
  cible: string;
  type: "equipement" | "reseau" | "video" | "inventaire";
  sousTitre: string;
  gravite: Gravite;
  actions: Action[];
};
export type Flux = { source: string; destination: string; flux: string; decision: "Autoriser" | "Restreindre" | "Interdire"; motif: string };
export type Version = { modele: string; version: string; equipements: string[]; remarque: string };
export type Bilan = {
  fiches: Fiche[];
  /** Les actions par lesquelles commencer (les plus graves d'abord). */
  priorites: { cible: string; action: Action }[];
  compteurs: Record<Gravite, number>;
  flux: Flux[]; ouFiltrer: string;
  versions: Version[];
  zones: { groupe: string; vlans: string; reseaux: string; nombre: number }[];
  verifications: string[];
  genetec: Comparaison; sourcesGenetec: Genetec["sources"];
};

const ORDRE: Record<Gravite, number> = { critique: 0, importante: 1, conseil: 2 };
const val = (e: Equipement, k: string) => e.kv.find(([c]) => c.toLowerCase() === k)?.[1];
const pl = (n: number, mot: string, pluriel = `${mot}s`) => `${n} ${n > 1 ? pluriel : mot}`;
const enumerer = (noms: string[], max = 8) => (noms.length > max ? `${noms.slice(0, max).join(", ")} et ${noms.length - max} autres` : noms.join(", "));
/** Liste de ports écrite par le relevé (« Gi1/0/5,Gi1/0/6 ») ; un nombre seul = ancien relevé, sans détail. */
const ports = (v?: string) => (!v || /^\d+$/.test(v) ? [] : v.split(",").map((x) => x.replace(/…$/, "").trim()).filter(Boolean));
const compteDe = (v?: string) => (!v ? 0 : /^\d+$/.test(v) ? Number(v) : ports(v).length);

/** Réseau d'une IP : avec son masque s'il est connu, sinon le /24 (hypothèse courante, signalée). */
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
/** « 17.03.04 » < « 17.06.05 » (comparaison par nombres). */
function compareVersions(a: string, b: string) {
  const x = a.split(/[^0-9]+/).filter(Boolean).map(Number), y = b.split(/[^0-9]+/).filter(Boolean).map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] ?? 0) - (y[i] ?? 0); if (d) return d; }
  return 0;
}

const RESEAU: Genre[] = ["switch", "passerelle", "parefeu", "borne"];
const VIDEO_SRV: Genre[] = ["nvr", "serveur", "nas"];
const UTILISATEURS: Genre[] = ["poste", "imprimante", "telephone"];
const REF = {
  ports: "ISO 27001 A.8.20 · ANSSI : désactiver les ports inutilisés",
  vlan: "ISO 27001 A.8.20 · A.8.22",
  surveillance: "ISO 27001 A.8.16 · A.8.14",
  inventaire: "ISO 27001 A.5.9",
  versions: "ISO 27001 A.8.8 · A.8.9",
};

export function analyserSecurite(inv: Inventaire, genetec?: Genetec | null): Bilan {
  const eq = inv.equipements;
  const parNom = new Map(eq.map((e) => [e.nom, e]));
  const de = (g: Genre | Genre[]) => eq.filter((e) => (Array.isArray(g) ? g : [g]).includes(e.genre));
  const cameras = de("camera"), switchs = de("switch"), serveurs = de(VIDEO_SRV), utilisateurs = de(UTILISATEURS);
  const releve = switchs.some((s) => val(s, "ports-relevés") || val(s, "firmware"));
  const cg = comparerGenetec(inv, genetec);

  const lienReseau = (e: Equipement) => inv.liaisons.find((l) => (l.a === e.nom || l.b === e.nom) && RESEAU.includes(parNom.get(l.a === e.nom ? l.b : l.a)?.genre ?? "autre"));
  /** VLAN d'un équipement : son champ vlan=, sinon celui de son câble vers le réseau. */
  const vlanDe = (e: Equipement): string | undefined => val(e, "vlan") ?? (lienReseau(e)?.mode !== "trunk" ? lienReseau(e)?.vlans : undefined);
  /** Le switch et le port d'un équipement terminal. */
  const brancheSur = (e: Equipement) => {
    const l = lienReseau(e);
    return l ? (l.a === e.nom ? { sw: l.b, port: l.portB } : { sw: l.a, port: l.portA }) : null;
  };
  /** L'autre bout d'un port de switch (pour traiter les deux côtés d'un lien). */
  const enFace = (sw: string, port: string) => {
    const l = inv.liaisons.find((x) => (x.a === sw && x.portA === port) || (x.b === sw && x.portB === port));
    return l ? (l.a === sw ? `${l.b}${l.portB ? ` port ${l.portB}` : ""}` : `${l.a}${l.portA ? ` port ${l.portA}` : ""}`) : null;
  };
  // VLAN vidéo : le plus courant chez les caméras.
  const comptesVlan = new Map<string, number>();
  cameras.forEach((c) => { const v = vlanDe(c); if (v && v !== "1") comptesVlan.set(v, (comptesVlan.get(v) ?? 0) + 1); });
  const vlanVideo = [...comptesVlan].sort((a, b) => b[1] - a[1])[0]?.[0];

  /* ---------- fiches ---------- */
  const fiches = new Map<string, Fiche>();
  const fiche = (cible: string, type: Fiche["type"], sousTitre = "") => {
    let f = fiches.get(cible);
    if (!f) { f = { cible, type, sousTitre, gravite: "conseil", actions: [] }; fiches.set(cible, f); }
    return f;
  };
  const ajouter = (f: Fiche, a: Omit<Action, "commandes" | "equipements"> & { commandes?: (Commande | null)[]; equipements?: string[] }) => {
    f.actions.push({ ...a, commandes: (a.commandes ?? []).filter((c): c is Commande => !!c && c.lignes.length > 0), equipements: [...new Set(a.equipements ?? [])] });
  };
  const cmd = (libelle: string, lignes: string[] | null): Commande | null => (lignes ? { libelle, lignes } : null);
  const sansCommande = (m: Marque) => (m === "autre" ? " Pas de commande pour cette marque : à faire dans l'interface web du switch (ou sa console)." : "");
  const ficheSwitch = (s: Equipement) => {
    const m = marqueDe(s);
    const parts = [NOM_MARQUE[m] || "", s.infos[0], s.ip, [s.point, s.baie && `baie ${s.baie}`].filter(Boolean).join(" · ")].filter(Boolean) as string[];
    return { f: fiche(s.nom, "equipement", [...new Set(parts)].join(" · ")), m };
  };
  const reseauF = () => fiche("Ensemble du réseau", "reseau", "Cloisonnement, adressage, filtrage, liaisons");
  const videoF = () => fiche("Vidéo (Genetec)", "video", genetec?.sources.map((x) => x.nom).join(" · ") ?? "");
  const inventaireF = () => fiche("Inventaire", "inventaire", "Ce qui manque pour tout contrôler");

  /* ================= par switch ================= */
  const horsLigneParSwitch = new Map<string, Rapprochement[]>();
  cg.horsLigne.filter((r) => r.eq && r.switch).forEach((r) => horsLigneParSwitch.set(r.switch!, [...(horsLigneParSwitch.get(r.switch!) ?? []), r]));
  const versionsParModele = new Map<string, { nom: string; v: string }[]>();
  switchs.forEach((s) => { const v = val(s, "firmware"); if (v && s.infos[0]) versionsParModele.set(s.infos[0], [...(versionsParModele.get(s.infos[0]) ?? []), { nom: s.nom, v }]); });

  for (const s of switchs) {
    const { f, m } = ficheSwitch(s);
    const releveS = val(s, "releve") ?? "";
    // 1. Clé SSH changée : possible interception.
    if (/cl[ée] d.h[ôo]te/i.test(releveS)) {
      ajouter(f, { gravite: "critique", titre: "Ne pas s'y connecter avant d'avoir vérifié le switch : sa clé SSH a changé",
        detail: `${releveS}. Si le switch n'a été ni remplacé ni réinitialisé, un équipement peut s'être intercalé (interception des identifiants). Vérifier sur place, puis accepter la nouvelle clé seulement si le changement est expliqué.`,
        reference: "ISO 27001 A.8.20 · A.8.16" });
    } else if (/non relev|marque inconnue|partiel/i.test(releveS)) {
      ajouter(f, { gravite: "importante", titre: "Relever ce switch (aujourd'hui, il n'est pas contrôlé)",
        detail: `${releveS}. Fournir le bon compte (lecture seule si possible) ou ajouter sa marque à commandes.txt, puis relancer « Relever les switchs.bat ».`,
        reference: REF.inventaire });
    }
    // 2. Caméras hors ligne (Genetec) branchées sur ce switch.
    const hl = horsLigneParSwitch.get(s.nom) ?? [];
    if (hl.length) {
      ajouter(f, { gravite: "critique",
        titre: `Contrôler ${hl.length > 1 ? `les ports ${hl.map((r) => r.port ?? "?").join(", ")}` : `le port ${hl[0].port ?? "?"}`} : ${pl(hl.length, "caméra hors ligne", "caméras hors ligne")} dans Genetec`,
        detail: `${hl.map((r) => `${r.eq!.nom}${r.unite.nom && r.unite.nom !== r.eq!.nom ? ` (« ${r.unite.nom.split(" / ")[0]} »)` : ""} sur le port ${r.port ?? "?"}`).join(" ; ")}. `
          + "Lien coupé ou PoE à 0 W : câble, prise, alimentation de la caméra. Lien actif et adresse MAC vue : la caméra répond, le problème est côté Genetec (identifiants, archiveur, licence).",
        commandes: (() => {
          const ps = hl.map((r) => r.port).filter((p): p is string => !!p);
          const ctl = ps.flatMap((p) => controlerPort(m, p) ?? []);
          return [cmd(`1. Contrôler ${ps.length > 1 ? "les ports" : "le port"} (lecture seule)`, ctl.length ? ctl : null),
            cmd(`2. Si le port est actif sans adresse MAC : redémarrer ${ps.length > 1 ? "les caméras" : "la caméra"} (PoE)`, relancerPoe(m, ps))];
        })(),
        equipements: [s.nom, ...hl.map((r) => r.eq!.nom)], reference: REF.surveillance });
    }
    // 3. Anomalies relevées : une action par port (plusieurs anomalies du même port réunies).
    const an = val(s, "anomalies");
    if (an) {
      const parPort = new Map<string, { crit: boolean; textes: string[] }>();
      an.split(" — ").slice(1).join(" — ").split(" · ").map((x) => x.trim()).filter(Boolean).forEach((x) => {
        const texte = x.replace(/^[⛔⚠]\s*/, "");
        // Le relevé incomplet est déjà dit plus haut (« Relever ce switch »).
        if (/relev/i.test(texte) && /non relev|marque inconnue|partiel/i.test(releveS)) return;
        const port = texte.match(/^([A-Za-z]{0,12}[\d/]+[\d])\s*:/)?.[1] ?? "";
        const g = parPort.get(port) ?? { crit: false, textes: [] };
        g.crit ||= x.startsWith("⛔");
        g.textes.push(port ? texte.slice(port.length).replace(/^\s*:\s*/, "") : texte);
        parPort.set(port, g);
      });
      parPort.forEach((g, port) => {
        // Lien entre équipements (fibre, agrégation, trunk) ou port d'accès (caméra…) : pas les mêmes contrôles.
        const lien = /^(te|tw|fo|hu|xe|po|lag|sfp|trk)/i.test(port) || inv.liaisons.some((l) => ((l.a === s.nom && l.portA === port) || (l.b === s.nom && l.portB === port)) && l.mode === "trunk");
        const face = port ? enFace(s.nom, port) : null;
        ajouter(f, { gravite: g.crit ? "critique" : "importante",
          titre: port ? `${port} : ${g.textes[0]}` : g.textes[0],
          detail: (g.textes.length > 1 ? `Sur ce port : ${g.textes.slice(1).join(" ; ")}. ` : "") + "Trouvé par l'analyse du relevé (Cartographie Réseau).",
          aussi: face && lien ? `Contrôler aussi l'autre bout : ${face}.` : undefined,
          commandes: port ? [cmd(`Contrôler ${port}`, lien ? controlerLien(m, port) : controlerPort(m, port))] : [],
          equipements: [s.nom, ...(face ? [face.split(" port ")[0]] : [])], reference: REF.surveillance });
      });
    }
    // 4. Ports libres restés actifs.
    const libres = ports(val(s, "ports-libres-actifs")), nLibres = compteDe(val(s, "ports-libres-actifs"));
    if (nLibres) {
      ajouter(f, { gravite: "importante",
        titre: libres.length ? `Désactiver ${libres.length > 1 ? `les ${libres.length} ports libres` : "le port libre"} : ${libres.join(", ")}` : `Désactiver les ${nLibres} ports libres`,
        detail: "Ports sans rien de branché mais actifs : n'importe qui peut s'y brancher et entrer sur le réseau."
          + (libres.length ? "" : " Relancer le relevé pour avoir leur liste exacte.") + sansCommande(m),
        commandes: [cmd("Désactiver", desactiverPorts(m, libres))], equipements: [s.nom], reference: REF.ports });
    }
    // 5. Ports d'accès dans le VLAN 1 (relevé) + équipements déclarés en VLAN 1 sur ce switch.
    const declares = eq.filter((e) => !RESEAU.includes(e.genre) && vlanDe(e) === "1" && brancheSur(e)?.sw === s.nom);
    const p1 = [...new Set([...ports(val(s, "acces-vlan1")), ...declares.map((e) => brancheSur(e)!.port).filter((p): p is string => !!p)])];
    if (p1.length) {
      const camsSeules = declares.length && declares.every((e) => e.genre === "camera");
      const cible = camsSeules && vlanVideo ? vlanVideo : "<vlan>";
      ajouter(f, { gravite: "importante", titre: `Sortir du VLAN 1 : ${p1.join(", ")}${camsSeules && vlanVideo ? ` (vers le VLAN vidéo ${vlanVideo})` : ""}`,
        detail: "Le VLAN 1 est celui de tous les ports non configurés : un équipement inconnu branché n'importe où y retrouve ces équipements."
          + (cible === "<vlan>" ? " Remplacer <vlan> par le VLAN dédié à ces équipements." : "") + sansCommande(m),
        commandes: [cmd("Passer en accès dans le bon VLAN", accesVlan(m, p1, cible))], equipements: [s.nom, ...declares.map((e) => e.nom)], reference: REF.vlan });
    }
    // 6. Trunks en VLAN natif 1 : les deux bouts.
    const n1 = ports(val(s, "trunk-natif-vlan1"));
    if (n1.length) {
      const faces = n1.map((p) => enFace(s.nom, p)).filter((x): x is string => !!x);
      ajouter(f, { gravite: "conseil", titre: `Mettre le VLAN natif 999 sur ${n1.length > 1 ? "les trunks" : "le trunk"} ${n1.join(", ")}`,
        detail: "VLAN natif 1 sur un trunk : risque de saut de VLAN. Le VLAN natif doit être le même aux deux bouts, sinon le lien tombe : faire les deux côtés dans la même intervention." + sansCommande(m),
        aussi: faces.length ? `De l'autre côté, en même temps : ${faces.join(", ")}.` : undefined,
        commandes: [cmd("VLAN natif inutilisé", vlanNatif(m, n1))], equipements: [s.nom, ...faces.map((x) => x.split(" port ")[0])], reference: REF.vlan });
    }
    // 7. Trunks ouverts à tous les VLAN.
    const tous = ports(val(s, "trunk-tous-vlan"));
    if (tous.length) {
      const vl = [...new Set(tous.flatMap((p) => inv.liaisons.filter((l) => (l.a === s.nom && l.portA === p) || (l.b === s.nom && l.portB === p)).map((l) => l.vlans ?? "")).filter(Boolean))].join(",");
      ajouter(f, { gravite: "conseil", titre: `Limiter les VLAN autorisés sur ${tous.join(", ")}`,
        detail: `Ces trunks laissent passer tous les VLAN. N'autoriser que ceux utilisés de l'autre côté${vl ? ` (sur la carte : ${vl})` : ""}.`,
        commandes: [cmd("VLAN autorisés", trunkAutorises(m, tous, vl || "<vlans>"))], equipements: [s.nom], reference: REF.vlan });
    }
    // 8. Plusieurs adresses MAC sur un port d'accès : switch non géré ou concentrateur.
    const multi = ports(val(s, "multi-mac"));
    if (multi.length) {
      ajouter(f, { gravite: "importante", titre: `Identifier ce qui est branché sur ${multi.join(", ")}`,
        detail: "Plusieurs équipements derrière un seul port d'accès : petit switch non géré ou concentrateur probable, invisible sur la carte. Le retrouver, puis le remplacer par un switch géré ou limiter le nombre d'adresses MAC du port.",
        commandes: multi.map((x) => x.split(" ")[0]).map((p) => cmd(`Voir ce qui est derrière ${p}`, macDuPort(m, p))), equipements: [s.nom], reference: "ISO 27001 A.8.20 · A.5.9" });
    }
    // 9. Trunk vers un équipement terminal.
    inv.liaisons.filter((l) => l.mode === "trunk" && (l.a === s.nom || l.b === s.nom)).forEach((l) => {
      const autre = parNom.get(l.a === s.nom ? l.b : l.a), port = l.a === s.nom ? l.portA : l.portB;
      if (!autre || !["camera", "poste", "imprimante", "telephone", "autre"].includes(autre.genre) || !port) return;
      const v = vlanDe(autre) ?? (autre.genre === "camera" ? vlanVideo : undefined) ?? "<vlan>";
      ajouter(f, { gravite: "importante", titre: `Passer le port ${port} en accès (${autre.nom} n'a besoin que d'un VLAN)`,
        detail: `${autre.nom} reçoit un trunk : il peut voir plusieurs VLAN. Un équipement terminal reste dans un seul VLAN.`,
        commandes: [cmd("Port d'accès", accesVlan(m, [port], v))], equipements: [s.nom, autre.nom], reference: REF.vlan });
    });
    // 10. Version différente d'un autre switch du même modèle : mettre à jour.
    const v = val(s, "firmware"), memes = s.infos[0] ? versionsParModele.get(s.infos[0]) ?? [] : [];
    const plusRecente = memes.filter((x) => v && compareVersions(x.v, v) > 0).sort((a, b) => compareVersions(b.v, a.v))[0];
    if (v && plusRecente) {
      ajouter(f, { gravite: "conseil", titre: `Mettre à jour le logiciel : ${v} → ${plusRecente.v} (version de ${plusRecente.nom})`,
        detail: `Même modèle (${s.infos[0]}), versions différentes. Vérifier d'abord les avis du CERT-FR et du constructeur pour ${plusRecente.v} (ou une version plus récente).`,
        equipements: [s.nom, plusRecente.nom], reference: REF.versions });
    }
    // 11. Lien montant chargé par la vidéo (débits Genetec).
    const d = cg.debitParSwitch.find((x) => x.switch === s.nom && x.capaciteMbps && x.kbps / 1000 > x.capaciteMbps * 0.7);
    if (d) {
      ajouter(f, { gravite: "importante", titre: `Désengorger le lien montant ${d.lien ?? ""} : ${Math.round(d.kbps / 1000)} Mb/s de vidéo pour ${d.capaciteMbps! >= 1000 ? `${d.capaciteMbps! / 1000} Gb/s` : `${d.capaciteMbps} Mb/s`}`,
        detail: "Au-delà de 70 % du lien, les images se dégradent aux heures chargées : passer le lien en 10G, l'agréger, ou réduire les débits (H.265, images/s).",
        equipements: [s.nom], reference: "ISO 27001 A.8.14 · A.8.6" });
    }
    // 12. Un seul lien pour beaucoup de caméras.
    const nCams = inv.liaisons.filter((l) => (l.a === s.nom || l.b === s.nom) && parNom.get(l.a === s.nom ? l.b : l.a)?.genre === "camera").length;
    const nLiens = inv.liaisons.filter((l) => (l.a === s.nom || l.b === s.nom) && RESEAU.includes(parNom.get(l.a === s.nom ? l.b : l.a)?.genre ?? "autre")).length;
    if (nLiens === 1 && nCams >= 8) {
      ajouter(f, { gravite: "conseil", titre: `Doubler le lien montant (${nCams} caméras derrière un seul câble)`,
        detail: "Si ce câble ou son module SFP lâche, toutes ces caméras tombent. Ajouter un deuxième lien (agrégation) vers le cœur.",
        equipements: [s.nom], reference: "ISO 27001 A.8.14" });
    }
  }

  /* ================= ensemble du réseau ================= */
  const vlansCam = new Set(cameras.map(vlanDe).filter(Boolean) as string[]);
  if (cameras.length && !vlansCam.size) {
    ajouter(reseauF(), { gravite: "importante", titre: "Créer un VLAN vidéo et y mettre toutes les caméras",
      detail: `Aucune des ${pl(cameras.length, "caméra")} n'a de VLAN connu : rien ne montre que la vidéo est séparée du reste.`,
      equipements: cameras.map((c) => c.nom).slice(0, 40), reference: REF.vlan });
  }
  const melanges = eq.filter((e) => !["camera", ...RESEAU, ...VIDEO_SRV].includes(e.genre) && vlansCam.has(vlanDe(e) ?? "§"));
  if (melanges.length) {
    ajouter(reseauF(), { gravite: "importante", titre: `Sortir du VLAN vidéo : ${enumerer(melanges.map((e) => e.nom))}`,
      detail: `${melanges.map((e) => `${e.nom} (${e.genre}${brancheSur(e) ? `, ${brancheSur(e)!.sw} port ${brancheSur(e)!.port ?? "?"}` : ""})`).join(" ; ")} : dans le VLAN des caméras (${[...vlansCam].join(", ")}). Un poste compromis ne doit pas joindre les caméras directement.`,
      equipements: melanges.map((e) => e.nom), reference: REF.vlan });
  }
  const resCam = new Set(cameras.map(reseau).filter(Boolean) as string[]);
  const memeRes = utilisateurs.filter((u) => resCam.has(reseau(u) ?? "§"));
  if (memeRes.length) {
    ajouter(reseauF(), { gravite: "importante", titre: `Changer l'adressage de ${enumerer(memeRes.map((e) => e.nom))} : même réseau IP que les caméras`,
      detail: `Réseaux partagés : ${[...new Set(memeRes.map(reseau))].join(", ")}. Sans réseau propre, la vidéo ne peut pas être filtrée au pare-feu.`,
      equipements: memeRes.map((e) => e.nom), reference: REF.vlan });
  }
  const resUtil = new Set([...cameras, ...utilisateurs].map(reseau).filter(Boolean) as string[]);
  const adminMelange = switchs.filter((s) => resUtil.has(reseau(s) ?? "§"));
  if (adminMelange.length) {
    ajouter(reseauF(), { gravite: "importante", titre: `Isoler l'administration de ${enumerer(adminMelange.map((s) => s.nom))}`,
      detail: `Leur adresse d'administration (${[...new Set(adminMelange.map(reseau))].join(", ")}) est dans un réseau de caméras ou de postes. Créer un VLAN d'administration, joignable seulement depuis les postes d'administration (SSH, HTTPS).`,
      equipements: adminMelange.map((s) => s.nom), reference: "ISO 27001 A.8.22 · A.8.2 · ANSSI : réseau d'administration dédié" });
  }
  const parefeux = de("parefeu");
  if (cameras.length && !parefeux.length) {
    ajouter(reseauF(), { gravite: "importante", titre: "Filtrer les flux entre VLAN (aucun pare-feu sur la carte)",
      detail: "Appliquer la matrice de flux ci-dessous sur le pare-feu du site, ou en ACL sur le cœur de réseau s'il n'y en a pas.",
      reference: REF.vlan });
  }
  const ips = new Map<string, string[]>();
  eq.forEach((e) => { if (e.ip) ips.set(e.ip.split("/")[0], [...(ips.get(e.ip.split("/")[0]) ?? []), e.nom]); });
  [...ips].filter(([, n]) => n.length > 1).forEach(([ip, n]) => {
    ajouter(reseauF(), { gravite: "critique", titre: `Corriger l'IP ${ip}, utilisée par ${n.join(" et ")}`,
      detail: "Une même IP sur deux équipements : l'un des deux ne répond pas (ou mal). Corriger l'adressage, ou l'inventaire si c'est une erreur de saisie.",
      equipements: n, reference: "ISO 27001 A.5.9 · A.8.20" });
  });
  inv.liaisons.filter((l) => l.media === "radio").forEach((l) => {
    ajouter(reseauF(), { gravite: "importante", titre: `Vérifier le chiffrement du pont radio ${l.a} ↔ ${l.b}`,
      detail: "WPA2/WPA3 ou chiffrement du constructeur, clé longue propre au site ; interface d'administration du pont non joignable depuis le réseau vidéo.",
      equipements: [l.a, l.b], reference: "ISO 27001 A.8.20 · A.8.24" });
  });
  inv.liaisons.filter((l) => l.media === "vpn").forEach((l) => {
    ajouter(reseauF(), { gravite: "conseil", titre: `Vérifier le VPN ${l.a} ↔ ${l.b} : IPsec ou TLS avec certificats`,
      detail: "Pas de clé partagée faible ; filtrer les flux qui le traversent comme entre deux VLAN.",
      equipements: [l.a, l.b], reference: "ISO 27001 A.8.20 · A.8.21" });
  });

  /* ================= vidéo (Genetec) ================= */
  if (cg.actif) {
    const introuvables = cg.horsLigne.filter((r) => !r.eq || !r.switch);
    introuvables.forEach((r) => {
      ajouter(videoF(), { gravite: "importante", titre: `Retrouver ${r.unite.nom || r.unite.mac} : hors ligne et introuvable sur le réseau`,
        detail: `${r.unite.ip ? `IP ${r.unite.ip} · ` : ""}${r.unite.mac ? `MAC ${r.unite.mac} · ` : ""}${r.unite.archiveur ? `archiveur ${r.unite.archiveur}. ` : ""}Aucun switch relevé ne la voit : câble arraché, caméra déposée, ou switch non relevé.`,
        reference: "ISO 27001 A.5.9 · A.8.16" });
    });
    if (cg.nonEnregistrees.length && genetec?.unites.length) {
      ajouter(videoF(), { gravite: "importante", titre: `Ajouter dans Genetec (ou débrancher) ${pl(cg.nonEnregistrees.length, "caméra non enregistrée", "caméras non enregistrées")}`,
        detail: cg.nonEnregistrees.map((e) => { const b = brancheSur(e); return `${e.nom}${e.ip ? ` ${e.ip}` : ""}${b ? ` (${b.sw} port ${b.port ?? "?"})` : ""}`; }).join(" ; ")
          + ". Branchées mais inconnues de Genetec : aucune image enregistrée. Dans Config Tool, ajouter l'unité vidéo (par son IP) ; si ce n'est pas une caméra du site, la débrancher.",
        equipements: cg.nonEnregistrees.map((e) => e.nom), reference: "ISO 27001 A.5.9 · A.8.1" });
    }
    cg.ecartsIp.forEach((r) => {
      ajouter(videoF(), { gravite: "importante", titre: `Corriger l'IP de ${r.unite.nom.split(" / ")[0] || r.eq!.nom} dans Genetec : ${r.unite.ip} → ${r.eq!.ip}`,
        detail: `Même adresse MAC (${r.unite.mac}), IP différente : la caméra a changé d'IP (DHCP ?). Lui donner une IP fixe (ou une réservation DHCP), puis corriger l'unité dans Config Tool.`,
        equipements: [r.eq!.nom], reference: "ISO 27001 A.8.9" });
    });
    cg.doublonsIp.forEach((d) => {
      ajouter(videoF(), { gravite: "critique", titre: `Séparer ${d.noms.join(" et ")} : même IP ${d.ip} dans Genetec`,
        detail: "Une seule des deux peut fonctionner. Donner une IP libre à l'une, puis mettre Genetec à jour.",
        reference: "ISO 27001 A.8.9 · A.8.20" });
    });
    const absentes = cg.absentes.filter((r) => r.etat !== "hors ligne");
    if (absentes.length) {
      ajouter(videoF(), { gravite: "conseil", titre: `Localiser ${pl(absentes.length, "caméra")} qui ${absentes.length > 1 ? "enregistrent" : "enregistre"} mais n'${absentes.length > 1 ? "apparaissent" : "apparaît"} pas sur la carte`,
        detail: absentes.map((r) => `${r.unite.nom || r.unite.mac}${r.unite.ip ? ` ${r.unite.ip}` : ""}`).join(" ; ") + ". Le switch où elles sont branchées n'est pas relevé : le relever.",
        reference: REF.inventaire });
    }
    if (cg.ecartsNom.length) {
      ajouter(videoF(), { gravite: "conseil", titre: `Reprendre les noms Genetec sur la carte (${cg.ecartsNom.length})`,
        detail: cg.ecartsNom.slice(0, 12).map((r) => `${r.eq!.nom} → ${r.unite.nom.split(" / ")[0]}`).join(" ; ") + (cg.ecartsNom.length > 12 ? " ; …" : "") + ". Un seul nom partout (carte, Genetec, étiquette) : bouton ci-dessous.",
        equipements: cg.ecartsNom.map((r) => r.eq!.nom), reference: REF.inventaire });
    }
  }

  /* ================= inventaire ================= */
  eq.filter((e) => /voisin/i.test(val(e, "source") ?? "") && RESEAU.includes(e.genre)).forEach((e) => {
    const vu = inv.liaisons.find((l) => l.a === e.nom || l.b === e.nom);
    const par = vu ? (vu.a === e.nom ? `${vu.b} port ${vu.portB ?? "?"}` : `${vu.a} port ${vu.portA ?? "?"}`) : "";
    ajouter(inventaireF(), { gravite: "conseil", titre: `Ajouter ${e.nom} au relevé${par ? ` (vu sur ${par})` : ""}`,
      detail: "Vu par un switch voisin (LLDP/CDP) mais pas relevé : ses ports et sa configuration ne sont pas contrôlés. Ajouter son IP dans switchs.txt, ou confirmer qu'un autre service le gère.",
      equipements: [e.nom], reference: REF.inventaire });
  });
  const sansIp = eq.filter((e) => !e.ip && ["camera", "switch", "nvr", "serveur", "parefeu", "passerelle"].includes(e.genre) && !/voisin/i.test(val(e, "source") ?? ""));
  if (sansIp.length) {
    ajouter(inventaireF(), { gravite: "conseil", titre: `Renseigner l'IP de ${enumerer(sansIp.map((e) => e.nom))}`,
      detail: sansIp.map((e) => { const b = brancheSur(e); return `${e.nom}${b ? ` (${b.sw} port ${b.port ?? "?"})` : ""}`; }).join(" ; ") + ". Sans IP, impossible de les filtrer ni de suivre leurs mises à jour.",
      equipements: sansIp.map((e) => e.nom), reference: REF.inventaire });
  }
  const dates = switchs.map((s) => val(s, "releve-date")).filter(Boolean) as string[];
  if (dates.length) {
    const plusVieux = dates.sort()[0];
    const jours = Math.floor((Date.now() - new Date(plusVieux).getTime()) / 864e5);
    if (jours > 90) ajouter(inventaireF(), { gravite: "conseil", titre: `Relancer le relevé (le plus ancien a ${jours} jours)`,
      detail: `Relevé du ${new Date(plusVieux).toLocaleDateString("fr-FR")}. À refaire chaque trimestre et après chaque intervention.`, reference: REF.inventaire });
  }

  /* ================= versions ================= */
  const modeleDe = (e: Equipement) => e.infos[0] ?? "";
  const versions = new Map<string, Version>();
  const versionGenetec = new Set(cg.rapproches.filter((r) => r.eq && r.unite.firmware).map((r) => r.eq!.nom));
  eq.filter((e) => (modeleDe(e) || val(e, "firmware")) && !versionGenetec.has(e.nom) && !/voisin/i.test(val(e, "source") ?? "")).forEach((e) => {
    const k = `${modeleDe(e)}§${val(e, "firmware") ?? ""}`;
    const v = versions.get(k) ?? { modele: modeleDe(e) || "(modèle inconnu)", version: val(e, "firmware") ?? "", equipements: [], remarque: e.genre === "switch" ? "switch" : "" };
    v.equipements.push(e.nom);
    versions.set(k, v);
  });
  (genetec?.unites ?? []).filter((u) => u.firmware || u.modele).forEach((u) => {
    const modele = [u.fabricant, u.modele].filter(Boolean).join(" ") || "(modèle inconnu)";
    const k = `G§${modele}§${u.firmware}`;
    const v = versions.get(k) ?? { modele, version: u.firmware, equipements: [], remarque: "" };
    const r = cg.rapproches.find((x) => x.unite === u);
    v.equipements.push(r?.eq?.nom ?? (u.nom || u.ip));
    versions.set(k, v);
  });
  const liste = [...versions.values()].sort((a, b) => a.modele.localeCompare(b.modele) || compareVersions(a.version, b.version));
  liste.forEach((v) => {
    const autres = liste.filter((x) => x.modele === v.modele && x.version && x.version !== v.version);
    const max = [v, ...autres].filter((x) => x.version).sort((a, b) => compareVersions(b.version, a.version))[0];
    v.remarque = !v.version ? (v.remarque === "switch" ? "Version inconnue : relever le switch." : "Version inconnue : la noter, puis firmware=… sur sa ligne.")
      : autres.length && max && max.version !== v.version ? `Mettre à jour vers ${max.version} (déjà sur ${max.equipements[0]}), après lecture des avis.`
        : "Comparer aux avis du CERT-FR et du constructeur.";
  });
  const camerasAMettreAJour = liste.filter((v) => !v.remarque.startsWith("Version inconnue") && /Mettre à jour/.test(v.remarque) && !v.equipements.some((n) => parNom.get(n)?.genre === "switch"));
  if (camerasAMettreAJour.length) {
    ajouter(videoF(), { gravite: "conseil", titre: `Harmoniser le firmware de ${pl(camerasAMettreAJour.reduce((t, v) => t + v.equipements.length, 0), "caméra")}`,
      detail: camerasAMettreAJour.map((v) => `${v.modele} ${v.version} → ${v.remarque.match(/vers ([^ ]+)/)?.[1]} : ${enumerer(v.equipements, 5)}`).join(" ; ") + ". Vérifier d'abord les avis du constructeur.",
      equipements: camerasAMettreAJour.flatMap((v) => v.equipements), reference: REF.versions });
  }
  if (!liste.some((v) => v.version)) {
    ajouter(inventaireF(), { gravite: "importante", titre: "Relever les versions logicielles (aucune n'est connue)",
      detail: "Sans version, impossible de savoir si des failles publiées concernent ce parc. « Relever les switchs.bat » les lit automatiquement ; pour les caméras, l'export Genetec (inventaire matériel) les donne.",
      reference: REF.versions });
  }

  /* ================= zones et matrice de flux ================= */
  const zone = (nom: string, l: Equipement[]) => {
    const vl = [...new Set(l.map(vlanDe).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
    const res = [...new Set(l.map(reseau).filter(Boolean))].sort();
    return { groupe: nom, vlans: vl.length ? vl.join(", ") : "—", reseaux: res.length ? (res.length > 4 ? `${res.slice(0, 4).join(", ")}…` : res.join(", ")) : "—", nombre: l.length };
  };
  const z = {
    cam: zone("Caméras", cameras), srv: zone("Enregistreurs / serveurs", serveurs), post: zone("Postes", de("poste")),
    res: zone("Équipements réseau (administration)", de(RESEAU)), tel: zone("Téléphones", de("telephone")), imp: zone("Imprimantes", de("imprimante")),
  };
  const zones = Object.values(z).filter((x) => x.nombre);
  const nomZ = (x: typeof z.cam) => `${x.groupe}${x.vlans !== "—" ? ` · VLAN ${x.vlans}` : ""}${x.reseaux !== "—" ? ` · ${x.reseaux}` : ""}`;
  // Les serveurs vidéo réels : archiveurs Genetec et serveurs de la carte.
  const archiveurs = [...new Set((genetec?.unites ?? []).map((u) => u.archiveur).filter(Boolean))];
  const srvVideo = [...archiveurs.map((a) => `${a} (archiveur)`), ...serveurs.map((s) => `${s.nom}${s.ip ? ` ${s.ip}` : ""}`)];
  const destSrv = srvVideo.length ? enumerer(srvVideo, 6) : nomZ(z.srv);
  const flux: Flux[] = [];
  const f = (cond: boolean, source: string, destination: string, fl: string, decision: Flux["decision"], motif: string) => { if (cond) flux.push({ source, destination, flux: fl, decision, motif }); };
  const a = (x: typeof z.cam) => x.nombre > 0;
  f(a(z.cam) && (a(z.srv) || archiveurs.length > 0), nomZ(z.cam), destSrv, "RTSP 554/TCP (+ RTP), HTTP/HTTPS 80-443/TCP (ONVIF)", "Autoriser", "Enregistrement : les archiveurs vont chercher les flux des caméras.");
  f(a(z.post) && (a(z.srv) || archiveurs.length > 0), nomZ(z.post), destSrv, cg.actif ? "Security Center : Directory 5500/TCP + ports des rôles (selon votre version)" : "HTTPS 443/TCP + ports du logiciel vidéo", "Autoriser", "Exploitation : Security Desk passe par les serveurs, pas par les caméras.");
  f(a(z.post) && a(z.cam), nomZ(z.post), nomZ(z.cam), "tous", "Interdire", "Pas d'accès direct aux caméras depuis les postes (sauf poste d'administration vidéo désigné).");
  f(a(z.cam), nomZ(z.cam), nomZ(z.cam), "tous", "Interdire", "Les caméras n'ont pas à se parler : isolation de ports ou ACL.");
  f(a(z.cam), nomZ(z.cam), "Internet", "tous", "Interdire", "Aucune sortie Internet des caméras (ni cloud constructeur, ni P2P, ni UPnP).");
  f(a(z.res), "Postes d'administration (réseau dédié)", nomZ(z.res), "SSH 22/TCP, HTTPS 443/TCP", "Restreindre", "Administration chiffrée, depuis les seuls postes d'administration.");
  f(a(z.res), "Tout réseau", nomZ(z.res), "Telnet 23/TCP, HTTP 80/TCP, SNMP v1/v2c 161/UDP", "Interdire", "Protocoles en clair : à désactiver sur les équipements.");
  f(a(z.res) || a(z.cam), "Supervision", "Switchs, caméras, serveurs", "SNMPv3 161/UDP, ICMP", "Restreindre", "Surveillance, depuis le serveur de supervision uniquement.");
  f(true, "Tous les équipements", "Serveur de temps interne", "NTP 123/UDP", "Autoriser", "Horloges à l'heure : journaux et preuve vidéo (A.8.17).");
  f(true, "Tous les équipements", "Serveur de journaux", "Syslog 514/UDP ou 6514/TCP (TLS)", "Autoriser", "Journalisation centralisée (A.8.15).");
  f(a(z.tel), nomZ(z.tel), "Serveur de téléphonie (IPBX)", "SIP 5060-5061, RTP (plage de l'IPBX)", "Restreindre", "Voix dans son propre VLAN.");
  f(a(z.imp), nomZ(z.post), nomZ(z.imp), "IPP 631/TCP, RAW 9100/TCP", "Restreindre", "Impression depuis les postes seulement.");
  f(de("borne").length > 0, "Wi-Fi invités", "Réseau interne", "tous", "Interdire", "Réseau invité séparé, sortie Internet seule.");
  f(true, "Tout le reste", "Tout le reste", "tous", "Interdire", "Interdit par défaut : on n'ouvre que ce qui est listé ci-dessus.");
  const ouFiltrer = parefeux.length ? `Sur ${parefeux.map((p) => `${p.nom}${p.infos[0] ? ` (${p.infos[0]})` : ""}`).join(", ")}` : "Sur le pare-feu du site, ou en ACL sur le cœur de réseau";

  const verifications = [
    "Mots de passe par défaut changés sur toutes les caméras, archiveurs et switchs (un compte nominatif par intervenant).",
    "Services inutiles coupés : Telnet, HTTP non chiffré, UPnP, accès « cloud » des caméras, SNMP v1/v2c.",
    "Compte de relevé des switchs en lecture seule.",
    "NTP configuré partout, journaux envoyés vers un serveur central.",
    "Dossier « Config Switch » du relevé rangé à l'abri : il peut contenir des secrets.",
    "Baies et locaux techniques fermés à clé.",
  ];
  if (!cg.actif && cameras.length) verifications.unshift("Importer un export Genetec : caméras hors ligne, non enregistrées et débits ne sont contrôlés qu'avec lui.");
  if (!releve) verifications.unshift("Relever les switchs (« Relever les switchs.bat ») : ports libres, VLAN 1, trunks et versions ne sont contrôlés qu'avec un relevé.");

  /* ================= tri, priorités, compteurs ================= */
  const lesFiches = [...fiches.values()].filter((x) => x.actions.length);
  lesFiches.forEach((x) => {
    x.actions.sort((p, q) => ORDRE[p.gravite] - ORDRE[q.gravite]);
    x.gravite = x.actions[0].gravite;
  });
  const rangType: Record<Fiche["type"], number> = { equipement: 1, video: 1, reseau: 0, inventaire: 2 };
  lesFiches.sort((p, q) => ORDRE[p.gravite] - ORDRE[q.gravite] || rangType[p.type] - rangType[q.type]
    || q.actions.filter((x) => x.gravite === p.gravite).length - p.actions.filter((x) => x.gravite === p.gravite).length || p.cible.localeCompare(q.cible));
  const toutes = lesFiches.flatMap((x) => x.actions.map((action) => ({ cible: x.cible, action })));
  const priorites = [...toutes].sort((p, q) => ORDRE[p.action.gravite] - ORDRE[q.action.gravite]).slice(0, 5);
  const compteurs = { critique: 0, importante: 0, conseil: 0 };
  toutes.forEach((x) => compteurs[x.action.gravite]++);

  return { fiches: lesFiches, priorites, compteurs, flux, ouFiltrer, versions: liste, zones, verifications, genetec: cg, sourcesGenetec: genetec?.sources ?? [] };
}

