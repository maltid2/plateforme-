#!/usr/bin/env node
'use strict';

// Usage : node src/index.js historique_US30_M5.csv [--quick] [--offset=1] [--risk=1] [--journal=journal.csv]

const fs = require('fs');
const defaults = require('./config');
const { loadCsv } = require('./csv');
const { run } = require('./backtest');

function fmt(t) {
  return new Date(t).toISOString().slice(0, 16).replace('T', ' ');
}

function main(argv) {
  const file = argv.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Usage : node src/index.js <historique_M5.csv> [--quick] [--offset=1] [--risk=1] [--journal=fichier.csv]');
    process.exit(1);
  }
  const opt = (name) => {
    const a = argv.find((x) => x.startsWith(`--${name}=`));
    return a ? a.split('=')[1] : undefined;
  };
  const cfg = { ...defaults };
  if (argv.includes('--quick')) cfg.quickMode = true;
  if (opt('offset') !== undefined) cfg.serverMinusParisHours = Number(opt('offset'));
  if (opt('risk') !== undefined) cfg.riskPercent = Number(opt('risk'));
  if (opt('spread') !== undefined) cfg.spread = Number(opt('spread'));

  const bars = loadCsv(file);
  if (bars.length < 500) {
    console.error(`Historique trop court (${bars.length} bougies M5).`);
    process.exit(1);
  }
  const { trades, stats } = run(bars, cfg);

  console.log(`\nGeometry Market Mastery — backtest ${fmt(bars[0].t)} → ${fmt(bars[bars.length - 1].t)}`);
  console.log(`Mode : ${cfg.quickMode ? 'rapide (SL 5 / TP 30)' : 'complet (SL logique / TP zone)'}\n`);
  for (const t of trades) {
    console.log(
      `${fmt(t.entryTime)}  ${t.side.toUpperCase().padEnd(4)} @${t.entry.toFixed(1)}  SL ${t.initialSL.toFixed(1)}  TP ${t.tp.toFixed(1)}`
      + `  → ${t.reason.padEnd(10)} ${t.points >= 0 ? '+' : ''}${t.points.toFixed(1)} pts (${t.r.toFixed(2)}R)`
      + `  [${t.checklist.type}, ${t.checklist.zone}, ${t.checklist.wicks} mèche(s)${t.checklist.stopHunt ? ', stop hunt' : ''}, ${t.checklist.geometry}]`,
    );
  }
  console.log('\n--- Résultats ---');
  console.log(`Trades           : ${stats.trades}`);
  console.log(`Taux de réussite : ${(stats.winRate * 100).toFixed(1)} %`);
  console.log(`Points nets      : ${stats.points.toFixed(1)}`);
  console.log(`Profit factor    : ${Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞'}`);
  console.log(`R moyen          : ${stats.avgR.toFixed(2)}`);
  console.log(`Rendement        : ${stats.returnPercent.toFixed(2)} % (risque ${cfg.riskPercent} %/trade)`);
  console.log(`Drawdown max     : ${stats.maxDrawdownPercent.toFixed(2)} %`);

  const journal = opt('journal');
  if (journal) {
    const head = 'entree,sens,prix,sl,tp,sortie,prix_sortie,raison,points,R,type,zone,meches,stop_hunt,geometrie';
    const rows = trades.map((t) => [
      fmt(t.entryTime), t.side, t.entry.toFixed(1), t.initialSL.toFixed(1), t.tp.toFixed(1), fmt(t.exitTime),
      t.exit.toFixed(1), t.reason, t.points.toFixed(1), t.r.toFixed(2), t.checklist.type,
      `"${t.checklist.zone}"`, t.checklist.wicks, t.checklist.stopHunt, `"${t.checklist.geometry}"`,
    ].join(','));
    fs.writeFileSync(journal, [head, ...rows].join('\n') + '\n');
    console.log(`\nJournal de trading écrit dans ${journal}`);
  }
}

main(process.argv.slice(2));
