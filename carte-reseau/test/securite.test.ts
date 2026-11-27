import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { analyser } from "../src/saisie.ts";
import { analyserSecurite, codeLieu, nomParDefaut } from "../src/securite.ts";
import { relevesVersTexte } from "../src/releve.ts";
import { accesVlan, desactiverPorts, igmpSnooping, marqueDe, relancerPoe, renommer, vlanNatif } from "../src/commandes.ts";
import { analyserFlux, capaciteLien } from "../src/flux.ts";
import { comparerGenetec } from "../src/genetec.ts";

const bilan = (t: string) => analyserSecurite(analyser(t));
const mesure = (b: ReturnType<typeof bilan>, id: string) => b.mesures.find((m) => m.id === id)!;
const textes = (b: ReturnType<typeof bilan>, id: string) => mesure(b, id).elements.map((e) => `${e.cible}: ${e.texte}`);

test("Préconisations : mesures par classe, avec le pourquoi et l'effet sur le dépannage", () => {
  const b = bilan("site Lyon\nswitch SW-1 | ip 10.0.1.2");
  assert.deepEqual([...new Set(b.mesures.map((m) => m.classe))], [1, 2, 3]);
  b.mesures.forEach((m) => { assert.ok(m.pourquoi.length > 20, m.id); assert.ok(m.impactTexte, m.id); assert.ok(m.constat, m.id); });
  // Le verrouillage par MAC est en classe 3, avec un impact fort sur le dépannage.
  assert.equal(mesure(b, "mac").classe, 3);
  assert.equal(mesure(b, "mac").impact, "fort");
  // Pas d'ACL ni d'Internet dans les préconisations.
  const tout = JSON.stringify(b.mesures);
  assert.doesNotMatch(tout, /pare-feu|ACL à|filtrer les flux|mise à jour automatique/i);
  // Sans relevé : les points qui en dépendent sont « à vérifier », pas « OK ».
  assert.equal(b.releve, false);
  assert.equal(mesure(b, "boucles").etat, "a-verifier");
  assert.equal(mesure(b, "ports-libres").etat, "a-verifier");
});

test("Préconisations : VLAN 1, IP en double, trunk vers une caméra, deux VLAN caméras", () => {
  const t = [
    "site Lyon",
    "switch SW-1 | ip 10.0.1.2 | modèle C9300-48P | point=Local A",
    "camera CAM-1 | ip 10.0.1.11 | sur SW-1:Gi1/0/1 | vlan=1",
    "camera CAM-2 | ip 10.0.1.12 | sur SW-1:Gi1/0/2 | vlan=1",
    "poste PC-1 | ip 10.0.1.50 | sur SW-1:Gi1/0/3 | vlan=1",
    "camera CAM-3 | ip 10.0.1.12 | sur SW-1:Gi1/0/4 | trunk | vlan=1,20",
    "camera CAM-4 | ip 10.0.2.14 | sur SW-1:Gi1/0/5 | vlan=20",
    "camera CAM-5 | ip 10.0.3.15 | sur SW-1:Gi1/0/6 | vlan=30",
  ].join("\n");
  const b = bilan(t);
  // VLAN 1 : les ports exacts et la commande Cisco.
  const v1 = mesure(b, "vlan-usage").elements.find((e) => e.cible === "SW-1" && /VLAN 1/.test(e.texte))!;
  assert.match(v1.texte, /Gi1\/0\/1, Gi1\/0\/2, Gi1\/0\/3/);
  assert.ok(v1.commandes[0].lignes.includes("interface range Gi1/0/1 , Gi1/0/2 , Gi1/0/3"), v1.commandes[0].lignes.join("\n"));
  assert.ok(textes(b, "vlan-usage").some((x) => /administration de SW-1/.test(x)));
  // Même IP.
  assert.ok(textes(b, "ip").includes("CAM-2: 10.0.1.12 est utilisée par CAM-2 et CAM-3"));
  // Trunk vers une caméra, caméras dans deux VLAN.
  assert.ok(textes(b, "vlan-coherence").some((x) => x.startsWith("SW-1: port Gi1/0/4 en trunk vers CAM-3")));
  assert.ok(textes(b, "vlan-coherence").some((x) => /2 VLAN différents/.test(x)));
  // À corriger en premier : les indispensables à faire.
  assert.ok(b.premiers.some((p) => p.startsWith("Une adresse IP pour un seul équipement")));
});

test("Préconisations : noms par défaut ou sans l'emplacement → nom proposé et commandes", () => {
  assert.ok(nomParDefaut("Switch"));
  assert.ok(nomParDefaut("HP-2530-24G"));
  assert.ok(nomParDefaut("Aruba-6200F"));
  assert.ok(nomParDefaut("10.0.0.2"));
  assert.ok(!nomParDefaut("SW-BATA-R0-01"));
  assert.equal(codeLieu("Bâtiment A - local R+0"), "BATA-R0");
  const b = bilan([
    "site Lyon",
    "switch HP-2530-24G | ip 10.0.0.3 | modèle 2530-24G | point=Bâtiment A - local R+0",
    "switch SW-NORD | ip 10.0.0.4 | modèle C9300-48P | point=Parking - baie P1",
    "switch SW-PARKING-P1 | ip 10.0.0.5 | point=Parking - baie P1",
    "switch SW-BAT-A | ip 10.0.0.6 | point=Bâtiment A - local R+0",
  ].join("\n"));
  const n = mesure(b, "noms").elements;
  const hp = n.find((e) => e.cible === "HP-2530-24G")!;
  assert.match(hp.texte, /nom par défaut → proposé : SW-BATA-R0-01/);
  assert.deepEqual(hp.commandes[0].lignes, ["configure", 'hostname "SW-BATA-R0-01"', "write memory"]);
  assert.ok(hp.commandes[1].lignes.includes('snmp-server location "Bâtiment A - local R+0"'));
  const nord = n.find((e) => e.cible === "SW-NORD")!;
  assert.match(nord.texte, /ne dit pas où il est \(Parking - baie P1\) → proposé : SW-PARK-P1-01/);
  assert.ok(nord.commandes[0].lignes.includes("hostname SW-PARK-P1-01"));
  assert.ok(!n.some((e) => e.cible === "SW-PARKING-P1" || e.cible === "SW-BAT-A"));
});

test("Préconisations : boucle physique entre switchs", () => {
  const b = bilan([
    "site Lyon",
    "switch SW-A | ip 10.0.0.1 | point=A", "switch SW-B | ip 10.0.0.2 | point=B", "switch SW-C | ip 10.0.0.3 | point=C",
    "SW-A:1 -> SW-B:1", "SW-B:2 -> SW-C:2", "SW-C:3 -> SW-A:3",
  ].join("\n"));
  assert.equal(mesure(b, "boucles").etat, "a-faire");
  assert.ok(textes(b, "boucles").some((x) => /anneau/.test(x)), textes(b, "boucles").join("\n"));
});

test("Préconisations : relevés des switchs → ports exacts, deux bouts des trunks, mise à jour", () => {
  const d = new URL("./fixtures/releves/", import.meta.url);
  const r = relevesVersTexte(readdirSync(d).map((nom) => ({ nom, texte: readFileSync(new URL(encodeURIComponent(nom), d), "utf8") })));
  const b = analyserSecurite(analyser(r.texte));
  assert.equal(b.releve, true);
  const libres = mesure(b, "ports-libres").elements.find((e) => e.cible === "SW-COEUR-1")!;
  assert.equal(libres.texte, "Gi1/0/1, Gi1/0/5, Gi1/0/14, Te1/1/4");
  assert.ok(libres.commandes[0].lignes.includes(" shutdown"));
  const natif = mesure(b, "natif").elements.find((e) => e.cible === "SW-COEUR-1")!;
  assert.match(natif.texte, /en face : .*SW-PARKING port 25/);
  assert.ok(textes(b, "versions").includes("SW-COEUR-2: 17.03.04 → 17.06.05 (version de SW-COEUR-1)"));
  // Plusieurs racines STP (anomalie sur deux switchs) : une seule fois, dans « Pas de boucle ».
  assert.equal(textes(b, "boucles").filter((x) => /chefs d'orchestre/.test(x)).length, 1);
  // VLAN natif différent aux deux bouts : dans la cohérence des VLAN, avec l'autre bout.
  assert.ok(textes(b, "vlan-coherence").some((x) => /VLAN natif.*autre bout : SW-COEUR-2 port Te1\/1\/1/.test(x)));
  // Liaison agrégée dégradée : une panne critique, en tête.
  assert.ok(b.pannes[0].critique);
  assert.ok(b.pannes.some((p) => p.cible === "SW-COEUR-2" && /agrégée/.test(p.titre)));
  // Les équipements vus sans être relevés : où ils ont été vus.
  assert.ok(textes(b, "a-jour").includes("FW-SITE: vu sur SW-COEUR-1 port Gi1/0/20 mais pas relevé : ajouter son IP dans switchs.txt"));
  // SW-PARKING : caméras en zone accessible → verrouillage MAC à décider.
  assert.ok(mesure(b, "mac").elements.some((e) => e.cible === "SW-PARKING"));
});

test("Commandes : la marque reconnue au modèle, la bonne syntaxe", () => {
  const sw = (modele: string) => analyser(`site A\nswitch S | modèle ${modele}`).equipements[0];
  assert.equal(marqueDe(sw("C9300-48P")), "cisco");
  assert.equal(marqueDe(sw("JL727A 6200F 48G CL4 4SFP+")), "arubacx");
  assert.equal(marqueDe(sw("Aruba 2930F-24G")), "hp");
  assert.equal(marqueDe(sw("CNGE24MS")), "autre");
  assert.deepEqual(desactiverPorts("hp", ["4", "5"]), ["configure", "interface 4,5 disable", "write memory"]);
  assert.deepEqual(vlanNatif("arubacx", ["1/1/49"]), ["configure terminal", "vlan 999", " name NATIF-INUTILISE", " exit", "interface 1/1/49", " vlan trunk native 999", " exit", "end", "write memory"]);
  assert.deepEqual(relancerPoe("cisco", "Gi1/0/10"), ["configure terminal", "interface Gi1/0/10", " power inline never", " power inline auto", " exit", "end"]);
  // Cisco : 5 éléments au plus par « interface range ».
  assert.equal(desactiverPorts("cisco", ["Gi1/0/1", "Gi1/0/2", "Gi1/0/3", "Gi1/0/4", "Gi1/0/5", "Gi1/0/6"])!.filter((l) => l.startsWith("interface range")).length, 2);
  assert.equal(desactiverPorts("autre", ["1"]), null);
});

test("Commandes : MikroTik, Planet et Zyxel", () => {
  const sw = (modele: string) => analyser(`site A\nswitch S | modèle ${modele}`).equipements[0];
  assert.equal(marqueDe(sw("CRS328-24P-4S+")), "mikrotik");
  assert.equal(marqueDe(sw("GS-4210-24P2S")), "planet");
  assert.equal(marqueDe(sw("Zyxel GS2210-24HP")), "zyxel");
  assert.equal(marqueDe(sw("XGS2210-28HP")), "zyxel");
  assert.deepEqual(desactiverPorts("mikrotik", ["5", "ether6"]), ["/interface ethernet disable ether5,ether6", "/interface ethernet set ether5 comment=INUTILISE", "/interface ethernet set ether6 comment=INUTILISE"]);
  assert.deepEqual(relancerPoe("mikrotik", "ether3"), ["/interface ethernet poe power-cycle ether3 duration=5s"]);
  assert.deepEqual(renommer("mikrotik", "SW-A-01"), ["/system identity set name=SW-A-01"]);
  assert.deepEqual(accesVlan("planet", ["1/3"], "30"), ["configure terminal", "interface GigabitEthernet 1/3", " switchport mode access", " switchport access vlan 30", " exit", "end", "copy running-config startup-config"]);
  assert.deepEqual(desactiverPorts("zyxel", ["4", "5"]), ["configure", "interface port-channel 4,5", " inactive", " exit", "exit", "write memory"]);
  assert.ok(vlanNatif("zyxel", ["25"])!.includes(" pvid 999"));
  assert.deepEqual(igmpSnooping("hp", "30"), ["configure", "vlan 30 ip igmp", "write memory"]);
  // Pas de commande inventée : PoE Planet, trunk Zyxel → interface web.
  assert.equal(relancerPoe("planet", "1/3"), null);
  assert.equal(igmpSnooping("autre", "30"), null);
});

test("Flux vidéo : débit par lien, charge, archiveur, point unique de panne", () => {
  const cams = (sw: string, n: number) => Array.from({ length: n }, (_, i) => `camera ${sw}-C${i + 1} | sur ${sw}:${i + 1} | vlan=30`);
  const inv = analyser([
    "site Lyon",
    "switch COEUR-1 | ip 10.0.0.1", "switch COEUR-2 | ip 10.0.0.2", "switch ACC-1 | ip 10.0.0.3", "switch ACC-2 | ip 10.0.0.4",
    "serveur ARCH-1 | ip 10.0.30.2 | sur COEUR-1:Gi1/0/48 | vlan=30",
    "COEUR-1:Te1/1/1 -> COEUR-2:Te1/1/1 | fibre",
    "ACC-1:Gi1/0/49 -> COEUR-1:Gi1/0/1 | fibre | 1G",
    "ACC-2:Gi1/0/49 -> ACC-1:Gi1/0/50",
    ...cams("ACC-1", 100), ...cams("ACC-2", 120),
  ].join("\n"));
  const f = analyserFlux(inv, comparerGenetec(inv, null));
  assert.equal(f.source, "estimation");
  assert.equal(f.totalKbps, 220 * 4000);
  // ACC-1 → COEUR-1 : 220 caméras × 4 Mb/s = 880 Mb/s sur 1 Gb/s.
  const t = f.troncons.find((x) => [x.a, x.b].sort().join() === "ACC-1,COEUR-1")!;
  assert.equal(t.cameras, 220);
  assert.equal(t.charge, 88);
  assert.equal(f.troncons[0], t);                 // le plus chargé en tête
  assert.ok(!f.troncons.some((x) => /-C\d/.test(x.a + x.b)));   // pas les câbles des caméras
  assert.equal(capaciteLien({ a: "x", b: "y", portA: "Te1/1/1", ligne: 0 }), 10000);
  // Archiveur : tout arrive sur ARCH-1 (lien Gi = 1 Gb/s).
  assert.equal(f.archiveurs[0].eq, "ARCH-1");
  assert.equal(f.archiveurs[0].charge, 88);
  // Points uniques de panne. ACC-2 ne tient qu'à ACC-1 : 2e lien vers COEUR-1 (le cœur le mieux relié).
  const acc2 = f.dependances.find((d) => d.sw === "ACC-2")!;
  assert.equal(acc2.vers, "ACC-1");
  assert.equal(acc2.secours, "COEUR-1");
  // ACC-1 ne tient qu'à COEUR-1, où est l'archiveur : passer par COEUR-2 ne sert à rien → 2e câble agrégé.
  const acc1 = f.dependances.find((d) => d.sw === "ACC-1")!;
  assert.equal(acc1.secours, "COEUR-1");
  assert.equal(acc1.cameras, 220);
  // Dans le rapport : le lien saturé est « à faire », en tête de ce qu'il faut corriger.
  const b = analyserSecurite(inv);
  assert.equal(b.mesuresFlux.find((m) => m.id === "flux-liens")!.etat, "a-faire");
  const red = mesure(b, "redondance").elements;
  assert.ok(red.some((e) => e.cible === "ACC-2" && /ajouter un 2e lien vers COEUR-1/.test(e.texte)), red.map((e) => e.texte).join("\n"));
  assert.ok(red.some((e) => e.cible === "ACC-1" && /2e câble vers COEUR-1, agrégé/.test(e.texte)));
});

