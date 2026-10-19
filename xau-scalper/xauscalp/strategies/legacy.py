"""Les deux anciens robots (robot-geometry-dow), portés du JavaScript vers Python.

1. `geometry_pdf` : méthode « Geometry Market Mastery » du PDF (zones M15 supply/demand, type range ou
   impulsion, géométrie AB=CD, mèches de rejet M15, confirmation par 2 bougies M5 avec volume, breakeven à 1R).
2. `liquidity_mss` : chasse aux stops (sweep d'un haut/bas de l'Asie ou de la veille puis changement de
   structure dans les 2 h ; stop derrière la mèche ; target 3R ; distances proportionnelles à la volatilité).

Différences assumées avec la version JavaScript, documentées dans docs/STRATEGIES.md :
- le stop suiveur de la méthode géométrique n'est pas repris (seulement le breakeven) ;
- la liquidité est recalculée à partir des bougies du jour (sans mémoire de session), pour être identique
  en backtest et dans le moteur réel ; un sweep pendant une position ouverte reste donc exploitable.
"""
from __future__ import annotations

from .base import Signal, Strategy

NaN = float("nan")
METHOD_POINT_PER_M15 = 22.2  # or 2026 : bougie M15 médiane ≈ 10 $ ↔ 0,45 $ par point méthode (calibrage d'origine)


# ============================================================================ méthode du PDF
class GeometryPDF(Strategy):
    name, family = "geometry_pdf", "ancien robot : méthode du PDF"
    defaults = dict(
        regime_lookback=24, range_eff_max=0.3, range_min_sl=5, wide_range_size=100, wide_range_min_sl=30,
        impulse_min_sl=20, max_sl=40, sl_buffer=2, pivot_strength=2, zone_lookback=96, min_zone_height=4,
        zone_tol=3, abcd_min=0.75, abcd_max=1.3, require_geometry=False, target_margin=2, min_rr=2.0,
        target_choice="nearest", wick_lookback=3, wick_ratio=0.4, big_wick_ratio=0.6, min_wicks=1,
        require_stop_hunt=False, vol_ma=20, vol_factor=1.0, max_entry_distance=15, max_m15_range=60,
        be_at_r=1.0, scale="vol", point_scale=0.45, max_minutes=1440,
    )
    grid = dict(min_rr=[1.5, 2.0, 3.0], max_entry_distance=[10, 15, 25], wick_ratio=[0.3, 0.4, 0.5])

    # -- unité de distance : « point méthode » en $ --------------------------------
    def unit(self, m, k) -> float:
        if self.p["scale"] == "fixed":
            return self.p["point_scale"]
        v = m.m15_vol(k)
        return v / METHOD_POINT_PER_M15 if v == v else NaN

    # -- analyse M15 (étapes 1 à 3), en cache par bougie M15 ---------------------------
    def analyze(self, m, hb, j, u):
        key = ("geo", id(self), j, round(u, 6))
        a = m._cache.get(key)
        if a is not None:
            return a
        p = self.p
        # étape 1 : range ou impulsion
        lb = p["regime_lookback"]
        f = max(1, j - lb + 1)
        path = sum(abs(hb.c[x] - hb.c[x - 1]) for x in range(f, j + 1))
        hi, lo = max(hb.h[f:j + 1]), min(hb.l[f:j + 1])
        eff = abs(hb.c[j] - hb.c[f - 1]) / path if path > 0 else 0.0
        kind = "range" if eff < p["range_eff_max"] else "impulsion"
        min_sl = p["impulse_min_sl"] * u
        if kind == "range":
            min_sl = (p["wide_range_min_sl"] if hi - lo >= p["wide_range_size"] * u else p["range_min_sl"]) * u
        # étape 2 : pivots et zones non cassées
        s = p["pivot_strength"]
        pivots = []
        for x in range(max(s, j - p["zone_lookback"]), j - s + 1):
            is_h = all(hb.h[x] > hb.h[x - q] and hb.h[x] >= hb.h[x + q] for q in range(1, s + 1))
            is_l = all(hb.l[x] < hb.l[x - q] and hb.l[x] <= hb.l[x + q] for q in range(1, s + 1))
            if is_h:
                pivots.append((x, "high", hb.h[x]))
            if is_l:
                pivots.append((x, "low", hb.l[x]))
        zones = []
        mzh, tol = p["min_zone_height"] * u, p["zone_tol"] * u
        for x, knd, _ in pivots:
            if knd == "low":
                z = ("demand", hb.l[x], max(min(hb.o[x], hb.c[x]), hb.l[x] + mzh), x)
                broken = any(hb.c[y] < z[1] - tol for y in range(x + 1, j + 1))
            else:
                z = ("supply", min(max(hb.o[x], hb.c[x]), hb.h[x] - mzh), hb.h[x], x)
                broken = any(hb.c[y] > z[2] + tol for y in range(x + 1, j + 1))
            if not broken:
                zones.append(z)
        zz = []
        for pv in sorted(pivots):
            if zz and zz[-1][1] == pv[1]:
                if (pv[1] == "high" and pv[2] > zz[-1][2]) or (pv[1] == "low" and pv[2] < zz[-1][2]):
                    zz[-1] = pv
            else:
                zz.append(pv)
        a = {"kind": kind, "hi": hi, "lo": lo, "min_sl": min_sl, "zones": zones, "zz": zz}
        m._cache[key] = a
        return a

    def _rejection(self, hb, j, zone, side, u):
        p = self.p
        tol = p["zone_tol"] * u
        side_z, bottom, top, pidx = zone
        wicks = []
        for x in range(max(pidx + p["pivot_strength"] + 1, j - p["wick_lookback"] + 1), j + 1):
            o, h, l, c = hb.o[x], hb.h[x], hb.l[x], hb.c[x]
            r = h - l
            if r <= 0:
                continue
            nxt = x + 1 if x + 1 <= j else None
            if side > 0:
                if not (l <= top + tol and c >= bottom):
                    continue
                lw = min(o, c) - l
                same = c > o and lw / r >= p["wick_ratio"]
                eng = c < o and lw / r >= p["big_wick_ratio"] and nxt is not None and hb.c[nxt] > hb.o[nxt] and hb.c[nxt] > o
                if same or eng:
                    wicks.append((x, l))
            else:
                if not (h >= bottom - tol and c <= top):
                    continue
                uw = h - max(o, c)
                same = c < o and uw / r >= p["wick_ratio"]
                eng = c > o and uw / r >= p["big_wick_ratio"] and nxt is not None and hb.c[nxt] < hb.o[nxt] and hb.c[nxt] < o
                if same or eng:
                    wicks.append((x, h))
        if len(wicks) < p["min_wicks"]:
            return None
        ext = min(w[1] for w in wicks) if side > 0 else max(w[1] for w in wicks)
        return {"extreme": ext, "stop_hunt": ext < bottom if side > 0 else ext > top, "first": wicks[0][0], "n": len(wicks)}

    def _geometry(self, zz, side, d_price, before):
        want = ("high", "low", "high") if side > 0 else ("low", "high", "low")
        pts = [x for x in zz if x[0] < before]
        for q in range(len(pts) - 1, 1, -1):
            a, b, c = pts[q - 2], pts[q - 1], pts[q]
            if (a[1], b[1], c[1]) != want:
                continue
            ab, cd = abs(a[2] - b[2]), abs(c[2] - d_price)
            ratio = cd / ab if ab > 0 else 0.0
            return {"cd": cd, "ratio": ratio, "complete": self.p["abcd_min"] <= ratio <= self.p["abcd_max"]}
        return None

    def signal(self, m, k):
        p, b = self.p, m.b
        if k < p["vol_ma"] + 2:
            return None
        hb, idx = m.htf_bars(15)
        j = idx[k]
        if j < p["regime_lookback"] + p["pivot_strength"] * 2:
            return None
        u = self.unit(m, k)
        if u != u or u <= 0:
            return None
        if p["max_m15_range"] and hb.h[j] - hb.l[j] > p["max_m15_range"] * u:
            return None  # bougie de news : on ne court pas après
        an = self.analyze(m, hb, j, u)
        price = b.c[k]
        # étape 5 : deux bougies dans le sens, volume >= moyenne précédente
        vols = b.v[max(0, k - p["vol_ma"] - 1):k - 1]
        avg = sum(vols) / len(vols) if vols else 0.0
        vol_ok = b.v[k - 1] >= avg * p["vol_factor"] and b.v[k] >= avg * p["vol_factor"]
        for side in (1, -1):
            b1o, b1c, b2o, b2c = b.o[k - 1], b.c[k - 1], b.o[k], b.c[k]
            if side > 0 and not (b1c > b1o and b2c > b2o and b2c > b1c and vol_ok):
                continue
            if side < 0 and not (b1c < b1o and b2c < b2o and b2c < b1c and vol_ok):
                continue
            conf_low, conf_high = min(b.l[k - 1], b.l[k]), max(b.h[k - 1], b.h[k])
            own = [z for z in an["zones"] if z[0] == ("demand" if side > 0 else "supply")]
            opp = [z for z in an["zones"] if z[0] != ("demand" if side > 0 else "supply")]
            own.sort(key=lambda z: abs(price - (z[1] + z[2]) / 2))
            for z in own:
                edge = z[2] if side > 0 else z[1]
                if (price - edge) * side > p["max_entry_distance"] * u:
                    continue
                if (side > 0 and price < z[1]) or (side < 0 and price > z[2]):
                    continue
                rej = self._rejection(hb, j, z, side, u)
                if not rej or (p["require_stop_hunt"] and not rej["stop_hunt"]):
                    continue
                geo = self._geometry(an["zz"], side, rej["extreme"], rej["first"])
                if p["require_geometry"] and not (geo and geo["complete"]):
                    continue
                buf = p["sl_buffer"] * u
                structural = min(rej["extreme"], z[1], conf_low) - buf if side > 0 else max(rej["extreme"], z[2], conf_high) + buf
                dist = max((price - structural) * side, an["min_sl"])
                if dist > p["max_sl"] * u:
                    continue
                sl = price - side * dist
                tm = p["target_margin"] * u
                cands = [(zz[1] if side > 0 else zz[2]) - side * tm for zz in opp]
                cands = [x for x in cands if (x - price) * side > 0]
                if an["kind"] == "range":
                    cands.append((an["hi"] if side > 0 else an["lo"]) - side * tm)
                elif geo:
                    cands.append(price + side * geo["cd"])
                valid = sorted((x for x in cands if (x - price) * side / dist >= p["min_rr"]), key=lambda x: (x - price) * side)
                if not valid:
                    continue
                tp = valid[-1] if p["target_choice"] == "farthest" else valid[0]
                tag = f"{an['kind']} {z[0]} {z[1]:.2f}-{z[2]:.2f}" + (" stop hunt" if rej["stop_hunt"] else "")
                return Signal(side, sl, tp, p["max_minutes"], tag, be_at_r=p["be_at_r"])
        return None


# ============================================================================ liquidité
class LiquiditySweep(Strategy):
    name, family = "liquidity_mss", "ancien robot : liquidité"
    defaults = dict(asia_start=60, asia_end=8 * 60,           # minutes de Paris (01:00 - 08:00)
                    windows=((9 * 60, 12 * 60), (14 * 60 + 45, 18 * 60)),  # créneaux de Paris où un sweep est tradé
                    pools=("asia", "pdhl"), swing_minutes=30, max_wait_minutes=120, target_r=3.0,
                    depth_vol=3.6, min_sl_vol=0.45, max_sl_vol=3.6, buffer_vol=0.18, vol_days=20,
                    max_minutes=1440, be_at_r=None)
    grid = dict(target_r=[2.0, 3.0, 4.0], swing_minutes=[15, 30, 60], max_wait_minutes=[60, 120, 180])

    def _day(self, m, k):
        """État du jour (Paris) : niveaux, sweeps en attente, signaux — calculé une fois et prolongé bougie par bougie."""
        pday, pmin = m.paris()
        d = pday[k]
        key = ("liq", id(self), d)
        st = m._cache.get(key)
        if st is None or st["last"] > k:
            p = self.p
            first = k
            while first > 0 and pday[first - 1] == d:
                first -= 1
            prev_first = first - 1
            while prev_first > 0 and pday[prev_first - 1] == pday[first - 1]:
                prev_first -= 1
            st = {"first": first, "last": first - 1, "pools": None, "pending": [], "signals": {},
                  "prev": (max(m.b.h[prev_first:first]), min(m.b.l[prev_first:first])) if first > 0 else None,
                  "hi": -1e18, "lo": 1e18, "ahi": -1e18, "alo": 1e18}
            m._cache[key] = st
        return st

    def _advance(self, m, st, upto):
        p, b = self.p, m.b
        _, pmin = m.paris()
        swing = max(1, round(p["swing_minutes"] / m.tf))
        wait = max(1, round(p["max_wait_minutes"] / m.tf))
        for j in range(st["last"] + 1, upto + 1):
            st["last"] = j
            mn = pmin[j]
            if p["asia_start"] <= mn < p["asia_end"]:
                st["ahi"], st["alo"] = max(st["ahi"], b.h[j]), min(st["alo"], b.l[j])
            if st["pools"] is None and mn >= p["asia_end"]:
                pools = []
                if "asia" in p["pools"] and st["ahi"] > -1e18:
                    pools += [[st["ahi"], 1, "haut Asie", False], [st["alo"], -1, "bas Asie", False]]
                if "pdhl" in p["pools"] and st["prev"]:
                    pools += [[st["prev"][0], 1, "haut veille", False], [st["prev"][1], -1, "bas veille", False]]
                for q in pools:  # déjà dépassé aujourd'hui avant la fin de l'Asie : plus de la liquidité
                    q[3] = (st["hi"] > q[0]) if q[1] > 0 else (st["lo"] < q[0])
                st["pools"] = pools
            st["hi"], st["lo"] = max(st["hi"], b.h[j]), min(st["lo"], b.l[j])
            if not st["pools"]:
                continue
            vol = m.m15_vol(j, p["vol_days"])
            if vol != vol or vol <= 0:
                continue
            window = any(a <= mn < z for a, z in p["windows"])
            for q in st["pools"]:
                if q[3]:
                    continue
                if (b.h[j] > q[0]) if q[1] > 0 else (b.l[j] < q[0]):
                    q[3] = True
                    if not window or j < 1:
                        continue
                    lo = max(0, j - swing)
                    mss = min(b.l[lo:j]) if q[1] > 0 else max(b.h[lo:j])
                    st["pending"].append({"pool": q, "dir": -q[1], "ext": b.h[j] if q[1] > 0 else b.l[j], "mss": mss, "start": j})
            keep = []
            for s in st["pending"]:
                s["ext"] = max(s["ext"], b.h[j]) if s["dir"] < 0 else min(s["ext"], b.l[j])
                depth = (s["ext"] - s["pool"][0]) * -s["dir"]
                if depth > p["depth_vol"] * vol or j - s["start"] > wait:
                    continue
                if not ((b.c[j] < s["mss"]) if s["dir"] < 0 else (b.c[j] > s["mss"])):
                    keep.append(s)
                    continue
                if j not in st["signals"]:
                    sl = s["ext"] - s["dir"] * p["buffer_vol"] * vol
                    dist = (b.c[j] - sl) * s["dir"]
                    if p["min_sl_vol"] * vol <= dist <= p["max_sl_vol"] * vol:
                        st["signals"][j] = Signal(s["dir"], sl, b.c[j] + s["dir"] * p["target_r"] * dist, p["max_minutes"],
                                                  f"sweep {s['pool'][2]} {s['pool'][0]:.2f} + MSS", be_at_r=p["be_at_r"])
            st["pending"] = keep

    def signal(self, m, k):
        st = self._day(m, k)
        self._advance(m, st, k)
        return st["signals"].get(k)


# ============================================================================ ensemble
class Ensemble(Strategy):
    """Combinaison : prend le premier signal dans l'ordre de priorité (une seule position à la fois)."""
    name, family = "ensemble", "combinaison"
    defaults = dict()

    def __init__(self, members: list[Strategy]):
        super().__init__()
        self.members = members

    def signal(self, m, k):
        for s in self.members:
            sig = s.signal(m, k)
            if sig is not None:
                sig.tag = f"[{s.name}] {sig.tag}"
                return sig
        return None

    def label(self):
        return "ensemble(" + " > ".join(s.label() for s in self.members) + ")"


class SessionOnly(Strategy):
    """Restreint une stratégie à certaines sessions (utile dans un ensemble)."""
    name, family = "session_only", "filtre"
    defaults = dict()

    def __init__(self, inner: Strategy, sessions):
        super().__init__()
        self.inner, self.sessions = inner, tuple(sessions)
        self.name = inner.name

    def signal(self, m, k):
        nxt = m.b.t[k] + m.tf * 60
        if not any(m.clock.in_session(nxt, s) for s in self.sessions):
            return None
        return self.inner.signal(m, k)

    def label(self):
        return f"{self.inner.label()}@{'+'.join(self.sessions)}"
