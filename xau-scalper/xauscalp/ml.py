"""J. Méta-filtre statistique (régression logistique, Python pur) appliqué aux signaux d'une stratégie.

Utilisé UNIQUEMENT si son apport est démontré hors échantillon (apprentissage sur le développement,
évaluation sur la validation). Variables connues à la clôture de la bougie de signal.
"""
from __future__ import annotations

import math

FEATURES = ["er_h1", "atr_ratio", "trend_align", "dist_ema50", "rsi_c", "hour_sin", "hour_cos", "spread_atr", "body"]


def features(m, k: int, side: int) -> dict:
    a = m.get("atr", 14)[k]
    a = a if a == a and a > 0 else 1.0
    e50 = m.get("ema", 50)[k]
    rs = m.get("rsi", 14)[k]
    lm = m.lon_min[k] / 1440 * 2 * math.pi
    b = m.b
    rng = b.h[k] - b.l[k]
    val = lambda x, d=0.0: x if x == x else d
    return {
        "er_h1": val(m.get("htf", 60, "er", 12)[k]),
        "atr_ratio": val(m.get("atr_ratio", m.bars_for(5 * 1440))[k], 1.0),
        "trend_align": side * m.h1_trend(k),
        "dist_ema50": side * (b.c[k] - e50) / a if e50 == e50 else 0.0,
        "rsi_c": side * (val(rs, 50) - 50) / 50,
        "hour_sin": math.sin(lm), "hour_cos": math.cos(lm),
        "spread_atr": m.spread(k) / a,
        "body": side * (b.c[k] - b.o[k]) / rng if rng > 0 else 0.0,
    }


class Logistic:
    def __init__(self, l2: float = 1.0, lr: float = 0.1, epochs: int = 400):
        self.l2, self.lr, self.epochs = l2, lr, epochs
        self.w: list[float] = []
        self.mu: list[float] = []
        self.sd: list[float] = []

    def _x(self, f: dict) -> list[float]:
        return [(f[name] - self.mu[j]) / self.sd[j] for j, name in enumerate(FEATURES)]

    def fit(self, feats: list[dict], y: list[int]) -> "Logistic":
        n = len(y)
        self.mu = [sum(f[c] for f in feats) / n for c in FEATURES]
        self.sd = [max(1e-9, math.sqrt(sum((f[c] - self.mu[j]) ** 2 for f in feats) / n)) for j, c in enumerate(FEATURES)]
        X = [self._x(f) for f in feats]
        d = len(FEATURES)
        w = [0.0] * (d + 1)
        for _ in range(self.epochs):
            g = [0.0] * (d + 1)
            for xi, yi in zip(X, y):
                z = w[0] + sum(wj * xj for wj, xj in zip(w[1:], xi))
                p = 1 / (1 + math.exp(-max(-30, min(30, z))))
                e = p - yi
                g[0] += e
                for j in range(d):
                    g[j + 1] += e * xi[j]
            for j in range(d + 1):
                reg = self.l2 * w[j] if j else 0.0
                w[j] -= self.lr * (g[j] / n + reg / n)
        self.w = w
        return self

    def proba(self, f: dict) -> float:
        x = self._x(f)
        z = self.w[0] + sum(wj * xj for wj, xj in zip(self.w[1:], x))
        return 1 / (1 + math.exp(-max(-30, min(30, z))))
