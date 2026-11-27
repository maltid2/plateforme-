import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { analyser } from "../src/saisie.ts";
import { analyserSecurite } from "../src/securite.ts";
import { relevesVersTexte } from "../src/releve.ts";
import { desactiverPorts, marqueDe, relancerPoe, vlanNatif } from "../src/commandes.ts";

const bilan = (t: string) => analyserSecurite(analyser(t));
/** Toutes les actions, « cible : gravité : titre ». */
const actions = (t: string) => bilan(t).fiches.flatMap((f) => f.actions.map((a) => `${f.cible}:${a.gravite}:${a.titre}`));

test("Préconisations : actions précises par switch et pour tout le réseau", () => {
  const t = [
    "site Lyon",
    "switch SW-1 | ip 10.0.1.2 | modèle C9300-48P",
    "camera CAM-1 | ip 10.0.1.11 | sur SW-1:Gi1/0/1 | vlan=1",
    "camera CAM-2 | ip 10.0.1.12 | sur SW-1:Gi1/0/2 | vlan=1",
    "poste PC-1 | ip 10.0.1.50 | sur SW-1:Gi1/0/3 | vlan=1",
    "camera CAM-3 | ip 10.0.1.12 | sur SW-1:Gi1/0/4 | trunk | vlan=1,20",
  ].join("\n");
  const a = actions(t);
  // Sur le switch, avec les ports exacts.
  assert.ok(a.some((x) => x.startsWith("SW-1:importante:Sortir du VLAN 1 : Gi1/0/1, Gi1/0/2, Gi1/0/3")), a.join("\n"));
  assert.ok(a.includes("SW-1:importante:Passer le port Gi1/0/4 en accès (CAM-3 n'a besoin que d'un VLAN)"));
  // Pour tout le réseau.
  assert.ok(a.includes("Ensemble du réseau:critique:Corriger l'IP 10.0.1.12, utilisée par CAM-2 et CAM-3"));
  assert.ok(a.some((x) => x.startsWith("Ensemble du réseau:importante:Isoler l'administration de SW-1")));
  assert.ok(a.includes("Ensemble du réseau:importante:Filtrer les flux entre VLAN (aucun pare-feu sur la carte)"));
  // Commandes Cisco pour sortir du VLAN 1.
  const b = bilan(t);
  const cmd = b.fiches.find((f) => f.cible === "SW-1")!.actions.find((x) => x.titre.startsWith("Sortir du VLAN 1"))!.commandes[0].lignes;
  assert.ok(cmd.includes("interface range Gi1/0/1 , Gi1/0/2 , Gi1/0/3"), cmd.join("\n"));
  // Par où commencer : la critique d'abord.
  assert.equal(b.priorites[0].action.gravite, "critique");
});

test("Préconisations : un réseau bien cloisonné ne déclenche rien sur le cloisonnement", () => {
  const t = [
    "site Lyon",
    "parefeu FW-1 | ip 10.0.0.1",
    "switch SW-1 | ip 10.0.0.2 | sur FW-1:1 | firmware=17.6.5 | modèle C9300-48P",
    "camera CAM-1 | ip 10.0.30.11 | sur SW-1:1 | vlan=30",
    "nvr NVR-1 | ip 10.0.30.2 | sur SW-1:2 | vlan=30",
    "poste PC-1 | ip 10.0.10.50 | sur SW-1:3 | vlan=10",
  ].join("\n");
  const b = bilan(t);
  assert.deepEqual(b.fiches, []);
  assert.equal(b.ouFiltrer, "Sur FW-1");
  assert.ok(b.flux.some((f) => f.source.startsWith("Caméras · VLAN 30") && f.destination.includes("NVR-1 10.0.30.2") && f.decision === "Autoriser"));
  assert.ok(b.flux.some((f) => f.source.startsWith("Postes") && f.destination.startsWith("Caméras") && f.decision === "Interdire"));
  assert.equal(b.flux[b.flux.length - 1].decision, "Interdire");
});

test("Préconisations : relevés des switchs → ports exacts, deux bouts des trunks, mise à jour", () => {
  const d = new URL("./fixtures/releves/", import.meta.url);
  const r = relevesVersTexte(readdirSync(d).map((nom) => ({ nom, texte: readFileSync(new URL(encodeURIComponent(nom), d), "utf8") })));
  const b = analyserSecurite(analyser(r.texte));
  const coeur1 = b.fiches.find((f) => f.cible === "SW-COEUR-1")!;
  assert.match(coeur1.sousTitre, /^Cisco IOS \/ IOS-XE · C9300-48P/);
  const libres = coeur1.actions.find((a) => a.titre.startsWith("Désactiver les 4 ports libres"))!;
  assert.match(libres.titre, /Gi1\/0\/1, Gi1\/0\/5, Gi1\/0\/14, Te1\/1\/4/);
  assert.ok(libres.commandes[0].lignes.includes(" shutdown"));
  const natif = coeur1.actions.find((a) => a.titre.startsWith("Mettre le VLAN natif 999"))!;
  assert.match(natif.aussi!, /SW-PARKING port 25/);
  const coeur2 = b.fiches.find((f) => f.cible === "SW-COEUR-2")!;
  assert.ok(coeur2.actions.some((a) => a.titre === "Mettre à jour le logiciel : 17.03.04 → 17.06.05 (version de SW-COEUR-1)"));
  assert.equal(coeur2.gravite, "critique");   // liaison agrégée dégradée
  // Aruba CX : commandes propres à la marque.
  const batA = b.fiches.find((f) => f.cible === "SW-BAT-A")!;
  assert.match(batA.sousTitre, /^Aruba CX/);
  // Les équipements vus sans être relevés : où ils ont été vus.
  assert.ok(b.fiches.find((f) => f.cible === "Inventaire")!.actions.some((a) => a.titre === "Ajouter FW-SITE au relevé (vu sur SW-COEUR-1 port Gi1/0/20)"));
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
