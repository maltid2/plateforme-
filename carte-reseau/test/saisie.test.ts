import { test } from "node:test";
import assert from "node:assert/strict";
import { analyser, EXEMPLE } from "../src/saisie.ts";
import { disposer } from "../src/disposition.ts";
import { cheminPasserelle, facade, lirePort } from "../src/facade.ts";

test("l'exemple se lit sans erreur ni remarque", () => {
  const inv = analyser(EXEMPLE);
  assert.deepEqual(inv.alertes, []);
  assert.deepEqual(inv.sites.map((s) => s.nom), ["Nanterre", "Lyon"]);
  assert.equal(inv.equipements.filter((e) => e.genre === "switch").length, 5);
});

test("caméras en groupe : ports et IP qui se suivent, VLAN porté par le lien", () => {
  const inv = analyser(EXEMPLE);
  const l = inv.liaisons.filter((x) => x.a.startsWith("CAM-PARKING"));
  assert.deepEqual(l.map((x) => x.portB), ["3", "4", "5", "6", "7", "8"]);
  assert.ok(l.every((x) => x.vlans === "30"));
  assert.equal(inv.equipements.find((e) => e.nom === "CAM-PARKING-6")?.ip, "10.14.30.16");
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
  assert.equal(c.passerelle.nom, "FW-NANTERRE");
  assert.equal(c.via, "Te1");
  assert.deepEqual(c.sauts, ["SW-CORE", "FW-NANTERRE"]);
  assert.equal(cheminPasserelle("CAM-LYON-2", inv)?.passerelle.nom, "GW-LYON");
});

test("chaque équipement est placé ; la tête du site est au-dessus de ses switchs", () => {
  const inv = analyser(EXEMPLE);
  const d = disposer(inv);
  assert.equal(d.pos.size, inv.equipements.length);
  assert.ok(d.pos.get("FW-NANTERRE")!.y < d.pos.get("SW-CORE")!.y);
  assert.ok(d.pos.get("SW-CORE")!.y < d.pos.get("SW-CAM")!.y);
  assert.ok(d.pos.get("SW-CAM")!.y < d.pos.get("CAM-ACCUEIL")!.y);
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
  assert.equal(d.cadres.length, 20);
  for (const a of d.cadres) for (const b of d.cadres) {
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
