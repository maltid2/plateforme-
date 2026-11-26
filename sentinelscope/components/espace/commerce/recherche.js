/* Veille commerce — la vue « Recherche produit ».

   Le client tape un produit ; le moteur interroge la recherche publique de
   chaque boutique de sa liste. Chaque résultat devient un point de lumière :
   - la distance au centre est le prix (échelle logarithmique) : plus c'est
     près, moins c'est cher ;
   - chaque boutique occupe un secteur ;
   - lumineux = en stock, éteint = en rupture ; un fin anneau orange = promo ;
   - la hauteur dit la pertinence : un résultat qui ne contient pas les mots
     cherchés reste bas, il est « approchant ».
   Tout en traits fins et en lumière additive : la vue précédente, faite de
   gros cylindres et d'anneaux épais, faisait jouet. */
import * as THREE from 'three';

const ECHANTILLON = { requete: 'merino socks', boutiques: ['allbirds.com', 'shop.bombas.com', 'www.taylorstitch.com'] };
const CLE = 'ss-veille-boutiques';
const COUL = { stock: 0xB9ADFF, rupture: 0x4A5563, promo: 0xFF9F43, grille: 0x8D7CFF };
const R_MIN = 1.4, R_MAX = 9;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const prixTxt = (v, d) => v == null ? '—' : v.toLocaleString('fr-FR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) + (d ? ' ' + ({ EUR: '€', USD: '$', GBP: '£' }[d] || d) : '');

function textureLueur() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(.25, 'rgba(255,255,255,.45)'); d.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = d; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function creerRecherche({ scene, cam, root, $, L, H, suivre }) {
  const ciel = new THREE.Group(); ciel.visible = false; scene.add(ciel);
  const lueur = textureLueur();
  let decor = new THREE.Group(), points = new THREE.Group(); ciel.add(decor, points);
  let noeuds = [], donnees = null, survol = null, choix = null, tApparition = 0, pause = false;

  /* ---------- interface ---------- */
  root.insertAdjacentHTML('beforeend', `
    <form class="rech cache" id="rech-form" autocomplete="off">
      <div class="rech-ligne">
        <input id="rech-q" type="search" placeholder="Quel produit cherchez-vous ?" aria-label="Produit à chercher" maxlength="120">
        <button type="submit" id="rech-go">Chercher</button>
      </div>
      <div class="rech-opts">
        <button type="button" id="rech-bt-boutiques">Boutiques interrogées</button>
        <button type="button" id="rech-bt-decouvrir">Ce qu'ils vendent et pas moi</button>
        <button type="button" id="rech-bt-exemple">Essayer un exemple</button>
      </div>
      <div class="rech-boutiques cache" id="rech-boutiques">
        <label>Vos concurrents, une boutique Shopify par ligne (8 au plus)
          <textarea id="rech-liste" rows="4" placeholder="boutique-concurrente.fr&#10;autre-boutique.com"></textarea></label>
        <label>Votre boutique (facultatif, pour « ce qu'ils vendent et pas moi »)
          <input id="rech-mienne" placeholder="votre-boutique.fr"></label>
      </div>
      <div class="rech-etat" id="rech-etat" role="status"></div>
    </form>
    <div class="rech-survol" id="rech-survol"></div>
    <div id="rech-lbls" class="cache"></div>`);
  const form = $('rech-form'), etat = $('rech-etat'), survolDiv = $('rech-survol');
  try {
    const memo = JSON.parse(localStorage.getItem(CLE) || 'null');
    if (memo) { $('rech-liste').value = (memo.liste || []).join('\n'); $('rech-mienne').value = memo.mienne || ''; }
  } catch { /* stockage indisponible : on repart vide */ }
  const liste = () => $('rech-liste').value.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).slice(0, 8);
  const memoriser = () => { try { localStorage.setItem(CLE, JSON.stringify({ liste: liste(), mienne: $('rech-mienne').value.trim() })); } catch { /* idem */ } };

  $('rech-bt-boutiques').onclick = () => $('rech-boutiques').classList.toggle('cache');
  $('rech-bt-exemple').onclick = () => {
    $('rech-liste').value = ECHANTILLON.boutiques.join('\n'); $('rech-q').value = ECHANTILLON.requete;
    lancer('recherche');
  };
  $('rech-bt-decouvrir').onclick = () => lancer('analyse');
  form.onsubmit = (e) => { e.preventDefault(); lancer('recherche'); };

  async function lancer(action) {
    const boutiques = liste();
    if (!boutiques.length) {
      $('rech-boutiques').classList.remove('cache');
      etat.textContent = "Indiquez d'abord les boutiques à interroger : une par ligne.";
      return;
    }
    const requete = $('rech-q').value.trim();
    if (action === 'recherche' && requete.length < 2) { etat.textContent = 'Tapez le produit que vous cherchez.'; $('rech-q').focus(); return; }
    memoriser();
    etat.textContent = action === 'recherche'
      ? `Recherche de « ${requete} » dans ${boutiques.length} boutique${boutiques.length > 1 ? 's' : ''}…`
      : `Lecture des catalogues de ${boutiques.length} boutique${boutiques.length > 1 ? 's' : ''}…`;
    form.classList.add('occupe');
    try {
      const r = await fetch('/api/commerce', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, requete, boutiques, maBoutique: $('rech-mienne').value.trim() || undefined }),
      });
      const d = await r.json();
      if (!r.ok) { etat.textContent = d.error || 'La recherche a échoué.'; return; }
      afficher(action === 'recherche' ? depuisRecherche(d) : depuisAnalyse(d));
    } catch {
      etat.textContent = 'Le service ne répond pas. Réessayez dans un instant.';
    } finally {
      form.classList.remove('occupe');
    }
  }

  /* ---------- deux sources, une seule forme ---------- */
  function depuisRecherche(d) {
    const pertinents = d.resultats.filter((x) => x.pertinence >= .5).length;
    return {
      type: 'recherche', titre: `« ${d.requete} »`,
      sous: `${d.boutiques.filter((b) => b.statut === 'ok').length} boutiques interrogées · ${d.resume.trouves} résultats, dont ${pertinents} contiennent tous vos mots`,
      resume: d.resume, boutiques: d.boutiques, devises: d.resume.devises,
      items: d.resultats.map((x) => ({ ...x, secteur: x.domaine })),
    };
  }
  function depuisAnalyse(d) {
    return {
      type: 'analyse', titre: "Ce qu'ils vendent, et pas vous",
      sous: `${d.produitsLus} produits lus dans ${d.boutiques.filter((b) => b.statut === 'ok' && !b.mienne).length} boutiques · ${d.pistes.length} pistes`,
      boutiques: d.boutiques, devises: d.devises,
      resume: null,
      // Une piste n'a pas de boutique unique : on la range par nombre de
      // boutiques qui la vendent, et sa hauteur dit la force des indices.
      items: d.pistes.map((p) => ({
        titre: p.titre, prix: p.prixMedian, dispo: true, remise: 0, pertinence: Math.min(1, p.force / 2.4),
        boutique: `${p.boutiques} boutique${p.boutiques > 1 ? 's' : ''}`, secteur: `${p.boutiques} boutique${p.boutiques > 1 ? 's' : ''}`,
        devise: d.devises.length === 1 ? d.devises[0] : null, indices: p.indices, exemples: p.exemples,
      })),
    };
  }

  /* ---------- construction de la scène ---------- */
  function vider(g) {
    g.traverse((o) => { o.geometry?.dispose(); [].concat(o.material || []).forEach((m) => m.dispose()); });
    ciel.remove(g);
  }
  function anneau(r, opacite) {
    const pts = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: COUL.grille, transparent: true, opacity: opacite }));
  }

  function afficher(d) {
    donnees = d; choix = null; survol = null;
    $('panneau').classList.remove('on');   // la fiche du résultat précédent n'a plus de sens
    vider(decor); vider(points);
    decor = new THREE.Group(); points = new THREE.Group(); ciel.add(decor, points);
    $('rech-lbls').innerHTML = ''; noeuds = [];
    const items = d.items.filter((x) => x.prix > 0);

    const prix = items.map((x) => x.prix);
    const lo = Math.min(...prix), hi = Math.max(...prix);
    const rayon = (p) => hi > lo ? R_MIN + (R_MAX - R_MIN) * (Math.log(p) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)) : (R_MIN + R_MAX) / 2;
    const devise = d.devises && d.devises.length === 1 ? d.devises[0] : null;

    // Échelle : quatre anneaux de prix, étiquetés côté caméra.
    const graduations = hi > lo ? [0, 1 / 3, 2 / 3, 1].map((t) => Math.exp(Math.log(lo) + t * (Math.log(hi) - Math.log(lo)))) : [lo];
    const etiquettes = [];
    graduations.forEach((p, i) => {
      decor.add(anneau(rayon(p), i === 0 ? .32 : .14));
      etiquettes.push({ pos: new THREE.Vector3(0, .02, rayon(p)), html: prixTxt(Math.round(p), devise), classe: 'echelle' });
    });

    // Secteurs : un par boutique (ou par nombre de boutiques en analyse).
    const secteurs = [...new Set(items.map((x) => x.secteur))];
    const part = Math.PI * 2 / Math.max(secteurs.length, 1);
    secteurs.forEach((s, k) => {
      const a = -Math.PI / 2 + k * part;
      const trait = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(a - part / 2) * R_MIN * .6, 0, Math.sin(a - part / 2) * R_MIN * .6),
        new THREE.Vector3(Math.cos(a - part / 2) * (R_MAX + .8), 0, Math.sin(a - part / 2) * (R_MAX + .8))]),
        new THREE.LineBasicMaterial({ color: COUL.grille, transparent: true, opacity: secteurs.length > 1 ? .12 : 0 }));
      decor.add(trait);
      const nom = d.type === 'recherche' ? (items.find((x) => x.secteur === s)?.boutique || s) : s;
      etiquettes.push({ pos: new THREE.Vector3(Math.cos(a) * (R_MAX + 1.3), .02, Math.sin(a) * (R_MAX + 1.3)), html: esc(nom), classe: 'secteur' });
    });

    // Les points.
    const parSecteur = {};
    items.forEach((x, n) => {
      const k = secteurs.indexOf(x.secteur);
      const rang = (parSecteur[x.secteur] = (parSecteur[x.secteur] || 0) + 1) - 1;
      const total = items.filter((y) => y.secteur === x.secteur).length;
      const a = -Math.PI / 2 + k * part + ((rang + .5) / total - .5) * part * .78;
      const r = rayon(x.prix), h = .35 + 2.6 * Math.max(0, Math.min(1, x.pertinence));
      const g = new THREE.Group(); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      const couleur = x.dispo ? COUL.stock : COUL.rupture;
      const fil = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, h, 0)]),
        new THREE.LineBasicMaterial({ color: couleur, transparent: true, opacity: x.dispo ? .35 : .18 }));
      g.add(fil);
      const pied = new THREE.Mesh(new THREE.RingGeometry(.05, .08, 20), new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: .6, side: THREE.DoubleSide }));
      pied.rotation.x = -Math.PI / 2; pied.position.y = .01; g.add(pied);
      const tete = new THREE.Group(); tete.position.y = h; g.add(tete);
      const coeur = new THREE.Mesh(new THREE.SphereGeometry(x.dispo ? .085 : .07, 16, 12), new THREE.MeshBasicMaterial({ color: x.dispo ? 0xffffff : 0x6B7684 }));
      tete.add(coeur);
      if (x.dispo) {
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: lueur, color: couleur, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
        halo.scale.setScalar(.75); tete.add(halo);
      } else {
        const creux = new THREE.Mesh(new THREE.TorusGeometry(.13, .012, 6, 28), new THREE.MeshBasicMaterial({ color: 0x6B7684 }));
        tete.add(creux);
      }
      if (x.remise >= .05) {
        const promo = new THREE.Mesh(new THREE.TorusGeometry(.22, .014, 6, 36), new THREE.MeshBasicMaterial({ color: COUL.promo, transparent: true, opacity: .9 }));
        tete.add(promo);
      }
      // Cible de clic invisible : on vise un produit, pas un pixel.
      const cible = new THREE.Mesh(new THREE.SphereGeometry(.32, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      cible.userData.n = n; tete.add(cible);
      g.userData = { x, h, tete, cible, retard: (r / R_MAX) * .9 + (n % 7) * .03 };
      points.add(g); noeuds.push(g);
    });

    // Étiquettes HTML (échelle, secteurs).
    for (const e of etiquettes) {
      const el = document.createElement('div'); el.className = 'lbl3d rech-lbl ' + e.classe; el.innerHTML = e.html;
      $('rech-lbls').appendChild(el); e.el = el;
    }
    decor.userData.etiquettes = etiquettes;
    tApparition = performance.now();
    hud();
  }

  /* ---------- HUD ---------- */
  function hud() {
    const titre = $('titre'), sous = $('soustitre');
    if (!donnees) {
      titre.textContent = 'Trouver un produit chez vos concurrents';
      sous.textContent = 'Tapez un produit : le moteur le cherche dans chaque boutique de votre liste.';
      $('compteurs').innerHTML = '';
      $('liste-titre').textContent = 'Résultats';
      $('liste').innerHTML = '<div class="vide">Aucune recherche pour l\'instant.</div>';
      $('legende').innerHTML = legende();
      etat.textContent = '';
      return;
    }
    const d = donnees;
    titre.textContent = d.titre; sous.textContent = d.sous;
    const cpt = (v, l, c = '#F5F7FA') => `<div class="cpt"><b style="color:${c}">${v}</b><span>${l}</span></div>`;
    const devise = d.devises && d.devises.length === 1 ? d.devises[0] : null;
    // Les compteurs décrivent ce que la scène montre : tous les résultats, pas
    // seulement les pertinents — sinon on lit « 1 promotion » sous dix anneaux orange.
    if (d.type === 'recherche' && devise) {
      const ps = d.items.map((x) => x.prix).sort((a, b) => a - b);
      const med = ps.length % 2 ? ps[(ps.length - 1) / 2] : (ps[ps.length / 2 - 1] + ps[ps.length / 2]) / 2;
      $('compteurs').innerHTML = cpt(prixTxt(ps[0], devise), 'Le moins cher', '#3DDC97') + cpt(prixTxt(Math.round(med * 100) / 100, devise), 'Prix médian')
        + cpt(`${d.items.filter((x) => x.dispo).length}/${d.items.length}`, 'En stock', '#B9ADFF') + cpt(`${d.items.filter((x) => x.remise >= .05).length}`, 'En promotion', '#FF9F43');
    } else if (d.type === 'recherche') {
      $('compteurs').innerHTML = cpt(d.resume.trouves, 'Résultats') + cpt(d.resume.devises.length, 'Devises différentes', '#FFD166');
    } else {
      $('compteurs').innerHTML = cpt(d.items.length, 'Pistes') + cpt(d.items.filter((x) => x.indices.some((i) => i.fort)).length, 'Avec un indice fort', '#3DDC97');
    }
    const tries = [...d.items.keys()].sort((a, b) => d.type === 'recherche'
      ? (d.items[b].pertinence >= .5) - (d.items[a].pertinence >= .5) || d.items[a].prix - d.items[b].prix
      : d.items[b].pertinence - d.items[a].pertinence);
    $('liste-titre').textContent = d.type === 'recherche' ? 'Du moins cher au plus cher' : 'Pistes, par force des indices';
    $('liste').innerHTML = tries.slice(0, 40).map((n) => {
      const x = d.items[n];
      const tags = (x.pertinence < .5 && d.type === 'recherche' ? '<em>approchant</em>' : '') + (!x.dispo ? '<em class="rupt">rupture</em>' : '') + (x.remise >= .05 ? `<em class="promo">−${Math.round(x.remise * 100)} %</em>` : '');
      return `<div class="ligne ${n === choix ? 'on' : ''}" data-n="${n}"><span class="rt">${esc(x.titre)}<small>${esc(x.boutique)} ${tags}</small></span><b class="rp">${prixTxt(x.prix, x.devise)}</b></div>`;
    }).join('') || '<div class="vide">Aucun résultat.</div>';
    root.querySelectorAll('#liste .ligne').forEach((el) => {
      el.onclick = () => fiche(+el.dataset.n);
      el.onmouseenter = () => { survol = noeuds[+el.dataset.n] || null; };
      el.onmouseleave = () => { survol = null; };
    });
    $('legende').innerHTML = legende(d);
    const ko = d.boutiques.filter((b) => b.statut !== 'ok');
    etat.innerHTML = ko.length ? ko.map((b) => `<span>${esc(b.domaine)} : ${esc(b.message)}</span>`).join('') : '';
  }
  function legende(d) {
    const melange = d && d.devises && d.devises.length > 1;
    return `<div class="tt">Lecture</div>
      <div><i style="background:#B9ADFF"></i>Point lumineux : en stock</div>
      <div><i style="background:#4A5563"></i>Point éteint : en rupture</div>
      <div><i style="background:#FF9F43"></i>Anneau orange : en promotion</div>
      <div><i style="background:linear-gradient(90deg,#8D7CFF,transparent)"></i>Près du centre : moins cher</div>
      <div><i style="background:#8D7CFF55"></i>${d && d.type === 'analyse' ? 'Hauteur : force des indices' : 'Hauteur : contient tous vos mots'}</div>
      ${melange ? '<div class="avert"><b>Devises différentes.</b> Les prix sont affichés tels que chaque boutique les publie, sans conversion : comparez-les avec prudence.</div>' : ''}
      ${d && d.type === 'analyse' ? '<div class="avert"><b>Pas de ventes affichées.</b> Aucune boutique ne publie ses volumes : ce sont des indices, pas une demande mesurée.</div>' : ''}`;
  }

  function fiche(n) {
    const x = donnees.items[n]; choix = n;
    root.querySelectorAll('#liste .ligne').forEach((el) => el.classList.toggle('on', +el.dataset.n === n));
    const lien = (u, t) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow">${t} ↗</a>`;
    $('p-corps').innerHTML = donnees.type === 'recherche'
      ? `<span class="kind">${esc(x.boutique)}</span><h2>${esc(x.titre)}</h2>
         <div class="sous">${prixTxt(x.prix, x.devise)}${x.prixMax > x.prix ? ' à ' + prixTxt(x.prixMax, x.devise) + ' selon la variante' : ''}</div>
         <div class="sec">Ce qu'on en voit</div>
         <div class="rang"><span>Disponibilité</span><span class="m">${x.dispo ? 'en stock' : 'en rupture'}</span></div>
         <div class="rang"><span>Promotion</span><span class="m">${x.remise >= .05 ? '−' + Math.round(x.remise * 100) + ' % sur le prix barré' : 'aucune'}</span></div>
         <div class="rang"><span>Correspondance</span><span class="m">${x.pertinence >= .99 ? 'tous vos mots' : x.pertinence >= .5 ? 'la plupart de vos mots' : 'approchant'}</span></div>
         <p>${lien(x.url, 'Voir la fiche sur la boutique')}</p>`
      : `<span class="kind">Piste</span><h2>${esc(x.titre)}</h2>
         <div class="sous">prix médian ${prixTxt(x.prix, x.devise)} · ${esc(x.boutique)}</div>
         <div class="sec">Indices observés</div>
         ${x.indices.map((i) => `<span class="ind ${i.fort ? 'fort' : ''}">${esc(i.texte)}</span>`).join('')}
         <div class="sec">Où on le trouve</div>
         ${x.exemples.map((e) => `<div class="rang"><span>${esc(e.boutique)}</span><span class="m">${prixTxt(e.prix, x.devise)} · ${lien(e.url, 'voir')}</span></div>`).join('')}
         <div class="avert"><b>Ce n'est pas un volume de ventes.</b> Ces indices viennent des vitrines publiques : ils suggèrent une demande, ils ne la mesurent pas.</div>`;
    $('panneau').classList.add('on');
  }

  /* ---------- pointeur ---------- */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  const viser = (e) => {
    ptr.set(e.clientX / L() * 2 - 1, -(e.clientY / H()) * 2 + 1);
    ray.setFromCamera(ptr, cam);
    const h = ray.intersectObjects(noeuds.map((g) => g.userData.cible))[0];
    return h ? h.object.userData.n : -1;
  };

  /* ---------- boucle ---------- */
  const _v = new THREE.Vector3();
  function placer(el, monde, visible) {
    _v.copy(monde).project(cam);
    const ok = visible && _v.z < 1 && Math.abs(_v.x) < 1.05 && Math.abs(_v.y) < 1.05;
    el.style.opacity = ok ? '' : '0';
    el.style.left = ((_v.x + 1) / 2 * L()) + 'px';
    el.style.top = ((1 - _v.y) / 2 * H()) + 'px';
  }

  return {
    groupe: ciel,
    montrer(oui) {
      ciel.visible = oui;
      form.classList.toggle('cache', !oui);
      $('rech-lbls').classList.toggle('cache', !oui);
      survolDiv.classList.remove('on');
      if (oui) hud();
    },
    survoler(e) {
      if (e.target.closest('.ui,.panneau,.rech')) { survolDiv.classList.remove('on'); return false; }
      const n = viser(e);
      survol = n >= 0 ? noeuds[n] : null;
      pause = !!survol;
      if (survol) {
        const x = survol.userData.x;
        survolDiv.innerHTML = `<b>${esc(x.titre)}</b>${prixTxt(x.prix, x.devise)} · ${esc(x.boutique)}`;
        survolDiv.style.left = e.clientX + 'px'; survolDiv.style.top = (e.clientY - 18) + 'px';
        survolDiv.classList.add('on');
      } else survolDiv.classList.remove('on');
      return !!survol;
    },
    cliquer(e) {
      if (e.target.closest('.ui,.panneau,.rech')) return;
      const n = viser(e);
      if (n >= 0) fiche(n);
    },
    tick(dt, now) {
      if (!ciel.visible) return;
      // Rotation très lente : la scène respire, elle s'arrête quand on vise.
      if (!pause) ciel.rotation.y += dt * .035;
      const t = (now - tApparition) / 1000;
      for (const g of noeuds) {
        const u = g.userData;
        const k = Math.min(Math.max((t - u.retard) / .9, 0), 1), e = 1 - Math.pow(1 - k, 3);
        const vise = g === survol || (choix !== null && noeuds[choix] === g);
        u.tete.position.y = u.h * e;
        u.tete.scale.setScalar((vise ? 1.6 : 1) * Math.max(e, .001));
        g.children[0].scale.y = Math.max(e, .001);
      }
      for (const lab of decor.userData.etiquettes || []) placer(lab.el, ciel.localToWorld(_v.copy(lab.pos)).clone(), true);
    },
    cameraVue: { pos: new THREE.Vector3(1.5, 12.5, 20.5), cible: new THREE.Vector3(1.5, .2, 0) },
    detruire() { vider(decor); vider(points); lueur.dispose(); },
    hud,
  };
}
