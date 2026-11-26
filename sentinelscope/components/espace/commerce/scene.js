import * as THREE from 'three';
import { produits, CONCURRENTS, JOURS, BOUTIQUE, ALERTES, euros, pct } from './data.js';
import { creerRecherche } from './recherche.js';

/* Porté depuis le prototype. La scène reçoit sa racine au lieu de prendre
   toute la page, et rend une fonction qui défait tout ce qu'elle a créé :
   rendu, écouteurs, boucle, géométries. Sans ça, revenir à l'espace puis
   rouvrir le module empilerait les boucles d'animation. */
export function demarrer(root) {
  const $ = id => root.querySelector('#' + id);
  const L = () => Math.max(root.clientWidth, 1), H = () => Math.max(root.clientHeight, 1);
  const ecouteurs = [];
  const suivre = (cible, type, fn, opts) => { cible.addEventListener(type, fn, opts); ecouteurs.push([cible, type, fn, opts]); };
  let vivant = true, rafId = 0;
  root.insertAdjacentHTML('afterbegin', '<div class="ui tete">\n  <span class="marque"><i></i>SentinelScope · Shopify · Commerce</span>\n  <h1 id="titre">Le marché, face à votre prix</h1>\n  <p id="soustitre"></p>\n  <div class="modes"><button class="on" data-m="marche">Veille prix</button><button data-m="pistes">Recherche produit</button></div>\n  <button class="retour" id="retour">← Tous les produits</button>\n</div>\n<div class="ui compteurs" id="compteurs"></div>\n<div class="ui liste" id="bloc-liste"><div class="tt" id="liste-titre">Vos produits</div><div id="liste"></div></div>\n<div class="ui legende" id="legende"></div>\n<div id="lbls"></div>\n<div class="panneau" id="panneau"><button class="x" id="x">×</button><div id="p-corps"></div></div>\n<div class="aide" id="aide">Sous la surface violette, un concurrent est moins cher que vous. Cliquez un produit pour voir qui.</div>\n<span class="demo">Données de démonstration</span>');
/* Veille commerce — la scène.

   Troisième grammaire de la plateforme, distincte des deux autres :
   - le jumeau est un lieu (sol, étages, baies) ;
   - AgentShield est un seuil (anneau, noyau, barrière) ;
   - ici c'est un niveau : votre prix est une surface, comme un plan d'eau.

   Chaque concurrent est un ruban. Au-dessus de la surface, il est plus cher
   que vous ; quand il plonge dessous, il vous passe en dessous. La
   profondeur est le temps : aujourd'hui au premier plan, il y a trente
   jours au fond, dans le brouillard. Une baisse brutale fait des ronds
   dans l'eau. Rien ici n'est décoratif : hauteur = écart de prix,
   profondeur = date, couleur = au-dessus ou au-dessous de vous. */

const C = { bg:0x06080C, acc:0x8D7CFF, dessous:0xFF9F43, dessus:0x6F8299, ok:0x3DDC97 };
const ECH = 17;            // 10 % d'écart = 1,7 unité : les écarts doivent se voir de loin
const PAS_Z = 0.9;         // un jour
const LARGEUR_VOIE = 3.3;

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.bg);
scene.fog = new THREE.Fog(C.bg, 30, 74);   // calé sur la distance caméra : le passé s'efface, le présent reste net
const cam = new THREE.PerspectiveCamera(36, L() / H(), 0.1, 200);
const rnd = new THREE.WebGLRenderer({ antialias: true });
rnd.setPixelRatio(Math.min(devicePixelRatio, 2));
rnd.setSize(L(), H());
rnd.localClippingEnabled = true;
root.appendChild(rnd.domElement);
scene.add(new THREE.AmbientLight(0xffffff, 1.1));
const k = new THREE.DirectionalLight(0xffffff, 1.0); k.position.set(5, 12, 8); scene.add(k);

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const mesh = (g, m) => new THREE.Mesh(g, m);
const MB = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o });

const N = produits.length;
const xVoie = i => (i - (N - 1) / 2) * LARGEUR_VOIE;
const zJour = j => -(JOURS - 1 - j) * PAS_Z;
const yEcart = e => e * ECH;

/* ===================== MODE MARCHÉ ===================== */
const marche = new THREE.Group(); scene.add(marche);

// La surface : votre prix. Translucide, pour qu'on voie ce qui passe dessous.
const largeurTotale = N * LARGEUR_VOIE + 4, profondeur = JOURS * PAS_Z + 4;
const eau = mesh(new THREE.PlaneGeometry(largeurTotale, profondeur),
  new THREE.MeshBasicMaterial({ color: C.acc, transparent: true, opacity: .2, side: THREE.DoubleSide, depthWrite: false }));
eau.rotation.x = -Math.PI / 2; eau.position.set(0, 0, -profondeur / 2 + 2); marche.add(eau);
{ // quadrillage léger : une ligne par semaine, une par voie
  const pts = [];
  for (let j = 0; j < JOURS; j += 7) { const z = zJour(JOURS - 1 - j); pts.push(-largeurTotale/2, 0.005, z, largeurTotale/2, 0.005, z); }
  for (let i = 0; i <= N; i++) { const x = xVoie(i) - LARGEUR_VOIE / 2; pts.push(x, 0.005, 2, x, 0.005, -profondeur + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  marche.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: C.acc, transparent: true, opacity: .22 })));
  // « aujourd'hui » : le bord avant, appuyé
  const b = mesh(new THREE.BoxGeometry(largeurTotale, .03, .05), MB(C.acc, .7)); b.position.set(0, .01, .5); marche.add(b);
}

// Les rubans, en une seule instanciation : 8 produits × 5 concurrents × 30
// jours de paliers, plus les marches verticales quand un prix change.
const plan = new THREE.Plane(V(0, 0, -1), -40);   // balayage d'apparition
const segs = [];
produits.forEach((p, i) => {
  const cheap = CONCURRENTS.indexOf(p.qui);
  p.series.forEach((s, c) => {
    const x = xVoie(i) + (c - 2) * 0.62;
    for (let j = 0; j < JOURS; j++) {
      const e = s[j] / p.prix - 1;
      segs.push({ i, c, j, x, y: yEcart(e), z: zJour(j) - PAS_Z / 2, h: .07, d: PAS_Z, e, cheap: c === cheap });
      if (j > 0 && s[j] !== s[j - 1]) {
        const e0 = s[j - 1] / p.prix - 1, y0 = yEcart(e0), y1 = yEcart(e);
        segs.push({ i, c, j, x, y: (y0 + y1) / 2, z: zJour(j) - PAS_Z, h: Math.abs(y1 - y0), d: .07, e: Math.min(e, e0), cheap: c === cheap });
      }
    }
  });
});
const ruban = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshLambertMaterial({ clippingPlanes: [plan] }), segs.length);
const m4 = new THREE.Matrix4(), col = new THREE.Color();
segs.forEach((s, n) => {
  m4.makeScale(.24, s.h, s.d); m4.setPosition(s.x, s.y, s.z); ruban.setMatrixAt(n, m4);
});
function teinter(focus = null) {
  segs.forEach((s, n) => {
    // Sous la surface = un concurrent moins cher que vous : orange. Le
    // moins cher d'aujourd'hui est plus vif que les autres.
    col.setHex(s.e < -0.005 ? C.dessous : C.dessus);
    if (s.e >= -0.005 && s.cheap) col.setHex(0x9FB1C6);
    if (focus !== null && s.i !== focus) col.multiplyScalar(.16);
    ruban.setColorAt(n, col);
  });
  ruban.instanceColor.needsUpdate = true;
}
teinter(); marche.add(ruban);

// Aujourd'hui, au bord : une colonne par produit, de la surface jusqu'au
// moins cher. Vers le bas et orange : on vous passe en dessous.
const colonnes = produits.map((p, i) => {
  const e = p.min / p.prix - 1, h = Math.max(Math.abs(yEcart(e)), .06);
  const c = mesh(new THREE.BoxGeometry(.5, h, .5),
    new THREE.MeshLambertMaterial({ color: e < -0.005 ? C.dessous : C.ok, emissive: e < -0.005 ? C.dessous : C.ok, emissiveIntensity: .45 }));
  c.position.set(xVoie(i), yEcart(e) / 2, 1.1);
  c.userData = { voie: i }; marche.add(c); return c;
});

// Ronds dans l'eau : là où un concurrent vient de casser son prix.
const ronds = [];
ALERTES.filter(a => /baissé/.test(a[2])).forEach(([i]) => {
  const p = produits[i], z = zJour(JOURS - 2);
  for (let r = 0; r < 3; r++) {
    const anneau = mesh(new THREE.RingGeometry(.9, 1, 48),
      new THREE.MeshBasicMaterial({ color: C.dessous, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    anneau.rotation.x = -Math.PI / 2; anneau.position.set(xVoie(i), .02, z);
    marche.add(anneau); ronds.push({ m: anneau, phase: r / 3 });
  }
});

// Zones cliquables : une boîte invisible par voie.
const voies = produits.map((p, i) => {
  const b = mesh(new THREE.BoxGeometry(LARGEUR_VOIE * .92, 6, profondeur), new THREE.MeshBasicMaterial({ visible: false }));
  b.position.set(xVoie(i), 0, -profondeur / 2 + 2); b.userData = { voie: i }; marche.add(b); return b;
});

/* ===================== MODE RECHERCHE ===================== */
// Vraies données : le moteur interroge les boutiques du client. Voir recherche.js.
const aide = $('aide');
const recherche = creerRecherche({ scene, cam, root, $, L, H, suivre });

/* ===================== INTERFACE ===================== */
const plusChers = produits.filter(p => p.ecart > .02).length;
const pastille = e => { const c = e > .02 ? '#FF9F43' : e < -.02 ? '#3DDC97' : '#8B98A8';
  return `<span class="ecart" style="background:${c}22;color:${c}">${pct(e)}</span>`; };
const cpt = (v, l, c) => `<div class="cpt"><b style="color:${c}">${v}</b><span>${l}</span></div>`;
let mode = 'marche', focus = null;

function hudMarche() {
  $('titre').textContent = focus === null ? 'Le marché, face à votre prix' : produits[focus].nom;
  $('soustitre').textContent = focus === null
    ? `${BOUTIQUE} · ${N} produits · ${CONCURRENTS.length} concurrents · 30 jours`
    : `votre prix ${euros(produits[focus].prix)} · moins cher : ${produits[focus].qui}, ${euros(produits[focus].min)}`;
  $('compteurs').innerHTML = cpt(plusChers, 'Plus chers que le marché', '#FF9F43')
    + cpt(produits.filter(p => p.ecart < -.02).length, 'Moins chers', '#3DDC97')
    + cpt(ALERTES.length, 'Alertes 24 h', '#FFD166');
  $('liste-titre').textContent = 'Vos produits';
  $('liste').innerHTML = produits.map((p, i) =>
    `<div class="ligne ${i === focus ? 'on' : ''}" data-i="${i}"><span>${p.nom}</span>${pastille(p.ecart)}</div>`).join('');
  [...$('liste').children].forEach(d => d.onclick = () => viser(+d.dataset.i));
  $('legende').innerHTML = `<div class="tt">Lecture</div>
    <div><i style="background:#8D7CFF"></i>La surface : votre prix</div>
    <div><i style="background:#FF9F43"></i>Sous la surface : un concurrent moins cher</div>
    <div><i style="background:#6F8299"></i>Au-dessus : un concurrent plus cher</div>
    <div><i style="background:linear-gradient(90deg,#6F8299,transparent)"></i>Profondeur : les 30 derniers jours</div>`;
}
function ficheProduit(i) {
  const p = produits[i];
  const auj = p.series.map((s, c) => [CONCURRENTS[c], s[JOURS - 1]]).sort((a, b) => a[1] - b[1]);
  const ses = ALERTES.filter(a => a[0] === i);
  $('p-corps').innerHTML = `<span class="kind">Produit suivi</span><h2>${p.nom}</h2>
    <div class="sous">${p.ref} · votre prix ${euros(p.prix)}</div>
    <div class="sec">Aujourd'hui, du moins cher au plus cher</div>` +
    auj.map(([n, v]) => `<div class="rang"><span>${n}</span><span><span class="m">${euros(v)}</span> ${pastille(p.prix / v - 1)}</span></div>`).join('') +
    `<p>La pastille donne votre écart face à chacun : orange, vous êtes plus cher que lui.</p>` +
    (ses.length ? `<div class="sec">Alertes</div>` + ses.map(a => `<p><b style="color:#F5F7FA">${CONCURRENTS[a[1]]}</b> ${a[2]} <span style="font-family:ui-monospace,monospace">· ${a[3]}</span></p>`).join('') : '');
  $('panneau').classList.add('on');
}
$('x').onclick = () => $('panneau').classList.remove('on');

/* ---------- étiquettes projetées ---------- */
const lbls = produits.map((p, i) => {
  const d = document.createElement('div'); d.className = 'lbl3d';
  d.innerHTML = `<b>${p.nom.length > 22 ? p.nom.slice(0, 21) + '…' : p.nom}</b>${pct(p.ecart)}`;
  $('lbls').appendChild(d); return d;
});
const _v = new THREE.Vector3();
function placer(d, x, y, z, visible) {
  _v.set(x, y, z).project(cam);
  const ok = visible && _v.z < 1 && Math.abs(_v.x) < 1.05;
  d.style.opacity = ok ? '' : '0';
  d.style.left = ((_v.x + 1) / 2 * L()) + 'px';
  d.style.top = ((1 - _v.y) / 2 * H()) + 'px';
}

/* ---------- caméra ---------- */
const cPos = V(0, 11, 26), cCib = V(0, -2.8, -9), cPosV = cPos.clone(), cCibV = cCib.clone();
function vueEnsemble() {
  focus = null; teinter(null);
  $('bloc-liste').classList.remove('cache');
  cPosV.set(0, 11, 26); cCibV.set(0, -2.8, -9);
  $('retour').classList.remove('on'); $('panneau').classList.remove('on');
  hudMarche();
}
function viser(i) {
  focus = i; teinter(i);
  cPosV.set(xVoie(i) + 3.2, 6.8, 13); cCibV.set(xVoie(i) + .4, -2.2, -9);
  // La liste cède la place à la fiche : deux index du même produit se gênent.
  $('bloc-liste').classList.add('cache');
  $('retour').classList.add('on');
  hudMarche(); ficheProduit(i);
}
function changerMode(m) {
  mode = m;
  root.querySelectorAll('.modes button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  marche.visible = m === 'marche'; recherche.montrer(m === 'pistes');
  // La recherche affiche de vraies données : le bandeau de démonstration n'y a pas sa place.
  root.querySelector('.demo').classList.toggle('cache', m !== 'marche');
  lbls.forEach(d => d.classList.toggle('cache', m !== 'marche'));
  aide.classList.remove('on');
  $('panneau').classList.remove('on');
  if (m === 'marche') vueEnsemble();
  else { focus = null; teinter(null); $('bloc-liste').classList.remove('cache'); $('retour').classList.remove('on'); cPosV.copy(recherche.cameraVue.pos); cCibV.copy(recherche.cameraVue.cible); }
}
root.querySelectorAll('.modes button').forEach(b => b.onclick = () => changerMode(b.dataset.m));
$('retour').onclick = vueEnsemble;

/* ---------- pointeur ---------- */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
suivre(root, 'click', e => {
  if (e.target.closest('.ui,.panneau')) return;
  ptr.set(e.clientX / L() * 2 - 1, -(e.clientY / H()) * 2 + 1);
  ray.setFromCamera(ptr, cam);
  if (mode === 'marche') {
    const h = ray.intersectObjects([...colonnes, ...voies])[0];
    if (h) viser(h.object.userData.voie);
  } else recherche.cliquer(e);
});
suivre(root, 'pointermove', e => {
  ptr.set(e.clientX / L() * 2 - 1, -(e.clientY / H()) * 2 + 1);
  ray.setFromCamera(ptr, cam);
  if (mode !== 'marche') { root.style.cursor = recherche.survoler(e) ? 'pointer' : 'default'; return; }
  root.style.cursor = ray.intersectObjects([...colonnes, ...voies], true).length && !e.target.closest('.ui,.panneau') ? 'pointer' : 'default';
});

/* ---------- boucle ---------- */
// Ouverture : les rubans se déroulent du passé vers aujourd'hui. C'est
// l'animation d'accueil, et elle dit déjà comment lire la scène.
const t0 = performance.now();
let tPrec = t0;
(function boucle() {
  if (!vivant) return; rafId = requestAnimationFrame(boucle);
  const now = performance.now(), dt = Math.min((now - tPrec) / 1000, .05); tPrec = now;
  const r = Math.min((now - t0) / 2600, 1), lisse = 1 - Math.pow(1 - r, 3);
  plan.constant = -( -profondeur + 2 + (profondeur + 2) * lisse );   // garde z <= seuil
  colonnes.forEach(c => c.scale.y = r < 1 ? Math.max(.001, (r - .7) / .3) : 1);
  ronds.forEach(o => {
    const f = ((now / 1000) * .45 + o.phase) % 1;
    o.m.scale.setScalar(.3 + f * 2.2);
    o.m.material.opacity = r < 1 ? 0 : (1 - f) * .7;
  });
  recherche.tick(dt, now);
  cPos.lerp(cPosV, .05); cCib.lerp(cCibV, .05);
  cam.position.copy(cPos); cam.lookAt(cCib);
  produits.forEach((p, i) => placer(lbls[i], xVoie(i), Math.max(0, yEcart(p.min / p.prix - 1)) + 1.1, 1.3,
    mode === 'marche' && (focus === null || focus === i)));
  rnd.render(scene, cam);
})();
suivre(window, 'resize', () => { cam.aspect = L() / H(); cam.updateProjectionMatrix(); rnd.setSize(L(), H()); });
hudMarche();

// Consigne d'accueil : un client doit savoir quoi faire sans lire la légende.
const minuteur = setTimeout(() => { if (vivant) aide.classList.add('on'); }, 2800);
suivre(root, 'pointerdown', () => aide.classList.remove('on'), { once: true });
  return () => {
    vivant = false;
    if (typeof minuteur !== 'undefined') clearTimeout(minuteur);
    cancelAnimationFrame(rafId);
    recherche.detruire();
    ecouteurs.forEach(([c, t, f, o]) => c.removeEventListener(t, f, o));
    scene.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => m.dispose()); });
    rnd.dispose();
    root.replaceChildren();
  };
}
