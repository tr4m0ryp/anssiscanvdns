"""Append-only JSON-lines log of what the proxy changed, read by the admin page.

Only actions are logged (blocks, redirects, rewrites, injections), never
request bodies or cookies. The file rotates to `.1` past MAX_BYTES.
"""

import json
import os
import time
from pathlib import Path

STATE = Path(os.environ.get("ANSSIS_STATE", Path.home() / ".local/state/anssiscanvdns"))
LOG = STATE / "events.jsonl"
MAX_BYTES = 2_000_000


def record(action: str, host: str, path: str, note: str = "") -> None:
    STATE.mkdir(parents=True, exist_ok=True)
    try:
        if LOG.stat().st_size > MAX_BYTES:
            LOG.replace(LOG.with_suffix(".jsonl.1"))
    except FileNotFoundError:
        pass
    line = {"t": time.strftime("%Y-%m-%d %H:%M:%S"), "action": action, "host": host, "path": path[:300], "note": note}
    with LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(line) + "\n")


def tail(n: int = 100) -> list[dict]:
    try:
        lines = LOG.read_text(encoding="utf-8").splitlines()[-n:]
    except FileNotFoundError:
        return []
    out = []
    for ln in reversed(lines):
        try:
            out.append(json.loads(ln))
        except ValueError:
            continue
    return out
