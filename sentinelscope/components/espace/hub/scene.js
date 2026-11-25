/* L'accueil de l'espace client.

   Trois îlots, un par module, et chacun porte une miniature de sa propre
   scène : des baies pour le jumeau, l'anneau et le noyau pour AgentShield,
   le plan d'eau et ses rubans pour la veille. Le visiteur reconnaît ce
   qu'il va trouver avant d'avoir lu une ligne. À l'ouverture, les îlots
   montent l'un après l'autre ; au survol, l'îlot se soulève. */
import * as THREE from 'three';

export const MODULES = [
  { id:'jumeau',      titre:'Jumeau 3D',       accroche:'Votre infrastructure, étage par étage',
    texte:"Baies, serveurs, postes et bornes Wi-Fi relevés sur site. On ouvre chaque baie, chaque équipement porte ses constats." },
  { id:'agentshield', titre:'AgentShield',     accroche:'Ce que vos agents IA ont le droit de faire',
    texte:"Analyse de configuration lancée chez vous : quels outils chaque agent atteint, et où aucune règle ne l'arrête." },
  { id:'commerce',    titre:'Veille commerce', accroche:'Le marché, face à votre prix',
    texte:"Les prix de vos concurrents jour après jour, et les produits qu'ils vendent sans vous." },
];

export function demarrer(root, { aller, survoler }) {
  const L = () => Math.max(root.clientWidth, 1), H = () => Math.max(root.clientHeight, 1);
  let vivant = true, rafId = 0;
  const ecouteurs = [];
  const suivre = (c, t, f, o) => { c.addEventListener(t, f, o); ecouteurs.push([c, t, f, o]); };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06080C);
  scene.fog = new THREE.Fog(0x06080C, 26, 60);
  const cam = new THREE.PerspectiveCamera(38, L() / H(), .1, 200);
  const rnd = new THREE.WebGLRenderer({ antialias: true });
  rnd.setPixelRatio(Math.min(devicePixelRatio, 2));
  rnd.setSize(L(), H());
  root.appendChild(rnd.domElement);
  scene.add(new THREE.AmbientLight(0xffffff, 1.05));
  const k = new THREE.DirectionalLight(0xffffff, 1.3); k.position.set(6, 14, 9); scene.add(k);
  const f = new THREE.PointLight(0x8D7CFF, 40, 30); f.position.set(0, 2, 2); scene.add(f);

  const M = (c, e = 0, ei = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e, emissiveIntensity: ei });
  const MB = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o });
  const B = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const P = (o, x, y, z) => { o.position.set(x, y, z); return o; };

  // Un sol de points, loin dessous : il donne la profondeur sans rien dire.
  {
    const pts = [];
    for (let x = -30; x <= 30; x += 1.5) for (let z = -30; z <= 10; z += 1.5) pts.push(x, -3.2, z);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8D7CFF, size: .05, transparent: true, opacity: .45 })));
  }

  function socle(g) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 2.6, .5, 6), M(0x151B26));
    s.position.y = -.25; g.add(s);
    const bord = new THREE.Mesh(new THREE.TorusGeometry(3.1, .045, 6, 6), MB(0x8D7CFF, .55));
    bord.rotation.x = Math.PI / 2; bord.rotation.z = Math.PI / 6; g.add(bord);
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.25, .06, 6), MB(0x8D7CFF, 0));
    halo.position.y = -.53; g.add(halo);
    return halo;
  }

  /* --- miniatures --- */
  function miniJumeau(g) {
    [-.9, .9].forEach(x => {
      g.add(P(B(1.1, 2.2, 1, M(0x232D3A)), x, 1.1, -.6));
      for (let u = 0; u < 5; u++) {
        const allume = (u + (x > 0 ? 1 : 0)) % 3 !== 0;
        g.add(P(B(.9, .06, .05, M(0x0E1419, allume ? 0x3DDC97 : 0x39434F, allume ? 1 : .2)), x, .35 + u * .38, -.08));
      }
    });
    for (let i = 0; i < 3; i++) {
      g.add(P(B(1.1, .06, .6, M(0x2A3340)), -1.3 + i * 1.3, .65, 1.5));
      g.add(P(B(.55, .38, .04, M(0x0E1419, i === 1 ? 0xFF9F43 : 0x2B3C57, .55)), -1.3 + i * 1.3, .95, 1.3));
    }
  }
  function miniAgents(g) {
    const noyau = new THREE.Group(); g.add(noyau);
    noyau.add(P(new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 2.6, 10), M(0x101722, 0x8D7CFF, .4)), 0, 1.3, 0));
    [[.5, 0x5E7A9B], [.95, 0x5E7A9B], [1.4, 0xFF9F43], [1.85, 0xFF9F43], [2.3, 0xFF5B5B]].forEach(([y, c]) => {
      const t = new THREE.Mesh(new THREE.TorusGeometry(.5, .07, 8, 28), M(0x1B2430, c, .6));
      t.rotation.x = Math.PI / 2; t.position.y = y; noyau.add(t);
    });
    const r = new THREE.Mesh(new THREE.TorusGeometry(1.35, .03, 6, 40), MB(0x3DDC97, .8));
    r.rotation.x = Math.PI / 2; r.position.y = 1.4; g.add(r);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const p = new THREE.Group(); p.position.set(Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2);
      p.add(P(new THREE.Mesh(new THREE.CapsuleGeometry(.14, .3, 4, 8), M(0x3C4A5C)), 0, .4, 0));
      p.add(P(new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), M(0x4A5A6E)), 0, .78, 0));
      g.add(p);
    }
    return noyau;
  }
  function miniCommerce(g) {
    const eau = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.6), new THREE.MeshBasicMaterial({ color: 0x8D7CFF, transparent: true, opacity: .25, side: THREE.DoubleSide, depthWrite: false }));
    eau.rotation.x = -Math.PI / 2; eau.position.y = 1.1; g.add(eau);
    const hs = [[.5, .6, .2, -.3, -.4], [.3, .45, .45, .4, .35], [-.2, -.35, -.4, -.5, -.55], [.6, .3, .1, -.1, .2]];
    hs.forEach((serie, r) => serie.forEach((h, j) => {
      g.add(P(B(.13, .06, .7, M(h < 0 ? 0xFF9F43 : 0x6F8299)), -1.5 + r * 1, 1.1 + h, -1.4 + j * .7));
    }));
    g.add(P(B(.3, .9, .3, M(0xFF9F43, 0xFF9F43, .5)), -.5, .65, 1.6));
    const rond = new THREE.Mesh(new THREE.RingGeometry(.35, .42, 32), new THREE.MeshBasicMaterial({ color: 0xFF9F43, transparent: true, opacity: .7, side: THREE.DoubleSide }));
    rond.rotation.x = -Math.PI / 2; rond.position.set(-.5, 1.12, .4); g.add(rond);
    return rond;
  }

  const POS = [[-7.2, 0, 0], [0, 0, -2.4], [7.2, 0, 0]];
  const ilots = MODULES.map((m, i) => {
    const g = new THREE.Group(); g.position.set(...POS[i]); scene.add(g);
    const halo = socle(g);
    let anime = null;
    if (m.id === 'jumeau') miniJumeau(g);
    if (m.id === 'agentshield') anime = miniAgents(g);
    if (m.id === 'commerce') anime = miniCommerce(g);
    // Zone de clic plus large que l'îlot : on vise un module, pas un pixel.
    const cible = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 4.5, 6), new THREE.MeshBasicMaterial({ visible: false }));
    cible.position.y = 1.5; cible.userData.i = i; g.add(cible);
    return { g, halo, anime, cible, base: POS[i][1], lev: 0 };
  });

  const cPos = new THREE.Vector3(0, 7.4, 19.5), cCib = new THREE.Vector3(0, .3, -1);
  const cadrer = () => {
    cam.aspect = L() / H();
    // Écran étroit : on recule pour que les trois îlots tiennent.
    const recul = cam.aspect < 1.3 ? 1.3 / cam.aspect : 1;
    cam.position.copy(cPos).multiplyScalar(recul); cam.lookAt(cCib); cam.updateProjectionMatrix();
    rnd.setSize(L(), H());
  };
  cadrer();
  suivre(window, 'resize', cadrer);

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let survol = -1;
  const viser = e => {
    const r = rnd.domElement.getBoundingClientRect();
    ptr.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, cam);
    const h = ray.intersectObjects(ilots.map(x => x.cible))[0];
    return h ? h.object.userData.i : -1;
  };
  suivre(rnd.domElement, 'pointermove', e => {
    const i = viser(e);
    if (i !== survol) { survol = i; survoler(i); rnd.domElement.style.cursor = i >= 0 ? 'pointer' : 'default'; }
  });
  suivre(rnd.domElement, 'pointerleave', () => { survol = -1; survoler(-1); });
  suivre(rnd.domElement, 'click', e => { const i = viser(e); if (i >= 0) aller(MODULES[i].id); });

  const t0 = performance.now();
  (function boucle() {
    if (!vivant) return;
    rafId = requestAnimationFrame(boucle);
    const t = (performance.now() - t0) / 1000;
    ilots.forEach((x, i) => {
      // Montée d'ouverture, décalée d'un îlot à l'autre.
      const r = Math.min(Math.max((t - .25 - i * .22) / 1.1, 0), 1), e = 1 - Math.pow(1 - r, 3);
      x.lev += ((survol === i ? .55 : 0) - x.lev) * .12;
      x.g.position.y = -6 * (1 - e) + Math.sin(t * .9 + i * 1.7) * .12 + x.lev;
      x.g.rotation.y = Math.sin(t * .25 + i) * .12;
      x.halo.material.opacity += ((survol === i ? .45 : 0) - x.halo.material.opacity) * .12;
    });
    if (ilots[1].anime) ilots[1].anime.rotation.y = t * .5;
    if (ilots[2].anime) { const s = (t * .6) % 1; ilots[2].anime.scale.setScalar(.6 + s * 2.4); ilots[2].anime.material.opacity = (1 - s) * .8; }
    rnd.render(scene, cam);
  })();

  return () => {
    vivant = false;
    cancelAnimationFrame(rafId);
    ecouteurs.forEach(([c, t, f, o]) => c.removeEventListener(t, f, o));
    scene.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => m.dispose()); });
    rnd.dispose();
    rnd.domElement.remove();
  };
}
