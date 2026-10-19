import unittest

from tests.helpers import Scripted, flat_bars, sig, ts
from xauscalp.backtest import Account, CostModel, ExecRules, run
from xauscalp.market import Market
from xauscalp.news import Event, NewsCalendar
from xauscalp.symbol import example_presets

# mardi 2025-07-01, 08:00 Londres = 07:00 UTC ; bougies M5 à partir de 06:00 UTC
START = "2025-07-01 06:00"
K = 20  # bougie de signal : 07:40 UTC -> exécution 07:45 UTC (session de Londres)
RULES = ExecRules(sessions=("london", "overlap", "ny_pm", "asia"), max_atr_ratio=99)


def market(n=200, spread=0.25):
    return Market(flat_bars(START, n, spread=spread))


class Fills(unittest.TestCase):
    def test_achat_a_l_ask_plus_slippage(self):
        m = market()
        c = CostModel(slip_entry=0.05)
        r = run(m, Scripted({K: sig(1, 1990, 2010)}), c, RULES)
        t = r.trades[0]
        self.assertEqual(t.entry_ts, m.b.t[K + 1])
        self.assertAlmostEqual(t.entry, 2000 + 0.25 + 0.05)
        self.assertAlmostEqual(t.risk_dist, 10.30)

    def test_stop_en_gap_sort_a_l_ouverture(self):
        m = market()
        k = K + 3
        m.b.o[k], m.b.h[k], m.b.l[k], m.b.c[k] = 1985, 1986, 1984, 1985
        c = CostModel(slip_stop=0.1)
        t = run(m, Scripted({K: sig(1, 1990, 2010)}), c, RULES).trades[0]
        self.assertEqual(t.reason, "stop")
        self.assertAlmostEqual(t.exit, 1985 - 0.1)   # pire que le stop : l'ouverture
        self.assertLess(t.r, -1.0)

    def test_stop_prioritaire_dans_la_meme_bougie(self):
        m = market()
        k = K + 2
        m.b.h[k], m.b.l[k] = 2011, 1989
        t = run(m, Scripted({K: sig(1, 1990, 2010)}), CostModel(), RULES).trades[0]
        self.assertEqual(t.reason, "stop")

    def test_vente_stoppee_par_l_ask(self):
        m = market(spread=0.5)
        k = K + 2
        m.b.h[k] = 2009.6   # bid haut 2009,6 < stop 2010, mais ask haut 2010,1 >= stop
        t = run(m, Scripted({K: sig(-1, 2010, 1990)}), CostModel(), RULES).trades[0]
        self.assertEqual(t.reason, "stop")
        self.assertEqual(t.exit_ts, m.b.t[k])

    def test_commission_et_brut(self):
        m = market()
        k = K + 2
        m.b.h[k] = 2010.5
        c = CostModel(commission_per_oz_rt=0.07)
        t = run(m, Scripted({K: sig(1, 1990, 2010)}), c, RULES).trades[0]
        self.assertEqual(t.reason, "target")
        self.assertAlmostEqual(t.pnl, 2010 - 2000.25 - 0.07)
        self.assertAlmostEqual(t.cost, 0.25 + 0.07)
        z = run(m, Scripted({K: sig(1, 1990, 2010)}), CostModel(spread_mult=0), RULES).trades[0]
        self.assertAlmostEqual(z.r, z.r_gross)

    def test_sortie_au_temps(self):
        m = market()
        t = run(m, Scripted({K: sig(1, 1990, 2010, minutes=30)}), CostModel(), RULES).trades[0]
        self.assertEqual(t.reason, "temps")
        self.assertEqual(t.exit_ts, m.b.t[K + 6])

    def test_annonce_bloque_l_entree(self):
        m = market()
        news = NewsCalendar([Event(m.b.t[K + 1] + 600, "NFP")])
        rules = ExecRules(sessions=RULES.sessions, news=news, max_atr_ratio=99)
        r = run(m, Scripted({K: sig(1, 1990, 2010)}), CostModel(), rules)
        self.assertEqual(r.trades, [])
        self.assertEqual(r.refused.get("annonce économique"), 1)

    def test_rejets_simules(self):
        m = market()
        r = run(m, Scripted({K: sig(1, 1990, 2010)}), CostModel(reject_prob=1.0), RULES)
        self.assertEqual(r.rejected, 1)
        self.assertEqual(r.trades, [])

    def test_compte_100eur_refuse_le_lot_minimum(self):
        m = market()
        acc = Account(spec=example_presets(gold_price=2000)["eu_retail"], equity=100.0)
        r = run(m, Scripted({K: sig(1, 1990, 2010)}), CostModel(), RULES, account=acc)
        self.assertEqual(r.trades, [])
        self.assertEqual(sum(v for k, v in r.refused.items() if k.startswith("lot minimum")), 1)
        acc = Account(spec=example_presets(gold_price=2000)["cent"], equity=100.0)
        r = run(m, Scripted({K: sig(1, 1990, 2010)}), CostModel(), RULES, account=acc)
        self.assertEqual(len(r.trades), 1)
        self.assertLessEqual(-r.trades[0].money, 0.25 + 1e-9)


if __name__ == "__main__":
    unittest.main()
