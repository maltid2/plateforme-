/**
 * Les commandes à taper sur un switch, selon sa marque, pour appliquer une
 * préconisation : désactiver des ports, changer le VLAN natif d'un trunk,
 * passer un port en accès, contrôler un port, relancer le PoE d'une caméra.
 *
 * Marques prises en charge : Cisco IOS / IOS-XE (Catalyst, Business),
 * Aruba CX (6000, 6100, 6200, 6300, 8xxx) et HP / ArubaOS-Switch (ProCurve,
 * 2530, 2540, 2930…). Pour les autres, l'outil dit quoi faire dans
 * l'interface web du switch (pas de commande inventée).
 *
 * Les commandes de modification sont à passer en fenêtre de maintenance,
 * après une sauvegarde de la configuration.
 */
import type { Equipement } from "./saisie.ts";

export type Marque = "cisco" | "arubacx" | "hp" | "autre";
export const NOM_MARQUE: Record<Marque, string> = { cisco: "Cisco IOS / IOS-XE", arubacx: "Aruba CX", hp: "HP / ArubaOS-Switch", autre: "" };

/** La marque d'un switch : relevée (marque=…), sinon devinée d'après son modèle. */
export function marqueDe(e: Equipement): Marque {
  const t = [e.kv.find(([k]) => k === "marque")?.[1], e.infos[0], e.nom].filter(Boolean).join(" ");
  if (/aruba ?cx|aos-cx|arubaos-cx|\b6[0-4]00[FM]?\b|\b8(1|3|4)\d\d\b|\bJL7\d\dA\b/i.test(t)) return "arubacx";
  if (/cisco|catalyst|\bC9[23]\d\d|\bWS-C|\bC1000|\bCBS\d|IOS/i.test(t)) return "cisco";
  if (/procurve|arubaos-switch|\bHP\b|hewlett|\b(2530|2540|2610|2620|2920|2930F?M?|3810|5400)\b|\bJ\d{4}A\b/i.test(t)) return "hp";
  return "autre";
}

/** Bloc de commandes : mode configuration, les lignes, enregistrement. */
const config = (m: Marque, lignes: string[]) =>
  m === "hp" ? ["configure", ...lignes, "write memory"] : ["configure terminal", ...lignes, "end", "write memory"];

/** Cisco : « interface range » accepte au plus 5 éléments séparés par des virgules. */
function rangesCisco(ports: string[]) {
  const out: string[] = [];
  for (let i = 0; i < ports.length; i += 5) out.push(`interface range ${ports.slice(i, i + 5).join(" , ")}`);
  return out;
}

export function desactiverPorts(m: Marque, ports: string[]): string[] | null {
  if (!ports.length) return null;
  if (m === "cisco") return config(m, rangesCisco(ports).flatMap((r) => [r, " description INUTILISE", " shutdown", " exit"]));
  if (m === "arubacx") return config(m, ports.flatMap((p) => [`interface ${p}`, " description INUTILISE", " shutdown", " exit"]));
  if (m === "hp") return config(m, [`interface ${ports.join(",")} disable`]);
  return null;
}

export function vlanNatif(m: Marque, ports: string[], vlan = 999): string[] | null {
  if (!ports.length) return null;
  const creer = m === "hp" ? [`vlan ${vlan} name NATIF-INUTILISE`] : [`vlan ${vlan}`, " name NATIF-INUTILISE", " exit"];
  if (m === "cisco") return config(m, [...creer, ...rangesCisco(ports).flatMap((r) => [r, ` switchport trunk native vlan ${vlan}`, " exit"])]);
  if (m === "arubacx") return config(m, [...creer, ...ports.flatMap((p) => [`interface ${p}`, ` vlan trunk native ${vlan}`, " exit"])]);
  // ArubaOS-Switch : le VLAN natif d'un trunk est son VLAN « untagged ».
  if (m === "hp") return config(m, [...creer, `vlan ${vlan} untagged ${ports.join(",")}`]);
  return null;
}

export function trunkAutorises(m: Marque, ports: string[], vlans: string): string[] | null {
  if (!ports.length || !vlans) return null;
  if (m === "cisco") return config(m, rangesCisco(ports).flatMap((r) => [r, ` switchport trunk allowed vlan ${vlans}`, " exit"]));
  if (m === "arubacx") return config(m, ports.flatMap((p) => [`interface ${p}`, ` vlan trunk allowed ${vlans}`, " exit"]));
  return null;   // ArubaOS-Switch : VLAN tagués port par port (show vlans ports … detail)
}

export function accesVlan(m: Marque, ports: string[], vlan: string): string[] | null {
  if (!ports.length || !vlan) return null;
  if (m === "cisco") return config(m, rangesCisco(ports).flatMap((r) => [r, " switchport mode access", ` switchport access vlan ${vlan}`, " exit"]));
  if (m === "arubacx") return config(m, ports.flatMap((p) => [`interface ${p}`, ` vlan access ${vlan}`, " exit"]));
  if (m === "hp") return config(m, [`vlan ${vlan} untagged ${ports.join(",")}`]);
  return null;
}

/** Contrôle d'un port (lecture seule) : état, PoE, adresses MAC vues, voisin LLDP. */
export function controlerPort(m: Marque, port: string): string[] | null {
  if (m === "cisco") return [`show interfaces ${port} status`, `show power inline ${port}`, `show mac address-table interface ${port}`, `show logging | include ${port.replace(/^[A-Za-z]+/, "")}`];
  if (m === "arubacx") return [`show interface ${port}`, `show power-over-ethernet ${port}`, `show mac-address-table port ${port}`, `show lldp neighbor-info ${port}`];
  if (m === "hp") return [`show interfaces brief ${port}`, `show power-over-ethernet ${port}`, `show mac-address ${port}`, `show lldp info remote-device ${port}`];
  return null;
}

/** Contrôle d'un lien entre équipements (fibre, cuivre montant) : erreurs, module SFP, voisin. */
export function controlerLien(m: Marque, port: string): string[] | null {
  if (m === "cisco") return /^po/i.test(port)
    ? [`show etherchannel summary`, `show interfaces ${port}`]
    : [`show interfaces ${port}`, `show interfaces ${port} counters errors`, `show interfaces ${port} transceiver detail`, `show cdp neighbors ${port} detail`];
  if (m === "arubacx") return /^lag/i.test(port)
    ? [`show lacp aggregates`, `show interface ${port}`]
    : [`show interface ${port}`, `show interface ${port} transceiver detail`, `show lldp neighbor-info ${port}`];
  if (m === "hp") return [`show interfaces ${port}`, `show trunks`, `show lldp info remote-device ${port}`];
  return null;
}

/** Couper puis remettre l'alimentation PoE d'un ou plusieurs ports (redémarre les caméras). */
export function relancerPoe(m: Marque, port: string | string[]): string[] | null {
  const ps = Array.isArray(port) ? port : [port];
  if (!ps.length) return null;
  if (m === "cisco") return ["configure terminal", ...ps.flatMap((p) => [`interface ${p}`, " power inline never", " power inline auto", " exit"]), "end"];
  if (m === "arubacx") return ["configure terminal", ...ps.flatMap((p) => [`interface ${p}`, " no power-over-ethernet", " power-over-ethernet", " exit"]), "end"];
  if (m === "hp") return ["configure", ...ps.flatMap((p) => [`no interface ${p} power-over-ethernet`, `interface ${p} power-over-ethernet`])];
  return null;
}

/** Ce qui est branché sur un port (plusieurs adresses MAC = switch non géré probable). */
export function macDuPort(m: Marque, port: string): string[] | null {
  if (m === "cisco") return [`show mac address-table interface ${port}`, `show cdp neighbors ${port} detail`, `show lldp neighbors ${port} detail`];
  if (m === "arubacx") return [`show mac-address-table port ${port}`, `show lldp neighbor-info ${port}`];
  if (m === "hp") return [`show mac-address ${port}`, `show lldp info remote-device ${port}`];
  return null;
}

/** Renommer le switch (le nom apparaît dans l'invite, les relevés et LLDP/CDP). */
export function renommer(m: Marque, nom: string): string[] | null {
  if (m === "hp") return config(m, [`hostname "${nom}"`]);
  if (m === "cisco" || m === "arubacx") return config(m, [`hostname ${nom}`]);
  return null;
}

/** Écrire l'emplacement dans le switch (lu par le relevé : « System Location »). */
export function emplacement(m: Marque, texte: string): string[] | null {
  if (m === "cisco") return config(m, [`snmp-server location ${texte}`]);
  if (m === "arubacx") return config(m, [`snmp-server system-location ${texte}`]);
  if (m === "hp") return config(m, [`snmp-server location "${texte}"`]);
  return null;
}

/** Verrouillage d'un port sur l'adresse MAC de l'équipement branché (Cisco seulement : exemple). */
export function verrouillageMac(m: Marque, ports: string[]): string[] | null {
  if (m !== "cisco" || !ports.length) return null;
  return config(m, rangesCisco(ports).flatMap((r) => [r, " switchport mode access", " switchport port-security", " switchport port-security maximum 1",
    " switchport port-security mac-address sticky", " switchport port-security violation restrict", " exit"]));
}
