import * as THREE from 'three';
import { AGENTS, OUTILS, RISQUES, SEV, CONSTATS, CIBLE } from './data.js';

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
  root.insertAdjacentHTML('afterbegin', '<div class="ui tete">\n  <span class="marque"><i></i>AgentShield · audit</span>\n  <h1 id="titre">Surface déclarée</h1>\n  <p id="soustitre"></p>\n  <button class="retour" id="retour">← Revenir à la vue d\'ensemble</button>\n</div>\n<div class="ui compteurs" id="compteurs"></div>\n<div class="ui journal"><div class="tt">Constats de l\'analyse</div><div id="journal"></div></div>\n<div class="lbl" id="lbl"></div>\n<div class="panneau" id="panneau"><button class="x" id="x">×</button>\n  <span class="kind" id="p-kind"></span><h2 id="p-nom"></h2><div class="sous" id="p-sous"></div>\n  <div id="p-corps"></div></div>\n<span class="demo">Relevé de démonstration · analyse de configuration</span>');
/* AgentShield Audit — la scène.

   Grammaire volontairement opposée à celle du jumeau 3D : pas de sol, pas
   de projection isométrique, pas de mobilier. Une caméra en perspective,
   un anneau d'agents, un noyau d'outils, et entre les deux la barrière.

   Ce qui est dessiné n'est pas du trafic observé : ce sont les chemins que
   la configuration AUTORISE. La barrière n'existe qu'aux niveaux où une
   règle existe ; partout ailleurs, elle est en pointillé et tout passe au
   travers. C'est le constat central du produit, donc la géométrie le porte. */

const C = { bg:0x06080C, acc:0x8D7CFF, metal:0x2A3340, sourd:0x5E6B7D };
const R_AGENT = 8.0, R_BARRIERE = 4.8, R_NOYAU = 1.6;
const RC = r => RISQUES[r].couleur;

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.bg);
scene.fog = new THREE.FogExp2(C.bg, 0.022);
const cam = new THREE.PerspectiveCamera(42, L()/H(), 0.1, 300);
const rnd = new THREE.WebGLRenderer({ antialias:true });
rnd.setPixelRatio(Math.min(devicePixelRatio,2));
rnd.setSize(L(), H());
root.appendChild(rnd.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 1.0));
const k = new THREE.DirectionalLight(0xffffff, 1.2); k.position.set(6,14,10); scene.add(k);
const pl = new THREE.PointLight(C.acc, 55, 40); pl.position.set(0,4,0); scene.add(pl);

const M  = (c,e=0,ei=0)=>new THREE.MeshLambertMaterial({color:c,emissive:e,emissiveIntensity:ei});
const MB = (c,o=1)=>new THREE.MeshBasicMaterial({color:c,transparent:o<1,opacity:o});
const mesh = (g,m)=>new THREE.Mesh(g,m);
const V = (x,y,z)=>new THREE.Vector3(x,y,z);
const P = (m,x,y,z)=>{m.position.set(x,y,z);return m;};

/* ---------- le noyau : les outils ---------- */
const noyau = new THREE.Group(); scene.add(noyau);
const outils = OUTILS.map(o => {
  const g = new THREE.Group(); g.position.y = o.y;
  const anneau = mesh(new THREE.TorusGeometry(R_NOYAU, .17, 10, 44), M(0x1B2430, RC(o.risque), .55));
  anneau.rotation.x = Math.PI/2; g.add(anneau);
  g.add(mesh(new THREE.CylinderGeometry(R_NOYAU-.18, R_NOYAU-.18, .3, 36), M(0x151C26)));
  const n = o.risque==='critique'?3:o.risque==='eleve'?2:1;      // encoches : le risque sans légende
  for (let i=0;i<n;i++){
    const a = -0.22 + i*0.22;
    const e = mesh(new THREE.BoxGeometry(.1,.1,.34), MB(RC(o.risque), .9));
    e.position.set(Math.sin(a)*(R_NOYAU+.1), 0, Math.cos(a)*(R_NOYAU+.1));
    e.lookAt(0,0,0); g.add(e);
  }
  const halo = mesh(new THREE.TorusGeometry(R_NOYAU+.3, .05, 8, 44), MB(RC(o.risque), 0));
  halo.rotation.x = Math.PI/2; halo.userData.estHalo = true; g.add(halo);
  g.userData = { outil:o, halo };
  noyau.add(g);
  return g;
});
const colonne = mesh(new THREE.CylinderGeometry(.3,.3,7.6,14), M(0x101722, C.acc, .18));
colonne.position.y = 3.65; noyau.add(colonne);

/* ---------- la barrière : un anneau par niveau, seulement s'il y a une règle ---------- */
const barriere = new THREE.Group(); scene.add(barriere);
OUTILS.forEach(o => {
  if (o.regle) {
    const t = mesh(new THREE.TorusGeometry(R_BARRIERE, .07, 10, 80), MB(0x3DDC97, .8));
    t.rotation.x = Math.PI/2; t.position.y = o.y; barriere.add(t);
    const bande = mesh(new THREE.CylinderGeometry(R_BARRIERE, R_BARRIERE, .85, 64, 1, true),
      new THREE.MeshBasicMaterial({ color:0x3DDC97, transparent:true, opacity:.14, side:THREE.DoubleSide, depthWrite:false }));
    bande.position.y = o.y; barriere.add(bande);
  } else {
    const n = 44;
    for (let i=0;i<n;i++){
      if (i % 2) continue;                       // un segment sur deux : le vide se voit
      const a0 = (i/n)*Math.PI*2;
      const arc = mesh(new THREE.TorusGeometry(R_BARRIERE, .038, 6, 4, (Math.PI*2)/n*0.8), MB(C.sourd, .5));
      arc.rotation.x = Math.PI/2; arc.rotation.z = -a0; arc.position.y = o.y;
      barriere.add(arc);
    }
  }
});
for (let i=0;i<24;i++){                          // montants : où la barrière pourrait être
  const a = i/24*Math.PI*2;
  const m = mesh(new THREE.BoxGeometry(.02,7.4,.02), MB(C.acc, .035));
  m.position.set(Math.cos(a)*R_BARRIERE, 3.7, Math.sin(a)*R_BARRIERE);
  barriere.add(m);
}

/* ---------- les agents ---------- */
function personnage(){
  const g = new THREE.Group();
  g.add(P(mesh(new THREE.CapsuleGeometry(.3,.62,6,12), M(0x303B4A)), 0,1.26,0));
  g.add(P(mesh(new THREE.SphereGeometry(.26,16,12), M(0x3C4A5C)), 0,1.98,0));
  [-.42,.42].forEach(x=>g.add(P(mesh(new THREE.CapsuleGeometry(.1,.5,4,8), M(0x2A3340)), x,1.3,0)));
  g.add(P(mesh(new THREE.CylinderGeometry(.62,.72,.18,20), M(0x1A222E)), 0,.09,0));
  return g;
}
// La pastille au sol porte le risque le plus élevé que l'agent peut atteindre.
const ORDRE = ['critique','eleve','faible'];
const pire = a => a.outils.map(id=>OUTILS.find(o=>o.id===id).risque).sort((x,y)=>ORDRE.indexOf(x)-ORDRE.indexOf(y))[0];

const agents = AGENTS.map((a,i) => {
  const ang = (i/AGENTS.length)*Math.PI*2 + Math.PI/AGENTS.length;
  const g = personnage();
  g.position.set(Math.cos(ang)*R_AGENT, 0, Math.sin(ang)*R_AGENT);
  g.lookAt(0, 1.2, 0);
  const anneau = mesh(new THREE.TorusGeometry(.84,.055,8,30), MB(RC(pire(a)), .95));
  anneau.rotation.x = Math.PI/2; anneau.position.y = .02; g.add(anneau);
  const halo = mesh(new THREE.CylinderGeometry(1.15,1.15,2.6,18,1,true),
    new THREE.MeshBasicMaterial({color:RC(pire(a)),transparent:true,opacity:0,side:THREE.BackSide,depthWrite:false}));
  halo.userData.estHalo = true; halo.position.y = 1.3; g.add(halo);
  g.userData = { agent:a, halo, ang, prise:V(Math.cos(ang)*(R_AGENT-.9), 1.5, Math.sin(ang)*(R_AGENT-.9)) };
  scene.add(g);
  return g;
});

/* ---------- les chemins ---------- */
const chemins = [];
agents.forEach(ga => {
  const a = ga.userData.agent;
  a.outils.forEach((idOutil, n) => {
    const o = OUTILS.find(x=>x.id===idOutil);
    const ang = ga.userData.ang, col = RC(o.risque);
    const arrete = !!o.regle;                 // une règle est la seule chose qui arrête un chemin
    const rFin = arrete ? R_BARRIERE - .05 : R_NOYAU + .2;
    const depart = ga.userData.prise.clone();
    const pts = [], etapes = 26;
    for (let i=0;i<=etapes;i++){
      const t = i/etapes;
      const r = depart.length() + (rFin - depart.length())*t;
      const da = ang + Math.sin(t*Math.PI)*(0.1 + n*0.055)*(n%2?1:-1);
      const y = depart.y + (o.y - depart.y)*t + Math.sin(t*Math.PI)*0.5;
      pts.push(V(Math.cos(da)*r, y, Math.sin(da)*r));
    }
    const courbe = new THREE.CatmullRomCurve3(pts);
    // Un chemin ouvert vers un outil critique est le titre du rapport : trait le plus lourd.
    const poids = { faible:.026, eleve:.04, critique:.055 }[o.risque];
    const encre = { faible:.22,  eleve:.4,  critique:.6  }[o.risque];
    const tube = mesh(new THREE.TubeGeometry(courbe, 60, arrete?.045:poids, 6, false),
      new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:arrete?.5:encre}));
    scene.add(tube);
    const pulse = mesh(new THREE.SphereGeometry(arrete?.13:poids*2.6,10,8), MB(col,.95));
    scene.add(pulse);
    let impact = null;
    if (arrete) {
      impact = new THREE.Group();
      const disque = mesh(new THREE.CircleGeometry(.5,24), new THREE.MeshBasicMaterial({color:0x3DDC97,transparent:true,opacity:.8,
        side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));
      const cercle = mesh(new THREE.RingGeometry(.62,.74,30), new THREE.MeshBasicMaterial({color:0x3DDC97,transparent:true,opacity:.9,
        side:THREE.DoubleSide,depthWrite:false}));
      impact.add(disque); impact.add(cercle);
      impact.userData = { disque, cercle };
      const p = courbe.getPoint(1);
      impact.position.copy(p); impact.lookAt(0, p.y, 0);
      scene.add(impact);
    }
    chemins.push({ courbe, tube, pulse, impact, arrete, encre, agent:a, outil:o, phase: Math.random(), vitesse: 0.2 });
  });
});

/* ---------- interface ---------- */
const nbRegles  = OUTILS.filter(o=>o.regle).length;
const critLibre = OUTILS.filter(o=>o.risque==='critique' && !o.regle).length;
$('compteurs').innerHTML = [
  [chemins.length, 'Chemins ouverts', '#F5F7FA'],
  [nbRegles,  'Règle en place',  '#3DDC97'],
  [critLibre, 'Critiques sans contrôle', '#FF5B5B'],
].map(([n,l,c]) => `<div class="cpt"><b style="color:${c}">${n}</b><span>${l}</span></div>`).join('');
const sousTitre = `${CIBLE} · ${AGENTS.length} agents déclarés · ${OUTILS.length} outils atteignables · ${CONSTATS.length} constats`;
$('soustitre').textContent = sousTitre;

const rang = { crit:0, haut:1, moy:2 };
const listeConstats = [...CONSTATS].sort((a,b)=>rang[a.sev]-rang[b.sev]);
$('journal').innerHTML = listeConstats.map((c,i) => `
  <div class="ligne" data-i="${i}"><span class="q" style="background:${SEV[c.sev].css}"></span>
    <span class="t"><b>${c.titre}</b> · ${c.ou}</span></div>`).join('');
[...$('journal').children].forEach(d => d.onclick = () => {
  const c = listeConstats[+d.dataset.i];
  const g = c.agent && agents.find(x => x.userData.agent.id === c.agent);
  if (g) viser(g); else ficheConstat(c);
});

function blocConstat(c){
  return `<div class="appel"><div class="l"><span class="o">${c.titre}</span>
    <span class="badge" style="background:${SEV[c.sev].css}22;color:${SEV[c.sev].css}">${SEV[c.sev].label}</span></div>
    <p>${c.txt}</p><div class="q">${c.ou}</div></div>`;
}
function ficheAgent(a){
  const siens = CONSTATS.filter(c => c.agent === a.id);
  $('p-kind').textContent = 'Agent déclaré';
  $('p-nom').textContent = a.nom;
  $('p-sous').textContent = `${a.modele} · ${a.source}`;
  $('p-corps').innerHTML = `<div class="sec">Outils atteignables</div>` +
    a.outils.map(id => { const o = OUTILS.find(x=>x.id===id), R = RISQUES[o.risque];
      return `<div class="appel"><div class="l"><span class="o">${o.nom}</span>
        <span class="badge" style="background:${R.css}22;color:${R.css}">${R.label}</span></div>
        <p>${o.regle ? 'Une règle encadre cet outil.' : "Aucune règle n'encadre cet outil : le chemin est ouvert."}</p></div>`;
    }).join('') + (siens.length ? `<div class="sec">Constats</div>` + siens.map(blocConstat).join('') : '');
  $('panneau').classList.add('on');
}
function ficheOutil(o){
  const qui = AGENTS.filter(a => a.outils.includes(o.id));
  const R = RISQUES[o.risque];
  $('p-kind').textContent = 'Outil atteignable';
  $('p-nom').textContent = o.nom;
  $('p-sous').textContent = `risque ${R.label.toLowerCase()} · ${qui.length} agents y accèdent`;
  $('p-corps').innerHTML = `<div class="sec">Règle en place</div>` +
    (o.regle ? `<div class="appel"><p>${o.regle}</p></div>`
      : `<div class="appel"><div class="l"><span class="o">Aucune</span>
         <span class="badge" style="background:#FF5B5B22;color:#FF5B5B">Non contrôlé</span></div>
         <p>Rien dans la configuration ne restreint cet outil. Tout agent qui le déclare l'atteint sans condition et sans trace.</p></div>`) +
    `<div class="sec">Qui l'atteint</div>` +
    qui.map(a => `<div class="appel"><div class="l"><span class="o">${a.nom}</span></div><div class="q">${a.source}</div></div>`).join('');
  $('panneau').classList.add('on');
}
function ficheConstat(c){
  $('p-kind').textContent = 'Constat';
  $('p-nom').textContent = c.titre;
  $('p-sous').textContent = c.ou;
  $('p-corps').innerHTML = `<div class="appel"><p>${c.txt}</p></div>`;
  $('panneau').classList.add('on');
}
$('x').onclick = () => $('panneau').classList.remove('on');

/* ---------- caméra ---------- */
const cPos = V(14.5,12.5,20.5), cCib = V(0,2.5,0), cPosV = cPos.clone(), cCibV = cCib.clone();
function vueFlotte(){
  souligner(null);
  cPosV.set(14.5,12.5,20.5); cCibV.set(0,2.5,0);
  $('retour').classList.remove('on');
  $('titre').textContent = 'Surface déclarée';
  $('soustitre').textContent = sousTitre;
}
function viser(g){
  const p = g.position, d = p.clone().normalize();
  cPosV.copy(p).add(d.clone().multiplyScalar(10)).add(V(0,3.6,0));
  cCibV.set(p.x*0.55, 3.0, p.z*0.55);
  $('retour').classList.add('on');
  $('titre').textContent = g.userData.agent.nom;
  $('soustitre').textContent = g.userData.agent.source;
  ficheAgent(g.userData.agent);
  souligner(g.userData.agent);
}
// Focaliser n'est pas un zoom : ce qui ne concerne pas l'agent choisi s'efface.
function souligner(a){
  chemins.forEach(x => {
    const sien = !a || x.agent === a;
    const base = x.arrete ? .5 : x.encre;
    x.tube.material.opacity  = sien ? base + .22 : base * .14;
    x.pulse.material.opacity = sien ? .95 : .1;
    if (x.impact) x.impact.visible = sien || !a;
  });
  agents.forEach(g => g.traverse(o => {
    if (o.material && !o.userData.estHalo) {
      o.material.transparent = true;
      o.material.opacity = (!a || g.userData.agent === a) ? 1 : .22;
    }
  }));
}
$('retour').onclick = () => { vueFlotte(); $('panneau').classList.remove('on'); };

/* ---------- pointeur ---------- */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
let survol = null;
const lbl = $('lbl');
suivre(root, 'pointermove', e => {
  ptr.x = (e.clientX/L())*2-1; ptr.y = -(e.clientY/H())*2+1;
  ray.setFromCamera(ptr, cam);
  const hit = ray.intersectObjects([...agents, ...outils], true)[0];
  let g = null;
  if (hit){ let o = hit.object; while (o && !o.userData.agent && !o.userData.outil) o = o.parent; g = o; }
  if (g !== survol){
    if (survol) survol.userData.halo.material.opacity = 0;
    survol = g;
    if (survol){
      survol.userData.halo.material.opacity = survol.userData.agent ? .12 : .8;
      lbl.textContent = survol.userData.agent ? survol.userData.agent.nom : survol.userData.outil.nom;
      lbl.classList.add('on'); root.style.cursor = 'pointer';
    } else { lbl.classList.remove('on'); root.style.cursor = 'default'; }
  }
  if (survol){ lbl.style.left = e.clientX+'px'; lbl.style.top = (e.clientY-32)+'px'; }
});
suivre(root, 'click', e => {
  if (e.target.closest('.ui,.panneau')) return;
  if (!survol) return;
  if (survol.userData.agent) viser(survol); else ficheOutil(survol.userData.outil);
});

/* ---------- boucle ---------- */
let t0 = performance.now();
(function boucle(){
  if (!vivant) return; rafId = requestAnimationFrame(boucle);
  const now = performance.now(), dt = Math.min((now-t0)/1000,.05); t0 = now;
  chemins.forEach(x => {
    x.phase = (x.phase + dt*x.vitesse) % 1;
    x.courbe.getPoint(x.phase, x.pulse.position);
    if (x.arrete) x.pulse.material.opacity = x.phase > .88 ? (1-x.phase)/.12 : .95;
    if (x.impact){
      const bat = .45 + Math.sin(now/280)*.18 + (x.phase>.9?.35:0);
      x.impact.userData.disque.material.opacity = bat*.7;
      x.impact.userData.cercle.material.opacity = Math.min(1,bat);
    }
  });
  noyau.rotation.y += dt*.08;
  barriere.rotation.y -= dt*.012;
  cPos.lerp(cPosV,.06); cCib.lerp(cCibV,.06);
  cam.position.copy(cPos); cam.lookAt(cCib);
  rnd.render(scene, cam);
})();
suivre(window, 'resize', () => {
  cam.aspect = L()/H(); cam.updateProjectionMatrix();
  rnd.setSize(L(), H());
});
  return () => {
    vivant = false;
    cancelAnimationFrame(rafId);
    ecouteurs.forEach(([c, t, f, o]) => c.removeEventListener(t, f, o));
    scene.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => m.dispose()); });
    rnd.dispose();
    root.replaceChildren();
  };
}
