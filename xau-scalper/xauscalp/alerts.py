"""Alertes : console + Telegram optionnel (variables XAUSCALP_TG_TOKEN et XAUSCALP_TG_CHAT)."""
from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request


class Alerts:
    def __init__(self, min_interval_s: float = 30.0, sender=None):
        self.token = os.environ.get("XAUSCALP_TG_TOKEN")
        self.chat = os.environ.get("XAUSCALP_TG_CHAT")
        self.min_interval = min_interval_s
        self._last: dict[str, float] = {}
        self.sent: list[str] = []
        self.sender = sender

    def send(self, level: str, text: str, key: str | None = None) -> bool:
        key = key or text
        now = time.time()
        if now - self._last.get(key, 0) < self.min_interval:
            return False   # anti-spam
        self._last[key] = now
        msg = f"[xauscalp {level}] {text}"
        print(msg, flush=True)
        self.sent.append(msg)
        if self.sender:
            self.sender(msg)
        elif self.token and self.chat:
            try:
                data = urllib.parse.urlencode({"chat_id": self.chat, "text": msg}).encode()
                urllib.request.urlopen(f"https://api.telegram.org/bot{self.token}/sendMessage", data, timeout=10)
            except Exception as e:  # une alerte ratée ne doit jamais arrêter la gestion des positions
                print(f"[xauscalp] alerte Telegram non envoyée : {e}", flush=True)
        return True
