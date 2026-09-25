'use strict';

// Rapport quotidien : bilan du jour, audit des règles, rappel psychologique du PDF.

const { buildTrades, parisDayKey, parisClock, parisMs } = require('./journal');

function summarize(trades) {
  const wins = trades.filter((t) => t.profit > 0);
  const sum = (k) => trades.reduce((s, t) => s + (t[k] || 0), 0);
  return {
    trades: trades.length,
    wins: wins.length,
    losses: trades.length - wins.length,
    winRate: trades.length ? wins.length / trades.length : 0,
    profit: sum('profit'),
    points: sum('points'),
    r: sum('r'),
  };
}

// Vérifie que le robot a bien respecté les règles de la méthode ce jour-là.
function auditRules(dayTrades, params) {
  const checks = [];
  const add = (rule, ok, detail) => checks.push({ rule, ok, detail });

  const widened = [];
  for (const t of dayTrades) {
    const dir = t.side === 'buy' ? 1 : -1;
    let sl = t.sl;
    for (const tr of t.trails) {
      if ((tr.sl - sl) * dir < -1e-9) widened.push(t.pos);
      sl = tr.sl;
    }
    // Sortie nettement au-delà du stop initial (plus d'un quart du risque) : stop retiré ou élargi
    if ((t.exit - t.sl) * dir < -0.25 * Math.abs(t.entry - t.sl)) widened.push(t.pos);
  }
  add('Stop jamais élargi', widened.length === 0,
    widened.length ? `positions ${[...new Set(widened)].join(', ')}` : 'stop seulement resserré');

  let overlap = false;
  const sorted = [...dayTrades].sort((a, b) => a.openT - b.openT);
  for (let k = 1; k < sorted.length; k++) if (sorted[k].openT < sorted[k - 1].closeT) overlap = true;
  add('Une seule position à la fois', !overlap, overlap ? 'positions simultanées détectées' : 'aucun renfort');

  const max = params.maxTradesPerDay ?? 3;
  add('Nombre de trades', dayTrades.length <= max, `${dayTrades.length} / ${max} autorisés`);

  const pause = (params.pauseAfterLossMinutes ?? 120) * 60;
  let revengeGap = null;
  for (let k = 1; k < sorted.length; k++) {
    const gap = sorted[k].openT - sorted[k - 1].closeT;
    if (sorted[k - 1].profit < 0 && gap < pause) revengeGap = gap;
  }
  add('Pause après perte (pas de trade de vengeance)', revengeGap === null,
    revengeGap !== null ? `re-entrée ${Math.round(revengeGap / 60)} min après une perte` : `${pause / 60} min respectées`);

  return checks;
}

function psychology(day) {
  if (day.trades === 0) {
    return 'Pas de setup clair aujourd\'hui : ne pas trader est aussi une décision. Le plus important reste le setup en lui-même.';
  }
  if (day.losses >= 2) {
    return 'UN trade reste UN trade. Il ne te remet pas en question en tant que trader. Ne prends pas position pour combler une perte passée.';
  }
  if (day.profit < 0) {
    return 'Un stop ne veut pas forcément dire que le scénario était faux, parfois seulement qu\'on n\'a pas été assez patient. Ne déplace jamais ton stop.';
  }
  if (day.wins >= 2 && day.losses === 0) {
    return 'Belle journée. Attention à l\'excès de confiance : n\'augmente pas la taille de tes positions, pense constance plutôt qu\'intérêts composés.';
  }
  return 'Laisse courir tes trades : il vaut mieux viser la target du plan que sécuriser des petits gains par peur.';
}

// Lundi (clé YYYY-MM-DD) de la semaine d'une date.
function mondayOf(dayKey) {
  const d = new Date(`${dayKey}T00:00:00Z`);
  const wd = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - wd * 86400000).toISOString().slice(0, 10);
}

function buildReport(events, dayKey, { offset = 1, params = {}, note = '' } = {}) {
  const { trades } = buildTrades(events);
  const keyOf = (t) => parisDayKey(t.openT, offset);
  const dayTrades = trades.filter((t) => keyOf(t) === dayKey);
  const monday = mondayOf(dayKey);
  const week = trades.filter((t) => keyOf(t) >= monday && keyOf(t) <= dayKey);
  const all = trades.filter((t) => keyOf(t) <= dayKey);

  const blocks = [];
  const seen = new Set();
  for (const e of events) {
    if (e.type !== 'block' || parisDayKey(e.t, offset) !== dayKey || !e.reason || seen.has(e.reason)) continue;
    seen.add(e.reason);
    blocks.push({ time: parisClock(e.t, offset), reason: e.reason });
  }

  const day = summarize(dayTrades);
  const first = dayTrades[0];
  const last = dayTrades[dayTrades.length - 1];
  // Courbe de capital cumulée jusqu'à ce jour
  let peak = -Infinity;
  let maxDD = 0;
  for (const t of all) {
    peak = Math.max(peak, t.balanceBefore ?? t.balance, t.balance);
    if (peak > 0) maxDD = Math.max(maxDD, (peak - t.balance) / peak);
  }

  return {
    day: dayKey,
    market: params.market || 'dow',
    unit: params.unit || 'pts',
    generatedAt: new Date().toISOString(),
    summary: day,
    balanceStart: first ? first.balanceBefore : (all.length ? all[all.length - 1].balance : null),
    balanceEnd: last ? last.balance : (all.length ? all[all.length - 1].balance : null),
    trades: dayTrades.map((t) => ({
      pos: t.pos,
      open: parisClock(t.openT, offset),
      close: parisClock(t.closeT, offset),
      side: t.side,
      lots: t.lots,
      entry: t.entry,
      exit: t.exit,
      sl: t.sl,
      tp: t.tp,
      points: t.points,
      r: t.r,
      profit: t.profit,
      reason: t.reason,
      checklist: t.checklist,
    })),
    blocks,
    rules: auditRules(dayTrades, params),
    week: summarize(week),
    total: { ...summarize(all), maxDrawdownPercent: maxDD * 100 },
    psychology: psychology(day),
    note,
  };
}

const money = (x) => `${x >= 0 ? '+' : ''}${x.toFixed(2)}`;

// Version texte (notification Telegram, fichier .txt)
function reportText(r) {
  const s = r.summary;
  const unit = r.unit || 'pts';
  const lines = [
    `📊 Geometry ${r.market === 'gold' ? 'Or' : 'Dow'} — rapport du ${r.day}`,
    '',
    `Trades : ${s.trades} (${s.wins} gagnant(s), ${s.losses} perdant(s))`,
    `Résultat : ${money(s.profit)} | ${s.points >= 0 ? '+' : ''}${s.points.toFixed(unit === '$' ? 2 : 1)} ${unit} | ${s.r >= 0 ? '+' : ''}${s.r.toFixed(2)} R`,
  ];
  if (r.balanceEnd !== null) lines.push(`Capital : ${r.balanceEnd.toFixed(2)}`);
  for (const t of r.trades) {
    lines.push(`  ${t.open} ${t.side === 'buy' ? 'ACHAT' : 'VENTE'} ${t.entry.toFixed(unit === '$' ? 2 : 1)} → ${t.exit.toFixed(unit === '$' ? 2 : 1)} (${t.reason}) ${t.r >= 0 ? '+' : ''}${t.r.toFixed(2)}R`);
  }
  lines.push('', 'Règles :');
  for (const c of r.rules) lines.push(`  ${c.ok ? '✅' : '❌'} ${c.rule} — ${c.detail}`);
  if (r.blocks.length) lines.push('', `Garde-fous déclenchés : ${r.blocks.map((b) => `${b.reason} (${b.time})`).join(', ')}`);
  lines.push('', `Semaine : ${money(r.week.profit)} sur ${r.week.trades} trade(s)`);
  lines.push(`Total : ${money(r.total.profit)} — réussite ${(r.total.winRate * 100).toFixed(0)} % — drawdown max ${r.total.maxDrawdownPercent.toFixed(1)} %`);
  lines.push('', `💡 ${r.psychology}`);
  if (r.note) lines.push('', `📝 Note : ${r.note}`);
  return lines.join('\n');
}

// Série de capital pour le graphique (heure de Paris en ms UTC naïf).
function equitySeries(events, offset) {
  const { trades } = buildTrades(events);
  const pts = [];
  if (trades.length && trades[0].balanceBefore != null) pts.push({ t: parisMs(trades[0].openT, offset), balance: trades[0].balanceBefore });
  for (const t of trades) pts.push({ t: parisMs(t.closeT, offset), balance: t.balance, pos: t.pos, r: t.r });
  return pts;
}

module.exports = { buildReport, reportText, summarize, auditRules, equitySeries, mondayOf };
