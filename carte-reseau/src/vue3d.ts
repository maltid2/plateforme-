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
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { APPARENCE, COULEUR_MEDIA } from "./apparence.ts";
import type { Cadre, Disposition } from "./disposition.ts";
import { FH, type Facade } from "./facade.ts";
import { svgFacade } from "./plan2d.ts";
import { CAM_PAR_PLATEAU, EN_BAIE, HAUTEUR_U, svgSimple, U_PLATEAU } from "./baies.ts";
import { PICTOS } from "./pictos.ts";
import type { Equipement, Genre, Inventaire } from "./saisie.ts";

type Rappels = { choisir: (nom: string | null) => void };
export type Vue3D = {
  afficher: (inv: Inventaire, d: Disposition, site: string | null) => void;
  selectionner: (nom: string | null, centrer?: boolean) => void;
  cadrer: () => void;
  /** La scène en .glb : s'ouvre dans la Visionneuse 3D de Windows, Blender, PowerPoint… */
  exporterGLB: () => Promise<Blob>;
};

const U = 0.3;              // hauteur d'un U
const RL = 2.2, RD = 2.0;   // largeur et profondeur d'un équipement 19"
const BW = 2.9, BD = 2.6;   // encombrement d'une baie
const MEDIAS_COURTS = { fibre: "fibre", cuivre: "RJ45", dac: "DAC", coax: "coax", serie: "série", usb: "USB", radio: "radio", vpn: "VPN" } as const;

/** Réglages de la vue, modifiables depuis l'interface. */
export const options: { cameras: "murs" | "baie" } = { cameras: "baie" };

/**
 * Ajoute deux points de part et d'autre de chaque angle : la courbe reste
 * droite le long des chemins et ne s'arrondit qu'aux coudes.
 */
function arrondir(pts: THREE.Vector3[]) {
  const out: THREE.Vector3[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const da = b.distanceTo(a), dc = b.distanceTo(c);
    if (da < 0.01) continue;
    out.push(b.clone().lerp(a, Math.min(0.25, da / 3) / da), b, b.clone().lerp(c, Math.min(0.25, dc / 3) / Math.max(dc, 0.01)));
  }
  out.push(pts[pts.length - 1]);
  return out;
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
  Object.assign(etiq.domElement.style, { position: "absolute", inset: "0", pointerEvents: "none", zIndex: "0" });
  hote.appendChild(etiq.domElement);

  const ctrl = new OrbitControls(cam, rnd.domElement);
  ctrl.enableDamping = true;
  ctrl.maxPolarAngle = Math.PI * 0.49;
  ctrl.screenSpacePanning = true;

  const ciel = new THREE.HemisphereLight(0xcfdcff, 0x0b0e14, 1.25);
  scene.add(ciel);
  const soleil = new THREE.DirectionalLight(0xffffff, 1.5);
  soleil.position.set(30, 70, 60);
  scene.add(soleil);
  const contre = new THREE.DirectionalLight(0x8d7cff, 0.35);
  contre.position.set(-40, 30, -50);
  scene.add(contre);

  /* ---------- Rendu « cinéma » (apparence Noir studio, esprit 530°) ----------
   * Studio noir, une lumière chaude qui découpe les volumes, un contre-jour
   * froid, sol sombre et brillant, léger vignettage. Aucun passage de rendu
   * en plus (pas de latence) et rien ne bouge tout seul : c'est un outil de
   * dépannage, la vue reste où on la met. */
  const cle = new THREE.DirectionalLight(0xffc48a, 0);       // lumière chaude, de face en hauteur
  cle.position.set(-35, 55, 70);
  const decoupe = new THREE.DirectionalLight(0x7fb2ff, 0);   // contre-jour froid, de derrière
  decoupe.position.set(30, 25, -80);
  scene.add(cle, decoupe);
  const voile = document.createElement("div");   // vignettage + grain, par-dessus l'image
  voile.className = "voile-cine";
  hote.insertBefore(voile, etiq.domElement);   // sous les étiquettes, au-dessus de l'image
  let cinema = false;
  function appliquerAmbiance() {
    const c = document.body.classList.contains("theme-studio");
    cinema = c;
    // Les deux apparences ont un éclairage de studio (lumière principale,
    // contre-jour, rendu « film ») ; le Noir studio est plus contrasté.
    rnd.toneMapping = THREE.ACESFilmicToneMapping;
    rnd.toneMappingExposure = c ? 1.2 : 1.12;
    ciel.intensity = c ? 0.25 : 0.95;
    soleil.intensity = c ? 0.35 : 1.1;
    contre.intensity = c ? 0 : 0.25;
    cle.color.setHex(c ? 0xffc48a : 0xfff1e0);
    cle.intensity = c ? 2.6 : 1.25;
    decoupe.intensity = c ? 1.6 : 0.8;
    voile.hidden = !c;
  }

  let racine = new THREE.Group();
  scene.add(racine);
  let jetables: { dispose(): void }[] = [];
  let cliquables: THREE.Object3D[] = [];
  const objets = new Map<string, THREE.Object3D>();
  let surbrillance: THREE.Box3Helper | null = null;
  // Vue d'ensemble : une pastille par caméra, de taille constante à l'écran,
  // pour les voir toutes même dézoomé au maximum. Elles s'effacent en zoomant.
  let apercu = new THREE.Group();
  let pastilles: THREE.Sprite[] = [];
  let sols: THREE.Mesh[] = [];
  const SEUIL_LOIN = 50;
  /**
   * Niveau de détail selon la taille à l'écran, pas selon une distance fixe :
   * une salle qui remplit l'écran est « près », quelle que soit sa taille.
   * PX_LOIN : en dessous, une unité fait moins de ce nombre de pixels.
   */
  const PX_LOIN = 9;
  const pxParUnite = (dist: number) => (hote.clientHeight || 600) / (2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
  const distancePour = (px: number) => (hote.clientHeight || 600) / (2 * px * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
  /** Au-delà : plusieurs sites à l'écran, un résumé par site. Calculé d'après le plus grand site. */
  let seuilTresLoin = SEUIL_LOIN * 2.4;
  const PASTILLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="128" height="128">
    <circle cx="0.5" cy="0.5" r="0.46" fill="${APPARENCE.camera.couleur}" stroke="#07090D" stroke-width="0.05"/>
    <g transform="translate(0.2 0.2) scale(0.6)" fill="none" stroke="#07090D" stroke-width="0.11" stroke-linecap="round" stroke-linejoin="round">${PICTOS.camera}</g></svg>`;
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

  // Matériaux et formes réutilisés : un grand réseau compte des milliers de
  // boîtes identiques (oreilles, montants, caméras). Les recréer une à une
  // coûtait plusieurs secondes à l'ouverture de la 3D.
  let cacheMat = new Map<string, THREE.Material>();
  let cacheGeo = new Map<string, THREE.BufferGeometry>();
  const std = (c: string | number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const cle = `${c}|${JSON.stringify(o)}`;
    let m = cacheMat.get(cle) as THREE.MeshStandardMaterial | undefined;
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.25, ...o });
      jetables.push(m);
      cacheMat.set(cle, m);
    }
    return m;
  };
  const geo = <T extends THREE.BufferGeometry>(g: T) => { jetables.push(g); return g; };
  const geoPartagee = (cle: string, faire: () => THREE.BufferGeometry) => {
    let g = cacheGeo.get(cle);
    if (!g) { g = geo(faire()); cacheGeo.set(cle, g); }
    return g;
  };
  const boite = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[]) =>
    new THREE.Mesh(geoPartagee(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)), m);
  const cyl = (r1: number, r2: number, h: number, m: THREE.Material, seg = 20) =>
    new THREE.Mesh(geoPartagee(`c${r1}|${r2}|${h}|${seg}`, () => new THREE.CylinderGeometry(r1, r2, h, seg)), m);
  const P = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => { o.position.set(x, y, z); return o; };

  function etiquette(texte: string, classe = "etiquette3d") {
    const div = document.createElement("div");
    div.className = classe;
    div.textContent = texte;
    return new CSS2DObject(div);
  }

  function cable(points: THREE.Vector3[], couleur: string, rayon: number, opacite = 1) {
    const c = new THREE.CatmullRomCurve3(points, false, "centripetal");
    const m = std(couleur, { roughness: 0.7, metalness: 0, transparent: opacite < 1, opacity: opacite });
    return new THREE.Mesh(geo(new THREE.TubeGeometry(c, Math.max(32, points.length * 14), rayon, 6, false)), m);
  }

  /* ---------- habillage des salles ---------- */
  // Sol technique : dalles de 60 cm, dessinées une fois sur un canvas.
  const dalles = (() => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const g = cv.getContext("2d")!;
    g.fillStyle = "#1a212b"; g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#1f2732"; g.fillRect(3, 3, 122, 122);
    g.strokeStyle = "#11161d"; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 125, 125);
    // Quelques dalles perforées (ventilation), comme dans un vrai local.
    g.fillStyle = "#151b23";
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) g.fillRect(22 + i * 15, 22 + j * 15, 5, 5);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = rnd.capabilities.getMaxAnisotropy();
    return t;
  })();
  // Voyants des équipements : trois rythmes de clignotement, pour que la
  // baie vive sans que tout clignote en même temps.
  let voyants: THREE.MeshStandardMaterial[] = [];
  const voyant = (k: number) => voyants[k % voyants.length];

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
    });
    // Les trous des rails, en une seule instance par baie (au lieu de 2 × nbU boîtes).
    const trous = new THREE.InstancedMesh(geoPartagee("trou", () => new THREE.BoxGeometry(0.04, 0.04, 0.01)), noir, nbU * 2);
    const mtx = new THREE.Matrix4();
    let n = 0;
    [-1, 1].forEach((s) => { for (let i = 0; i < nbU; i++) trous.setMatrixAt(n++, mtx.makeTranslation((s * (RL + 0.12)) / 2, 0.3 + (i + 0.5) * U, RD / 2 + 0.045)); });
    g.add(trous);
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
    // Voyants d'activité qui clignotent sur l'oreille droite.
    const graine = [...e.nom].reduce((t, ch) => t + ch.charCodeAt(0), 0);
    [0, 1].forEach((i) => g.add(P(boite(0.035, 0.035, 0.02, voyant(graine + i)), RL / 2 + 0.06, h / 2 - 0.07 - i * 0.07, RD / 2 + 0.075)));
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

  /**
   * Une caméra fixée au mur, orientée vers la salle : elle sert à repérer
   * où se trouve la caméra, pas ce qu'elle filme.
   */
  function cameraMurale(e: Equipement) {
    const g = new THREE.Group();
    const clair = std(0xd9dee5, { roughness: 0.4 }), noir = std(0x111418), gris = std(0x3b4450);
    const accent = std(APPARENCE.camera.couleur, { emissive: new THREE.Color(APPARENCE.camera.couleur), emissiveIntensity: 0.8 });
    const dome = e.infos.some((i) => /d[oô]me|fisheye|360/i.test(i));
    g.add(P(boite(0.28, 0.36, 0.05, gris), 0, 0, -0.12));             // platine murale
    g.add(P(boite(0.07, 0.07, 0.22, gris), 0, 0, 0.0));               // bras
    if (dome) {
      g.add(P(cyl(0.2, 0.2, 0.08, clair, 24), 0, 0, 0.14)).rotation.x = Math.PI / 2;
      const coque = new THREE.Mesh(geoPartagee("dome", () => new THREE.SphereGeometry(0.17, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)),
        std(0x0d1117, { transparent: true, opacity: 0.85, metalness: 0.6, roughness: 0.1 }));
      coque.rotation.x = Math.PI / 2; coque.position.z = 0.18; g.add(coque);
    } else {
      const corps = P(cyl(0.1, 0.1, 0.5, clair, 18), 0, 0.02, 0.32); corps.rotation.x = Math.PI / 2; g.add(corps);
      g.add(P(boite(0.26, 0.03, 0.56, clair), 0, 0.13, 0.32));       // visière
      const obj = P(cyl(0.075, 0.075, 0.02, noir, 16), 0, 0.02, 0.575); obj.rotation.x = Math.PI / 2; g.add(obj);
    }
    g.add(P(cyl(0.02, 0.02, 0.015, accent, 8), 0.06, -0.05, dome ? 0.24 : 0.585)).rotation.x = Math.PI / 2;
    return g;
  }

  /** Une caméra en miniature, posée sur un plateau de la baie, objectif vers l'avant. */
  function miniCamera(e: Equipement) {
    const g = new THREE.Group();
    const clair = std(0xd9dee5, { roughness: 0.4 }), noir = std(0x111418);
    const accent = std(APPARENCE.camera.couleur, { emissive: new THREE.Color(APPARENCE.camera.couleur), emissiveIntensity: 0.7 });
    if (e.infos.some((i) => /d[oô]me/i.test(i))) {
      g.add(P(cyl(0.13, 0.13, 0.04, clair, 20), 0, 0.02, 0));
      const coque = new THREE.Mesh(geo(new THREE.SphereGeometry(0.11, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)),
        std(0x0d1117, { transparent: true, opacity: 0.85, metalness: 0.6, roughness: 0.1 }));
      g.add(P(coque, 0, 0.04, 0));
      g.add(P(cyl(0.02, 0.02, 0.02, accent, 10), 0, 0.12, 0.05));
    } else {
      g.add(P(boite(0.05, 0.12, 0.05, clair), 0, 0.06, 0));
      const corps = P(cyl(0.07, 0.07, 0.32, clair, 16), 0, 0.17, 0.08);
      corps.rotation.x = Math.PI / 2; g.add(corps);
      g.add(P(boite(0.17, 0.02, 0.36, clair), 0, 0.25, 0.08));
      const obj = P(cyl(0.05, 0.05, 0.02, noir, 14), 0, 0.17, 0.245); obj.rotation.x = Math.PI / 2; g.add(obj);
      g.add(P(cyl(0.015, 0.015, 0.01, accent, 8), 0.035, 0.19, 0.25));
    }
    return g;
  }

  /* ---------- la scène ---------- */
  function afficher(inv: Inventaire, d: Disposition, site: string | null) {
    appliquerAmbiance();
    generation++;
    racine.traverse((o) => { if (o instanceof CSS2DObject) o.element.remove(); });
    scene.remove(racine);
    jetables.forEach((j) => j.dispose());
    jetables = [];
    cacheMat = new Map();
    cacheGeo = new Map();
    cliquables = [];
    objets.clear();
    surbrillance = null;
    racine = new THREE.Group();
    scene.add(racine);
    voyants = [0x3ddc97, 0x3ddc97, 0xffd166].map((c) => {
      const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1 });
      jetables.push(m);
      return m;
    });
    apercu = new THREE.Group();
    apercu.name = "apercu";
    racine.add(apercu);
    pastilles = [];
    sols = [];

    const parNom = new Map(inv.equipements.map((e) => [e.nom, e]));
    const visibles = new Set(inv.equipements.filter((e) => !site || e.site === site).map((e) => e.nom));
    const cadres = d.cadres.filter((c) => !site || c.site === site);
    const avecPoints = new Set(cadres.filter((c) => c.type === "point").map((c) => c.site));
    // Une salle par lieu ; un site sans lieux est lui-même une salle.
    const salles = cadres.filter((c) => c.type === "point" || !avecPoints.has(c.site));
    const salleDe = new Map<string, string>();
    type Prise = {
      port: (id?: string) => THREE.Vector3; enBaie: boolean; plateau?: boolean; hautBaie?: THREE.Vector3; baie?: string;
      rack?: { x: number; z: number; H: number };   // pour un équipement en baie
      mur?: boolean;                                // caméra murale : câble par le chemin de câbles
    };
    /** Le chemin de câbles de chaque salle : un U en hauteur le long des murs. */
    const chemins = new Map<string, { y: number; xL: number; xR: number; zB: number; zF: number }>();
    /** Où se branche un câble : le port sur la façade, ou la prise d'un équipement. */
    const prises = new Map<string, Prise>();

    // Chaque salle à la taille de ce qu'elle contient : la rangée de baies au
    // fond, l'espace devant, et les équipements posés au sol (bornes, postes…).
    // Le cadre du plan 2D, souvent bien plus grand, n'est qu'une limite.
    const contenu = (c: Cadre) => inv.equipements.filter((e) => e.site === c.site && (c.type === "site" || (e.point ?? "") === c.point));
    const compactes = new Map<Cadre, Cadre>();
    salles.forEach((c) => {
      const eqs = contenu(c);
      const enBaie = new Set(eqs.filter((e) => EN_BAIE.has(e.genre)).map((e) => e.nom));
      const nbBaies = new Set(eqs.filter((e) => enBaie.has(e.nom)).map((e) => e.baie ?? "Baie")).size;
      const camEnBaie = (e: Equipement) => options.cameras === "baie" && inv.liaisons.some((l) => (l.a === e.nom && enBaie.has(l.b)) || (l.b === e.nom && enBaie.has(l.a)));
      const auSol = eqs.filter((e) => !enBaie.has(e.nom) && !(e.genre === "camera" && (options.cameras === "murs" || camEnBaie(e))));
      const cx = c.x + c.w / 2, demi = Math.max(5.5, (nbBaies * (BW + 1.2)) / 2 + 2.6);
      let x0 = cx - demi, x1 = cx + demi, z1 = c.y + 10;
      if (options.cameras === "murs") z1 += Math.min(8, eqs.filter((e) => e.genre === "camera").length * 0.25);
      auSol.forEach((e) => {
        const p = d.pos.get(e.nom);
        if (!p) return;
        x0 = Math.min(x0, p.x - 2.2); x1 = Math.max(x1, p.x + 2.2); z1 = Math.max(z1, Math.max(p.y, c.y + 7) + 2.8);
      });
      x0 = Math.max(x0, c.x); x1 = Math.min(x1, c.x + c.w); z1 = Math.min(z1, c.y + c.h);
      compactes.set(c, { ...c, x: x0, w: x1 - x0, h: z1 - c.y });
    });
    // Les salles d'un site côte à côte (à la ligne au-delà d'une certaine
    // largeur), puis les sites en grille : la 3D ne garde pas les grands vides
    // du plan 2D. `decalage` déplace aussi ce qui est posé au sol.
    const decalage = new Map<Cadre, { dx: number; dz: number }>();
    {
      const ECART = 4, ECART_SITES = 9, LARG_MAX = 70;
      const sitesC = cadres.filter((c) => c.type === "site");
      const blocs = sitesC.map((sc) => {
        const ss = salles.filter((x) => x.site === sc.site);
        let x = 0, y = 0, hRang = 0, w = 0;
        const places = ss.map((c) => {
          const r = compactes.get(c)!;
          if (x > 0 && x + r.w > LARG_MAX) { x = 0; y += hRang + ECART; hRang = 0; }
          const pl = { c, x, y };
          x += r.w + ECART; w = Math.max(w, x - ECART); hRang = Math.max(hRang, r.h);
          return pl;
        });
        return { sc, places, w: w + 3, h: y + hRang + 4.5 };
      });
      const cols = Math.max(1, Math.ceil(Math.sqrt(blocs.length)));
      const largCol: number[] = [], hautRang: number[] = [];
      blocs.forEach((b, i) => {
        largCol[i % cols] = Math.max(largCol[i % cols] ?? 0, b.w);
        hautRang[Math.floor(i / cols)] = Math.max(hautRang[Math.floor(i / cols)] ?? 0, b.h);
      });
      blocs.forEach((b, i) => {
        const ox = largCol.slice(0, i % cols).reduce((t, v) => t + v + ECART_SITES, 0);
        const oy = hautRang.slice(0, Math.floor(i / cols)).reduce((t, v) => t + v + ECART_SITES, 0);
        b.places.forEach(({ c, x, y }) => {
          const r = compactes.get(c)!;
          const dx = ox + 1.5 + x - r.x, dz = oy + 1.5 + y - r.y;
          const bouge = { ...r, x: r.x + dx, y: r.y + dz };
          compactes.set(c, bouge);
          decalage.set(bouge, { dx, dz });
        });
      });
    }
    const centreBaies = new Map(salles.map((c) => [compactes.get(c)!, c.x + c.w / 2 + decalage.get(compactes.get(c)!)!.dx]));
    /** Le rectangle d'un site en 3D : autour de ses salles. */
    const rectSite = (sc: Cadre) => {
      const ss = salles.filter((x) => x.site === sc.site).map((x) => compactes.get(x)!);
      if (!ss.length) return sc;
      const x0 = Math.min(...ss.map((x) => x.x)) - 1.5, y0 = Math.min(...ss.map((x) => x.y)) - 1.5;
      const x1 = Math.max(...ss.map((x) => x.x + x.w)) + 1.5, y1 = Math.max(...ss.map((x) => x.y + x.h)) + 2.5;
      return { ...sc, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    };

    // Le terrain d'un site à plusieurs lieux : une dalle plus sombre dessous,
    // juste autour de ses salles.
    cadres.filter((c) => c.type === "site" && avecPoints.has(c.site)).map(rectSite).forEach((c) => {
      const dalle = boite(c.w, 0.2, c.h, std(0x0a0d12, { roughness: 1, metalness: 0 }));
      dalle.position.set(c.x + c.w / 2, -0.32, c.y + c.h / 2);
      // Cliquable aussi : dézoomé, un clic entre deux lieux plonge dans le site entier.
      dalle.userData.salle = { x: c.x, y: c.y, w: c.w, h: c.h, site: true };
      sols.push(dalle);
      racine.add(dalle);
      // Nom du site devant, au bord : celui des lieux est au fond de chaque salle.
      const t = etiquette(c.nom, "etiquette3d site");
      t.position.set(c.x + 1.2, 0, c.y + c.h - 0.8);
      t.center.set(0, 0.5);
      racine.add(t);
    });

    // Très loin : un seul résumé par site (le détail par lieu reviendrait en zoomant).
    cadres.filter((c) => c.type === "site").map(rectSite).forEach((c) => {
      const eqs = inv.equipements.filter((e) => e.site === c.site && visibles.has(e.nom));
      const nCam = eqs.filter((e) => e.genre === "camera").length;
      const nBaies = new Set(eqs.filter((e) => EN_BAIE.has(e.genre)).map((e) => `${e.point ?? ""}§${e.baie ?? ""}`)).size;
      const t = etiquette(`${c.nom} · ${nCam} caméra${nCam > 1 ? "s" : ""} · ${nBaies} baie${nBaies > 1 ? "s" : ""}`, "etiquette3d resume-site");
      t.position.set(c.x + c.w / 2, 4, c.y + c.h / 2);
      racine.add(t);
    });

    salles.map((c) => compactes.get(c)!).forEach((c) => {
      const cle = `${c.site}§${c.type === "point" ? c.point : ""}`;
      // Le sol de la salle.
      // Le sol technique, en dalles (une dalle ≈ 1,2 unité).
      const tex = dalles.clone();
      tex.repeat.set(c.w / 1.2, c.h / 1.2);
      tex.needsUpdate = true;
      jetables.push(tex);
      // En rendu cinéma : sol sombre et brillant, qui reflète la lumière.
      const matSol = cinema
        ? new THREE.MeshStandardMaterial({ map: tex, color: 0x3a3f48, roughness: 0.32, metalness: 0.55 })
        : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.25 });
      jetables.push(matSol);
      const sol = new THREE.Mesh(geo(new THREE.BoxGeometry(c.w, 0.2, c.h)), matSol);
      sol.position.set(c.x + c.w / 2, -0.1, c.y + c.h / 2);
      sol.userData.salle = { x: c.x, y: c.y, w: c.w, h: c.h };
      sols.push(sol);
      racine.add(sol);
      const t = etiquette(c.type === "point" ? `⌖ ${c.nom}` : c.nom, c.type === "point" ? "etiquette3d site point" : "etiquette3d site");
      t.position.set(c.x + 1.2, 0.3, c.y + 0.9);
      t.center.set(0, 0.5);
      racine.add(t);

      const eqs = inv.equipements.filter((e) => e.site === c.site && (c.type === "site" || (e.point ?? "") === c.point));
      eqs.forEach((e) => salleDe.set(e.nom, cle));
      const groupes = new Map<string, Equipement[]>();
      eqs.filter((e) => EN_BAIE.has(e.genre)).forEach((e) => {
        const k = e.baie ?? "Baie";
        if (!groupes.has(k)) groupes.set(k, []);
        groupes.get(k)!.push(e);
      });
      const baieDe = new Map<string, string>();
      groupes.forEach((liste, k) => liste.forEach((e) => baieDe.set(e.nom, k)));

      // Les caméras rangées sous les switchs de leur baie, sur des plateaux.
      const camerasDe = new Map<string, Equipement[]>();
      if (options.cameras === "baie") {
        eqs.filter((e) => e.genre === "camera").forEach((e) => {
          const l = inv.liaisons.find((x) => (x.a === e.nom && baieDe.has(x.b)) || (x.b === e.nom && baieDe.has(x.a)));
          if (!l) return;
          const k = baieDe.get(l.a === e.nom ? l.b : l.a)!;
          if (!camerasDe.has(k)) camerasDe.set(k, []);
          camerasDe.get(k)!.push(e);
        });
      }

      // Les baies, alignées au fond de la salle.
      const nb = groupes.size;
      let k = 0;
      const baiesSalle: { x: number; z: number; H: number }[] = [];
      groupes.forEach((liste, nomBaie) => {
        const x = centreBaies.get(c)! + (k++ - (nb - 1) / 2) * (BW + 1.2);
        const z = c.y + 3.2;
        const cams = camerasDe.get(nomBaie) ?? [];
        const plateaux = Math.ceil(cams.length / CAM_PAR_PLATEAU);
        const nbU = Math.max(12, liste.reduce((t, e) => t + (HAUTEUR_U[e.genre] ?? 1), 0) + plateaux * U_PLATEAU + 3);
        const { g, H } = baie(nbU);
        g.position.set(x, 0, z);
        racine.add(g);
        baiesSalle.push({ x, z, H });
        const lb = etiquette(`▤ ${nomBaie}`, "etiquette3d baie");
        lb.position.set(x, H + 0.35, z);
        racine.add(lb);
        const avant = z + RD / 2 + 0.03;
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
          prises.set(e.nom, {
            enBaie: true, baie: `${cle}§${nomBaie}`, rack: { x, z, H },
            hautBaie: new THREE.Vector3(x, H + 0.1, z),
            port: (id) => {
              const p = f && id ? f.parId.get(id) : undefined;
              if (!p || !f) return new THREE.Vector3(x + RL / 2 - 0.2, cy, avant);
              return new THREE.Vector3(x - RL / 2 + (p.x / f.w) * RL, cy + h / 2 - (p.y / FH) * h, avant);
            },
          });
        });
        // Plateaux à caméras, en bas de la baie : autant qu'il en faut.
        for (let i = 0; i < plateaux; i++) {
          const base = 0.36 + i * U_PLATEAU * U;
          const gp = new THREE.Group();
          gp.position.set(x, base, z);
          gp.add(P(boite(RL, 0.04, RD - 0.2, std(0x2b323c, { metalness: 0.6 })), 0, 0, 0));
          gp.add(P(boite(RL, 0.12, 0.03, std(0x3a4350, { metalness: 0.6 })), 0, 0.04, RD / 2 - 0.1));
          racine.add(gp);
          const lot = cams.slice(i * CAM_PAR_PLATEAU, (i + 1) * CAM_PAR_PLATEAU);
          if (i === 0) {
            const et = etiquette(`◉ ${cams.length} caméra${cams.length > 1 ? "s" : ""}`, "etiquette3d plateau");
            et.position.set(x - RL / 2 - 0.2, base + 0.25, avant + 0.1);
            et.center.set(1, 0.5);
            racine.add(et);
          }
          lot.forEach((e, j) => {
            const mc = miniCamera(e);
            const cx = x - RL / 2 + 0.22 + (j * (RL - 0.44)) / (CAM_PAR_PLATEAU - 1);
            mc.position.set(cx, base + 0.02, z + 0.25);
            mc.userData.nom = e.nom;
            racine.add(mc);
            if (!visibles.has(e.nom)) return;
            cliquables.push(mc);
            objets.set(e.nom, mc);
            const lbc = etiquette(e.nom, "etiquette3d petite");
            lbc.position.set(0, 0.42, 0.2);
            mc.add(lbc);
            const prise = new THREE.Vector3(cx, base + 0.08, z + 0.6);
            prises.set(e.nom, { enBaie: true, plateau: true, baie: `${cle}§${nomBaie}`, port: () => prise.clone() });
          });
        }
      });

      // Murs (fond et côtés ; l'avant reste ouvert pour regarder dedans) et
      // chemin de câbles en hauteur, au-dessus des baies.
      const hBaies = Math.max(4.2, ...baiesSalle.map((b) => b.H));
      const yChemin = hBaies + 0.55, hMur = yChemin + 0.9;
      const mur = std(cinema ? 0x0c0d10 : 0x232b36, { roughness: 0.95, metalness: 0 });
      const plinthe = std(0x2f3a48, { roughness: 0.6 });
      ([[c.x + c.w / 2, c.y + 0.075, c.w, 0.15], [c.x + 0.075, c.y + c.h / 2, 0.15, c.h], [c.x + c.w - 0.075, c.y + c.h / 2, 0.15, c.h]] as const)
        .forEach(([x, z, w, dz]) => {
          racine.add(P(boite(w, hMur, dz, mur), x, hMur / 2, z));
          racine.add(P(boite(w + (dz > w ? 0.05 : 0), 0.12, dz + (w > dz ? 0.05 : 0), plinthe), x, 0.06, z));
        });
      const ch = { y: yChemin, xL: c.x + 0.7, xR: c.x + c.w - 0.7, zB: c.y + 0.7, zF: c.y + c.h - 1.2 };
      chemins.set(cle, ch);
      const tole = std(0x7b8794, { metalness: 0.75, roughness: 0.35 });
      const troncon = (x1: number, z1: number, x2: number, z2: number) => {
        const lx = Math.abs(x2 - x1) + 0.5, lz = Math.abs(z2 - z1) + 0.5, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
        const enX = lx > lz;
        racine.add(P(boite(enX ? lx : 0.5, 0.03, enX ? 0.5 : lz, tole), cx, ch.y - 0.08, cz));
        [-1, 1].forEach((s) => racine.add(P(boite(enX ? lx : 0.03, 0.14, enX ? 0.03 : lz, tole),
          cx + (enX ? 0 : s * 0.25), ch.y - 0.01, cz + (enX ? s * 0.25 : 0))));
      };
      troncon(ch.xL, ch.zF, ch.xL, ch.zB);
      troncon(ch.xL, ch.zB, ch.xR, ch.zB);
      troncon(ch.xR, ch.zB, ch.xR, ch.zF);
      baiesSalle.forEach((b) => troncon(b.x + RL / 2 + 0.25, ch.zB, b.x + RL / 2 + 0.25, b.z));   // dérivation vers chaque baie

      // Caméras murales : réparties le long des murs (côtés, et fond hors des baies).
      if (options.cameras === "murs") {
        const cams = eqs.filter((e) => e.genre === "camera" && visibles.has(e.nom) && !prises.has(e.nom));
        const xMin = Math.min(...baiesSalle.map((b) => b.x - BW / 2), c.x + c.w / 2) - 1.2;
        const xMax = Math.max(...baiesSalle.map((b) => b.x + BW / 2), c.x + c.w / 2) + 1.2;
        type Seg = { a: [number, number]; b: [number, number] };
        const segs = ([
          { a: [c.x + 0.16, c.y + c.h - 1.5], b: [c.x + 0.16, c.y + 1.4] },
          { a: [c.x + 1.4, c.y + 0.16], b: [xMin, c.y + 0.16] },
          { a: [xMax, c.y + 0.16], b: [c.x + c.w - 1.4, c.y + 0.16] },
          { a: [c.x + c.w - 0.16, c.y + 1.4], b: [c.x + c.w - 0.16, c.y + c.h - 1.5] },
        ] as Seg[]).filter((sg) => Math.hypot(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]) > 0.8);
        const longueurs = segs.map((sg) => Math.hypot(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]));
        const total = longueurs.reduce((t, v) => t + v, 0);
        const centre = new THREE.Vector3(c.x + c.w / 2, 0.4, c.y + c.h * 0.55);
        cams.forEach((e, i) => {
          let dist = ((i + 0.5) / cams.length) * total, sIdx = 0;
          while (sIdx < segs.length - 1 && dist > longueurs[sIdx]) { dist -= longueurs[sIdx]; sIdx++; }
          const sg = segs[sIdx], t = longueurs[sIdx] ? dist / longueurs[sIdx] : 0;
          const px = sg.a[0] + (sg.b[0] - sg.a[0]) * t, pz = sg.a[1] + (sg.b[1] - sg.a[1]) * t;
          const g = cameraMurale(e);
          g.position.set(px, Math.min(hMur - 0.5, 2.9), pz);
          g.lookAt(centre);
          g.userData.nom = e.nom;
          racine.add(g);
          cliquables.push(g);
          objets.set(e.nom, g);
          const lb = etiquette(e.nom, "etiquette3d petite");
          lb.position.set(0, 0.45, 0);
          g.add(lb);
          const prise = g.position.clone();
          prises.set(e.nom, { enBaie: false, mur: true, port: () => prise.clone() });
        });
      }

      // Le reste, posé dans la salle à la même place que sur le plan 2D.
      eqs.filter((e) => !EN_BAIE.has(e.genre) && !prises.has(e.nom)).forEach((e) => {
        if (!visibles.has(e.nom)) return;
        const p0 = d.pos.get(e.nom)!, dep = decalage.get(c) ?? { dx: 0, dz: 0 };
        const p = { x: p0.x + dep.dx, y: p0.y + dep.dz };
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

    // Les pastilles de la vue d'ensemble : les caméras de chaque salle en
    // grille au-dessus du sol, et leur nombre.
    const matPastille = new THREE.SpriteMaterial({ map: texture(PASTILLE), sizeAttenuation: false, transparent: true, depthTest: false });
    jetables.push(matPastille);
    salles.map((c) => compactes.get(c)!).forEach((c) => {
      const cams = inv.equipements.filter((e) => e.genre === "camera" && visibles.has(e.nom) &&
        e.site === c.site && (c.type === "site" || (e.point ?? "") === c.point));
      if (!cams.length) return;
      const cols = Math.min(8, Math.max(1, Math.ceil(Math.sqrt(cams.length * 1.6))));
      const x0 = c.x + c.w / 2, z0 = c.y + c.h * 0.6, pas = 3.2;
      cams.forEach((e, i) => {
        const sp = new THREE.Sprite(matPastille);
        sp.position.set(x0 + ((i % cols) - (cols - 1) / 2) * pas, 2.6, z0 + Math.floor(i / cols) * pas);
        sp.scale.set(0.02, 0.02, 1);
        sp.renderOrder = 10;
        sp.userData.nom = e.nom;
        apercu.add(sp);
        pastilles.push(sp);
      });
      const t = etiquette(`◉ ${cams.length} caméra${cams.length > 1 ? "s" : ""} · ${c.nom}`, "etiquette3d resume");
      t.position.set(x0, 2.6, z0 - pas * 0.9);
      apercu.add(t);
    });

    // Le numéro du port, collé devant le port, à la couleur du câble (visible en zoomant).
    const portEtiq = (port: string | undefined, p: THREE.Vector3, couleur: string, dy = 0) => {
      if (!port) return;
      const e = etiquette(port, "etiquette3d port");
      (e.element as HTMLElement).style.borderColor = couleur;
      e.position.set(p.x, p.y + 0.09 + dy, p.z + 0.16);
      racine.add(e);
    };
    // Les câbles, à la couleur de leur support.
    inv.liaisons.forEach((l) => {
      if (!visibles.has(l.a) || !visibles.has(l.b)) return;
      const A = prises.get(l.a), B = prises.get(l.b);
      if (!A || !B) return;
      const ea = parNom.get(l.a)!, eb = parNom.get(l.b)!;
      const trunk = l.mode === "trunk";
      const couleur = COULEUR_MEDIA[l.media ?? "inconnu"];
      if (salleDe.get(l.a) !== salleDe.get(l.b)) {
        // Entre deux lieux d'un site : arc bas. Entre deux sites : arc haut.
        const a = A.hautBaie ?? A.port(l.portA), b = B.hautBaie ?? B.port(l.portB);
        portEtiq(l.portA, A.port(l.portA), couleur);
        portEtiq(l.portB, B.port(l.portB), couleur);
        const dist = a.distanceTo(b);
        const m = a.clone().lerp(b, 0.5); m.y = Math.max(a.y, b.y) + dist * (ea.site === eb.site ? 0.14 : 0.28);
        racine.add(cable([a, a.clone().lerp(m, 0.5).setY(m.y * 0.85), m, b.clone().lerp(m, 0.5).setY(m.y * 0.85), b], couleur,
          l.media === "vpn" ? 0.06 : 0.09, l.media === "vpn" ? 0.6 : 0.95));
        const t = [l.libelle, l.media ? MEDIAS_COURTS[l.media] : ""].filter(Boolean).join(" · ");
        if (t) { const e = etiquette(t, "etiquette3d lien"); e.position.copy(m).add(new THREE.Vector3(0, 0.6, 0)); racine.add(e); }
        return;
      }
      const pa = A.port(l.portA), pb = B.port(l.portB);
      const r = trunk ? 0.03 : 0.014;
      // Ports pairs (rangée du bas) : étiquette sous le port, pour ne pas recouvrir celle du dessus.
      const dessous = (port?: string) => (port && /^\d+$/.test(port) && Number(port) % 2 === 0 ? -0.2 : 0);
      portEtiq(l.portA, pa, couleur, dessous(l.portA));
      portEtiq(l.portB, pb, couleur, dessous(l.portB));
      if (A.enBaie && B.enBaie && A.baie === B.baie) {
        // Dans la même baie : cordon de brassage devant la façade, ou jusqu'au plateau des caméras.
        const [h, bas] = pa.y > pb.y ? [pa, pb] : [pb, pa];
        const avance = 0.3 + Math.min(0.6, Math.abs(pa.y - pb.y) * 0.12);
        racine.add(cable([h, h.clone().setZ(h.z + 0.12), new THREE.Vector3(h.x + 0.05, (h.y + bas.y) / 2, h.z + avance),
          new THREE.Vector3(bas.x, bas.y + 0.15, bas.z + 0.15), bas], couleur, r));
        return;
      }
      // Caméra murale ↔ équipement en baie : par le chemin de câbles.
      const murale = A.mur ? A : B.mur ? B : null, enRack = A.rack ? A : B.rack ? B : null;
      const ch = chemins.get(salleDe.get(l.a)!);
      if (murale && enRack && ch) {
        const pRack = murale === A ? pb : pa, pCam = murale === A ? pa : pb, rk = enRack.rack!;
        // Chaque câble décalé dans le chemin : on voit une nappe, pas un seul fil.
        const o = (([...l.a, ...l.b].reduce((t, c2) => t + c2.charCodeAt(0), 0) % 9) - 4) * 0.045;
        const y = ch.y + 0.02 + Math.abs(o) * 0.4;
        const xg = rk.x + RL / 2 + 0.25 + o;
        // Point du U le plus proche de la caméra, et parcours le long du U.
        const u = [[ch.xL, ch.zF], [ch.xL, ch.zB], [ch.xR, ch.zB], [ch.xR, ch.zF]] as const;
        const abs = (px: number, pz: number) => {
          // Abscisse curviligne du point projeté sur le U.
          let best = { d: Infinity, s: 0, x: 0, z: 0 }, s0 = 0;
          for (let i = 0; i < 3; i++) {
            const [ax, az] = u[i], [bx, bz] = u[i + 1];
            const L = Math.hypot(bx - ax, bz - az) || 1;
            const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (pz - az) * (bz - az)) / (L * L)));
            const qx = ax + (bx - ax) * t, qz = az + (bz - az) * t, dd = Math.hypot(px - qx, pz - qz);
            if (dd < best.d) best = { d: dd, s: s0 + t * L, x: qx, z: qz };
            s0 += L;
          }
          return best;
        };
        const coins = [0, Math.hypot(u[1][0] - u[0][0], u[1][1] - u[0][1])];
        coins.push(coins[1] + Math.hypot(u[2][0] - u[1][0], u[2][1] - u[1][1]));
        const debut = abs(xg, ch.zB), fin = abs(pCam.x, pCam.z);
        const parcours: THREE.Vector3[] = [];
        const sens = fin.s >= debut.s ? 1 : -1;
        [1, 2].map((i) => ({ s: coins[i], x: u[i][0], z: u[i][1] }))
          .filter((k2) => (k2.s - debut.s) * sens > 0.01 && (fin.s - k2.s) * sens > 0.01)
          .sort((p1, p2) => (p1.s - p2.s) * sens)
          .forEach((k2) => parcours.push(new THREE.Vector3(k2.x + o, y, k2.z + o)));
        const pts = [
          pRack, pRack.clone().setZ(pRack.z + 0.15), new THREE.Vector3(xg, pRack.y, pRack.z + 0.22),
          new THREE.Vector3(xg, rk.H + 0.15, pRack.z + 0.22), new THREE.Vector3(xg, y, rk.z),
          new THREE.Vector3(xg, y, ch.zB + o), ...parcours,
          new THREE.Vector3(fin.x + o, y, fin.z + o), new THREE.Vector3(pCam.x, y - 0.1, pCam.z),
          new THREE.Vector3(pCam.x, pCam.y + 0.25, pCam.z), pCam,
        ];
        racine.add(cable(arrondir(murale === A ? pts.reverse() : pts), couleur, r));
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

    seuilTresLoin = Math.max(distancePour(PX_LOIN * 0.55), ...cadres.filter((c) => c.type === "site").map((c) => distanceCadrage(rectSite(c)) * 1.2));

    // Les textures qui ne servent plus sont libérées.
    cacheTex.forEach((v, k) => { if (v.vu !== generation) { v.tex.dispose(); cacheTex.delete(k); } });

    emprise = new THREE.Box3().setFromObject(racine);
    if (emprise.isEmpty()) emprise = new THREE.Box3(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 1, 5));
    // Le brouillard de profondeur suit la taille de la carte : réglé pour un
    // petit réseau, il effaçait sols et caméras d'un grand réseau dézoomé.
    const diag = Math.max(40, emprise.getSize(new THREE.Vector3()).length());
    // Apparence « Noir studio » : fond et brouillard noirs.
    const fond = document.body.classList.contains("theme-studio") ? 0x000000 : 0x07090d;
    (scene.background as THREE.Color).setHex(fond);
    (scene.fog as THREE.Fog).color.setHex(fond);
    (scene.fog as THREE.Fog).near = diag * 1.6;
    (scene.fog as THREE.Fog).far = diag * 4;
    cam.far = Math.max(3000, diag * 6);
    cam.updateProjectionMatrix();
  }

  function cadrer() {
    const c = emprise.getCenter(new THREE.Vector3());
    const s = emprise.getSize(new THREE.Vector3());
    const demiFov = THREE.MathUtils.degToRad(cam.fov / 2);
    const besoin = Math.max(s.x / Math.max(cam.aspect, 0.3), s.z * 1.25, 10) / 2;
    const dist = (besoin / Math.tan(demiFov)) * 1.05;
    const cible = c.clone().setY(0);
    voler(cible, cible.clone().add(new THREE.Vector3(0.05, 0.62, 0.78).normalize().multiplyScalar(dist)), premier);
    premier = false;
  }

  /* ---------- déplacements doux de la caméra ---------- */
  let premier = true;
  let vol: { t0: number; c0: THREE.Vector3; c1: THREE.Vector3; p0: THREE.Vector3; p1: THREE.Vector3 } | null = null;
  function voler(cible: THREE.Vector3, position: THREE.Vector3, immediat = false) {
    if (immediat) { ctrl.target.copy(cible); cam.position.copy(position); ctrl.update(); vol = null; return; }
    vol = { t0: performance.now(), c0: ctrl.target.clone(), c1: cible.clone(), p0: cam.position.clone(), p1: position.clone() };
  }
  /** Plonger dans une salle : on la cadre d'assez près pour voir le détail. */
  /**
   * Plonger dans un site ou dans un lieu. Un site à plusieurs lieux est cadré
   * en entier, en restant au niveau « pastilles » : on y choisit son lieu.
   * Un lieu (ou un site d'un seul tenant) est cadré de près : la 3D détaillée.
   */
  /** Distance où un cadre tient juste à l'écran. */
  const distanceCadrage = (s: { w: number; h: number }) =>
    (Math.max(s.w / Math.max(cam.aspect, 0.5), s.h * 1.15) / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) * 1.08;
  function entrerDans(s: { x: number; y: number; w: number; h: number; site?: boolean }) {
    const c = new THREE.Vector3(s.x + s.w / 2, 0, s.y + s.h * 0.45);
    const juste = distanceCadrage(s);
    const d = s.site ? Math.max(distancePour(PX_LOIN * 0.9), juste) : Math.min(distancePour(PX_LOIN * 1.15), Math.max(12, juste));
    voler(c, c.clone().add(new THREE.Vector3(0.04, 0.62, 0.78).normalize().multiplyScalar(d)));
  }
  function versObjet(nom: string) {
    const o = objets.get(nom);
    if (!o) return;
    const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    // De face et un peu au-dessus : on lit la façade et ses ports.
    voler(c, c.clone().add(new THREE.Vector3(1.2, 1.6, 5.5)));
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
    if (apercu.visible) {
      // Dézoomé : une pastille ouvre la caméra et plonge jusqu'à elle ;
      // un clic sur le sol d'un site plonge dans ce site.
      const p = ray.intersectObjects(pastilles, false)[0];
      if (p) { const nom = p.object.userData.nom as string; cb.choisir(nom); versObjet(nom); return; }
      const sol = ray.intersectObjects(sols, false)[0];
      if (sol) { entrerDans(sol.object.userData.salle); return; }
    }
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

  let derniereFrappe = 0;
  document.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) derniereFrappe = performance.now();
  }, true);

  rnd.setAnimationLoop(() => {
    if (!hote.offsetParent) return; // onglet caché : on ne dessine rien
    // Pendant la frappe, la 3D se met en pause (la dernière image reste) :
    // sur un PC modeste, dessiner une grande scène ralentirait la saisie.
    if (performance.now() - derniereFrappe < 700 && !vol) return;
    if (vol) {
      const t = Math.min(1, (performance.now() - vol.t0) / 750);
      const k = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      ctrl.target.lerpVectors(vol.c0, vol.c1, k);
      cam.position.lerpVectors(vol.p0, vol.p1, k);
      if (t >= 1) vol = null;
    }
    ctrl.update();
    // Vue d'ensemble : pastilles des caméras et noms de sites ; en zoomant,
    // la 3D détaillée et les noms d'équipements prennent le relais.
    const tps = performance.now() / 1000;
    voyants.forEach((m, i) => { m.emissiveIntensity = Math.sin(tps * (2.1 + i * 1.7) + i * 2) > -0.2 ? 1.4 : 0.15; });
    const dist = cam.position.distanceTo(ctrl.target);
    const loin = pxParUnite(dist) < PX_LOIN;
    apercu.visible = loin;
    etiq.domElement.classList.toggle("loin", loin);
    // Très loin (plusieurs sites à l'écran) : un résumé par site, rien d'autre.
    etiq.domElement.classList.toggle("tres-loin", dist > seuilTresLoin);
    // Tout près d'une baie : les numéros de port sur les câbles.
    etiq.domElement.classList.toggle("proche", pxParUnite(dist) > PX_LOIN * 9);
    rnd.render(scene, cam);
    etiq.render(scene, cam);
  });

  async function exporterGLB(): Promise<Blob> {
    // La surbrillance de sélection n'a rien à faire dans le fichier.
    const sb = surbrillance;
    if (sb) racine.remove(sb);
    const vu = apercu.visible;
    apercu.visible = false; // les pastilles n'ont de sens qu'à l'écran
    racine.name = "Topologie réseau v1";
    racine.traverse((o) => { if (o.userData.nom && !o.name) o.name = String(o.userData.nom); });
    try {
      const res = await new GLTFExporter().parseAsync(racine, { binary: true, onlyVisible: true });
      return new Blob([res as ArrayBuffer], { type: "model/gltf-binary" });
    } finally {
      if (sb) racine.add(sb);
      apercu.visible = vu;
    }
  }

  return {
    afficher,
    cadrer,
    exporterGLB,
    selectionner(nom, centrer = false) {
      if (surbrillance) { racine.remove(surbrillance); surbrillance.dispose(); surbrillance = null; }
      if (!nom) return;
      const o = objets.get(nom);
      if (!o) return;
      const bb = new THREE.Box3().setFromObject(o).expandByScalar(0.08);
      surbrillance = new THREE.Box3Helper(bb, new THREE.Color(0x8d7cff));
      racine.add(surbrillance);
      if (centrer) versObjet(nom);
    },
  };
}
