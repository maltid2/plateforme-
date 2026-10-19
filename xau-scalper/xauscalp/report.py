"""Rapport Markdown généré automatiquement à partir des résultats mesurés (research.json)."""
from __future__ import annotations


def _n(x, d=3, sign=True):
    if x is None:
        return "–"
    if isinstance(x, float) and x == float("inf"):
        return "∞"
    return f"{x:+.{d}f}" if sign else f"{x:.{d}f}"


def _s(s: dict) -> str:
    if not s or not s.get("n"):
        return "0 trade | – | – | – | – | –"
    return (f"{s['n']} | {s['win_rate']:.0%} | {_n(s['exp_r'])} | {_n(s['exp_r_gross'])} | "
            f"{_n(s['pf'], 2, False)} | {_n(s['max_dd_r'], 1, False)}")


def write_markdown(R: dict, path: str) -> None:
    lab = R.get("labels", {"dev": "Développement", "val": "Validation"})
    L = [f"# Résultats mesurés — étude {R.get('study', 'A')} — généré le {R['generated']}", "",
         "Fichier produit par `python -m xauscalp research`. Aucune valeur n'est saisie à la main.",
         "R = risque initial (entrée → stop, spread d'entrée inclus). E = espérance par trade.", ""]
    L += ["## Données", "", "| Fichier | Bougies | Début | Fin | Doublons | OHLC incohérents | Trous | Pics |", "|---|---|---|---|---|---|---|---|"]
    for f, d in R["data"].items():
        L.append(f"| {f} | {d['rows']} | {d['first']} | {d['last']} | {d['duplicates']} | {d['bad_ohlc']} | {d['gaps']} | {d['spikes']} |")
    L += ["", "## Coûts face au mouvement (spread moyen en $, ATR médian Londres + chevauchement)", "",
          "| Année | Spread Asie | Londres | Chevauchement | NY après-midi | ATR M1 | ATR M5 | ATR M15 |", "|---|---|---|---|---|---|---|---|"]
    for y, r in R.get("cost_profile", {}).items():
        g = lambda k: _n(r.get(k), 3, False)
        L.append(f"| {y} | {g('spread_asia')} | {g('spread_london')} | {g('spread_overlap')} | {g('spread_ny_pm')} | {g('atr_m1')} | {g('atr_m5')} | {g('atr_m15')} |")
    L += ["", f"## Criblage sur le développement ({lab['dev']}, coûts base) — 25 meilleures unités (n ≥ 100)", "",
          "| Stratégie | TF | Session | Trades | E brut (zéro frais) | E net | PF | t | DD R | coût R/trade | stop médian $ |",
          "|---|---|---|---|---|---|---|---|---|---|---|"]
    rows = sorted([r for r in R["screen"] if r["n"] >= 100], key=lambda r: r["exp_r"], reverse=True)
    for r in rows[:25]:
        L.append(f"| {r['strategy']} | M{r['tf']} | {r['session']} | {r['n']} | {_n(r['exp_r_zero'])} | {_n(r['exp_r'])} | "
                 f"{_n(r['pf'], 2, False)} | {_n(r['t_stat'], 2)} | {_n(r['max_dd_r'], 1, False)} | {_n(r['cost_r'])} | {_n(r['median_risk_usd'], 2, False)} |")
    pos = sum(1 for r in R["screen"] if r["n"] >= 100 and r["exp_r"] > 0)
    posz = sum(1 for r in R["screen"] if r["n"] >= 100 and r["exp_r_zero"] > 0)
    tot = sum(1 for r in R["screen"] if r["n"] >= 100)
    L += ["", f"Unités avec ≥ 100 trades : **{tot}** ; positives AVANT frais : **{posz}** ; positives APRÈS frais (base) : **{pos}**.", ""]
    by_tf = {}
    for r in R["screen"]:
        if r["n"] >= 100:
            by_tf.setdefault(r["tf"], []).append(r)
    L += ["| TF | Unités | E brut médiane | E net médiane | coût médian R/trade |", "|---|---|---|---|---|"]
    for tf, rs in sorted(by_tf.items()):
        med = lambda k: sorted(x[k] for x in rs)[len(rs) // 2]
        L.append(f"| M{tf} | {len(rs)} | {_n(med('exp_r_zero'))} | {_n(med('exp_r'))} | {_n(med('cost_r'))} |")
    L += ["", "## Les 3 unités sélectionnées (règle fixée : meilleure E nette sur le développement, une par stratégie)", ""]
    for ev in R.get("evaluations", []):
        u = ev["unit"]
        L += [f"### {u['strategy']} — M{u['tf']} — session {u['session']}", "",
              "| Période / coûts | Trades | Gagnants | E net | E brut | PF | DD (R) |", "|---|---|---|---|---|---|---|"]
        for key, name in (("dev_zero", f"{lab['dev']}, zéro frais"), ("dev_base", f"{lab['dev']}, base"),
                          ("val_zero", f"**{lab['val']}, zéro frais**"), ("val_base", f"**{lab['val']}, base**"),
                          ("val_stress", f"{lab['val']}, stress"), ("holdout_base", f"Hold-out 2025-26 ({ev.get('holdout_market', '–')}), base"),
                          ("holdout_stress", "Hold-out 2025-26, stress")):
            if key in ev:
                L.append(f"| {name} | {_s(ev[key])} |")
        wf = ev["wf"]
        mc = ev.get("val_mc", {})
        L += ["", f"- Walk-forward (6 mois / 3 mois) : {_s(wf).split(' | ')[0]} trades, E net {_n(wf.get('exp_r'))}, "
                  f"fenêtres positives {ev['wf_positive_share']:.0%} ({len(ev['wf_windows'])} fenêtres).",
              f"- Grille de robustesse (développement) : {ev['grid_positive_share']:.0%} des {len(ev['grid'])} variantes positives.",
              f"- Monte-Carlo (validation) : P(total > 0) = {mc.get('p_positive', 0):.0%}, drawdown 95e centile {_n(mc.get('dd_p95'), 1, False)} R.",
              f"- Sans les 5 meilleurs trades (validation) : {_n(ev['val_base'].get('total_r_without_top5'), 1)} R.",
              f"- Par régime (validation) : " + ", ".join(f"{k} {v['n']} tr. E {_n(v['exp_r'], 2)}" for k, v in ev.get("val_by_regime", {}).items()),
              f"- Par sens (validation) : " + ", ".join(f"{k} {v['n']} tr. E {_n(v['exp_r'], 2)}" for k, v in ev.get("val_by_side", {}).items()),
              "", "Faisabilité avec 100 € (risque 0,25 % = 0,25 €), spécifications d'EXEMPLE :", "",
              "| Période / compte | Stop max au lot min ($) | Marge lot min (€) | Signaux exécutables | Trades pris | Refus | Capital final (€) |",
              "|---|---|---|---|---|---|---|"]
        for k, f in ev.get("feasibility", {}).items():
            ref = ", ".join(f"{a}: {b}" for a, b in f["account_refused"].items()) or "–"
            fin = f["account_final_eur"]
            L.append(f"| {k} | {f['max_stop_usd_at_min_lot']:.2f} | {f['margin_min_lot']:.2f} | {f['share_signals_sizeable']:.0%} | "
                     f"{f['account_trades']} | {ref} | {fin:.2f} |")
        L += ["", "Critères pré-enregistrés (docs/CRITERES.md) :", ""]
        for k, v in ev["criteria"].items():
            L.append(f"- {'➖ non applicable' if v is None else ('✅' if v else '❌')} {k}")
        L.append("")
    if "regime_engine" in R:
        L += ["## Moteur adaptatif (tendance → pullback, range → Bollinger, volatil/désordonné → rien)", "",
              "| TF | Période | Trades | Gagnants | E net | E brut | PF | DD |", "|---|---|---|---|---|---|---|---|"]
        for tf, d in R["regime_engine"].items():
            for p, s in d.items():
                L.append(f"| {tf} | {p} | {_s(s)} |")
        L.append("")
    ml = R.get("ml", {})
    if ml.get("val_all"):
        L += ["## Méta-filtre statistique (régression logistique)", "",
              f"Appris sur le développement de {ml['unit']['strategy']} M{ml['unit']['tf']} {ml['unit']['session']}, "
              "seuil = médiane des probabilités sur le développement, appliqué une fois à la validation.", "",
              "| Validation | Trades | Gagnants | E net | E brut | PF | DD |", "|---|---|---|---|---|---|---|",
              f"| tous les signaux | {_s(ml['val_all'])} |", f"| signaux filtrés | {_s(ml['val_filtered'])} |", ""]
    cand = [e for e in R.get("evaluations", []) if e["criteria"]["candidate"]]
    L += ["## Verdict automatique", "",
          (f"**{len(cand)} unité(s) remplissent les 9 critères.**" if cand else
           "**Aucune unité ne remplit les 9 critères pré-enregistrés : pas de passage en démo ni en réel.**"), ""]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(L))
