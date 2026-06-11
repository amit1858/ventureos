"""
Ensure `src/` is on sys.path so tests can `import ventureos_tinytroupe.*`
without requiring `pip install -e .` first.
"""
from __future__ import annotations

import sys
from pathlib import Path

_SRC = Path(__file__).resolve().parent.parent / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))
