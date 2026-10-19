"""Étude C : fusion des deux anciens robots et du nouveau (docs/CRITERES.md, addendum 2)."""
from __future__ import annotations

from datetime import datetime, timezone
from itertools import product
import json
import os
import statistics
import time

from .backtest import run, cost_scenarios, ExecRules
from .data import load_csv, clean, resample
from .market import Market
from .metrics import summarize, bootstrap, by_key
from .news import NewsCalendar
from .portfolio import merge, simulate_account
from .research import concat, D, log
from .risk import RiskLimits
from .strategies import make, TrendFilter
from .symbol import example_presets

UTC = timezone.utc
MEMBERS = [  # priorité R2 > R3 > R1 (fixée dans l'addendum)
    {"id": "R2", "name": "liquidity_mss", "tf": 5, "sessions": ("london", "overlap"), "label": "liquidité (ancien robot 2)"},
    {"id": "R3", "name": "donchian_breakout", "tf": 15, "sessions": ("asia",), "label": "Donchian M15 Asie (nouveau)"},
    {"id": "R1", "name": "geometry_pdf", "tf": 5, "sessions": ("london", "overlap"), "label": "méthode du PDF (ancien robot 1)"},
]
PERIODS = {
    "A_dev": ("A", D("2015-01-01"), D("2017-01-01"), "A dév. 2015-16"),
    "A_val": ("A", D("2017-01-01"), D("2018-07-01"), "A valid. 2017-18"),
    "B_dev": ("B", D("2025-04-01"), D("2026-01-01"), "B dév. 2025"),
    "B_val": ("B", D("2026-01-01"), D("2026-09-18"), "B valid. 2026"),
}


class Fusion:
    def __init__(self, tick_files, mt5_m5, m1_2026, out_dir):
        self.out = out_dir
        os.makedirs(out_dir, exist_ok=True)
        self.news = NewsCalendar.builtin()
        self.costs = cost_scenarios()
        log("chargement")
        a = concat([clean(load_csv(f)) for f in tick_files])
        a5 = resample(a, 5)
        self.mk = {"A": {5: Market(a5), 15: Market(resample(a, 15))}}
        hb = clean(load_csv(mt5_m5, server_tz="paris+1", point=0.01))
        self.mk["B"] = {5: Market(hb), 15: Market(resample(hb, 15))}
        prof = {}
        for t, s in zip(hb.t, hb.spread):
            prof.setdefault((t // 3600) % 24, []).append(s)
        self.m1 = Market(clean(load_csv(m1_2026)), spread_profile={h: statistics.median(v) for h, v in prof.items()}) \
            if m1_2026 and os.path.exists(m1_2026) else None
        self.R = {"generated": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()), "members": MEMBERS}

    def member_trades(self, mem, period, cost, params=None, market=None):
        ds, a, b, _ = PERIODS[period] if isinstance(period, str) else period
        m = market or self.mk[ds][mem["tf"]]
        st = make(mem["name"], **(params or {}))
        return run(m, st, self.costs[cost], ExecRules(sessions=mem["sessions"], news=self.news), start_ts=a, end_ts=b).trades

    def run_all(self):
        R = self.R
        trades = {}
        for p in PERIODS:
            for c in ("zero", "base", "stress"):
                for mem in MEMBERS:
                    trades[(mem["id"], p, c)] = self.member_trades(mem, p, c)
                log(p, c)
        R["members_stats"] = {f"{mid}|{p}|{c}": summarize(t) for (mid, p, c), t in trades.items()}
        # sélection mécanique : E nette > 0 (base) sur le développement de l'étude B
        sel = [m for m in MEMBERS if summarize(trades[(m["id"], "B_dev", "base")]).get("exp_r", -1) > 0]
        R["selected"] = [m["id"] for m in sel]
        log("membres sélectionnés", R["selected"])
        ens = {"tous": MEMBERS, "sélection": sel}
        R["ensembles"] = {}
        ens_trades = {}
        for en, mems in ens.items():
            for p in PERIODS:
                for c in ("zero", "base", "stress"):
                    tl = merge([trades[(m["id"], p, c)] for m in mems]) if mems else []
                    ens_trades[(en, p, c)] = tl
                    R["ensembles"][f"{en}|{p}|{c}"] = summarize(tl)
        # robustesse : grille de chaque membre sélectionné, sur le développement B
        R["grid"] = {}
        for mem in sel:
            from .strategies import CATALOG
            g = CATALOG[mem["name"]].grid
            keys = list(g)
            vals, raw, ns = [], [], []
            for combo in product(*(g[k] for k in keys)):
                s = summarize(self.member_trades(mem, "B_dev", "base", dict(zip(keys, combo))))
                vals.append(s.get("exp_r", -1) > 0 and s.get("n", 0) >= 30)
                raw.append(s.get("exp_r", -1) > 0)
                ns.append(s.get("n", 0))
            R["grid"][mem["id"]] = sum(vals) / len(vals)
            R.setdefault("grid_info", {})[mem["id"]] = {"positive_any_n": sum(raw) / len(raw), "median_n": sorted(ns)[len(ns) // 2]}
            log("grille", mem["id"], R["grid"][mem["id"]])
        # trimestres (walk-forward à paramètres fixes) sur 2025-04 → 2026-09
        q = {}
        for t in ens_trades[("sélection", "B_dev", "base")] + ens_trades[("sélection", "B_val", "base")]:
            d = datetime.fromtimestamp(t.entry_ts, UTC)
            q.setdefault(f"{d.year}-T{(d.month - 1) // 3 + 1}", []).append(t)
        R["quarters"] = {k: summarize(v) for k, v in sorted(q.items())}
        val = ens_trades[("sélection", "B_val", "base")]
        R["mc"] = bootstrap(val) if val else {}
        R["by_member_val"] = {k: {"n": v["n"], "exp_r": v.get("exp_r")} for k, v in by_key(val, lambda t: t.strategy).items()} if val else {}
        # M1 2026 pour la liquidité (ancien robot exécuté en M1)
        if self.m1 is not None:
            mem = MEMBERS[0]
            for c in ("base", "stress"):
                R[f"m1_liquidity_{c}"] = summarize(self.member_trades(mem, ("B", None, None, ""), c, market=self.m1))
        # comptes
        presets_b = example_presets(gold_price=4300)
        presets_a = example_presets(gold_price=1260)
        R["accounts"] = {}
        for en in ens:
            for p, pres in (("A_val", presets_a), ("B_val", presets_b), ("B_dev", presets_b)):
                tl = ens_trades[(en, p, "base")]
                for risk in (0.25, 1.0):
                    for spec_name in ("cent", "eu_retail"):
                        acc = simulate_account(tl, pres[spec_name], 100.0, RiskLimits(risk_pct=risk))
                        acc.pop("curve")
                        R["accounts"][f"{en}|{p}|{spec_name}|{risk}"] = acc
        # critères (ensemble sélectionné, validation B)
        v, st = R["ensembles"]["sélection|B_val|base"], R["ensembles"]["sélection|B_val|stress"]
        qs = list(R["quarters"].values())
        cent = R["accounts"]["sélection|B_val|cent|0.25"]
        R["criteria"] = {
            "1_val_exp>=0.05R_PF>=1.10_n>=100": v.get("n", 0) >= 100 and v.get("exp_r", -1) >= 0.05 and v.get("pf", 0) >= 1.10,
            "2_sans_top5_>0": v.get("total_r_without_top5", -1) > 0,
            "3_stress_exp>=0": st.get("exp_r", -1) >= 0,
            "4_dd<=15R": 0 < v.get("n", 0) and v.get("max_dd_r", 99) <= 15,
            "5_trimestres_positifs>=50%": bool(qs) and sum(1 for x in qs if x.get("exp_r", -1) > 0) / len(qs) >= 0.5,
            "6_montecarlo>=90%": R["mc"].get("p_positive", 0) >= 0.9,
            "7_grille>=60%_chaque_membre": bool(R["grid"]) and all(x >= 0.6 for x in R["grid"].values()),
            "9_faisable_compte_cent>=80%": (cent["taken"] / max(1, cent["taken"] + sum(cent["refused"].values()))) >= 0.8,
            "info_A_val_non_negative": R["ensembles"]["sélection|A_val|base"].get("exp_r", -1) >= 0,
        }
        R["criteria"]["candidate"] = all(v for k, v in R["criteria"].items() if not k.startswith("info"))
        with open(os.path.join(self.out, "fusion.json"), "w") as f:
            json.dump(R, f, indent=1, default=str, ensure_ascii=False)
        write_md(R, os.path.join(self.out, "RESULTATS_MESURES.md"))
        log("rapport écrit")
        return R


def _row(s):
    if not s or not s.get("n"):
        return "0 | – | – | – | – | –"
    return f"{s['n']} | {s['win_rate']:.0%} | {s['exp_r']:+.3f} | {s['exp_r_gross']:+.3f} | {s['pf']:.2f} | {s['max_dd_r']:.1f}"


def write_md(R, path):
    L = [f"# Étude C — fusion des trois robots — généré le {R['generated']}", "",
         "Valeurs mesurées par `python -m xauscalp fusion`. R = risque initial. E = espérance nette par trade.", ""]
    L += ["## Chaque robot seul (coûts base)", "", "| Robot | Période | Trades | Gagnants | E net | E brut | PF | DD (R) |", "|---|---|---|---|---|---|---|---|"]
    for mem in R["members"]:
        for p, (_, _, _, lab) in PERIODS.items():
            key = mem["id"] + "|" + p + "|base"
            L.append(f"| {mem['id']} {mem['label']} | {lab} | {_row(R['members_stats'][key])} |")
    L += ["", f"Membres retenus par la règle (E nette > 0 sur B dév. 2025) : **{', '.join(R['selected']) or 'aucun'}**", ""]
    for en in ("tous", "sélection"):
        L += [f"## Ensemble « {en} » (une position à la fois)", "", "| Période | Coûts | Trades | Gagnants | E net | E brut | PF | DD (R) |", "|---|---|---|---|---|---|---|---|"]
        for p, (_, _, _, lab) in PERIODS.items():
            for c in ("zero", "base", "stress"):
                key = f"{en}|{p}|{c}"
                L.append(f"| {lab} | {c} | {_row(R['ensembles'][key])} |")
        L.append("")
    if "m1_liquidity_base" in R:
        L += ["## Liquidité exécutée en M1 (2026-03 → 2026-09)", "", "| Coûts | Trades | Gagnants | E net | E brut | PF | DD |", "|---|---|---|---|---|---|---|",
              f"| base | {_row(R['m1_liquidity_base'])} |", f"| stress | {_row(R['m1_liquidity_stress'])} |", ""]
    L += ["## Robustesse et stabilité (ensemble sélectionné)", "",
          "- Grille de paramètres (B dév., part des variantes positives avec ≥ 30 trades, critère 7) : " + (", ".join(f"{k} {v:.0%}" for k, v in R["grid"].items()) or "–"),
          "- Information (pas un critère) : variantes positives sans minimum de trades : " + (", ".join(f"{k} {v['positive_any_n']:.0%} (trades médians {v['median_n']})" for k, v in R.get("grid_info", {}).items()) or "–"),
          f"- Monte-Carlo validation 2026 : P(total > 0) = {R['mc'].get('p_positive', 0):.0%}, drawdown 95e centile {R['mc'].get('dd_p95', 0):.1f} R",
          "- Par robot (validation 2026) : " + ", ".join(f"{k} {v['n']} tr. E {v['exp_r']:+.3f}" for k, v in R["by_member_val"].items()),
          "", "| Trimestre | Trades | E net | Total R |", "|---|---|---|---|"]
    for k, s in R["quarters"].items():
        L.append(f"| {k} | {s.get('n', 0)} | {s.get('exp_r', 0):+.3f} | {s.get('total_r', 0):+.1f} |")
    L += ["", "## Compte de 100 € (simulation)", "", "| Ensemble | Période | Compte | Risque/trade | Trades pris | Refus | Capital final | Pire baisse |", "|---|---|---|---|---|---|---|---|"]
    for k, a in R["accounts"].items():
        en, p, spec, risk = k.split("|")
        ref = ", ".join(f"{x}: {y}" for x, y in a["refused"].items()) or "–"
        L.append(f"| {en} | {PERIODS[p][3]} | {spec} | {risk} % | {a['taken']} | {ref} | {a['final']:.2f} € | {a['max_dd_pct']:.1f} % |")
    L += ["", "## Critères (ensemble sélectionné, validation 2026)", ""]
    for k, v in R["criteria"].items():
        L.append(f"- {'✅' if v else '❌'} {k}")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")
