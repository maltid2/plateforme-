"""Paper trading : rejeu d'un historique (ou flux de prix) avec exécution simulée.

ReplayBroker avance bougie par bougie : les ordres au marché sont exécutés à l'ouverture de la bougie
suivante (comme le backtest), les stops/targets sont vérifiés sur les extrêmes bid/ask de chaque bougie,
le stop étant prioritaire. Sert aux tests de bout en bout du moteur et à la comparaison signaux/ordres.
"""
from __future__ import annotations

import random

from ..data import Bars, resample
from ..symbol import SymbolSpec
from .base import AccountInfo, Broker, OrderResult, Position, Tick


class ReplayBroker(Broker):
    def __init__(self, bars: Bars, spec: SymbolSpec, *, equity: float = 100.0, start_index: int = 500,
                 slippage: float = 0.03, stop_slippage: float = 0.05, default_spread: float = 0.25,
                 reject_prob: float = 0.0, seed: int = 3, magic: int = 26101):
        self.b, self.spec = bars, spec
        self.k = start_index            # index de la bougie EN COURS (non clôturée)
        self.balance = equity
        self.slip, self.stop_slip, self.default_spread = slippage, stop_slippage, default_spread
        self.reject_prob, self.rng = reject_prob, random.Random(seed)
        self.magic = magic
        self._pos: list[Position] = []
        self._ticket = 1000
        self.executed: dict[str, Position] = {}
        self.closed: list[dict] = []
        self._connected = True
        self.fail_next_orders = 0       # pour tester la gestion des rejets

    # --- temps / données ---------------------------------------------------
    def spread_at(self, k: int) -> float:
        return self.b.spread[k] if self.b.spread is not None else self.default_spread

    def now(self) -> float:
        return float(self.b.t[self.k])  # début de la bougie en cours = clôture de la précédente

    def advance(self) -> bool:
        """Joue la bougie en cours (stops/targets) puis passe à la suivante."""
        if self.k + 1 >= len(self.b):
            return False
        self._check_exits(self.k)
        self.k += 1
        return True

    def connect(self) -> bool:
        self._connected = True
        return True

    def connected(self) -> bool:
        return self._connected

    def account(self) -> AccountInfo:
        return AccountInfo(self.equity(), self.balance, self.equity(), self.spec.account_currency, True, 1, "replay")

    def equity(self) -> float:
        t = self.tick()
        return self.balance + sum(self._money(p, (t.bid if p.side > 0 else t.ask) - p.price_open) for p in self._pos)

    def symbol_spec(self) -> SymbolSpec:
        return self.spec

    def tick(self) -> Tick:
        k = self.k
        sp = self.spread_at(k)
        return Tick(self.now(), self.b.o[k], self.b.o[k] + sp)

    def bars(self, tf_minutes: int, count: int) -> Bars:
        if tf_minutes == self.b.tf:
            return self.b.slice(max(0, self.k - count), self.k)
        if tf_minutes % self.b.tf:
            raise ValueError("ReplayBroker : unité de temps non multiple des bougies rejouées")
        # unité supérieure reconstruite à partir des bougies déjà clôturées ; la dernière doit être complète
        ratio = tf_minutes // self.b.tf
        base = self.b.slice(max(0, self.k - count * ratio - ratio), self.k)
        hb = resample(base, tf_minutes)
        if len(hb) and hb.t[-1] + tf_minutes * 60 > self.now():
            hb = hb.slice(0, len(hb) - 1)
        if len(hb) and base.t and hb.t[0] < base.t[0]:
            hb = hb.slice(1, len(hb))
        return hb.slice(max(0, len(hb) - count), len(hb))

    # --- ordres ----------------------------------------------------------------
    def positions(self) -> list[Position]:
        return list(self._pos)

    def was_executed(self, client_id: str, since_ts: float) -> bool:
        return client_id in self.executed

    def market_order(self, side, volume, sl, tp, client_id) -> OrderResult:
        if self.fail_next_orders > 0:
            self.fail_next_orders -= 1
            return OrderResult(False, 10006, message="rejet simulé", retryable=False)
        if self.reject_prob and self.rng.random() < self.reject_prob:
            return OrderResult(False, 10004, message="requote simulé", retryable=True)
        t = self.tick()
        price = (t.ask + self.slip) if side > 0 else (t.bid - self.slip)
        self._ticket += 1
        p = Position(self._ticket, side, volume, price, sl, tp or 0.0, t.ts, client_id, self.magic)
        self._pos.append(p)
        self.executed[client_id] = p
        return OrderResult(True, 10009, p.ticket, volume, price)

    def modify_sl_tp(self, pos, sl, tp) -> OrderResult:
        pos.sl, pos.tp = sl, tp or 0.0
        return OrderResult(True, 10009, pos.ticket)

    def close(self, pos, reason) -> OrderResult:
        t = self.tick()
        price = (t.bid - self.slip) if pos.side > 0 else (t.ask + self.slip)
        self._settle(pos, price, reason, t.ts)
        return OrderResult(True, 10009, pos.ticket, pos.volume, price)

    # --- interne ---------------------------------------------------------------
    def _money(self, p: Position, move: float) -> float:
        return move * p.side / self.spec.tick_size * self.spec.tick_value_loss * p.volume

    def _settle(self, p: Position, price: float, reason: str, ts: float):
        gross = (price - p.price_open) * p.side
        money = gross / self.spec.tick_size * self.spec.tick_value_loss * p.volume - self.spec.commission_per_lot_rt * p.volume
        self.balance += money
        self._pos.remove(p)
        self.closed.append({"ticket": p.ticket, "side": p.side, "entry": p.price_open, "exit": price, "reason": reason,
                            "open_ts": p.open_ts, "close_ts": ts, "money": money, "comment": p.comment, "volume": p.volume})

    def _check_exits(self, k: int):
        b = self.b
        sp = self.spread_at(k)
        ask_h = b.ask_h[k] if b.ask_h is not None else b.h[k] + sp
        ask_l = b.ask_l[k] if b.ask_l is not None else b.l[k] + sp
        for p in list(self._pos):
            if p.side > 0:
                if p.sl and b.l[k] <= p.sl:
                    self._settle(p, min(p.sl, b.o[k]) - self.stop_slip, "stop", b.t[k])
                elif p.tp and b.h[k] >= p.tp:
                    self._settle(p, p.tp, "target", b.t[k])
            else:
                if p.sl and ask_h >= p.sl:
                    self._settle(p, max(p.sl, b.o[k] + sp) + self.stop_slip, "stop", b.t[k])
                elif p.tp and ask_l <= p.tp:
                    self._settle(p, p.tp, "target", b.t[k])
