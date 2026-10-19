"""Ticks Dukascopy (FX-Data CSV : heure UTC, bid, ask, x100) -> bougies M1 bid + ask high/low + spread."""
import csv, glob, os, sys
src, out, scale = sys.argv[1], sys.argv[2], 100.0
files = sorted(glob.glob(os.path.join(src, '**', '*_ticks.csv'), recursive=True))
n = 0
with open(out, 'w', newline='') as fo:
    w = csv.writer(fo)
    w.writerow(['time_utc', 'open', 'high', 'low', 'close', 'ticks', 'spread_avg', 'spread_max', 'ask_high', 'ask_low'])
    for fn in files:
        cur = None
        def flush():
            global n
            if cur:
                k, o, h, l, c, t, ss, sm, ah, al = cur
                w.writerow([k, f'{o:.3f}', f'{h:.3f}', f'{l:.3f}', f'{c:.3f}', t, f'{ss / t:.3f}', f'{sm:.3f}', f'{ah:.3f}', f'{al:.3f}'])
                n += 1
        with open(fn) as f:
            for row in csv.reader(f):
                if len(row) < 3:
                    continue
                key = row[0][:16].replace('.', '-')
                b, a = float(row[1]) * scale, float(row[2]) * scale
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
