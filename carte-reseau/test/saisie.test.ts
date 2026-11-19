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

test("plusieurs noms différents sur une ligne : IP et ports qui se suivent", () => {
  const inv = analyser("switch SW-CORE | ports=24\nswitch SW-ACCUEIL, SW-ETAGE1 , SW-ETAGE2 | 10.0.0.10 | sur SW-CORE:5");
  const sw = inv.equipements.filter((e) => e.nom !== "SW-CORE");
  assert.deepEqual(sw.map((e) => e.nom), ["SW-ACCUEIL", "SW-ETAGE1", "SW-ETAGE2"]);
  assert.deepEqual(sw.map((e) => e.ip), ["10.0.0.10", "10.0.0.11", "10.0.0.12"]);
  assert.deepEqual(inv.liaisons.map((l) => l.portB), ["5", "6", "7"]);
  assert.deepEqual(inv.alertes.filter((a) => a.niveau === "erreur"), []);
});

test("liste d'IP : une par équipement, dans l'ordre", () => {
  const inv = analyser("switch SW-A, SW-B, SW-C | 10.0.0.5, 10.0.0.9, 10.0.0.20");
  assert.deepEqual(inv.equipements.map((e) => e.ip), ["10.0.0.5", "10.0.0.9", "10.0.0.20"]);
  assert.deepEqual(inv.alertes.filter((a) => /IP/.test(a.msg)), []);
  // Moins d'IP que d'équipements : on continue à partir de la dernière.
  const moins = analyser("camera CAM x4 | 10.0.30.10, 10.0.30.50");
  assert.deepEqual(moins.equipements.map((e) => e.ip), ["10.0.30.10", "10.0.30.50", "10.0.30.51", "10.0.30.52"]);
  assert.ok(moins.alertes.some((a) => /continuent à partir de 10\.0\.30\.50/.test(a.msg)));
  // Trop d'IP : signalé, les dernières ignorées.
  const trop = analyser("switch S1, S2 | 10.0.0.1, 10.0.0.2, 10.0.0.3");
  assert.deepEqual(trop.equipements.map((e) => e.ip), ["10.0.0.1", "10.0.0.2"]);
  assert.ok(trop.alertes.some((a) => /en trop/.test(a.msg)));
  // La liste n'est pas prise pour un modèle.
  assert.deepEqual(inv.equipements[0].infos, []);
});

test("l'exemple complet de l'onglet Texte se lit sans erreur ni remarque", async () => {
  const { EXEMPLE_COMPLET, MODELES } = await import("../src/modeles.ts");
  assert.deepEqual(analyser(EXEMPLE_COMPLET).alertes, []);
  // Les modèles assemblés (site + switchs + caméras + lieu) forment une carte valide.
  const assemble = ["site", "switchs", "cameras", "lieu"].map((id) => MODELES.find((m) => m.id === id)!.texte).join("\n");
  assert.deepEqual(analyser(assemble).alertes.filter((a) => a.niveau === "erreur"), []);
});

test("un nom de site avec « / » : site=…/point=…, et @ reconnaît le site déjà connu", () => {
  const inv = analyser([
    "switch SW-1 | site=ILM / Issy | point=Centre administratif",
    "switch SW-2 | @ILM / Issy/Centre administratif | sur SW-1:1",
    "switch SW-3 | @ILM / Issy | sur SW-1:2",
  ].join("\n"));
  const e = (n: string) => inv.equipements.find((x) => x.nom === n)!;
  assert.deepEqual(inv.sites.map((s) => s.nom), ["ILM / Issy"]);
  assert.equal(e("SW-1").point, "Centre administratif");
  assert.equal(e("SW-2").site, "ILM / Issy");
  assert.equal(e("SW-2").point, "Centre administratif");
  assert.equal(e("SW-3").point, undefined);
});

test("ports=24, 8, 48 et sfp=4, 0, 2 : un nombre par switch, dans l'ordre des noms", () => {
  const inv = analyser("site S\nswitch SW-A, SW-B, SW-C | ports=24, 8, 48 | sfp=4, 0, 2\nswitch SW-D, SW-E | ports=16, 8, 24\nSW-B:9 -> SW-C:40");
  const f = (n: string) => facade(inv.equipements.find((e) => e.nom === n)!, inv);
  const compte = (n: string, t: string) => f(n).ports.filter((p) => p.type === t).length;
  assert.deepEqual(["SW-A", "SW-B", "SW-C"].map((n) => [compte(n, "rj45"), compte(n, "sfp")]), [[24, 4], [8, 0], [48, 2]]);
  assert.ok(inv.alertes.some((a) => /Le port 9 n'existe pas sur SW-B/.test(a.msg)));
  assert.ok(inv.alertes.some((a) => /3 valeurs de ports pour 2 équipements/.test(a.msg)));
  assert.equal(analyser("switch SW-X, SW-Y | ports=24, huit").alertes.filter((a) => a.niveau === "erreur").length, 1);
});

test("sur SW-1:3, 7, 12 : chaque caméra sur son port", () => {
  const inv = analyser("site S\nswitch SW-1 | ports=24\ncamera CAM-A, CAM-B, CAM-C | 10.0.30.11 | sur SW-1:3, 7, 12\ncamera CAM x4 | sur SW-1:20,22");
  const port = (n: string) => inv.liaisons.find((l) => l.a === n || l.b === n)!;
  const p = (n: string) => { const l = port(n); return l.a === "SW-1" ? l.portA : l.portB; };
  assert.deepEqual(["CAM-A", "CAM-B", "CAM-C"].map(p), ["3", "7", "12"]);
  assert.deepEqual(["CAM-1", "CAM-2", "CAM-3", "CAM-4"].map(p), ["20", "22", "23", "24"]);
  assert.ok(inv.alertes.some((a) => /2 ports pour 4 équipements/.test(a.msg)));
});

test("import Excel (.xlsx) : colonnes reconnues par leur titre, topologie sans erreur", async () => {
  const { readFileSync } = await import("node:fs");
  const { lireTableur, tableurVersTexte } = await import("../src/tableur.ts");
  const buf = readFileSync(new URL("./fixtures/inventaire.xlsx", import.meta.url));
  const lignes = await lireTableur("inventaire.xlsx", buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const r = tableurVersTexte(lignes);  // un seul onglet utile, l autre est ignoré
  assert.equal(r.equipements, 5);
  const inv = analyser(r.texte);
  assert.deepEqual(inv.alertes.filter((a) => a.niveau === "erreur"), []);
  assert.deepEqual(inv.sites.map((s) => s.nom), ["Nord / Lille"]);
  const eq = (n: string) => inv.equipements.find((e) => e.nom === n)!;
  assert.equal(eq("SW-CORE").genre, "switch");
  assert.equal(eq("CAM-HALL").genre, "camera");
  assert.equal(eq("CAM-PARKING").genre, "camera");   // deviné d'après le nom
  assert.equal(eq("AP-1").genre, "borne");
  assert.equal(eq("CAM-HALL").point, "Bât A");
  assert.equal(eq("SW-ETAGE").baie, "Baie 1");
  const l = (n: string) => inv.liaisons.find((x) => x.a === n || x.b === n)!;
  assert.equal(l("CAM-HALL").b === "SW-ETAGE" ? l("CAM-HALL").portB : l("CAM-HALL").portA, "5");
  const up = inv.liaisons.find((x) => x.a === "SW-ETAGE" && x.b === "SW-CORE")!;
  assert.deepEqual([up.a, up.portA, up.b, up.portB, up.media], ["SW-ETAGE", "SFP2", "SW-CORE", "SFP1", "fibre"]);
  assert.ok(inv.liaisons.some((x) => (x.a === "AP-1" && x.b === "SW-CORE") || (x.b === "AP-1" && x.a === "SW-CORE")));
});

test("import CSV (Excel français, « ; ») et modèle fourni", async () => {
  const { lireCsv, tableurVersTexte, modeleCsv } = await import("../src/tableur.ts");
  const r = tableurVersTexte(lireCsv(modeleCsv().replace(/^﻿/, "")));
  assert.equal(r.equipements, 8);
  const inv = analyser(r.texte);
  assert.deepEqual(inv.alertes.filter((a) => a.niveau === "erreur"), []);
  const c = lireCsv('Nom;IP;Remarque\r\n"CAM;1";10.0.0.5;"dit ""bonjour"""\r\n');
  assert.deepEqual(c[1], ["CAM;1", "10.0.0.5", 'dit "bonjour"']);
});

test("import Excel à plusieurs onglets : sites, types, liaisons, onglets ignorés", async () => {
  const { readFileSync } = await import("node:fs");
  const { lireTableur, tableurVersTexte } = await import("../src/tableur.ts");
  const buf = readFileSync(new URL("./fixtures/onglets.xlsx", import.meta.url));
  const feuilles = await lireTableur("onglets.xlsx", buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  assert.deepEqual(feuilles.map((f) => f.nom), ["Lyon", "Lille", "Caméras", "Liaisons", "Notes"]);   // l'onglet masqué est sauté
  const r = tableurVersTexte(feuilles);
  assert.equal(r.equipements, 6);
  assert.match(r.onglets.find((o) => o.nom === "Notes")!.lu, /ignoré/);
  assert.match(r.onglets.find((o) => o.nom === "Liaisons")!.lu, /1 liaison/);
  const inv = analyser(r.texte);
  assert.deepEqual(inv.alertes.filter((a) => a.niveau === "erreur"), []);
  const eq = (n: string) => inv.equipements.find((e) => e.nom === n)!;
  assert.equal(eq("SW-LILLE").site, "Lille");          // nom de l'onglet = site
  assert.equal(eq("CAM-LYON-1").point, "École");
  assert.equal(eq("DOME-HALL").genre, "camera");       // onglet « Caméras » = type
  assert.equal(eq("SW-LYON-CORE").ip, "10.2.0.2");     // le doublon de l'onglet Caméras est ignoré
  assert.ok(!inv.equipements.some((e) => e.nom === "NE-PAS-LIRE"));
  const vpn = inv.liaisons.find((l) => l.a === "SW-LYON-CORE" && l.b === "SW-LILLE")!;
  assert.deepEqual([vpn.portA, vpn.portB, vpn.media, vpn.vlans], ["Te1", "Te1", "vpn", "10,30"]);
});

test("ports écrits à la façon Excel : RJ45 9, Port 9, SFP 2, WAN 1…", async () => {
  const { portExcel, tableurVersTexte } = await import("../src/tableur.ts");
  const cas: [string, string][] = [["RJ45 9", "9"], ["rj45-9", "9"], ["RJ-45 n°9", "9"], ["Port 9", "9"], ["n° 9", "9"], ["9", "9"], ["LAN 3", "3"],
    ["SFP 2", "SFP2"], ["SFP+1", "SFP1"], ["Fibre 1", "SFP1"], ["WAN 1", "WAN1"], ["Gi1/0/9", "Gi1/0/9"], ["Te1", "Te1"], ["", ""]];
  for (const [e, s] of cas) assert.equal(portExcel(e), s, e);
  const r = tableurVersTexte([["Nom", "Type", "Branché sur", "Port", "Nb ports", "SFP"], ["SW-1", "switch", "", "", "RJ45 24", "2"], ["CAM-1", "caméra", "SW-1", "RJ45 9", "", ""]]);
  const inv = analyser(r.texte);
  assert.deepEqual(inv.alertes.filter((a) => a.niveau === "erreur"), []);
  const l = inv.liaisons[0];
  assert.equal(l.a === "SW-1" ? l.portA : l.portB, "9");
  assert.equal(lirePort("RJ45-9").type, "rj45");
  assert.equal(lirePort("RJ45-9").n, 9);
});

test("un équipement écrit sans site rejoint le site de ce à quoi il est relié", async () => {
  const inv = analyser("passerelle GW-1 | 10.0.0.1\nswitch SW-1 | @Lyon | sur GW-1:LAN1\nparefeu FW-1\nFW-1:WAN -> GW-1:LAN2");
  assert.deepEqual(inv.equipements.map((e) => e.site), ["Lyon", "Lyon", "Lyon"]);
  assert.deepEqual(inv.sites.map((s) => s.nom), ["Lyon"]);
  // Excel : passerelle sans site, et cellules Site fusionnées (vides sous la 1re)
  const { tableurVersTexte } = await import("../src/tableur.ts");
  const r = tableurVersTexte([["Nom", "Type", "Site", "Branché sur", "Port"],
    ["SW-A", "switch", "Nanterre", "GW-A", "LAN1"], ["CAM-A", "caméra", "", "SW-A", "3"], ["GW-A", "passerelle", "", "", ""],
    ["GW-X", "passerelle", "", "", ""]]);
  const i2 = analyser(r.texte);
  assert.equal(i2.equipements.find((e) => e.nom === "GW-A")!.site, "Nanterre");
  assert.equal(i2.equipements.find((e) => e.nom === "CAM-A")!.site, "Nanterre");
  const r2 = tableurVersTexte([["Nom", "Type", "Branché sur"], ["GW-B", "passerelle", ""], ["SW-B", "switch", "GW-B"]]);
  assert.deepEqual(analyser(r2.texte).sites.map((s) => s.nom), ["Site principal"]);
});

test("Excel mis en forme de tableau : un tableau par site, ports « 24 + 4 SFP », plusieurs VLAN", async () => {
  const { readFileSync } = await import("node:fs");
  const { lireTableur, tableurVersTexte, vlansDe, portsEtSfp } = await import("../src/tableur.ts");
  const buf = readFileSync(new URL("./fixtures/tableaux.xlsx", import.meta.url));
  const feuilles = await lireTableur("tableaux.xlsx", buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  assert.deepEqual(feuilles[0].tableaux!.map((t) => t.nom), ["Tableau1", "Tableau_Issy"]);
  const r = tableurVersTexte(feuilles);
  const inv = analyser(r.texte);
  assert.deepEqual(inv.alertes.filter((a) => a.niveau === "erreur"), []);
  const eq = (n: string) => inv.equipements.find((e) => e.nom === n)!;
  assert.equal(eq("SW-NANT").site, "Nanterre");     // titre « Site : Nanterre » au-dessus du tableau
  assert.equal(eq("GW-NANT").site, "Nanterre");
  assert.equal(eq("SW-ISSY").site, "Issy");         // nom du tableau « Tableau_Issy »
  assert.equal(eq("CAM-LYON").site, "Lyon");        // plages empilées sans objet Tableau
  assert.equal(eq("SW-LILLE2").site, "Lille");
  assert.ok(!inv.equipements.some((e) => e.nom === "Nom"));
  const kv = (n: string, k: string) => eq(n).kv.find(([c]) => c === k)?.[1];
  assert.equal(kv("SW-NANT", "ports"), "24");
  assert.equal(kv("SW-NANT", "sfp"), "4");
  assert.equal(kv("SW-NANT", "VLAN"), "10,20");     // deux colonnes VLAN
  const up = inv.liaisons.find((l) => l.a === "SW-ISSY")!;
  assert.equal(up.vlans, "10,20,30");
  assert.equal(up.mode, "trunk");
  assert.equal(vlansDe(["10 Vidéo ; 20 Admin", "100-110", "20"]), "10,20,100-110");
  assert.deepEqual(portsEtSfp("48 RJ45 / 4 SFP+", ""), { rj: "48", sfp: "4" });
  assert.deepEqual(portsEtSfp("24", "2"), { rj: "24", sfp: "2" });
});

test("Excel : « Insérer › Tableau » après coup (en-têtes dans le tableau, ligne Total, Colonne1…)", async () => {
  const { readFileSync } = await import("node:fs");
  const { lireTableur, tableurVersTexte } = await import("../src/tableur.ts");
  const buf = readFileSync(new URL("./fixtures/mon-tableau.xlsx", import.meta.url));
  const r = tableurVersTexte(await lireTableur("mon-tableau.xlsx", buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)));
  const inv = analyser(r.texte);
  assert.deepEqual(inv.alertes, []);
  assert.deepEqual(inv.equipements.map((e) => `${e.nom}@${e.site}`), ["SW-1@Nanterre", "CAM-1@Nanterre", "CAM-2@Nanterre", "SW-LY@Lyon", "CAM-LY@Lyon"]);
  assert.ok(!inv.equipements.some((e) => /^(total|nom|colonne)/i.test(e.nom)));
});

test("n° de série, adresse MAC, masque : lus, contrôlés, un par équipement", async () => {
  const inv = analyser("site S\nswitch SW-1 | 10.0.0.2 | masque=255.255.255.0 | passerelle=10.0.1.1 | serie=FOC1234 | mac=0011.22aa.bbcc\n"
    + "camera CAM-A, CAM-B, CAM-C | 10.0.30.11 | sur SW-1:3 | S/N=A1, , A3 | mac=00-11-22-33-44-01, 00:11:22:33:44:02\n"
    + "camera CAM-X | 10.0.30.50 | sur SW-1:9 | mac=zz | serie=A1 | masque=255.0.255.0");
  const kv = (n: string, k: string) => inv.equipements.find((e) => e.nom === n)!.kv.find(([c]) => c === k)?.[1];
  assert.equal(kv("SW-1", "mac"), "00:11:22:AA:BB:CC");
  assert.equal(kv("SW-1", "serie"), "FOC1234");
  assert.equal(kv("CAM-A", "serie"), "A1");
  assert.equal(kv("CAM-B", "serie"), undefined);     // case vide : rien, et la suivante garde sa place
  assert.equal(kv("CAM-C", "serie"), "A3");
  assert.equal(kv("CAM-B", "mac"), "00:11:22:33:44:02");
  const msg = inv.alertes.map((a) => a.msg).join("\n");
  assert.match(msg, /Passerelle 10\.0\.1\.1 hors du réseau de SW-1/);   // grâce au masque
  assert.match(msg, /Adresse MAC de CAM-X illisible/);
  assert.match(msg, /Masque de CAM-X illisible/);
  assert.match(msg, /n° de série A1 de CAM-X est déjà celui de CAM-A/i);
  const { tableurVersTexte } = await import("../src/tableur.ts");
  const r = tableurVersTexte([["Nom", "IP", "Masque de sous-réseau", "N° de série", "Adresse MAC", "Garantie", "Firmware"],
    ["SW-9", "10.1.0.2", "/24", "FOC99", "AA-BB-CC-DD-EE-FF", "2027", "17.9 -> 17.12"]]);
  const e = analyser(r.texte).equipements[0];
  assert.deepEqual(Object.fromEntries(e.kv), { masque: "/24", serie: "FOC99", mac: "AA:BB:CC:DD:EE:FF", Garantie: "2027", Firmware: "17.9 - 17.12" });
});

test("tous les équipements ont des ports (serveur, NAS, enregistreur) et tous les types de câble", async () => {
  const inv = analyser("site S\nswitch SW-1 | ports=24 | sfp=4\nserveur SRV-1 | ports=2 | sfp=2\nnvr NVR-1 | ports=8\n"
    + "SRV-1:SFP1 -> SW-1:SFP1 | dac\nSRV-1:SFP2 -> SW-1:SFP2 | fibre\nSRV-1:1 -> SW-1:20\nNVR-1:9 -> SW-1:21\n"
    + "camera CAM-1 | sur NVR-1:1 | coax\nautre AUTOMATE-1 | sur SRV-1:2 | rs485\nautre CLE-1 | sur SRV-1:3 | usb");
  const l = (a: string, pa: string) => inv.liaisons.find((x) => (x.a === a && x.portA === pa) || (x.b === a && x.portB === pa))!;
  assert.equal(l("SRV-1", "SFP1").media, "dac");
  assert.equal(l("SRV-1", "SFP2").media, "fibre");
  assert.equal(l("NVR-1", "1").media, "coax");
  assert.equal(l("SRV-1", "2").media, "serie");
  const msg = inv.alertes.map((a) => a.msg).join("\n");
  assert.match(msg, /Le port 9 n'existe pas sur NVR-1/);      // 8 ports déclarés
  assert.match(msg, /Le port 3 n'existe pas sur SRV-1/);      // 2 ports RJ45
  const { tableurVersTexte } = await import("../src/tableur.ts");
  const r = tableurVersTexte([["Nom", "Type", "Branché sur", "Port", "Port local", "Câble", "Ports", "SFP"],
    ["SW-2", "switch", "", "", "", "", "24", "4"], ["SRV-2", "serveur", "SW-2", "SFP1", "SFP1", "DAC", "2", "2"], ["API-1", "automate", "SRV-2", "1", "", "RS-485", "", ""]]);
  const i2 = analyser(r.texte);
  assert.equal(i2.liaisons.find((x) => x.a === "SRV-2")!.media, "dac");
  assert.equal(i2.liaisons.find((x) => x.a === "API-1" || x.b === "API-1")!.media, "serie");
  assert.equal(i2.equipements.find((e) => e.nom === "SRV-2")!.kv.find(([k]) => k === "sfp")?.[1], "2");
});

test("Excel : ports et câbles pour tous les équipements, plusieurs câbles sur une ligne", async () => {
  const { tableurVersTexte, lireCsv, modeleCsv } = await import("../src/tableur.ts");
  const r = tableurVersTexte([["Nom", "Type", "Ports", "SFP", "Branché sur", "Port", "Port local", "Câble", "Branché sur 2", "Port 2", "Port local 2", "Câble 2"],
    ["SW-1", "switch", "24", "4", "", "", "", "", "", "", "", ""],
    ["SRV-1", "serveur", "2", "2", "SW-1", "SFP1", "SFP1", "DAC", "SW-1", "RJ45 20", "1", "cuivre"],
    ["NAS-1", "nas", "4", "", "SW-1", "21", "1", "", "", "", "", ""],
    ["API-1", "automate", "", "", "SRV-1", "2", "", "RS-485", "", "", "", ""]]);
  const inv = analyser(r.texte);
  assert.deepEqual(inv.alertes, []);
  const de = (a: string) => inv.liaisons.filter((x) => x.a === a || x.b === a).map((x) => `${x.a}:${x.portA ?? ""}->${x.b}:${x.portB ?? ""} ${x.media ?? ""}`).sort();
  assert.deepEqual(de("SRV-1"), ["API-1:->SRV-1:2 serie", "SRV-1:1->SW-1:20 cuivre", "SRV-1:SFP1->SW-1:SFP1 dac"]);
  assert.deepEqual(de("NAS-1"), ["NAS-1:1->SW-1:21 cuivre"]);
  assert.ok(!inv.equipements.find((e) => e.nom === "SRV-1")!.kv.some(([k]) => /2$/.test(k)));   // pas recopié en « info »
  const m = analyser(tableurVersTexte(lireCsv(modeleCsv().replace(/^﻿/, ""))).texte);
  assert.deepEqual(m.alertes.filter((a) => a.niveau === "erreur"), []);
  assert.equal(m.equipements.length, 8);
});
