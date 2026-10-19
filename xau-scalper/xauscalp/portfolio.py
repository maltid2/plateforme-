"""Combinaison de plusieurs robots, chacun sur sa propre unité de temps, avec UNE position à la fois.

Les trades de chaque robot sont fusionnés par heure d'entrée ; un trade qui commence pendant une position
déjà ouverte (d'un autre robot) est ignoré. Approximation : un robot dont le trade est ignoré aurait pu
prendre un autre signal juste après ; l'effet est faible car les signaux sont rares.
"""
from __future__ import annotations

from .risk import RiskLimits, RiskManager
from .sizing import size_position
from .symbol import SymbolSpec


def merge(trade_lists: list[list]) -> list:
    allt = sorted(((t.entry_ts, prio, t) for prio, lst in enumerate(trade_lists) for t in lst), key=lambda x: x[:2])
    out, busy_until = [], -1
    for _, _, t in allt:
        if t.entry_ts < busy_until:
            continue
        out.append(t)
        busy_until = t.exit_ts
    return out


def simulate_account(trades: list, spec: SymbolSpec, equity: float = 100.0, limits: RiskLimits | None = None,
                     slippage: float = 0.05) -> dict:
    """Rejoue une liste de trades (en $/once) sur un compte : taille, refus au lot minimum, limites de perte."""
    risk = RiskManager(limits or RiskLimits())
    eq0, eq = equity, equity
    taken, refused, curve = 0, {}, []
    peak, dd = eq, 0.0
    for t in trades:
        day = str(t.entry_ts // 86400)
        risk.on_equity(day, eq)
        ok, why = risk.can_open(equity=eq, open_positions=0, workdir="/nonexistent")
        if not ok:
            refused[why.split(" (")[0]] = refused.get(why.split(" (")[0], 0) + 1
            continue
        initial_stop = t.entry - t.side * t.risk_dist   # t.stop peut avoir été remonté (breakeven)
        sr = size_position(spec, eq, risk.risk_pct(), t.entry, initial_stop, free_margin=eq, slippage=slippage)
        if not sr.ok:
            key = sr.reason.split(" =")[0]
            refused[key] = refused.get(key, 0) + 1
            continue
        risk.on_open()
        money = (t.pnl + 0.0) / spec.tick_size * spec.tick_value_loss * sr.volume - spec.commission_per_lot_rt * sr.volume
        eq += money
        taken += 1
        risk.on_equity(str(t.exit_ts // 86400), eq)
        peak = max(peak, eq)
        dd = max(dd, (peak - eq) / peak)
        curve.append((t.exit_ts, eq))
    return {"start": eq0, "final": eq, "taken": taken, "refused": refused, "max_dd_pct": 100 * dd, "curve": curve,
            "suspended": risk.state.suspended}
