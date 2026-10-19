# Données (non versionnées : trop volumineuses)

## Ticks bid/ask 2015-2018 → bougies M1 (étude A)

```bash
git clone --depth 1 -b XAUUSD-2017 https://github.com/FX-Data/FX-Data-XAUUSD-DS y2017   # ~1,1 Go par année
python scripts/ticks2m1.py y2017/XAUUSD data/xau_m1_2017.csv
rm -rf y2017
```
Branches disponibles : XAUUSD-2011 à XAUUSD-2018 (2018 : janvier à juin). Prix stockés ×100 dans les fichiers
sources : le script les remet à l'échelle et calcule le spread, le plus haut et le plus bas de l'ask de chaque minute.

## Export MetaTrader 5 (étude B, hold-out)

Dans MT5 : Affichage → Symboles → XAUUSD → Barres → M5 → période → Exporter. Colonnes attendues :
`time,open,high,low,close,tick_volume,spread,real_volume` ; heure = heure du serveur (souvent Paris + 1 → `--server-tz paris+1`).

Toujours contrôler un fichier avant usage : `python -m xauscalp validate fichier.csv --server-tz paris+1`.
