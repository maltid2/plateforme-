"""Contexte de marché : bougies + indicateurs (cache) + sessions + niveaux du jour + régime.

Tout est calculé pour que la valeur à l'index k n'utilise que l'information disponible à la
CLÔTURE de la bougie k (pas de look-ahead). Les tests unitaires le vérifient.
"""
from __future__ import annotations

from . import indicators as I
from .data import Bars, resample
from .sessions import SessionClock, SESSIONS, LON

NaN = float("nan")


class Market:
    def __init__(self, bars: Bars, *, spread_profile: dict[int, float] | None = None, default_spread: float = 0.30):
        self.b = bars
        self.tf = bars.tf
        self.n = len(bars)
        self.clock = SessionClock()
        self._cache: dict = {}
        self.spread_profile = spread_profile
        self.default_spread = default_spread
        info = [self.clock.info(t) for t in bars.t]
        self.lon_min = [x[0] for x in info]
        self.ny_min = [x[1] for x in info]
        self.day = [x[2] for x in info]
        self.weekday = [x[3] for x in info]
        self._levels()

    # --- coûts -----------------------------------------------------------------
    def spread(self, k: int) -> float:
        if self.b.spread is not None:
            return self.b.spread[k]
        if self.spread_profile:
            return self.spread_profile.get((self.b.t[k] // 3600) % 24, self.default_spread)
        return self.default_spread

    def ask_high(self, k: int) -> float:
        return self.b.ask_h[k] if self.b.ask_h is not None else self.b.h[k] + self.spread(k)

    def ask_low(self, k: int) -> float:
        return self.b.ask_l[k] if self.b.ask_l is not None else self.b.l[k] + self.spread(k)

    # --- indicateurs en cache ------------------------------------------------
    def get(self, name: str, *args):
        key = (name,) + args
        v = self._cache.get(key)
        if v is None:
            v = self._compute(name, *args)
            self._cache[key] = v
        return v

    def _compute(self, name: str, *args):
        b = self.b
        if name == "ema":
            return I.ema(b.c, args[0])
        if name == "sma":
            return I.sma(b.c, args[0])
        if name == "atr":
            return I.atr(b.h, b.l, b.c, args[0])
        if name == "rsi":
            return I.rsi(b.c, args[0])
        if name == "std":
            return I.rolling_std(b.c, args[0])
        if name == "vol_sma":
            return I.sma(b.v, args[0])
        if name == "hh":   # plus haut des n bougies PRÉCÉDENTES (bougie courante exclue)
            return I.shift(I.rolling_max(b.h, args[0]), 1)
        if name == "ll":
            return I.shift(I.rolling_min(b.l, args[0]), 1)
        if name == "er":
            return I.efficiency_ratio(b.c, args[0])
        if name == "atr_ratio":  # ATR court / moyenne longue de l'ATR : régime de volatilité
            a = self.get("atr", 14)
            base = I.sma([x if x == x else 0.0 for x in a], args[0])
            return [a[k] / base[k] if base[k] == base[k] and base[k] > 0 and a[k] == a[k] else NaN for k in range(self.n)]
        if name == "vwap":
            return I.session_vwap(b.t, b.h, b.l, b.c, b.v)
        if name == "htf":   # (minutes, indicateur, période) mappé sur l'unité basse
            minutes, ind, p = args
            hb = resample(b, minutes)
            if ind == "ema":
                vals = I.ema(hb.c, p)
            elif ind == "er":
                vals = I.efficiency_ratio(hb.c, p)
            elif ind == "close":
                vals = hb.c
            elif ind == "ema_slope":
                e = I.ema(hb.c, p)
                vals = [NaN] * 3 + [e[k] - e[k - 3] for k in range(3, len(e))]
            elif ind == "atr":
                vals = I.atr(hb.h, hb.l, hb.c, p)
            else:
                raise KeyError(ind)
            return I.map_higher(b.t, self.tf, hb.t, minutes, vals)
        raise KeyError(name)

    def bars_for(self, minutes: float) -> int:
        return max(1, round(minutes / self.tf))

    # --- niveaux de session ----------------------------------------------------
    def _levels(self):
        """Haut/bas de la veille (jour de trading) et de l'Asie (00:00-07:00 Londres), connus à la clôture."""
        n = self.n
        self.pdh = [NaN] * n
        self.pdl = [NaN] * n
        self.asia_hi = [NaN] * n   # disponible seulement après 07:00 Londres
        self.asia_lo = [NaN] * n
        cur_day, hi, lo, prev_hi, prev_lo = None, -1e18, 1e18, NaN, NaN
        a_hi, a_lo, a_day = -1e18, 1e18, None
        _, a0, a1 = SESSIONS["asia"]
        for k in range(n):
            d = self.day[k]
            if d != cur_day:
                if cur_day is not None:
                    prev_hi, prev_lo = hi, lo
                cur_day, hi, lo = d, -1e18, 1e18
            hi, lo = max(hi, self.b.h[k]), min(lo, self.b.l[k])
            self.pdh[k], self.pdl[k] = prev_hi, prev_lo
            lm = self.lon_min[k]
            if a_day != d:
                a_day, a_hi, a_lo = d, -1e18, 1e18
            if a0 <= lm < a1:
                a_hi, a_lo = max(a_hi, self.b.h[k]), min(a_lo, self.b.l[k])
            elif lm >= a1 and a_hi > -1e18 and lm < 22 * 60:
                self.asia_hi[k], self.asia_lo[k] = a_hi, a_lo

    # --- régime -------------------------------------------------------------------
    def regime(self, k: int) -> str:
        """'trend', 'range', 'volatile' ou 'chaotic' (seuils fixés a priori, non optimisés)."""
        er = self.get("htf", 60, "er", 12)[k]
        vr = self.get("atr_ratio", self.bars_for(5 * 1440))[k]
        if er != er or vr != vr:
            return "unknown"
        if vr >= 1.8:
            return "volatile"
        if er >= 0.30:
            return "trend"
        if er <= 0.15 and vr <= 1.2:
            return "range"
        return "chaotic"

    def h1_trend(self, k: int) -> int:
        """+1 / -1 si la clôture H1 est du côté de l'EMA50 H1 et que celle-ci a la même pente, sinon 0."""
        c = self.get("htf", 60, "close", 0)[k]
        e = self.get("htf", 60, "ema", 50)[k]
        s = self.get("htf", 60, "ema_slope", 50)[k]
        if c != c or e != e or s != s:
            return 0
        if c > e and s > 0:
            return 1
        if c < e and s < 0:
            return -1
        return 0
