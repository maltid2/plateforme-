"""Configuration du moteur. LE MODE RÉEL EST DÉSACTIVÉ PAR DÉFAUT."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
import json
import os

from .risk import RiskLimits

LIVE_ENV = "XAUSCALP_LIVE"
LIVE_PHRASE = "JE_COMPRENDS_LES_RISQUES"


@dataclass
class EngineConfig:
    mode: str = "paper"                     # 'paper' (rejeu/simulation), 'demo' (compte démo MT5), 'live'
    live_enabled: bool = False              # verrou n°1 : à passer à true À LA MAIN après la grille de validation
    symbol: str = "XAUUSD"
    tf: int = 5
    history_bars: int = 3000
    strategy: str = "ny_orb"
    strategy_params: dict = field(default_factory=dict)
    h1_filter: bool = False
    members: list = field(default_factory=list)  # plusieurs robots : [{"name", "params", "tf", "sessions", "h1"}]
    sessions: list = field(default_factory=lambda: ["overlap"])
    news_csv: str = ""                      # calendrier exporté de MT5 (mql5/ExportCalendar.mq5)
    news_before_min: int = 30
    news_after_min: int = 30
    flatten_before_news_min: int = 5
    max_atr_ratio: float = 3.0
    risk: RiskLimits = field(default_factory=RiskLimits)
    server_tz: str = "paris+1"
    commission_per_lot_rt: float = 0.0
    deviation_points: int = 30
    magic: int = 26101
    poll_seconds: float = 2.0
    order_retries: int = 2
    intent_timeout_s: float = 60.0
    state_dir: str = "state"
    mt5_login: int | None = None
    mt5_server: str | None = None
    mt5_path: str | None = None             # le mot de passe vient de la variable d'environnement XAUSCALP_MT5_PASSWORD

    @classmethod
    def load(cls, path: str) -> "EngineConfig":
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        risk = RiskLimits(**d.pop("risk", {}))
        d = {k: v for k, v in d.items() if not k.startswith("_")}  # clés de commentaire
        return cls(risk=risk, **d)

    def to_dict(self) -> dict:
        return asdict(self)


def live_allowed(cfg: EngineConfig, account_is_demo: bool) -> tuple[bool, str]:
    """Trois verrous pour le réel : live_enabled, variable d'environnement, compte réel détecté."""
    if cfg.mode == "paper":
        return True, "paper"
    if cfg.mode == "demo":
        return (True, "démo") if account_is_demo else (False, "mode démo mais le compte connecté est RÉEL : refus")
    if cfg.mode == "live":
        if not cfg.live_enabled:
            return False, "mode réel désactivé (live_enabled=false)"
        if os.environ.get(LIVE_ENV) != LIVE_PHRASE:
            return False, f"variable {LIVE_ENV} absente : refus du mode réel"
        if account_is_demo:
            return False, "mode réel demandé mais compte démo connecté"
        return True, "réel"
    return False, f"mode inconnu {cfg.mode}"
