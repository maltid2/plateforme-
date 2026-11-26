import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { analyser } from "../src/saisie.ts";
import { analyserSecurite } from "../src/securite.ts";
import { relevesVersTexte } from "../src/releve.ts";

const titres = (t: string) => analyserSecurite(analyser(t)).precos.map((p) => `${p.gravite}:${p.titre}`);

test("Sécurité : vidéo mélangée aux postes, VLAN 1, trunk vers une caméra, IP en double", () => {
  const t = [
    "site Lyon",
    "switch SW-1 | ip 10.0.1.2",
    "camera CAM-1 | ip 10.0.1.11 | sur SW-1:1 | vlan=1",
    "camera CAM-2 | ip 10.0.1.12 | sur SW-1:2 | vlan=1",
    "poste PC-1 | ip 10.0.1.50 | sur SW-1:3 | vlan=1",
    "camera CAM-3 | ip 10.0.1.12 | sur SW-1:4 | trunk | vlan=1,20",
  ].join("\n");
  const p = titres(t);
  assert.ok(p.includes("importante:VLAN vidéo partagé avec d'autres équipements"), p.join("\n"));
  assert.ok(p.includes("importante:Caméras et postes dans le même réseau IP"));
  assert.ok(p.includes("importante:Administration des switchs non isolée"));
  assert.ok(p.includes("importante:Équipements dans le VLAN 1"));
  assert.ok(p.includes("importante:Trunk vers un équipement terminal"));
  assert.ok(p.includes("critique:Adresses IP en double"));
  assert.ok(p.includes("importante:Aucun pare-feu sur la carte"));
  // Les critiques d'abord.
  assert.equal(p[0], "critique:Adresses IP en double");
});

test("Sécurité : un réseau bien cloisonné ne déclenche pas d'alerte de cloisonnement", () => {
  const t = [
    "site Lyon",
    "parefeu FW-1 | ip 10.0.0.1",
    "switch SW-1 | ip 10.0.0.2 | sur FW-1:1 | firmware=17.6.5 | modèle C9300-48P",
    "camera CAM-1 | ip 10.0.30.11 | sur SW-1:1 | vlan=30",
    "nvr NVR-1 | ip 10.0.30.2 | sur SW-1:2 | vlan=30",
    "poste PC-1 | ip 10.0.10.50 | sur SW-1:3 | vlan=10",
  ].join("\n");
  const b = analyserSecurite(analyser(t));
  assert.deepEqual(b.precos.filter((p) => p.domaine === "Cloisonnement et flux" || p.gravite !== "conseil"), []);
  // La matrice de flux : caméras → enregistreur autorisé, postes → caméras interdit, défaut interdit.
  assert.ok(b.flux.some((f) => f.source.startsWith("Caméras · VLAN 30") && f.destination.startsWith("Enregistreurs") && f.decision === "Autoriser"));
  assert.ok(b.flux.some((f) => f.source.startsWith("Postes") && f.destination.startsWith("Caméras") && f.decision === "Interdire"));
  assert.equal(b.flux[b.flux.length - 1].decision, "Interdire");
  assert.deepEqual(b.versions.map((v) => [v.modele, v.version]), [["C9300-48P", "17.6.5"]]);
});

test("Sécurité : faits tirés des relevés des switchs (ports libres actifs, VLAN natif 1, versions)", () => {
  const d = new URL("./fixtures/releves/", import.meta.url);
  const r = relevesVersTexte(readdirSync(d).map((nom) => ({ nom, texte: readFileSync(new URL(encodeURIComponent(nom), d), "utf8") })));
  const b = analyserSecurite(analyser(r.texte));
  const p = b.precos.map((x) => x.titre);
  assert.ok(p.some((x) => /ports libres restés actifs/.test(x)), p.join("\n"));
  assert.ok(p.includes("VLAN natif 1 sur les trunks"));
  assert.ok(p.includes("Versions logicielles différentes sur un même modèle"));
  assert.ok(p.includes("Équipements réseau vus mais pas relevés"));
  assert.equal(b.precos[0].gravite, "critique");   // liaison agrégée dégradée sur SW-COEUR-2
});
