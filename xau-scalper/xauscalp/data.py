"""Chargement, conversion horaire, validation et ré-échantillonnage des bougies.

Toutes les heures internes sont en UTC (secondes epoch, ouverture de la bougie).
Les prix des bougies sont des prix BID ; le spread (en prix) permet de reconstruire l'ask.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import csv
import statistics

UTC = timezone.utc


@dataclass
class Bars:
    tf: int                         # minutes
    t: list = field(default_factory=list)   # epoch s UTC (ouverture)
    o: list = field(default_factory=list)
    h: list = field(default_factory=list)
    l: list = field(default_factory=list)
    c: list = field(default_factory=list)
    v: list = field(default_factory=list)
    spread: list | None = None      # spread moyen de la bougie, en prix ($)
    ask_h: list | None = None       # plus haut de l'ask (données bid/ask)
    ask_l: list | None = None
    source: str = ""

    def __len__(self) -> int:
        return len(self.t)

    def slice(self, a: int, b: int) -> "Bars":
        cut = lambda x: None if x is None else x[a:b]
        return Bars(self.tf, self.t[a:b], self.o[a:b], self.h[a:b], self.l[a:b], self.c[a:b], self.v[a:b],
                    cut(self.spread), cut(self.ask_h), cut(self.ask_l), self.source)

    def between(self, start: datetime | None, end: datetime | None) -> "Bars":
        a = 0 if start is None else next((k for k, x in enumerate(self.t) if x >= start.timestamp()), len(self.t))
        b = len(self.t) if end is None else next((k for k, x in enumerate(self.t) if x >= end.timestamp()), len(self.t))
        return self.slice(a, b)


# --- heure serveur -> UTC ------------------------------------------------------

class ServerClock:
    """Heure serveur du courtier -> UTC.

    spec : 'UTC', 'UTC+2' (fixe), 'paris+1' (Europe/Paris + 1 h : le cas de nombreux courtiers MT5,
    UTC+2 l'hiver / UTC+3 l'été), 'ny+7' (America/New_York + 7 h : clôture NY à minuit serveur).
    """

    def __init__(self, spec: str = "UTC"):
        self.spec = spec.lower()
        self._cache: dict = {}
        if self.spec.startswith("utc"):
            self.zone, self.shift = UTC, float(self.spec[3:] or 0)
        else:
            name, shift = self.spec.split("+")
            self.zone = ZoneInfo({"paris": "Europe/Paris", "ny": "America/New_York", "london": "Europe/London"}[name])
            self.shift = float(shift)

    def to_utc(self, dt: datetime) -> int:
        key = (dt.year, dt.month, dt.day, dt.hour)
        off = self._cache.get(key)
        if off is None:
            local = dt - timedelta(hours=self.shift)
            if self.zone is UTC:
                off = self.shift * 3600
            else:
                aware = local.replace(tzinfo=self.zone)
                off = self.shift * 3600 + aware.utcoffset().total_seconds()
            self._cache[key] = off
        return int(dt.replace(tzinfo=UTC).timestamp() - off)


def _parse_time(s: str) -> tuple[datetime, bool]:
    """Retourne (datetime naïf, est_utc)."""
    s = s.strip().replace("T", " ").replace(".", "-")
    is_utc = s.endswith("+00:00") or s.endswith("Z")
    s = s.replace("+00:00", "").rstrip("Z")
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(s[:19] if fmt.endswith("%S") else s[:16], fmt), is_utc
        except ValueError:
            continue
    raise ValueError(f"heure illisible : {s!r}")


def load_csv(path: str, *, server_tz: str = "UTC", point: float = 0.01, tf: int | None = None) -> Bars:
    """Formats acceptés : export MT5 (time, open, high, low, close, tick_volume, spread[points]),
    CSV UTC (datetime ISO +00:00), et bougies bid/ask (time_utc, ..., spread_avg, ask_high, ask_low).
    Colonnes MT5 <DATE> <TIME> (séparateur tabulation) également reconnues."""
    clock = ServerClock(server_tz)
    with open(path, newline="") as f:
        head = f.readline()
        delim = "\t" if "\t" in head else ","
        f.seek(0)
        rd = csv.DictReader(f, delimiter=delim)
        cols = {k.lower().strip("<>"): k for k in rd.fieldnames}
        b = Bars(tf or 0, source=path)
        has_sp = "spread" in cols or "spread_avg" in cols
        has_ask = "ask_high" in cols
        if has_sp:
            b.spread = []
        if has_ask:
            b.ask_h, b.ask_l = [], []
        tcol = cols.get("time_utc") or cols.get("datetime") or cols.get("time") or cols.get("date")
        for r in rd:
            if "date" in cols and "time" in cols:
                raw = f"{r[cols['date']]} {r[cols['time']]}"
            else:
                raw = r[tcol]
            dt, is_utc = _parse_time(raw)
            if "time_utc" in cols:
                is_utc = True
            ts = int(dt.replace(tzinfo=UTC).timestamp()) if is_utc else clock.to_utc(dt)
            b.t.append(ts)
            b.o.append(float(r[cols["open"]])); b.h.append(float(r[cols["high"]]))
            b.l.append(float(r[cols["low"]])); b.c.append(float(r[cols["close"]]))
            vk = cols.get("tick_volume") or cols.get("tickvol") or cols.get("ticks") or cols.get("volume") or cols.get("vol")
            b.v.append(float(r[vk]) if vk and r[vk] not in ("", None) else 0.0)
            if "spread_avg" in cols:
                b.spread.append(float(r[cols["spread_avg"]]))
            elif "spread" in cols:
                b.spread.append(float(r[cols["spread"]]) * point)  # MT5 : spread en points
            if has_ask:
                b.ask_h.append(float(r[cols["ask_high"]])); b.ask_l.append(float(r[cols["ask_low"]]))
    if not b.tf and len(b.t) > 1:
        b.tf = int(statistics.median(b.t[k + 1] - b.t[k] for k in range(min(len(b.t) - 1, 2000))) // 60)
    return b


# --- validation ------------------------------------------------------------------

def is_market_closed(ts: int) -> bool:
    """Fermeture hebdomadaire approximative de l'or (vendredi ~21h UTC -> dimanche ~22h UTC) et pause quotidienne."""
    d = datetime.fromtimestamp(ts, UTC)
    wd, hm = d.weekday(), d.hour * 60 + d.minute
    if wd == 5 or (wd == 4 and hm >= 20 * 60 + 55) or (wd == 6 and hm < 22 * 60):
        return True
    return 20 * 60 + 55 <= hm < 23 * 60 + 5  # pause quotidienne (21:00-22:00 UTC selon la saison)


@dataclass
class DataReport:
    rows: int
    duplicates: int
    unsorted: int
    bad_ohlc: int
    non_positive: int
    gaps: int
    spikes: int
    negative_spread: int
    first: str
    last: str

    @property
    def ok(self) -> bool:
        return not (self.duplicates or self.unsorted or self.bad_ohlc or self.non_positive or self.negative_spread)


def validate(b: Bars, gap_factor: int = 5, spike_factor: float = 25.0) -> DataReport:
    n = len(b)
    dup = sum(1 for k in range(1, n) if b.t[k] == b.t[k - 1])
    uns = sum(1 for k in range(1, n) if b.t[k] < b.t[k - 1])
    bad = sum(1 for k in range(n) if not (b.l[k] <= min(b.o[k], b.c[k]) and b.h[k] >= max(b.o[k], b.c[k]) and b.l[k] <= b.h[k]))
    nonpos = sum(1 for k in range(n) if min(b.o[k], b.h[k], b.l[k], b.c[k]) <= 0)
    gaps = 0
    step = b.tf * 60
    for k in range(1, n):
        dt = b.t[k] - b.t[k - 1]
        if dt > gap_factor * step and not all(is_market_closed(x) for x in range(b.t[k - 1] + step, b.t[k], max(step, 3600))):
            gaps += 1
    rng = sorted(b.h[k] - b.l[k] for k in range(n))
    med = rng[n // 2] if n else 0
    spikes = sum(1 for k in range(n) if med > 0 and b.h[k] - b.l[k] > spike_factor * med)
    negsp = sum(1 for x in (b.spread or []) if x < 0)
    f = lambda ts: datetime.fromtimestamp(ts, UTC).strftime("%Y-%m-%d %H:%M") if n else ""
    return DataReport(n, dup, uns, bad, nonpos, gaps, spikes, negsp, f(b.t[0]) if n else "", f(b.t[-1]) if n else "")


def clean(b: Bars) -> Bars:
    """Trie, retire les doublons et les bougies incohérentes (jamais d'interpolation de prix)."""
    idx = sorted(range(len(b)), key=lambda k: b.t[k])
    keep, last = [], None
    for k in idx:
        if b.t[k] == last:
            continue
        if min(b.o[k], b.h[k], b.l[k], b.c[k]) <= 0 or b.l[k] > b.h[k]:
            continue
        if not (b.l[k] <= min(b.o[k], b.c[k]) and b.h[k] >= max(b.o[k], b.c[k])):
            continue
        keep.append(k); last = b.t[k]
    pick = lambda x: None if x is None else [x[k] for k in keep]
    return Bars(b.tf, pick(b.t), pick(b.o), pick(b.h), pick(b.l), pick(b.c), pick(b.v),
                pick(b.spread), pick(b.ask_h), pick(b.ask_l), b.source)


def resample(b: Bars, minutes: int) -> Bars:
    step = minutes * 60
    out = Bars(minutes, source=f"{b.source}@{minutes}m")
    if b.spread is not None:
        out.spread = []
    if b.ask_h is not None:
        out.ask_h, out.ask_l = [], []
    cur = None
    sp_sum = sp_n = 0
    for k in range(len(b)):
        key = b.t[k] - b.t[k] % step
        if key != cur:
            if cur is not None and out.spread is not None:
                out.spread.append(sp_sum / sp_n)
            cur = key
            out.t.append(key); out.o.append(b.o[k]); out.h.append(b.h[k]); out.l.append(b.l[k]); out.c.append(b.c[k]); out.v.append(b.v[k])
            if out.ask_h is not None:
                out.ask_h.append(b.ask_h[k]); out.ask_l.append(b.ask_l[k])
            sp_sum = sp_n = 0
        else:
            out.h[-1] = max(out.h[-1], b.h[k]); out.l[-1] = min(out.l[-1], b.l[k]); out.c[-1] = b.c[k]; out.v[-1] += b.v[k]
            if out.ask_h is not None:
                out.ask_h[-1] = max(out.ask_h[-1], b.ask_h[k]); out.ask_l[-1] = min(out.ask_l[-1], b.ask_l[k])
        if b.spread is not None:
            sp_sum += b.spread[k]; sp_n += 1
    if cur is not None and out.spread is not None:
        out.spread.append(sp_sum / sp_n)
    return out


def data_age_seconds(last_bar_open: int, tf_minutes: int, now: float) -> float:
    """Âge de la dernière bougie CLÔTURÉE (0 si elle vient de se fermer)."""
    return now - (last_bar_open + tf_minutes * 60)
