/**
 * Le jumeau 3D : la scène et rien d'autre.
 *
 * Ce module ne touche pas à l'interface. Il dessine l'étage dans un canvas et
 * signale ce qui se passe par des rappels ; le fil d'Ariane, le sélecteur
 * d'étages et la fiche sont du React, dans Jumeau.tsx. La frontière est là
 * parce que three.js et React se disputent le DOM dès qu'on les mélange.
 *
 * Toute la géométrie est procédurale — des boîtes, des cylindres, des
 * sphères. Aucun fichier de modèle, donc aucune licence d'actif à suivre et
 * rien à télécharger au chargement de la page.
 */
import * as THREE from "three";
import { SITE, type Equipement, type Poste, type Severite } from "./donnees";

export type Fiche = {
  kind: string; name: string; pos: string;
  kv: [string, string][];
  vulns: { id: string; sev: Severite; score: string; txt: string }[];
};
export type Survol = { nom: string; x: number; y: number } | null;
export type Rappels = {
  surBaie: (nom: string | null) => void;
  surFiche: (f: Fiche | null) => void;
  surSurvol: (s: Survol) => void;
};
export type Pilote = {
  allerEtage: (i: number) => void;
  revenirEtage: () => void;
  detruire: () => void;
};

const C = {
  bg: 0x07090d, acier: 0x2a3340, acierC: 0x36414f, face: 0x232d3a,
  acc: 0x8d7cff, crit: 0xff5b5b, high: 0xff9f43, med: 0xffd166,
  low: 0x3ddc97, off: 0x39434f,
};
const SEV = (s: Severite | null | undefined) => (s ? C[s] : C.acc);
const U = 0.42, LARG = 4.0, PROF = 3.6, HAUT = 5.4;

export function demarrer(hote: HTMLElement, cb: Rappels): Pilote {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.bg);
  scene.fog = new THREE.Fog(C.bg, 40, 92);

  const AR = () => Math.max(hote.clientWidth, 1) / Math.max(hote.clientHeight, 1);
  let F = 9, Fc = 9;
  const cam = new THREE.OrthographicCamera(-F * AR(), F * AR(), F, -F, 0.1, 400);

  const rnd = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  rnd.setPixelRatio(Math.min(devicePixelRatio, 2));
  rnd.setSize(hote.clientWidth, hote.clientHeight);
  rnd.domElement.style.display = "block";
  hote.appendChild(rnd.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 1.25));
  const k = new THREE.DirectionalLight(0xffffff, 1.55);
  k.position.set(8, 15, 15);
  scene.add(k);
  const f2 = new THREE.DirectionalLight(C.acc, 0.45);
  f2.position.set(-11, 7, -9);
  scene.add(f2);

  const jetables: { dispose: () => void }[] = [];
  const M = (c: number, e = 0, ei = 0) => {
    const m = new THREE.MeshLambertMaterial({ color: c, emissive: e, emissiveIntensity: ei });
    jetables.push(m); return m;
  };
  const geo = <T extends THREE.BufferGeometry>(g: T) => { jetables.push(g); return g; };
  const B = (w: number, h: number, d: number, c: number, e?: number, ei?: number) =>
    new THREE.Mesh(geo(new THREE.BoxGeometry(w, h, d)), M(c, e, ei));
  const P = (m: THREE.Object3D, x: number, y: number, z: number) => { m.position.set(x, y, z); return m; };
  // Le halo n'est qu'un liseré : on ne dessine que ses faces arrière, donc
  // l'équipement reste visible au travers au lieu d'être noyé dans la couleur.
  const HALO = (w: number, h: number, d: number, c: number) => {
    const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.5, side: THREE.BackSide });
    jetables.push(m);
    return new THREE.Mesh(geo(new THREE.BoxGeometry(w, h, d)), m);
  };

  type Cible = THREE.Object3D & { userData: { data?: Fiche; halo?: THREE.Mesh; baie?: { nom: string }; haloB?: THREE.Mesh; hauteur?: number } };
  let racine: THREE.Group | null = null;
  let cliquables: Cible[] = [];
  let baieFocus: Cible | null = null;
  let iEtage = 0;
  let vivant = true;

  /* ---------- baie ---------- */
  function construireBaie(baie: (typeof SITE.etages)[number]["baies"][number]) {
    const g = new THREE.Group();
    g.position.set(baie.x, 0, baie.z);
    const H = HAUT;
    ([[-LARG / 2 - 0.16, -PROF / 2 - 0.16, 0.26], [LARG / 2 + 0.16, -PROF / 2 - 0.16, 0.26],
      [-LARG / 2 - 0.16, PROF / 2 + 0.16, 0.13], [LARG / 2 + 0.16, PROF / 2 + 0.16, 0.13]] as const)
      .forEach(([x, z, e]) => g.add(P(B(e, H, e, C.acier), x, H / 2, z)));
    [0, H].forEach((y) => g.add(P(B(LARG + 0.55, 0.2, PROF + 0.55, C.acierC), 0, y, 0)));
    g.add(P(B(LARG + 0.3, H - 0.3, 0.1, 0x141a23), 0, H / 2, -PROF / 2 - 0.1));

    // L'onduleur est en bas, le panneau de brassage en haut : c'est l'ordre
    // d'une baie réelle, et il se lit au premier coup d'œil.
    let y = 0.75;
    [...baie.devices].reverse().forEach((d: Equipement) => {
      const h = d.u * U;
      const gd = new THREE.Group() as Cible;
      gd.position.y = y + h / 2;
      g.add(gd);
      gd.add(B(LARG, h - 0.05, PROF, C.face));
      gd.add(P(B(LARG + 0.06, h - 0.08, 0.11, 0x2e3a49), 0, 0, PROF / 2));

      if (d.kind === "Commutateur") {
        const n = 12;
        for (let r = 0; r < 2; r++) for (let p = 0; p < n; p++) {
          const on = r * n + p < Math.round(n * 2 * 0.78);
          gd.add(P(B(0.19, 0.09, 0.05, 0x0e1419, on ? C.low : C.off, on ? 1.1 : 0.25),
            -1.7 + p * 0.3, r ? 0.08 : -0.08, PROF / 2 + 0.07));
        }
      } else if (d.kind === "Serveur" || d.kind === "Hyperviseur") {
        for (let i = 0; i < 4; i++) {
          gd.add(P(B(0.4, h - 0.26, 0.07, 0x1b242f), -1.5 + i * 0.5, 0, PROF / 2 + 0.07));
          gd.add(P(B(0.07, 0.07, 0.04, 0x000000, C.low, 1.1), -1.65 + i * 0.5, h / 2 - 0.17, PROF / 2 + 0.1));
        }
        gd.add(P(B(0.09, 0.09, 0.04, 0x000000, C.low, 1.2), 1.72, 0, PROF / 2 + 0.1));
      } else if (d.kind === "Stockage") {
        for (let i = 0; i < 8; i++) {
          gd.add(P(B(0.3, h - 0.3, 0.07, 0x1b242f), -1.55 + i * 0.45, 0, PROF / 2 + 0.07));
          gd.add(P(B(0.06, 0.06, 0.04, 0x000000, i < 7 ? C.low : C.med, 1.1),
            -1.66 + i * 0.45, h / 2 - 0.19, PROF / 2 + 0.1));
        }
      } else if (d.kind === "Onduleur") {
        gd.add(P(B(1.3, 0.45, 0.05, 0x0e1419, C.low, 0.5), -1.0, 0.18, PROF / 2 + 0.08));
        for (let i = 0; i < 4; i++)
          gd.add(P(B(0.13, 0.13, 0.04, 0x000000, i < 2 ? C.low : C.med, 1.0), 0.8 + i * 0.28, 0.18, PROF / 2 + 0.09));
      } else {
        for (let p = 0; p < 12; p++) {
          const x = -1.65 + p * 0.31;
          gd.add(P(B(0.22, 0.13, 0.06, 0x1b242f), x, 0, PROF / 2 + 0.07));
          if (p < 9) gd.add(P(B(0.09, 0.09, 0.44, [0x3ddc97, 0x8d7cff, 0xff9f43][p % 3]), x, -0.02, PROF / 2 + 0.31));
        }
      }

      const sev = d.vulns.length ? d.vulns[0].sev : null;
      const halo = HALO(LARG + 0.3, h + 0.16, PROF + 0.3, SEV(sev));
      halo.visible = false;
      gd.add(halo);
      gd.userData = { data: { kind: d.kind, name: d.name, pos: d.pos, kv: d.kv, vulns: d.vulns }, halo };
      cliquables.push(gd);
      y += h + 0.1;
    });

    const haloB = HALO(LARG + 1.0, H + 0.5, PROF + 1.0, SEV(baie.pire));
    haloB.position.y = H / 2;
    haloB.visible = false;
    g.add(haloB);
    (g as Cible).userData = { baie, haloB, hauteur: H };
    return g as Cible;
  }

  /* ---------- mobilier ---------- */
  // L'utilisateur est assis du côté +z : son siège matérialise l'occupation du
  // plateau, c'est ce qui distingue un open space d'un alignement de tables.
  function fauteuil() {
    const g = new THREE.Group();
    g.position.set(0, 0, 1.55);
    g.add(P(B(0.95, 0.12, 0.9, 0x27313e), 0, 1.1, 0));
    const d = B(0.9, 1.0, 0.12, 0x2e3948);
    d.position.set(0, 1.62, 0.42); d.rotation.x = 0.14; g.add(d);
    g.add(P(new THREE.Mesh(geo(new THREE.CylinderGeometry(0.07, 0.07, 0.95, 8)), M(C.acier)), 0, 0.55, 0));
    g.add(P(new THREE.Mesh(geo(new THREE.CylinderGeometry(0.46, 0.46, 0.07, 14)), M(C.acierC)), 0, 0.1, 0));
    return g;
  }
  function plante(x: number, z: number) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.add(P(new THREE.Mesh(geo(new THREE.CylinderGeometry(0.42, 0.32, 0.72, 12)), M(0x2a3340)), 0, 0.36, 0));
    const f = new THREE.Mesh(geo(new THREE.SphereGeometry(0.72, 12, 10)), M(0x2f6b4f));
    f.position.y = 1.28; f.scale.set(1, 1.35, 1); g.add(f);
    return g;
  }
  // Cloison vitrée : c'est elle qui sépare le local technique du plateau, et
  // elle laisse voir à travers — on garde les baies à l'œil depuis l'open space.
  function construireCloison(c: { x: number; z1: number; z2: number; porte: [number, number] }) {
    const g = new THREE.Group(), H = 3.6;
    const verre = new THREE.MeshLambertMaterial({
      color: 0x5e7a9b, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false,
    });
    jetables.push(verre);
    ([[c.z1, c.porte[0]], [c.porte[1], c.z2]] as const).forEach(([a, b]) => {
      const v = new THREE.Mesh(geo(new THREE.BoxGeometry(0.07, H, b - a)), verre);
      v.position.set(c.x, H / 2, (a + b) / 2); g.add(v);
      [a, b].forEach((z) => g.add(P(B(0.16, H, 0.16, C.acierC), c.x, H / 2, z)));
      g.add(P(B(0.2, 0.12, b - a, C.acierC), c.x, H, (a + b) / 2));
      g.add(P(B(0.2, 0.1, b - a, C.acier), c.x, 0.05, (a + b) / 2));
    });
    return g;
  }

  function construirePoste(p: Poste) {
    const g = new THREE.Group() as Cible;
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.rot || 0;
    const impr = /imprimante/i.test(p.nom);
    g.add(P(B(2.8, 0.12, 1.7, 0x232c38), 0, 1.4, 0));
    ([[-1.2, -0.7], [1.2, -0.7], [-1.2, 0.7], [1.2, 0.7]] as const)
      .forEach(([a, b]) => g.add(P(B(0.11, 1.4, 0.11, C.acier), a, 0.7, b)));
    if (impr) {
      // Une imprimante n'a ni écran ni tour : la dessiner comme un poste
      // ferait mentir la maquette dès le premier coup d'œil.
      g.add(P(B(1.9, 0.95, 1.35, 0x1e2733), 0, 1.95, -0.1));
      g.add(P(B(1.75, 0.07, 1.15, 0x151c25), 0, 1.72, 0.2));
      const t = B(0.62, 0.2, 0.4, 0x0e1419, SEV(p.sev), p.sev ? 0.45 : 0.5);
      t.position.set(-0.5, 2.42, 0.48); t.rotation.x = -0.5; g.add(t);
    } else {
      g.add(P(B(0.5, 0.09, 0.45, 0x2a3340), 0, 1.5, -0.25));
      g.add(P(B(0.12, 0.45, 0.12, 0x2a3340), 0, 1.75, -0.25));
      // Un poste sain garde un écran neutre : la couleur ne sert qu'à signaler
      // un point relevé, sinon tout le plateau clignote pour rien.
      const ec = B(1.9, 1.1, 0.09, 0x0e1419, p.sev ? C[p.sev] : 0x2b3c57, p.sev ? 0.45 : 0.5);
      ec.position.set(0, 2.5, -0.25); ec.rotation.y = -0.1; g.add(ec);
      g.add(P(B(0.45, 1.2, 1.0, 0x1e2733), 1.7, 0.6, 0));
      g.add(P(B(0.09, 0.09, 0.04, 0x000000, C.low, 1.1), 1.7, 1.05, 0.51));
      g.add(P(B(1.35, 0.06, 0.45, 0x232c38), -0.1, 1.49, 0.45));
      g.add(fauteuil());
    }
    const halo = HALO(3.3, 0.16, 2.2, SEV(p.sev));
    halo.position.y = 0.08; halo.visible = false; g.add(halo);
    g.userData = {
      data: { kind: impr ? "Imprimante réseau" : "Poste de travail", name: p.nom, pos: "hors baie", kv: p.kv, vulns: p.vulns },
      halo,
    };
    cliquables.push(g);
    return g;
  }

  // Le câblage court au sol, pas en l'air : une courbe plate qui contourne
  // légèrement, comme une goulotte. Une courbe qui s'envole traverse les
  // cloisons et les bureaux, et ne ressemble à rien de réel.
  function cable(a: THREE.Vector3, b: THREE.Vector3, couleur: number) {
    const y = 0.16;
    const A = new THREE.Vector3(a.x, y, a.z), Z = new THREE.Vector3(b.x, y, b.z);
    const mil = A.clone().add(Z).multiplyScalar(0.5);
    mil.z += (Z.z >= A.z ? 1 : -1) * 1.4;
    const courbe = new THREE.QuadraticBezierCurve3(A, mil, Z);
    const m = new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: 0.62 });
    jetables.push(m);
    return new THREE.Mesh(geo(new THREE.TubeGeometry(courbe, 26, 0.062, 6, false)), m);
  }

  /* ---------- l'étage ---------- */
  function construireEtage() {
    if (racine) { scene.remove(racine); }
    cliquables = [];
    baieFocus = null;
    survol = null;
    cb.surSurvol(null);
    cb.surBaie(null);
    racine = new THREE.Group();
    scene.add(racine);
    const et = SITE.etages[iEtage];

    // Les deux zones sont des dalles distinctes : le local technique est plus
    // sombre que le plateau, la lecture se fait avant les étiquettes.
    et.zones.forEach((z) => {
      racine!.add(P(B(z.x2 - z.x1, 0.3, z.z2 - z.z1, z.teinte), (z.x1 + z.x2) / 2, -0.15, (z.z1 + z.z2) / 2));
    });
    racine.add(construireCloison(et.cloison));

    const contenu = new THREE.Group();
    racine.add(contenu);
    const baies = et.baies.map((b) => { const g = construireBaie(b); contenu.add(g); return g; });
    et.postes.forEach((p) => contenu.add(construirePoste(p)));

    // Une descente par îlot, pas une par poste : c'est le câblage réel, et ça
    // évite la pelote qu'on obtient en reliant chaque machine à la baie.
    const ilots = new Map<string, { x: number; z: number; n: number; sev: Severite | null }>();
    et.postes.forEach((p) => {
      const e = ilots.get(p.ilot) ?? { x: 0, z: 0, n: 0, sev: null };
      e.x += p.x; e.z += p.z; e.n++;
      if (p.sev && (!e.sev || p.sev === "high" || p.sev === "crit")) e.sev = p.sev;
      ilots.set(p.ilot, e);
    });
    const dep = baies[0];
    ilots.forEach((e) => {
      const ix = e.x / e.n, iz = e.z / e.n;
      racine!.add(P(B(0.55, 0.1, 0.55, 0x1b242f), ix, 0.06, iz));
      racine!.add(cable(new THREE.Vector3(dep.position.x + LARG / 2, 0.16, dep.position.z),
        new THREE.Vector3(ix, 0.16, iz), SEV(e.sev) === C.acc ? C.low : SEV(e.sev)));
    });
    for (let i = 1; i < baies.length; i++) {
      racine.add(cable(
        new THREE.Vector3(baies[i - 1].position.x + LARG / 2, 0.16, baies[i - 1].position.z),
        new THREE.Vector3(baies[i].position.x - LARG / 2, 0.16, baies[i].position.z), C.acc));
    }
    // Un peu de vert : un plateau vide ne ressemble à aucun bureau réel.
    et.zones.filter((z) => z.nom === "Open space").forEach((z) => {
      ([[z.x1 + 1.6, z.z1 + 1.4], [z.x1 + 1.6, z.z2 - 1.4], [z.x2 - 4.5, z.z1 + 1.4]] as const)
        .forEach(([x, zz]) => racine!.add(plante(x, zz)));
    });

    // On vise le centre des équipements, mais on cadre sur la scène entière :
    // viser le sol décentrerait la vue, le laisser hors cadre le couperait.
    const c = new THREE.Box3().setFromObject(contenu).getCenter(new THREE.Vector3());
    racine.userData = {
      baies,
      bb: new THREE.Box3().setFromObject(racine),
      cible: new THREE.Vector3(c.x, c.y * 0.78, c.z),
    };
    vueEtage();
  }

  /* ---------- caméra ---------- */
  // Le zoom ne se devine pas : en projection isométrique, x et z retombent
  // tous les deux sur l'axe horizontal de l'écran. Plutôt que de refaire le
  // calcul à la main, on projette les huit coins de la boîte englobante avec
  // une caméra témoin réglée à 1 ; le débordement lu donne le facteur, la
  // projection orthographique étant linéaire en F.
  const _p = new THREE.Vector3();
  const temoin = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  function cadrer(bb: THREE.Box3, cible: THREE.Vector3, pos: THREE.Vector3, marge = 1.14) {
    temoin.left = -AR(); temoin.right = AR(); temoin.top = 1; temoin.bottom = -1;
    temoin.position.copy(pos); temoin.lookAt(cible);
    temoin.updateMatrixWorld(true); temoin.updateProjectionMatrix();
    let m = 0;
    for (let i = 0; i < 8; i++) {
      _p.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).project(temoin);
      m = Math.max(m, Math.abs(_p.x), Math.abs(_p.y));
    }
    return m * marge;
  }

  const camPos = new THREE.Vector3(), camCib = new THREE.Vector3();
  const camPosV = new THREE.Vector3(), camCibV = new THREE.Vector3();
  let premier = true;

  function vueEtage() {
    baieFocus = null;
    const u = racine!.userData as { bb: THREE.Box3; cible: THREE.Vector3; baies: Cible[] };
    camPosV.set(u.cible.x + 14, 12.5, u.cible.z + 21);
    camCibV.copy(u.cible);
    F = cadrer(u.bb, u.cible, camPosV);
    u.baies.forEach((g) => { if (g.userData.haloB) g.userData.haloB.visible = false; });
    cb.surBaie(null);
    if (premier) { camPos.copy(camPosV); camCib.copy(camCibV); Fc = F; premier = false; }
  }
  function vueBaie(g: Cible) {
    baieFocus = g;
    const p = g.position;
    camPosV.set(p.x + 7.5, p.y + 6.2, p.z + 9.5);
    camCibV.set(p.x, (g.userData.hauteur ?? HAUT) / 2 + 0.2, p.z);
    // Même cadrage calculé qu'en vue étage : le cadre du site est très
    // large, une valeur fixe y coupe le haut de la baie.
    F = cadrer(new THREE.Box3().setFromObject(g), camCibV, camPosV, 1.3);
    (racine!.userData.baies as Cible[]).forEach((x) => { if (x.userData.haloB) x.userData.haloB.visible = false; });
    cb.surBaie(g.userData.baie!.nom);
  }

  /* ---------- pointeur ---------- */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let survol: Cible | null = null;

  function viser(ev: PointerEvent | MouseEvent) {
    const r = rnd.domElement.getBoundingClientRect();
    ptr.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, cam);
    let g: Cible | null = null;
    if (baieFocus) {
      const h = ray.intersectObjects(cliquables, true)[0];
      if (h) { let o: THREE.Object3D | null = h.object; while (o && !(o as Cible).userData.data) o = o.parent; g = o as Cible | null; }
    } else {
      // Vue étage : une baie se survole en entier. On remonte donc jusqu'à
      // elle quand le rayon touche un équipement rangé dedans ; un poste,
      // lui, n'a pas de baie au-dessus et reste la cible.
      // Les postes sont hors baie ; un équipement a sa baie pour parent.
      const cibles = [...(racine!.userData.baies as Cible[]),
        ...cliquables.filter((c) => !c.parent?.userData.baie)];
      const h = ray.intersectObjects(cibles, true)[0];
      if (h) {
        let o: THREE.Object3D | null = h.object, repli: Cible | null = null;
        while (o) {
          if ((o as Cible).userData.baie) { repli = o as Cible; break; }
          if ((o as Cible).userData.data && !repli) repli = o as Cible;
          o = o.parent;
        }
        g = repli;
      }
    }
    return g;
  }

  function onMove(ev: PointerEvent) {
    const g = viser(ev);
    if (g !== survol) {
      if (survol) { const h = survol.userData.halo ?? survol.userData.haloB; if (h) h.visible = false; }
      survol = g;
      if (survol) {
        const h = survol.userData.halo ?? survol.userData.haloB; if (h) h.visible = true;
        rnd.domElement.style.cursor = "pointer";
      } else { rnd.domElement.style.cursor = "default"; }
    }
    const r = rnd.domElement.getBoundingClientRect();
    cb.surSurvol(survol
      ? { nom: survol.userData.baie?.nom ?? survol.userData.data!.name, x: ev.clientX - r.left, y: ev.clientY - r.top }
      : null);
  }
  function onLeave() {
    if (survol) { const h = survol.userData.halo ?? survol.userData.haloB; if (h) h.visible = false; survol = null; }
    cb.surSurvol(null);
  }
  function onClick(ev: MouseEvent) {
    const g = viser(ev);
    if (!g) return;
    if (g.userData.baie) { vueBaie(g); cb.surFiche(null); }
    else cb.surFiche(g.userData.data!);
  }

  rnd.domElement.addEventListener("pointermove", onMove);
  rnd.domElement.addEventListener("pointerleave", onLeave);
  rnd.domElement.addEventListener("click", onClick);

  const ro = new ResizeObserver(() => {
    const w = hote.clientWidth, h = hote.clientHeight;
    if (!w || !h) return;
    rnd.setSize(w, h);
    if (!baieFocus && racine) {
      const u = racine.userData as { bb: THREE.Box3; cible: THREE.Vector3 };
      F = cadrer(u.bb, u.cible, camPosV);
    }
  });
  ro.observe(hote);

  let brut = 0;
  function boucle() {
    if (!vivant) return;
    brut = requestAnimationFrame(boucle);
    camPos.lerp(camPosV, 0.07); camCib.lerp(camCibV, 0.07); Fc += (F - Fc) * 0.07;
    cam.position.copy(camPos); cam.lookAt(camCib);
    const a = AR();
    cam.left = -Fc * a; cam.right = Fc * a; cam.top = Fc; cam.bottom = -Fc;
    cam.updateProjectionMatrix();
    rnd.render(scene, cam);
  }

  construireEtage();
  boucle();

  return {
    allerEtage(i) { if (i === iEtage) return; iEtage = i; construireEtage(); cb.surFiche(null); },
    revenirEtage() { if (racine) { vueEtage(); cb.surFiche(null); } },
    detruire() {
      vivant = false;
      cancelAnimationFrame(brut);
      ro.disconnect();
      rnd.domElement.removeEventListener("pointermove", onMove);
      rnd.domElement.removeEventListener("pointerleave", onLeave);
      rnd.domElement.removeEventListener("click", onClick);
      jetables.forEach((d) => d.dispose());
      rnd.dispose();
      rnd.domElement.remove();
    },
  };
}
