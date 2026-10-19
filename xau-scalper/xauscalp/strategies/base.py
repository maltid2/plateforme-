"""Interface commune des stratégies."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Signal:
    side: int            # +1 achat, -1 vente
    stop: float          # niveau de stop (prix « graphique » = bid ; la vente est stoppée sur l'ask)
    target: float | None
    max_minutes: float   # sortie au temps
    tag: str = ""
    features: dict = field(default_factory=dict)


class Strategy:
    """Une stratégie lit le Market à la clôture de la bougie k et renvoie un Signal ou None.

    Toutes les distances sont en multiples d'ATR (transposables entre M1, M5, M15 et entre années).
    """
    name = "base"
    family = ""
    defaults: dict = {}
    grid: dict = {}  # petite grille de robustesse (valeurs voisines des défauts)

    def __init__(self, **params):
        unknown = set(params) - set(self.defaults)
        if unknown:
            raise ValueError(f"{self.name}: paramètres inconnus {unknown}")
        self.p = {**self.defaults, **params}

    def signal(self, m, k: int) -> Signal | None:
        raise NotImplementedError

    def label(self) -> str:
        diff = {k: v for k, v in self.p.items() if self.defaults.get(k) != v}
        return self.name + (f"{diff}" if diff else "")

    # utilitaires
    @staticmethod
    def ok(*xs) -> bool:
        return all(x == x for x in xs)  # pas de NaN
