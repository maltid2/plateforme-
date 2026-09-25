'use strict';

// Lecture des fichiers écrits par l'EA (dossier « Common/Files/GeometryDow » de MetaTrader 5) :
//   state.json    — état instantané, réécrit à chaque bougie M5
//   events.jsonl  — une ligne JSON par événement : start, open, close, trail, block
// Les heures (champ t) sont en secondes, heure SERVEUR du broker ; « offset » = serveur - Paris.

const fs = require('fs');
const path = require('path');

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  } catch {
    return null;
  }
}

function readJson(file, fallback = null) {
  const txt = readText(file);
  if (txt === null) return fallback;
  try {
    return JSON.parse(txt);
  } catch {
    return fallback;
  }
}

function readEvents(dir) {
  const txt = readText(path.join(dir, 'events.jsonl'));
  if (!txt) return [];
  const out = [];
  for (const line of txt.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // ligne en cours d'écriture ou corrompue : ignorée
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

// Heure serveur (s) -> instant « heure de Paris » exprimé comme un UTC naïf (ms).
function parisMs(t, offset) {
  return (t - offset * 3600) * 1000;
}

function parisDayKey(t, offset) {
  return new Date(parisMs(t, offset)).toISOString().slice(0, 10);
}

function parisClock(t, offset) {
  return new Date(parisMs(t, offset)).toISOString().slice(11, 16);
}

// Assemble les trades à partir des événements open/close (clé = identifiant de position).
function buildTrades(events) {
  const open = new Map();
  const trades = [];
  for (const e of events) {
    if (e.type === 'open') {
      open.set(e.pos, { ...e, trails: [] });
    } else if (e.type === 'trail' && open.has(e.pos)) {
      open.get(e.pos).trails.push({ t: e.t, sl: e.sl });
    } else if (e.type === 'close' && open.has(e.pos)) {
      const o = open.get(e.pos);
      open.delete(e.pos);
      trades.push({
        pos: e.pos,
        side: o.side,
        lots: o.lots,
        openT: o.t,
        closeT: e.t,
        entry: o.entry,
        sl: o.sl,
        tp: o.tp,
        risk: o.risk,
        exit: e.exit,
        profit: e.profit,
        points: e.points,
        r: e.r,
        reason: e.reason,
        balance: e.balance,
        balanceBefore: o.balance,
        checklist: o.checklist || {},
        trails: o.trails,
      });
    }
  }
  return { trades, openPositions: [...open.values()] };
}

module.exports = { readJson, readEvents, buildTrades, parisMs, parisDayKey, parisClock };
