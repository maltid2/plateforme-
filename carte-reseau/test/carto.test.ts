import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lireTableur } from "../src/tableur.ts";
import { analyser } from "../src/saisie.ts";
import { cartoVersTexte, estExportCarto, portsDuModele } from "../src/carto.ts";

// Export Excel de « Cartographie Réseau » v3.2, fait sur ses données d'exemple (simulées).
const charger = async () => {
  const buf = readFileSync(new URL("./fixtures/cartographie-reseau-exemple.xlsx", import.meta.url));
  return lireTableur("export.xlsx", buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};

test("Cartographie Réseau : l'export est reconnu et dessiné sans erreur", async () => {
  const f = await charger();
  assert.ok(estExportCarto(f));
  const r = cartoVersTexte(f);
  const inv = analyser(r.texte);
  assert.deepEqual(inv.alertes, []);
  assert.deepEqual(inv.sites.map((s) => s.nom), ["Site exemple"]);
  assert.equal(inv.equipements.filter((e) => e.genre === "switch").length, 10);   // 9 relevés + 1 voisin LLDP
  // Les liens LLDP/CDP, avec leurs ports, le média et les VLAN du trunk.
  const l = inv.liaisons.find((x) => x.a === "SW-COEUR-1" && x.portA === "Te1/1/3")!;
  assert.deepEqual([l.b, l.portB, l.media, l.mode, l.vlans], ["SW-BAT-A", "SFP1", "fibre", "trunk", "1,10,20,30"]);
  // Une caméra : nom Genetec, IP, MAC, son switch et son port, son bâtiment.
  const cam = inv.equipements.find((e) => e.nom === "CAM-BATA-Couloir-1")!;
  assert.equal(cam.ip, "10.20.1.1");
  assert.equal(cam.point, "Batiment A - local R+0");
  const c = inv.liaisons.find((x) => x.a === "CAM-BATA-Couloir-1")!;
  assert.deepEqual([c.b, c.portB, c.vlans], ["SW-BAT-A", "1/1/1", "20"]);
});

test("Cartographie Réseau : équipements vus seulement derrière un lien entre switchs non placés", async () => {
  const r = cartoVersTexte(await charger());
  const inv = analyser(r.texte);
  // Rien n'est branché sur un port déjà occupé par un lien entre switchs.
  const pris = new Set(inv.liaisons.map((l) => `${l.b}:${l.portB}`));
  assert.equal(pris.size, inv.liaisons.length);
  assert.ok(r.onglets.some((o) => /non placés/.test(o.lu)));
  // Les pare-feu et bornes vus en LLDP prennent leur type d'après leur nom.
  assert.equal(inv.equipements.find((e) => e.nom === "FW-SITE")?.genre, "parefeu");
  assert.equal(inv.equipements.find((e) => e.nom === "AP-HALL-01")?.genre, "borne");
});

test("Cartographie Réseau : ports d'après le modèle", () => {
  assert.deepEqual(portsDuModele("C9300-48P"), { rj: 48, sfp: undefined });
  assert.deepEqual(portsDuModele("JL727A 6200F 48G CL4 4SFP+ 740W Swch"), { rj: 48, sfp: 4 });
  assert.deepEqual(portsDuModele("M4300-28G"), { rj: 24, sfp: 4 });
  assert.deepEqual(portsDuModele("Modèle inconnu"), {});
});
