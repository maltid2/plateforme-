"""Calcul de la taille de position : refuse tout ordre dont le risque minimal dépasse la limite."""
from __future__ import annotations

from dataclasses import dataclass
from .symbol import SymbolSpec


@dataclass
class SizeResult:
    volume: float
    risk_money: float          # perte estimée au stop, frais inclus, devise du compte
    allowed_money: float
    margin: float
    ok: bool
    reason: str


def size_position(spec: SymbolSpec, equity: float, risk_pct: float, entry: float, stop: float, *,
                  free_margin: float | None = None, max_margin_usage: float = 0.5,
                  spread: float = 0.0, slippage: float = 0.0) -> SizeResult:
    """Taille = plus grand volume (multiple du pas) dont la perte au stop, frais compris, <= risk_pct de l'equity.

    La perte potentielle inclut : distance entrée-stop, spread payé à la sortie, slippage supposé,
    commission aller-retour. Ce n'est PAS une garantie : un gap peut sortir au-delà du stop.
    """
    allowed = equity * risk_pct / 100.0
    distance = abs(entry - stop)
    if distance <= 0:
        return SizeResult(0, 0, allowed, 0, False, "stop invalide")
    if spec.stops_level and distance < spec.stops_level * spec.point:
        return SizeResult(0, 0, allowed, 0, False, f"stop plus proche que stops_level ({spec.stops_level} pts)")
    cost_distance = distance + spread + slippage

    def risk_of(vol: float) -> float:
        return spec.loss_for(vol, cost_distance) + spec.commission_per_lot_rt * vol

    per_lot = risk_of(1.0)
    vol = spec.round_volume_down(min(allowed / per_lot, spec.volume_max))
    if vol < spec.volume_min - 1e-12:
        r = risk_of(spec.volume_min)
        return SizeResult(0, r, allowed, spec.margin_per_lot * spec.volume_min, False,
                          f"lot minimum {spec.volume_min} = perte {r:.2f} {spec.account_currency} > limite {allowed:.2f}")
    margin = spec.margin_per_lot * vol
    if free_margin is not None and margin > free_margin * max_margin_usage:
        return SizeResult(0, risk_of(vol), allowed, margin, False,
                          f"marge {margin:.2f} > {max_margin_usage:.0%} de la marge libre {free_margin:.2f}")
    return SizeResult(vol, risk_of(vol), allowed, margin, True, "ok")
