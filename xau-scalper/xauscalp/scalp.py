"""Scalp agressif : plusieurs positions en même temps, ~1 € de risque chacune, sorties en secondes / minutes.

- `run_multi` : backtest avec jusqu'à N positions ouvertes (une nouvelle entrée par bougie au maximum),
  mêmes règles d'exécution prudentes que `backtest.run` (ask/bid, stop d'abord, gaps, slippage, rejets).
- Stratégies très courtes, en multiples d'ATR (valables en bougies de 10 s, 1 min...).
- Étude D (docs/CRITERES.md, addendum 3) : `python -m xauscalp scalp`.
"""
from __future__ import annotations

from dataclasses import dataclass
import bisect
import json
import os
import random
import statistics
import time

from .backtest import CostModel, ExecRules, Trade, cost_scenarios
from .data import load_csv, clean, resample
from .market import Market
from .metrics import summarize, bootstrap
from .news import NewsCalendar
from .risk import RiskLimits, RiskManager
from .sizing import size_position
from .strategies.base import Signal, Strategy
from .symbol import SymbolSpec, example_presets


# ============================================================================ stratégies de scalp
class MicroMomentum(Strategy):
    """n bougies de suite dans le même sens, mouvement total >= k x ATR, volume de ticks en hausse -> suivre."""
    name, family = "micro_momentum", "scalp momentum"
    defaults = dict(n=3, k_atr=1.5, stop_atr=1.0, target_atr=1.0, max_minutes=2.0)

    def signal(self, m, k):
        p, b = self.p, m.b
        n = p["n"]
        if k < n + 20:
            return None
        a, vs = m.get("atr", 14)[k - n], m.get("vol_sma", 20)[k - n]
        if not self.ok(a, vs) or a <= 0:
            return None
        ups = all(b.c[j] > b.c[j - 1] and b.c[j] > b.o[j] for j in range(k - n + 1, k + 1))
        dns = all(b.c[j] < b.c[j - 1] and b.c[j] < b.o[j] for j in range(k - n + 1, k + 1))
        move = abs(b.c[k] - b.c[k - n])
        if not (ups or dns) or move < p["k_atr"] * a or b.v[k] < vs:
            return None
        side = 1 if ups else -1
        c = b.c[k]
        return Signal(side, c - side * p["stop_atr"] * a, c + side * p["target_atr"] * a, p["max_minutes"], "micro momentum")


class MicroReversion(Strategy):
    """Écart à l'EMA20 >= z x ATR puis bougie de retournement -> retour vers l'EMA."""
    name, family = "micro_reversion", "scalp retour à la moyenne"
    defaults = dict(z=2.5, stop_buf_atr=0.5, min_rr=0.8, max_minutes=3.0)

    def signal(self, m, k):
        p, b = self.p, m.b
        e, a = m.get("ema", 20)[k], m.get("atr", 14)[k]
        if k < 25 or not self.ok(e, a) or a <= 0:
            return None
        c, o = b.c[k], b.o[k]
        dev = (b.c[k - 1] - e) / a
        if dev <= -p["z"] and c > o:
            stop = min(b.l[k - 2:k + 1]) - p["stop_buf_atr"] * a
            if e - c >= p["min_rr"] * (c - stop):
                return Signal(1, stop, e, p["max_minutes"], "micro rebond")
        if dev >= p["z"] and c < o:
            stop = max(b.h[k - 2:k + 1]) + p["stop_buf_atr"] * a
            if c - e >= p["min_rr"] * (stop - c):
                return Signal(-1, stop, e, p["max_minutes"], "micro repli")
        return None


class MicroBreakout(Strategy):
    """Cassure du plus haut / plus bas des n dernières bougies -> suivre, sortie rapide."""
    name, family = "micro_breakout", "scalp cassure"
    defaults = dict(n=30, stop_atr=1.0, target_atr=1.5, max_minutes=3.0)

    def signal(self, m, k):
        p, b = self.p, m.b
        hh, ll, a = m.get("hh", p["n"]), m.get("ll", p["n"]), m.get("atr", 14)[k]
        if k < p["n"] + 2 or not self.ok(hh[k], ll[k], hh[k - 1], a) or a <= 0:
            return None
        c = b.c[k]
        if c > hh[k] and b.c[k - 1] <= hh[k - 1]:
            return Signal(1, c - p["stop_atr"] * a, c + p["target_atr"] * a, p["max_minutes"], "micro cassure haut")
        if c < ll[k] and b.c[k - 1] >= ll[k - 1]:
            return Signal(-1, c + p["stop_atr"] * a, c - p["target_atr"] * a, p["max_minutes"], "micro cassure bas")
        return None


class MicroSweep(Strategy):
    """Mèche qui dépasse le plus haut/bas des n bougies puis clôture à l'intérieur -> position inverse."""
    name, family = "micro_sweep", "scalp fausse cassure"
    defaults = dict(n=30, min_wick=0.5, stop_buf_atr=0.3, rr=1.0, max_minutes=3.0)

    def signal(self, m, k):
        p, b = self.p, m.b
        hh, ll, a = m.get("hh", p["n"])[k], m.get("ll", p["n"])[k], m.get("atr", 14)[k]
        if k < p["n"] + 2 or not self.ok(hh, ll, a) or a <= 0:
            return None
        o, h, l, c = b.o[k], b.h[k], b.l[k], b.c[k]
        r = h - l
        if r <= 0:
            return None
        if h > hh and c < hh and (h - max(o, c)) / r >= p["min_wick"]:
            stop = h + p["stop_buf_atr"] * a
            return Signal(-1, stop, c - p["rr"] * (stop - c), p["max_minutes"], "micro sweep haut")
        if l < ll and c > ll and (min(o, c) - l) / r >= p["min_wick"]:
            stop = l - p["stop_buf_atr"] * a
            return Signal(1, stop, c + p["rr"] * (c - stop), p["max_minutes"], "micro sweep bas")
        return None


SCALP = {c.name: c for c in (MicroMomentum, MicroReversion, MicroBreakout, MicroSweep)}


# ============================================================================ backtest multi-positions
@dataclass
class ScalpAccount:
    spec: SymbolSpec
    equity: float = 100.0
    limits: RiskLimits = None


def aggressive_limits() -> RiskLimits:
    """Profil « scalp agressif » : 1 % (≈ 1 € sur 100 €) par position, 3 positions max, -5 %/jour, suspension à -20 %."""
    return RiskLimits(risk_pct=1.0, max_daily_loss_pct=5.0, max_drawdown_pct=20.0, max_positions=3,
                      max_trades_per_day=60, max_spread=0.60)


def run_multi(m: Market, strat: Strategy, cost: CostModel, rules: ExecRules, *, max_positions: int = 3,
              start_ts=None, end_ts=None, account: ScalpAccount | None = None):
    b, n = m.b, m.n
    rng = random.Random(cost.seed)
    open_pos: list[Trade] = []
    trades, refused = [], {}
    pend = None
    risk = RiskManager(account.limits) if account else None
    equity = account.equity if account else None
    peak, max_dd = equity or 0.0, 0.0

    def refuse(r):
        key = r.split(" =")[0].split(" (")[0]
        refused[key] = refused.get(key, 0) + 1

    def close(p, k, price, reason, extra):
        nonlocal equity, peak, max_dd
        p.exit_ts, p.exit, p.reason = b.t[k], price, reason
        p.pnl = (price - p.entry) * p.side - cost.commission_per_oz_rt
        p.cost += extra + cost.commission_per_oz_rt + (cost.spread(m, k) if p.side < 0 else 0.0)
        if account:
            sp = account.spec
            p.money = (price - p.entry) * p.side / sp.tick_size * sp.tick_value_loss * p.volume \
                - (cost.commission_per_oz_rt / sp.tick_size * sp.tick_value_loss * p.volume) \
                - sp.commission_per_lot_rt * p.volume
            equity += p.money
            peak = max(peak, equity)
            max_dd = max(max_dd, (peak - equity) / peak if peak > 0 else 0)
            risk.on_equity(str(m.day[k]), equity)
        trades.append(p)
        open_pos.remove(p)

    k0 = max(1, bisect.bisect_left(b.t, start_ts) - 2) if start_ts else 1
    for k in range(k0, n):
        t = b.t[k]
        if end_ts is not None and t >= end_ts and not open_pos and pend is None:
            break
        if account:
            risk.on_equity(str(m.day[k]), equity)
        sp = cost.spread(m, k)
        if pend and pend[0] == k:
            _, sig, ks = pend
            pend = None
            if cost.reject_prob and rng.random() < cost.reject_prob:
                refuse("ordre rejeté")
            else:
                entry = b.o[k] + sp + cost.slip_entry if sig.side > 0 else b.o[k] - cost.slip_entry
                rd = (entry - sig.stop) * sig.side
                if rd > 0 and (sig.target - entry) * sig.side > 0:
                    vol, ok = 0.0, True
                    if account:
                        sr = size_position(account.spec, equity, risk.risk_pct(), entry, sig.stop, free_margin=equity,
                                           spread=sp if sig.side < 0 else 0.0, slippage=cost.slip_stop)
                        ok, vol = sr.ok, sr.volume
                        if not ok:
                            refuse(sr.reason)
                    if ok:
                        p = Trade(strat.name, sig.side, b.t[ks], t, entry, sig.stop, sig.target, risk_dist=rd,
                                  cost=(sp if sig.side > 0 else 0.0) + cost.slip_entry, tag=sig.tag, volume=vol,
                                  session=m.clock.session_of(b.t[ks]) or "")
                        p._max_k = k + max(1, round(sig.max_minutes / m.tf)) - 1
                        open_pos.append(p)
                        if account:
                            risk.on_open()
                else:
                    refuse("niveaux invalides")
        extra = sp - m.spread(k)
        for p in list(open_pos):
            if m.clock.weekend_flatten(t) or (rules.news and rules.news.blocked(t, rules.flatten_before_news_min, 0)):
                close(p, k, b.o[k] - cost.slip_exit if p.side > 0 else b.o[k] + sp + cost.slip_exit, "forcée", cost.slip_exit)
            elif p.side > 0:
                if b.l[k] <= p.stop:
                    close(p, k, min(p.stop, b.o[k]) - cost.slip_stop, "stop", cost.slip_stop)
                elif b.h[k] >= p.target:
                    close(p, k, p.target, "target", 0.0)
                elif k >= p._max_k:
                    close(p, k, b.c[k] - cost.slip_exit, "temps", cost.slip_exit)
            else:
                if m.ask_high(k) + extra >= p.stop:
                    close(p, k, max(p.stop, b.o[k] + sp) + cost.slip_stop, "stop", cost.slip_stop)
                elif m.ask_low(k) + extra <= p.target:
                    close(p, k, p.target, "target", 0.0)
                elif k >= p._max_k:
                    close(p, k, b.c[k] + sp + cost.slip_exit, "temps", cost.slip_exit)
        if pend or len(open_pos) >= max_positions or k + 1 >= n:
            continue
        nxt = b.t[k + 1]
        if (start_ts and nxt < start_ts) or (end_ts and nxt >= end_ts):
            continue
        if not any(m.clock.in_session(nxt, s) for s in rules.sessions) or m.clock.friday_cutoff(nxt) or m.clock.rollover(nxt):
            continue
        sig = strat.signal(m, k)
        if sig is None:
            continue
        if rules.news and rules.news.blocked(nxt, rules.news_before_min, rules.news_after_min):
            refuse("annonce")
            continue
        if cost.spread(m, k) > rules.max_spread:
            refuse("spread")
            continue
        if account:
            ok, why = risk.can_open(equity=equity, open_positions=len(open_pos), workdir="/nonexistent")
            if not ok:
                refuse(why)
                continue
        pend = (k + 1, sig, k)
    for p in list(open_pos):
        close(p, n - 1, b.c[n - 1], "fin", 0.0)
    trades.sort(key=lambda x: x.exit_ts)
    return {"trades": trades, "refused": refused, "final": equity, "max_dd_pct": 100 * max_dd}


# ============================================================================ étude D
D = lambda s: int(__import__("datetime").datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=__import__("datetime").timezone.utc).timestamp())
HOLDS = (1.0, 3.0, 5.0)
SESS = ("london", "overlap")


def study(s10_file: str, m1_files: list[str], m1_2026: str, mt5_m5: str, out_dir: str):
    os.makedirs(out_dir, exist_ok=True)
    news = NewsCalendar.builtin()
    costs = cost_scenarios()
    rules = ExecRules(sessions=SESS, news=news)
    log = lambda *a: print(time.strftime("%H:%M:%S"), *a, flush=True)
    data = {}
    log("chargement")
    s10 = clean(load_csv(s10_file))
    data["S10 2018-S1 (ticks)"] = (Market(s10), (D("2018-01-01"), D("2018-04-01")), (D("2018-04-01"), D("2018-07-01")))
    m1a = clean(load_csv(m1_files[0]))
    for f in m1_files[1:]:
        x = clean(load_csv(f))
        for attr in ("t", "o", "h", "l", "c", "v", "spread", "ask_h", "ask_l"):
            getattr(m1a, attr).extend(getattr(x, attr))
    data["M1 2017-18 (ticks)"] = (Market(m1a), (D("2017-01-01"), D("2017-10-01")), (D("2017-10-01"), D("2018-07-01")))
    hb = clean(load_csv(mt5_m5, server_tz="paris+1", point=0.01))
    prof = {}
    for t, s in zip(hb.t, hb.spread):
        prof.setdefault((t // 3600) % 24, []).append(s)
    m26 = clean(load_csv(m1_2026))
    data["M1 2026"] = (Market(m26, spread_profile={h: statistics.median(v) for h, v in prof.items()}),
                       (D("2026-03-26"), D("2026-07-01")), (D("2026-07-01"), D("2026-09-26")))
    R = {"generated": time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()), "rows": [], "selected": {}}
    for dname, (m, dev, val) in data.items():
        spreads = [m.spread(k) for k in range(0, m.n, 7) if m.clock.session_of(m.b.t[k]) in SESS]
        atr = m.get("atr", 14)
        atrs = [atr[k] for k in range(0, m.n, 7) if atr[k] == atr[k] and m.clock.session_of(m.b.t[k]) in SESS]
        R.setdefault("costs", {})[dname] = {"spread_mean": statistics.mean(spreads), "atr_median": statistics.median(atrs)}
        best = None
        for sname, cls in SCALP.items():
            for hold in HOLDS:
                st = cls(max_minutes=hold)
                row = {"data": dname, "strategy": sname, "hold_min": hold}
                for c in ("zero", "base"):
                    s = summarize(run_multi(m, st, costs[c], rules, max_positions=3, start_ts=dev[0], end_ts=dev[1])["trades"])
                    row[f"dev_{c}_n"], row[f"dev_{c}_e"] = s.get("n", 0), s.get("exp_r", 0.0)
                R["rows"].append(row)
                if row["dev_base_n"] >= 300 and (best is None or row["dev_base_e"] > best["dev_base_e"]):
                    best = row
            log(dname, sname)
        if best is None:
            continue
        st = SCALP[best["strategy"]](max_minutes=best["hold_min"])
        ev = {"unit": best}
        for c in ("zero", "base", "stress"):
            res = run_multi(m, st, costs[c], rules, max_positions=3, start_ts=val[0], end_ts=val[1])
            ev[f"val_{c}"] = summarize(res["trades"])
            if c == "base":
                ev["mc"] = bootstrap(res["trades"])
        price = statistics.median(m.b.c[k] for k in range(0, m.n, 97))
        acc = run_multi(m, st, costs["base"], rules, max_positions=3, start_ts=val[0], end_ts=val[1],
                        account=ScalpAccount(example_presets(gold_price=price)["cent"], 100.0, aggressive_limits()))
        ev["account_cent_100"] = {"trades": len(acc["trades"]), "final": acc["final"], "max_dd_pct": acc["max_dd_pct"],
                                  "refused": acc["refused"],
                                  "median_hold_s": statistics.median(t.exit_ts - t.entry_ts for t in acc["trades"]) if acc["trades"] else 0,
                                  "median_risk_eur": statistics.median(t.money / t.r for t in acc["trades"] if t.r < 0) if any(t.r < 0 for t in acc["trades"]) else 0}
        R["selected"][dname] = ev
        log("validé", dname, best["strategy"], ev["val_base"].get("exp_r"))
    with open(os.path.join(out_dir, "scalp.json"), "w") as f:
        json.dump(R, f, indent=1, default=str, ensure_ascii=False)
    write_md(R, os.path.join(out_dir, "RESULTATS_MESURES.md"))
    log("rapport écrit")
    return R


def write_md(R, path):
    f2 = lambda x: f"{x:+.3f}"
    L = [f"# Étude D — scalp agressif multi-positions — généré le {R['generated']}", "",
         "Jusqu'à 3 positions en même temps, une nouvelle entrée par bougie au maximum, sessions Londres + chevauchement.",
         "E = espérance nette par trade en R (risque initial). Coûts « base » : spread réel (plancher 0,20 $), "
         "commission 0,05 $/once, slippage 0,03 $ (entrée) / 0,05 $ (stop).", "",
         "## Spread face au mouvement", "", "| Données | Spread moyen | ATR médian de la bougie | Spread / ATR |", "|---|---|---|---|"]
    for d, c in R["costs"].items():
        L.append(f"| {d} | {c['spread_mean']:.3f} $ | {c['atr_median']:.3f} $ | {c['spread_mean'] / c['atr_median']:.0%} |")
    L += ["", "## Criblage sur le développement", "", "| Données | Stratégie | Durée max | Trades | E avant frais | E après frais |", "|---|---|---|---|---|---|"]
    for r in R["rows"]:
        L.append(f"| {r['data']} | {r['strategy']} | {r['hold_min']:g} min | {r['dev_base_n']} | {f2(r['dev_zero_e'])} | {f2(r['dev_base_e'])} |")
    pos0 = sum(1 for r in R["rows"] if r["dev_zero_e"] > 0)
    pos1 = sum(1 for r in R["rows"] if r["dev_base_e"] > 0)
    L += ["", f"Variantes positives avant frais : **{pos0}/{len(R['rows'])}** ; après frais : **{pos1}/{len(R['rows'])}**.", "",
          "## Validation (une seule fois) de la meilleure variante de chaque jeu de données", ""]
    for d, ev in R["selected"].items():
        u = ev["unit"]
        a = ev["account_cent_100"]
        L += [f"### {d} — {u['strategy']}, durée max {u['hold_min']:g} min", "",
              "| Coûts | Trades | Gagnants | E net | PF | DD (R) |", "|---|---|---|---|---|---|"]
        for c in ("zero", "base", "stress"):
            s = ev[f"val_{c}"]
            L.append(f"| {c} | {s.get('n', 0)} | {s.get('win_rate', 0):.0%} | {f2(s.get('exp_r', 0))} | {s.get('pf', 0):.2f} | {s.get('max_dd_r', 0):.1f} |")
        L += ["", f"Compte cent 100 €, ~1 € de risque par position, 3 positions max : **{a['trades']} trades, "
                  f"capital final {a['final']:.2f} €**, pire baisse {a['max_dd_pct']:.1f} %, durée médiane d'un trade "
                  f"{a['median_hold_s']:.0f} s, risque médian par trade (1 R) {a['median_risk_eur']:.2f} €. "
                  f"Refus : {', '.join(f'{k} {v}' for k, v in a['refused'].items()) or '–'}.", ""]
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(L) + "\n")
