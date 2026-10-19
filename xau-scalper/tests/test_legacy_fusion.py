"""Anciens robots portés en Python (méthode du PDF, liquidité) et fusion avec le nouveau."""
import tempfile
import unittest

from tests.helpers import Scripted, flat_bars, random_walk, sig, ts
from xauscalp.backtest import CostModel, ExecRules, Trade, run
from xauscalp.broker.paper import ReplayBroker
from xauscalp.config import EngineConfig
from xauscalp.engine import Engine
from xauscalp.market import Market
from xauscalp.portfolio import merge, simulate_account
from xauscalp.risk import RiskLimits
from xauscalp.strategies import CATALOG, make
from xauscalp.symbol import example_presets

ALL = ("asia", "london", "overlap", "ny_pm")


def sweep_day():
    """25 jours plats (bougies M5 de 1 $), puis mercredi 2 juillet 2025 : sweep du haut asiatique à 09:30 Paris
    et cassure du creux à 09:35 Paris."""
    b = flat_bars("2025-06-02 00:00", 0)
    t = ts("2025-06-02 00:00")
    end = ts("2025-07-02 07:30")
    while t < end:
        b.t.append(t); b.o.append(2000.0); b.h.append(2000.5); b.l.append(1999.5); b.c.append(2000.0)
        b.v.append(100.0); b.spread.append(0.2)
        t += 300
    for o, h, l, c in ((2000.0, 2001.5, 1999.9, 2000.2),   # 09:30 Paris : sweep du haut (2000,5)
                       (2000.2, 2000.3, 1999.0, 1999.2),   # 09:35 : clôture sous le creux (1999,5) -> MSS
                       (1999.2, 1999.3, 1990.0, 1990.5)):
        b.t.append(t); b.o.append(o); b.h.append(h); b.l.append(l); b.c.append(c); b.v.append(150.0); b.spread.append(0.2)
        t += 300
    return b


class Liquidity(unittest.TestCase):
    def test_sweep_puis_mss_donne_une_vente(self):
        b = sweep_day()
        m = Market(b)
        st = make("liquidity_mss")
        sigs = {k: st.signal(m, k) for k in range(len(b) - 3000, len(b))}
        hits = {k: s for k, s in sigs.items() if s}
        self.assertEqual(list(hits), [len(b) - 2], hits)
        s = hits[len(b) - 2]
        self.assertEqual(s.side, -1)
        self.assertGreater(s.stop, 2001.5)                                   # derrière la mèche du sweep
        self.assertAlmostEqual(1999.2 - s.target, 3 * (s.stop - 1999.2), places=6)  # target 3R
        self.assertIn("haut", s.tag)

    def test_meme_resultat_sans_memoire(self):
        """Le moteur reconstruit le marché à chaque bougie : le signal doit être identique."""
        b = sweep_day()
        k = len(b) - 2
        fresh = make("liquidity_mss").signal(Market(b.slice(0, k + 1)), k)
        self.assertIsNotNone(fresh)
        self.assertEqual(fresh.side, -1)


class Geometry(unittest.TestCase):
    def test_signaux_coherents_et_breakeven(self):
        b = random_walk("2025-03-03 00:00", 6000, seed=21, vol=1.2)
        m = Market(b)
        st = make("geometry_pdf")
        found = 0
        for k in range(3000, 6000):
            s = st.signal(m, k)
            if s:
                found += 1
                c = b.c[k]
                self.assertTrue((c - s.stop) * s.side > 0 and (s.target - c) * s.side > 0)
                self.assertGreaterEqual((s.target - c) * s.side / ((c - s.stop) * s.side), 2.0 - 1e-9)  # R:R >= 2
                self.assertEqual(s.be_at_r, 1.0)
        self.assertGreater(found, 0)

    def test_breakeven_dans_le_backtest(self):
        m = Market(flat_bars("2025-07-01 06:00", 120))
        K = 20
        b = m.b
        for k, (h, l, c) in {K + 2: (2011, 2000, 2010.5), K + 3: (2010.5, 1999, 1999.5)}.items():
            b.h[k], b.l[k], b.c[k] = h, l, c
        s = sig(1, 1990, 2030)
        s.be_at_r = 1.0
        t = run(m, Scripted({K: s}), CostModel(spread_mult=0), ExecRules(sessions=ALL, max_atr_ratio=99)).trades[0]
        self.assertEqual(t.reason, "stop")
        self.assertAlmostEqual(t.exit, 2000.0)   # sorti au prix d'entrée, pas au stop initial


class Fusion(unittest.TestCase):
    def _t(self, a, z, name="x"):
        return Trade(name, 1, a, a, 100.0, 99.0, 102.0, exit_ts=z, risk_dist=1.0, pnl=0.5)

    def test_une_position_a_la_fois_et_priorite(self):
        r2 = [self._t(100, 200, "liq"), self._t(500, 600, "liq")]
        r3 = [self._t(100, 150, "don"), self._t(150, 250, "don"), self._t(300, 350, "don")]
        out = merge([r2, r3])
        self.assertEqual([(t.strategy, t.entry_ts) for t in out], [("liq", 100), ("don", 300), ("liq", 500)])

    def test_compte_cent_100eur(self):
        tl = [self._t(86400 * k, 86400 * k + 60) for k in range(10)]
        acc = simulate_account(tl, example_presets(gold_price=2000)["cent"], 100.0, RiskLimits(risk_pct=0.25))
        self.assertEqual(acc["taken"], 10)
        self.assertGreater(acc["final"], 100.0)
        eu = simulate_account(tl, example_presets(gold_price=2000)["eu_retail"], 100.0, RiskLimits(risk_pct=0.25))
        self.assertEqual(eu["taken"], 0)

    def test_ensemble_par_configuration(self):
        e = make("ensemble", members=[{"name": "liquidity_mss"}, {"name": "donchian_breakout", "sessions": ["asia"]}])
        self.assertIn("liquidity_mss", e.label())
        self.assertIn("asia", e.label())

    def test_moteur_plusieurs_robots_sans_doublon(self):
        class Always(CATALOG["donchian_breakout"]):
            name = "always"

            def signal(self, m, k):
                from xauscalp.strategies.base import Signal
                c = m.b.c[k]
                return Signal(1, c - 4.0, c + 4.0, 20, "test")
        CATALOG["always"] = Always
        bars = random_walk("2025-03-03 00:00", 1500, seed=12)
        with tempfile.TemporaryDirectory() as d:
            cfg = EngineConfig(mode="paper", state_dir=d, history_bars=400, members=[
                {"name": "always", "tf": 5, "sessions": list(ALL)}, {"name": "always", "tf": 15, "sessions": list(ALL)}],
                risk=RiskLimits(max_daily_loss_pct=50, max_drawdown_pct=50, max_trades_per_day=500))
            br = ReplayBroker(bars, example_presets(gold_price=2000)["cent"], equity=100.0, start_index=1300)
            eng = Engine(br, cfg)
            self.assertTrue(eng.start())
            for _ in range(150):
                eng.step()
                self.assertLessEqual(len(br.positions()), 1)
                br.advance()
            ids = list(br.executed)
            self.assertEqual(len(ids), len(set(ids)))
            self.assertGreater(len(ids), 3)


if __name__ == "__main__":
    unittest.main()
