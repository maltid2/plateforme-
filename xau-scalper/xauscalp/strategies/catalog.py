"""Catalogue de stratégies. Règles exactes dans docs/STRATEGIES.md (mêmes noms de paramètres).

Convention : signal évalué à la CLÔTURE de la bougie k, exécution à l'ouverture suivante.
"""
from __future__ import annotations

from .base import Signal, Strategy

NaN = float("nan")


def _clip_stop(side: int, close: float, stop: float, a: float, max_atr: float) -> float:
    """Ramène un stop trop lointain à max_atr x ATR (plus proche)."""
    if side > 0:
        return max(stop, close - max_atr * a)
    return min(stop, close + max_atr * a)


def _target(side: int, close: float, stop: float, rr: float) -> float:
    return close + side * rr * abs(close - stop)


# ---------------------------------------------------------------------------- A
class TrendPullback(Strategy):
    """A. Pullback de tendance : tendance H1 + EMA M5, repli sur l'EMA rapide, reprise."""
    name, family = "trend_pullback", "tendance"
    defaults = dict(ema_fast=20, ema_slow=50, lookback=6, touch_atr=0.1, stop_buf_atr=0.2, rr=1.5,
                    min_stop_atr=0.5, max_stop_atr=3.0, max_minutes=120, htf=True)
    grid = dict(rr=[1.0, 1.5, 2.0], lookback=[4, 6, 10], ema_fast=[13, 20, 34])

    def signal(self, m, k):
        p, b = self.p, m.b
        lb = p["lookback"]
        if k < lb + 2:
            return None
        ef, es, a = m.get("ema", p["ema_fast"])[k], m.get("ema", p["ema_slow"])[k], m.get("atr", 14)[k]
        if not self.ok(ef, es, a) or a <= 0:
            return None
        trend = m.h1_trend(k) if p["htf"] else (1 if ef > es else -1)
        c = b.c[k]
        if trend > 0 and ef > es:
            lo = min(b.l[k - lb + 1:k + 1])
            if lo <= ef + p["touch_atr"] * a and c > ef and c > b.o[k] and c > b.h[k - 1]:
                stop = lo - p["stop_buf_atr"] * a
                d = c - stop
                if p["min_stop_atr"] * a <= d <= p["max_stop_atr"] * a:
                    return Signal(1, stop, _target(1, c, stop, p["rr"]), p["max_minutes"], "pullback haussier")
        if trend < 0 and ef < es:
            hi = max(b.h[k - lb + 1:k + 1])
            if hi >= ef - p["touch_atr"] * a and c < ef and c < b.o[k] and c < b.l[k - 1]:
                stop = hi + p["stop_buf_atr"] * a
                d = stop - c
                if p["min_stop_atr"] * a <= d <= p["max_stop_atr"] * a:
                    return Signal(-1, stop, _target(-1, c, stop, p["rr"]), p["max_minutes"], "pullback baissier")
        return None


# ---------------------------------------------------------------------------- B1
class AsiaRangeBreakout(Strategy):
    """B1. Cassure confirmée du range asiatique (clôture au-delà + corps plein)."""
    name, family = "asia_breakout", "breakout"
    defaults = dict(buffer_atr=0.1, min_range_atr=2.0, max_range_atr=15.0, body_min=0.5, rr=1.5,
                    max_stop_atr=3.0, max_minutes=180)
    grid = dict(rr=[1.0, 1.5, 2.0], buffer_atr=[0.0, 0.1, 0.3], body_min=[0.3, 0.5, 0.7])

    def signal(self, m, k):
        p, b = self.p, m.b
        hi, lo, a = m.asia_hi[k], m.asia_lo[k], m.get("atr", 14)[k]
        if k < 2 or not self.ok(hi, lo, a, m.asia_hi[k - 1]) or a <= 0:
            return None
        rng = hi - lo
        if not p["min_range_atr"] * a <= rng <= p["max_range_atr"] * a:
            return None
        c, o, h, l = b.c[k], b.o[k], b.h[k], b.l[k]
        if h - l <= 0 or abs(c - o) / (h - l) < p["body_min"]:
            return None
        mid, buf = (hi + lo) / 2, p["buffer_atr"] * a
        if c > hi + buf and b.c[k - 1] <= hi + buf and c > o:
            stop = _clip_stop(1, c, mid, a, p["max_stop_atr"])
            return Signal(1, stop, _target(1, c, stop, p["rr"]), p["max_minutes"], "cassure haut Asie")
        if c < lo - buf and b.c[k - 1] >= lo - buf and c < o:
            stop = _clip_stop(-1, c, mid, a, p["max_stop_atr"])
            return Signal(-1, stop, _target(-1, c, stop, p["rr"]), p["max_minutes"], "cassure bas Asie")
        return None


# ---------------------------------------------------------------------------- B2
class NYOpeningRangeBreakout(Strategy):
    """B2. Opening range New York 09:30-10:00 (heure NY), cassure en clôture jusqu'à 12:00 NY."""
    name, family = "ny_orb", "breakout"
    defaults = dict(or_start=9 * 60 + 30, or_end=10 * 60, last_entry=12 * 60, buffer_atr=0.1, rr=1.5,
                    max_stop_atr=3.0, max_minutes=120)
    grid = dict(rr=[1.0, 1.5, 2.0], buffer_atr=[0.0, 0.1, 0.3])

    def _or(self, m):
        key = ("ny_or", self.p["or_start"], self.p["or_end"])
        v = m._cache.get(key)
        if v is None:
            hi, lo = [NaN] * m.n, [NaN] * m.n
            day, h, l, done = None, -1e18, 1e18, False
            for k in range(m.n):
                if m.day[k] != day:
                    day, h, l = m.day[k], -1e18, 1e18
                ny = m.ny_min[k]
                if self.p["or_start"] <= ny < self.p["or_end"]:
                    h, l = max(h, m.b.h[k]), min(l, m.b.l[k])
                elif ny >= self.p["or_end"] and h > -1e18:
                    hi[k], lo[k] = h, l
            v = (hi, lo)
            m._cache[key] = v
        return v

    def signal(self, m, k):
        p, b = self.p, m.b
        hi, lo = self._or(m)
        a = m.get("atr", 14)[k]
        if k < 1 or not self.ok(hi[k], lo[k], hi[k - 1], a) or a <= 0 or m.ny_min[k] >= p["last_entry"]:
            return None
        c, buf = b.c[k], p["buffer_atr"] * a
        if c > hi[k] + buf and b.c[k - 1] <= hi[k] + buf:
            stop = _clip_stop(1, c, lo[k], a, p["max_stop_atr"])
            return Signal(1, stop, _target(1, c, stop, p["rr"]), p["max_minutes"], "ORB NY haussier")
        if c < lo[k] - buf and b.c[k - 1] >= lo[k] - buf:
            stop = _clip_stop(-1, c, hi[k], a, p["max_stop_atr"])
            return Signal(-1, stop, _target(-1, c, stop, p["rr"]), p["max_minutes"], "ORB NY baissier")
        return None


# ---------------------------------------------------------------------------- B3 / F
def _levels(m, k):
    out = []
    for price, kind, name in ((m.asia_hi[k], 1, "haut Asie"), (m.asia_lo[k], -1, "bas Asie"),
                              (m.pdh[k], 1, "haut veille"), (m.pdl[k], -1, "bas veille")):
        if price == price:
            out.append((price, kind, name))
    return out


class SweepReversal(Strategy):
    """B3. Fausse cassure / chasse aux stops : la bougie dépasse un niveau de liquidité (Asie, veille)
    puis clôture de nouveau à l'intérieur avec une mèche marquée -> position inverse."""
    name, family = "sweep_reversal", "fausse cassure"
    defaults = dict(max_depth_atr=1.5, min_wick=0.4, stop_buf_atr=0.2, rr=2.0, min_stop_atr=0.5,
                    max_stop_atr=3.0, max_minutes=120)
    grid = dict(rr=[1.5, 2.0, 3.0], min_wick=[0.3, 0.4, 0.6], max_depth_atr=[1.0, 1.5, 2.5])

    def signal(self, m, k):
        p, b = self.p, m.b
        a = m.get("atr", 14)[k]
        if not self.ok(a) or a <= 0:
            return None
        o, h, l, c = b.o[k], b.h[k], b.l[k], b.c[k]
        rng = h - l
        if rng <= 0:
            return None
        for price, kind, name in _levels(m, k):
            if kind > 0 and h > price and c < price and h - price <= p["max_depth_atr"] * a \
                    and (h - max(o, c)) / rng >= p["min_wick"]:
                stop = h + p["stop_buf_atr"] * a
                if p["min_stop_atr"] * a <= stop - c <= p["max_stop_atr"] * a:
                    return Signal(-1, stop, _target(-1, c, stop, p["rr"]), p["max_minutes"], f"sweep {name}")
            if kind < 0 and l < price and c > price and price - l <= p["max_depth_atr"] * a \
                    and (min(o, c) - l) / rng >= p["min_wick"]:
                stop = l - p["stop_buf_atr"] * a
                if p["min_stop_atr"] * a <= c - stop <= p["max_stop_atr"] * a:
                    return Signal(1, stop, _target(1, c, stop, p["rr"]), p["max_minutes"], f"sweep {name}")
        return None


class LevelRejection(Strategy):
    """F. Price action sur niveau de session : contact (sans cassure nette) d'un haut/bas Asie ou veille
    avec mèche de rejet >= 50 % et bougie de couleur opposée."""
    name, family = "level_rejection", "price action"
    defaults = dict(tol_atr=0.2, min_wick=0.5, stop_buf_atr=0.2, rr=1.5, min_stop_atr=0.5, max_stop_atr=3.0,
                    max_minutes=120)
    grid = dict(rr=[1.0, 1.5, 2.0], tol_atr=[0.1, 0.2, 0.4], min_wick=[0.4, 0.5, 0.6])

    def signal(self, m, k):
        p, b = self.p, m.b
        a = m.get("atr", 14)[k]
        if not self.ok(a) or a <= 0:
            return None
        o, h, l, c = b.o[k], b.h[k], b.l[k], b.c[k]
        rng, tol = h - l, p["tol_atr"] * a
        if rng <= 0:
            return None
        for price, kind, name in _levels(m, k):
            if kind > 0 and abs(h - price) <= tol and c < o and c < price and (h - max(o, c)) / rng >= p["min_wick"]:
                stop = max(h, price) + p["stop_buf_atr"] * a
                if p["min_stop_atr"] * a <= stop - c <= p["max_stop_atr"] * a:
                    return Signal(-1, stop, _target(-1, c, stop, p["rr"]), p["max_minutes"], f"rejet {name}")
            if kind < 0 and abs(l - price) <= tol and c > o and c > price and (min(o, c) - l) / rng >= p["min_wick"]:
                stop = min(l, price) - p["stop_buf_atr"] * a
                if p["min_stop_atr"] * a <= c - stop <= p["max_stop_atr"] * a:
                    return Signal(1, stop, _target(1, c, stop, p["rr"]), p["max_minutes"], f"rejet {name}")
        return None


# ---------------------------------------------------------------------------- C
class MomentumImpulse(Strategy):
    """C. Impulsion : bougie >= k x ATR, clôture dans le quart extrême, volume de ticks élevé -> continuation."""
    name, family = "momentum_impulse", "momentum"
    defaults = dict(k_atr=2.0, close_pos=0.75, vol_mult=1.5, stop_atr=1.0, rr=1.0, max_minutes=30, htf=False)
    grid = dict(k_atr=[1.5, 2.0, 3.0], rr=[0.75, 1.0, 1.5], stop_atr=[0.75, 1.0, 1.5])

    def signal(self, m, k):
        p, b = self.p, m.b
        if k < 21:
            return None
        a, vs = m.get("atr", 14)[k - 1], m.get("vol_sma", 20)[k - 1]
        if not self.ok(a, vs) or a <= 0:
            return None
        o, h, l, c = b.o[k], b.h[k], b.l[k], b.c[k]
        rng = h - l
        if rng < p["k_atr"] * a or b.v[k] < p["vol_mult"] * vs:
            return None
        pos = (c - l) / rng
        trend = m.h1_trend(k) if p["htf"] else 0
        if pos >= p["close_pos"] and c > o and trend >= 0:
            stop = c - p["stop_atr"] * a
            return Signal(1, stop, _target(1, c, stop, p["rr"]), p["max_minutes"], "impulsion haussière")
        if pos <= 1 - p["close_pos"] and c < o and trend <= 0:
            stop = c + p["stop_atr"] * a
            return Signal(-1, stop, _target(-1, c, stop, p["rr"]), p["max_minutes"], "impulsion baissière")
        return None


# ---------------------------------------------------------------------------- D
class BollingerReversion(Strategy):
    """D. Retour à la moyenne : sortie sous/au-dessus de Bollinger puis réintégration, RSI extrême,
    seulement si le régime H1 est en range. Target = moyenne mobile (bande centrale)."""
    name, family = "bollinger_reversion", "retour à la moyenne"
    defaults = dict(period=20, k_std=2.0, rsi_long=35, rsi_short=65, max_er_h1=0.2, stop_buf_atr=0.3,
                    min_rr=1.0, max_stop_atr=3.0, max_minutes=120)
    grid = dict(k_std=[1.5, 2.0, 2.5], max_er_h1=[0.15, 0.2, 0.3], min_rr=[0.7, 1.0, 1.5])

    def signal(self, m, k):
        p, b = self.p, m.b
        if k < p["period"] + 3:
            return None
        mid, sd = m.get("sma", p["period"]), m.get("std", p["period"])
        r, a, er = m.get("rsi", 14), m.get("atr", 14)[k], m.get("htf", 60, "er", 12)[k]
        if not self.ok(mid[k], sd[k], mid[k - 1], sd[k - 1], r[k - 1], a, er) or a <= 0 or er > p["max_er_h1"]:
            return None
        c, o = b.c[k], b.o[k]
        lo_k, lo_p = mid[k] - p["k_std"] * sd[k], mid[k - 1] - p["k_std"] * sd[k - 1]
        hi_k, hi_p = mid[k] + p["k_std"] * sd[k], mid[k - 1] + p["k_std"] * sd[k - 1]
        if b.c[k - 1] < lo_p and c > lo_k and c > o and r[k - 1] < p["rsi_long"]:
            stop = _clip_stop(1, c, min(b.l[k - 2:k + 1]) - p["stop_buf_atr"] * a, a, p["max_stop_atr"])
            if mid[k] - c >= p["min_rr"] * (c - stop):
                return Signal(1, stop, mid[k], p["max_minutes"], "Bollinger bas")
        if b.c[k - 1] > hi_p and c < hi_k and c < o and r[k - 1] > p["rsi_short"]:
            stop = _clip_stop(-1, c, max(b.h[k - 2:k + 1]) + p["stop_buf_atr"] * a, a, p["max_stop_atr"])
            if c - mid[k] >= p["min_rr"] * (stop - c):
                return Signal(-1, stop, mid[k], p["max_minutes"], "Bollinger haut")
        return None


# ---------------------------------------------------------------------------- E
class VWAPReversion(Strategy):
    """E. Écart au VWAP journalier (pondéré par le volume de TICKS, pas un vrai volume) : retour vers le VWAP
    quand l'écart dépasse z écarts-types, en régime de range."""
    name, family = "vwap_reversion", "retour à la moyenne"
    defaults = dict(z=2.0, max_er_h1=0.2, stop_buf_atr=0.3, min_rr=1.0, max_stop_atr=3.0, max_minutes=120)
    grid = dict(z=[1.5, 2.0, 2.5], max_er_h1=[0.15, 0.2, 0.3], min_rr=[0.7, 1.0, 1.5])

    def signal(self, m, k):
        p, b = self.p, m.b
        if k < 3:
            return None
        vw, sd = m.get("vwap")
        a, er = m.get("atr", 14)[k], m.get("htf", 60, "er", 12)[k]
        if not self.ok(a, er) or a <= 0 or er > p["max_er_h1"] or sd[k] < 0.5 * a:
            return None
        c, o = b.c[k], b.o[k]
        z = (c - vw[k]) / sd[k]
        if z <= -p["z"] and c > o:
            stop = _clip_stop(1, c, min(b.l[k - 2:k + 1]) - p["stop_buf_atr"] * a, a, p["max_stop_atr"])
            if vw[k] - c >= p["min_rr"] * (c - stop):
                return Signal(1, stop, vw[k], p["max_minutes"], "sous le VWAP")
        if z >= p["z"] and c < o:
            stop = _clip_stop(-1, c, max(b.h[k - 2:k + 1]) + p["stop_buf_atr"] * a, a, p["max_stop_atr"])
            if c - vw[k] >= p["min_rr"] * (stop - c):
                return Signal(-1, stop, vw[k], p["max_minutes"], "au-dessus du VWAP")
        return None


# ---------------------------------------------------------------------------- familles supplémentaires
class DonchianBreakout(Strategy):
    """K. Cassure de canal de Donchian (plus haut/bas des n bougies) dans le sens de la tendance H1."""
    name, family = "donchian_breakout", "breakout"
    defaults = dict(n=20, stop_atr=1.5, rr=2.0, max_minutes=240, htf=True)
    grid = dict(n=[12, 20, 40], rr=[1.5, 2.0, 3.0], stop_atr=[1.0, 1.5, 2.0])

    def signal(self, m, k):
        p, b = self.p, m.b
        hh, ll, a = m.get("hh", p["n"])[k], m.get("ll", p["n"])[k], m.get("atr", 14)[k]
        if k < 1 or not self.ok(hh, ll, a, m.get("hh", p["n"])[k - 1]) or a <= 0:
            return None
        trend = m.h1_trend(k) if p["htf"] else 0
        c = b.c[k]
        if c > hh and b.c[k - 1] <= m.get("hh", p["n"])[k - 1] and trend >= 0 and (trend > 0 or not p["htf"]):
            stop = c - p["stop_atr"] * a
            return Signal(1, stop, _target(1, c, stop, p["rr"]), p["max_minutes"], "Donchian haut")
        if c < ll and b.c[k - 1] >= m.get("ll", p["n"])[k - 1] and trend <= 0 and (trend < 0 or not p["htf"]):
            stop = c + p["stop_atr"] * a
            return Signal(-1, stop, _target(-1, c, stop, p["rr"]), p["max_minutes"], "Donchian bas")
        return None


class SqueezeBreakout(Strategy):
    """L. Compression de volatilité (Bollinger à l'intérieur de Keltner pendant n bougies) puis cassure."""
    name, family = "squeeze_breakout", "breakout / volatilité"
    defaults = dict(period=20, k_std=2.0, k_kc=1.5, min_squeeze=6, stop_atr=1.5, rr=1.5, max_minutes=180)
    grid = dict(min_squeeze=[4, 6, 12], rr=[1.0, 1.5, 2.0], k_kc=[1.25, 1.5, 2.0])

    def _squeeze(self, m):
        key = ("squeeze", self.p["period"], self.p["k_std"], self.p["k_kc"])
        v = m._cache.get(key)
        if v is None:
            mid, sd = m.get("sma", self.p["period"]), m.get("std", self.p["period"])
            e, a = m.get("ema", self.p["period"]), m.get("atr", 14)
            run, v = 0, []
            for k in range(m.n):
                inside = self.ok(mid[k], sd[k], e[k], a[k]) and self.p["k_std"] * sd[k] < self.p["k_kc"] * a[k]
                run = run + 1 if inside else 0
                v.append(run)
            m._cache[key] = v
        return v

    def signal(self, m, k):
        p, b = self.p, m.b
        if k < p["period"] + 2:
            return None
        sq = self._squeeze(m)
        mid, sd, a = m.get("sma", p["period"])[k], m.get("std", p["period"])[k], m.get("atr", 14)[k]
        if sq[k - 1] < p["min_squeeze"] or not self.ok(mid, sd, a) or a <= 0:
            return None
        c = b.c[k]
        if c > mid + p["k_std"] * sd:
            stop = c - p["stop_atr"] * a
            return Signal(1, stop, _target(1, c, stop, p["rr"]), p["max_minutes"], "squeeze haussier")
        if c < mid - p["k_std"] * sd:
            stop = c + p["stop_atr"] * a
            return Signal(-1, stop, _target(-1, c, stop, p["rr"]), p["max_minutes"], "squeeze baissier")
        return None


class RSI2Reversion(Strategy):
    """M. RSI(2) de Connors : excès court terme contre la tendance H1 -> reprise dans le sens de la tendance."""
    name, family = "rsi2_reversion", "retour à la moyenne (dans la tendance)"
    defaults = dict(low=10, high=90, stop_atr=1.5, target_atr=1.0, max_minutes=60)
    grid = dict(low=[5, 10, 20], target_atr=[0.75, 1.0, 1.5], stop_atr=[1.0, 1.5, 2.0])

    def signal(self, m, k):
        p, b = self.p, m.b
        r, a = m.get("rsi", 2)[k], m.get("atr", 14)[k]
        if not self.ok(r, a) or a <= 0:
            return None
        trend, c = m.h1_trend(k), b.c[k]
        if trend > 0 and r < p["low"]:
            return Signal(1, c - p["stop_atr"] * a, c + p["target_atr"] * a, p["max_minutes"], "RSI2 survendu")
        if trend < 0 and r > p["high"]:
            return Signal(-1, c + p["stop_atr"] * a, c - p["target_atr"] * a, p["max_minutes"], "RSI2 suracheté")
        return None


class InsideBarBreakout(Strategy):
    """O. Inside bar : bougie contenue dans la précédente (mère), cassure de la mère dans le sens H1."""
    name, family = "inside_bar", "price action"
    defaults = dict(rr=1.5, max_stop_atr=3.0, min_mother_atr=0.8, max_minutes=120, htf=True)
    grid = dict(rr=[1.0, 1.5, 2.0], min_mother_atr=[0.5, 0.8, 1.2])

    def signal(self, m, k):
        p, b = self.p, m.b
        if k < 3:
            return None
        a = m.get("atr", 14)[k]
        mh, ml = b.h[k - 2], b.l[k - 2]
        if not self.ok(a) or a <= 0 or mh - ml < p["min_mother_atr"] * a:
            return None
        if not (b.h[k - 1] <= mh and b.l[k - 1] >= ml):
            return None
        trend = m.h1_trend(k) if p["htf"] else 0
        c = b.c[k]
        if c > mh and (trend > 0 or not p["htf"]):
            stop = _clip_stop(1, c, ml, a, p["max_stop_atr"])
            return Signal(1, stop, _target(1, c, stop, p["rr"]), p["max_minutes"], "inside bar haussier")
        if c < ml and (trend < 0 or not p["htf"]):
            stop = _clip_stop(-1, c, mh, a, p["max_stop_atr"])
            return Signal(-1, stop, _target(-1, c, stop, p["rr"]), p["max_minutes"], "inside bar baissier")
        return None


# ---------------------------------------------------------------------------- G / I
class TrendFilter(Strategy):
    """G. Filtre multi-timeframe : ne garde que les signaux dans le sens de la tendance H1."""
    name, family = "mtf_filter", "filtre"
    defaults = dict()

    def __init__(self, inner: Strategy):
        super().__init__()
        self.inner = inner
        self.name = f"{inner.name}+H1"

    def signal(self, m, k):
        s = self.inner.signal(m, k)
        return s if s and s.side == m.h1_trend(k) else None

    def label(self):
        return f"{self.inner.label()}+H1"


class RegimeSwitch(Strategy):
    """I. Moteur adaptatif : choisit la stratégie selon le régime (tendance / range / volatil / désordonné)."""
    name, family = "regime_switch", "adaptatif"
    defaults = dict()

    def __init__(self, by_regime: dict[str, Strategy]):
        super().__init__()
        self.by_regime = by_regime

    def signal(self, m, k):
        s = self.by_regime.get(m.regime(k))
        return s.signal(m, k) if s else None

    def label(self):
        return "regime_switch(" + ", ".join(f"{r}:{s.name}" for r, s in self.by_regime.items()) + ")"


from .legacy import GeometryPDF, LiquiditySweep, Ensemble, SessionOnly  # noqa: E402  (anciens robots)

CATALOG: dict[str, type[Strategy]] = {c.name: c for c in (
    TrendPullback, AsiaRangeBreakout, NYOpeningRangeBreakout, SweepReversal, LevelRejection, MomentumImpulse,
    BollingerReversion, VWAPReversion, DonchianBreakout, SqueezeBreakout, RSI2Reversion, InsideBarBreakout,
    GeometryPDF, LiquiditySweep,
)}
from .micro import SCALP as _SCALP  # noqa: E402  (stratégies de scalp, étude D)
CATALOG.update(_SCALP)


def make(name: str, **params) -> Strategy:
    """`ensemble` : params = {"members": [{"name": ..., "params": {...}, "sessions": [...], "h1": false}, ...]}."""
    if name == "ensemble":
        members = []
        for spec in params["members"]:
            s = make(spec["name"], **spec.get("params", {}))
            if spec.get("h1"):
                s = TrendFilter(s)
            if spec.get("sessions"):
                s = SessionOnly(s, spec["sessions"])
            members.append(s)
        return Ensemble(members)
    return CATALOG[name](**params)
