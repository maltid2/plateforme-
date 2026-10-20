"""Ticks (FX-Data, UTC, bid/ask x100) -> bougies de N secondes : OHLC bid, ask high/low, spread moyen."""
import csv, glob, os, sys
from datetime import datetime, timezone
src, out, sec = sys.argv[1], sys.argv[2], int(sys.argv[3])
files = sorted(glob.glob(os.path.join(src, '**', '*_ticks.csv'), recursive=True))
n = 0
with open(out, 'w', newline='') as fo:
    w = csv.writer(fo)
    w.writerow(['time_utc', 'open', 'high', 'low', 'close', 'ticks', 'spread_avg', 'spread_max', 'ask_high', 'ask_low'])
    cur = None
    def flush():
        global n
        if cur:
            k, o, h, l, c, t, ss, sm, ah, al = cur
            w.writerow([datetime.fromtimestamp(k, timezone.utc).strftime('%Y-%m-%d %H:%M:%S'), f'{o:.3f}', f'{h:.3f}', f'{l:.3f}', f'{c:.3f}', t, f'{ss / t:.3f}', f'{sm:.3f}', f'{ah:.3f}', f'{al:.3f}'])
            n += 1
    for fn in files:
        with open(fn) as f:
            for row in csv.reader(f):
                if len(row) < 3:
                    continue
                d = row[0]
                ts = int(datetime(int(d[0:4]), int(d[5:7]), int(d[8:10]), int(d[11:13]), int(d[14:16]), int(d[17:19]), tzinfo=timezone.utc).timestamp())
                key = ts - ts % sec
                b, a = float(row[1]) * 100, float(row[2]) * 100
                if a < b:
                    b, a = a, b
                s = a - b
                if cur and cur[0] == key:
                    cur[2] = max(cur[2], b); cur[3] = min(cur[3], b); cur[4] = b; cur[5] += 1
                    cur[6] += s; cur[7] = max(cur[7], s); cur[8] = max(cur[8], a); cur[9] = min(cur[9], a)
                else:
                    flush()
                    cur = [key, b, b, b, b, 1, s, s, a, a]
    flush()
print(out, n, 'bougies', len(files), 'fichiers')
