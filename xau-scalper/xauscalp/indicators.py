"""Indicateurs techniques (Python pur). Chaque valeur k n'utilise que les bougies 0..k (pas de look-ahead)."""
from __future__ import annotations

from collections import deque
import math

NaN = float("nan")


def ema(x: list, n: int) -> list:
    out, a, e = [], 2.0 / (n + 1), None
    for k, v in enumerate(x):
        e = v if e is None else e + a * (v - e)
        out.append(e if k >= n - 1 else NaN)
    return out


def sma(x: list, n: int) -> list:
    out, s = [], 0.0
    for k, v in enumerate(x):
        s += v
        if k >= n:
            s -= x[k - n]
        out.append(s / n if k >= n - 1 else NaN)
    return out


def rolling_std(x: list, n: int) -> list:
    out, s, s2 = [], 0.0, 0.0
    for k, v in enumerate(x):
        s += v; s2 += v * v
        if k >= n:
            s -= x[k - n]; s2 -= x[k - n] ** 2
        out.append(math.sqrt(max(0.0, s2 / n - (s / n) ** 2)) if k >= n - 1 else NaN)
    return out


def true_range(h, l, c) -> list:
    return [h[0] - l[0]] + [max(h[k] - l[k], abs(h[k] - c[k - 1]), abs(l[k] - c[k - 1])) for k in range(1, len(c))]


def atr(h, l, c, n: int = 14) -> list:
    """ATR de Wilder."""
    tr = true_range(h, l, c)
    out, a = [], None
    for k, v in enumerate(tr):
        if k < n - 1:
            out.append(NaN)
            continue
        a = sum(tr[: n]) / n if a is None else (a * (n - 1) + v) / n
        out.append(a)
    return out


def rsi(c: list, n: int = 14) -> list:
    out, ag, al = [NaN], None, None
    for k in range(1, len(c)):
        d = c[k] - c[k - 1]
        g, lo = max(d, 0.0), max(-d, 0.0)
        if k < n:
            ag = (ag or 0) + g / n; al = (al or 0) + lo / n
            out.append(NaN)
            continue
        if k == n:
            ag += g / n; al += lo / n
        else:
            ag = (ag * (n - 1) + g) / n; al = (al * (n - 1) + lo) / n
        out.append(100.0 if al == 0 else 100 - 100 / (1 + ag / al))
    return out


def rolling_max(x: list, n: int) -> list:
    """Max des n dernières valeurs, bougie courante incluse."""
    out, dq = [], deque()
    for k, v in enumerate(x):
        while dq and x[dq[-1]] <= v:
            dq.pop()
        dq.append(k)
        if dq[0] <= k - n:
            dq.popleft()
        out.append(x[dq[0]] if k >= n - 1 else NaN)
    return out


def rolling_min(x: list, n: int) -> list:
    return [-v if v == v else NaN for v in rolling_max([-v for v in x], n)]


def shift(x: list, k: int = 1) -> list:
    return [NaN] * k + x[:-k] if k else list(x)


def efficiency_ratio(c: list, n: int) -> list:
    """|c[k]-c[k-n]| / somme |Δc| : proche de 1 = tendance, proche de 0 = range."""
    out, noise = [], 0.0
    d = [0.0] + [abs(c[k] - c[k - 1]) for k in range(1, len(c))]
    for k in range(len(c)):
        noise += d[k]
        if k >= n:
            noise -= d[k - n]
        out.append(abs(c[k] - c[k - n]) / noise if k >= n and noise > 0 else NaN)
    return out


def rolling_percentile_rank(x: list, n: int) -> list:
    """Rang (0-1) de x[k] parmi les n dernières valeurs (simple, O(n·k))."""
    out = []
    for k in range(len(x)):
        if k < n - 1 or x[k] != x[k]:
            out.append(NaN)
            continue
        w = [v for v in x[k - n + 1:k + 1] if v == v]
        out.append(sum(1 for v in w if v <= x[k]) / len(w))
    return out


def session_vwap(t: list, h, l, c, v, reset_hour_utc: int = 22) -> tuple[list, list]:
    """VWAP (pondéré par le VOLUME DE TICKS : l'or spot n'a pas de volume centralisé) remis à zéro
    chaque jour à reset_hour_utc, et écart-type des prix autour du VWAP."""
    vw, sd = [], []
    pv = vv = pv2 = 0.0
    day = None
    for k in range(len(c)):
        dkey = (t[k] - reset_hour_utc * 3600) // 86400
        if dkey != day:
            day, pv, vv, pv2 = dkey, 0.0, 0.0, 0.0
        p = (h[k] + l[k] + c[k]) / 3
        w = max(v[k], 1.0)
        pv += p * w; vv += w; pv2 += p * p * w
        m = pv / vv
        vw.append(m); sd.append(math.sqrt(max(0.0, pv2 / vv - m * m)))
    return vw, sd


def map_higher(t_low: list, tf_low: int, t_high: list, tf_high: int, values: list) -> list:
    """Valeur de la dernière bougie de l'unité supérieure CLÔTURÉE à la fin de chaque bougie basse."""
    out, j = [], -1
    for k in range(len(t_low)):
        end_low = t_low[k] + tf_low * 60
        while j + 1 < len(t_high) and t_high[j + 1] + tf_high * 60 <= end_low:
            j += 1
        out.append(values[j] if j >= 0 else NaN)
    return out
