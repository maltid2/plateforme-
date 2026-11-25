/* Données partagées avec le tableau de bord 2D : même graine, mêmes chiffres. */
let graine = 42;
const alea = () => (graine = (graine * 16807) % 2147483647) / 2147483647;

export const BOUTIQUE = 'cafe-atelier.fr';
export const CONCURRENTS = ['Le Moulin Noir', 'Brûlerie Express', 'Origine Café', 'Tasse & Grain', 'Café Direct'];
const COUL = ['#5E7A9B', '#7C8DA3', '#9AA6B5', '#6B7F96', '#8796A8'];
export const JOURS = 30;

// [nom, référence, votre prix, écart visé aujourd'hui face au moins cher].
// L'écart est fixé, pas tiré au hasard : un tirage libre rendait les huit
// produits plus chers que le marché, et la démo montrait une boutique en perdition.
const CATALOGUE = [
  ['Moulin manuel inox 38 mm',        'MOU-038', 189,   0.07],
  ['Bouilloire col de cygne 0,9 L',   'BOU-090',  79,  -0.04],
  ['Balance de précision 0,1 g',      'BAL-001',  45,   0.22],
  ['Dripper conique céramique',       'DRI-CER',  29,   0.01],
  ['Filtres papier ×100',             'FIL-100',   7.9,-0.05],
  ['Cafetière à piston 1 L',          'PIS-100',  39,   0.03],
  ['Carafe verre 600 ml',             'CAR-600',  24,  -0.02],
  ['Café de spécialité Éthiopie 250 g','ETH-250', 14.5, 0.00],
];

const arrondi = v => Math.round(v * 100) / 100;
export const pct = x => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x * 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '\u00a0%';
export const euros = v => v.toLocaleString('fr-FR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';

// Historique : prix de marche, avec quelques baisses franches (promotions).
export const produits = CATALOGUE.map(([nom, ref, prix, cible], i) => {
  const series = CONCURRENTS.map((_, c) => {
    let p = prix * (1 + (alea() - .3) * .16);
    const out = [];
    for (let j = 0; j < JOURS; j++) {
      if (alea() < .05) p *= 1 + (alea() - .6) * .18;       // mouvement franc
      out.push(arrondi(p));
    }
    return out;
  });
  // Une promotion récente chez un concurrent, sur deux produits : c'est ce
  // qui alimente les alertes, donc ça doit exister dans les données.
  if (i === 2 || i === 0) {
    const c = i === 2 ? 1 : 3;
    for (let j = JOURS - 2; j < JOURS; j++) series[c][j] = arrondi(series[c][j] * (i === 2 ? .82 : .9));
  }
  // Recalage : le moins cher d'aujourd'hui tombe sur l'écart visé, la forme
  // des courbes (et la promotion) est conservée.
  const f = prix / (1 + cible) / Math.min(...series.map(s => s[JOURS - 1]));
  series.forEach(s => s.forEach((v, j) => s[j] = arrondi(v * f)));
  const auj = series.map(s => s[JOURS - 1]);
  const min = Math.min(...auj);
  return { nom, ref, prix, series, min, qui: CONCURRENTS[auj.indexOf(min)], ecart: (prix - min) / min };
});


// Alertes : [produit (index), concurrent (index), texte, quand]
export const ALERTES = [
  [2, 1, 'a baissé la Balance de précision 0,1 g de 18 %. Vous êtes désormais le plus cher des six.', 'il y a 3 h'],
  [0, 3, 'a baissé le Moulin manuel inox 38 mm de 10 %.', 'il y a 9 h'],
  [5, 2, 'est en rupture sur la Cafetière à piston 1 L depuis 2 jours.', 'il y a 20 h'],
];
export const PISTES = [
  ['Moulin électrique à meules coniques', 149, 4, ['Rupture 3 fois en 30 j', 'Ajouté par 2 boutiques ce mois', 'Prix stable'], 3],
  ['Kit cold brew 1 L',                    34, 3, ['Ajouté par 3 boutiques ce mois', 'Prix stable'], 2],
  ['Tamper inox 58 mm',                    29, 5, ['Présent chez les 5 concurrents', 'Rupture 1 fois en 30 j'], 2],
  ['Thermomètre à lait',                   15, 2, ['Prix stable'], 1],
  ['Boîte de conservation sous vide',      24, 3, ['Présent chez 3 concurrents', 'Baisse de prix chez 2'], 0],
];
export const FORT = /Rupture [2-9]|Rupture 3|Ajouté par [3-9]|chez les 5/;
