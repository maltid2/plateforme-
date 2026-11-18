/**
 * La vue 3D : chaque site est une salle, chaque baie un vrai rack, chaque
 * switch y est monté avec sa façade (le même dessin qu'en 2D, plaqué en
 * texture). Les câbles partent du port, descendent au sol et vont jusqu'à
 * la caméra, la borne ou le poste. Les liaisons entre sites passent en arc.
 *
 * Tout est procédural : boîtes, cylindres et textures dessinées sur place.
 * Aucun modèle ni image à télécharger — l'outil fonctionne hors ligne.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { APPARENCE, COULEUR_INTERSITE, COULEUR_TRUNK } from "./apparence.ts";
import type { Disposition } from "./disposition.ts";
import { FH, type Facade } from "./facade.ts";
import { svgFacade } from "./plan2d.ts";
import type { Equipement, Genre, Inventaire } from "./saisie.ts";

type Rappels = { choisir: (nom: string | null) => void };
export type Vue3D = {
  afficher: (inv: Inventaire, d: Disposition, site: string | null) => void;
  selectionner: (nom: string | null, centrer?: boolean) => void;
  cadrer: () => void;
};

const U = 0.3;              // hauteur d'un U
const RL = 2.2, RD = 2.0;   // largeur et profondeur d'un équipement 19"
const BW = 2.9, BD = 2.6;   // encombrement d'une baie
const EN_BAIE = new Set<Genre>(["passerelle", "parefeu", "switch", "serveur", "nas", "nvr", "onduleur"]);
const HAUTEUR_U: Partial<Record<Genre, number>> = { serveur: 2, nas: 2, nvr: 2, onduleur: 2 };

/* ---------- façades simples (serveur, NVR, onduleur) ---------- */
function svgSimple(e: Equipement, u: number): string {
  const w = 22, h = 3 * u, c = APPARENCE[e.genre].couleur;
  const nom = e.nom.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  let detail = "";
  if (e.genre === "serveur" || e.genre === "nas") {
    for (let i = 0; i < 8; i++)
      detail += `<rect x="${8 + i * 1.6}" y="0.5" width="1.4" height="${h - 1}" rx="0.1" fill="#161b22" stroke="#4a5361" stroke-width="0.06"/>
        <rect x="${8.4 + i * 1.6}" y="${h - 1.1}" width="0.3" height="0.18" fill="${i < 6 ? "#3DDC97" : "#2a313b"}"/>`;
  } else if (e.genre === "onduleur") {
    detail = `<rect x="8" y="${h / 2 - 1}" width="5" height="2" rx="0.2" fill="#0d2a1f" stroke="#3DDC97" stroke-width="0.08"/>
      <text x="10.5" y="${h / 2 + 0.35}" font-size="1" text-anchor="middle" fill="#3DDC97" font-family="monospace">100%</text>
      <circle cx="15" cy="${h / 2}" r="0.4" fill="#3DDC97"/><circle cx="16.4" cy="${h / 2}" r="0.4" fill="#FFD166"/>`;
  } else {
    detail = `<rect x="8" y="${h / 2 - 0.5}" width="10" height="1" rx="0.2" fill="#0b0e12"/>` +
      Array.from({ length: 4 }, (_, i) => `<circle cx="${19 + i * 0.7}" cy="${h / 2}" r="0.2" fill="#3DDC97"/>`).join("");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="1024" height="${Math.round((1024 * h) / w)}" font-family="Arial, sans-serif">
    <defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4350"/><stop offset="1" stop-color="#181d24"/></linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#c)"/><rect x="0.3" y="0.3" width="0.25" height="${h - 0.6}" fill="${c}"/>
    <text x="0.9" y="${h / 2 - 0.1}" font-size="1.05" font-weight="700" fill="#F5F7FA">${nom}</text>
    <text x="0.9" y="${h / 2 + 1}" font-size="0.75" fill="#B9C3CF" font-family="monospace">${e.ip ?? ""}</text>${detail}</svg>`;
}

export function creerVue3D(hote: HTMLElement, cb: Rappels): Vue3D {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090d);
  scene.fog = new THREE.Fog(0x07090d, 160, 420);
  const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 3000);
  const rnd = new THREE.WebGLRenderer({ antialias: true });
  rnd.setPixelRatio(Math.min(devicePixelRatio, 2));
  rnd.outputColorSpace = THREE.SRGBColorSpace;
  hote.appendChild(rnd.domElement);
  const etiq = new CSS2DRenderer();
  Object.assign(etiq.domElement.style, { position: "absolute", inset: "0", pointerEvents: "none" });
  hote.appendChild(etiq.domElement);

  const ctrl = new OrbitControls(cam, rnd.domElement);
  ctrl.enableDamping = true;
  ctrl.maxPolarAngle = Math.PI * 0.49;
  ctrl.screenSpacePanning = true;

  scene.add(new THREE.HemisphereLight(0xcfdcff, 0x0b0e14, 1.25));
  const soleil = new THREE.DirectionalLight(0xffffff, 1.5);
  soleil.position.set(30, 70, 60);
  scene.add(soleil);
  const contre = new THREE.DirectionalLight(0x8d7cff, 0.35);
  contre.position.set(-40, 30, -50);
  scene.add(contre);

  let racine = new THREE.Group();
  scene.add(racine);
  let jetables: { dispose(): void }[] = [];
  let cliquables: THREE.Object3D[] = [];
  const objets = new Map<string, THREE.Object3D>();
  let surbrillance: THREE.Box3Helper | null = null;
  let emprise = new THREE.Box3(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 1, 5));

  // Les textures de façade coûtent un rendu SVG : on les garde d'une frappe à l'autre.
  const cacheTex = new Map<string, { tex: THREE.Texture; vu: number }>();
  let generation = 0;
  function texture(svg: string): THREE.Texture {
    const c = cacheTex.get(svg);
    if (c) { c.vu = generation; return c.tex; }
    const img = new Image();
    const canvas = document.createElement("canvas");
    // La taille du canvas doit être fixée AVANT le premier envoi à la carte
    // graphique : three.js réserve alors un stockage qui ne se redimensionne pas.
    canvas.width = Number(svg.match(/\swidth="(\d+)"/)?.[1] ?? 2048);
    canvas.height = Number(svg.match(/\sheight="(\d+)"/)?.[1] ?? 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = rnd.capabilities.getMaxAnisotropy();
    img.onload = () => {
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      tex.needsUpdate = true;
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    cacheTex.set(svg, { tex, vu: generation });
    return tex;
  }

  const std = (c: string | number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.25, ...o });
    jetables.push(m);
    return m;
  };
  const geo = <T extends THREE.BufferGeometry>(g: T) => { jetables.push(g); return g; };
  const boite = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[]) => new THREE.Mesh(geo(new THREE.BoxGeometry(w, h, d)), m);
  const cyl = (r1: number, r2: number, h: number, m: THREE.Material, seg = 20) => new THREE.Mesh(geo(new THREE.CylinderGeometry(r1, r2, h, seg)), m);
  const P = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => { o.position.set(x, y, z); return o; };

  function etiquette(texte: string, classe = "etiquette3d") {
    const div = document.createElement("div");
    div.className = classe;
    div.textContent = texte;
    return new CSS2DObject(div);
  }

  function cable(points: THREE.Vector3[], couleur: string, rayon: number, opacite = 1) {
    const c = new THREE.CatmullRomCurve3(points, false, "centripetal");
    const m = new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.7, metalness: 0, transparent: opacite < 1, opacity: opacite });
    jetables.push(m);
    return new THREE.Mesh(geo(new THREE.TubeGeometry(c, Math.max(32, points.length * 14), rayon, 6, false)), m);
  }

  /* ---------- la baie ---------- */
  function baie(nbU: number) {
    const g = new THREE.Group();
    const H = nbU * U + 0.6;
    const noir = std(0x15191f, { metalness: 0.4, roughness: 0.6 });
    const acier = std(0x2b323c, { metalness: 0.5, roughness: 0.45 });
    g.add(P(boite(BW, 0.18, BD, noir), 0, 0.09, 0));                    // socle
    g.add(P(boite(BW, 0.12, BD, acier), 0, H - 0.06, 0));               // toit
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) =>
      g.add(P(boite(0.12, H, 0.12, acier), (sx * (BW - 0.12)) / 2, H / 2, (sz * (BD - 0.12)) / 2)));
    // Flancs fumés et fond : on devine l'intérieur sans qu'il se noie.
    const verre = std(0x0d1117, { transparent: true, opacity: 0.55, metalness: 0.6, roughness: 0.2 });
    [-1, 1].forEach((s) => g.add(P(boite(0.03, H - 0.3, BD - 0.2, verre), (s * (BW - 0.05)) / 2, H / 2, 0)));
    g.add(P(boite(BW - 0.2, H - 0.3, 0.03, noir), 0, H / 2, -BD / 2 + 0.03));
    // Rails 19" percés à l'avant.
    const rail = std(0x6b7684, { metalness: 0.7, roughness: 0.35 });
    [-1, 1].forEach((s) => {
      g.add(P(boite(0.1, H - 0.4, 0.04, rail), (s * (RL + 0.12)) / 2, H / 2, RD / 2 + 0.02));
      for (let i = 0; i < nbU; i++) g.add(P(boite(0.04, 0.04, 0.01, noir), (s * (RL + 0.12)) / 2, 0.3 + (i + 0.5) * U, RD / 2 + 0.045));
    });
    return { g, H };
  }

  /* ---------- un équipement monté ---------- */
  function monte(e: Equipement, f: Facade | undefined, inv: Inventaire, u: number) {
    const h = u * U - 0.02;
    const flanc = std(0x232a33, { metalness: 0.45 });
    const face = new THREE.MeshStandardMaterial({ map: texture(f ? svgFacade(e, f, inv) : svgSimple(e, u)), roughness: 0.6, metalness: 0.1 });
    jetables.push(face);
    const m = boite(RL, h, RD, [flanc, flanc, flanc, flanc, face, flanc]);
    m.userData.nom = e.nom;
    const g = new THREE.Group();
    g.add(m);
    // Oreilles vissées sur les rails.
    const oreille = std(0x3a4350, { metalness: 0.6 });
    [-1, 1].forEach((s) => g.add(P(boite(0.14, h, 0.03, oreille), (s * (RL + 0.12)) / 2, 0, RD / 2 + 0.05)));
    return { g, h };
  }

  /* ---------- équipements hors baie ---------- */
  function modele(e: Equipement): { g: THREE.Group; prise: THREE.Vector3 } {
    const c = APPARENCE[e.genre].couleur;
    const g = new THREE.Group();
    const gris = std(0x3b4450), clair = std(0xd9dee5, { roughness: 0.4 }), noir = std(0x111418);
    const accent = std(c, { emissive: new THREE.Color(c), emissiveIntensity: 0.6 });
    let prise = new THREE.Vector3(0, 0.3, 0);
    switch (e.genre) {
      case "camera": {
        g.add(P(cyl(0.06, 0.08, 1.9, gris), 0, 0.95, 0));
        g.add(P(cyl(0.22, 0.26, 0.06, gris), 0, 0.03, 0));
        const dome = e.infos.some((i) => /d[oô]me/i.test(i));
        if (dome) {
          g.add(P(cyl(0.32, 0.32, 0.12, clair, 28), 0, 1.95, 0.05));
          const coque = new THREE.Mesh(geo(new THREE.SphereGeometry(0.28, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)),
            std(0x0d1117, { transparent: true, opacity: 0.8, metalness: 0.6, roughness: 0.1 }));
          g.add(P(coque, 0, 1.89, 0.05));
          g.add(P(cyl(0.05, 0.05, 0.04, accent, 12), 0, 1.86, 0.17));
        } else {
          g.add(P(boite(0.08, 0.08, 0.4, gris), 0, 1.88, 0.18));
          const corps = P(cyl(0.16, 0.16, 0.85, clair, 20), 0, 1.82, 0.55);
          corps.rotation.x = Math.PI / 2 - 0.25; g.add(corps);
          const visiere = P(boite(0.4, 0.04, 0.95, clair), 0, 2.0, 0.55); visiere.rotation.x = -0.25; g.add(visiere);
          const objectif = P(cyl(0.12, 0.12, 0.04, noir, 20), 0, 1.71, 0.97); objectif.rotation.x = Math.PI / 2 - 0.25; g.add(objectif);
          g.add(P(cyl(0.035, 0.035, 0.02, accent, 10), 0.08, 1.74, 0.96));
        }
        prise = new THREE.Vector3(0, 0.1, 0);
        break;
      }
      case "borne":
        g.add(P(cyl(0.06, 0.08, 2.3, gris), 0, 1.15, 0));
        g.add(P(cyl(0.22, 0.26, 0.06, gris), 0, 0.03, 0));
        g.add(P(cyl(0.48, 0.5, 0.12, clair, 32), 0, 2.36, 0));
        g.add(P(cyl(0.08, 0.08, 0.02, accent, 16), 0, 2.29, 0));
        prise = new THREE.Vector3(0, 0.1, 0);
        break;
      case "poste": case "telephone": {
        const plateau = std(0x2a2f37, { roughness: 0.7 });
        g.add(P(boite(1.6, 0.06, 0.9, plateau), 0, 0.78, 0));
        [[-0.72, -0.38], [0.72, -0.38], [-0.72, 0.38], [0.72, 0.38]].forEach(([x, z]) => g.add(P(boite(0.05, 0.76, 0.05, gris), x, 0.38, z)));
        if (e.genre === "poste") {
          g.add(P(boite(0.9, 0.55, 0.04, noir), 0, 1.22, -0.2));
          g.add(P(boite(0.84, 0.49, 0.01, accent), 0, 1.22, -0.177));
          g.add(P(boite(0.08, 0.22, 0.08, gris), 0, 0.92, -0.22));
          g.add(P(boite(0.5, 0.02, 0.16, gris), 0, 0.82, 0.15));
          g.add(P(boite(0.22, 0.48, 0.48, noir), 0.6, 0.24, 0));
        } else {
          g.add(P(boite(0.32, 0.08, 0.26, noir), 0, 0.85, 0));
          g.add(P(boite(0.12, 0.02, 0.08, accent), 0.05, 0.9, 0.02));
        }
        prise = new THREE.Vector3(0.6, 0.2, 0);
        break;
      }
      case "imprimante":
        g.add(P(boite(0.95, 0.75, 0.8, clair), 0, 0.375, 0));
        g.add(P(boite(0.7, 0.04, 0.4, noir), 0, 0.77, 0.1));
        g.add(P(boite(0.2, 0.08, 0.02, accent), -0.25, 0.65, 0.41));
        break;
      default:
        g.add(P(boite(0.8, 0.8, 0.8, std(0x1b2430)), 0, 0.4, 0));
        g.add(P(boite(0.82, 0.08, 0.82, accent), 0, 0.82, 0));
    }
    // Socle discret de la couleur du type : on lit la nature d'un coup d'œil.
    const socle = new THREE.Mesh(geo(new THREE.CircleGeometry(1.0, 32)), std(c, { transparent: true, opacity: 0.12, depthWrite: false }));
    socle.rotation.x = -Math.PI / 2; socle.position.y = 0.012;
    g.add(socle);
    return { g, prise };
  }

  /* ---------- la scène ---------- */
  function afficher(inv: Inventaire, d: Disposition, site: string | null) {
    generation++;
    racine.traverse((o) => { if (o instanceof CSS2DObject) o.element.remove(); });
    scene.remove(racine);
    jetables.forEach((j) => j.dispose());
    jetables = [];
    cliquables = [];
    objets.clear();
    surbrillance = null;
    racine = new THREE.Group();
    scene.add(racine);

    const parNom = new Map(inv.equipements.map((e) => [e.nom, e]));
    const visibles = new Set(inv.equipements.filter((e) => !site || e.site === site).map((e) => e.nom));
    const cadres = d.cadres.filter((c) => !site || c.nom === site);
    /** Où se branche un câble : le port sur la façade, ou la prise d'un équipement. */
    const prises = new Map<string, { port: (id?: string) => THREE.Vector3; enBaie: boolean; hautBaie?: THREE.Vector3 }>();

    cadres.forEach((c) => {
      // Le sol de la salle.
      const sol = boite(c.w, 0.2, c.h, std(0x10151c, { roughness: 0.9, metalness: 0 }));
      sol.position.set(c.x + c.w / 2, -0.1, c.y + c.h / 2);
      racine.add(sol);
      const cote = Math.max(c.w, c.h);
      const grille = new THREE.GridHelper(cote, Math.round(cote / 2), 0x1d2530, 0x161c25);
      grille.position.set(c.x + c.w / 2, 0.005, c.y + c.h / 2);
      grille.scale.set(c.w / cote, 1, c.h / cote);
      jetables.push(grille.geometry, grille.material as THREE.Material);
      racine.add(grille);
      const t = etiquette(c.nom, "etiquette3d site");
      t.position.set(c.x + 1.2, 0.3, c.y + 0.9);
      t.center.set(0, 0.5);
      racine.add(t);

      // Les baies, alignées au fond de la salle.
      const eqs = inv.equipements.filter((e) => e.site === c.nom);
      const groupes = new Map<string, Equipement[]>();
      eqs.filter((e) => EN_BAIE.has(e.genre)).forEach((e) => {
        const k = e.baie ?? "Baie";
        if (!groupes.has(k)) groupes.set(k, []);
        groupes.get(k)!.push(e);
      });
      const nb = groupes.size;
      let k = 0;
      groupes.forEach((liste, nomBaie) => {
        const x = c.x + c.w / 2 + (k++ - (nb - 1) / 2) * (BW + 1.2);
        const z = c.y + 3.2;
        const nbU = Math.max(12, liste.reduce((t, e) => t + (HAUTEUR_U[e.genre] ?? 1), 0) + 4);
        const { g, H } = baie(nbU);
        g.position.set(x, 0, z);
        racine.add(g);
        const lb = etiquette(`▤ ${nomBaie}`, "etiquette3d baie");
        lb.position.set(x, H + 0.35, z);
        racine.add(lb);
        // Du haut vers le bas, dans l'ordre de la saisie, avec un U d'air sous le toit.
        let y = H - 0.3 - U;
        liste.forEach((e) => {
          const u = HAUTEUR_U[e.genre] ?? 1;
          const f = d.facades.get(e.nom);
          const { g: gm, h } = monte(e, f, inv, u);
          const cy = y - h / 2;
          gm.position.set(x, cy, z);
          racine.add(gm);
          y -= u * U;
          if (!visibles.has(e.nom)) return;
          cliquables.push(gm.children[0]);
          objets.set(e.nom, gm);
          const avant = z + RD / 2 + 0.03;
          prises.set(e.nom, {
            enBaie: true,
            hautBaie: new THREE.Vector3(x, H + 0.1, z),
            port: (id) => {
              const p = f && id ? f.parId.get(id) : undefined;
              if (!p || !f) return new THREE.Vector3(x + RL / 2 - 0.2, cy, avant);
              return new THREE.Vector3(x - RL / 2 + (p.x / f.w) * RL, cy + h / 2 - (p.y / FH) * h, avant);
            },
          });
        });
      });

      // Le reste, posé dans la salle à la même place que sur le plan 2D.
      eqs.filter((e) => !EN_BAIE.has(e.genre)).forEach((e) => {
        if (!visibles.has(e.nom)) return;
        const p = d.pos.get(e.nom)!;
        const { g, prise } = modele(e);
        g.position.set(p.x, 0, Math.max(p.y, c.y + 7));
        g.userData.nom = e.nom;
        racine.add(g);
        cliquables.push(g);
        objets.set(e.nom, g);
        const lb = etiquette(e.nom);
        lb.position.set(0, e.genre === "camera" ? 2.5 : e.genre === "borne" ? 2.75 : 1.7, 0);
        g.add(lb);
        const pw = g.position.clone().add(prise);
        prises.set(e.nom, { enBaie: false, port: () => pw.clone() });
      });
    });

    // Les câbles.
    inv.liaisons.forEach((l) => {
      if (!visibles.has(l.a) || !visibles.has(l.b)) return;
      const A = prises.get(l.a), B = prises.get(l.b);
      if (!A || !B) return;
      const ea = parNom.get(l.a)!, eb = parNom.get(l.b)!;
      const trunk = l.mode === "trunk";
      if (ea.site !== eb.site) {
        const a = A.hautBaie ?? A.port(l.portA), b = B.hautBaie ?? B.port(l.portB);
        const dist = a.distanceTo(b);
        const m = a.clone().lerp(b, 0.5); m.y = Math.max(a.y, b.y) + dist * 0.28;
        racine.add(cable([a, a.clone().lerp(m, 0.5).setY(m.y * 0.85), m, b.clone().lerp(m, 0.5).setY(m.y * 0.85), b], COULEUR_INTERSITE, 0.09, 0.9));
        if (l.libelle) { const t = etiquette(l.libelle, "etiquette3d lien"); t.position.copy(m).add(new THREE.Vector3(0, 0.6, 0)); racine.add(t); }
        return;
      }
      const pa = A.port(l.portA), pb = B.port(l.portB);
      const couleur = trunk ? COULEUR_TRUNK : APPARENCE[(A.enBaie && !B.enBaie ? eb : ea).genre].couleur;
      const r = trunk ? 0.026 : 0.014;
      if (A.enBaie && B.enBaie && Math.abs(pa.x - pb.x) < BW && Math.abs(pa.z - pb.z) < 0.1) {
        // Cordon de brassage dans la même baie : une boucle devant la façade.
        const avance = 0.35 + Math.abs(pa.y - pb.y) * 0.15;
        racine.add(cable([pa, pa.clone().setZ(pa.z + 0.12), new THREE.Vector3((pa.x + pb.x) / 2 + 0.25, (pa.y + pb.y) / 2, pa.z + avance),
          pb.clone().setZ(pb.z + 0.12), pb], couleur, r));
        return;
      }
      // Sortie du port, descente devant la baie, course au sol, remontée.
      const descente = (p: THREE.Vector3, enBaie: boolean) => enBaie
        ? [p, p.clone().setZ(p.z + 0.18), new THREE.Vector3(p.x, Math.max(0.4, p.y - 0.6), p.z + 0.3), new THREE.Vector3(p.x, 0.05, p.z + 0.45)]
        : [p, new THREE.Vector3(p.x, 0.04, p.z)];
      const pts = descente(pa, A.enBaie);
      const fin = descente(pb, B.enBaie).reverse();
      const sa = pts[pts.length - 1], sb = fin[0];
      pts.push(new THREE.Vector3(sa.x, 0.05, (sa.z + sb.z) / 2), new THREE.Vector3(sb.x, 0.05, (sa.z + sb.z) / 2), ...fin);
      racine.add(cable(pts, couleur, r));
    });

    // Les textures qui ne servent plus sont libérées.
    cacheTex.forEach((v, k) => { if (v.vu !== generation) { v.tex.dispose(); cacheTex.delete(k); } });

    emprise = new THREE.Box3().setFromObject(racine);
    if (emprise.isEmpty()) emprise = new THREE.Box3(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 1, 5));
  }

  function cadrer() {
    const c = emprise.getCenter(new THREE.Vector3());
    const s = emprise.getSize(new THREE.Vector3());
    const demiFov = THREE.MathUtils.degToRad(cam.fov / 2);
    const besoin = Math.max(s.x / Math.max(cam.aspect, 0.3), s.z * 1.25, 10) / 2;
    const dist = (besoin / Math.tan(demiFov)) * 1.05;
    ctrl.target.copy(c).setY(0);
    cam.position.copy(ctrl.target).add(new THREE.Vector3(0.05, 0.62, 0.78).normalize().multiplyScalar(dist));
    ctrl.update();
  }

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let depart: { x: number; y: number } | null = null;
  rnd.domElement.addEventListener("pointerdown", (e) => { depart = { x: e.clientX, y: e.clientY }; });
  rnd.domElement.addEventListener("pointerup", (e) => {
    if (!depart || Math.hypot(e.clientX - depart.x, e.clientY - depart.y) > 4) { depart = null; return; }
    depart = null;
    const r = rnd.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, cam);
    const h = ray.intersectObjects(cliquables, true)[0];
    let o: THREE.Object3D | null = h?.object ?? null;
    while (o && !o.userData.nom) o = o.parent;
    cb.choisir((o?.userData.nom as string) ?? null);
  });

  const taille = () => {
    const w = hote.clientWidth, h = hote.clientHeight;
    if (!w || !h) return;
    rnd.setSize(w, h);
    etiq.setSize(w, h);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  };
  new ResizeObserver(taille).observe(hote);
  taille();

  rnd.setAnimationLoop(() => {
    if (!hote.offsetParent) return; // onglet caché : on ne dessine rien
    ctrl.update();
    // Vue d'ensemble : seuls les noms de sites et de baies restent ; les
    // noms d'équipements reviennent en zoomant.
    etiq.domElement.classList.toggle("loin", cam.position.distanceTo(ctrl.target) > 55);
    rnd.render(scene, cam);
    etiq.render(scene, cam);
  });

  return {
    afficher,
    cadrer,
    selectionner(nom, centrer = false) {
      if (surbrillance) { racine.remove(surbrillance); surbrillance.dispose(); surbrillance = null; }
      if (!nom) return;
      const o = objets.get(nom);
      if (!o) return;
      const bb = new THREE.Box3().setFromObject(o).expandByScalar(0.08);
      surbrillance = new THREE.Box3Helper(bb, new THREE.Color(0x8d7cff));
      racine.add(surbrillance);
      if (centrer) {
        const c = bb.getCenter(new THREE.Vector3());
        // De face et un peu au-dessus : on lit la façade et ses ports.
        ctrl.target.copy(c);
        cam.position.copy(c).add(new THREE.Vector3(1.2, 1.6, 5.5));
      }
    },
  };
}
