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

// Relevés bruts écrits par « Relever les switchs.bat » (fabriqués à partir des données d'exemple simulées).
test("Relevés des switchs : du .txt brut à la carte, avec le moteur de Cartographie Réseau", async () => {
  const { readdirSync } = await import("node:fs");
  const { relevesVersTexte, aIgnorer } = await import("../src/releve.ts");
  const d = new URL("./fixtures/releves/", import.meta.url);
  const fichiers = readdirSync(d).map((nom) => ({ nom, texte: readFileSync(new URL(encodeURIComponent(nom), d), "utf8") }));
  const r = relevesVersTexte([...fichiers, { nom: "SW-1 - 2026-11-20 1000.txt", chemin: "Sites/Melun/Config Switch", texte: "password secret" }]);
  assert.equal(r.site, "Site exemple");
  const inv = analyser(r.texte);
  assert.deepEqual(inv.alertes, []);
  assert.equal(inv.equipements.filter((e) => e.genre === "switch").length, 7 + 4);   // relevés + voisins LLDP/CDP
  const l = inv.liaisons.find((x) => x.a === "SW-BAT-A" && x.b === "SW-COEUR-1")!;
  assert.deepEqual([l.portA, l.portB, l.media, l.vlans], ["SFP1", "Te1/1/3", "fibre", "1,10,20,30"]);
  assert.ok(inv.liaisons.some((x) => x.b === "SW-QUAI" && x.portB === "2"));   // caméra sur SW-QUAI port 2
  assert.ok(r.anomalies.some((a) => a.gravite === "critique" && a.equipement === "SW-COEUR-2"));
  assert.match(r.texte, /anomalies=1 dont 1 critique — ⛔ Po1 : Une liaison agrégée/);
  // La sauvegarde de configuration n'est jamais lue.
  assert.equal(aIgnorer({ nom: "x.txt", chemin: "Sites/Melun/Config Switch" }), "configuration sauvegardée (jamais lue)");
  assert.ok(!r.texte.includes("secret"));
  // Choisie fichier par fichier (sans le dossier) : reconnue à son nom, ou à son en-tête.
  assert.ok(aIgnorer({ nom: "SW-COEUR-1 (10.10.0.1) - 2026-11-20 1000.txt" }));
  const r2 = relevesVersTexte([...fichiers, { nom: "copie.txt", texte: "# Configuration (show running-config) - SW-1 (10.0.0.1) - site : X\r\nenable secret 5 abc" }]);
  assert.ok(r2.fichiers.some((f) => f.nom === "copie.txt" && /configuration/.test(f.lu)));
  assert.ok(!r2.texte.includes("enable secret"));
});
