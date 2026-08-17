"""
The one place a strategy is declared.

Adding or renaming one used to mean editing METHOD_NAMES, the methods_to_run
list and get_model_params here, plus eleven separate colour maps in the
frontend — which had already drifted apart (the rebalancer painted CVaR blue
and MVO amber while every other card painted them yellow and purple).

Identity and display names live here; the palette lives in
frontend/src/theme/strategies.ts, because a colour is a presentation concern.
The two are kept in step by `test_strategies_match_the_frontend_registry`.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass(frozen=True)
class Strategy:
    """A candidate the comparator runs and displays."""
    id: str                       # optimizer key, used across the API
    name: str                     # what the dashboard prints
    params: Dict[str, str] = field(default_factory=dict)   # model transparency


STRATEGIES: List[Strategy] = [
    Strategy(id="hrp", name="HRP (Hierarchical Risk Parity)",
             params={"linkage_method": "Ward Linkage"}),
    Strategy(id="cvar", name="CVaR (Conditional Value at Risk)"),
    Strategy(id="mvo", name="MVO (Mean-Variance Max Sharpe)"),
]

STRATEGY_IDS: List[str] = [s.id for s in STRATEGIES]
METHOD_NAMES: Dict[str, str] = {s.id: s.name for s in STRATEGIES}


def get_strategy(strategy_id: str) -> Optional[Strategy]:
    return next((s for s in STRATEGIES if s.id == strategy_id), None)


def display_name(strategy_id: str) -> str:
    """Fall back to the raw id so an unknown method is visible, not blank."""
    return METHOD_NAMES.get(strategy_id, strategy_id)
