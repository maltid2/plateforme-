"""Spécifications du symbole, telles que fournies par le courtier.

Aucune valeur de pip, de lot ou de marge n'est supposée : tout vient de SymbolSpec,
rempli depuis MT5 (mt5.symbol_info) ou depuis un fichier JSON exporté du courtier.
Les PRESETS ne servent qu'à l'étude de faisabilité et aux tests ; ils sont marqués comme exemples.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict, field
import json
import math


@dataclass
class SymbolSpec:
    name: str
    digits: int
    point: float                 # plus petit incrément de prix affiché
    tick_size: float             # SYMBOL_TRADE_TICK_SIZE
    tick_value_loss: float       # SYMBOL_TRADE_TICK_VALUE_LOSS : perte (devise du compte) par tick et par lot
    contract_size: float         # SYMBOL_TRADE_CONTRACT_SIZE (onces par lot)
    volume_min: float
    volume_max: float
    volume_step: float
    stops_level: int = 0         # distance minimale des stops, en points
    freeze_level: int = 0
    margin_per_lot: float = 0.0  # marge initiale par lot, devise du compte (mt5.order_calc_margin)
    account_currency: str = "EUR"
    profit_currency: str = "USD"
    commission_per_lot_rt: float = 0.0  # commission aller-retour par lot, devise du compte
    source: str = "broker"       # 'broker' (réel) ou 'example' (preset illustratif)
    notes: str = ""

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, ensure_ascii=False)

    @classmethod
    def from_json(cls, text: str) -> "SymbolSpec":
        return cls(**json.loads(text))

    @classmethod
    def from_mt5(cls, info, account_currency: str, margin_per_lot: float, commission_per_lot_rt: float = 0.0) -> "SymbolSpec":
        """info = mt5.symbol_info(symbol) ; margin_per_lot = mt5.order_calc_margin(BUY, symbol, 1.0, ask)."""
        tv = getattr(info, "trade_tick_value_loss", 0.0) or info.trade_tick_value
        return cls(
            name=info.name, digits=info.digits, point=info.point, tick_size=info.trade_tick_size,
            tick_value_loss=tv, contract_size=info.trade_contract_size, volume_min=info.volume_min,
            volume_max=info.volume_max, volume_step=info.volume_step, stops_level=info.trade_stops_level,
            freeze_level=info.trade_freeze_level, margin_per_lot=margin_per_lot,
            account_currency=account_currency, profit_currency=info.currency_profit,
            commission_per_lot_rt=commission_per_lot_rt, source="broker",
        )

    # --- conversions -----------------------------------------------------
    def loss_for(self, volume: float, distance: float) -> float:
        """Perte en devise du compte pour `volume` lots sur `distance` de prix."""
        ticks = distance / self.tick_size
        return ticks * self.tick_value_loss * volume

    def money_per_price_unit(self, volume: float) -> float:
        return self.loss_for(volume, self.tick_size) / self.tick_size

    def round_volume_down(self, volume: float) -> float:
        steps = math.floor(volume / self.volume_step + 1e-9)
        return round(steps * self.volume_step, 8)


def example_presets(gold_price: float = 4300.0, eurusd: float = 1.16) -> dict[str, SymbolSpec]:
    """Exemples typiques (À REMPLACER par la spec réelle du courtier).

    - eu_retail : CFD or chez un courtier régulé UE (ESMA : levier max 1:20 sur l'or pour un client particulier).
    - eu_retail_micro : même chose avec un lot minimum 0,001 (proposé par certains courtiers ; à vérifier).
    - cent : compte « cent » (solde exprimé en cents ; 0,01 lot ≈ 0,01 once). Surtout proposé par des
      entités hors UE : vérifier l'autorisation du courtier en France (liste AMF / REGAFI) avant tout usage.
    """
    usd_to_eur = 1.0 / eurusd
    # 1 lot = 100 oz ; tick 0,01 $ ; valeur du tick pour 1 lot = 100 * 0,01 $ = 1 $ -> en EUR
    eu = SymbolSpec(
        name="XAUUSD", digits=2, point=0.01, tick_size=0.01, tick_value_loss=1.0 * usd_to_eur,
        contract_size=100, volume_min=0.01, volume_max=50, volume_step=0.01, stops_level=0,
        margin_per_lot=100 * gold_price / 20 * usd_to_eur, account_currency="EUR",
        commission_per_lot_rt=0.0, source="example", notes="CFD UE, levier 1:20 (ESMA)",
    )
    micro = SymbolSpec(**{**asdict(eu), "volume_min": 0.001, "volume_step": 0.001, "notes": "lot min 0,001 (rare)"})
    cent = SymbolSpec(
        name="XAUUSDc", digits=2, point=0.01, tick_size=0.01, tick_value_loss=0.01 * usd_to_eur,
        contract_size=1, volume_min=0.01, volume_max=100, volume_step=0.01, stops_level=0,
        margin_per_lot=1 * gold_price / 500 * usd_to_eur, account_currency="EUR",
        commission_per_lot_rt=0.0, source="example",
        notes="compte cent : 1 lot = 1 once ; levier 1:500 typique hors UE",
    )
    return {"eu_retail": eu, "eu_retail_micro": micro, "cent": cent}
