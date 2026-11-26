/**
 * Moteur de veille commerce — lecture des catalogues Shopify publics.
 *
 * Toute boutique Shopify publie son catalogue à /products.json et sa fiche
 * à /meta.json, sans connexion. On n'utilise que ça : prix, stock par
 * variante, prix barrés, dates de mise en ligne. Aucune donnée client,
 * aucune connexion à un compte, aucun contournement.
 *
 * Règles de lecture :
 * - on respecte robots.txt : si le chemin est interdit, on ne lit pas ;
 * - on s'identifie (User-Agent nommé, avec l'adresse du site) ;
 * - on lit peu : au plus PAGES_MAX pages de 250 produits par boutique ;
 * - chaque saut de redirection repasse par le garde anti-SSRF, sinon une
 *   boutique « publique » pourrait rediriger le serveur vers une adresse
 *   interne.
 *
 * Ce que le moteur ne sait pas, il ne l'invente pas : aucune boutique ne
 * publie ses ventes, donc aucun chiffre de ventes ne sort d'ici.
 */

export const AGENT = "SentinelScopeBot/1.0 (+https://sentrylescope.fr)";
const PAGES_MAX = 4;
const DELAI = 9000;
const JOUR = 86400000;

/* ------------------------------------------------------------------ */
/* Lecture HTTP sûre                                                   */
/* ------------------------------------------------------------------ */

async function lire(url, garde, { json = true } = {}) {
  let courant = url;
  for (let saut = 0; saut < 4; saut++) {
    const ok = await garde(courant);
    if (!ok.ok) throw Object.assign(new Error("cible refusée"), { code: "refuse-ssrf" });
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), DELAI);
    let r;
    try {
      r = await fetch(courant, {
        redirect: "manual",
        signal: ctl.signal,
        headers: { "user-agent": AGENT, accept: json ? "application/json" : "text/plain" },
      });
    } finally {
      clearTimeout(t);
    }
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
      courant = new URL(r.headers.get("location"), courant).toString();
      continue;
    }
    if (r.status === 401 || r.status === 403 || r.status === 429)
      throw Object.assign(new Error("lecture refusée"), { code: "refuse", status: r.status });
    if (!r.ok) throw Object.assign(new Error("HTTP " + r.status), { code: "http", status: r.status });
    return { url: courant, corps: json ? await r.json() : await r.text() };
  }
  throw Object.assign(new Error("trop de redirections"), { code: "http" });
}

/** robots.txt : le groupe « * » ou le nôtre interdit-il ce chemin ? La règle la plus longue l'emporte. */
export function robotsInterdit(texte, chemin = "/products.json") {
  const groupes = [];
  let g = null;
  for (const brut of texte.split(/\r?\n/)) {
    const l = brut.replace(/#.*/, "").trim();
    if (!l) continue;
    const [cle, ...reste] = l.split(":");
    const val = reste.join(":").trim();
    const k = cle.trim().toLowerCase();
    if (k === "user-agent") {
      if (!g || g.regles.length) { g = { agents: [], regles: [] }; groupes.push(g); }
      g.agents.push(val.toLowerCase());
    } else if (g && (k === "disallow" || k === "allow")) {
      g.regles.push({ type: k, chemin: val });
    }
  }
  const concernes = groupes.filter((x) => x.agents.some((a) => a === "*" || "sentinelscopebot".startsWith(a)));
  const correspond = (motif) => {
    if (!motif) return false;
    const fin = motif.endsWith("$");
    const corps = fin ? motif.slice(0, -1) : motif;
    const re = new RegExp("^" + corps.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (fin ? "$" : ""));
    return re.test(chemin);
  };
  let interdit = false, longueur = -1;
  for (const grp of concernes)
    for (const r of grp.regles)
      if (correspond(r.chemin) && r.chemin.length > longueur) {
        longueur = r.chemin.length;
        interdit = r.type === "disallow";
      }
  return interdit;
}

/* ------------------------------------------------------------------ */
/* Lecture d'une boutique                                              */
/* ------------------------------------------------------------------ */

export function normaliserDomaine(saisie) {
  let s = String(saisie || "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function normaliserProduit(p, hote) {
  const variantes = Array.isArray(p.variants) ? p.variants : [];
  const prix = variantes.map((v) => parseFloat(v.price)).filter((n) => Number.isFinite(n) && n > 0);
  const barres = variantes
    .map((v) => [parseFloat(v.price), parseFloat(v.compare_at_price)])
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a);
  const dispo = variantes.filter((v) => v.available === true).length;
  return {
    titre: String(p.title || "").trim(),
    marque: String(p.vendor || "").trim(),
    type: String(p.product_type || "").trim(),
    url: `https://${hote}/products/${p.handle}`,
    // created_at et non published_at : Shopify remet la date de publication
    // à jour à chaque republication, seule la création signifie « nouveau ».
    cree: p.created_at || null,
    prix: prix.length ? Math.min(...prix) : null,
    remise: barres.length ? Math.max(...barres.map(([a, b]) => 1 - a / b)) : 0,
    variantes: variantes.length,
    dispo,
  };
}

export async function lireBoutique(domaine, garde) {
  const base = `https://${domaine}`;
  const res = { domaine, nom: domaine, devise: null, statut: "ok", message: null, produits: [], total: null };
  try {
    try {
      const rob = await lire(`${base}/robots.txt`, garde, { json: false });
      if (robotsInterdit(rob.corps)) {
        res.statut = "robots";
        res.message = "Cette boutique interdit la lecture automatique de son catalogue (robots.txt). Elle n'est pas lue.";
        return res;
      }
    } catch (e) {
      if (e.code === "refuse-ssrf") throw e;
      // Pas de robots.txt lisible : rien n'est interdit.
    }
    try {
      const meta = (await lire(`${base}/meta.json`, garde)).corps;
      res.nom = meta.name || domaine;
      res.devise = meta.currency || null;
      res.total = meta.published_products_count ?? null;
    } catch {
      /* meta.json facultatif */
    }
    for (let page = 1; page <= PAGES_MAX; page++) {
      const { corps } = await lire(`${base}/products.json?limit=250&page=${page}`, garde);
      if (!corps || !Array.isArray(corps.products)) {
        if (page === 1) { res.statut = "pas-shopify"; res.message = "Ce site ne publie pas de catalogue Shopify lisible."; }
        break;
      }
      for (const p of corps.products) res.produits.push(normaliserProduit(p, domaine));
      if (corps.products.length < 250) break;
    }
  } catch (e) {
    if (e.code === "refuse-ssrf") { res.statut = "invalide"; res.message = "Adresse introuvable ou refusée : vérifiez l'orthographe du domaine."; }
    else if (e.code === "refuse") { res.statut = "refuse"; res.message = "Cette boutique refuse la lecture automatique (" + e.status + "). Elle n'est pas lue."; }
    else if (e.code === "http" && e.status === 404) { res.statut = "pas-shopify"; res.message = "Ce site ne publie pas de catalogue Shopify lisible."; }
    else { res.statut = "erreur"; res.message = "La boutique n'a pas répondu à temps."; }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Rapprochement des produits entre boutiques                          */
/* ------------------------------------------------------------------ */

const VIDES = new Set(("de du des la le les un une et en pour avec sans au aux a l d " +
  "the and for with of in by to an men's women's mens womens men women unisex kids new").split(" "));

function jetons(titre) {
  return new Set(
    titre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]+/g, " ").split(/\s+/)
      .filter((m) => m.length > 1 && !VIDES.has(m) && !/^\d+$/.test(m))
  );
}
function jaccard(a, b) {
  let commun = 0;
  for (const x of a) if (b.has(x)) commun++;
  return commun / (a.size + b.size - commun || 1);
}
const SEUIL = 0.5;

/**
 * Regroupe les produits « identiques » d'une boutique à l'autre. Un index
 * inversé par mot évite de tout comparer à tout : sur 5 boutiques de 1 000
 * produits, la comparaison naïve ferait 12 millions de paires.
 */
function regrouper(produits) {
  const groupes = [];
  const index = new Map();
  for (const p of produits) {
    p.j = jetons(p.titre);
    if (!p.j.size) continue;
    const candidats = new Set();
    for (const m of p.j) for (const gi of index.get(m) || []) candidats.add(gi);
    let meilleur = -1, score = SEUIL;
    for (const gi of candidats) {
      const s = jaccard(p.j, groupes[gi].j);
      if (s >= score) { score = s; meilleur = gi; }
    }
    if (meilleur < 0) {
      meilleur = groupes.length;
      groupes.push({ j: p.j, membres: [] });
      for (const m of p.j) (index.get(m) || index.set(m, []).get(m)).push(meilleur);
    }
    groupes[meilleur].membres.push(p);
  }
  return groupes;
}

const mediane = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
  return m === null ? null : Math.round(m * 100) / 100;
};

/* ------------------------------------------------------------------ */
/* Analyse                                                             */
/* ------------------------------------------------------------------ */

/**
 * @param concurrents résultats de lireBoutique
 * @param mienne      résultat de lireBoutique pour la boutique du client, ou null
 */
export function analyser(concurrents, mienne, maintenant = Date.now()) {
  const lues = concurrents.filter((b) => b.statut === "ok" && b.produits.length);
  const devises = [...new Set(lues.concat(mienne && mienne.statut === "ok" ? [mienne] : []).map((b) => b.devise).filter(Boolean))];

  const tous = [];
  for (const b of lues) for (const p of b.produits) if (p.prix) tous.push({ ...p, boutique: b.nom, domaine: b.domaine });
  const groupes = regrouper(tous);

  const miens = mienne && mienne.statut === "ok" ? mienne.produits.filter((p) => p.prix).map((p) => ({ ...p, j: jetons(p.titre) })) : [];
  const dejaVendu = (g) => miens.some((m) => jaccard(m.j, g.j) >= SEUIL);

  // ---- Recherche produit : ce que les concurrents vendent, et pas vous
  const pistes = [];
  for (const g of groupes) {
    if (miens.length && dejaVendu(g)) continue;
    const boutiques = [...new Set(g.membres.map((m) => m.domaine))];
    // Tout se compte en boutiques, pas en fiches : une boutique qui décline
    // un produit en douze coloris ne vaut pas douze signaux.
    const parBoutique = (filtre) => new Set(g.membres.filter(filtre).map((m) => m.domaine)).size;
    const ruptures = parBoutique((m) => m.variantes > 0 && m.dispo === 0);
    const partielles = parBoutique((m) => m.dispo > 0 && m.dispo < m.variantes);
    const recents = g.membres.filter((m) => m.cree && maintenant - Date.parse(m.cree) < 30 * JOUR);
    const promos = g.membres.filter((m) => m.remise >= 0.05);
    const nbPromos = new Set(promos.map((m) => m.domaine)).size;
    const indices = [];
    if (boutiques.length >= 2)
      indices.push({ texte: `Vendu par ${boutiques.length} boutiques sur ${lues.length}`, fort: boutiques.length >= Math.max(2, Math.ceil(lues.length * 0.6)) });
    if (ruptures)
      indices.push({ texte: ruptures === 1 ? "En rupture totale dans 1 boutique" : `En rupture totale dans ${ruptures} boutiques`, fort: true });
    else if (partielles)
      indices.push({ texte: `Tailles ou variantes épuisées dans ${partielles} boutique${partielles > 1 ? "s" : ""}`, fort: false });
    if (recents.length) {
      const j = Math.round(Math.min(...recents.map((m) => maintenant - Date.parse(m.cree))) / JOUR);
      indices.push({ texte: j <= 1 ? "Ajouté au catalogue hier ou aujourd'hui" : `Ajouté au catalogue il y a ${j} jours`, fort: j <= 14 });
    }
    if (nbPromos)
      indices.push({ texte: `En promotion dans ${nbPromos} boutique${nbPromos > 1 ? "s" : ""} (jusqu'à −${Math.round(Math.max(...promos.map((m) => m.remise)) * 100)} %)`, fort: false });
    const force = indices.filter((i) => i.fort).length + indices.filter((i) => !i.fort).length * 0.35;
    if (!indices.length) continue;
    const prix = g.membres.map((m) => m.prix);
    const ref = [...g.membres].sort((a, b) => a.titre.length - b.titre.length)[0];
    pistes.push({
      titre: ref.titre,
      type: ref.type || null,
      prixMedian: mediane(prix),
      prixMin: Math.min(...prix),
      prixMax: Math.max(...prix),
      boutiques: boutiques.length,
      indices,
      force: Math.round(force * 100) / 100,
      exemples: g.membres.slice(0, 4).map((m) => ({ boutique: m.boutique, prix: m.prix, url: m.url, dispo: `${m.dispo}/${m.variantes}` })),
    });
  }
  pistes.sort((a, b) => b.force - a.force || b.boutiques - a.boutiques);

  // ---- Veille prix : vos produits face aux mêmes produits chez les concurrents
  const prix = [];
  for (const m of miens) {
    let meilleurs = [];
    for (const g of groupes) if (jaccard(m.j, g.j) >= SEUIL) meilleurs = meilleurs.concat(g.membres);
    if (!meilleurs.length) continue;
    const moinsCher = meilleurs.reduce((a, b) => (b.prix < a.prix ? b : a));
    prix.push({
      titre: m.titre,
      votrePrix: m.prix,
      concurrents: meilleurs.slice(0, 6).map((c) => ({ boutique: c.boutique, prix: c.prix, url: c.url })),
      moinsCher: { boutique: moinsCher.boutique, prix: moinsCher.prix },
      ecart: m.prix / moinsCher.prix - 1,
    });
  }
  prix.sort((a, b) => b.ecart - a.ecart);

  return {
    boutiques: concurrents.concat(mienne ? [mienne] : []).map(({ produits, ...b }) => ({ ...b, lus: produits.length, mienne: b === mienne || b.domaine === mienne?.domaine })),
    devises,
    // Des prix en dollars et en euros ne se comparent pas : on le dit au lieu de comparer.
    devisesMelangees: devises.length > 1,
    pistes: pistes.slice(0, 40),
    prix: prix.slice(0, 60),
    produitsLus: tous.length,
    date: new Date(maintenant).toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Recherche d'un produit dans une liste de boutiques                  */
/* ------------------------------------------------------------------ */

const PAR_BOUTIQUE = 10;

/** Robots et fiche de la boutique : lus une fois, avant la recherche. */
async function preparerBoutique(domaine, garde) {
  const base = `https://${domaine}`;
  const b = { domaine, nom: domaine, devise: null, statut: "ok", message: null };
  try {
    const rob = await lire(`${base}/robots.txt`, garde, { json: false });
    // La recherche passe par /search : on vérifie ce chemin-là aussi.
    if (robotsInterdit(rob.corps, "/search/suggest.json") || robotsInterdit(rob.corps, "/meta.json")) {
      b.statut = "robots";
      b.message = "Cette boutique interdit la lecture automatique (robots.txt). Elle n'est pas interrogée.";
      return b;
    }
  } catch (e) {
    if (e.code === "refuse-ssrf") { b.statut = "invalide"; b.message = "Adresse introuvable ou refusée : vérifiez l'orthographe du domaine."; return b; }
  }
  try {
    const meta = (await lire(`${base}/meta.json`, garde)).corps;
    b.nom = meta.name || domaine;
    b.devise = meta.currency || null;
  } catch { /* facultatif */ }
  return b;
}

export async function rechercher(requete, domaines, garde, maintenant = Date.now()) {
  const q = String(requete || "").trim().slice(0, 120);
  const motsRequete = jetons(q);
  const boutiques = await Promise.all(domaines.map((d) => preparerBoutique(d, garde)));

  await Promise.all(boutiques.map(async (b) => {
    b.resultats = [];
    if (b.statut !== "ok") return;
    try {
      const url = `https://${b.domaine}/search/suggest.json?q=${encodeURIComponent(q)}` +
        `&resources%5Btype%5D=product&resources%5Blimit%5D=${PAR_BOUTIQUE}`;
      const { corps } = await lire(url, garde);
      const produits = corps?.resources?.results?.products;
      if (!Array.isArray(produits)) { b.statut = "pas-shopify"; b.message = "Ce site ne propose pas la recherche Shopify."; return; }
      for (const p of produits) {
        const prix = parseFloat(p.price_min ?? p.price);
        if (!Number.isFinite(prix) || prix <= 0) continue;
        const barre = parseFloat(p.compare_at_price_max);
        const j = jetons(String(p.title || ""));
        let commun = 0;
        for (const m of motsRequete) if (j.has(m)) commun++;
        b.resultats.push({
          titre: String(p.title || "").trim(),
          prix,
          prixMax: parseFloat(p.price_max) || prix,
          remise: Number.isFinite(barre) && barre > prix ? 1 - prix / barre : 0,
          dispo: p.available === true,
          image: p.featured_image?.url || p.image || null,
          url: `https://${b.domaine}/products/${p.handle}`,
          // Part des mots de la recherche présents dans le titre. La recherche
          // de chaque boutique est large : « chaussettes laine » y ramène
          // parfois un bonnet. On garde le résultat, on dit qu'il est approchant.
          pertinence: motsRequete.size ? commun / motsRequete.size : 0,
          boutique: b.nom,
          domaine: b.domaine,
          devise: b.devise,
        });
      }
    } catch (e) {
      if (e.code === "refuse") { b.statut = "refuse"; b.message = `Cette boutique refuse la lecture automatique (${e.status}).`; }
      else if (e.code === "http" && e.status === 404) { b.statut = "pas-shopify"; b.message = "Ce site ne propose pas la recherche Shopify."; }
      else { b.statut = "erreur"; b.message = "La boutique n'a pas répondu à temps."; }
    }
  }));

  const resultats = boutiques.flatMap((b) => b.resultats);
  resultats.sort((a, b) => (b.pertinence >= 0.5) - (a.pertinence >= 0.5) || a.prix - b.prix);
  const exacts = resultats.filter((r) => r.pertinence >= 0.5);
  const base = exacts.length ? exacts : resultats;
  const devises = [...new Set(base.map((r) => r.devise).filter(Boolean))];
  const prix = base.map((r) => r.prix);

  return {
    requete: q,
    date: new Date(maintenant).toISOString(),
    boutiques: boutiques.map(({ resultats: rs, ...b }) => ({ ...b, trouves: rs?.length || 0 })),
    resultats: resultats.slice(0, 60),
    resume: {
      trouves: resultats.length,
      pertinents: exacts.length,
      boutiques: new Set(base.map((r) => r.domaine)).size,
      enStock: base.filter((r) => r.dispo).length,
      enPromo: base.filter((r) => r.remise >= 0.05).length,
      // Une seule devise : on peut résumer les prix. Plusieurs : on s'abstient.
      prix: devises.length <= 1 && prix.length
        ? { min: Math.min(...prix), mediane: mediane(prix), max: Math.max(...prix), devise: devises[0] || null }
        : null,
      devises,
    },
  };
}
