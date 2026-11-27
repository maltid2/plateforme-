import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { analyser } from "../src/saisie.ts";
import { relevesVersTexte } from "../src/releve.ts";
import { lireGenetec, lignesCsv } from "../src/genetecLecture.ts";
import { comparerGenetec, etatDe } from "../src/genetec.ts";
import { analyserSecurite } from "../src/securite.ts";

// Relevés et exports Genetec fabriqués à partir des données d'exemple (simulées) de Cartographie Réseau.
const releves = () => {
  const d = new URL("./fixtures/releves/", import.meta.url);
  return analyser(relevesVersTexte(readdirSync(d).map((nom) => ({ nom, texte: readFileSync(new URL(encodeURIComponent(nom), d), "utf8") }))).texte);
};
const csv = (n: string) => lignesCsv(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8"));

test("Genetec : états reconnus en français et en anglais", () => {
  assert.equal(etatDe("Hors ligne"), "hors ligne");
  assert.equal(etatDe("Offline"), "hors ligne");
  assert.equal(etatDe("En ligne"), "en ligne");
  assert.equal(etatDe("Online"), "en ligne");
  assert.equal(etatDe(""), "inconnu");
});

test("Genetec ↔ réseau : hors ligne localisées, absentes, non enregistrées, écart d'IP, débits", () => {
  const inv = releves();
  let g = lireGenetec([csv("genetec-inventaire-exemple.csv")], "inventaire.csv").genetec;
  g = lireGenetec([csv("genetec-config-exemple.csv")], "config.csv", g).genetec;
  assert.deepEqual(g.sources.map((s) => s.type), ["inventaire", "configuration"]);
  const c = comparerGenetec(inv, g);
  // Hors ligne : CAM-BATA-Couloir-2 (rapprochée par MAC, sur SW-BAT-A port 1/1/2) ; CAM-Ancienne-Loge introuvable.
  const hl = c.horsLigne.map((r) => [r.unite.nom, r.eq?.nom ?? null, r.switch ?? null, r.port ?? null]);
  assert.ok(hl.some(([n, , sw, p]) => n === "CAM-BATA-Couloir-2" && sw === "SW-BAT-A" && p === "1/1/2"), JSON.stringify(hl));
  assert.ok(c.absentes.some((r) => r.unite.nom === "CAM-Ancienne-Loge"));
  // Même MAC, IP différente (10.20.1.22 dans Genetec, 10.20.1.2 sur le réseau).
  assert.ok(c.ecartsIp.some((r) => r.unite.nom === "CAM-BATA-Couloir-2"));
  // Deux unités Genetec avec la même IP 10.20.9.9.
  assert.ok(c.doublonsIp.some((d) => d.ip === "10.20.9.9"));
  // Caméras du réseau inconnues de Genetec.
  assert.ok(c.nonEnregistrees.length > 0);
  // Débit : CAM-HALL-Entree (enregistrement + direct = 12,3 Mb/s) sur SW-COEUR-1.
  assert.ok(c.debitParSwitch.some((d) => d.switch === "SW-COEUR-1" && d.kbps === 12288));
  // Dans les préconisations : la caméra hors ligne et son port, en critique.
  const b = analyserSecurite(inv, g);
  // La caméra hors ligne est rangée sous son switch, avec le port et les commandes Aruba CX.
  const p = b.fiches.find((f) => f.cible === "SW-BAT-A")!.actions.find((x) => /hors ligne dans Genetec/.test(x.titre))!;
  assert.equal(p.gravite, "critique");
  assert.match(p.titre, /1\/1\/2/);
  assert.ok(p.commandes.some((c) => c.lignes.includes("show power-over-ethernet 1/1/2")));
  // Les versions des caméras viennent de Genetec.
  assert.ok(b.versions.some((v) => v.modele === "Axis P3245-V" && v.version === "10.4.0"));
});

test("Genetec : réimporter le même fichier remplace, sans doublon", () => {
  const g1 = lireGenetec([csv("genetec-inventaire-exemple.csv")], "inventaire.csv").genetec;
  const g2 = lireGenetec([csv("genetec-inventaire-exemple.csv")], "inventaire.csv", g1).genetec;
  assert.equal(g2.unites.length, g1.unites.length);
  assert.equal(g2.sources.length, 1);
});
