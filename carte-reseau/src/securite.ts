/**
 * Sécurité et flux : des préconisations tirées des données de la carte.
 *
 * Tout est calculé sur le poste, à partir de ce qui a été saisi ou relevé
 * (types d'équipements, IP, VLAN, câbles, trunks, versions, relevés des
 * switchs). Pas de base de vulnérabilités (CVE) embarquée : sans connexion,
 * elle serait périmée en quelques semaines et donnerait une fausse
 * assurance. À la place, l'outil liste chaque couple modèle / version à
 * comparer aux avis du CERT-FR et du constructeur.
 *
 * Références : ISO/IEC 27001:2022, annexe A (A.5.9 inventaire, A.8.8
 * vulnérabilités techniques, A.8.9 configuration, A.8.14 redondance, A.8.15
 * journalisation, A.8.17 horloges, A.8.20 sécurité des réseaux, A.8.21
 * services réseau, A.8.22 cloisonnement) et guide d'hygiène informatique de
 * l'ANSSI.
 */
import { lireMasque, type Equipement, type Genre, type Inventaire } from "./saisie.ts";
import { comparerGenetec, type Comparaison, type Genetec } from "./genetec.ts";

export type Gravite = "critique" | "importante" | "conseil";
export type Preco = {
  gravite: Gravite; domaine: string; titre: string;
  constat: string; preco: string; equipements: string[]; reference: string;
};
export type Flux = { source: string; destination: string; flux: string; decision: "Autoriser" | "Restreindre" | "Interdire"; motif: string };
export type Version = { modele: string; version: string; equipements: string[]; remarque: string };
export type Bilan = {
  precos: Preco[]; flux: Flux[]; versions: Version[]; zones: { groupe: string; vlans: string; reseaux: string; nombre: number }[]; verifications: string[];
  genetec: Comparaison; sourcesGenetec: Genetec["sources"];
};

const val = (e: Equipement, k: string) => e.kv.find(([c]) => c.toLowerCase() === k)?.[1];
const pl = (n: number, mot: string, pluriel = `${mot}s`) => `${n} ${n > 1 ? pluriel : mot}`;
const enumerer = (noms: string[], max = 6) => (noms.length > max ? `${noms.slice(0, max).join(", ")} et ${noms.length - max} autres` : noms.join(", "));

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

const RESEAU: Genre[] = ["switch", "passerelle", "parefeu", "borne"];
const VIDEO_SRV: Genre[] = ["nvr", "serveur", "nas"];
const UTILISATEURS: Genre[] = ["poste", "imprimante", "telephone"];

export function analyserSecurite(inv: Inventaire, genetec?: Genetec | null): Bilan {
  const precos: Preco[] = [];
  const ajouter = (p: Preco) => { precos.push({ ...p, equipements: [...new Set(p.equipements)] }); };
  const eq = inv.equipements;
  const parNom = new Map(eq.map((e) => [e.nom, e]));
  const de = (g: Genre | Genre[]) => eq.filter((e) => (Array.isArray(g) ? g : [g]).includes(e.genre));
  const lienDe = (e: Equipement) => inv.liaisons.find((l) => (l.a === e.nom || l.b === e.nom) && RESEAU.includes(parNom.get(l.a === e.nom ? l.b : l.a)?.genre ?? "autre"));
  /** VLAN d'un équipement : son champ vlan=, sinon celui de son câble vers le réseau. */
  const vlanDe = (e: Equipement): string | undefined => val(e, "vlan") ?? (lienDe(e)?.mode !== "trunk" ? lienDe(e)?.vlans : undefined);
  const cameras = de("camera"), switchs = de("switch"), serveurs = de(VIDEO_SRV), utilisateurs = de(UTILISATEURS);
  const releve = switchs.some((s) => val(s, "ports-relevés") || val(s, "firmware"));

  /* ================= cloisonnement et flux ================= */
  const vlansCam = new Set(cameras.map(vlanDe).filter(Boolean) as string[]);
  if (cameras.length) {
    const sansVlan = cameras.filter((c) => !vlanDe(c));
    if (sansVlan.length === cameras.length) {
      ajouter({ gravite: "importante", domaine: "Cloisonnement et flux", titre: "Aucun VLAN vidéo identifié",
        constat: `Aucune des ${pl(cameras.length, "caméra")} n'a de VLAN déclaré ou relevé : rien ne montre que la vidéo est séparée du reste du réseau.`,
        preco: "Placer les caméras dans un VLAN dédié à la vidéo, sans autre type d'équipement, et filtrer les flux entre ce VLAN et les autres (matrice de flux ci-dessous).",
        equipements: cameras.map((c) => c.nom).slice(0, 40), reference: "ISO 27001 A.8.22 · ANSSI hygiène (cloisonnement)" });
    } else if (sansVlan.length) {
      ajouter({ gravite: "conseil", domaine: "Cloisonnement et flux", titre: `${pl(sansVlan.length, "caméra")} sans VLAN connu`,
        constat: `Le VLAN de ${enumerer(sansVlan.map((c) => c.nom))} n'est ni déclaré ni relevé.`,
        preco: `Vérifier sur le switch ${sansVlan.length > 1 ? "qu'elles sont" : "qu'elle est"} bien dans le VLAN vidéo, puis l'indiquer (vlan=…).`,
        equipements: sansVlan.map((c) => c.nom), reference: "ISO 27001 A.5.9 · A.8.22" });
    }
    // Des équipements d'utilisateurs ou serveurs dans un VLAN de caméras.
    const melanges = eq.filter((e) => !["camera", ...RESEAU, ...VIDEO_SRV].includes(e.genre) && vlansCam.has(vlanDe(e) ?? "§"));
    if (melanges.length) {
      ajouter({ gravite: "importante", domaine: "Cloisonnement et flux", titre: "VLAN vidéo partagé avec d'autres équipements",
        constat: `${enumerer(melanges.map((e) => `${e.nom} (${e.genre})`))} ${melanges.length > 1 ? "sont" : "est"} dans le même VLAN que des caméras (${[...vlansCam].join(", ")}).`,
        preco: "Sortir ces équipements du VLAN vidéo : un poste compromis ne doit pas pouvoir joindre directement les caméras.",
        equipements: melanges.map((e) => e.nom), reference: "ISO 27001 A.8.22" });
    }
    // Même réseau IP pour caméras et postes / téléphones / imprimantes.
    const resCam = new Set(cameras.map(reseau).filter(Boolean) as string[]);
    const memeRes = utilisateurs.filter((u) => resCam.has(reseau(u) ?? "§"));
    if (memeRes.length) {
      ajouter({ gravite: "importante", domaine: "Cloisonnement et flux", titre: "Caméras et postes dans le même réseau IP",
        constat: `${enumerer(memeRes.map((e) => e.nom))} ${memeRes.length > 1 ? "partagent" : "partage"} un réseau IP avec des caméras (${[...resCam].filter((r) => memeRes.some((u) => reseau(u) === r)).join(", ")}).`,
        preco: "Donner à la vidéo son propre plan d'adressage (un réseau par VLAN) pour pouvoir la filtrer au routeur ou au pare-feu.",
        equipements: memeRes.map((e) => e.nom), reference: "ISO 27001 A.8.22" });
    }
  }
  // Administration des switchs dans un réseau d'utilisateurs ou de caméras.
  const resUtil = new Set([...cameras, ...utilisateurs].map(reseau).filter(Boolean) as string[]);
  const adminMelange = switchs.filter((s) => resUtil.has(reseau(s) ?? "§"));
  if (adminMelange.length) {
    ajouter({ gravite: "importante", domaine: "Administration et accès", titre: "Administration des switchs non isolée",
      constat: `L'adresse d'administration de ${enumerer(adminMelange.map((s) => s.nom))} est dans le même réseau que des caméras ou des postes.`,
      preco: "Créer un VLAN / réseau d'administration réservé aux équipements réseau, joignable seulement depuis les postes d'administration (SSH, HTTPS).",
      equipements: adminMelange.map((s) => s.nom), reference: "ISO 27001 A.8.22 · A.8.2 · ANSSI (réseau d'administration dédié)" });
  }
  // VLAN 1 utilisé.
  const vlan1 = [
    ...eq.filter((e) => !RESEAU.includes(e.genre) && vlanDe(e) === "1").map((e) => e.nom),
    ...switchs.filter((s) => val(s, "acces-vlan1")).map((s) => `${s.nom} (${val(s, "acces-vlan1")})`),
  ];
  const natif1 = switchs.filter((s) => val(s, "trunk-natif-vlan1"));
  if (vlan1.length) {
    ajouter({ gravite: "importante", domaine: "Cloisonnement et flux", titre: "Équipements dans le VLAN 1",
      constat: `${enumerer(vlan1)} : VLAN 1, le VLAN par défaut de tous les switchs.`,
      preco: "Ne rien laisser dans le VLAN 1 : un équipement branché sur un port non configuré s'y retrouve aussi. Utiliser des VLAN dédiés.",
      equipements: vlan1.map((x) => x.split(" (")[0]), reference: "ISO 27001 A.8.20 · ANSSI" });
  }
  if (natif1.length) {
    ajouter({ gravite: "conseil", domaine: "Cloisonnement et flux", titre: "VLAN natif 1 sur les trunks",
      constat: natif1.map((s) => `${s.nom} : ${val(s, "trunk-natif-vlan1")}`).join(" · "),
      preco: "Mettre un VLAN natif inutilisé (ex. 999) sur les trunks, le même aux deux bouts, pour éviter le saut de VLAN (VLAN hopping).",
      equipements: natif1.map((s) => s.nom), reference: "ISO 27001 A.8.20" });
  }
  // Trunks qui transportent tous les VLAN.
  const tous = switchs.filter((s) => val(s, "trunk-tous-vlan"));
  if (tous.length) {
    ajouter({ gravite: "conseil", domaine: "Cloisonnement et flux", titre: "Trunks ouverts à tous les VLAN",
      constat: tous.map((s) => `${s.nom} : ${val(s, "trunk-tous-vlan")}`).join(" · "),
      preco: "Limiter chaque trunk aux VLAN réellement utilisés de l'autre côté (switchport trunk allowed vlan …).",
      equipements: tous.map((s) => s.nom), reference: "ISO 27001 A.8.22" });
  }
  // Trunk vers un équipement terminal.
  const finaux = inv.liaisons.filter((l) => l.mode === "trunk").flatMap((l) => [l.a, l.b])
    .map((n) => parNom.get(n)).filter((e): e is Equipement => !!e && ["camera", "poste", "imprimante", "telephone", "autre"].includes(e.genre));
  if (finaux.length) {
    ajouter({ gravite: "importante", domaine: "Cloisonnement et flux", titre: "Trunk vers un équipement terminal",
      constat: `${enumerer([...new Set(finaux.map((e) => e.nom))])} ${finaux.length > 1 ? "reçoivent" : "reçoit"} un trunk (plusieurs VLAN).`,
      preco: "Un poste, une caméra ou une imprimante n'a besoin que d'un VLAN : passer le port en mode accès (un seul VLAN).",
      equipements: [...new Set(finaux.map((e) => e.nom))], reference: "ISO 27001 A.8.20 · A.8.22" });
  }
  // Pas de filtrage entre zones.
  const parefeux = de("parefeu");
  if (cameras.length && !parefeux.length) {
    ajouter({ gravite: "importante", domaine: "Cloisonnement et flux", titre: "Aucun pare-feu sur la carte",
      constat: `${pl(cameras.length, "caméra")} et aucun pare-feu déclaré ou vu : on ne voit pas où les flux entre la vidéo, les postes et l'extérieur sont filtrés.`,
      preco: "Filtrer les flux entre VLAN (pare-feu ou ACL sur le cœur de réseau) selon la matrice de flux ; interdire l'accès Internet des caméras.",
      equipements: [], reference: "ISO 27001 A.8.20 · A.8.22" });
  }

  /* ================= administration et accès ================= */
  const libres = switchs.filter((s) => Number(val(s, "ports-libres-actifs") ?? 0) > 0);
  if (libres.length) {
    const total = libres.reduce((t, s) => t + Number(val(s, "ports-libres-actifs")), 0);
    ajouter({ gravite: "importante", domaine: "Administration et accès", titre: `${total} ${total > 1 ? "ports libres restés actifs" : "port libre resté actif"}`,
      constat: libres.map((s) => `${s.nom} : ${val(s, "ports-libres-actifs")}`).join(" · "),
      preco: "Désactiver les ports non utilisés (shutdown) ou les mettre dans un VLAN « parking » sans accès : n'importe qui peut sinon se brancher sur le réseau.",
      equipements: libres.map((s) => s.nom), reference: "ISO 27001 A.8.20 · ANSSI (ports inutilisés)" });
  }
  const multi = switchs.filter((s) => val(s, "multi-mac"));
  if (multi.length) {
    ajouter({ gravite: "importante", domaine: "Administration et accès", titre: "Plusieurs équipements sur un même port",
      constat: multi.map((s) => `${s.nom} : ${val(s, "multi-mac")}`).join(" · "),
      preco: "Un switch non administré ou un concentrateur est probablement branché là. L'identifier, puis limiter le nombre d'adresses MAC par port (port-security) ou authentifier (802.1X).",
      equipements: multi.map((s) => s.nom), reference: "ISO 27001 A.8.20 · A.5.9" });
  }
  const echecs = switchs.filter((s) => /non relev|marque inconnue|partiel/i.test(val(s, "releve") ?? ""));
  const cleModifiee = echecs.filter((s) => /cl[ée] d.h[ôo]te/i.test(val(s, "releve") ?? ""));
  if (cleModifiee.length) {
    ajouter({ gravite: "critique", domaine: "Administration et accès", titre: "Clé SSH d'un switch modifiée",
      constat: `${enumerer(cleModifiee.map((s) => s.nom))} : la clé d'hôte SSH a changé depuis le dernier relevé.`,
      preco: "Vérifier sur place si le switch a été remplacé ou réinitialisé. Sinon, une interception (équipement intercalé) est possible : ne pas saisir d'identifiants tant que ce n'est pas expliqué.",
      equipements: cleModifiee.map((s) => s.nom), reference: "ISO 27001 A.8.20 · A.8.16" });
  }
  const autresEchecs = echecs.filter((s) => !cleModifiee.includes(s));
  if (autresEchecs.length) {
    ajouter({ gravite: "conseil", domaine: "Administration et accès", titre: "Switchs non relevés ou en partie",
      constat: autresEchecs.map((s) => `${s.nom} : ${val(s, "releve")}`).join(" · "),
      preco: "Un switch qu'on ne peut pas relever ne peut pas être contrôlé : fournir le bon compte (en lecture seule si possible) et relancer « Relever les switchs.bat ».",
      equipements: autresEchecs.map((s) => s.nom), reference: "ISO 27001 A.5.9 · A.8.9" });
  }
  const voisins = eq.filter((e) => /voisin/i.test(val(e, "source") ?? "") && RESEAU.includes(e.genre));
  if (voisins.length) {
    ajouter({ gravite: "conseil", domaine: "Inventaire", titre: "Équipements réseau vus mais pas relevés",
      constat: `${enumerer(voisins.map((e) => e.nom))} : vus par les switchs voisins (LLDP/CDP), absents du relevé.`,
      preco: "Les ajouter à la liste des switchs à relever, ou confirmer qu'ils sont gérés par un autre service (opérateur, pare-feu managé…).",
      equipements: voisins.map((e) => e.nom), reference: "ISO 27001 A.5.9" });
  }

  /* ================= liaisons ================= */
  const radio = inv.liaisons.filter((l) => l.media === "radio"), vpn = inv.liaisons.filter((l) => l.media === "vpn");
  if (radio.length) {
    ajouter({ gravite: "importante", domaine: "Liaisons", titre: "Liaisons radio",
      constat: radio.map((l) => `${l.a} ↔ ${l.b}`).join(" · "),
      preco: "Chiffrer le pont radio (WPA2/WPA3 ou chiffrement du constructeur, clé longue propre au site), masquer ou filtrer l'accès à son interface d'administration.",
      equipements: radio.flatMap((l) => [l.a, l.b]), reference: "ISO 27001 A.8.20 · A.8.24" });
  }
  if (vpn.length) {
    ajouter({ gravite: "conseil", domaine: "Liaisons", titre: "Liaisons par VPN / Internet",
      constat: vpn.map((l) => `${l.a} ↔ ${l.b}`).join(" · "),
      preco: "VPN IPsec ou TLS avec certificats (pas de clé partagée faible), filtrer les flux qui le traversent comme entre deux VLAN.",
      equipements: vpn.flatMap((l) => [l.a, l.b]), reference: "ISO 27001 A.8.20 · A.8.21" });
  }

  /* ================= disponibilité ================= */
  // Switch d'accès raccordé au reste par un seul câble, avec plusieurs caméras derrière.
  const liensSw = (s: Equipement) => inv.liaisons.filter((l) => (l.a === s.nom || l.b === s.nom) && RESEAU.includes(parNom.get(l.a === s.nom ? l.b : l.a)?.genre ?? "autre"));
  const camsDe = (s: Equipement) => inv.liaisons.filter((l) => (l.a === s.nom || l.b === s.nom) && parNom.get(l.a === s.nom ? l.b : l.a)?.genre === "camera").length;
  const uniques = switchs.filter((s) => liensSw(s).length === 1 && camsDe(s) >= 8);
  if (uniques.length) {
    ajouter({ gravite: "conseil", domaine: "Disponibilité", titre: "Un seul lien pour beaucoup de caméras",
      constat: uniques.map((s) => `${s.nom} : ${camsDe(s)} caméras, 1 seul lien`).join(" · "),
      preco: "Doubler la liaison (deuxième fibre ou agrégation) pour les switchs qui portent beaucoup de caméras.",
      equipements: uniques.map((s) => s.nom), reference: "ISO 27001 A.8.14" });
  }
  const anomalies = switchs.filter((s) => val(s, "anomalies"));
  if (anomalies.length) {
    const crit = anomalies.filter((s) => /critique/.test(val(s, "anomalies")!));
    ajouter({ gravite: crit.length ? "critique" : "conseil", domaine: "Disponibilité", titre: "Anomalies relevées sur les switchs",
      constat: anomalies.map((s) => `${s.nom} : ${val(s, "anomalies")!.split(" — ")[0]}`).join(" · "),
      preco: "Traiter les anomalies listées sur la fiche de chaque switch (liaison agrégée dégradée, erreurs de port, VLAN différents aux deux bouts d'un lien, PoE saturé…).",
      equipements: anomalies.map((s) => s.nom), reference: "ISO 27001 A.8.16 · A.8.14" });
  }

  /* ================= inventaire et versions ================= */
  const ips = new Map<string, string[]>();
  eq.forEach((e) => { if (e.ip) ips.set(e.ip.split("/")[0], [...(ips.get(e.ip.split("/")[0]) ?? []), e.nom]); });
  const doublons = [...ips].filter(([, n]) => n.length > 1);
  if (doublons.length) {
    ajouter({ gravite: "critique", domaine: "Inventaire", titre: "Adresses IP en double",
      constat: doublons.map(([ip, n]) => `${ip} : ${n.join(", ")}`).join(" · "),
      preco: "Une même IP sur deux équipements provoque des coupures et peut masquer une usurpation : corriger l'adressage (ou l'inventaire s'il s'agit d'une erreur de saisie).",
      equipements: doublons.flatMap(([, n]) => n), reference: "ISO 27001 A.5.9 · A.8.20" });
  }
  const sansIp = eq.filter((e) => !e.ip && ["camera", "switch", "nvr", "serveur", "parefeu", "passerelle"].includes(e.genre) && !/voisin/i.test(val(e, "source") ?? ""));
  if (sansIp.length) {
    ajouter({ gravite: "conseil", domaine: "Inventaire", titre: `${pl(sansIp.length, "équipement")} sans IP connue`,
      constat: enumerer(sansIp.map((e) => e.nom), 10),
      preco: "Compléter l'inventaire : sans IP, impossible de contrôler les flux ou les mises à jour de ces équipements.",
      equipements: sansIp.map((e) => e.nom), reference: "ISO 27001 A.5.9" });
  }
  /* ================= Genetec ↔ réseau ================= */
  const cg = comparerGenetec(inv, genetec);
  const ou = (r: { switch?: string; port?: string }) => (r.switch ? ` (${r.switch}${r.port ? ` port ${r.port}` : ""})` : "");
  const nomU = (r: { unite: { nom: string; ip: string; mac: string }; eq: Equipement | null }) => r.eq?.nom ?? (r.unite.nom || r.unite.ip || r.unite.mac);
  if (cg.actif) {
    const surReseau = cg.horsLigne.filter((r) => r.eq && r.switch);
    const introuvables = cg.horsLigne.filter((r) => !r.eq || !r.switch);
    if (surReseau.length) {
      ajouter({ gravite: "critique", domaine: "Vidéo (Genetec)", titre: `${surReseau.length} ${surReseau.length > 1 ? "caméras hors ligne" : "caméra hors ligne"} dans Genetec`,
        constat: enumerer(surReseau.map((r) => `${nomU(r)}${ou(r)}`), 12),
        preco: "Aller voir le port indiqué : câble, PoE (voyant, budget du switch), alimentation de la caméra. Si le port est actif et la caméra répond au ping, vérifier côté Genetec (identifiants, archiveur, licence).",
        equipements: surReseau.map((r) => r.eq!.nom).concat(surReseau.map((r) => r.switch!)), reference: "ISO 27001 A.8.16 · A.8.14" });
    }
    if (introuvables.length) {
      ajouter({ gravite: "importante", domaine: "Vidéo (Genetec)", titre: `${introuvables.length} ${introuvables.length > 1 ? "caméras hors ligne et non localisées" : "caméra hors ligne et non localisée"}`,
        constat: enumerer(introuvables.map((r) => `${nomU(r)}${r.unite.ip ? ` · ${r.unite.ip}` : ""}`), 12),
        preco: "Hors ligne dans Genetec et absentes de la carte : la retrouver (switch non relevé, câble arraché, caméra déposée), puis relever le switch concerné.",
        equipements: introuvables.filter((r) => r.eq).map((r) => r.eq!.nom), reference: "ISO 27001 A.5.9 · A.8.16" });
    }
    const absentesEnLigne = cg.absentes.filter((r) => r.etat !== "hors ligne");
    if (absentesEnLigne.length) {
      ajouter({ gravite: "conseil", domaine: "Vidéo (Genetec)", titre: `${absentesEnLigne.length} ${absentesEnLigne.length > 1 ? "caméras Genetec absentes" : "caméra Genetec absente"} de la carte`,
        constat: enumerer(absentesEnLigne.map((r) => `${r.unite.nom || r.unite.mac}${r.unite.ip ? ` · ${r.unite.ip}` : ""}`), 12),
        preco: "Elles enregistrent mais on ne sait pas où elles sont branchées : relever les switchs manquants (ou les ajouter à la carte avec leur port).",
        equipements: [], reference: "ISO 27001 A.5.9" });
    }
    if (cg.nonEnregistrees.length && genetec?.unites.length) {
      ajouter({ gravite: "importante", domaine: "Vidéo (Genetec)", titre: `${cg.nonEnregistrees.length} ${cg.nonEnregistrees.length > 1 ? "caméras du réseau absentes" : "caméra du réseau absente"} de Genetec`,
        constat: enumerer(cg.nonEnregistrees.map((e) => e.nom), 12),
        preco: "Branchées sur le réseau mais inconnues de Genetec : pas d'enregistrement. Les ajouter au logiciel vidéo, ou les débrancher si ce ne sont pas des caméras du site (équipement non autorisé).",
        equipements: cg.nonEnregistrees.map((e) => e.nom), reference: "ISO 27001 A.5.9 · A.8.1" });
    }
    if (cg.ecartsIp.length) {
      ajouter({ gravite: "importante", domaine: "Vidéo (Genetec)", titre: "IP différente entre Genetec et le réseau",
        constat: cg.ecartsIp.map((r) => `${nomU(r)} : Genetec ${r.unite.ip}, réseau ${r.eq!.ip}`).join(" · "),
        preco: "Même adresse MAC, IP différente : la caméra a changé d'IP (DHCP ?) ou Genetec pointe une ancienne adresse. Fixer l'IP (réservation ou IP fixe) et corriger Genetec.",
        equipements: cg.ecartsIp.map((r) => r.eq!.nom), reference: "ISO 27001 A.8.9" });
    }
    if (cg.doublonsIp.length) {
      ajouter({ gravite: "critique", domaine: "Vidéo (Genetec)", titre: "Même IP pour plusieurs caméras dans Genetec",
        constat: cg.doublonsIp.map((d) => `${d.ip} : ${d.noms.join(", ")}`).join(" · "),
        preco: "Conflit d'adresse : une seule de ces caméras peut fonctionner. Corriger l'adressage, puis Genetec.",
        equipements: [], reference: "ISO 27001 A.8.9 · A.8.20" });
    }
    if (cg.ecartsNom.length) {
      ajouter({ gravite: "conseil", domaine: "Vidéo (Genetec)", titre: "Noms différents entre Genetec et la carte",
        constat: enumerer(cg.ecartsNom.map((r) => `${r.eq!.nom} = « ${r.unite.nom} »`), 10),
        preco: "Utiliser le même nom partout (carte, Genetec, étiquette sur la caméra) : c'est ce qui permet de s'y retrouver en dépannage.",
        equipements: cg.ecartsNom.map((r) => r.eq!.nom), reference: "ISO 27001 A.5.9" });
    }
    const satures = cg.debitParSwitch.filter((d) => d.capaciteMbps && d.kbps / 1000 > d.capaciteMbps * 0.7);
    if (satures.length) {
      ajouter({ gravite: "importante", domaine: "Cloisonnement et flux", titre: "Lien montant proche de la saturation",
        constat: satures.map((d) => `${d.switch} : ${(d.kbps / 1000).toFixed(0)} Mb/s de vidéo pour un lien de ${d.capaciteMbps! >= 1000 ? `${d.capaciteMbps! / 1000} Gb/s` : `${d.capaciteMbps} Mb/s`}`).join(" · "),
        preco: "Au-delà de 70 % du lien, les images se dégradent aux heures chargées : passer le lien en 10G, l'agréger, ou réduire les débits (H.265, images/s).",
        equipements: satures.map((d) => d.switch), reference: "ISO 27001 A.8.14 · A.8.6" });
    }
  }

  const modeleDe = (e: Equipement) => e.infos[0] ?? "";
  const versions = new Map<string, Version>();
  // (une caméra dont Genetec donne la version est comptée avec la version Genetec, plus bas)
  const versionGenetec = new Set(cg.rapproches.filter((r) => r.eq && r.unite.firmware).map((r) => r.eq!.nom));
  eq.filter((e) => (modeleDe(e) || val(e, "firmware")) && !versionGenetec.has(e.nom)).forEach((e) => {
    const k = `${modeleDe(e)}§${val(e, "firmware") ?? ""}`;
    const v = versions.get(k) ?? { modele: modeleDe(e) || "(modèle inconnu)", version: val(e, "firmware") ?? "", equipements: [], remarque: e.genre === "switch" ? "switch" : "" };
    v.equipements.push(e.nom);
    versions.set(k, v);
  });
  // Versions des caméras connues de Genetec (rapprochées ou non de la carte).
  (genetec?.unites ?? []).filter((u) => u.firmware || u.modele).forEach((u) => {
    const modele = [u.fabricant, u.modele].filter(Boolean).join(" ") || "(modèle inconnu)";
    const k = `G§${modele}§${u.firmware}`;
    const v = versions.get(k) ?? { modele, version: u.firmware, equipements: [], remarque: "" };
    const r = cg.rapproches.find((x) => x.unite === u);
    v.equipements.push(r?.eq?.nom ?? (u.nom || u.ip));
    versions.set(k, v);
  });
  const liste = [...versions.values()].sort((a, b) => a.modele.localeCompare(b.modele) || a.version.localeCompare(b.version));
  liste.forEach((v) => {
    const memeModele = liste.filter((x) => x.modele === v.modele && x.version && x.version !== v.version);
    v.remarque = !v.version ? (v.remarque === "switch" ? "Version inconnue : relever le switch (show version) pour pouvoir la vérifier."
      : "Version inconnue : la noter (page d'information de l'équipement ou logiciel vidéo), puis firmware=… sur sa ligne.")
      : memeModele.length ? `Versions différentes pour ce modèle (${memeModele.map((x) => x.version).join(", ")}) : harmoniser sur la plus récente supportée.`
        : "Comparer aux avis du CERT-FR et du constructeur.";
  });
  const heterogenes = [...new Set(liste.filter((v) => /différentes/.test(v.remarque)).map((v) => v.modele))];
  if (heterogenes.length) {
    ajouter({ gravite: "conseil", domaine: "Vulnérabilités et versions", titre: "Versions logicielles différentes sur un même modèle",
      constat: heterogenes.map((m) => `${m} : ${liste.filter((v) => v.modele === m).map((v) => `${v.version} (${v.equipements.length})`).join(", ")}`).join(" · "),
      preco: "Harmoniser sur la dernière version supportée par le constructeur, après vérification des avis de sécurité.",
      equipements: liste.filter((v) => heterogenes.includes(v.modele)).flatMap((v) => v.equipements), reference: "ISO 27001 A.8.8 · A.8.9" });
  }
  const avecVersion = liste.filter((v) => v.version);
  ajouter({ gravite: avecVersion.length ? "conseil" : "importante", domaine: "Vulnérabilités et versions",
    titre: avecVersion.length ? `${pl(avecVersion.length, "version")} à vérifier contre les failles connues` : "Versions logicielles inconnues",
    constat: avecVersion.length
      ? `${avecVersion.length} ${avecVersion.length > 1 ? "couples modèle / version, listés" : "couple modèle / version, listé"} dans le tableau « Versions à vérifier ».`
      : "Aucune version de logiciel (firmware) n'est connue : impossible de savoir si des failles publiées concernent ce parc.",
    preco: avecVersion.length
      ? "Comparer chaque version aux avis du CERT-FR (cert.ssi.gouv.fr) et du constructeur, au moins à chaque relevé. L'outil ne contient pas de base CVE : hors ligne, elle serait vite périmée."
      : "Relever les switchs avec « Relever les switchs.bat » (versions lues automatiquement) ou renseigner firmware=… pour les autres équipements.",
    equipements: [], reference: "ISO 27001 A.8.8" });
  const dates = switchs.map((s) => val(s, "releve-date")).filter(Boolean) as string[];
  if (dates.length) {
    const plusVieux = dates.sort()[0];
    const jours = Math.floor((Date.now() - new Date(plusVieux).getTime()) / 864e5);
    if (jours > 90) {
      ajouter({ gravite: "conseil", domaine: "Inventaire", titre: "Relevé ancien",
        constat: `Le plus ancien relevé date du ${new Date(plusVieux).toLocaleDateString("fr-FR")} (${jours} jours).`,
        preco: "Relancer le relevé au moins chaque trimestre et après chaque intervention : la carte et ces préconisations en dépendent.",
        equipements: [], reference: "ISO 27001 A.5.9 · A.8.9" });
    }
  }

  /* ================= zones et matrice de flux ================= */
  const zone = (nom: string, liste: Equipement[]) => {
    const vl = [...new Set(liste.map(vlanDe).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
    const res = [...new Set(liste.map(reseau).filter(Boolean))].sort();
    return { groupe: nom, vlans: vl.length ? vl.join(", ") : "—", reseaux: res.length ? (res.length > 4 ? `${res.slice(0, 4).join(", ")}…` : res.join(", ")) : "—", nombre: liste.length };
  };
  const z = {
    cam: zone("Caméras", cameras), srv: zone("Enregistreurs / serveurs", serveurs), post: zone("Postes", de("poste")),
    res: zone("Équipements réseau (administration)", de(RESEAU)), tel: zone("Téléphones", de("telephone")), imp: zone("Imprimantes", de("imprimante")),
  };
  const zones = Object.values(z).filter((x) => x.nombre);
  const nomZ = (x: typeof z.cam) => `${x.groupe}${x.vlans !== "—" ? ` · VLAN ${x.vlans}` : ""}`;
  const flux: Flux[] = [];
  const f = (cond: boolean, source: string, destination: string, fl: string, decision: Flux["decision"], motif: string) => { if (cond) flux.push({ source, destination, flux: fl, decision, motif }); };
  const a = (x: typeof z.cam) => x.nombre > 0;
  f(a(z.cam) && a(z.srv), nomZ(z.cam), nomZ(z.srv), "RTSP 554/TCP (+ RTP), ONVIF HTTP/HTTPS 80-443/TCP", "Autoriser", "Enregistrement des flux vidéo.");
  f(a(z.post) && a(z.srv), nomZ(z.post), nomZ(z.srv), "HTTPS 443/TCP + ports du logiciel vidéo (selon l'éditeur)", "Autoriser", "Exploitation : les postes passent par le logiciel vidéo.");
  f(a(z.post) && a(z.cam), nomZ(z.post), nomZ(z.cam), "tous", "Interdire", "Pas d'accès direct aux caméras depuis les postes (sauf poste d'administration vidéo désigné).");
  f(a(z.cam), nomZ(z.cam), nomZ(z.cam), "tous", "Interdire", "Les caméras n'ont pas à se parler : limite la propagation d'une caméra compromise (isolation de ports / ACL).");
  f(a(z.cam), nomZ(z.cam), "Internet", "tous", "Interdire", "Aucune sortie Internet pour les caméras (ni « cloud » constructeur, ni P2P, ni UPnP).");
  f(a(z.res), "Postes d'administration (réseau dédié)", nomZ(z.res), "SSH 22/TCP, HTTPS 443/TCP", "Restreindre", "Administration chiffrée, depuis les seuls postes d'administration.");
  f(a(z.res), "Tout réseau", nomZ(z.res), "Telnet 23, HTTP 80, SNMP v1/v2c 161/UDP", "Interdire", "Protocoles d'administration non chiffrés : les désactiver sur les équipements.");
  f(a(z.res) || a(z.cam), "Supervision", "Tous les équipements", "SNMPv3 161/UDP, ICMP", "Restreindre", "Surveillance, depuis le serveur de supervision uniquement.");
  f(true, "Tous les équipements", "Serveur de temps interne", "NTP 123/UDP", "Autoriser", "Horloges à l'heure : indispensable pour les journaux et la preuve vidéo (A.8.17).");
  f(true, "Tous les équipements", "Serveur de journaux", "Syslog 514/UDP ou 6514/TCP (TLS)", "Autoriser", "Journalisation centralisée (A.8.15).");
  f(a(z.tel), nomZ(z.tel), "Serveur de téléphonie (IPBX)", "SIP 5060-5061, RTP (plage de l'IPBX)", "Restreindre", "Voix dans son propre VLAN.");
  f(a(z.imp), nomZ(z.post), nomZ(z.imp), "IPP 631/TCP, RAW 9100/TCP", "Restreindre", "Impression depuis les postes seulement.");
  f(de("borne").length > 0, "Wi-Fi invités", "Réseau interne", "tous", "Interdire", "Réseau invité séparé, sortie Internet seule.");
  f(true, "Tout le reste", "Tout le reste", "tous", "Interdire", "Interdit par défaut : on n'ouvre que ce qui est listé ci-dessus.");

  const verifications = [
    "Mots de passe par défaut changés sur toutes les caméras, enregistreurs et switchs (un compte nominatif par intervenant).",
    "Services inutiles désactivés : Telnet, HTTP non chiffré, UPnP, accès « cloud » des caméras, SNMP v1/v2c.",
    "Comptes d'administration : droits limités, compte de relevé en lecture seule.",
    "Heure synchronisée (NTP) sur tous les équipements, journaux envoyés vers un serveur central.",
    "Sauvegarde des configurations des switchs (dossier « Config Switch » du relevé) rangée à l'abri : elle peut contenir des secrets.",
    "Baies et locaux techniques fermés à clé, ports réseau accessibles au public désactivés.",
    "Mise à jour des logiciels planifiée après lecture des avis CERT-FR / constructeur.",
  ];
  if (!cg.actif && cameras.length) verifications.unshift("Importer un export Genetec (inventaire matériel, et configuration des caméras pour les débits) : caméras hors ligne, non enregistrées et débits ne sont contrôlés qu'avec lui.");
  if (!releve) verifications.unshift("Relever les switchs (« Relever les switchs.bat ») : ports libres actifs, VLAN 1, trunks et versions ne sont contrôlés qu'avec un relevé.");

  const ordre: Record<Gravite, number> = { critique: 0, importante: 1, conseil: 2 };
  precos.sort((x, y) => ordre[x.gravite] - ordre[y.gravite]);
  return { precos, flux, versions: liste, zones, verifications, genetec: cg, sourcesGenetec: genetec?.sources ?? [] };
}
