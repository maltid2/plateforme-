"""Gestionnaire central du risque, partagé par le backtest, le paper trading et MT5.

Règles (objectifs de contrôle, pas des garanties de perte maximale) :
- risque par trade fixe en % de l'equity (jamais augmenté après une perte : pas de martingale) ;
- perte journalière maximale -> plus de nouvel ordre jusqu'au lendemain ;
- drawdown depuis le pic d'equity -> suspension jusqu'à réarmement manuel ;
- une position maximum, pas de grid, pas de pyramidage ;
- arrêt sur données périmées, anomalies d'exécution répétées ou fichier STOP (arrêt d'urgence).
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
import os


@dataclass
class RiskLimits:
    risk_pct: float = 0.25            # % de l'equity par trade
    max_daily_loss_pct: float = 1.0   # % de l'equity du début de journée
    max_drawdown_pct: float = 5.0     # % depuis le pic d'equity -> suspension
    max_positions: int = 1
    max_trades_per_day: int = 6
    max_spread: float = 0.60          # $ : au-delà, pas d'entrée
    max_data_age_s: float = 180.0     # dernière bougie/tick trop vieux -> pas d'entrée
    max_exec_errors: int = 3          # erreurs d'exécution consécutives -> arrêt
    kill_file: str = "STOP"           # présence du fichier = arrêt d'urgence


@dataclass
class RiskState:
    day: str = ""
    day_start_equity: float = 0.0
    peak_equity: float = 0.0
    trades_today: int = 0
    exec_errors: int = 0
    suspended: bool = False
    suspend_reason: str = ""


class RiskManager:
    def __init__(self, limits: RiskLimits, state: RiskState | None = None):
        self.limits = limits
        self.state = state or RiskState()

    # --- suivi de l'equity -------------------------------------------------
    def on_equity(self, day: str, equity: float) -> None:
        s = self.state
        if s.day != day:
            s.day, s.day_start_equity, s.trades_today = day, equity, 0
        if equity > s.peak_equity:
            s.peak_equity = equity
        if s.peak_equity > 0 and equity <= s.peak_equity * (1 - self.limits.max_drawdown_pct / 100):
            self.suspend(f"drawdown {100 * (1 - equity / s.peak_equity):.2f} % depuis le pic")

    def daily_loss_hit(self, equity: float) -> bool:
        s = self.state
        return s.day_start_equity > 0 and equity <= s.day_start_equity * (1 - self.limits.max_daily_loss_pct / 100)

    def suspend(self, reason: str) -> None:
        if not self.state.suspended:
            self.state.suspended, self.state.suspend_reason = True, reason

    def rearm(self, equity: float) -> None:
        """Réarmement MANUEL après analyse (repart du niveau d'equity actuel comme nouveau pic)."""
        self.state.suspended, self.state.suspend_reason = False, ""
        self.state.peak_equity = equity
        self.state.exec_errors = 0

    # --- exécution -------------------------------------------------------
    def on_open(self) -> None:
        self.state.trades_today += 1

    def on_exec_result(self, ok: bool) -> None:
        self.state.exec_errors = 0 if ok else self.state.exec_errors + 1
        if self.state.exec_errors >= self.limits.max_exec_errors:
            self.suspend(f"{self.state.exec_errors} erreurs d'exécution consécutives")

    # --- décision -----------------------------------------------------------
    def can_open(self, *, equity: float, open_positions: int, spread: float | None = None,
                 data_age_s: float | None = None, workdir: str = ".") -> tuple[bool, str]:
        L, s = self.limits, self.state
        if os.path.exists(os.path.join(workdir, L.kill_file)):
            return False, "arrêt d'urgence (fichier STOP)"
        if s.suspended:
            return False, f"suspendu : {s.suspend_reason}"
        if equity <= 0:
            return False, "equity nulle"
        if self.daily_loss_hit(equity):
            return False, f"perte journalière >= {L.max_daily_loss_pct} %"
        if open_positions >= L.max_positions:
            return False, "position déjà ouverte"
        if s.trades_today >= L.max_trades_per_day:
            return False, "nombre max de trades du jour"
        if spread is not None and spread > L.max_spread:
            return False, f"spread {spread:.2f} > {L.max_spread}"
        if data_age_s is not None and data_age_s > L.max_data_age_s:
            return False, f"données périmées ({data_age_s:.0f} s)"
        return True, "ok"

    def risk_pct(self) -> float:
        """Toujours le même pourcentage : aucune augmentation après une perte."""
        return self.limits.risk_pct

    def to_dict(self) -> dict:
        return asdict(self.state)
