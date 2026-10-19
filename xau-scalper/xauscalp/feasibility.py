"""Étude de faisabilité économique : le compte peut-il respecter le risque avec le lot minimum ?"""
from __future__ import annotations

from .symbol import SymbolSpec


def feasibility(spec: SymbolSpec, *, equity: float, risk_pct: float, price: float, stop_distances: list[float],
                cost_per_oz: float = 0.30, max_margin_usage: float = 0.5) -> dict:
    """stop_distances : distances entrée-stop ($) mesurées sur les signaux d'une stratégie."""
    allowed = equity * risk_pct / 100
    money_per_usd_min = spec.loss_for(spec.volume_min, 1.0)       # devise du compte par $ de mouvement au lot min
    comm_min = spec.commission_per_lot_rt * spec.volume_min
    max_stop = (allowed - comm_min) / money_per_usd_min - cost_per_oz if money_per_usd_min > 0 else 0.0
    margin_min = spec.margin_per_lot * spec.volume_min
    ok_stops = [d for d in stop_distances if d <= max_stop]
    med = sorted(stop_distances)[len(stop_distances) // 2] if stop_distances else 0.0
    eq_risk = ((med + cost_per_oz) * money_per_usd_min + comm_min) / (risk_pct / 100) if med else 0.0
    eq_margin = margin_min / max_margin_usage
    return {
        "symbol": spec.name, "source": spec.source, "notes": spec.notes,
        "risk_allowed": allowed,
        "loss_per_usd_at_min_lot": money_per_usd_min,
        "max_stop_usd_at_min_lot": max(0.0, max_stop),
        "margin_min_lot": margin_min,
        "margin_ok": margin_min <= equity * max_margin_usage,
        "median_stop_usd": med,
        "share_signals_sizeable": (len(ok_stops) / len(stop_distances) if stop_distances else 0.0)
        if margin_min <= equity * max_margin_usage else 0.0,
        "equity_needed_for_median_stop": max(eq_risk, eq_margin),
        "price": price,
    }
