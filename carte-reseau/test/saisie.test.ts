import { test } from "node:test";
import assert from "node:assert/strict";
import { analyser } from "../src/saisie.ts";
import { EXEMPLE } from "./exemple.ts";
import { disposer } from "../src/disposition.ts";
import { cheminPasserelle, facade, lirePort } from "../src/facade.ts";

test("l'exemple se lit sans erreur ni remarque", () => {
  const inv = analyser(EXEMPLE);
  assert.deepEqual(inv.alertes, []);
  assert.deepEqual(inv.sites.map((s) => s.nom), ["Nanterre", "Lyon", "Lille"]);
  assert.equal(inv.equipements.filter((e) => e.genre === "switch").length, 8);
});

test("caméras en groupe : ports et IP qui se suivent, VLAN porté par le lien", () => {
  const inv = analyser(EXEMPLE);
  const l = inv.liaisons.filter((x) => x.a.startsWith("CAM-SIEGE"));
  assert.deepEqual(l.map((x) => x.portB), ["2", "3", "4", "5", "6", "7", "8", "9"]);
  assert.ok(l.every((x) => x.vlans === "30" && x.media === "cuivre"));
  assert.equal(inv.equipements.find((e) => e.nom === "CAM-SIEGE-8")?.ip, "10.14.30.18");
});

test("trunk : écrit, déduit des VLAN multiples, ou entre deux switchs", () => {
  const inv = analyser([
    "switch A", "switch B", "switch C", "passerelle GW", "camera K",
    "A:24 -> B:24 | trunk | vlan=10,20",
    "B:23 -> C:1",
    "GW:LAN1 -> A:1 | vlan=10,20",
    "K -> A:5 | vlan=30",
  ].join("\n"));
  const mode = (a: string) => inv.liaisons.find((l) => l.a === a)?.mode;
  assert.equal(mode("A"), "trunk");
  assert.equal(mode("B"), "trunk");          // deux switchs
  assert.equal(mode("GW"), "trunk");         // plusieurs VLAN
  assert.equal(mode("K"), undefined);        // simple accès
  assert.equal(inv.liaisons.find((l) => l.a === "A")?.vlans, "10,20");
});

test("port pris deux fois et nom inconnu sont signalés", () => {
  const inv = analyser("switch SW1\ncamera C1\ncamera C2\nC1 -> SW1:1\nC2 -> SW1:1\nC2 -> SW9");
  assert.ok(inv.alertes.some((a) => a.ligne === 5 && /déjà utilisé/.test(a.msg)));
  assert.ok(inv.alertes.some((a) => a.ligne === 6 && /SW9/.test(a.msg)));
});

test("lecture des noms de ports", () => {
  assert.deepEqual(lirePort("Gi1/0/12"), { type: "rj45", n: 12 });
  assert.deepEqual(lirePort("Te1"), { type: "sfp", n: 1 });
  assert.deepEqual(lirePort("SFP+2"), { type: "sfp", n: 2 });
  assert.deepEqual(lirePort("LAN3"), { type: "rj45", n: 3 });
  assert.deepEqual(lirePort("WAN"), { type: "wan", n: 1 });
  assert.deepEqual(lirePort("7"), { type: "rj45", n: 7 });
});

test("façade : nombre de ports déclaré, impairs en haut, branchements rattachés", () => {
  const inv = analyser("switch SW | ports=24 | sfp=4\ncamera C | sur SW:Gi1/0/5\nswitch SW2 | sur SW:Te2");
  const f = facade(inv.equipements[0], inv);
  assert.equal(f.ports.filter((p) => p.type === "rj45").length, 24);
  assert.equal(f.ports.filter((p) => p.type === "sfp").length, 4);
  const p5 = f.parId.get("Gi1/0/5")!;
  assert.equal(p5.type, "rj45");
  assert.equal(p5.haut, true);                      // port impair : rangée du haut
  assert.equal(f.parId.get("Te2")?.type, "sfp");
  const p6 = f.ports.filter((p) => p.type === "rj45")[5];
  assert.equal(p6.haut, false);                     // port pair : rangée du bas
  assert.equal(p6.x, p5.x);                         // même colonne que le 5
});

test("façade : sans « ports= », la taille se déduit du plus grand port utilisé", () => {
  const inv = analyser("switch SW\ncamera C | sur SW:18");
  assert.equal(facade(inv.equipements[0], inv).ports.filter((p) => p.type === "rj45").length, 24);
});

test("passerelle d'un switch : trouvée de proche en proche, avec le port de sortie", () => {
  const inv = analyser(EXEMPLE);
  const c = cheminPasserelle("SW-CAM", inv)!;
  assert.equal(c.passerelle.nom, "FW-SIEGE");
  assert.equal(c.via, "Te1");
  assert.deepEqual(c.sauts, ["SW-CORE", "FW-SIEGE"]);
  // Lille n'a pas de pare-feu : on ne va pas chercher celui d'un autre site.
  assert.equal(cheminPasserelle("SW-LILLE-2", inv), null);
});

test("chaque équipement est placé ; la tête du site est au-dessus de ses switchs", () => {
  const inv = analyser(EXEMPLE);
  const d = disposer(inv);
  assert.equal(d.pos.size, inv.equipements.length);
  assert.ok(d.pos.get("FW-SIEGE")!.y < d.pos.get("SW-CORE")!.y);
  assert.ok(d.pos.get("SW-CORE")!.y < d.pos.get("SW-CAM")!.y);
  assert.ok(d.pos.get("SW-CAM")!.y < d.pos.get("CAM-SIEGE-1")!.y);
});

test("une caméra se place sous le port où elle est branchée", () => {
  const inv = analyser("switch SW | ports=24\ncamera A | sur SW:23\ncamera B | sur SW:1");
  const d = disposer(inv);
  assert.ok(d.pos.get("B")!.x < d.pos.get("A")!.x);
});

test("le site peut se donner sur la ligne, dans n'importe quel ordre", () => {
  const inv = analyser([
    "switch SW-LYON-1 | site=Lyon | 10.20.0.2",
    "switch SW-PARIS-1 | @Paris",
    "switch SW-LYON-2 | @lyon | sur SW-LYON-1:24",
    "camera CAM-L x3 | @Lyon | sur SW-LYON-2:1",
  ].join("\n"));
  assert.deepEqual(inv.sites.map((s) => s.nom), ["Lyon", "Paris"]);
  assert.equal(inv.equipements.filter((e) => e.site === "Lyon").length, 5);
  assert.deepEqual(inv.liaisons.map((l) => l.portB), ["24", "1", "2", "3"]);
});

test("20 sites et 40 switchs : chaque site a son cadre, sans chevauchement", () => {
  const lignes: string[] = [];
  for (let i = 1; i <= 20; i++) {
    lignes.push(`switch SW-${i}-A | @Site ${i}`, `switch SW-${i}-B | @Site ${i} | sur SW-${i}-A:24`,
      `camera CAM-${i} x4 | @Site ${i} | sur SW-${i}-B:1`);
    if (i > 1) lignes.push(`SW-${i}-A:25 -> SW-1-A:${i} | fibre`);
  }
  const inv = analyser(lignes.join("\n"));
  assert.deepEqual(inv.alertes.filter((a) => a.niveau === "erreur"), []);
  const d = disposer(inv);
  const sites = d.cadres.filter((c) => c.type === "site");
  assert.equal(sites.length, 20);
  for (const a of sites) for (const b of sites) {
    if (a === b) continue;
    const separes = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
    assert.ok(separes, `${a.nom} chevauche ${b.nom}`);
  }
});

test("seules les lignes en retrait sont dans la baie", () => {
  const inv = analyser("baie A1\n  switch SW1\ncamera C1 | sur SW1:1");
  assert.equal(inv.equipements[0].baie, "A1");
  assert.equal(inv.equipements[1].baie, undefined);
});

test("support : écrit, ou déduit des ports (SFP = fibre, caméra = cuivre)", () => {
  const inv = analyser([
    "switch A | ports=24 | sfp=4", "switch B", "camera C", "passerelle GW",
    "A:Te1 -> B:Te1", "C -> A:3", "A:24 -> B:24 | fibre", "GW:WAN -> A:23 | vpn | secours", "B:5 -> A:5 | radio",
  ].join("\n"));
  const m = inv.liaisons.map((l) => l.media);
  assert.deepEqual(m, ["fibre", "cuivre", "fibre", "vpn", "radio"]);
  assert.equal(inv.liaisons[3].libelle, "secours");
});

test("lieux dans un site : « point », « @Site/Lieu », et cadres rangés dans le site", () => {
  const inv = analyser([
    "site Lyon", "point Mairie", "switch SW-M | ports=24 | sfp=4",
    "point École A", "switch SW-A | sur SW-M:Te1", "camera CA x2 | sur SW-A:1",
    "switch SW-B | @Lyon/École B | sur SW-M:Te2",
    "switch SW-X | @Paris",
  ].join("\n"));
  const pt = (n: string) => inv.equipements.find((e) => e.nom === n)?.point;
  assert.equal(pt("SW-M"), "Mairie");
  assert.equal(pt("CA-2"), "École A");
  assert.equal(pt("SW-B"), "École B");
  assert.equal(pt("SW-X"), undefined);
  const d = disposer(inv);
  const lyon = d.cadres.find((c) => c.type === "site" && c.site === "Lyon")!;
  const lieux = d.cadres.filter((c) => c.type === "point");
  assert.deepEqual(lieux.map((c) => c.nom).sort(), ["Mairie", "École A", "École B"].sort());
  for (const c of lieux) assert.ok(c.x >= lyon.x && c.y >= lyon.y && c.x + c.w <= lyon.x + lyon.w && c.y + c.h <= lyon.y + lyon.h);
  // Chaque switch est dans le cadre de son lieu.
  const cadre = lieux.find((c) => c.nom === "École B")!, p = d.pos.get("SW-B")!;
  assert.ok(p.x > cadre.x && p.x < cadre.x + cadre.w && p.y > cadre.y && p.y < cadre.y + cadre.h);
});

test("rien n'est obligatoire : un site avec un seul switch, sans pare-feu ni onduleur", () => {
  const inv = analyser("switch SEUL | @Petit site");
  assert.deepEqual(inv.alertes.filter((a) => a.niveau === "erreur"), []);
  assert.equal(disposer(inv).pos.size, 1);
});

test("un port au-delà de ce que le switch déclare est signalé", () => {
  const inv = analyser("switch SW | ports=8 | sfp=2\ncamera C x3 | sur SW:7\nswitch SW2 | sur SW:Te3");
  const msgs = inv.alertes.map((a) => a.msg).join("\n");
  assert.match(msgs, /port 9 n'existe pas sur SW : 8 ports RJ45/);
  assert.match(msgs, /port Te3 n'existe pas sur SW : 2 cages SFP/);
});

test("IP passerelle : sur la ligne, héritée du lieu, sinon du site", () => {
  const inv = analyser([
    "site Lyon | passerelle=10.20.0.1",
    "switch SW-M | 10.20.0.2",
    "point École A | passerelle=10.20.1.1",
    "switch SW-A | 10.20.1.2",
    "camera C | 10.20.30.5 | passerelle=10.20.30.1",
  ].join("\n"));
  const e = (n: string) => inv.equipements.find((x) => x.nom === n)!;
  assert.equal(e("SW-M").passerelleIp, "10.20.0.1");
  // La passerelle elle-même n'hérite pas de sa propre adresse.
  assert.equal(analyser("site S | passerelle=10.0.0.1\nparefeu FW | 10.0.0.1").equipements[0].passerelleIp, undefined);
  assert.equal(e("SW-M").passerelleHeritee, "site");
  assert.equal(e("SW-A").passerelleIp, "10.20.1.1");
  assert.equal(e("SW-A").passerelleHeritee, "lieu");
  assert.equal(e("C").passerelleIp, "10.20.30.1");
  assert.equal(e("C").passerelleHeritee, undefined);
  assert.deepEqual(inv.sites[0].infos, []);
});

test("IP passerelle : valeur illisible, hors réseau, ou égale à l'équipement", () => {
  const inv = analyser([
    "switch A | 10.0.0.2 | passerelle=routeur",
    "switch B | 10.0.0.3/24 | passerelle=10.0.1.1",
    "switch C | 10.0.0.4 | passerelle=10.0.0.4",
    "switch D | 10.0.0.5/24 | passerelle=10.0.0.1",
  ].join("\n"));
  const msgs = inv.alertes.map((a) => `${a.ligne} ${a.msg}`).join("\n");
  assert.match(msgs, /^1 IP de passerelle « routeur » illisible/m);
  assert.match(msgs, /^2 Passerelle 10\.0\.1\.1 hors du réseau de B/m);
  assert.match(msgs, /^3 C a pour passerelle sa propre adresse/m);
  assert.doesNotMatch(msgs, /^4 Passerelle/m);
});

test("un site créé par @ puis déclaré par « site » ne compte pas comme un doublon", () => {
  const inv = analyser("switch S | @Lille\nsite Lille | passerelle=10.30.0.1");
  assert.deepEqual(inv.alertes.filter((a) => /deux fois/.test(a.msg)), []);
  assert.equal(inv.equipements[0].passerelleIp, "10.30.0.1");
});
