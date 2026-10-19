import os
import tempfile
import unittest

from xauscalp.feasibility import feasibility
from xauscalp.risk import RiskLimits, RiskManager
from xauscalp.sizing import size_position
from xauscalp.symbol import SymbolSpec, example_presets


class Sizing(unittest.TestCase):
    def setUp(self):
        self.p = example_presets(gold_price=4300, eurusd=1.16)

    def test_eu_retail_100eur_refuse_lot_minimum(self):
        r = size_position(self.p["eu_retail"], 100.0, 0.25, 4300.0, 4297.0)
        self.assertFalse(r.ok)
        self.assertIn("lot minimum", r.reason)
        self.assertGreater(r.risk_money, r.allowed_money)

    def test_cent_dimensionne_et_respecte_le_risque(self):
        spec = self.p["cent"]
        r = size_position(spec, 100.0, 0.25, 4300.0, 4297.0, spread=0.3, slippage=0.05)
        self.assertTrue(r.ok, r.reason)
        self.assertLessEqual(r.risk_money, r.allowed_money + 1e-9)
        # arrondi vers le bas au pas de volume
        self.assertAlmostEqual(r.volume / spec.volume_step, round(r.volume / spec.volume_step), places=6)
        # un pas de plus dépasserait la limite
        bigger = size_position(spec, 1e9, 0.25, 4300.0, 4297.0)  # référence : perte par lot
        per_lot = spec.loss_for(1.0, 3.35)
        self.assertGreater((r.volume + spec.volume_step) * per_lot, r.allowed_money)
        self.assertTrue(bigger.ok)

    def test_commission_incluse(self):
        spec = SymbolSpec(**{**self.p["cent"].__dict__, "commission_per_lot_rt": 1.0})
        a = size_position(self.p["cent"], 100.0, 0.25, 4300.0, 4295.0)
        b = size_position(spec, 100.0, 0.25, 4300.0, 4295.0)
        self.assertLess(b.volume, a.volume)

    def test_marge_insuffisante(self):
        spec = SymbolSpec(**{**self.p["cent"].__dict__, "margin_per_lot": 5000.0})
        r = size_position(spec, 100.0, 0.25, 4300.0, 4297.0, free_margin=100.0)
        self.assertFalse(r.ok)
        self.assertIn("marge", r.reason)

    def test_stops_level(self):
        spec = SymbolSpec(**{**self.p["cent"].__dict__, "stops_level": 500})  # 5 $
        self.assertFalse(size_position(spec, 100.0, 0.25, 4300.0, 4297.0).ok)

    def test_aucune_valeur_codee_en_dur(self):
        # la perte dépend uniquement de la spec : tick 0,1 et valeur 10 => 100 par $ et par lot
        spec = SymbolSpec("X", 1, 0.1, 0.1, 10.0, 100, 0.01, 10, 0.01)
        self.assertAlmostEqual(spec.loss_for(1.0, 1.0), 100.0)

    def test_faisabilite_100eur(self):
        f = feasibility(self.p["eu_retail"], equity=100, risk_pct=0.25, price=4300, stop_distances=[2, 3, 5])
        self.assertEqual(f["share_signals_sizeable"], 0.0)
        self.assertFalse(f["margin_ok"])           # 0,01 lot à 1:20 ≈ 185 € de marge > 50 % de 100 €
        self.assertGreater(f["equity_needed_for_median_stop"], 1000)
        c = feasibility(self.p["cent"], equity=100, risk_pct=0.25, price=4300, stop_distances=[2, 3, 5])
        self.assertEqual(c["share_signals_sizeable"], 1.0)


class Risk(unittest.TestCase):
    def test_perte_journaliere(self):
        rm = RiskManager(RiskLimits(max_daily_loss_pct=1.0))
        rm.on_equity("d1", 100.0)
        self.assertTrue(rm.can_open(equity=99.5, open_positions=0)[0])
        self.assertFalse(rm.can_open(equity=99.0, open_positions=0)[0])
        rm.on_equity("d2", 99.0)          # nouveau jour : nouvelle référence
        self.assertTrue(rm.can_open(equity=99.0, open_positions=0)[0])

    def test_drawdown_suspend_jusqu_au_rearmement(self):
        rm = RiskManager(RiskLimits(max_drawdown_pct=5.0, max_daily_loss_pct=50))
        rm.on_equity("d1", 100.0)
        rm.on_equity("d1", 110.0)
        rm.on_equity("d2", 104.4)
        self.assertTrue(rm.state.suspended)
        rm.on_equity("d3", 108.0)
        ok, why = rm.can_open(equity=108.0, open_positions=0)
        self.assertFalse(ok)
        self.assertIn("suspendu", why)
        rm.rearm(108.0)
        self.assertTrue(rm.can_open(equity=108.0, open_positions=0)[0])

    def test_une_position_spread_donnees_kill(self):
        rm = RiskManager(RiskLimits(max_spread=0.6, max_data_age_s=60))
        rm.on_equity("d", 100)
        self.assertFalse(rm.can_open(equity=100, open_positions=1)[0])
        self.assertFalse(rm.can_open(equity=100, open_positions=0, spread=0.8)[0])
        self.assertFalse(rm.can_open(equity=100, open_positions=0, data_age_s=120)[0])
        with tempfile.TemporaryDirectory() as d:
            open(os.path.join(d, "STOP"), "w").close()
            ok, why = rm.can_open(equity=100, open_positions=0, workdir=d)
            self.assertFalse(ok)
            self.assertIn("urgence", why)

    def test_pas_de_martingale(self):
        rm = RiskManager(RiskLimits(risk_pct=0.25))
        rm.on_equity("d", 100)
        for eq in (99.75, 99.5, 99.25):
            rm.on_equity("d", eq)
            self.assertEqual(rm.risk_pct(), 0.25)

    def test_erreurs_execution(self):
        rm = RiskManager(RiskLimits(max_exec_errors=3))
        for _ in range(2):
            rm.on_exec_result(False)
        rm.on_exec_result(True)
        self.assertFalse(rm.state.suspended)
        for _ in range(3):
            rm.on_exec_result(False)
        self.assertTrue(rm.state.suspended)


if __name__ == "__main__":
    unittest.main()
