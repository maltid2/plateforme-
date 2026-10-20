"""Étude E : mode « volume » — beaucoup de positions en parallèle (docs/CRITERES.md, addendum 4).

Toutes les unités positives sur le développement 2025 tournent ensemble ; le compte accepte jusqu'à N positions
simultanées. Comparé au robot fusionné sélectif (liquidité + Donchian M15 Asie), en euros, sur 2026 et 2017-18.
"""
from __future__ import annotations

import json
import os
import statistics
import time

from .backtest import run, cost_scenarios, ExecRules
from .data import load_csv, clean, resample
from .market import Market
from .metrics import summarize
from .news import NewsCalendar
from .research import concat, D, log
from .risk import RiskLimits, RiskManager
from .sizing import size_position
from .strategies import make, TrendFilter
from .symbol import SymbolSpec, example_presets

PERIODS = {"B_dev": ("B", D("2025-04-01"), D("2026-01-01"), "2025 (dév.)"),
           "B_val": ("B", D("2026-01-01"), D("2026-09-18"), "2026 (validation)"),
           "A_val": ("A", D("2017-01-01"), D("2018-07-01"), "2017-18 (régime calme)")}
LIQ = {"strategy": "liquidity_mss", "tf": 5, "session": "london+overlap"}
SELECTIVE = [LIQ, {"strategy": "donchian_breakout", "tf": 15, "session": "asia"}]


def units_from_study_b(path: str) -> list[dict]:
    R = json.load(open(path, encoding="utf-8"))
    u = [{"strategy": r["strategy"], "tf": r["tf"], "session": r["session"]} for r in R["screen"]
         if r["n"] >= 100 and r["exp_r"] > 0]
    return u + [LIQ]


def build(unit):
    name = unit["strategy"].replace("+H1", "").split("{")[0]
    st = make(name)
    return TrendFilter(st) if unit["strategy"].endswith("+H1") else st


def simulate_multi(trades: list, spec: SymbolSpec, equity: float, limits: RiskLimits, max_positions: int) -> dict:
    """Compte avec plusieurs positions ouvertes : taille calculée à l'entrée sur l'equity réalisée."""
    risk = RiskManager(limits)
    eq = peak = equity
    dd = 0.0
    open_ = []
    taken, refused, wins = [], {}, 0

    def realize(upto):
        nonlocal eq, peak, dd, wins
        for t, vol in sorted([x for x in open_ if x[0].exit_ts <= upto], key=lambda x: x[0].exit_ts):
            money = t.pnl / spec.tick_size * spec.tick_value_loss * vol - spec.commission_per_lot_rt * vol
            eq += money
            wins += money > 0
            peak = max(peak, eq)
            dd = max(dd, (peak - eq) / peak)
            risk.on_equity(str(t.exit_ts // 86400), eq)
            open_.remove((t, vol))

    for t in sorted(trades, key=lambda x: x.entry_ts):
        realize(t.entry_ts)
        risk.on_equity(str(t.entry_ts // 86400), eq)
        ok, why = risk.can_open(equity=eq, open_positions=len(open_), workdir="/nonexistent")
        if not ok:
            k = why.split(" (")[0].split(" :")[0]
            refused[k] = refused.get(k, 0) + 1
            continue
        sr = size_position(spec, eq, risk.risk_pct(), t.entry, t.entry - t.side * t.risk_dist, slippage=0.05)
        if not sr.ok:
            refused["lot minimum"] = refused.get("lot minimum", 0) + 1
            continue
        risk.on_open()
        open_.append((t, sr.volume))
        taken.append(t)
    realize(float("inf"))
    return {"taken": len(taken), "final": eq, "max_dd_pct": 100 * dd, "refused": refused,
            "win_rate": wins / len(taken) if taken else 0.0, "exp_r": summarize(taken).get("exp_r", 0.0) if taken else 0.0}


def study(tick_files, mt5_m5, study_b_json, out_dir, max_positions=5):
    os.makedirs(out_dir, exist_ok=True)
    news, costs = NewsCalendar.builtin(), cost_scenarios()
    log("chargement")
    a = concat([clean(load_csv(f)) for f in tick_files])
    hb = clean(load_csv(mt5_m5, server_tz="paris+1", point=0.01))
    mk = {"A": {5: Market(resample(a, 5)), 15: Market(resample(a, 15))}, "B": {5: Market(hb), 15: Market(resample(hb, 15))}}
    units = units_from_study_b(study_b_json)
    R = {"generated": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()), "units": units, "max_positions": max_positions,
         "per_unit": {}, "accounts": {}}
    trades = {}
    for u in units:
        uid = f"{u['strategy']} M{u['tf']} {u['session']}"
        for p, (ds, s0, s1, _) in PERIODS.items():
            for c in ("base", "stress"):
                tl = run(mk[ds][u["tf"]], build(u), costs[c], ExecRules(sessions=tuple(u["session"].split("+")), news=news),
                         start_ts=s0, end_ts=s1).trades
                for t in tl:
                    t.strategy = uid
                trades[(uid, p, c)] = tl
            R["per_unit"].setdefault(uid, {})[p] = summarize(trades[(uid, p, "base")])
        log("unité", uid)
    sel_ids = [f"{u['strategy']} M{u['tf']} {u['session']}" for u in SELECTIVE]
    all_ids = [f"{u['strategy']} M{u['tf']} {u['session']}" for u in units]
    for p, (ds, *_rest) in PERIODS.items():
        price = 4300 if ds == "B" else 1260
        spec = example_presets(gold_price=price)["cent"]
        for c in ("base", "stress"):
            for risk_pct in (0.5, 1.0):
                lim = RiskLimits(risk_pct=risk_pct, max_daily_loss_pct=5.0, max_drawdown_pct=20.0, max_positions=max_positions,
                                 max_trades_per_day=200)
                for mode, ids, mp in (("sélectif (1 position)", sel_ids, 1), ("volume", all_ids, max_positions)):
                    tl = [t for i in ids for t in trades[(i, p, c)]]
                    lim1 = RiskLimits(**{**lim.__dict__, "max_positions": mp})
                    acc = simulate_multi(tl, spec, 100.0, lim1, mp)
                    acc["signals"] = len(tl)
                    R["accounts"][f"{mode}|{p}|{c}|{risk_pct}"] = acc
    with open(os.path.join(out_dir, "volume.json"), "w") as f:
        json.dump(R, f, indent=1, default=str, ensure_ascii=False)
    write_md(R, os.path.join(out_dir, "RESULTATS_MESURES.md"))
    log("rapport écrit")
    return R


def write_md(R, path):
    L = [f"# Étude E — mode volume (beaucoup de positions) — généré le {R['generated']}", "",
         f"{len(R['units'])} unités en parallèle, jusqu'à {R['max_positions']} positions simultanées, compte cent de 100 €, "
         "perte max 5 %/jour, suspension à −20 %.", "", "## Chaque unité (coûts base, E nette par trade)", "",
         "| Unité | 2025 (dév.) | 2026 (validation) | 2017-18 |", "|---|---|---|---|"]
    for uid, d in R["per_unit"].items():
        cell = lambda s: f"{s.get('n', 0)} tr., {s.get('exp_r', 0):+.3f} R" if s.get("n") else "0"
        L.append(f"| {uid} | {cell(d['B_dev'])} | {cell(d['B_val'])} | {cell(d['A_val'])} |")
    pos = sum(1 for d in R["per_unit"].values() if d["B_val"].get("exp_r", -1) > 0)
    L += ["", f"Unités encore positives sur 2026 : **{pos}/{len(R['per_unit'])}**.", "",
          "## Compte de 100 € : sélectif contre volume", "",
          "| Période | Coûts | Risque/position | Mode | Signaux | Trades pris | E par trade | Capital final | Pire baisse | Refus |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    for k, a in R["accounts"].items():
        mode, p, c, r = k.split("|")
        ref = ", ".join(f"{x} {y}" for x, y in a["refused"].items()) or "–"
        L.append(f"| {PERIODS[p][3]} | {c} | {r} % | {mode} | {a['signals']} | {a['taken']} | {a['exp_r']:+.3f} R | "
                 f"**{a['final']:.2f} €** | {a['max_dd_pct']:.1f} % | {ref} |")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")
