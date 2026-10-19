"""Connecteur MT5 testé avec un faux module (le vrai paquet MetaTrader5 n'existe que sous Windows)."""
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace as NS

from xauscalp.broker.mt5 import MT5Broker


class FakeMT5:
    ACCOUNT_TRADE_MODE_DEMO = 0
    ORDER_TYPE_BUY, ORDER_TYPE_SELL = 0, 1
    POSITION_TYPE_BUY, POSITION_TYPE_SELL = 0, 1
    TRADE_ACTION_DEAL, TRADE_ACTION_SLTP = 1, 6
    ORDER_TIME_GTC = 0
    ORDER_FILLING_FOK, ORDER_FILLING_IOC, ORDER_FILLING_RETURN = 0, 1, 2
    TIMEFRAME_M1, TIMEFRAME_M5, TIMEFRAME_M15, TIMEFRAME_H1 = 1, 5, 15, 16385

    def __init__(self):
        self.sent, self.positions, self.next_retcodes = [], [], []
        self.sl_supported = True
        self.check_retcode = 0

    def initialize(self, *a, **k): return True
    def symbol_select(self, *a): return True
    def terminal_info(self): return NS(connected=True)
    def last_error(self): return (1, "erreur simulée")

    def account_info(self):
        return NS(equity=100.0, balance=100.0, margin_free=100.0, currency="EUR", trade_mode=0, login=1, server="Demo")

    def symbol_info(self, s):
        return NS(name=s, digits=2, point=0.01, trade_tick_size=0.01, trade_tick_value=0.0086, trade_tick_value_loss=0.0086,
                  trade_contract_size=1.0, volume_min=0.01, volume_max=100.0, volume_step=0.01, trade_stops_level=0,
                  trade_freeze_level=0, currency_profit="USD", filling_mode=2)

    def symbol_info_tick(self, s):
        # heure serveur 2025-07-01 15:00 (Paris + 1, UTC+3 l'été) = 12:00 UTC
        return NS(time=int(datetime(2025, 7, 1, 15, 0, tzinfo=timezone.utc).timestamp()), bid=3300.0, ask=3300.3)

    def order_calc_margin(self, *a): return 6.6

    def order_check(self, req): return NS(retcode=self.check_retcode, comment="")

    def order_send(self, req):
        self.sent.append(req)
        code = self.next_retcodes.pop(0) if self.next_retcodes else 10009
        if code in (10009, 10010) and req["action"] == self.TRADE_ACTION_DEAL and "position" not in req:
            vol = req["volume"] / 2 if code == 10010 else req["volume"]
            self.positions.append(NS(ticket=len(self.sent), type=req["type"], volume=vol, price_open=req["price"],
                                     sl=req["sl"] if self.sl_supported else 0.0, tp=req["tp"], time=0,
                                     comment=req["comment"], magic=req["magic"]))
            return NS(retcode=code, order=len(self.sent), volume=vol, price=req["price"], comment="")
        if code == 10009 and req["action"] == self.TRADE_ACTION_SLTP:
            return NS(retcode=code, order=0, volume=0, price=0, comment="")
        if code == 10009 and "position" in req:
            self.positions = [p for p in self.positions if p.ticket != req["position"]]
            return NS(retcode=code, order=0, volume=req["volume"], price=req["price"], comment="")
        return NS(retcode=code, order=0, volume=0, price=0, comment="refus")

    def positions_get(self, symbol=None): return tuple(self.positions)
    def history_deals_get(self, a, b): return ()


class MT5Tests(unittest.TestCase):
    def setUp(self):
        self.mt = FakeMT5()
        self.br = MT5Broker("XAUUSDc", mt5_module=self.mt, server_tz="paris+1")
        self.br.connect()

    def test_spec_lue_chez_le_courtier(self):
        s = self.br.symbol_spec()
        self.assertEqual(s.contract_size, 1.0)
        self.assertEqual(s.margin_per_lot, 6.6)
        self.assertEqual(s.source, "broker")

    def test_heure_serveur_convertie(self):
        self.assertEqual(self.br.tick().ts, datetime(2025, 7, 1, 12, 0, tzinfo=timezone.utc).timestamp())

    def test_execution_partielle(self):
        self.mt.next_retcodes = [10010]
        r = self.br.market_order(1, 0.10, 3290.0, 3320.0, "xs1B")
        self.assertTrue(r.ok and r.partial)
        self.assertAlmostEqual(r.volume, 0.05)

    def test_requote_reessayable_stops_invalides_fatal(self):
        self.mt.next_retcodes = [10004]
        r = self.br.market_order(1, 0.10, 3290.0, 3320.0, "xs2B")
        self.assertFalse(r.ok)
        self.assertTrue(r.retryable)
        self.mt.next_retcodes = [10016]
        r = self.br.market_order(1, 0.10, 3290.0, 3320.0, "xs3B")
        self.assertFalse(r.ok or r.retryable)
        self.assertIn("stops", r.message)

    def test_order_check_bloque_l_envoi(self):
        self.mt.check_retcode = 10019
        r = self.br.market_order(1, 0.10, 3290.0, 3320.0, "xs4B")
        self.assertFalse(r.ok)
        self.assertEqual(self.mt.sent, [])

    def test_stop_absent_pose_ou_position_fermee(self):
        self.mt.sl_supported = False
        self.mt.next_retcodes = [10009, 10016, 10009]   # ouverture, pose du stop refusée, fermeture
        r = self.br.market_order(1, 0.10, 3290.0, 3320.0, "xs5B")
        self.assertFalse(r.ok)
        self.assertEqual(self.br.positions(), [])

    def test_positions_filtrees_par_magic(self):
        self.mt.positions.append(NS(ticket=99, type=0, volume=1, price_open=1, sl=0, tp=0, time=0, comment="manuel", magic=0))
        self.assertEqual(self.br.positions(), [])


if __name__ == "__main__":
    unittest.main()
