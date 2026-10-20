"""Stratégies de scalp très courtes (étude D), en multiples d'ATR."""
from __future__ import annotations

from .base import Signal, Strategy


class MicroMomentum(Strategy):
    """n bougies de suite dans le même sens, mouvement total >= k x ATR, volume de ticks en hausse -> suivre."""
    name, family = "micro_momentum", "scalp momentum"
    defaults = dict(n=3, k_atr=1.5, stop_atr=1.0, target_atr=1.0, max_minutes=2.0)

    def signal(self, m, k):
        p, b = self.p, m.b
        n = p["n"]
        if k < n + 20:
            return None
        a, vs = m.get("atr", 14)[k - n], m.get("vol_sma", 20)[k - n]
        if not self.ok(a, vs) or a <= 0:
            return None
        ups = all(b.c[j] > b.c[j - 1] and b.c[j] > b.o[j] for j in range(k - n + 1, k + 1))
        dns = all(b.c[j] < b.c[j - 1] and b.c[j] < b.o[j] for j in range(k - n + 1, k + 1))
        move = abs(b.c[k] - b.c[k - n])
        if not (ups or dns) or move < p["k_atr"] * a or b.v[k] < vs:
            return None
        side = 1 if ups else -1
        c = b.c[k]
        return Signal(side, c - side * p["stop_atr"] * a, c + side * p["target_atr"] * a, p["max_minutes"], "micro momentum")


class MicroReversion(Strategy):
    """Écart à l'EMA20 >= z x ATR puis bougie de retournement -> retour vers l'EMA."""
    name, family = "micro_reversion", "scalp retour à la moyenne"
    defaults = dict(z=2.5, stop_buf_atr=0.5, min_rr=0.8, max_minutes=3.0)

    def signal(self, m, k):
        p, b = self.p, m.b
        e, a = m.get("ema", 20)[k], m.get("atr", 14)[k]
        if k < 25 or not self.ok(e, a) or a <= 0:
            return None
        c, o = b.c[k], b.o[k]
        dev = (b.c[k - 1] - e) / a
        if dev <= -p["z"] and c > o:
            stop = min(b.l[k - 2:k + 1]) - p["stop_buf_atr"] * a
            if e - c >= p["min_rr"] * (c - stop):
                return Signal(1, stop, e, p["max_minutes"], "micro rebond")
        if dev >= p["z"] and c < o:
            stop = max(b.h[k - 2:k + 1]) + p["stop_buf_atr"] * a
            if c - e >= p["min_rr"] * (stop - c):
                return Signal(-1, stop, e, p["max_minutes"], "micro repli")
        return None


class MicroBreakout(Strategy):
    """Cassure du plus haut / plus bas des n dernières bougies -> suivre, sortie rapide."""
    name, family = "micro_breakout", "scalp cassure"
    defaults = dict(n=30, stop_atr=1.0, target_atr=1.5, max_minutes=3.0)

    def signal(self, m, k):
        p, b = self.p, m.b
        hh, ll, a = m.get("hh", p["n"]), m.get("ll", p["n"]), m.get("atr", 14)[k]
        if k < p["n"] + 2 or not self.ok(hh[k], ll[k], hh[k - 1], a) or a <= 0:
            return None
        c = b.c[k]
        if c > hh[k] and b.c[k - 1] <= hh[k - 1]:
            return Signal(1, c - p["stop_atr"] * a, c + p["target_atr"] * a, p["max_minutes"], "micro cassure haut")
        if c < ll[k] and b.c[k - 1] >= ll[k - 1]:
            return Signal(-1, c + p["stop_atr"] * a, c - p["target_atr"] * a, p["max_minutes"], "micro cassure bas")
        return None


class MicroSweep(Strategy):
    """Mèche qui dépasse le plus haut/bas des n bougies puis clôture à l'intérieur -> position inverse."""
    name, family = "micro_sweep", "scalp fausse cassure"
    defaults = dict(n=30, min_wick=0.5, stop_buf_atr=0.3, rr=1.0, max_minutes=3.0)

    def signal(self, m, k):
        p, b = self.p, m.b
        hh, ll, a = m.get("hh", p["n"])[k], m.get("ll", p["n"])[k], m.get("atr", 14)[k]
        if k < p["n"] + 2 or not self.ok(hh, ll, a) or a <= 0:
            return None
        o, h, l, c = b.o[k], b.h[k], b.l[k], b.c[k]
        r = h - l
        if r <= 0:
            return None
        if h > hh and c < hh and (h - max(o, c)) / r >= p["min_wick"]:
            stop = h + p["stop_buf_atr"] * a
            return Signal(-1, stop, c - p["rr"] * (stop - c), p["max_minutes"], "micro sweep haut")
        if l < ll and c > ll and (min(o, c) - l) / r >= p["min_wick"]:
            stop = l - p["stop_buf_atr"] * a
            return Signal(1, stop, c + p["rr"] * (c - stop), p["max_minutes"], "micro sweep bas")
        return None


SCALP = {c.name: c for c in (MicroMomentum, MicroReversion, MicroBreakout, MicroSweep)}
