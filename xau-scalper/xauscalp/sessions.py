"""Sessions de marché, en heure LOCALE de Londres / New York (gère les changements d'heure)."""
from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

UTC = timezone.utc
LON = ZoneInfo("Europe/London")
NY = ZoneInfo("America/New_York")

# (fuseau, début, fin) en minutes locales. Fenêtres d'ENTRÉE.
SESSIONS = {
    "asia": (LON, 0 * 60, 7 * 60),            # liquidité plus faible
    "london": (LON, 8 * 60, 12 * 60),         # ouverture de Londres, avant New York
    "overlap": (NY, 8 * 60, 11 * 60 + 30),    # chevauchement Londres / New York (stats US 8:30)
    "ny_pm": (NY, 11 * 60 + 30, 16 * 60),     # après-midi New York (Londres fermé)
    "late": (NY, 16 * 60, 17 * 60),           # fin de journée, liquidité faible avant le rollover
}


class SessionClock:
    """Minutes locales (Londres, New York) et jour de trading (rollover 17:00 New York), avec cache horaire."""

    def __init__(self):
        self._cache: dict[int, tuple[int, int, int, int]] = {}

    def _hour(self, hkey: int):
        r = self._cache.get(hkey)
        if r is None:
            d = datetime.fromtimestamp(hkey * 3600, UTC)
            lo = d.astimezone(LON)
            ny = d.astimezone(NY)
            # jour de trading = date New York décalée de 7 h (17:00 NY -> nouveau jour)
            trade_day = int((ny.replace(tzinfo=None) - datetime(1970, 1, 1)).total_seconds() + 7 * 3600) // 86400
            r = (lo.hour * 60, ny.hour * 60, trade_day, ny.weekday())
            self._cache[hkey] = r
        return r

    def info(self, ts: int) -> tuple[int, int, int, int]:
        """(minute Londres, minute New York, jour de trading, jour de semaine NY)."""
        lo, ny, day, wd = self._hour(ts // 3600)
        m = (ts % 3600) // 60
        ny_min = ny + m
        # jour de trading : bascule à 17:00 NY même au milieu d'une heure (heures pleines ici)
        return lo + m, ny_min, day, wd

    def in_session(self, ts: int, name: str) -> bool:
        zone, a, b = SESSIONS[name]
        lo, ny, _, _ = self.info(ts)
        m = lo if zone is LON else ny
        return a <= m < b

    def session_of(self, ts: int) -> str | None:
        for name in SESSIONS:
            if self.in_session(ts, name):
                return name
        return None

    def friday_cutoff(self, ts: int, ny_minute: int = 15 * 60) -> bool:
        """Vendredi après 15:00 NY : plus d'entrée (pas de position le week-end)."""
        _, ny, _, wd = self.info(ts)
        return wd == 4 and ny >= ny_minute

    def weekend_flatten(self, ts: int, ny_minute: int = 16 * 60 + 30) -> bool:
        _, ny, _, wd = self.info(ts)
        return wd == 4 and ny >= ny_minute or wd == 5

    def rollover(self, ts: int) -> bool:
        """16:55-18:05 NY : spreads très larges, pas d'entrée."""
        _, ny, _, _ = self.info(ts)
        return 16 * 60 + 55 <= ny < 18 * 60 + 5
