"""
The strategy registry, and the guard that keeps its two halves in step.

Identity lives in backend/strategies.py, the palette in
frontend/src/theme/strategies.ts. Two files, one list — so the risk is that
they drift, which is exactly what happened to the eleven colour maps this
registry replaced.

Run from the repo root:  pytest backend -q
"""
import os
import re
import sys

import pytest

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from backend.strategies import STRATEGIES, STRATEGY_IDS, METHOD_NAMES, display_name, get_strategy

FRONTEND_REGISTRY = os.path.join(
    os.path.dirname(__file__), "..", "frontend", "src", "theme", "strategies.ts")


def test_ids_are_unique_and_url_safe():
    assert len(set(STRATEGY_IDS)) == len(STRATEGY_IDS)
    for sid in STRATEGY_IDS:
        assert re.fullmatch(r"[a-z0-9_-]+", sid), sid


def test_names_are_distinct():
    """method_name keys the significance report and the frontend lookups."""
    names = list(METHOD_NAMES.values())
    assert len(set(names)) == len(names)


def test_display_name_falls_back_to_the_id():
    """An unknown method must render as something, not as a blank cell."""
    assert display_name("hrp") == METHOD_NAMES["hrp"]
    assert display_name("not-a-method") == "not-a-method"


def test_params_travel_with_the_strategy():
    assert get_strategy("hrp").params == {"linkage_method": "Ward Linkage"}
    assert get_strategy("cvar").params == {}
    assert get_strategy("nope") is None


def test_every_strategy_has_a_frontend_style():
    """
    The registries are in different languages, so nothing but a test connects
    them. Before it existed, eleven components each carried their own map and
    two of them disagreed: the rebalancer painted CVaR blue and MVO amber while
    every other card painted them yellow and purple.
    """
    if not os.path.exists(FRONTEND_REGISTRY):
        pytest.skip("frontend registry not present")

    with open(FRONTEND_REGISTRY, encoding="utf-8") as fh:
        source = fh.read()

    block = re.search(r"STRATEGY_STYLES:\s*Record<string,\s*StrategyStyle>\s*=\s*\{(.*?)\n\};",
                      source, re.S)
    assert block, "could not find STRATEGY_STYLES in the frontend registry"
    styled = set(re.findall(r"^\s{4}(\w+):\s*\{", block.group(1), re.M))

    assert styled == set(STRATEGY_IDS), (
        f"registries drifted — backend {sorted(STRATEGY_IDS)}, frontend {sorted(styled)}")


def test_frontend_styles_are_distinct_colours():
    """Two strategies sharing a colour is indistinguishable on every chart."""
    if not os.path.exists(FRONTEND_REGISTRY):
        pytest.skip("frontend registry not present")

    with open(FRONTEND_REGISTRY, encoding="utf-8") as fh:
        source = fh.read()

    block = re.search(r"STRATEGY_STYLES:\s*Record<string,\s*StrategyStyle>\s*=\s*\{(.*?)\n\};",
                      source, re.S)
    colours = re.findall(r"color:\s*'(#[0-9A-Fa-f]{6})'", block.group(1))

    assert len(colours) == len(STRATEGIES)
    assert len(set(c.upper() for c in colours)) == len(colours), f"duplicate colours: {colours}"
