"""Étude F : méthode agressive = taille des positions du robot fusionné (docs/CRITERES.md, addendum 5).

Le seul levier mesuré qui augmente le gain est le risque par trade sur des signaux à espérance positive.
On compare des risques fixes et un « anti-martingale » (mise augmentée après un gain, jamais après une perte),
et on mesure le risque de ruine par Monte-Carlo.
"""
from __future__ import annotations

import json
import os
import random
import time

from .fusion import Fusion, MEMBERS
from .portfolio import merge
from .risk import RiskLimits, RiskManager
from .sizing import size_position
from .symbol import example_presets

PROFILES = [("fixe 0,5 %", 0.5, False), ("fixe 1 %", 1.0, False), ("fixe 2 %", 2.0, False), ("fixe 3 %", 3.0, False),
            ("fixe 5 %", 5.0, False), ("fixe 8 %", 8.0, False), ("anti-martingale 1 %", 1.0, True),
            ("anti-martingale 2 %", 2.0, True)]
LIMITS = dict(max_daily_loss_pct=10.0, max_drawdown_pct=40.0, max_positions=1, max_trades_per_day=50)


def simulate(trades, spec, risk_pct, anti, equity=100.0):
    rm = RiskManager(RiskLimits(risk_pct=risk_pct, **LIMITS))
    eq = peak = equity
    dd, mult, taken, stopped = 0.0, 1.0, 0, False
    for t in trades:
        rm.on_equity(str(t.entry_ts // 86400), eq)
        if not rm.can_open(equity=eq, open_positions=0, workdir="/nonexistent")[0]:
            stopped = stopped or rm.state.suspended
            continue
        pct = risk_pct * (mult if anti else 1.0)
        sr = size_position(spec, eq, pct, t.entry, t.entry - t.side * t.risk_dist, slippage=0.05)
        if not sr.ok:
            continue
        money = t.pnl / spec.tick_size * spec.tick_value_loss * sr.volume - spec.commission_per_lot_rt * sr.volume
        eq += money
        taken += 1
        mult = min(3.0, mult * 1.5) if money > 0 else 1.0
        peak = max(peak, eq)
        dd = max(dd, (peak - eq) / peak)
        rm.on_equity(str(t.exit_ts // 86400), eq)
    return {"final": eq, "max_dd_pct": 100 * dd, "taken": taken, "stopped": rm.state.suspended}


def monte_carlo(rs, risk_pct, anti, runs=5000, seed=5):
    """Séquences de R tirées au hasard ; capital composé, mêmes garde-fous (arrêt à -40 %)."""
    rng = random.Random(seed)
    finals = []
    for _ in range(runs):
        eq = peak = 100.0
        mult = 1.0
        for _ in range(len(rs)):
            if eq <= peak * 0.6:
                break
            r = rs[rng.randrange(len(rs))]
            pct = risk_pct * (mult if anti else 1.0) / 100
            eq *= max(0.0, 1 + pct * r)
            mult = min(3.0, mult * 1.5) if r > 0 else 1.0
            peak = max(peak, eq)
        finals.append(eq)
    finals.sort()
    q = lambda p: finals[min(len(finals) - 1, int(p * len(finals)))]
    return {"p5": q(0.05), "median": q(0.5), "p95": q(0.95), "p_below_50": sum(x < 50 for x in finals) / runs,
            "p_below_100": sum(x < 100 for x in finals) / runs}


def study(tick_files, mt5_m5, m1, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    fu = Fusion(tick_files, mt5_m5, m1, out_dir)
    sel = [m for m in MEMBERS if m["id"] in ("R2", "R3")]
    R = {"generated": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()), "runs": {}, "mc": {}}
    for p in ("B_dev", "B_val", "A_val"):
        price = 4300 if p.startswith("B") else 1260
        spec = example_presets(gold_price=price)["cent"]
        for c in ("base", "stress"):
            tl = merge([fu.member_trades(m, p, c) for m in sel])
            for name, pct, anti in PROFILES:
                R["runs"][f"{p}|{c}|{name}"] = simulate(tl, spec, pct, anti)
            if c == "base" and p != "B_dev":
                rs = [t.r for t in tl]
                for name, pct, anti in PROFILES:
                    R["mc"][f"{p}|{name}"] = monte_carlo(rs, pct, anti)
    dev = {n: R["runs"][f"B_dev|base|{n}"] for n, _, _ in PROFILES}
    ok = {n: v for n, v in dev.items() if v["max_dd_pct"] <= 30}
    R["chosen"] = max(ok, key=lambda n: ok[n]["final"]) if ok else None
    with open(os.path.join(out_dir, "aggressive.json"), "w") as f:
        json.dump(R, f, indent=1, ensure_ascii=False)
    L = [f"# Étude F — méthode agressive (taille des positions) — généré le {R['generated']}", "",
         "Signaux du robot fusionné (liquidité M5 + Donchian M15 Asie), compte cent de 100 €, une position à la fois, "
         "perte max 10 %/jour, arrêt à −40 %.", "",
         f"Profil choisi sur 2025 (capital maximal avec une pire baisse ≤ 30 %) : **{R['chosen']}**", "",
         "| Profil | 2025 base | 2026 base | 2026 stress | 2017-18 base | 2017-18 stress |", "|---|---|---|---|---|---|"]
    cell = lambda r: f"{r['final']:.2f} € (−{r['max_dd_pct']:.0f} %{', arrêt' if r['stopped'] else ''})"
    for n, _, _ in PROFILES:
        L.append(f"| {n} | {cell(R['runs'][f'B_dev|base|{n}'])} | {cell(R['runs'][f'B_val|base|{n}'])} | "
                 f"{cell(R['runs'][f'B_val|stress|{n}'])} | {cell(R['runs'][f'A_val|base|{n}'])} | {cell(R['runs'][f'A_val|stress|{n}'])} |")
    L += ["", "## Monte-Carlo (5 000 tirages des trades de la période)", "",
          "| Période | Profil | 5 % des cas pire que | Médiane | 5 % des cas mieux que | P(< 50 €) | P(< 100 €) |", "|---|---|---|---|---|---|---|"]
    for k, v in R["mc"].items():
        p, n = k.split("|")
        L.append(f"| {'2026' if p == 'B_val' else '2017-18'} | {n} | {v['p5']:.2f} € | {v['median']:.2f} € | {v['p95']:.2f} € | "
                 f"{v['p_below_50']:.0%} | {v['p_below_100']:.0%} |")
    with open(os.path.join(out_dir, "RESULTATS_MESURES.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")
    print("rapport écrit", flush=True)
    return R
