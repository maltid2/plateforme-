"""Backtest événementiel sur bougies (bid), avec spread variable, commission, slippage, latence et rejets.

Hypothèses (prudentes, documentées dans docs/PROTOCOLE.md) :
- signal à la clôture de la bougie k ; exécution à l'OUVERTURE de la bougie k+1+latence ;
- achat à l'ask (bid + spread), vente au bid ; un achat sort au bid, une vente sort à l'ask ;
- stop d'une vente déclenché par l'ask (ask_high si disponible, sinon high + spread) ;
- gap au-delà du stop : sortie au prix d'ouverture (pire), plus le slippage de stop ;
- stop et target touchés dans la même bougie : le STOP est retenu ;
- target = ordre limite (pas de slippage), stop et sorties forcées = ordres au marché (slippage) ;
- précision limitée à la bougie : l'ordre réel des mouvements à l'intérieur d'une bougie est inconnu.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import random

from .market import Market
from .news import NewsCalendar
from .risk import RiskManager, RiskLimits
from .sizing import size_position
from .symbol import SymbolSpec
from .strategies.base import Strategy


@dataclass
class CostModel:
    spread_mult: float = 1.0
    spread_floor: float = 0.0           # $ : spread minimum appliqué
    spread_add: float = 0.0             # $ ajoutés au spread
    commission_per_oz_rt: float = 0.0   # $ par once, aller-retour (ex. 7 $/lot de 100 oz = 0,07)
    slip_entry: float = 0.0             # $ par once, défavorable
    slip_stop: float = 0.0
    slip_exit: float = 0.0              # sorties au marché (temps, news, week-end)
    latency_bars: int = 0
    reject_prob: float = 0.0
    seed: int = 7
    label: str = "custom"

    def spread(self, m: Market, k: int) -> float:
        return max(self.spread_floor, m.spread(k) * self.spread_mult + self.spread_add)


def cost_scenarios() -> dict[str, CostModel]:
    """Scénarios fixés AVANT les tests (docs/CRITERES.md)."""
    return {
        "zero": CostModel(label="zéro frais (référence)", spread_mult=0.0),
        "base": CostModel(label="base", spread_floor=0.20, commission_per_oz_rt=0.05, slip_entry=0.03, slip_stop=0.05,
                          slip_exit=0.03),
        "stress": CostModel(label="stress", spread_mult=1.5, spread_floor=0.30, commission_per_oz_rt=0.07,
                            slip_entry=0.10, slip_stop=0.20, slip_exit=0.10, latency_bars=0, reject_prob=0.03),
    }


@dataclass
class ExecRules:
    sessions: tuple = ("london", "overlap")
    news: NewsCalendar | None = None
    news_before_min: int = 30
    news_after_min: int = 30
    flatten_before_news_min: int = 5    # positions ouvertes fermées 5 min avant une annonce majeure
    max_spread: float = 0.60            # pas d'entrée au-delà (en $)
    max_atr_ratio: float = 3.0          # volatilité anormale -> pas d'entrée
    one_trade_per_bar: bool = True


@dataclass
class Trade:
    strategy: str
    side: int
    signal_ts: int
    entry_ts: int
    entry: float
    stop: float
    target: float | None
    exit_ts: int = 0
    exit: float = 0.0
    reason: str = ""
    risk_dist: float = 0.0     # |entrée - stop| par once (spread d'entrée inclus)
    pnl: float = 0.0           # $ par once, net de spread/slippage/commission
    cost: float = 0.0          # $ par once : spread + slippage + commission
    session: str = ""
    regime: str = ""
    tag: str = ""
    volume: float = 0.0
    money: float = 0.0         # résultat en devise du compte (mode compte)
    features: dict = field(default_factory=dict)

    @property
    def r(self) -> float:
        return self.pnl / self.risk_dist if self.risk_dist > 0 else 0.0

    @property
    def r_gross(self) -> float:
        return (self.pnl + self.cost) / self.risk_dist if self.risk_dist > 0 else 0.0


@dataclass
class Account:
    spec: SymbolSpec
    equity: float = 100.0
    limits: RiskLimits = field(default_factory=RiskLimits)
    usd_per_account_ccy: float = 1.16    # EURUSD (approximation constante pour la commission)
    max_margin_usage: float = 0.5


@dataclass
class Result:
    trades: list
    refused: dict
    signals: int
    rejected: int
    final_equity: float | None = None
    equity_curve: list = field(default_factory=list)


def run(m: Market, strat: Strategy, cost: CostModel, rules: ExecRules, *, start_ts: int | None = None,
        end_ts: int | None = None, account: Account | None = None, feature_fn=None) -> Result:
    b, n = m.b, m.n
    rng = random.Random(cost.seed)
    atr = m.get("atr", 14)
    atr_ratio = m.get("atr_ratio", m.bars_for(5 * 1440))
    trades: list[Trade] = []
    refused: dict[str, int] = {}
    signals = rejected = 0
    pos: Trade | None = None
    pend = None   # (exec_index, signal, signal_index)
    held = 0
    risk = RiskManager(account.limits) if account else None
    equity = account.equity if account else None
    curve = []

    def refuse(reason: str):
        key = reason.split(" =")[0].split(" (")[0]
        refused[key] = refused.get(key, 0) + 1

    def close(k: int, price: float, reason: str, extra_cost: float):
        nonlocal pos, equity
        p = pos
        sp_exit = cost.spread(m, k) if p.side < 0 else 0.0
        p.exit_ts, p.exit, p.reason = b.t[k], price, reason
        p.pnl = (price - p.entry) * p.side - cost.commission_per_oz_rt
        p.cost += extra_cost + cost.commission_per_oz_rt + sp_exit
        if account:
            spec = account.spec
            gross = (price - p.entry) * p.side
            money = gross / spec.tick_size * spec.tick_value_loss * p.volume  # approximation : même valeur de tick
            money -= spec.commission_per_lot_rt * p.volume
            p.money = money
            equity += money
            risk.on_equity(str(m.day[k]), equity)
            curve.append((b.t[k], equity))
        trades.append(p)
        pos = None

    for k in range(1, n):
        t = b.t[k]
        if end_ts is not None and t >= end_ts and pos is None and pend is None:
            break
        if account:
            risk.on_equity(str(m.day[k]), equity)

        # 1) exécution d'un ordre en attente à l'ouverture
        if pend and pend[0] == k:
            _, sig, ks = pend
            pend = None
            sp = cost.spread(m, k)
            if cost.reject_prob and rng.random() < cost.reject_prob:
                rejected += 1
            else:
                if sig.side > 0:
                    entry = b.o[k] + sp + cost.slip_entry
                    entry_cost = sp + cost.slip_entry
                    rd = entry - sig.stop
                    valid = rd > 0 and (sig.target is None or sig.target > entry)
                else:
                    entry = b.o[k] - cost.slip_entry
                    entry_cost = cost.slip_entry
                    rd = sig.stop - entry
                    valid = rd > 0 and (sig.target is None or sig.target < entry)
                if not valid:
                    refuse("niveaux invalides à l'exécution")
                else:
                    vol = 0.0
                    ok = True
                    if account:
                        sr = size_position(account.spec, equity, risk.risk_pct(), entry, sig.stop,
                                           free_margin=equity, max_margin_usage=account.max_margin_usage,
                                           spread=sp if sig.side < 0 else 0.0, slippage=cost.slip_stop)
                        ok, vol = sr.ok, sr.volume
                        if not ok:
                            refuse(sr.reason)
                    if ok:
                        pos = Trade(strat.name, sig.side, b.t[ks], t, entry, sig.stop, sig.target, risk_dist=rd,
                                    cost=entry_cost, session=m.clock.session_of(b.t[ks]) or "", regime=m.regime(ks),
                                    tag=sig.tag, volume=vol,
                                    features=feature_fn(m, ks, sig.side) if feature_fn else {})
                        pos._max_k = k + max(1, round(sig.max_minutes / m.tf)) - 1
                        if account:
                            risk.on_open()

        # 2) gestion de la position sur la bougie k
        if pos:
            sp = cost.spread(m, k)
            if m.clock.weekend_flatten(t) or (rules.news and rules.news.blocked(t, rules.flatten_before_news_min, 0)):
                if pos.side > 0:
                    close(k, b.o[k] - cost.slip_exit, "sortie forcée (news/week-end)", cost.slip_exit)
                else:
                    close(k, b.o[k] + sp + cost.slip_exit, "sortie forcée (news/week-end)", cost.slip_exit)
            elif pos.side > 0:
                if b.l[k] <= pos.stop:
                    px = min(pos.stop, b.o[k]) - cost.slip_stop
                    close(k, px, "stop", cost.slip_stop)
                elif pos.target is not None and b.h[k] >= pos.target:
                    close(k, pos.target, "target", 0.0)
                elif k >= pos._max_k:
                    close(k, b.c[k] - cost.slip_exit, "temps", cost.slip_exit)
            else:
                # ask reconstruit : extrêmes ask réels si disponibles, décalés du surcoût du scénario
                extra = sp - m.spread(k)
                ask_o = b.o[k] + sp
                ask_h = m.ask_high(k) + extra
                ask_l = m.ask_low(k) + extra
                if ask_h >= pos.stop:
                    px = max(pos.stop, ask_o) + cost.slip_stop
                    close(k, px, "stop", cost.slip_stop)
                elif pos.target is not None and ask_l <= pos.target:
                    close(k, pos.target, "target", 0.0)
                elif k >= pos._max_k:
                    close(k, b.c[k] + sp + cost.slip_exit, "temps", cost.slip_exit)

        # 3) nouveau signal à la clôture de k
        if pos or pend or k + 1 + cost.latency_bars >= n:
            continue
        nxt = b.t[k + 1 + cost.latency_bars]
        if start_ts is not None and nxt < start_ts:
            continue
        if end_ts is not None and nxt >= end_ts:
            continue
        if not any(m.clock.in_session(nxt, s) for s in rules.sessions):
            continue
        if m.clock.friday_cutoff(nxt) or m.clock.rollover(nxt):
            continue
        sig = strat.signal(m, k)
        if sig is None:
            continue
        signals += 1
        if rules.news and rules.news.blocked(nxt, rules.news_before_min, rules.news_after_min):
            refuse("annonce économique")
            continue
        if cost.spread(m, k) > rules.max_spread:
            refuse("spread trop large")
            continue
        ar = atr_ratio[k]
        if ar == ar and ar > rules.max_atr_ratio:
            refuse("volatilité anormale")
            continue
        if account:
            ok, why = risk.can_open(equity=equity, open_positions=0, spread=cost.spread(m, k), workdir="/nonexistent")
            if not ok:
                refuse(why)
                continue
        pend = (k + 1 + cost.latency_bars, sig, k)

    if pos:
        close(n - 1, b.c[n - 1], "fin des données", 0.0)
    return Result(trades, refused, signals, rejected, equity, curve)
