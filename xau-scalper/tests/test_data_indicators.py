import os
import tempfile
import unittest
from datetime import datetime

from tests.helpers import random_walk, ts
from xauscalp import indicators as I
from xauscalp.data import Bars, ServerClock, clean, load_csv, resample, validate, data_age_seconds
from xauscalp.market import Market
from xauscalp.news import NewsCalendar
from xauscalp.sessions import SessionClock


class Data(unittest.TestCase):
    def test_heure_serveur_paris_plus_un(self):
        c = ServerClock("paris+1")
        self.assertEqual(c.to_utc(datetime(2025, 7, 1, 12, 0)), ts("2025-07-01 09:00"))   # été : UTC+3
        self.assertEqual(c.to_utc(datetime(2025, 1, 15, 12, 0)), ts("2025-01-15 10:00"))  # hiver : UTC+2
        self.assertEqual(ServerClock("UTC+2").to_utc(datetime(2025, 7, 1, 12, 0)), ts("2025-07-01 10:00"))

    def test_lecture_export_mt5_spread_en_points(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "x.csv")
            with open(p, "w") as f:
                f.write("time,open,high,low,close,tick_volume,spread,real_volume\n")
                f.write("2025-07-01 12:00:00,3300,3301,3299,3300.5,10,25,0\n")
                f.write("2025-07-01 12:05:00,3300.5,3302,3300,3301,12,30,0\n")
            b = load_csv(p, server_tz="paris+1", point=0.01)
            self.assertEqual(b.t[0], ts("2025-07-01 09:00"))
            self.assertAlmostEqual(b.spread[0], 0.25)
            self.assertEqual(b.tf, 5)

    def test_validation_et_nettoyage(self):
        b = Bars(5, [0, 300, 300, 900], [10, 10, 10, 10], [11, 11, 9, 11], [9, 9, 9, 9], [10, 10, 10, 10], [1, 1, 1, 1])
        r = validate(b)
        self.assertEqual(r.duplicates, 1)
        self.assertEqual(r.bad_ohlc, 1)
        self.assertFalse(r.ok)
        c = clean(b)
        self.assertTrue(validate(c).ok)
        self.assertEqual(len(c), 3)

    def test_resample(self):
        b = random_walk("2025-03-04 08:00", 60, tf=1, seed=3)
        r = resample(b, 5)
        self.assertEqual(r.tf, 5)
        self.assertEqual(r.h[0], max(b.h[:5]))
        self.assertEqual(r.l[0], min(b.l[:5]))
        self.assertEqual(r.o[0], b.o[0])
        self.assertEqual(r.c[0], b.c[4])

    def test_age_des_donnees(self):
        self.assertEqual(data_age_seconds(1000, 5, 1300), 0)
        self.assertEqual(data_age_seconds(1000, 5, 1600), 300)


class Indicators(unittest.TestCase):
    def test_valeurs_connues(self):
        x = [1, 2, 3, 4, 5, 6]
        self.assertAlmostEqual(I.sma(x, 3)[-1], 5.0)
        e = I.ema(x, 3)
        self.assertAlmostEqual(e[2], 2.25)  # 1 -> 1.5 -> 2.25
        self.assertEqual(I.rolling_max([3, 1, 4, 1, 5], 2)[1:], [3, 4, 4, 5])
        self.assertEqual(I.rsi([1, 2, 3, 4, 5, 6, 7], 3)[-1], 100.0)
        a = I.atr([2, 2, 2, 2], [1, 1, 1, 1], [1.5, 1.5, 1.5, 1.5], 2)
        self.assertAlmostEqual(a[-1], 1.0)
        self.assertAlmostEqual(I.efficiency_ratio([1, 2, 3, 4], 3)[-1], 1.0)

    def test_pas_de_look_ahead(self):
        """Les valeurs à l'index k ne changent pas quand on ajoute des bougies futures."""
        b = random_walk("2025-03-03 00:00", 4000, tf=5, seed=5)
        full = Market(b)
        part = Market(b.slice(0, 3000))
        k = 2999
        for name, args in (("ema", (20,)), ("atr", (14,)), ("rsi", (14,)), ("hh", (20,)), ("std", (20,))):
            self.assertAlmostEqual(full.get(name, *args)[k], part.get(name, *args)[k], places=9, msg=name)
        for args in ((60, "ema", 50), (60, "er", 12), (60, "close", 0)):
            a, c = full.get("htf", *args)[k], part.get("htf", *args)[k]
            self.assertTrue(a == c or (a != a and c != c), args)
        self.assertEqual(full.asia_hi[k] == full.asia_hi[k], part.asia_hi[k] == part.asia_hi[k])
        self.assertEqual(full.pdh[k], part.pdh[k])
        self.assertEqual(full.regime(k), part.regime(k))

    def test_htf_n_utilise_que_des_bougies_cloturees(self):
        b = random_walk("2025-03-03 00:00", 300, tf=5, seed=2)
        m = Market(b)
        closes = m.get("htf", 60, "close", 0)
        # à 00:55 (bougie 11, clôture 01:00) la première H1 vient de se fermer : sa clôture = clôture M5 n°11
        self.assertEqual(closes[11], b.c[11])
        self.assertNotEqual(closes[10], closes[10])  # NaN : aucune H1 clôturée avant


class SessionsNews(unittest.TestCase):
    def test_sessions_heure_locale(self):
        c = SessionClock()
        self.assertTrue(c.in_session(ts("2025-07-01 07:30"), "london"))   # 08:30 Londres (BST)
        self.assertTrue(c.in_session(ts("2025-01-15 08:30"), "london"))   # 08:30 Londres (GMT)
        self.assertTrue(c.in_session(ts("2025-07-01 12:30"), "overlap"))  # 08:30 New York (EDT)
        self.assertFalse(c.in_session(ts("2025-07-01 12:30"), "london"))
        self.assertTrue(c.friday_cutoff(ts("2025-07-04 19:30")))          # vendredi 15:30 NY

    def test_fenetre_annonce(self):
        cal = NewsCalendar.builtin()
        nfp = ts("2026-09-04 12:30")  # 8:30 New York (EDT)
        self.assertIsNotNone(cal.blocked(nfp - 20 * 60, 30, 30))
        self.assertIsNotNone(cal.blocked(nfp + 20 * 60, 30, 30))
        self.assertIsNone(cal.blocked(nfp + 90 * 60, 30, 30))

    def test_calendrier_csv(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "cal.csv")
            with open(p, "w", encoding="utf-8") as f:
                f.write("time_utc,currency,impact,name\n2026-11-06 13:30,USD,high,Nonfarm Payrolls\n2026-11-06 15:00,EUR,high,X\n")
            cal = NewsCalendar.from_csv(p)
            self.assertEqual(len(cal.events), 1)
            self.assertIsNotNone(cal.blocked(ts("2026-11-06 13:10"), 30, 30))


if __name__ == "__main__":
    unittest.main()
