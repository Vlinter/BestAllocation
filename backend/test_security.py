"""
Input-boundary tests (pytest).

Everything here guards a place where an attacker-controlled string used to reach
something it should not: the filesystem (SPA catch-all) or a Tiingo URL path
(ticker fields).

Run from the repo root:  pytest backend -q
"""
import os
import sys

import pytest

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from backend.main import resolve_spa_file
from backend.app.core.schemas import CompareRequest, normalize_ticker


# ============================================================================
# SPA catch-all: no path may escape the build directory
# ============================================================================

@pytest.fixture
def dist(tmp_path):
    """A miniature frontend/dist with a secret sitting one level above it."""
    root = tmp_path / "frontend" / "dist"
    (root / "assets").mkdir(parents=True)
    (root / "index.html").write_text("<html>SPA</html>")
    (root / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path / "secret.env").write_text("TIINGO_API_KEY=leak")
    return root.resolve()


def test_serves_real_files_inside_the_build(dist):
    assert resolve_spa_file(dist, "index.html") == dist / "index.html"
    assert resolve_spa_file(dist, "assets/app.js") == dist / "assets" / "app.js"


def test_unknown_route_falls_back_to_the_spa(dist):
    # Client-side routes have no file: the caller serves index.html instead.
    assert resolve_spa_file(dist, "dashboard/risk") is None


@pytest.mark.parametrize("escape", [
    "../secret.env",
    "../../secret.env",
    "assets/../../secret.env",
    "./../secret.env",
    "..%2fsecret.env",          # uvicorn percent-decodes before routing
    "../" * 12 + "etc/passwd",
])
def test_traversal_never_escapes_the_build_directory(dist, escape):
    """
    Regression guard for the reported traversal: `GET /../../backend/.env`
    used to return the Tiingo API key verbatim. Neither uvicorn nor Starlette
    normalises '..', so containment must be enforced here.
    """
    resolved = resolve_spa_file(dist, escape)
    assert resolved is None, f"{escape!r} escaped to {resolved}"


def test_traversal_target_is_readable_without_the_guard(dist, tmp_path):
    """The decoy really is reachable — otherwise the test above proves nothing."""
    assert (tmp_path / "secret.env").is_file()
    assert (dist / ".." / ".." / "secret.env").resolve().is_file()


def test_malformed_paths_are_rejected_not_raised(dist):
    """A NUL byte or an absurd name must not surface as a 500."""
    assert resolve_spa_file(dist, "a\x00b") is None
    assert resolve_spa_file(dist, "x" * 5000) is None


# ============================================================================
# Ticker fields: same gate on every string that lands in a Tiingo URL
# ============================================================================

def _request(**overrides):
    payload = {"tickers": ["SPY", "QQQ"]}
    payload.update(overrides)
    return CompareRequest(**payload)


def test_benchmark_ticker_is_normalized():
    assert _request(benchmark_ticker=" spy ").benchmark_ticker == "SPY"
    assert _request(benchmark_ticker="BRK-B").benchmark_ticker == "BRK-B"


def test_blank_benchmark_ticker_becomes_none():
    assert _request(benchmark_ticker="").benchmark_ticker is None
    assert _request(benchmark_ticker="   ").benchmark_ticker is None


@pytest.mark.parametrize("hostile", [
    "../../account/api/token",
    "SPY/../../account",
    "SPY?token=x",
    "SPY prices",
    "A" * 13,
])
def test_benchmark_ticker_rejects_path_injection(hostile):
    """`tickers` was validated in July; this field reached the URL unchecked."""
    with pytest.raises(ValueError):
        _request(benchmark_ticker=hostile)


def test_tickers_and_benchmark_share_one_validator():
    with pytest.raises(ValueError):
        _request(tickers=["SPY", "../../x"])
    with pytest.raises(ValueError):
        normalize_ticker("../../x")
