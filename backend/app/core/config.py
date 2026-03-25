# Re-export everything from the root config module to avoid duplication.
# This file exists so that `from ..core.config import X` works in app/api/routes.py.
from backend.config import *  # noqa: F401,F403
