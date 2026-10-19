import os
import tempfile
import unittest

from tests.helpers import random_walk, sig, ts
from xauscalp.backtest import Account, CostModel, ExecRules, run
from xauscalp.broker.paper import ReplayBroker
from xauscalp.config import EngineConfig, LIVE_ENV, LIVE_PHRASE, live_allowed
from xauscalp.engine import Engine
from xauscalp.market import Market
from xauscalp.risk import RiskLimits
from xauscalp.strategies import CATALOG, Strategy
from xauscalp.strategies.base import Signal
from xauscalp.symbol import example_presets

SPEC = example_presets(gold_price=2000)["cent"]


class EveryBar(Strategy):
    """Signal d'achat à chaque bougie : sert à vérifier qu'aucun ordre n'est doublé."""
    name = "every_bar"
    defaults = {}

    def signal(self, m, k):
        c = m.b.c[k]
        return Signal(1, c - 3.0, c + 3.0, 30, "test")


def make_engine(d, bars, strategy="every_bar", **cfg_kw):
    CATALOG["every_bar"] = EveryBar
    cfg = EngineConfig(mode="paper", strategy=strategy, state_dir=d, history_bars=400,
                       sessions=["asia", "london", "overlap", "ny_pm"],
                       risk=RiskLimits(max_daily_loss_pct=50, max_drawdown_pct=50, max_trades_per_day=100), **cfg_kw)
    br = ReplayBroker(bars, SPEC, equity=100.0, start_index=400)
    return Engine(br, cfg, news=None), br


class EngineTests(unittest.TestCase):
    def test_une_seule_position_et_pas_de_doublon(self):
        bars = random_walk("2025-03-03 00:00", 900, seed=4)
        with tempfile.TemporaryDirectory() as d:
            eng, br = make_engine(d, bars)
            self.assertTrue(eng.start())
            for _ in range(300):
                eng.step(); eng.step()          # deux appels par bougie : la 2e ne doit rien faire
                self.assertLessEqual(len(br.positions()), 1)
                br.advance()
            ids = [c["comment"] for c in br.closed] + [p.comment for p in br.positions()]
            self.assertEqual(len(ids), len(set(ids)))
            self.assertGreater(len(ids), 5)

    def test_redemarrage_sans_renvoi(self):
        bars = random_walk("2025-03-03 00:00", 700, seed=6)
        with tempfile.TemporaryDirectory() as d:
            eng, br = make_engine(d, bars)
            eng.start()
            eng.step()
            n_orders = len(br.executed)
            self.assertEqual(n_orders, 1)
            # « crash » : nouveau moteur, même dossier d'état, même courtier, même bougie
            eng2 = Engine(br, eng.cfg, news=None)
            eng2.start()
            eng2.step()
            self.assertEqual(len(br.executed), n_orders)
            self.assertEqual(len(br.positions()), 1)

    def test_intention_en_suspens_confirmee_ou_abandonnee(self):
        bars = random_walk("2025-03-03 00:00", 700, seed=7)
        with tempfile.TemporaryDirectory() as d:
            eng, br = make_engine(d, bars)
            eng.start()
            # intention écrite puis crash avant la réponse du courtier : l'ordre n'a jamais été exécuté
            eng.state["intent"] = {"client_id": "xs-perdu", "created": br.now() - 120, "side": 1, "volume": 0.01,
                                   "sl": 1, "tp": 2, "max_until": br.now() + 600, "risk_money": 0.1}
            eng.persist()
            eng2 = Engine(br, eng.cfg, news=None)
            eng2.start()
            self.assertIsNone(eng2.state["intent"])
            self.assertNotIn("xs-perdu", br.executed)   # jamais renvoyé

    def test_rejet_d_ordres_puis_suspension(self):
        bars = random_walk("2025-03-03 00:00", 800, seed=8)
        with tempfile.TemporaryDirectory() as d:
            eng, br = make_engine(d, bars)
            eng.start()
            br.fail_next_orders = 10
            actions = []
            for _ in range(6):
                actions.append(eng.step()["action"])
                br.advance()
            self.assertEqual(actions[:3], ["order_failed"] * 3)
            self.assertTrue(eng.risk.state.suspended)
            self.assertEqual(br.executed, {})

    def test_arret_d_urgence_ferme_et_bloque(self):
        bars = random_walk("2025-03-03 00:00", 700, seed=9)
        with tempfile.TemporaryDirectory() as d:
            eng, br = make_engine(d, bars)
            eng.start()
            eng.step()
            self.assertEqual(len(br.positions()), 1)
            open(os.path.join(d, "STOP"), "w").close()
            br.advance()
            d2 = eng.step()
            self.assertEqual(len(br.positions()), 0)
            self.assertEqual(br.closed[-1]["reason"], "arrêt d'urgence")
            self.assertEqual(d2["action"], "refused")

    def test_position_sans_stop_fermee(self):
        bars = random_walk("2025-03-03 00:00", 700, seed=10)
        with tempfile.TemporaryDirectory() as d:
            eng, br = make_engine(d, bars)
            eng.start()
            eng.step()
            br.positions()[0].sl = 0.0
            br.advance()
            eng.step()
            self.assertEqual(br.closed[-1]["reason"], "position sans stop")

    def test_verrous_du_mode_reel(self):
        os.environ.pop(LIVE_ENV, None)
        self.assertFalse(live_allowed(EngineConfig(mode="live"), account_is_demo=False)[0])
        self.assertFalse(live_allowed(EngineConfig(mode="live", live_enabled=True), account_is_demo=False)[0])
        os.environ[LIVE_ENV] = LIVE_PHRASE
        try:
            self.assertFalse(live_allowed(EngineConfig(mode="live", live_enabled=True), account_is_demo=True)[0])
            self.assertTrue(live_allowed(EngineConfig(mode="live", live_enabled=True), account_is_demo=False)[0])
        finally:
            os.environ.pop(LIVE_ENV, None)
        self.assertFalse(live_allowed(EngineConfig(mode="demo"), account_is_demo=False)[0])
        self.assertTrue(live_allowed(EngineConfig(mode="demo"), account_is_demo=True)[0])
        self.assertFalse(EngineConfig().live_enabled)

    def test_moteur_et_backtest_prennent_les_memes_trades(self):
        """Signaux et ordres : le moteur (rejeu) doit retrouver les entrées du backtest."""
        bars = random_walk("2025-03-03 00:00", 6000, seed=11, vol=0.8)
        with tempfile.TemporaryDirectory() as d:
            eng, br = make_engine(d, bars, strategy="asia_breakout")
            eng.cfg.history_bars = 1500
            br.k = 1500
            eng.start()
            while br.advance():
                eng.step()
            live = sorted(int(c["open_ts"]) for c in br.closed)
        m = Market(bars)
        acc = Account(spec=SPEC, equity=100.0, limits=eng.cfg.risk)
        bt = run(m, CATALOG["asia_breakout"](), CostModel(slip_entry=0.03, slip_stop=0.05), ExecRules(
            sessions=tuple(eng.cfg.sessions), news=None), start_ts=bars.t[1500], account=acc)
        ref = sorted(t.entry_ts for t in bt.trades)
        self.assertGreater(len(ref), 10)
        common = len(set(live) & set(ref))
        self.assertGreaterEqual(common / max(len(ref), len(live)), 0.9, (len(live), len(ref), common))


if __name__ == "__main__":
    unittest.main()
