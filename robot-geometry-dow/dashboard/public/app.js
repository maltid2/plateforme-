'use strict';

// Tableau de bord Geometry Dow — JavaScript natif, aucun framework.
// Tout texte venant des données passe par textContent (jamais innerHTML).

const $ = (sel) => document.querySelector(sel);
const SVG = 'http://www.w3.org/2000/svg';

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}

function s(tag, attrs = {}, text) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
}

const nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signed = (x, f = nf2) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${f.format(Math.abs(x))}`;
const cls = (x) => (x > 0 ? 'pos' : x < 0 ? 'neg' : '');
const clock = (ms) => new Date(ms).toISOString().slice(11, 16);
const dateFr = (ms) => new Date(ms).toISOString().slice(0, 10).split('-').reverse().join('/');
const sideFr = (side) => (side === 'buy' ? 'Achat' : 'Vente');

let data = null;
let offset = 1;
// Unité de prix du marché : « $ » pour l'or (2 décimales), « pts » pour le Dow (1 décimale).
const unitOf = () => (data && data.state && data.state.params && data.state.params.unit) || 'pts';
const priceFmt = () => (unitOf() === '$' ? nf2 : nf1);
const pf = (v) => priceFmt().format(v);
const moveLabel = (v) => `${signed(v, priceFmt())} ${unitOf() === '$' ? '$' : 'points'}`;
const toParis = (t) => (t - offset * 3600) * 1000;

// ---------------------------------------------------------------------------
// Infobulle
// ---------------------------------------------------------------------------
const tip = $('#tooltip');
function showTip(evt, lines) {
  tip.replaceChildren(...lines.map(([label, value]) => h('div', {}, label ? h('b', {}, `${label} `) : null, value)));
  tip.hidden = false;
  const pad = 14;
  const r = tip.getBoundingClientRect();
  let x = evt.clientX + pad;
  let y = evt.clientY + pad;
  if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - pad;
  if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - pad;
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}
const hideTip = () => { tip.hidden = true; };

// ---------------------------------------------------------------------------
// En-tête et indicateurs
// ---------------------------------------------------------------------------
function renderHeader() {
  const st = data.state;
  $('#symbol').textContent = st ? st.symbol : '';
  $('#demo').hidden = !(st && st.demo);
  $('#demo').textContent = 'Démo — cours simulés aléatoires';
  const pills = [];
  if (!st) {
    pills.push(h('span', { class: 'pill' }, h('i', { class: 'dot bad' }), 'Aucune donnée du robot'));
  } else {
    const stale = data.ageSeconds !== null && data.ageSeconds > 600 && !st.demo;
    pills.push(h('span', { class: 'pill' }, h('i', { class: `dot ${stale ? 'warn' : 'good'}` }),
      stale ? `Robot silencieux depuis ${Math.round(data.ageSeconds / 60)} min` : 'Robot actif'));
    pills.push(h('span', { class: 'pill' }, h('i', { class: `dot ${st.inSession ? 'good' : ''}` }), st.inSession ? 'En session' : 'Hors session'));
    if (st.block) pills.push(h('span', { class: 'pill' }, h('i', { class: 'dot warn' }), `Pause : ${st.block}`));
  }
  $('#status').replaceChildren(...pills);
}

function kpi(label, value, sub, valueClass = '') {
  return h('div', { class: 'kpi' }, h('div', { class: 'label' }, label), h('div', { class: `value ${valueClass}` }, value), sub ? h('div', { class: 'sub' }, sub) : null);
}

function renderKpis() {
  const st = data.state || {};
  const td = data.todaySummary;
  const tot = data.total;
  const max = st.params ? st.params.maxTradesPerDay : 3;
  $('#kpis').replaceChildren(
    kpi('Capital', st.balance !== undefined ? nf2.format(st.balance) : '—', st.equity !== undefined && st.equity !== st.balance ? `Équité ${nf2.format(st.equity)}` : null),
    kpi("Aujourd'hui", signed(td.profit), `${td.trades} / ${max} trades · ${signed(td.r)} R`, cls(td.profit)),
    kpi('Taux de réussite', tot.trades ? `${Math.round(tot.winRate * 100)} %` : '—', `${tot.wins} gagnants / ${tot.trades} trades`),
    kpi('Total', `${signed(tot.r)} R`, moveLabel(tot.points), cls(tot.r)),
  );
}

// ---------------------------------------------------------------------------
// Graphique M15 + zones
// ---------------------------------------------------------------------------
function niceTicks(lo, hi, count = 5) {
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw) || raw;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}

function renderChart() {
  const box = $('#chart');
  const st = data.state;
  if (!st || !st.m15 || !st.m15.length) {
    box.replaceChildren(h('div', { class: 'empty' }, 'En attente des bougies M15 du robot…'));
    return;
  }
  const bars = st.m15.map(([t, o, hi, l, c]) => ({ t, o, h: hi, l, c }));
  const W = Math.max(320, box.clientWidth || 760); const H = Math.round(Math.min(360, Math.max(260, W * 0.45))); const L = 8; const R = 66; const T = 10; const B = 24;
  const pw = W - L - R; const ph = H - T - B;
  let lo = Math.min(...bars.map((b) => b.l));
  let hi = Math.max(...bars.map((b) => b.h));
  const span0 = hi - lo;
  const zones = (st.zones || []).filter((z) => z.top >= lo - span0 * 0.3 && z.bottom <= hi + span0 * 0.3);
  const pos = st.position;
  const levels = [st.price, ...zones.flatMap((z) => [z.top, z.bottom]), ...(pos ? [pos.sl, pos.tp, pos.entry] : [])].filter(Number.isFinite);
  lo = Math.min(lo, ...levels);
  hi = Math.max(hi, ...levels);
  const padP = (hi - lo) * 0.06 || 1;
  lo -= padP; hi += padP;
  const y = (p) => T + (hi - p) / (hi - lo) * ph;
  const step = pw / bars.length;
  const x = (k) => L + k * step + step / 2;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Bougies M15 avec zones de supply et demand' });

  for (const v of niceTicks(lo, hi)) {
    svg.append(s('line', { class: 'gridline', x1: L, x2: L + pw, y1: y(v), y2: y(v) }));
    const nearLevel = [st.price, ...(pos ? [pos.sl, pos.tp, pos.entry] : [])].some((p) => Number.isFinite(p) && Math.abs(y(p) - y(v)) < 14);
    if (!nearLevel) svg.append(s('text', { x: L + pw + 6, y: y(v) + 4 }, pf(v)));
  }
  const every = Math.max(1, Math.round(bars.length / 6));
  bars.forEach((b, k) => {
    if (k % every === 0) svg.append(s('text', { x: x(k), y: H - 6, 'text-anchor': 'middle' }, clock(toParis(b.t))));
  });

  // Zones (du pivot jusqu'au bord droit) ; étiquettes espacées pour rester lisibles
  const labelsY = [];
  for (const z of zones) {
    let k0 = bars.findIndex((b) => b.t >= z.t);
    if (k0 < 0) k0 = bars.length - 1;
    const x0 = L + k0 * step;
    const demand = z.side === 'demand';
    svg.append(s('rect', {
      x: x0, y: y(z.top), width: L + pw - x0, height: Math.max(2, y(z.bottom) - y(z.top)),
      fill: demand ? 'var(--zone-demand)' : 'var(--zone-supply)', stroke: demand ? 'var(--good)' : 'var(--critical)', 'stroke-width': 1, rx: 2,
    }));
    const ly = demand ? y(z.bottom) - 3 : y(z.top) + 11;
    if (labelsY.every((v) => Math.abs(v - ly) > 12)) {
      labelsY.push(ly);
      svg.append(s('text', { class: 'zone-label', x: x0 + 4, y: ly }, demand ? 'Demand' : 'Supply'));
    }
  }

  // Bougies
  const bw = Math.max(2, step * 0.62);
  bars.forEach((b, k) => {
    const up = b.c >= b.o;
    const color = up ? 'var(--good)' : 'var(--critical)';
    svg.append(s('line', { x1: x(k), x2: x(k), y1: y(b.h), y2: y(b.l), stroke: color, 'stroke-width': 1 }));
    const top = y(Math.max(b.o, b.c));
    svg.append(s('rect', { x: x(k) - bw / 2, y: top, width: bw, height: Math.max(1, y(Math.min(b.o, b.c)) - top), fill: color, rx: 1 }));
  });

  // Niveaux horizontaux : prix, position
  const level = (p, color, label, dash) => {
    svg.append(s('line', { x1: L, x2: L + pw, y1: y(p), y2: y(p), stroke: color, 'stroke-width': 1.5, 'stroke-dasharray': dash || '' }));
    const g = s('g');
    g.append(s('rect', { x: L + pw + 2, y: y(p) - 9, width: R - 4, height: 18, rx: 4, fill: color }));
    g.append(s('text', { x: L + pw + 6, y: y(p) + 4, class: 'level-label' }, label));
    svg.append(g);
  };
  if (pos) {
    level(pos.tp, 'var(--good)', `TP ${pf(pos.tp)}`, '4 3');
    level(pos.sl, 'var(--critical)', `SL ${pf(pos.sl)}`, '4 3');
    level(pos.entry, 'var(--text-secondary)', pf(pos.entry), '2 2');
  }
  if (Number.isFinite(st.price)) level(st.price, 'var(--series-1)', pf(st.price));

  // Zones de survol (plus larges que les bougies)
  bars.forEach((b, k) => {
    const hit = s('rect', { x: L + k * step, y: T, width: step, height: ph, fill: 'transparent' });
    hit.addEventListener('mousemove', (e) => showTip(e, [
      ['', `${dateFr(toParis(b.t))} ${clock(toParis(b.t))} (Paris)`],
      ['O', pf(b.o)], ['H', pf(b.h)], ['B', pf(b.l)], ['C', pf(b.c)],
    ]));
    hit.addEventListener('mouseleave', hideTip);
    svg.append(hit);
  });
  box.replaceChildren(svg);

  const rg = st.regime;
  $('#regime').textContent = rg ? `${rg.type === 'range' ? 'Range' : 'Impulsion'} · efficacité ${nf2.format(rg.efficiency)} · SL mini ${pf(rg.minSL)} ${unitOf()}` : '';
}

// ---------------------------------------------------------------------------
// Check-list
// ---------------------------------------------------------------------------
function step(state, title, detail) {
  const icon = state === 'ok' ? '✓' : state === 'info' ? 'i' : '✗';
  const label = state === 'ok' ? 'validé' : state === 'info' ? 'information' : 'non validé';
  return h('li', {}, h('span', { class: `ic ${state === 'ok' ? 'ok' : state === 'info' ? 'info' : 'no'}`, 'aria-label': label }, icon), h('div', {}, title, detail ? h('small', {}, detail) : null));
}

function renderChecklist() {
  const st = data.state;
  const box = $('#checklist');
  if (!st || !st.checklist) {
    box.replaceChildren(h('div', { class: 'empty' }, 'Pas encore de diagnostic.'));
    return;
  }
  const rg = st.regime || {};
  box.replaceChildren(...['buy', 'sell'].map((side) => {
    const d = st.checklist[side] || {};
    return h('div', { class: 'side' },
      h('h3', {}, side === 'buy' ? 'Achat' : 'Vente', d.ready ? h('span', { class: 'ready' }, 'Setup prêt') : null),
      h('ol', {},
        step('ok', '1. Type de trade', `${rg.type === 'range' ? 'Range' : 'Impulsion'} → SL mini ${pf(rg.minSL || 0)} ${unitOf()}`),
        step(d.zoneOk ? 'ok' : 'no', '2. Prix dans une zone clé', d.zone || 'aucune zone'),
        step(d.geoComplete ? 'ok' : 'info', '3. Géométrie', d.geometry && d.geometry !== 'n/a' ? `${d.geometry}${d.geoComplete ? ' — complétée' : ' — en cours'}` : 'pas encore lisible'),
        step(d.wicks > 0 ? 'ok' : 'no', '4. Mèches de rejet M15', d.wicks > 0 ? `${d.wicks} mèche(s)${d.stopHunt ? ' + stop hunt' : ''}` : 'aucune'),
        step(d.m5 ? 'ok' : 'no', '5. Confirmation M5', d.m5 ? '2 bougies + volume' : 'en attente'),
      ));
  }));

  const sess = (st.params && st.params.sessions) || [];
  const mode = st.params && st.params.mode === 'h24' ? 'H24 · ' : '';
  $('#session').textContent = sess.length ? mode + sess.map((x) => `${x.start}–${x.end}`).join(' · ') : '';
  const p = st.position;
  $('#position').replaceChildren(p
    ? h('div', { class: 'position' }, h('b', {}, `${sideFr(p.side)} ${p.lots} lot(s) @ ${pf(p.entry)}`),
      h('div', {}, `SL ${pf(p.sl)} · TP ${pf(p.tp)} · `, h('span', { class: cls(p.profit) }, `${signed(p.profit)} en cours`)))
    : h('div', { class: 'position muted' }, 'Aucune position ouverte.'));
}

// ---------------------------------------------------------------------------
// Courbe de capital
// ---------------------------------------------------------------------------
function renderEquity() {
  const box = $('#equity');
  const pts = data.equity;
  if (pts.length < 2) {
    box.replaceChildren(h('div', { class: 'empty' }, 'La courbe apparaîtra après le premier trade clôturé.'));
    $('#equity-note').textContent = '';
    return;
  }
  const W = Math.max(320, box.clientWidth || 760); const H = 220; const L = 8; const R = 74; const T = 10; const B = 24;
  const pw = W - L - R; const ph = H - T - B;
  const t0 = pts[0].t; const t1 = pts[pts.length - 1].t;
  let lo = Math.min(...pts.map((p) => p.balance)); let hi = Math.max(...pts.map((p) => p.balance));
  const pad = (hi - lo) * 0.1 || 1; lo -= pad; hi += pad;
  const x = (t) => L + (t1 > t0 ? (t - t0) / (t1 - t0) : 0.5) * pw;
  const y = (v) => T + (hi - v) / (hi - lo) * ph;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Évolution du capital après chaque trade' });
  for (const v of niceTicks(lo, hi, 4)) {
    svg.append(s('line', { class: 'gridline', x1: L, x2: L + pw, y1: y(v), y2: y(v) }));
    svg.append(s('text', { x: L + pw + 6, y: y(v) + 4 }, nf2.format(v)));
  }
  svg.append(s('text', { x: L, y: H - 6 }, dateFr(t0)));
  svg.append(s('text', { x: L + pw, y: H - 6, 'text-anchor': 'end' }, dateFr(t1)));
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.balance).toFixed(1)}`).join('');
  svg.append(s('path', { d, fill: 'none', stroke: 'var(--series-1)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  const cross = s('line', { x1: 0, x2: 0, y1: T, y2: T + ph, stroke: 'var(--text-muted)', 'stroke-width': 1, visibility: 'hidden' });
  const dot = s('circle', { r: 5, fill: 'var(--series-1)', stroke: 'var(--surface-1)', 'stroke-width': 2, visibility: 'hidden' });
  svg.append(cross, dot);
  const hit = s('rect', { x: L, y: T, width: pw, height: ph, fill: 'transparent' });
  hit.addEventListener('mousemove', (e) => {
    const r = svg.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width * W;
    let best = pts[0];
    for (const p of pts) if (Math.abs(x(p.t) - mx) < Math.abs(x(best.t) - mx)) best = p;
    cross.setAttribute('x1', x(best.t)); cross.setAttribute('x2', x(best.t)); cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', x(best.t)); dot.setAttribute('cy', y(best.balance)); dot.setAttribute('visibility', 'visible');
    showTip(e, [['', `${dateFr(best.t)} ${clock(best.t)}`], ['Capital', nf2.format(best.balance)], ...(best.r !== undefined ? [['Trade', `${signed(best.r)} R`]] : [])]);
  });
  hit.addEventListener('mouseleave', () => { hideTip(); cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); });
  svg.append(hit);
  box.replaceChildren(svg);
  const change = pts[pts.length - 1].balance - pts[0].balance;
  $('#equity-note').textContent = `${signed(change)} depuis le ${dateFr(t0)}`;
}

// ---------------------------------------------------------------------------
// Tableaux de trades
// ---------------------------------------------------------------------------
function tradesTable(rows, withDate) {
  const head = h('tr', {}, ...[withDate ? 'Date' : null, 'Ouverture', 'Sens', 'Entrée', 'SL', 'TP', 'Sortie', 'Raison', unitOf() === '$' ? 'Écart $' : 'Points', 'R', 'Résultat', 'Setup']
    .filter(Boolean).map((c) => h('th', { class: ['Entrée', 'SL', 'TP', 'Sortie', 'Points', 'Écart $', 'R', 'Résultat'].includes(c) ? 'r' : '' }, c)));
  const body = rows.map((t) => {
    const ck = t.checklist || {};
    const setup = [ck.type, ck.zone, ck.wicks ? `${ck.wicks} mèche(s)` : null, ck.stopHunt ? 'stop hunt' : null].filter(Boolean).join(' · ');
    return h('tr', {},
      withDate ? h('td', {}, dateFr(t.openParis)) : null,
      h('td', {}, t.open || clock(t.openParis)),
      h('td', {}, sideFr(t.side)),
      h('td', { class: 'r' }, pf(t.entry)),
      h('td', { class: 'r' }, pf(t.sl)),
      h('td', { class: 'r' }, pf(t.tp)),
      h('td', { class: 'r' }, pf(t.exit)),
      h('td', {}, t.reason),
      h('td', { class: `r ${cls(t.points)}` }, signed(t.points, priceFmt())),
      h('td', { class: `r ${cls(t.r)}` }, signed(t.r)),
      h('td', { class: `r ${cls(t.profit)}` }, signed(t.profit)),
      h('td', { class: 'muted' }, setup));
  });
  return [h('thead', {}, head), h('tbody', {}, ...body)];
}

function renderTrades() {
  const table = $('#trades');
  if (!data.trades.length) {
    table.replaceChildren(h('tbody', {}, h('tr', {}, h('td', { class: 'muted' }, 'Aucun trade pour le moment.'))));
    return;
  }
  table.replaceChildren(...tradesTable(data.trades, true));
}

// ---------------------------------------------------------------------------
// Rapports
// ---------------------------------------------------------------------------
let currentDay = null;

async function loadReports() {
  const list = await (await fetch('api/reports')).json();
  const ul = $('#report-list');
  if (!list.length) {
    ul.replaceChildren(h('li', { class: 'muted' }, `Le premier rapport sera généré ce soir à ${data ? data.reportTime : '23:15'}.`));
    $('#report').replaceChildren(h('div', { class: 'empty' }, 'Aucun rapport pour le moment.'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => regenerate(data.today) }, "Générer le rapport d'aujourd'hui")));
    return;
  }
  ul.replaceChildren(...list.map((r) => h('li', {}, h('button', { 'aria-current': r.day === currentDay ? 'true' : 'false', onclick: () => openReport(r.day) },
    h('span', {}, r.day.split('-').reverse().join('/')),
    h('span', { class: cls(r.profit) }, r.trades ? `${signed(r.r)} R` : '—')))));
  if (!currentDay) openReport(list[0].day);
}

async function regenerate(day) {
  const r = await (await fetch(`api/reports/${day}/generate`, { method: 'POST' })).json();
  currentDay = r.day;
  await loadReports();
  renderReport(r);
}

async function openReport(day) {
  currentDay = day;
  const res = await fetch(`api/reports/${day}`);
  if (!res.ok) return;
  renderReport(await res.json());
  document.querySelectorAll('#report-list button').forEach((b) => b.setAttribute('aria-current', b.textContent.startsWith(day.split('-').reverse().join('/')) ? 'true' : 'false'));
}

function renderReport(r) {
  const s0 = r.summary;
  const note = h('textarea', { 'aria-label': 'Note du journal de trading', placeholder: 'Comment as-tu vécu cette journée ? Une réaction émotionnelle à noter ? Que feras-tu la prochaine fois ?' });
  note.value = r.note || '';
  const saved = h('span', { class: 'muted' });
  $('#report').replaceChildren(h('div', { class: 'report' },
    h('div', { class: 'card-head' }, h('h2', {}, `Rapport du ${r.day.split('-').reverse().join('/')}`), h('span', { class: 'muted' }, `généré à ${r.generatedAt.slice(11, 16)} UTC`)),
    h('div', { class: 'kpis' },
      kpi('Résultat', signed(s0.profit), moveLabel(s0.points), cls(s0.profit)),
      kpi('Trades', String(s0.trades), `${s0.wins} gagnant(s) · ${s0.losses} perdant(s)`),
      kpi('R du jour', `${signed(s0.r)} R`, null, cls(s0.r)),
      kpi('Capital', r.balanceEnd !== null ? nf2.format(r.balanceEnd) : '—', r.balanceStart !== null ? `début ${nf2.format(r.balanceStart)}` : null)),
    r.trades.length ? [h('h3', {}, 'Trades'), h('div', { class: 'table-wrap' }, h('table', {}, ...tradesTable(r.trades, false)))] : null,
    h('h3', {}, 'Respect des règles'),
    h('ul', { class: 'rules' }, ...r.rules.map((c) => h('li', {}, h('span', { class: c.ok ? 'pos' : 'neg', 'aria-label': c.ok ? 'respectée' : 'non respectée' }, c.ok ? '✓' : '✗'), h('span', {}, h('b', {}, c.rule), ` — ${c.detail}`)))),
    r.blocks.length ? [h('h3', {}, 'Garde-fous déclenchés'), h('div', {}, r.blocks.map((b) => `${b.reason} (${b.time})`).join(' · '))] : null,
    h('h3', {}, 'Semaine et total'),
    h('div', {}, `Semaine : ${signed(r.week.profit)} sur ${r.week.trades} trade(s) · Total : ${signed(r.total.profit)}, réussite ${Math.round(r.total.winRate * 100)} %, drawdown max ${nf1.format(r.total.maxDrawdownPercent)} %`),
    h('div', { class: 'quote' }, r.psychology),
    h('h3', {}, 'Journal de trading'),
    note,
    h('div', { class: 'row' },
      h('button', {
        class: 'btn',
        onclick: async () => {
          const res = await fetch(`api/reports/${r.day}/note`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: note.value }) });
          saved.textContent = res.ok ? 'Note enregistrée.' : 'Erreur à l\'enregistrement.';
        },
      }, 'Enregistrer la note'),
      h('button', { class: 'btn secondary', onclick: () => regenerate(r.day) }, 'Recalculer'),
      saved)));
}

// ---------------------------------------------------------------------------
// Boucle
// ---------------------------------------------------------------------------
async function refresh() {
  try {
    data = await (await fetch('api/dashboard')).json();
    offset = data.state && Number.isFinite(data.state.offset) ? data.state.offset : 1;
    renderHeader();
    renderKpis();
    renderChart();
    renderChecklist();
    renderEquity();
    renderTrades();
  } catch (e) {
    $('#status').replaceChildren(h('span', { class: 'pill' }, h('i', { class: 'dot bad' }), 'Serveur injoignable'));
  }
}

document.querySelectorAll('.tabs button').forEach((btn) => btn.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
  $('#tab-live').hidden = btn.dataset.tab !== 'live';
  $('#tab-reports').hidden = btn.dataset.tab !== 'reports';
  if (btn.dataset.tab === 'reports') loadReports();
}));

refresh();
setInterval(refresh, 15000);
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (data) { renderChart(); renderEquity(); } }, 150);
});
