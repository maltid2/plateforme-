import math
import random
from datetime import datetime, timezone

from xauscalp.data import Bars
from xauscalp.strategies.base import Signal, Strategy

UTC = timezone.utc


def ts(s: str) -> int:
    return int(datetime.strptime(s, "%Y-%m-%d %H:%M").replace(tzinfo=UTC).timestamp())


def flat_bars(start: str, n: int, tf: int = 5, price: float = 2000.0, spread: float = 0.25) -> Bars:
    t0 = ts(start)
    b = Bars(tf, spread=[])
    for k in range(n):
        b.t.append(t0 + k * tf * 60)
        b.o.append(price); b.h.append(price + 0.5); b.l.append(price - 0.5); b.c.append(price)
        b.v.append(100.0); b.spread.append(spread)
    return b


def random_walk(start: str, n: int, tf: int = 5, seed: int = 1, vol: float = 1.0, spread: float = 0.25,
                skip_weekends: bool = True) -> Bars:
    rng = random.Random(seed)
    t = ts(start)
    p = 2000.0
    b = Bars(tf, spread=[])
    while len(b) < n:
        d = datetime.fromtimestamp(t, UTC)
        if skip_weekends and (d.weekday() == 5 or (d.weekday() == 4 and d.hour >= 21) or (d.weekday() == 6 and d.hour < 22)):
            t += tf * 60
            continue
        o = p
        moves = [rng.gauss(0, vol) for _ in range(4)]
        path = [o]
        for m in moves:
            path.append(path[-1] + m)
        p = path[-1]
        b.t.append(t); b.o.append(o); b.h.append(max(path)); b.l.append(min(path)); b.c.append(p)
        b.v.append(100 + rng.random() * 200); b.spread.append(spread)
        t += tf * 60
    return b


class Scripted(Strategy):
    """Émet un signal prédéfini à des index donnés (tests)."""
    name = "scripted"
    defaults = {}

    def __init__(self, plan: dict):
        super().__init__()
        self.plan = plan

    def signal(self, m, k):
        return self.plan.get(k)


def sig(side, stop, target, minutes=60):
    return Signal(side, stop, target, minutes, "test")
