"""Interface courtier commune (paper, rejeu, MT5)."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class AccountInfo:
    equity: float
    balance: float
    free_margin: float
    currency: str
    is_demo: bool
    login: int = 0
    server: str = ""


@dataclass
class Tick:
    ts: float      # UTC epoch s
    bid: float
    ask: float

    @property
    def spread(self) -> float:
        return self.ask - self.bid


@dataclass
class Position:
    ticket: int
    side: int
    volume: float
    price_open: float
    sl: float
    tp: float
    open_ts: float
    comment: str = ""
    magic: int = 0


@dataclass
class OrderResult:
    ok: bool
    retcode: int = 0
    ticket: int = 0
    volume: float = 0.0
    price: float = 0.0
    message: str = ""
    retryable: bool = False
    partial: bool = False


class Broker:
    """Méthodes attendues par le moteur. Toutes les heures en UTC."""

    def connect(self) -> bool: ...
    def connected(self) -> bool: ...
    def account(self) -> AccountInfo: ...
    def symbol_spec(self): ...
    def tick(self) -> Tick | None: ...
    def bars(self, tf_minutes: int, count: int): ...   # bougies CLÔTURÉES uniquement
    def positions(self) -> list[Position]: ...
    def was_executed(self, client_id: str, since_ts: float) -> bool: ...
    def market_order(self, side: int, volume: float, sl: float, tp: float | None, client_id: str) -> OrderResult: ...
    def modify_sl_tp(self, pos: Position, sl: float, tp: float | None) -> OrderResult: ...
    def close(self, pos: Position, reason: str) -> OrderResult: ...
    def now(self) -> float: ...
