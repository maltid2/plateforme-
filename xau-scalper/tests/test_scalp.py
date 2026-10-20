"""Scalp agressif : plusieurs positions, ~1 € de risque, bougies en secondes."""
import tempfile
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace as NS

from tests.helpers import random_walk
from tests.test_mt5_fake import FakeMT5
from xauscalp.backtest import CostModel, ExecRules
from xauscalp.broker.mt5 import MT5Broker
from xauscalp.broker.paper import ReplayBroker
from xauscalp.config import EngineConfig
from xauscalp.engine import Engine
from xauscalp.market import Market
from xauscalp.risk import RiskLimits
from xauscalp.scalp import SCALP, ScalpAccount, aggressive_limits, run_multi
from xauscalp.strategies import CATALOG
from xauscalp.strategies.base import Signal, Strategy
from xauscalp.symbol import example_presets

ALL = ("asia", "london", "overlap", "ny_pm")


class Always(Strategy):
    name = "always_scalp"
    defaults = {}

    def signal(self, m, k):
        c = m.b.c[k]
        return Signal(1 if k % 2 else -1, c - 2.0 if k % 2 else c + 2.0, c + 2.0 if k % 2 else c - 2.0, 5.0, "test")


class RunMulti(unittest.TestCase):
    def test_positions_simultanees_plafonnees(self):
        m = Market(random_walk("2025-03-03 00:00", 3000, tf=1, seed=31, vol=0.4))
        res = run_multi(m, Always(), CostModel(), ExecRules(sessions=ALL, max_atr_ratio=99), max_positions=3)
        tr = res["trades"]
        self.assertGreater(len(tr), 100)
        events = sorted([(t.entry_ts, 1) for t in tr] + [(t.exit_ts, -1) for t in tr], key=lambda e: (e[0], e[1]))
        cur = peak = 0
        for _, d in events:
            cur += d
            peak = max(peak, cur)
        self.assertLessEqual(peak, 3)
        self.assertGreaterEqual(peak, 2)

    def test_environ_un_euro_par_position(self):
        m = Market(random_walk("2025-03-03 00:00", 3000, tf=1, seed=32, vol=0.4))
        acc = ScalpAccount(example_presets(gold_price=2000)["cent"], 100.0, aggressive_limits())
        res = run_multi(m, Always(), CostModel(), ExecRules(sessions=ALL, max_atr_ratio=99), max_positions=3, account=acc)
        losers = [t for t in res["trades"] if t.reason == "stop"]
        self.assertTrue(losers)
        for t in losers[:20]:
            self.assertLessEqual(-t.money, 1.15)  # ~1 % de l'equity, frais et glissement compris
        self.assertLessEqual(max(t.exit_ts - t.entry_ts for t in res["trades"] if t.reason != "fin"), 300)

    def test_strategies_de_scalp(self):
        m = Market(random_walk("2025-03-03 00:00", 4000, tf=1, seed=33, vol=0.5))
        for name, cls in SCALP.items():
            st = cls()
            sigs = [st.signal(m, k) for k in range(100, 4000)]
            sigs = [(k, s) for k, s in zip(range(100, 4000), sigs) if s]
            self.assertTrue(sigs, name)
            for k, s in sigs:
                c = m.b.c[k]
                self.assertTrue((c - s.stop) * s.side > 0 and (s.target - c) * s.side > 0, name)
                self.assertLessEqual(s.max_minutes, 5)


class EngineScalp(unittest.TestCase):
    def test_moteur_trois_positions_sans_doublon(self):
        CATALOG["always_scalp"] = Always
        bars = random_walk("2025-03-03 00:00", 1200, tf=1, seed=34, vol=0.3)
        with tempfile.TemporaryDirectory() as d:
            cfg = EngineConfig(mode="paper", state_dir=d, history_bars=400, strategy="always_scalp", tf=1,
                               sessions=list(ALL), risk=RiskLimits(risk_pct=1.0, max_positions=3, max_daily_loss_pct=50,
                                                                   max_drawdown_pct=50, max_trades_per_day=1000))
            br = ReplayBroker(bars, example_presets(gold_price=2000)["cent"], equity=100.0, start_index=500)
            eng = Engine(br, cfg)
            eng.start()
            peak = 0
            for _ in range(300):
                eng.step()
                peak = max(peak, len(br.positions()))
                self.assertLessEqual(len(br.positions()), 3)
                br.advance()
            self.assertEqual(peak, 3)
            self.assertEqual(len(br.executed), len(set(br.executed)))


class TickBars(unittest.TestCase):
    def test_bougies_de_10_secondes_depuis_les_ticks(self):
        mt = FakeMT5()
        mt.COPY_TICKS_INFO = 1
        base = int(datetime(2025, 7, 1, 15, 0, tzinfo=timezone.utc).timestamp())  # heure serveur
        ticks = [{"time_msc": (base - 60 + s) * 1000, "bid": 3300 + s * 0.01, "ask": 3300.3 + s * 0.01} for s in range(0, 61, 2)]
        mt.copy_ticks_from = lambda *a: ticks
        br = MT5Broker("XAUUSD", mt5_module=mt, server_tz="paris+1")
        b = br.bars(10 / 60, 10)
        self.assertEqual(len(b), 6)
        self.assertEqual(b.t[1] - b.t[0], 10)
        self.assertAlmostEqual(b.spread[0], 0.3, places=6)
        self.assertEqual(b.t[0], int(datetime(2025, 7, 1, 11, 59, tzinfo=timezone.utc).timestamp()))


if __name__ == "__main__":
    unittest.main()
