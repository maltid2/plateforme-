'use strict';

/**
 * Parsing HTML minimal sans dépendance : extraction de tableaux
 * (<table>/<tr>/<th>/<td>) et de paires libellé/valeur (<dt>/<dd>,
 * <th>/<td> sur une ligne, "Libellé : valeur").
 */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function text(html) {
  return decode(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** Liens href d'une cellule (pour récupérer l'URL de fiche détail). */
function links(html) {
  const out = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) out.push(decode(m[1]));
  return out;
}

/**
 * Retourne les tableaux de la page : [{ headers: [..], rows: [{ cells: [..], links: [..] }] }]
 */
function tables(html) {
  const out = [];
  const tre = /<table\b[\s\S]*?<\/table>/gi;
  let t;
  while ((t = tre.exec(html))) {
    const rows = [];
    let headers = null;
    const rre = /<tr\b[\s\S]*?<\/tr>/gi;
    let r;
    while ((r = rre.exec(t[0]))) {
      const cells = [];
      let isHeader = true;
      const cre = /<(t[hd])\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let c;
      while ((c = cre.exec(r[0]))) {
        if (c[1].toLowerCase() === 'td') isHeader = false;
        cells.push(c[2]);
      }
      if (!cells.length) continue;
      if (isHeader && !headers) headers = cells.map(text);
      else rows.push({ cells: cells.map(text), links: cells.flatMap(links) });
    }
    if (rows.length) out.push({ headers: headers || [], rows });
  }
  return out;
}

/** Paires libellé → valeur trouvées dans une fiche détail. */
function labelValues(html) {
  const out = {};
  const put = (k, v) => {
    k = text(k).replace(/[:：]\s*$/, '').trim();
    v = text(v);
    if (k && v && k.length < 80 && !(k in out)) out[k] = v;
  };
  let m;
  const dl = /<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi;
  while ((m = dl.exec(html))) put(m[1], m[2]);
  const th = /<tr\b[^>]*>\s*<th\b[^>]*>([\s\S]*?)<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
  while ((m = th.exec(html))) put(m[1], m[2]);
  for (const line of text(html).split('\n')) {
    const lm = line.match(/^([^:]{2,60}):\s*(.+)$/);
    if (lm) put(lm[1], lm[2]);
  }
  return out;
}

module.exports = { decode, text, links, tables, labelValues };
