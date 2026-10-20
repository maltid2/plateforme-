"""Connecteur MetaTrader 5 (paquet Python officiel `MetaTrader5`, Windows uniquement).

- Spécifications lues chez le courtier (symbol_info, order_calc_margin) : aucune valeur codée en dur.
- order_check avant chaque order_send ; mode de remplissage déduit du symbole.
- Codes retour gérés : exécution partielle, requote/prix changé (réessai possible), stops invalides,
  fonds insuffisants, marché fermé, trading désactivé.
- Une position sans stop n'est jamais conservée : stop posé après coup, sinon fermeture immédiate.
- Le module `mt5` est injectable (tests avec un faux module).
"""
from __future__ import annotations

from datetime import datetime, timezone
import time

from ..data import Bars, ServerClock
from ..symbol import SymbolSpec
from .base import AccountInfo, Broker, OrderResult, Position, Tick

UTC = timezone.utc

RET_DONE, RET_PARTIAL, RET_PLACED = 10009, 10010, 10008
RETRYABLE = {10004: "requote", 10020: "prix changé", 10021: "pas de prix", 10024: "trop de requêtes", 10031: "pas de connexion"}
FATAL = {10013: "requête invalide", 10014: "volume invalide", 10015: "prix invalide", 10016: "stops invalides",
         10017: "trading désactivé", 10018: "marché fermé", 10019: "fonds insuffisants", 10026: "autotrading désactivé (serveur)",
         10027: "autotrading désactivé (terminal)", 10030: "mode de remplissage non supporté"}


class MT5Broker(Broker):
    def __init__(self, symbol: str = "XAUUSD", *, magic: int = 26101, deviation_points: int = 30,
                 server_tz: str = "paris+1", commission_per_lot_rt: float = 0.0, login: int | None = None,
                 password: str | None = None, server: str | None = None, terminal_path: str | None = None,
                 mt5_module=None):
        if mt5_module is None:
            import MetaTrader5 as mt5_module  # noqa: N813 - paquet officiel
        self.mt5 = mt5_module
        self.symbol, self.magic, self.deviation = symbol, magic, deviation_points
        self.clock = ServerClock(server_tz)
        self.commission = commission_per_lot_rt
        self.creds = dict(login=login, password=password, server=server)
        self.path = terminal_path
        self._spec: SymbolSpec | None = None

    # --- connexion ---------------------------------------------------------
    def connect(self) -> bool:
        kw = {k: v for k, v in self.creds.items() if v}
        ok = self.mt5.initialize(self.path, **kw) if self.path else self.mt5.initialize(**kw)
        if not ok:
            return False
        return bool(self.mt5.symbol_select(self.symbol, True))

    def connected(self) -> bool:
        info = self.mt5.terminal_info()
        return bool(info and info.connected)

    def now(self) -> float:
        return time.time()

    def _server_ts_to_utc(self, ts: int) -> float:
        return float(self.clock.to_utc(datetime.fromtimestamp(int(ts), UTC).replace(tzinfo=None)))

    # --- compte et symbole -------------------------------------------------
    def account(self) -> AccountInfo:
        a = self.mt5.account_info()
        return AccountInfo(a.equity, a.balance, a.margin_free, a.currency,
                           a.trade_mode == self.mt5.ACCOUNT_TRADE_MODE_DEMO, a.login, a.server)

    def symbol_spec(self) -> SymbolSpec:
        info = self.mt5.symbol_info(self.symbol)
        tick = self.mt5.symbol_info_tick(self.symbol)
        margin = self.mt5.order_calc_margin(self.mt5.ORDER_TYPE_BUY, self.symbol, 1.0, tick.ask) or 0.0
        self._spec = SymbolSpec.from_mt5(info, self.account().currency, margin, self.commission)
        return self._spec

    def tick(self) -> Tick | None:
        t = self.mt5.symbol_info_tick(self.symbol)
        if t is None:
            return None
        return Tick(self._server_ts_to_utc(t.time), t.bid, t.ask)

    def bars(self, tf_minutes: float, count: int) -> Bars:
        if tf_minutes < 1:
            return self._tick_bars(int(round(tf_minutes * 60)), count)
        tfmap = {1: self.mt5.TIMEFRAME_M1, 5: self.mt5.TIMEFRAME_M5, 15: self.mt5.TIMEFRAME_M15, 60: self.mt5.TIMEFRAME_H1}
        rates = self.mt5.copy_rates_from_pos(self.symbol, tfmap[tf_minutes], 1, count)  # 1 = bougies clôturées
        b = Bars(tf_minutes, spread=[], source=f"mt5:{self.symbol}")
        if rates is None:
            return b
        point = (self._spec or self.symbol_spec()).point
        for r in rates:
            b.t.append(int(self._server_ts_to_utc(r["time"])))
            b.o.append(float(r["open"])); b.h.append(float(r["high"])); b.l.append(float(r["low"])); b.c.append(float(r["close"]))
            b.v.append(float(r["tick_volume"])); b.spread.append(float(r["spread"]) * point)
        return b

    def _tick_bars(self, seconds: int, count: int) -> Bars:
        """Bougies de quelques secondes construites à partir des ticks (MT5 n'a pas d'unité < M1)."""
        mt = self.mt5
        last = mt.symbol_info_tick(self.symbol)
        start = datetime.fromtimestamp(int(last.time) - (count + 2) * seconds, UTC)
        ticks = mt.copy_ticks_from(self.symbol, start, count * seconds * 20, mt.COPY_TICKS_INFO)
        b = Bars(seconds / 60, spread=[], ask_h=[], ask_l=[], source=f"mt5-ticks:{self.symbol}")
        if ticks is None:
            return b
        cur, n_sp = None, 0
        for tk in ticks:
            ts = int(self._server_ts_to_utc(int(tk["time_msc"]) // 1000))
            key, bid, ask = ts - ts % seconds, float(tk["bid"]), float(tk["ask"])
            if bid <= 0 or ask <= 0:
                continue
            if key != cur:
                if cur is not None:
                    b.spread[-1] /= n_sp
                cur, n_sp = key, 0
                b.t.append(key); b.o.append(bid); b.h.append(bid); b.l.append(bid); b.c.append(bid); b.v.append(0.0)
                b.spread.append(0.0); b.ask_h.append(ask); b.ask_l.append(ask)
            b.h[-1], b.l[-1], b.c[-1] = max(b.h[-1], bid), min(b.l[-1], bid), bid
            b.v[-1] += 1; b.spread[-1] += ask - bid; n_sp += 1
            b.ask_h[-1], b.ask_l[-1] = max(b.ask_h[-1], ask), min(b.ask_l[-1], ask)
        if cur is not None and n_sp:
            b.spread[-1] /= n_sp
        now = self._server_ts_to_utc(int(last.time))
        if len(b) and b.t[-1] + seconds > now:   # dernière bougie pas encore clôturée
            b = b.slice(0, len(b) - 1)
        return b.slice(max(0, len(b) - count), len(b))

    # --- positions -------------------------------------------------------------
    def positions(self) -> list[Position]:
        out = []
        for p in self.mt5.positions_get(symbol=self.symbol) or ():
            if p.magic != self.magic:
                continue
            side = 1 if p.type == self.mt5.POSITION_TYPE_BUY else -1
            out.append(Position(p.ticket, side, p.volume, p.price_open, p.sl, p.tp, self._server_ts_to_utc(p.time), p.comment, p.magic))
        return out

    def was_executed(self, client_id: str, since_ts: float) -> bool:
        """Après un redémarrage : l'ordre a-t-il été exécuté (position ouverte ou deal dans l'historique) ?"""
        if any(p.comment == client_id for p in self.positions()):
            return True
        deals = self.mt5.history_deals_get(datetime.fromtimestamp(since_ts - 86400, UTC), datetime.now(UTC) ) or ()
        return any(d.comment == client_id and d.magic == self.magic for d in deals)

    def _filling(self) -> int:
        fm = self.mt5.symbol_info(self.symbol).filling_mode
        if fm & 1:
            return self.mt5.ORDER_FILLING_FOK
        if fm & 2:
            return self.mt5.ORDER_FILLING_IOC
        return self.mt5.ORDER_FILLING_RETURN

    def _send(self, req: dict) -> OrderResult:
        chk = self.mt5.order_check(req)
        if chk is None or chk.retcode not in (0, RET_DONE):
            code = getattr(chk, "retcode", -1)
            return OrderResult(False, code, message=f"order_check : {FATAL.get(code) or RETRYABLE.get(code) or getattr(chk, 'comment', self.mt5.last_error())}",
                               retryable=code in RETRYABLE)
        r = self.mt5.order_send(req)
        if r is None:
            return OrderResult(False, -1, message=f"order_send : {self.mt5.last_error()}", retryable=True)
        if r.retcode in (RET_DONE, RET_PLACED):
            return OrderResult(True, r.retcode, r.order, r.volume, r.price)
        if r.retcode == RET_PARTIAL:
            return OrderResult(True, r.retcode, r.order, r.volume, r.price, "exécution partielle", partial=True)
        return OrderResult(False, r.retcode, message=FATAL.get(r.retcode) or RETRYABLE.get(r.retcode) or r.comment,
                           retryable=r.retcode in RETRYABLE)

    def market_order(self, side, volume, sl, tp, client_id) -> OrderResult:
        t = self.mt5.symbol_info_tick(self.symbol)
        mt = self.mt5
        req = {"action": mt.TRADE_ACTION_DEAL, "symbol": self.symbol, "volume": float(volume),
               "type": mt.ORDER_TYPE_BUY if side > 0 else mt.ORDER_TYPE_SELL,
               "price": t.ask if side > 0 else t.bid, "sl": float(sl), "tp": float(tp or 0.0),
               "deviation": self.deviation, "magic": self.magic, "comment": client_id[:31],
               "type_time": mt.ORDER_TIME_GTC, "type_filling": self._filling()}
        res = self._send(req)
        if res.ok:
            # stop réellement posé ? sinon on le pose, et à défaut on ferme : jamais de position sans stop
            pos = next((p for p in self.positions() if p.comment == client_id[:31]), None)
            if pos is not None and not pos.sl:
                mod = self.modify_sl_tp(pos, sl, tp)
                if not mod.ok:
                    self.close(pos, "stop impossible à poser")
                    return OrderResult(False, mod.retcode, message="stop refusé : position fermée")
            if pos is not None:
                res.volume = pos.volume
        return res

    def modify_sl_tp(self, pos, sl, tp) -> OrderResult:
        mt = self.mt5
        return self._send({"action": mt.TRADE_ACTION_SLTP, "symbol": self.symbol, "position": pos.ticket,
                           "sl": float(sl), "tp": float(tp or 0.0), "magic": self.magic})

    def close(self, pos, reason) -> OrderResult:
        mt = self.mt5
        t = mt.symbol_info_tick(self.symbol)
        return self._send({"action": mt.TRADE_ACTION_DEAL, "symbol": self.symbol, "position": pos.ticket,
                           "volume": float(pos.volume), "type": mt.ORDER_TYPE_SELL if pos.side > 0 else mt.ORDER_TYPE_BUY,
                           "price": t.bid if pos.side > 0 else t.ask, "deviation": self.deviation, "magic": self.magic,
                           "comment": f"close:{reason}"[:31], "type_time": mt.ORDER_TIME_GTC, "type_filling": self._filling()})
