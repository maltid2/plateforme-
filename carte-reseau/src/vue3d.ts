/**
 * La vue 3D : chaque site est un plateau, chaque équipement un volume à la
 * couleur de son type, chaque liaison un câble. Les liaisons entre sites
 * passent en arc au-dessus des plateaux. Mêmes positions que le plan 2D.
 *
 * Chargée à la demande : three.js n'est téléchargé qu'à l'ouverture de
 * l'onglet 3D.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { APPARENCE, COULEUR_INTERSITE, COULEUR_LIEN } from "./apparence";
import type { Disposition } from "./disposition";
import type { Genre, Inventaire } from "./saisie";

type Rappels = { choisir: (nom: string | null) => void };
export type Vue3D = {
  afficher: (inv: Inventaire, d: Disposition, site: string | null) => void;
  selectionner: (nom: string | null, centrer?: boolean) => void;
  cadrer: () => void;
};

export function creerVue3D(hote: HTMLElement, cb: Rappels): Vue3D {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090d);
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);
  const rnd = new THREE.WebGLRenderer({ antialias: true });
  rnd.setPixelRatio(Math.min(devicePixelRatio, 2));
  hote.appendChild(rnd.domElement);
  const etiq = new CSS2DRenderer();
  etiq.domElement.style.position = "absolute";
  etiq.domElement.style.inset = "0";
  etiq.domElement.style.pointerEvents = "none";
  hote.appendChild(etiq.domElement);

  const ctrl = new OrbitControls(cam, rnd.domElement);
  ctrl.enableDamping = true;
  ctrl.maxPolarAngle = Math.PI * 0.48;

  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const soleil = new THREE.DirectionalLight(0xffffff, 1.6);
  soleil.position.set(30, 60, 40);
  scene.add(soleil);

  let racine = new THREE.Group();
  scene.add(racine);
  let jetables: { dispose(): void }[] = [];
  let cliquables: THREE.Object3D[] = [];
  const halos = new Map<string, THREE.Mesh>();
  const centres = new Map<string, THREE.Vector3>();
  let emprise = new THREE.Box3(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 1, 5));

  const mat = (c: string | number, e = 0) => {
    const m = new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: e });
    jetables.push(m);
    return m;
  };
  const geo = <T extends THREE.BufferGeometry>(g: T) => { jetables.push(g); return g; };
  const boite = (w: number, h: number, d: number, c: string | number, e = 0) => new THREE.Mesh(geo(new THREE.BoxGeometry(w, h, d)), mat(c, e));
  const cyl = (r: number, h: number, c: string | number, e = 0) => new THREE.Mesh(geo(new THREE.CylinderGeometry(r, r, h, 20)), mat(c, e));

  /** Un volume reconnaissable par type, posé au sol, base à y = 0. */
  function volume(genre: Genre): { g: THREE.Group; haut: number } {
    const c = APPARENCE[genre].couleur;
    const g = new THREE.Group();
    const add = (m: THREE.Object3D, x: number, y: number, z: number) => { m.position.set(x, y, z); g.add(m); return m; };
    let haut = 0.6;
    switch (genre) {
      case "passerelle": case "parefeu":
        add(boite(2.0, 0.45, 1.3, 0x1b2430), 0, 0.225, 0);
        add(boite(2.02, 0.12, 1.32, c, 0.35), 0, 0.5, 0);
        add(cyl(0.05, 0.7, 0x9aa8b8), -0.7, 0.8, -0.5); add(cyl(0.05, 0.7, 0x9aa8b8), 0.7, 0.8, -0.5);
        haut = 1.2; break;
      case "switch":
        add(boite(2.4, 0.32, 1.2, 0x1b2430), 0, 0.16, 0);
        for (let i = 0; i < 8; i++) add(boite(0.18, 0.1, 0.04, c, 0.9), -0.95 + i * 0.27, 0.18, 0.61);
        add(boite(2.42, 0.06, 1.22, c, 0.3), 0, 0.33, 0);
        haut = 0.4; break;
      case "camera": {
        add(cyl(0.08, 1.0, 0x6b7a8c), 0, 0.5, 0);
        const corps = add(boite(0.45, 0.4, 1.0, 0xd5dce4), 0, 1.15, 0.2);
        corps.rotation.x = 0.25;
        add(cyl(0.16, 0.08, c, 0.8), 0, 1.06, 0.72).rotation.x = Math.PI / 2 + 0.25;
        haut = 1.4; break;
      }
      case "nvr":
        add(boite(1.8, 0.5, 1.4, 0x1b2430), 0, 0.25, 0);
        add(boite(0.6, 0.1, 0.04, c, 0.9), -0.4, 0.3, 0.71);
        haut = 0.55; break;
      case "borne":
        add(cyl(0.12, 1.4, 0x6b7a8c), 0, 0.7, 0);
        add(cyl(0.6, 0.14, 0xe6ebf0), 0, 1.45, 0);
        add(cyl(0.12, 0.05, c, 1.0), 0, 1.53, 0);
        haut = 1.6; break;
      case "serveur": case "nas":
        add(boite(1.0, 1.8, 1.3, 0x1b2430), 0, 0.9, 0);
        for (let i = 0; i < 4; i++) add(boite(0.75, 0.06, 0.04, c, 0.8), 0, 0.4 + i * 0.38, 0.66);
        haut = 1.8; break;
      case "poste":
        add(boite(1.4, 0.85, 0.08, 0x0e1419, 0), 0, 1.0, 0);
        add(boite(1.3, 0.75, 0.02, c, 0.25), 0, 1.0, 0.05);
        add(boite(0.12, 0.5, 0.12, 0x6b7a8c), 0, 0.4, -0.05);
        add(boite(0.6, 0.06, 0.4, 0x6b7a8c), 0, 0.12, 0);
        haut = 1.45; break;
      case "imprimante":
        add(boite(1.3, 0.8, 1.1, 0xd5dce4), 0, 0.4, 0);
        add(boite(0.9, 0.05, 0.5, c, 0.4), 0, 0.82, 0.1);
        haut = 0.85; break;
      case "telephone":
        add(boite(0.7, 0.15, 0.6, 0x1b2430), 0, 0.08, 0);
        add(boite(0.4, 0.04, 0.25, c, 0.6), 0, 0.17, -0.05);
        haut = 0.4; break;
      case "onduleur":
        add(boite(0.8, 1.1, 1.2, 0x1b2430), 0, 0.55, 0);
        add(boite(0.4, 0.15, 0.04, c, 0.9), 0, 0.85, 0.61);
        haut = 1.1; break;
      default:
        add(boite(0.9, 0.9, 0.9, 0x1b2430), 0, 0.45, 0);
        add(boite(0.92, 0.12, 0.92, c, 0.5), 0, 0.92, 0);
        haut = 1.0;
    }
    return { g, haut };
  }

  function cable(points: THREE.Vector3[], couleur: string, rayon = 0.06, opacite = 0.8) {
    const c = new THREE.CatmullRomCurve3(points);
    const m = new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: opacite });
    jetables.push(m);
    return new THREE.Mesh(geo(new THREE.TubeGeometry(c, Math.max(24, points.length * 12), rayon, 6, false)), m);
  }

  function etiquette(texte: string, classe = "etiquette3d") {
    const div = document.createElement("div");
    div.className = classe;
    div.textContent = texte;
    return new CSS2DObject(div);
  }

  function afficher(inv: Inventaire, d: Disposition, site: string | null) {
    // Les étiquettes CSS2D vivent dans le DOM : il faut les retirer à la main.
    racine.traverse((o) => { if (o instanceof CSS2DObject) o.element.remove(); });
    scene.remove(racine);
    jetables.forEach((j) => j.dispose());
    jetables = [];
    cliquables = [];
    halos.clear();
    centres.clear();
    racine = new THREE.Group();
    scene.add(racine);

    const visibles = new Set(inv.equipements.filter((e) => !site || e.site === site).map((e) => e.nom));
    const siteDe = new Map(inv.equipements.map((e) => [e.nom, e.site]));
    const cadres = d.cadres.filter((c) => !site || c.nom === site);

    cadres.forEach((c) => {
      const dalle = boite(c.w, 0.3, c.h, 0x121821);
      dalle.position.set(c.x + c.w / 2, -0.15, c.y + c.h / 2);
      racine.add(dalle);
      const bord = new THREE.LineSegments(geo(new THREE.EdgesGeometry(dalle.geometry)),
        (() => { const m = new THREE.LineBasicMaterial({ color: 0x2a3340 }); jetables.push(m); return m; })());
      bord.position.copy(dalle.position);
      racine.add(bord);
      const t = etiquette(c.nom, "etiquette3d site");
      t.position.set(c.x + 1.2, 0.1, c.y + 0.6);
      t.center.set(0, 0.5);
      racine.add(t);
    });

    const hauts = new Map<string, number>();
    inv.equipements.forEach((e) => {
      if (!visibles.has(e.nom)) return;
      const p = d.pos.get(e.nom)!;
      const { g, haut } = volume(e.genre);
      g.position.set(p.x, 0, p.y);
      g.userData.nom = e.nom;
      hauts.set(e.nom, haut);
      centres.set(e.nom, new THREE.Vector3(p.x, haut / 2, p.y));
      // Socle cliquable plus large que l'objet : viser une caméra fine au
      // pointeur serait pénible.
      const socle = new THREE.Mesh(geo(new THREE.CylinderGeometry(1.25, 1.25, 0.06, 28)),
        (() => { const m = new THREE.MeshBasicMaterial({ color: APPARENCE[e.genre].couleur, transparent: true, opacity: 0.12 }); jetables.push(m); return m; })());
      socle.position.y = 0.03;
      g.add(socle);
      const halo = new THREE.Mesh(geo(new THREE.RingGeometry(1.35, 1.55, 40)),
        (() => { const m = new THREE.MeshBasicMaterial({ color: 0x8d7cff, side: THREE.DoubleSide }); jetables.push(m); return m; })());
      halo.rotation.x = -Math.PI / 2; halo.position.y = 0.05; halo.visible = false;
      g.add(halo);
      halos.set(e.nom, halo);
      const t = etiquette(e.nom);
      t.position.set(0, haut + 0.45, 0);
      g.add(t);
      racine.add(g);
      cliquables.push(g);
    });

    inv.liaisons.forEach((l) => {
      if (!visibles.has(l.a) || !visibles.has(l.b)) return;
      const a = d.pos.get(l.a)!, b = d.pos.get(l.b)!;
      if (siteDe.get(l.a) !== siteDe.get(l.b)) {
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const hA = hauts.get(l.a) ?? 1, hB = hauts.get(l.b) ?? 1;
        racine.add(cable([
          new THREE.Vector3(a.x, hA, a.y),
          new THREE.Vector3(a.x + (b.x - a.x) * 0.25, hA + dist * 0.22, a.y + (b.y - a.y) * 0.25),
          new THREE.Vector3((a.x + b.x) / 2, Math.max(hA, hB) + dist * 0.3, (a.y + b.y) / 2),
          new THREE.Vector3(a.x + (b.x - a.x) * 0.75, hB + dist * 0.22, a.y + (b.y - a.y) * 0.75),
          new THREE.Vector3(b.x, hB, b.y),
        ], COULEUR_INTERSITE, 0.1, 0.9));
        if (l.libelle) {
          const t = etiquette(l.libelle);
          t.position.set((a.x + b.x) / 2, Math.max(hA, hB) + dist * 0.3 + 0.6, (a.y + b.y) / 2);
          racine.add(t);
        }
        return;
      }
      // Au sol : on part du pied d'un équipement, on suit le sol, on arrive au pied de l'autre.
      const m = (a.y + b.y) / 2;
      racine.add(cable([
        new THREE.Vector3(a.x, 0.12, a.y + 0.7),
        new THREE.Vector3(a.x, 0.12, m),
        new THREE.Vector3(b.x, 0.12, m),
        new THREE.Vector3(b.x, 0.12, b.y - 0.7),
      ], COULEUR_LIEN, 0.06, 0.85));
    });

    emprise = new THREE.Box3().setFromObject(racine);
    if (emprise.isEmpty()) emprise = new THREE.Box3(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 1, 5));
  }

  function cadrer() {
    const c = emprise.getCenter(new THREE.Vector3());
    const s = emprise.getSize(new THREE.Vector3());
    // Distance tirée du champ de vision : tout le site doit tenir, même
    // quand plusieurs sites s'alignent sur une grande largeur.
    const demiFov = THREE.MathUtils.degToRad(cam.fov / 2);
    const besoin = Math.max(s.x / Math.max(cam.aspect, 0.3), s.z * 1.3, 10) / 2;
    const dist = (besoin / Math.tan(demiFov)) * 1.08;
    ctrl.target.copy(c);
    cam.position.copy(c).add(new THREE.Vector3(0.12, 0.72, 0.68).normalize().multiplyScalar(dist));
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
    rnd.render(scene, cam);
    etiq.render(scene, cam);
  });

  return {
    afficher,
    cadrer,
    selectionner(nom, centrer = false) {
      halos.forEach((h) => { h.visible = false; });
      if (!nom) return;
      const h = halos.get(nom);
      if (h) h.visible = true;
      const c = centres.get(nom);
      if (c && centrer) {
        const decal = cam.position.clone().sub(ctrl.target).setLength(18);
        ctrl.target.copy(c);
        cam.position.copy(c).add(decal);
      }
    },
  };
}
