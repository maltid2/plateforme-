"""Ligne de commande : python -m xauscalp <commande> ..."""
from __future__ import annotations

import argparse
import json
import os
import sys


def cmd_research(a):
    from .research import Research
    Research(a.ticks or [], a.holdout_m5, a.holdout_m1, a.out, study=a.study).run_all()


def cmd_fusion(a):
    from .fusion import Fusion
    Fusion(a.ticks, a.mt5_m5, a.m1, a.out).run_all()


def cmd_scalp(a):
    from .scalp import study
    study(a.s10, a.m1_ticks, a.m1_2026, a.mt5_m5, a.out)


def cmd_volume(a):
    from .volume import study
    study(a.ticks, a.mt5_m5, a.study_b, a.out, a.max_positions)


def cmd_validate(a):
    from .data import load_csv, validate
    b = load_csv(a.csv, server_tz=a.server_tz)
    r = validate(b)
    print(json.dumps(r.__dict__, indent=1, ensure_ascii=False))
    print("OK" if r.ok else "PROBLÈMES : nettoyer avant usage (data.clean)")


def cmd_feasibility(a):
    from .feasibility import feasibility
    from .symbol import SymbolSpec, example_presets
    specs = {}
    if a.spec:
        with open(a.spec, encoding="utf-8") as f:
            s = SymbolSpec.from_json(f.read())
        specs[s.name] = s
    else:
        specs = example_presets(gold_price=a.price, eurusd=a.eurusd)
        print("ATTENTION : spécifications d'EXEMPLE. Exportez la vraie spec du courtier (python -m xauscalp spec).")
    stops = [float(x) for x in a.stops.split(",")]
    for name, s in specs.items():
        f = feasibility(s, equity=a.equity, risk_pct=a.risk, price=a.price, stop_distances=stops)
        print(f"\n== {name} ({s.notes or s.source})")
        for k in ("risk_allowed", "loss_per_usd_at_min_lot", "max_stop_usd_at_min_lot", "margin_min_lot", "margin_ok",
                  "share_signals_sizeable", "equity_needed_for_median_stop"):
            v = f[k]
            print(f"  {k:32s} {v:.2f}" if isinstance(v, float) else f"  {k:32s} {v}")


def cmd_backtest(a):
    from .backtest import run, cost_scenarios, ExecRules, Account
    from .data import load_csv, clean, resample
    from .market import Market
    from .metrics import summarize, fmt, bootstrap
    from .news import NewsCalendar
    from .strategies import make, TrendFilter
    from .symbol import example_presets
    b = clean(load_csv(a.csv, server_tz=a.server_tz))
    if a.tf and a.tf != b.tf:
        b = resample(b, a.tf)
    m = Market(b)
    st = make(a.strategy, **json.loads(a.params))
    st = TrendFilter(st) if a.h1 else st
    rules = ExecRules(sessions=tuple(a.sessions.split(",")), news=NewsCalendar.builtin())
    for c in a.costs.split(","):
        res = run(m, st, cost_scenarios()[c], rules)
        s = summarize(res.trades)
        print(f"[{c}] {fmt(s)}")
        if c == "base":
            print("   Monte-Carlo :", bootstrap(res.trades))
            print("   refus :", res.refused)
    if a.account:
        spec = example_presets(gold_price=b.c[-1])[a.account]
        res = run(m, st, cost_scenarios()["base"], rules, account=Account(spec=spec, equity=a.equity))
        print(f"[compte {a.account}, {a.equity} €] trades {len(res.trades)}, final {res.final_equity:.2f}, refus {res.refused}")
    if a.journal:
        with open(a.journal, "w") as f:
            f.write("entree_utc,sens,prix,stop,target,sortie_utc,prix_sortie,raison,R,R_brut,cout_usd_oz,session,regime\n")
            for t in run(m, st, cost_scenarios()["base"], rules).trades:
                f.write(f"{t.entry_ts},{t.side},{t.entry:.2f},{t.stop:.2f},{t.target or 0:.2f},{t.exit_ts},{t.exit:.2f},"
                        f"{t.reason},{t.r:.3f},{t.r_gross:.3f},{t.cost:.3f},{t.session},{t.regime}\n")


def _engine(a):
    from .config import EngineConfig
    from .engine import Engine
    from .news import NewsCalendar
    cfg = EngineConfig.load(a.config) if a.config else EngineConfig()
    if a.mode:
        cfg.mode = a.mode
    news = NewsCalendar.from_csv(cfg.news_csv) if cfg.news_csv and os.path.exists(cfg.news_csv) else NewsCalendar.builtin()
    return cfg, news, Engine


def cmd_paper(a):
    """Rejeu d'un historique à travers le MOTEUR complet (mêmes décisions qu'en démo)."""
    from .broker.paper import ReplayBroker
    from .data import load_csv, clean, resample
    from .symbol import SymbolSpec, example_presets
    cfg, news, Engine = _engine(a)
    cfg.mode = "paper"
    b = clean(load_csv(a.csv, server_tz=a.server_tz))
    if b.tf != cfg.tf:
        b = resample(b, cfg.tf)
    if a.spec:
        with open(a.spec, encoding="utf-8") as f:
            spec = SymbolSpec.from_json(f.read())
    else:
        spec = example_presets(gold_price=b.c[-1])[a.account]
    br = ReplayBroker(b, spec, equity=a.equity, start_index=cfg.history_bars)
    eng = Engine(br, cfg, news=news)
    eng.start()
    steps = 0
    while br.advance():
        eng.step()
        steps += 1
        if a.max_steps and steps >= a.max_steps:
            break
    print(f"rejeu terminé : {steps} bougies, {len(br.closed)} trades, solde {br.balance:.2f} {spec.account_currency}")
    print(f"journal : {os.path.join(cfg.state_dir, 'journal.jsonl')}")


def cmd_run(a):
    """Démo (ou réel verrouillé) sur MetaTrader 5."""
    from .broker.mt5 import MT5Broker
    cfg, news, Engine = _engine(a)
    if cfg.mode == "paper":
        sys.exit("run : utiliser --mode demo (le paper trading se fait avec la commande paper)")
    br = MT5Broker(cfg.symbol, magic=cfg.magic, deviation_points=cfg.deviation_points, server_tz=cfg.server_tz,
                   commission_per_lot_rt=cfg.commission_per_lot_rt, login=cfg.mt5_login,
                   password=os.environ.get("XAUSCALP_MT5_PASSWORD"), server=cfg.mt5_server, terminal_path=cfg.mt5_path)
    eng = Engine(br, cfg, news=news)
    if not eng.start():
        sys.exit(f"démarrage refusé : {eng.stopped_reason or 'voir le journal'}")
    eng.run_forever()


def cmd_spec(a):
    """Exporte la spécification réelle du symbole depuis MT5 (JSON)."""
    from .broker.mt5 import MT5Broker
    br = MT5Broker(a.symbol, server_tz=a.server_tz, commission_per_lot_rt=a.commission)
    if not br.connect():
        sys.exit("connexion MT5 impossible (terminal ouvert et connecté ?)")
    s = br.symbol_spec()
    with open(a.out, "w", encoding="utf-8") as f:
        f.write(s.to_json())
    print(s.to_json())


def cmd_dashboard(a):
    from .dashboard import serve
    serve(a.state_dir, a.mode, a.port)


def build() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="xauscalp", description="Recherche et exécution prudente XAU/USD (mode réel désactivé par défaut)")
    sub = p.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("research", help="protocole complet de recherche (rapport mesuré)")
    r.add_argument("--ticks", nargs="+", help="bougies M1 bid/ask (scripts/ticks2m1.py), étude A")
    r.add_argument("--study", choices=["A", "B"], default="A")
    r.add_argument("--holdout-m5", default=None)
    r.add_argument("--holdout-m1", default=None)
    r.add_argument("--out", default="reports")
    r.set_defaults(fn=cmd_research)

    fu = sub.add_parser("fusion", help="étude C : fusion des deux anciens robots et du nouveau")
    fu.add_argument("--ticks", nargs="+", required=True); fu.add_argument("--mt5-m5", required=True)
    fu.add_argument("--m1", default=None); fu.add_argument("--out", default="reports/etude_C_fusion")
    fu.set_defaults(fn=cmd_fusion)

    sc = sub.add_parser("scalp", help="étude D : scalp agressif multi-positions (secondes / minutes)")
    sc.add_argument("--s10", required=True, help="bougies de 10 s (scripts/ticks2sec.py)")
    sc.add_argument("--m1-ticks", nargs="+", required=True); sc.add_argument("--m1-2026", required=True)
    sc.add_argument("--mt5-m5", required=True); sc.add_argument("--out", default="reports/etude_D_scalp")
    sc.set_defaults(fn=cmd_scalp)

    vo = sub.add_parser("volume", help="étude E : beaucoup de positions en parallèle")
    vo.add_argument("--ticks", nargs="+", required=True); vo.add_argument("--mt5-m5", required=True)
    vo.add_argument("--study-b", default="reports/etude_B/research.json"); vo.add_argument("--max-positions", type=int, default=5)
    vo.add_argument("--out", default="reports/etude_E_volume")
    vo.set_defaults(fn=cmd_volume)

    v = sub.add_parser("validate", help="contrôle qualité d'un fichier de bougies")
    v.add_argument("csv"); v.add_argument("--server-tz", default="UTC")
    v.set_defaults(fn=cmd_validate)

    f = sub.add_parser("feasibility", help="le capital permet-il de respecter le risque ?")
    f.add_argument("--spec", help="spec JSON réelle (commande spec)")
    f.add_argument("--equity", type=float, default=100.0)
    f.add_argument("--risk", type=float, default=0.25)
    f.add_argument("--price", type=float, default=4300.0)
    f.add_argument("--eurusd", type=float, default=1.16)
    f.add_argument("--stops", default="1,2,3,5,8", help="distances de stop typiques en $ (séparées par des virgules)")
    f.set_defaults(fn=cmd_feasibility)

    b = sub.add_parser("backtest", help="backtest d'une stratégie")
    b.add_argument("csv"); b.add_argument("--strategy", required=True); b.add_argument("--params", default="{}")
    b.add_argument("--h1", action="store_true", help="filtre de tendance H1")
    b.add_argument("--tf", type=int, default=0); b.add_argument("--server-tz", default="UTC")
    b.add_argument("--sessions", default="london,overlap"); b.add_argument("--costs", default="zero,base,stress")
    b.add_argument("--account", choices=["eu_retail", "eu_retail_micro", "cent"]); b.add_argument("--equity", type=float, default=100.0)
    b.add_argument("--journal")
    b.set_defaults(fn=cmd_backtest)

    pp = sub.add_parser("paper", help="rejeu d'un historique à travers le moteur complet")
    pp.add_argument("csv"); pp.add_argument("--config"); pp.add_argument("--server-tz", default="UTC")
    pp.add_argument("--spec"); pp.add_argument("--account", default="cent", choices=["eu_retail", "eu_retail_micro", "cent"])
    pp.add_argument("--equity", type=float, default=100.0); pp.add_argument("--max-steps", type=int, default=0)
    pp.add_argument("--mode", default=None)
    pp.set_defaults(fn=cmd_paper)

    rr = sub.add_parser("run", help="exécution sur MT5 (démo ; réel verrouillé)")
    rr.add_argument("--config"); rr.add_argument("--mode", choices=["demo", "live"], default="demo")
    rr.set_defaults(fn=cmd_run)

    s = sub.add_parser("spec", help="exporter la spécification du symbole depuis MT5")
    s.add_argument("--symbol", default="XAUUSD"); s.add_argument("--server-tz", default="paris+1")
    s.add_argument("--commission", type=float, default=0.0, help="commission aller-retour par lot (devise du compte)")
    s.add_argument("--out", default="symbol_spec.json")
    s.set_defaults(fn=cmd_spec)

    d = sub.add_parser("dashboard", help="tableau de bord local")
    d.add_argument("--state-dir", default="state"); d.add_argument("--mode", default="paper"); d.add_argument("--port", type=int, default=8765)
    d.set_defaults(fn=cmd_dashboard)
    return p


def main(argv=None):
    a = build().parse_args(argv)
    a.fn(a)
