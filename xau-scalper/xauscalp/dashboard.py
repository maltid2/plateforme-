"""Tableau de bord local (127.0.0.1) : état, dernières décisions, arrêt d'urgence.

GET  /            page HTML (rafraîchie toutes les 10 s)
GET  /api/state   état JSON + 50 dernières lignes du journal
POST /api/stop    crée le fichier STOP (arrêt d'urgence) ; en-tête X-Token = XAUSCALP_DASH_TOKEN exigé
"""
from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import html
import json
import os

from .journal import Journal, load_state

PAGE = """<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="10"><title>xauscalp</title>
<style>body{{font:14px system-ui,sans-serif;margin:16px;background:#0f1115;color:#e6e6e6}}table{{border-collapse:collapse;width:100%}}
td,th{{border-bottom:1px solid #333;padding:4px 6px;text-align:left;vertical-align:top}}.bad{{color:#ff7b72}}.ok{{color:#7ee787}}
code{{white-space:pre-wrap}}</style></head><body>
<h1>xauscalp — {mode}</h1>
<p>Statut : <b class="{cls}">{status}</b> · STOP présent : {stop} · dernière bougie traitée : {last_bar}</p>
<h2>Risque</h2><code>{risk}</code>
<h2>Dernière décision</h2><code>{decision}</code>
<h2>Journal (50 dernières lignes)</h2><table><tr><th>heure (UTC)</th><th>type</th><th>détail</th></tr>{rows}</table>
<p>Arrêt d'urgence : <code>curl -X POST -H "X-Token: $XAUSCALP_DASH_TOKEN" http://127.0.0.1:{port}/api/stop</code>
ou créer un fichier STOP dans {dir}.</p></body></html>"""


def make_handler(state_dir: str, mode: str, port: int):
    journal = Journal(os.path.join(state_dir, "journal.jsonl"))

    class H(BaseHTTPRequestHandler):
        def _send(self, code, body, ctype="application/json"):
            data = body.encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", f"{ctype}; charset=utf-8")
            self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *a):
            pass

        def do_GET(self):
            st = load_state(os.path.join(state_dir, "state.json"))
            stop = os.path.exists(os.path.join(state_dir, "STOP"))
            if self.path == "/api/state":
                return self._send(200, json.dumps({"state": st, "stop": stop, "journal": journal.tail(50)}, default=str))
            if self.path != "/":
                return self._send(404, "{}")
            risk = st.get("risk", {})
            susp = risk.get("suspended")
            rows = "".join(
                f"<tr><td>{__import__('time').strftime('%Y-%m-%d %H:%M:%S', __import__('time').gmtime(r['ts']))}</td>"
                f"<td>{html.escape(r['kind'])}</td><td><code>{html.escape(json.dumps({k: v for k, v in r.items() if k not in ('ts', 'kind')}, ensure_ascii=False, default=str))}</code></td></tr>"
                for r in reversed(journal.tail(50)))
            page = PAGE.format(mode=html.escape(mode), cls="bad" if susp or stop else "ok",
                               status=html.escape("SUSPENDU : " + risk.get("suspend_reason", "")) if susp else ("ARRÊT D'URGENCE" if stop else "actif"),
                               stop="oui" if stop else "non", last_bar=st.get("last_bar_ts", "–"),
                               risk=html.escape(json.dumps(risk, ensure_ascii=False, indent=1)),
                               decision=html.escape(json.dumps(st.get("last_decision", {}), ensure_ascii=False, indent=1)),
                               rows=rows, port=port, dir=html.escape(state_dir))
            return self._send(200, page, "text/html")

        def do_POST(self):
            if self.path != "/api/stop":
                return self._send(404, "{}")
            token = os.environ.get("XAUSCALP_DASH_TOKEN")
            if not token or self.headers.get("X-Token") != token:
                return self._send(403, json.dumps({"error": "jeton manquant ou invalide"}))
            open(os.path.join(state_dir, "STOP"), "w").close()
            journal.log("kill_switch", source="dashboard")
            return self._send(200, json.dumps({"stop": True}))

    return H


def serve(state_dir: str = "state", mode: str = "paper", port: int = 8765):
    os.makedirs(state_dir, exist_ok=True)
    srv = ThreadingHTTPServer(("127.0.0.1", port), make_handler(state_dir, mode, port))
    print(f"Tableau de bord : http://127.0.0.1:{port}  (Ctrl+C pour arrêter)")
    srv.serve_forever()
