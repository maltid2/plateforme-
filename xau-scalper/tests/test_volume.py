import unittest

from xauscalp.backtest import Trade
from xauscalp.risk import RiskLimits
from xauscalp.symbol import example_presets
from xauscalp.volume import simulate_multi


def tr(a, z, pnl=0.5):
    return Trade("u", 1, a, a, 100.0, 99.0, 102.0, exit_ts=z, risk_dist=1.0, pnl=pnl)


class Volume(unittest.TestCase):
    def test_plafond_de_positions(self):
        trades = [tr(100 + k, 1000) for k in range(10)]   # 10 signaux qui se chevauchent
        acc = simulate_multi(trades, example_presets(gold_price=100)["cent"], 100.0,
                             RiskLimits(risk_pct=1.0, max_positions=5, max_trades_per_day=100), 5)
        self.assertEqual(acc["taken"], 5)
        self.assertEqual(acc["refused"].get("position déjà ouverte"), 5)
        self.assertGreater(acc["final"], 100.0)

    def test_positions_successives_toutes_prises(self):
        trades = [tr(100 * k, 100 * k + 50) for k in range(10)]
        acc = simulate_multi(trades, example_presets(gold_price=100)["cent"], 100.0,
                             RiskLimits(risk_pct=1.0, max_positions=5, max_trades_per_day=100), 5)
        self.assertEqual(acc["taken"], 10)

    def test_les_pertes_reduisent_la_taille(self):
        trades = [tr(100 * k, 100 * k + 50, pnl=-1.05) for k in range(5)]
        acc = simulate_multi(trades, example_presets(gold_price=100)["cent"], 100.0,
                             RiskLimits(risk_pct=1.0, max_positions=5, max_daily_loss_pct=50, max_trades_per_day=100), 5)
        self.assertLess(acc["final"], 100.0)
        self.assertGreater(acc["final"], 94.0)   # ~1 € par perte, jamais plus


if __name__ == "__main__":
    unittest.main()
