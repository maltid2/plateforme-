"""Protocole de recherche complet (docs/PROTOCOLE.md) : criblage, sélection sur le développement,
validation hors échantillon, walk-forward, robustesse, stress des coûts, Monte-Carlo, hold-out, faisabilité 100 €.

Toutes les valeurs du rapport sont MESURÉES par ce script ; rien n'est saisi à la main.
"""
from __future__ import annotations

from datetime import datetime, timezone
from itertools import product
import json
import os
import statistics
import time

from .backtest import run, cost_scenarios, ExecRules, Account
from .data import load_csv, clean, resample, validate, Bars
from .feasibility import feasibility
from .market import Market
from .metrics import summarize, bootstrap, by_key, fmt
from .ml import features, Logistic, FEATURES
from .news import NewsCalendar
from .risk import RiskLimits
from .sessions import SESSIONS
from .strategies import CATALOG, make, TrendFilter, RegimeSwitch
from .symbol import example_presets

UTC = timezone.utc
D = lambda s: int(datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=UTC).timestamp())
DEV = (D("2015-01-01"), D("2017-01-01"))
VAL = (D("2017-01-01"), D("2018-07-01"))
ALL_SESSIONS = ("asia", "london", "overlap", "ny_pm")
TFS = (1, 5, 15)
MIN_TRADES_DEV = 100
DEV_B = (D("2025-04-01"), D("2026-01-01"))
VAL_B = (D("2026-01-01"), D("2026-09-18"))


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def concat(parts: list[Bars]) -> Bars:
    out = Bars(parts[0].tf, spread=[] if parts[0].spread is not None else None,
               ask_h=[] if parts[0].ask_h is not None else None, ask_l=[] if parts[0].ask_l is not None else None,
               source="+".join(p.source for p in parts))
    for p in parts:
        for f in ("t", "o", "h", "l", "c", "v", "spread", "ask_h", "ask_l"):
            if getattr(out, f) is not None:
                getattr(out, f).extend(getattr(p, f))
    return out


def stats_row(trades, extra=None) -> dict:
    s = summarize(trades)
    s.update(extra or {})
    return s


class Research:
    def __init__(self, tick_files: list[str], holdout_m5: str | None, holdout_m1: str | None, out_dir: str,
                 study: str = "A"):
        self.out_dir = out_dir
        os.makedirs(out_dir, exist_ok=True)
        self.R: dict = {"generated": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime())}
        self.news = NewsCalendar.builtin()
        self.costs = cost_scenarios()
        self.study = study
        self.DEV, self.VAL, self.TFS = (DEV, VAL, TFS) if study == "A" else (DEV_B, VAL_B, (5, 15))
        self.R["study"] = study
        self.R["labels"] = {"dev": "Dév. 2015-16", "val": "Validation 2017-18"} if study == "A" else \
            {"dev": "Dév. 2025-04 → 2025-12", "val": "Validation 2026-01 → 2026-09"}
        self.R["data"] = {}
        self.holdout_m5 = self.holdout_m1 = None
        if study == "B":
            hb = clean(load_csv(holdout_m5, server_tz="paris+1", point=0.01))
            self.R["data"][os.path.basename(holdout_m5)] = validate(hb).__dict__
            self.markets = {5: Market(hb), 15: Market(resample(hb, 15))}
            return
        log("chargement des ticks M1 bid/ask")
        parts = [clean(load_csv(f)) for f in tick_files]
        self.m1_raw = concat(parts)
        self.R["data"].update({os.path.basename(f): validate(p).__dict__ for f, p in zip(tick_files, parts)})
        self.markets = {1: Market(self.m1_raw)}
        for tf in (5, 15):
            self.markets[tf] = Market(resample(self.m1_raw, tf))
        if holdout_m5 and os.path.exists(holdout_m5):
            hb = clean(load_csv(holdout_m5, server_tz="paris+1", point=0.01))
            self.R["data"][os.path.basename(holdout_m5)] = validate(hb).__dict__
            self.holdout_m5 = Market(hb)
            prof = {}
            for t, s in zip(hb.t, hb.spread):
                prof.setdefault((t // 3600) % 24, []).append(s)
            self.spread_profile = {h: statistics.median(v) for h, v in prof.items()}
            if holdout_m1 and os.path.exists(holdout_m1):
                h1 = clean(load_csv(holdout_m1))
                self.R["data"][os.path.basename(holdout_m1)] = validate(h1).__dict__
                self.holdout_m1 = Market(h1, spread_profile=self.spread_profile)

    def rules(self, sessions=ALL_SESSIONS) -> ExecRules:
        return ExecRules(sessions=tuple(sessions), news=self.news)

    def bt(self, tf, strat, cost="base", period="dev", sessions=ALL_SESSIONS, market=None, **kw):
        m = market or self.markets[tf]
        period = self.DEV if period == "dev" else period
        return run(m, strat, self.costs[cost], self.rules(sessions), start_ts=period[0] if period else None,
                   end_ts=period[1] if period else None, **kw)

    # 1 ------------------------------------------------------------------------
    def cost_profile(self):
        """Spread moyen par session et ATR médian (Londres + chevauchement) par unité de temps et par année."""
        out = {}
        m1 = self.markets[min(self.markets)]
        acc = {}
        for k in range(m1.n):
            y = datetime.fromtimestamp(m1.b.t[k], UTC).year
            s = m1.clock.session_of(m1.b.t[k])
            if s in ALL_SESSIONS:
                acc.setdefault((y, s), []).append(m1.spread(k))
        for tf in self.TFS:
            m = self.markets[tf]
            at = m.get("atr", 14)
            for k in range(m.n):
                if at[k] == at[k] and m.clock.session_of(m.b.t[k]) in ("london", "overlap"):
                    y = datetime.fromtimestamp(m.b.t[k], UTC).year
                    acc.setdefault((y, f"atr_m{tf}"), []).append(at[k])
        for (y, key), vals in acc.items():
            row = out.setdefault(y, {})
            row[key if key.startswith("atr") else f"spread_{key}"] = statistics.mean(vals) if not key.startswith("atr") else statistics.median(vals)
        self.R["cost_profile"] = dict(sorted(out.items()))

    # 2 ------------------------------------------------------------------------
    def screen(self):
        rows = []
        for tf in self.TFS:
            for name, cls in CATALOG.items():
                variants = [cls()]
                if name in ("asia_breakout", "ny_orb", "sweep_reversal", "level_rejection", "bollinger_reversion",
                            "vwap_reversion", "momentum_impulse", "squeeze_breakout"):
                    variants.append(TrendFilter(cls()))
                for st in variants:
                    res = {c: self.bt(tf, st, c) for c in ("zero", "base")}
                    for s in ALL_SESSIONS:
                        tz = [t for t in res["zero"].trades if t.session == s]
                        tb = [t for t in res["base"].trades if t.session == s]
                        sb = summarize(tb)
                        rows.append({"strategy": st.label(), "tf": tf, "session": s, "n": sb.get("n", 0),
                                     "exp_r_zero": summarize(tz).get("exp_r", 0.0), "exp_r": sb.get("exp_r", 0.0),
                                     "pf": sb.get("pf", 0.0), "t_stat": sb.get("t_stat", 0.0),
                                     "max_dd_r": sb.get("max_dd_r", 0.0), "cost_r": sb.get("cost_r_per_trade", 0.0),
                                     "median_risk_usd": sb.get("median_risk_usd", 0.0)})
                log(f"criblage M{tf} {name}")
        self.R["screen"] = rows

    def select(self, k=3):
        """Règle fixée : unités (stratégie, TF, session) avec n >= 100 sur le développement, classées par
        espérance nette (coûts base) ; une seule unité par stratégie ; les 3 premières."""
        ok = [r for r in self.R["screen"] if r["n"] >= MIN_TRADES_DEV]
        ok.sort(key=lambda r: r["exp_r"], reverse=True)
        picked, seen = [], set()
        for r in ok:
            base = r["strategy"].split("{")[0].replace("+H1", "")
            if base in seen:
                continue
            seen.add(base)
            picked.append(r)
            if len(picked) == k:
                break
        self.R["selected"] = picked
        return picked

    @staticmethod
    def build(label: str):
        h1 = label.endswith("+H1")
        name = label.replace("+H1", "").split("{")[0]
        st = make(name)
        return TrendFilter(st) if h1 else st

    # 3 ------------------------------------------------------------------------
    def evaluate(self, unit: dict) -> dict:
        tf, sess, label = unit["tf"], (unit["session"],), unit["strategy"]
        st = self.build(label)
        name = label.replace("+H1", "").split("{")[0]
        out = {"unit": unit}
        # robustesse : grille voisine sur le développement
        grid = CATALOG[name].grid
        keys = list(grid)
        combos = list(product(*(grid[k] for k in keys)))
        g = []
        for vals in combos:
            s2 = make(name, **dict(zip(keys, vals)))
            s2 = TrendFilter(s2) if label.endswith("+H1") else s2
            s = summarize(self.bt(tf, s2, "base", self.DEV, sess).trades)
            g.append({"params": dict(zip(keys, vals)), "n": s.get("n", 0), "exp_r": s.get("exp_r", 0.0)})
        out["grid"] = g
        out["grid_positive_share"] = sum(1 for x in g if x["exp_r"] > 0 and x["n"] >= 30) / len(g)
        # validation (une fois), trois scénarios de coûts
        for c in ("zero", "base", "stress"):
            out[f"dev_{c}"] = summarize(self.bt(tf, st, c, self.DEV, sess).trades)
            res = self.bt(tf, st, c, self.VAL, sess)
            out[f"val_{c}"] = summarize(res.trades)
            if c == "base":
                out["val_mc"] = bootstrap(res.trades)
                out["val_by_regime"] = {k: {"n": v["n"], "exp_r": v.get("exp_r", 0)} for k, v in by_key(res.trades, lambda t: t.regime).items()}
                out["val_by_year"] = {k: {"n": v["n"], "exp_r": v.get("exp_r", 0)} for k, v in by_key(res.trades, lambda t: datetime.fromtimestamp(t.entry_ts, UTC).year).items()}
                out["val_by_side"] = {k: {"n": v["n"], "exp_r": v.get("exp_r", 0)} for k, v in by_key(res.trades, lambda t: "achat" if t.side > 0 else "vente").items()}
                out["_val_trades"] = res.trades
        # walk-forward : 6 mois d'apprentissage, 3 mois de test
        wf_trades, windows = [], []
        start = self.DEV[0]
        month = 30.44 * 86400
        while start + 9 * month <= self.VAL[1] + 5 * 86400:
            tr0, tr1, te1 = start, int(start + 6 * month), int(start + 9 * month)
            best, best_e = None, -1e9
            for vals in combos:
                s2 = make(name, **dict(zip(keys, vals)))
                s2 = TrendFilter(s2) if label.endswith("+H1") else s2
                s = summarize(self.bt(tf, s2, "base", (tr0, tr1), sess).trades)
                if s.get("n", 0) >= 30 and s["exp_r"] > best_e:
                    best, best_e = s2, s["exp_r"]
            if best is not None:
                te = self.bt(tf, best, "base", (tr1, te1), sess).trades
                wf_trades += te
                windows.append({"test_from": datetime.fromtimestamp(tr1, UTC).strftime("%Y-%m"),
                                "params": best.label(), "n": len(te), "exp_r": summarize(te).get("exp_r", 0.0)})
            start = int(start + 3 * month)
        out["wf"] = summarize(wf_trades)
        out["wf_windows"] = windows
        out["wf_positive_share"] = (sum(1 for w in windows if w["exp_r"] > 0 and w["n"] > 0) / len(windows)) if windows else 0
        # hold-out 2025-2026 (une fois)
        if self.holdout_m5 is not None:
            hm = self.holdout_m5 if tf != 15 else Market(resample(self.holdout_m5.b, 15))
            if tf == 1 and self.holdout_m1 is not None:
                hm = self.holdout_m1
            if tf in (5, 15) or self.holdout_m1 is not None:
                for c in ("base", "stress"):
                    res = run(hm, st, self.costs[c], self.rules(sess))
                    out[f"holdout_{c}"] = summarize(res.trades)
                    if c == "base":
                        out["_holdout_trades"] = res.trades
                out["holdout_market"] = f"M{hm.tf} {hm.b.source.split('/')[-1]}"
        return out

    # 4 ------------------------------------------------------------------------
    def criteria(self, ev: dict, feas_share: float) -> dict:
        v, st = ev["val_base"], ev["val_stress"]
        mc = ev.get("val_mc", {})
        c = {
            "1_val_exp>=0.05R_PF>=1.10_n>=100": v.get("n", 0) >= 100 and v.get("exp_r", -1) >= 0.05 and v.get("pf", 0) >= 1.10,
            "2_sans_top5_>0": v.get("total_r_without_top5", -1) > 0,
            "3_stress_exp>=0": st.get("exp_r", -1) >= 0,
            "4_dd<=15R": v.get("n", 0) > 0 and v.get("max_dd_r", 99) <= 15,
            "5_walkforward": ev["wf"].get("exp_r", -1) > 0 and ev["wf_positive_share"] >= 0.5,
            "6_montecarlo>=90%": mc.get("p_positive", 0) >= 0.9,
            "7_grille>=60%": ev["grid_positive_share"] >= 0.6,
            "8_holdout_exp>0": (ev.get("holdout_base", {}).get("exp_r", -1) > 0) if self.study == "A" else None,
            "9_faisable_100EUR>=80%": feas_share >= 0.8,
        }
        c["candidate"] = all(v for v in c.values() if v is not None)
        return c

    def regime_engine(self):
        out = {}
        for tf in (5, 15):
            eng = RegimeSwitch({"trend": make("trend_pullback"), "range": make("bollinger_reversion"),
                                "volatile": None, "chaotic": None})
            out[f"M{tf}"] = {p: summarize(self.bt(tf, eng, "base", per, ("london", "overlap")).trades)
                            for p, per in (("dev", self.DEV), ("val", self.VAL))}
        self.R["regime_engine"] = out

    def ml_filter(self, unit: dict):
        tf, sess = unit["tf"], (unit["session"],)
        st = self.build(unit["strategy"])
        dev = self.bt(tf, st, "base", self.DEV, sess, feature_fn=features).trades
        val = self.bt(tf, st, "base", self.VAL, sess, feature_fn=features).trades
        if len(dev) < 100 or not val:
            self.R["ml"] = {"note": "pas assez de trades"}
            return
        model = Logistic().fit([t.features for t in dev], [1 if t.r > 0 else 0 for t in dev])
        pd = sorted(model.proba(t.features) for t in dev)
        thr = pd[len(pd) // 2]
        keep = [t for t in val if model.proba(t.features) >= thr]
        self.R["ml"] = {"unit": unit, "threshold": thr, "val_all": summarize(val), "val_filtered": summarize(keep),
                        "weights": dict(zip(["biais"] + FEATURES, model.w))}

    def feasibility_100(self, ev: dict) -> dict:
        out = {}
        trades = ev.get("_val_trades", [])
        stops = [t.risk_dist for t in trades]
        hold = ev.get("_holdout_trades", [])
        price_of = lambda tr: statistics.median(t.entry for t in tr) if tr else 0.0
        for period, tr in (("val", trades), ("holdout_2025_2026", hold)):
            price = price_of(tr)
            if not tr:
                continue
            for pname, spec in example_presets(gold_price=price).items():
                f = feasibility(spec, equity=100.0, risk_pct=0.25, price=price, stop_distances=[t.risk_dist for t in tr])
                acc = Account(spec=spec, equity=100.0, limits=RiskLimits())
                u = ev["unit"]
                m = self.markets[u["tf"]] if period.startswith("val") else None
                if m is not None:
                    res = run(m, self.build(u["strategy"]), self.costs["base"], self.rules((u["session"],)),
                              start_ts=self.VAL[0], end_ts=self.VAL[1], account=acc)
                else:
                    hm = self.holdout_m1 if u["tf"] == 1 and self.holdout_m1 else self.holdout_m5
                    if u["tf"] == 15:
                        hm = Market(resample(self.holdout_m5.b, 15))
                    res = run(hm, self.build(u["strategy"]), self.costs["base"], self.rules((u["session"],)), account=acc)
                f["account_trades"] = len(res.trades)
                f["account_refused"] = res.refused
                f["account_final_eur"] = res.final_equity
                out[f"{period}/{pname}"] = f
        return out

    # ------------------------------------------------------------------------
    def run_all(self):
        self.cost_profile(); log("profil de coûts")
        self.screen()
        units = self.select()
        log("sélection", [(u["strategy"], u["tf"], u["session"]) for u in units])
        evs = []
        for u in units:
            ev = self.evaluate(u)
            feas = self.feasibility_100(ev)
            share = max((f["share_signals_sizeable"] for k, f in feas.items() if k.startswith("val") and "cent" not in k), default=0.0)
            ev["feasibility"] = feas
            ev["criteria"] = self.criteria(ev, share)
            evs.append(ev)
            log("évalué", u["strategy"], fmt(ev["val_base"]))
        self.R["evaluations"] = [{k: v for k, v in e.items() if not k.startswith("_")} for e in evs]
        self.regime_engine(); log("moteur adaptatif")
        if units:
            self.ml_filter(units[0]); log("méta-filtre ML")
        with open(os.path.join(self.out_dir, "research.json"), "w") as f:
            json.dump(self.R, f, indent=1, default=str, ensure_ascii=False)
        from .report import write_markdown
        write_markdown(self.R, os.path.join(self.out_dir, "RESULTATS_MESURES.md"))
        log("rapport écrit")
        return self.R
