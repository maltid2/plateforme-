# Installation et lancement en démo (MetaTrader 5)

Le paquet Python officiel `MetaTrader5` ne fonctionne que sous **Windows**, avec le terminal MT5 installé et ouvert.
Le reste (recherche, backtest, paper, tests) fonctionne partout avec Python ≥ 3.10, **sans aucune dépendance**.

## 1. Préparer
1. Installer Python 3.11 (python.org, cocher « Add to PATH ») et MetaTrader 5 (fourni par le courtier).
2. Ouvrir un **compte démo** chez un courtier autorisé en France (vérifier sur REGAFI / AMF).
   Choisir un solde démo égal au capital réel envisagé : avec 100 € sur un contrat standard, le bot refusera tous les
   ordres (c'est normal, voir docs/FAISABILITE.md). Pour tester l'exécution elle-même, prendre un solde démo plus élevé
   (par exemple 3 000 €) et le noter dans le journal de test.
3. Dans MT5 : Outils → Options → Expert Advisors → cocher « Autoriser le trading algorithmique ».
4. `pip install MetaTrader5` puis, dans le dossier du projet : `python -m unittest discover -s tests -t .` (tout doit passer).

## 2. Spécification réelle du symbole
```bat
python -m xauscalp spec --symbol XAUUSD --server-tz paris+1 --commission 0 --out symbol_spec.json
python -m xauscalp feasibility --spec symbol_spec.json --equity 100 --risk 0.25 --stops 3,6,9,14
```
`--server-tz` : décalage de l'heure du serveur (souvent `paris+1` ; à vérifier en comparant l'heure du « Market Watch »
à l'heure UTC). `--commission` : commission aller-retour par lot du compte (0 sur un compte standard).

## 3. Calendrier économique
Compiler `mql5/ExportCalendar.mq5` dans MetaEditor (non compilé ici), le lancer chaque jour sur un graphique : il écrit
`xauscalp_calendar.csv` dans `Terminal\Common\Files`. Renseigner ce chemin dans `news_csv` de la configuration.
Sans fichier, le calendrier intégré (approximatif, 2025-2026) est utilisé.

## 4. Configuration
Copier `config.example.json` en `config.json`, puis renseigner `mt5_login` et `mt5_server` (et `mt5_path` si plusieurs
terminaux sont installés). Le mot de passe est lu dans la variable d'environnement `XAUSCALP_MT5_PASSWORD`, jamais dans
le fichier. Laisser `"live_enabled": false`.

## 5. Lancer
```bat
set XAUSCALP_MT5_PASSWORD=...
python -m xauscalp run --config config.json --mode demo
python -m xauscalp dashboard --state-dir state --mode demo      (dans une 2e fenêtre)
```
- Le démarrage est **refusé** si le compte connecté n'est pas un compte démo.
- Alertes Telegram (facultatif) : variables `XAUSCALP_TG_TOKEN` et `XAUSCALP_TG_CHAT`.
- Arrêt d'urgence : créer un fichier `state\STOP` (positions fermées, plus aucune entrée), ou
  `curl -X POST -H "X-Token: %XAUSCALP_DASH_TOKEN%" http://127.0.0.1:8765/api/stop`.
- Tout est journalisé dans `state\journal.jsonl` (une ligne JSON par décision, ordre, fermeture ou erreur) ;
  l'état (risque, dernière bougie traitée, intention d'ordre) est dans `state\state.json`.

## 6. Avant la démo : rejeu sur historique
```bat
python -m xauscalp paper export_M5.csv --server-tz paris+1 --config config.json --spec symbol_spec.json --equity 100
python -m xauscalp backtest export_M5.csv --server-tz paris+1 --tf 15 --strategy donchian_breakout --sessions asia --journal bt.csv
```
Le rejeu fait passer l'historique par le moteur complet ; comparer ses trades au journal du backtest.

## 7. Pendant la démo (au moins 4 semaines)
Suivre la grille de docs/VALIDATION.md, section C : correspondance signaux / ordres, slippage réel (champ `slippage` des
décisions `order`), redémarrage avec position ouverte, déconnexion, spread excessif, limites de perte, arrêt d'urgence.

## Comportement après un redémarrage
- Les positions du courtier font foi : celles portant le numéro magique du bot sont reprises et gérées (durée maximale,
  sortie avant annonce et week-end, stop obligatoire).
- Une intention d'ordre écrite avant un crash est vérifiée (position ou deal portant son identifiant). Si l'ordre n'a pas
  été exécuté, elle est abandonnée et **jamais renvoyée**.
- Une même bougie n'est évaluée qu'une fois, même après un redémarrage.
