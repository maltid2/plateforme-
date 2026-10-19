"""Métriques de performance, bootstrap Monte-Carlo, sensibilité aux meilleurs trades."""
from __future__ import annotations

from collections import defaultdict
import math
import random


def max_drawdown(values: list[float]) -> float:
    peak = cur = dd = 0.0
    for v in values:
        cur += v
        peak = max(peak, cur)
        dd = max(dd, peak - cur)
    return dd


def summarize(trades: list, *, days: int | None = None) -> dict:
    """Statistiques en R (risque initial) et en $ par once. Sharpe : séries journalières en R, annualisé √252."""
    n = len(trades)
    if not n:
        return {"n": 0}
    r = [t.r for t in trades]
    rg = [t.r_gross for t in trades]
    wins, losses = [x for x in r if x > 0], [x for x in r if x <= 0]
    gw, gl = sum(wins), -sum(losses)
    gwg, glg = sum(x for x in rg if x > 0), -sum(x for x in rg if x <= 0)
    daily = defaultdict(float)
    for t in trades:
        daily[t.exit_ts // 86400] += t.r
    span = days or max(1, (trades[-1].exit_ts - trades[0].entry_ts) // 86400 * 5 // 7)
    vals = list(daily.values()) + [0.0] * max(0, span - len(daily))
    mu = sum(vals) / len(vals)
    sd = math.sqrt(sum((v - mu) ** 2 for v in vals) / max(1, len(vals) - 1))
    mean = sum(r) / n
    sdr = math.sqrt(sum((x - mean) ** 2 for x in r) / max(1, n - 1))
    top5 = sorted(r, reverse=True)[:5]
    return {
        "n": n,
        "win_rate": len(wins) / n,
        "exp_r": mean,
        "exp_r_gross": sum(rg) / n,
        "total_r": sum(r),
        "total_r_gross": sum(rg),
        "pf": gw / gl if gl > 0 else float("inf"),
        "pf_gross": gwg / glg if glg > 0 else float("inf"),
        "avg_win_r": gw / len(wins) if wins else 0.0,
        "avg_loss_r": -gl / len(losses) if losses else 0.0,
        "max_dd_r": max_drawdown(r),
        "sharpe": mu / sd * math.sqrt(252) if sd > 0 else 0.0,
        "t_stat": mean / (sdr / math.sqrt(n)) if sdr > 0 else 0.0,
        "cost_r_per_trade": sum(rg) / n - mean,
        "cost_usd_per_oz": sum(t.cost for t in trades) / n,
        "total_cost_usd_per_oz": sum(t.cost for t in trades),
        "avg_risk_usd": sum(t.risk_dist for t in trades) / n,
        "median_risk_usd": sorted(t.risk_dist for t in trades)[n // 2],
        "total_r_without_top5": sum(r) - sum(top5),
        "pnl_usd_per_oz": sum(t.pnl for t in trades),
    }


def bootstrap(trades: list, runs: int = 2000, seed: int = 1) -> dict:
    """Ré-échantillonnage des trades (avec remise) : probabilité d'un total positif et drawdowns."""
    r = [t.r for t in trades]
    if len(r) < 2:
        return {}
    rng = random.Random(seed)
    totals, dds = [], []
    for _ in range(runs):
        s = [r[rng.randrange(len(r))] for _ in r]
        totals.append(sum(s))
        dds.append(max_drawdown(s))
    totals.sort(); dds.sort()
    q = lambda a, p: a[min(len(a) - 1, int(p * len(a)))]
    return {"p_positive": sum(1 for x in totals if x > 0) / runs, "total_p5": q(totals, 0.05),
            "total_p50": q(totals, 0.5), "dd_p50": q(dds, 0.5), "dd_p95": q(dds, 0.95)}


def by_key(trades: list, key) -> dict:
    groups = defaultdict(list)
    for t in trades:
        groups[key(t)].append(t)
    return {k: summarize(v) for k, v in sorted(groups.items(), key=lambda kv: str(kv[0]))}


def fmt(s: dict) -> str:
    if not s.get("n"):
        return "0 trade"
    return (f"{s['n']} trades, gain {s['win_rate']:.0%}, E={s['exp_r']:+.3f}R (brut {s['exp_r_gross']:+.3f}), "
            f"PF {s['pf']:.2f}, total {s['total_r']:+.1f}R, DD {s['max_dd_r']:.1f}R, Sharpe {s['sharpe']:.2f}")
