/**
 * Les commandes à taper sur un switch, selon sa marque, pour appliquer une
 * préconisation : désactiver des ports, VLAN natif, VLAN d'accès, contrôler
 * un port ou un lien, relancer le PoE d'une caméra, renommer, emplacement,
 * IGMP snooping, verrouillage MAC.
 *
 * Une « syntaxe » par famille de switchs (voir SYNTAXES) :
 *   - Cisco IOS / IOS-XE (Catalyst, Business) ;
 *   - Aruba CX (6000, 6100, 6200, 6300, 8xxx) ;
 *   - HP / ArubaOS-Switch (ProCurve, 2530, 2540, 2930…) ;
 *   - MikroTik RouterOS 7 (CRS, pont avec filtrage VLAN) ;
 *   - Planet, CLI de type « ICLI » (GS-4210, GS-5220, GS-6320…) ;
 *   - Zyxel ZyNOS (GS1920, GS2210, XGS2210…).
 * Une commande qu'une famille n'a pas (ou dont la syntaxe varie trop selon
 * le modèle) n'est pas inventée : l'outil renvoie alors à l'interface web.
 * Ajouter une marque = ajouter une syntaxe, rien d'autre à toucher.
 *
 * Les commandes de modification sont à passer en fenêtre de maintenance,
 * après une sauvegarde de la configuration.
 */
import type { Equipement } from "./saisie.ts";

export type Marque = "cisco" | "arubacx" | "hp" | "mikrotik" | "planet" | "zyxel" | "autre";
export const NOM_MARQUE: Record<Marque, string> = {
  cisco: "Cisco IOS / IOS-XE", arubacx: "Aruba CX", hp: "HP / ArubaOS-Switch", mikrotik: "MikroTik RouterOS",
  planet: "Planet", zyxel: "Zyxel ZyNOS", autre: "",
};

/** La marque d'un switch : relevée (marque=…), sinon devinée d'après son modèle ou son nom. */
export function marqueDe(e: Equipement): Marque {
  const t = [e.kv.find(([k]) => k === "marque")?.[1], e.infos[0], e.nom].filter(Boolean).join(" ");
  if (/mikrotik|routeros|\bCRS\d{3}|\bCSS\d{3}|\bRB\d{3,4}/i.test(t)) return "mikrotik";
  if (/planet|\b(GS|MGS|WGS|IGS|SGS|XGS|FGSW)-\d{4}/i.test(t)) return "planet";
  if (/zyxel|zynos|\b(GS|XGS|XS|MGS)(19[2-9]\d|[2-4]\d{3})\b/i.test(t)) return "zyxel";
  if (/aruba ?cx|aos-cx|arubaos-cx|\b6[0-4]00[FM]?\b|\b8(1|3|4)\d\d\b|\bJL7\d\dA\b/i.test(t)) return "arubacx";
  if (/cisco|catalyst|\bC9[23]\d\d|\bWS-C|\bC1000|\bCBS\d|IOS/i.test(t)) return "cisco";
  if (/procurve|arubaos-switch|\bHP\b|hewlett|\b(2530|2540|2610|2620|2920|2930F?M?|3810|5400)\b|\bJ\d{4}A\b/i.test(t)) return "hp";
  return "autre";
}

type Lignes = string[] | null;
/** Ce que sait faire une famille de switchs. Une méthode absente = « dans l'interface web ». */
type Syntaxe = {
  desactiver?(ports: string[]): Lignes;
  vlanNatif?(ports: string[], vlan: number): Lignes;
  trunkAutorises?(ports: string[], vlans: string): Lignes;
  accesVlan?(ports: string[], vlan: string): Lignes;
  controlerPort?(port: string): Lignes;
  controlerLien?(port: string): Lignes;
  relancerPoe?(ports: string[]): Lignes;
  macDuPort?(port: string): Lignes;
  renommer?(nom: string): Lignes;
  emplacement?(texte: string): Lignes;
  igmp?(vlan: string): Lignes;
  agregation?(): Lignes;
  verrouillageMac?(ports: string[]): Lignes;
};

/** Cisco : « interface range » accepte au plus 5 éléments séparés par des virgules. */
function rangesCisco(ports: string[]) {
  const out: string[] = [];
  for (let i = 0; i < ports.length; i += 5) out.push(`interface range ${ports.slice(i, i + 5).join(" , ")}`);
  return out;
}
/** Une même suite de lignes pour chaque port. */
const parPort = (ports: string[], entete: (p: string) => string, lignes: string[]) => ports.flatMap((p) => [entete(p), ...lignes, " exit"]);

const configIos = (l: string[]) => ["configure terminal", ...l, "end", "write memory"];
const cisco: Syntaxe = {
  desactiver: (ps) => configIos(rangesCisco(ps).flatMap((r) => [r, " description INUTILISE", " shutdown", " exit"])),
  vlanNatif: (ps, v) => configIos([`vlan ${v}`, " name NATIF-INUTILISE", " exit", ...rangesCisco(ps).flatMap((r) => [r, ` switchport trunk native vlan ${v}`, " exit"])]),
  trunkAutorises: (ps, v) => configIos(rangesCisco(ps).flatMap((r) => [r, ` switchport trunk allowed vlan ${v}`, " exit"])),
  accesVlan: (ps, v) => configIos(rangesCisco(ps).flatMap((r) => [r, " switchport mode access", ` switchport access vlan ${v}`, " exit"])),
  controlerPort: (p) => [`show interfaces ${p} status`, `show power inline ${p}`, `show mac address-table interface ${p}`, `show logging | include ${p.replace(/^[A-Za-z]+/, "")}`],
  controlerLien: (p) => /^po/i.test(p) ? ["show etherchannel summary", `show interfaces ${p}`]
    : [`show interfaces ${p}`, `show interfaces ${p} counters errors`, `show interfaces ${p} transceiver detail`, `show cdp neighbors ${p} detail`],
  relancerPoe: (ps) => ["configure terminal", ...parPort(ps, (p) => `interface ${p}`, [" power inline never", " power inline auto"]), "end"],
  macDuPort: (p) => [`show mac address-table interface ${p}`, `show cdp neighbors ${p} detail`, `show lldp neighbors ${p} detail`],
  renommer: (n) => configIos([`hostname ${n}`]),
  emplacement: (t) => configIos([`snmp-server location ${t}`]),
  igmp: (v) => configIos(["ip igmp snooping", `ip igmp snooping vlan ${v}`]),
  agregation: () => ["show etherchannel summary", "show spanning-tree blockedports"],
  verrouillageMac: (ps) => configIos(rangesCisco(ps).flatMap((r) => [r, " switchport mode access", " switchport port-security", " switchport port-security maximum 1",
    " switchport port-security mac-address sticky", " switchport port-security violation restrict", " exit"])),
};

const arubacx: Syntaxe = {
  desactiver: (ps) => configIos(parPort(ps, (p) => `interface ${p}`, [" description INUTILISE", " shutdown"])),
  vlanNatif: (ps, v) => configIos([`vlan ${v}`, " name NATIF-INUTILISE", " exit", ...parPort(ps, (p) => `interface ${p}`, [` vlan trunk native ${v}`])]),
  trunkAutorises: (ps, v) => configIos(parPort(ps, (p) => `interface ${p}`, [` vlan trunk allowed ${v}`])),
  accesVlan: (ps, v) => configIos(parPort(ps, (p) => `interface ${p}`, [` vlan access ${v}`])),
  controlerPort: (p) => [`show interface ${p}`, `show power-over-ethernet ${p}`, `show mac-address-table port ${p}`, `show lldp neighbor-info ${p}`],
  controlerLien: (p) => /^lag/i.test(p) ? ["show lacp aggregates", `show interface ${p}`]
    : [`show interface ${p}`, `show interface ${p} transceiver detail`, `show lldp neighbor-info ${p}`],
  relancerPoe: (ps) => ["configure terminal", ...parPort(ps, (p) => `interface ${p}`, [" no power-over-ethernet", " power-over-ethernet"]), "end"],
  macDuPort: (p) => [`show mac-address-table port ${p}`, `show lldp neighbor-info ${p}`],
  renommer: (n) => configIos([`hostname ${n}`]),
  emplacement: (t) => configIos([`snmp-server system-location ${t}`]),
  igmp: (v) => configIos([`vlan ${v}`, " ip igmp snooping enable", " exit"]),
  agregation: () => ["show lacp aggregates", "show spanning-tree"],
};

const configHp = (l: string[]) => ["configure", ...l, "write memory"];
const hp: Syntaxe = {
  desactiver: (ps) => configHp([`interface ${ps.join(",")} disable`]),
  // ArubaOS-Switch : le VLAN natif d'un trunk est son VLAN « untagged ».
  vlanNatif: (ps, v) => configHp([`vlan ${v} name NATIF-INUTILISE`, `vlan ${v} untagged ${ps.join(",")}`]),
  accesVlan: (ps, v) => configHp([`vlan ${v} untagged ${ps.join(",")}`]),
  controlerPort: (p) => [`show interfaces brief ${p}`, `show power-over-ethernet ${p}`, `show mac-address ${p}`, `show lldp info remote-device ${p}`],
  controlerLien: (p) => [`show interfaces ${p}`, "show trunks", `show lldp info remote-device ${p}`],
  relancerPoe: (ps) => ["configure", ...ps.flatMap((p) => [`no interface ${p} power-over-ethernet`, `interface ${p} power-over-ethernet`])],
  macDuPort: (p) => [`show mac-address ${p}`, `show lldp info remote-device ${p}`],
  renommer: (n) => configHp([`hostname "${n}"`]),
  emplacement: (t) => configHp([`snmp-server location "${t}"`]),
  igmp: (v) => configHp([`vlan ${v} ip igmp`]),
  agregation: () => ["show trunks", "show spanning-tree"],
};

// MikroTik : un pont (bridge) avec filtrage VLAN ; la configuration s'enregistre d'elle-même.
const ether = (p: string) => (/^\d+$/.test(p) ? `ether${p}` : p);
const mikrotik: Syntaxe = {
  desactiver: (ps) => [`/interface ethernet disable ${ps.map(ether).join(",")}`, ...ps.map((p) => `/interface ethernet set ${ether(p)} comment=INUTILISE`)],
  vlanNatif: (ps, v) => ps.map((p) => `/interface bridge port set [find interface=${ether(p)}] pvid=${v}`),
  accesVlan: (ps, v) => ps.map((p) => `/interface bridge port set [find interface=${ether(p)}] pvid=${v} frame-types=admit-only-untagged-and-priority-tagged`),
  controlerPort: (p) => [`/interface ethernet monitor ${ether(p)} once`, `/interface ethernet poe monitor ${ether(p)} once`, `/interface bridge host print where on-interface=${ether(p)}`, `/ip neighbor print where interface=${ether(p)}`],
  controlerLien: (p) => [`/interface ethernet monitor ${ether(p)} once`, `/interface print stats where name=${ether(p)}`, `/ip neighbor print where interface=${ether(p)}`],
  relancerPoe: (ps) => ps.map((p) => `/interface ethernet poe power-cycle ${ether(p)} duration=5s`),
  macDuPort: (p) => [`/interface bridge host print where on-interface=${ether(p)}`, `/ip neighbor print where interface=${ether(p)}`],
  renommer: (n) => [`/system identity set name=${n}`],
  emplacement: (t) => [`/snmp set location="${t}"`],
  igmp: () => ["/interface bridge set [find] igmp-snooping=yes"],
  agregation: () => ["/interface bonding print detail", "/interface bridge monitor [find] once"],
};

// Planet (CLI « ICLI ») : ports nommés « GigabitEthernet 1/5 ».
const gi = (p: string) => (/^[a-z]/i.test(p) ? p : `GigabitEthernet ${p.includes("/") ? p : `1/${p}`}`);
const configPlanet = (l: string[]) => ["configure terminal", ...l, "end", "copy running-config startup-config"];
const planet: Syntaxe = {
  desactiver: (ps) => configPlanet(parPort(ps, (p) => `interface ${gi(p)}`, [" description INUTILISE", " shutdown"])),
  vlanNatif: (ps, v) => configPlanet([`vlan ${v}`, " name NATIF-INUTILISE", " exit", ...parPort(ps, (p) => `interface ${gi(p)}`, [` switchport trunk native vlan ${v}`])]),
  trunkAutorises: (ps, v) => configPlanet(parPort(ps, (p) => `interface ${gi(p)}`, [` switchport trunk allowed vlan ${v}`])),
  accesVlan: (ps, v) => configPlanet(parPort(ps, (p) => `interface ${gi(p)}`, [" switchport mode access", ` switchport access vlan ${v}`])),
  controlerPort: (p) => [`show interface ${gi(p)} status`, `show poe interface ${gi(p)}`, `show mac address-table interface ${gi(p)}`, `show lldp neighbors interface ${gi(p)}`],
  controlerLien: (p) => [`show interface ${gi(p)} status`, `show interface ${gi(p)} statistics`, `show lldp neighbors interface ${gi(p)}`],
  macDuPort: (p) => [`show mac address-table interface ${gi(p)}`, `show lldp neighbors interface ${gi(p)}`],
  renommer: (n) => configPlanet([`hostname ${n}`]),
  emplacement: (t) => configPlanet([`snmp-server location ${t}`]),
  igmp: (v) => configPlanet(["ip igmp snooping", `ip igmp snooping vlan ${v}`]),
  agregation: () => ["show spanning-tree"],
};

// Zyxel ZyNOS : les ports se règlent par « interface port-channel <liste> », les VLAN par appartenance.
const configZyxel = (l: string[]) => ["configure", ...l, "exit", "write memory"];
const zyxel: Syntaxe = {
  desactiver: (ps) => configZyxel([`interface port-channel ${ps.join(",")}`, " inactive", " exit"]),
  vlanNatif: (ps, v) => configZyxel([`vlan ${v}`, " name NATIF-INUTILISE", ` fixed ${ps.join(",")}`, ` untagged ${ps.join(",")}`, " exit",
    "vlan 1", ` no untagged ${ps.join(",")}`, " exit", `interface port-channel ${ps.join(",")}`, ` pvid ${v}`, " exit"]),
  accesVlan: (ps, v) => configZyxel([`vlan ${v}`, ` fixed ${ps.join(",")}`, ` untagged ${ps.join(",")}`, " exit", `interface port-channel ${ps.join(",")}`, ` pvid ${v}`, " exit"]),
  controlerPort: (p) => [`show interfaces ${p}`, "show poe-status", `show mac address-table port ${p}`, "show lldp info remote"],
  controlerLien: (p) => [`show interfaces ${p}`, "show lldp info remote"],
  macDuPort: (p) => [`show mac address-table port ${p}`, "show lldp info remote"],
  renommer: (n) => configZyxel([`hostname ${n}`]),
  emplacement: (t) => configZyxel([`snmp-server location ${t}`]),
  igmp: () => configZyxel(["igmp-snooping"]),
  agregation: () => ["show trunk", "show spanning-tree config"],
};

const SYNTAXES: Record<Marque, Syntaxe> = { cisco, arubacx, hp, mikrotik, planet, zyxel, autre: {} };
const avecPorts = (ports: string[], f?: (ps: string[]) => Lignes) => (ports.length && f ? f(ports) : null);

export const desactiverPorts = (m: Marque, ports: string[]) => avecPorts(ports, SYNTAXES[m].desactiver);
export const vlanNatif = (m: Marque, ports: string[], vlan = 999) => avecPorts(ports, SYNTAXES[m].vlanNatif && ((ps) => SYNTAXES[m].vlanNatif!(ps, vlan)));
export const trunkAutorises = (m: Marque, ports: string[], vlans: string) => (vlans ? avecPorts(ports, SYNTAXES[m].trunkAutorises && ((ps) => SYNTAXES[m].trunkAutorises!(ps, vlans))) : null);
export const accesVlan = (m: Marque, ports: string[], vlan: string) => (vlan ? avecPorts(ports, SYNTAXES[m].accesVlan && ((ps) => SYNTAXES[m].accesVlan!(ps, vlan))) : null);
/** Contrôle d'un port (lecture seule) : état, PoE, adresses MAC vues, voisin LLDP. */
export const controlerPort = (m: Marque, port: string) => SYNTAXES[m].controlerPort?.(port) ?? null;
/** Contrôle d'un lien entre équipements (fibre, cuivre montant) : erreurs, module SFP, voisin. */
export const controlerLien = (m: Marque, port: string) => SYNTAXES[m].controlerLien?.(port) ?? null;
/** Couper puis remettre l'alimentation PoE d'un ou plusieurs ports (redémarre les caméras). */
export const relancerPoe = (m: Marque, port: string | string[]) => avecPorts(Array.isArray(port) ? port : [port], SYNTAXES[m].relancerPoe);
/** Ce qui est branché sur un port (plusieurs adresses MAC = switch non géré probable). */
export const macDuPort = (m: Marque, port: string) => SYNTAXES[m].macDuPort?.(port) ?? null;
/** Renommer le switch (le nom apparaît dans l'invite, les relevés et LLDP/CDP). */
export const renommer = (m: Marque, nom: string) => SYNTAXES[m].renommer?.(nom) ?? null;
/** Écrire l'emplacement dans le switch (lu par le relevé : « System Location »). */
export const emplacement = (m: Marque, texte: string) => SYNTAXES[m].emplacement?.(texte) ?? null;
/** IGMP snooping sur le VLAN vidéo : le multicast ne va qu'aux ports qui l'ont demandé. */
export const igmpSnooping = (m: Marque, vlan: string) => SYNTAXES[m].igmp?.(vlan) ?? null;
/** Vérifier une agrégation de liens et l'anti-boucle (lecture seule). */
export const verifierAgregation = (m: Marque) => SYNTAXES[m].agregation?.() ?? null;
/** Verrouillage d'un port sur l'adresse MAC de l'équipement branché (exemple Cisco). */
export const verrouillageMac = (m: Marque, ports: string[]) => avecPorts(ports, SYNTAXES[m].verrouillageMac);
