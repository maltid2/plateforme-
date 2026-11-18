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
