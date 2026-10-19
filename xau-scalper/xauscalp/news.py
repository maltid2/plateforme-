"""Calendrier des annonces américaines majeures (impact fort sur l'or) et fenêtres d'exclusion.

BACKTEST : listes reconstituées à la main (APPROXIMATIVES, à vérifier). NFP et CPI à 8:30 New York,
décision du FOMC à 14:00 New York. Pour 2015-2018, le CPI n'est pas listé (dates non vérifiées) :
le filtre de volatilité et de spread prend le relais.
EN DÉMO / RÉEL : le calendrier est lu dans un CSV exporté de MetaTrader 5 par mql5/ExportCalendar.mq5
(le module Python MetaTrader5 n'expose pas le calendrier économique).
"""
from __future__ import annotations

from bisect import bisect_left
from dataclasses import dataclass
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import csv

NY = ZoneInfo("America/New_York")

NFP = """2015-01-09 2015-02-06 2015-03-06 2015-04-03 2015-05-08 2015-06-05 2015-07-02 2015-08-07 2015-09-04 2015-10-02
2015-11-06 2015-12-04 2016-01-08 2016-02-05 2016-03-04 2016-04-01 2016-05-06 2016-06-03 2016-07-08 2016-08-05 2016-09-02
2016-10-07 2016-11-04 2016-12-02 2017-01-06 2017-02-03 2017-03-10 2017-04-07 2017-05-05 2017-06-02 2017-07-07 2017-08-04
2017-09-01 2017-10-06 2017-11-03 2017-12-08 2018-01-05 2018-02-02 2018-03-09 2018-04-06 2018-05-04 2018-06-01 2018-07-06
2025-04-04 2025-05-02 2025-06-06 2025-07-03 2025-08-01 2025-09-05 2025-11-20 2025-12-16 2026-01-09 2026-02-11 2026-03-06
2026-04-03 2026-05-08 2026-06-05 2026-07-02 2026-08-07 2026-09-04""".split()
CPI = """2025-04-10 2025-05-13 2025-06-11 2025-07-15 2025-08-12 2025-09-11 2025-10-24 2025-12-18 2026-01-13 2026-02-13
2026-03-11 2026-04-10 2026-05-12 2026-06-10 2026-07-14 2026-08-12 2026-09-11""".split()
FOMC = """2015-01-28 2015-03-18 2015-04-29 2015-06-17 2015-07-29 2015-09-17 2015-10-28 2015-12-16 2016-01-27 2016-03-16
2016-04-27 2016-06-15 2016-07-27 2016-09-21 2016-11-02 2016-12-14 2017-02-01 2017-03-15 2017-05-03 2017-06-14 2017-07-26
2017-09-20 2017-11-01 2017-12-13 2018-01-31 2018-03-21 2018-05-02 2018-06-13 2018-08-01 2025-05-07 2025-06-18 2025-07-30
2025-09-17 2025-10-29 2025-12-10 2026-01-28 2026-03-18 2026-04-29 2026-06-17 2026-07-29 2026-09-16""".split()


def _ny(day: str, h: int, m: int) -> int:
    y, mo, d = map(int, day.split("-"))
    return int(datetime(y, mo, d, h, m, tzinfo=NY).timestamp())


@dataclass(frozen=True)
class Event:
    ts: int        # UTC epoch s
    name: str
    currency: str = "USD"
    impact: str = "high"


class NewsCalendar:
    def __init__(self, events: list[Event]):
        self.events = sorted(events, key=lambda e: e.ts)
        self._ts = [e.ts for e in self.events]

    @classmethod
    def builtin(cls) -> "NewsCalendar":
        ev = [Event(_ny(d, 8, 30), "NFP") for d in NFP] + [Event(_ny(d, 8, 30), "CPI") for d in CPI]
        ev += [Event(_ny(d, 14, 0), "FOMC") for d in FOMC]
        return cls(ev)

    @classmethod
    def from_csv(cls, path: str, currencies=("USD",), impacts=("high",)) -> "NewsCalendar":
        """CSV : time_utc (YYYY-MM-DD HH:MM), currency, impact, name (exporté par ExportCalendar.mq5)."""
        ev = []
        with open(path, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                if r["currency"] in currencies and r["impact"].lower() in impacts:
                    dt = datetime.strptime(r["time_utc"][:16], "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
                    ev.append(Event(int(dt.timestamp()), r["name"], r["currency"], r["impact"].lower()))
        return cls(ev)

    def blocked(self, ts: int, before_min: int, after_min: int) -> Event | None:
        """Événement si ts est dans [annonce - before, annonce + after]."""
        k = bisect_left(self._ts, ts - after_min * 60)
        if k < len(self._ts) and self._ts[k] <= ts + before_min * 60:
            return self.events[k]
        return None

    def covers(self, start_ts: int, end_ts: int) -> bool:
        return any(start_ts <= t <= end_ts for t in self._ts)
