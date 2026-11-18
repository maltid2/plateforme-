import { test } from "node:test";
import assert from "node:assert/strict";
import { analyser, EXEMPLE } from "../src/saisie.ts";
import { disposer } from "../src/disposition.ts";

test("l'exemple se lit sans erreur", () => {
  const inv = analyser(EXEMPLE);
  assert.deepEqual(inv.alertes.filter((a) => a.niveau === "erreur"), []);
  assert.equal(inv.sites.length, 2);
  assert.ok(inv.equipements.find((e) => e.nom === "CAM-PARKING-4")?.ip === "10.14.0.54");
});

test("un groupe se branche sur des ports qui se suivent", () => {
  const inv = analyser(EXEMPLE);
  const ports = inv.liaisons.filter((l) => l.a.startsWith("CAM-PARKING")).map((l) => l.portB);
  assert.deepEqual(ports, ["3", "4", "5", "6"]);
  const lyon = inv.liaisons.filter((l) => l.a.startsWith("CAM-LYON")).map((l) => l.portB);
  assert.deepEqual(lyon, ["5", "6"]);
});

test("port pris deux fois et nom inconnu sont signalés", () => {
  const inv = analyser("switch SW1\ncamera C1\ncamera C2\nC1 -> SW1:1\nC2 -> SW1:1\nC2 -> SW9");
  assert.ok(inv.alertes.some((a) => a.ligne === 5 && /déjà utilisé/.test(a.msg)));
  assert.ok(inv.alertes.some((a) => a.ligne === 6 && /SW9/.test(a.msg)));
});

test("chaque équipement reçoit une position, la passerelle au-dessus", () => {
  const inv = analyser(EXEMPLE);
  const d = disposer(inv);
  assert.equal(d.pos.size, inv.equipements.length);
  assert.ok(d.pos.get("GW-NANTERRE")!.y < d.pos.get("SW-CORE")!.y);
  assert.ok(d.pos.get("SW-CAM")!.y < d.pos.get("CAM-ENTREE")!.y);
  assert.equal(d.cadres.length, 2);
});

test("seules les lignes en retrait sont dans la baie", () => {
  const inv = analyser("baie A1\n  switch SW1\ncamera C1 | sur SW1:1");
  assert.equal(inv.equipements[0].baie, "A1");
  assert.equal(inv.equipements[1].baie, undefined);
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
