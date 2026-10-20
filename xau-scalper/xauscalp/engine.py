"""Moteur d'exécution (paper / démo MT5 / réel verrouillé).

Garanties recherchées :
- jamais d'ordre en double : une seule évaluation par bougie clôturée (persistée AVANT l'envoi),
  intention d'ordre persistée avant order_send, et vérification au redémarrage (position ou deal
  portant le même identifiant) ;
- resynchronisation avec les positions du courtier à chaque boucle (le courtier fait foi) ;
- aucune entrée si : données périmées, spread excessif, annonce, session fermée, risque dépassé ;
- une position sans stop est corrigée ou fermée ;
- toute décision est journalisée.
"""
from __future__ import annotations

import os
import time

from .alerts import Alerts
from .config import EngineConfig, live_allowed
from .journal import Journal, save_state, load_state
from .market import Market
from .news import NewsCalendar
from .risk import RiskManager, RiskState
from .sessions import SessionClock
from .sizing import size_position
from .strategies import make, TrendFilter


class Engine:
    def __init__(self, broker, cfg: EngineConfig, *, news: NewsCalendar | None = None, alerts: Alerts | None = None):
        self.broker, self.cfg = broker, cfg
        self.dir = cfg.state_dir
        os.makedirs(self.dir, exist_ok=True)
        self.state_path = os.path.join(self.dir, "state.json")
        self.journal = Journal(os.path.join(self.dir, "journal.jsonl"))
        self.alerts = alerts or Alerts()
        # plusieurs robots possibles (cfg.members), chacun avec son unité de temps et ses sessions ;
        # sinon un seul robot décrit par strategy / tf / sessions. Ordre de la liste = priorité.
        specs = cfg.members or [{"name": cfg.strategy, "params": cfg.strategy_params, "tf": cfg.tf,
                                 "sessions": cfg.sessions, "h1": cfg.h1_filter}]
        self.members = []
        for sp in specs:
            st = make(sp["name"], **sp.get("params", {}))
            tf = sp["tf_seconds"] / 60 if sp.get("tf_seconds") else sp.get("tf", cfg.tf)  # bougies en secondes possibles
            self.members.append({"strategy": TrendFilter(st) if sp.get("h1") else st, "tf": tf,
                                 "sessions": list(sp.get("sessions", cfg.sessions)), "name": sp["name"]})
        self.strategy = self.members[0]["strategy"]
        self.news = news
        self.clock = SessionClock()
        self.state = load_state(self.state_path)
        self.risk = RiskManager(cfg.risk, RiskState(**self.state.get("risk", {})))
        self.state.setdefault("last_bar_ts", 0)
        self.state.setdefault("last_bar", {})
        self.state.setdefault("intent", None)
        self.state.setdefault("managed", {})
        self.started = False
        self.stopped_reason = ""

    # ------------------------------------------------------------------------
    def persist(self, **extra):
        self.state["risk"] = self.risk.to_dict()
        self.state.update(extra)
        save_state(self.state_path, self.state)

    def start(self) -> bool:
        if not self.broker.connect():
            self.alerts.send("ERREUR", "connexion au courtier impossible")
            return False
        acc = self.broker.account()
        ok, why = live_allowed(self.cfg, acc.is_demo)
        self.journal.log("start", mode=self.cfg.mode, account=acc.__dict__, allowed=ok, reason=why,
                         strategy=" > ".join(f"{m['strategy'].label()} M{m['tf']} {'+'.join(m['sessions'])}" for m in self.members))
        if not ok:
            self.alerts.send("BLOQUÉ", why)
            self.stopped_reason = why
            return False
        self.spec = self.broker.symbol_spec()
        self.journal.log("symbol_spec", **self.spec.__dict__)
        self.started = True
        self.reconcile()
        return True

    # ------------------------------------------------------------------------
    def reconcile(self):
        """Le courtier fait foi : positions réelles, intention d'ordre en suspens."""
        positions = self.broker.positions()
        intent = self.state.get("intent")
        if intent:
            if self.broker.was_executed(intent["client_id"], intent["created"]):
                self.journal.log("intent_confirmed", **intent)
                self.state["managed"].setdefault(str(next((p.ticket for p in positions if p.comment == intent["client_id"][:31]), 0)),
                                                 {"max_until": intent["max_until"], "client_id": intent["client_id"]})
                self.state["intent"] = None
            elif self.broker.now() - intent["created"] > self.cfg.intent_timeout_s:
                self.journal.log("intent_abandoned", **intent)   # jamais renvoyé
                self.state["intent"] = None
        known = {str(p.ticket) for p in positions}
        for t in list(self.state["managed"]):
            if t not in known:
                self.journal.log("position_closed_at_broker", ticket=t)
                self.state["managed"].pop(t)
        for p in positions:
            if str(p.ticket) not in self.state["managed"]:
                # position inconnue (redémarrage sans état) : gérée avec la durée max de la stratégie
                self.state["managed"][str(p.ticket)] = {"max_until": p.open_ts + 6 * 3600, "client_id": p.comment}
                self.journal.log("position_adopted", ticket=p.ticket, side=p.side, volume=p.volume)
        if len(positions) > self.cfg.risk.max_positions:
            self.risk.suspend(f"{len(positions)} positions ouvertes (max {self.cfg.risk.max_positions})")
            self.alerts.send("ANOMALIE", f"{len(positions)} positions ouvertes : suspension")
        self.persist()
        return positions

    # ------------------------------------------------------------------------
    def manage(self, positions, now: float):
        kill = os.path.exists(os.path.join(self.dir, self.cfg.risk.kill_file))
        for p in positions:
            info = self.state["managed"].get(str(p.ticket), {})
            reason = None
            if kill:
                reason = "arrêt d'urgence"
            elif self.clock.weekend_flatten(int(now)):
                reason = "week-end"
            elif self.news and self.news.blocked(int(now), self.cfg.flatten_before_news_min, 0):
                reason = "annonce imminente"
            elif now >= info.get("max_until", float("inf")):
                reason = "durée maximale"
            elif not p.sl:
                reason = "position sans stop"
            if not reason and info.get("be") and not info.get("be_done") and info.get("risk"):
                t = self.broker.tick()
                px = (t.bid if p.side > 0 else t.ask) if t else None
                if px is not None and (px - info["entry"]) * p.side >= info["be"] * info["risk"]:
                    r = self.broker.modify_sl_tp(p, info["entry"], p.tp or None)
                    info["be_done"] = r.ok
                    self.journal.log("breakeven", ticket=p.ticket, ok=r.ok, sl=info["entry"], message=r.message)
                    self.persist()
            if reason:
                r = self.broker.close(p, reason)
                self.risk.on_exec_result(r.ok)
                self.journal.log("close", ticket=p.ticket, reason=reason, ok=r.ok, price=r.price, message=r.message)
                if not r.ok:
                    self.alerts.send("ERREUR", f"fermeture impossible ticket {p.ticket} : {r.message}")

    # ------------------------------------------------------------------------
    def step(self) -> dict:
        """Une itération. Renvoie la décision prise (pour le journal et les tests)."""
        if not self.started:
            return {"action": "not_started"}
        if not self.broker.connected():
            ok = self.broker.connect()
            self.journal.log("reconnect", ok=ok)
            if not ok:
                self.alerts.send("ERREUR", "connexion perdue", key="conn")
                return {"action": "no_connection"}
            self.reconcile()
        now = self.broker.now()
        acc = self.broker.account()
        self.risk.on_equity(str(self.clock.info(int(now))[2]), acc.equity)
        positions = self.reconcile()
        self.manage(positions, now)
        positions = self.broker.positions()

        bars_by_tf, new_tf = {}, []
        for tf in sorted({mm["tf"] for mm in self.members}):
            bars = self.broker.bars(tf, self.cfg.history_bars)
            if len(bars) < 300:
                continue
            bars_by_tf[tf] = bars
            if bars.t[-1] > self.state["last_bar"].get(str(tf), 0):
                new_tf.append(tf)
                self.state["last_bar"][str(tf)] = bars.t[-1]
        if not bars_by_tf:
            return self._decide("skip", "historique insuffisant")
        if not new_tf:
            return {"action": "wait"}
        # une seule évaluation par bougie et par unité de temps, même après un crash
        self.state["last_bar_ts"] = max(self.state["last_bar"].values())
        self.persist()
        tick = self.broker.tick()
        # données périmées : seule l'unité de temps concernée est ignorée (les autres robots continuent)
        fresh = []
        for tf in new_tf:
            age = now - (bars_by_tf[tf].t[-1] + tf * 60)
            if tick is not None and age <= self.cfg.risk.max_data_age_s and now - tick.ts <= self.cfg.risk.max_data_age_s:
                fresh.append(tf)
        if not fresh:
            self.alerts.send("ALERTE", f"données périmées ({age:.0f} s)", key="stale")
            return self._decide("skip", f"données périmées ({age:.0f} s)")
        new_tf = fresh
        if len(positions) >= self.cfg.risk.max_positions or self.state.get("intent"):
            return self._decide("skip", "nombre max de positions ou ordre déjà en cours")
        nxt = int(now)
        if self.clock.friday_cutoff(nxt) or self.clock.rollover(nxt):
            return self._decide("skip", "vendredi soir / rollover")
        sig = member = m = None
        in_session = False
        for mem in self.members:
            if mem["tf"] not in new_tf or not any(self.clock.in_session(nxt, s) for s in mem["sessions"]):
                continue
            in_session = True
            m = Market(bars_by_tf[mem["tf"]])
            k = m.n - 1
            sig = mem["strategy"].signal(m, k)
            if sig is not None:
                member = mem
                break
        if not in_session:
            return self._decide("skip", "hors session")
        if sig is None:
            return self._decide("no_signal", "")
        last_ts = bars_by_tf[member["tf"]].t[-1]
        age = now - (last_ts + member["tf"] * 60)
        sig.tag = f"[{member['name']} M{member['tf']}] {sig.tag}"
        if self.news and self.news.blocked(nxt, self.cfg.news_before_min, self.cfg.news_after_min):
            return self._decide("refused", "annonce économique", sig)
        ar = m.get("atr_ratio", m.bars_for(5 * 1440))[k]
        if ar == ar and ar > self.cfg.max_atr_ratio:
            return self._decide("refused", "volatilité anormale", sig)
        ok, why = self.risk.can_open(equity=acc.equity, open_positions=len(positions), spread=tick.spread,
                                     data_age_s=age, workdir=self.dir)
        if not ok:
            return self._decide("refused", why, sig)
        entry = tick.ask if sig.side > 0 else tick.bid
        if (sig.stop - entry) * sig.side >= 0 or (sig.target is not None and (sig.target - entry) * sig.side <= 0):
            return self._decide("refused", "prix déjà au-delà du stop ou de la target", sig)
        sz = size_position(self.spec, acc.equity, self.risk.risk_pct(), entry, sig.stop, free_margin=acc.free_margin,
                           spread=tick.spread if sig.side < 0 else 0.0, slippage=0.05)
        if not sz.ok:
            return self._decide("refused", sz.reason, sig)
        client_id = f"xs{last_ts}{int(round(member['tf'] * 60))}{'B' if sig.side > 0 else 'S'}"
        intent = {"client_id": client_id, "created": now, "side": sig.side, "volume": sz.volume, "sl": sig.stop,
                  "tp": sig.target, "max_until": now + sig.max_minutes * 60, "risk_money": sz.risk_money}
        self.state["intent"] = intent
        self.persist()                                # intention écrite AVANT l'envoi
        res = None
        for attempt in range(1 + self.cfg.order_retries):
            res = self.broker.market_order(sig.side, sz.volume, sig.stop, sig.target, client_id)
            if res.ok or not res.retryable or self.broker.was_executed(client_id, now):
                break
        self.risk.on_exec_result(res.ok)
        if res.ok:
            self.risk.on_open()
            pos = next((p for p in self.broker.positions() if p.comment == client_id[:31]), None)
            if pos:
                self.state["managed"][str(pos.ticket)] = {"max_until": intent["max_until"], "client_id": client_id,
                                                          "be": sig.be_at_r, "entry": pos.price_open,
                                                          "risk": abs(pos.price_open - sig.stop), "be_done": False}
            self.state["intent"] = None
            self.persist()
            self.alerts.send("TRADE", f"{'achat' if sig.side > 0 else 'vente'} {res.volume} lot @ {res.price:.2f} "
                                      f"SL {sig.stop:.2f} TP {sig.target or 0:.2f} (risque {sz.risk_money:.2f} {self.spec.account_currency})")
            return self._decide("order", "exécuté" + (" partiellement" if res.partial else ""), sig, volume=res.volume,
                                price=res.price, expected=entry, slippage=(res.price - entry) * sig.side)
        self.state["intent"] = None if not self.broker.was_executed(client_id, now) else intent
        self.persist()
        self.alerts.send("ERREUR", f"ordre refusé : {res.message} ({res.retcode})", key="order_err")
        return self._decide("order_failed", res.message, sig, retcode=res.retcode)

    def _decide(self, action: str, reason: str, sig=None, **extra) -> dict:
        d = {"action": action, "reason": reason, **extra}
        if sig is not None:
            d.update(side=sig.side, stop=sig.stop, target=sig.target, tag=sig.tag)
        self.journal.log("decision", **d)
        self.state["last_decision"] = d
        self.persist()
        return d

    # ------------------------------------------------------------------------
    def run_forever(self, max_errors: int = 20):
        errors = 0
        while True:
            try:
                self.step()
                errors = 0
            except KeyboardInterrupt:
                self.journal.log("stop", reason="clavier")
                break
            except Exception as e:  # erreur imprévue : on journalise, on alerte, on réessaie
                errors += 1
                self.journal.log("exception", error=repr(e))
                self.alerts.send("ERREUR", f"exception : {e!r}", key="exc")
                if errors >= max_errors:
                    self.risk.suspend(f"{errors} exceptions consécutives")
                    self.persist()
                    break
            time.sleep(self.cfg.poll_seconds)
