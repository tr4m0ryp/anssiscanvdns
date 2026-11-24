"""Frozen pages: the first good response is kept and replayed forever.

A `freeze` rule matches a page by path, and the page's own data requests by
their Referer. The first 200 answer to each such request (keyed by method,
path and, for POSTs, a hash of the body) is written to the state directory;
every later request is answered from that file and never reaches the real
site, so the page shows no data newer than the snapshot. Only GETs and
GraphQL POSTs are frozen, never writes. Set-Cookie is not replayed.
"""

import hashlib
import json
import os
from pathlib import Path

STATE = Path(os.environ.get("ANSSIS_STATE", Path.home() / ".local/state/anssiscanvdns"))
DIR = STATE / "freeze"
SKIP_HEADERS = {"set-cookie", "content-length", "content-encoding", "transfer-encoding", "date"}


def freezable(method: str, path: str) -> bool:
    return method == "GET" or (method == "POST" and path.startswith("/api/graphql"))


def key(host: str, method: str, path: str, body: bytes) -> str:
    h = hashlib.sha256(f"{host}\n{method}\n{path}\n".encode())
    if method == "POST":
        h.update(body or b"")
    return h.hexdigest()


def load(k: str) -> dict | None:
    try:
        return json.loads((DIR / f"{k}.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def save(k: str, path: str, status: int, headers: list, body: bytes) -> None:
    DIR.mkdir(parents=True, exist_ok=True)
    keep = [(n, v) for n, v in headers if n.lower() not in SKIP_HEADERS]
    snap = {"path": path, "status": status, "headers": keep, "body": body.decode("latin-1")}
    tmp = DIR / f"{k}.tmp"
    tmp.write_text(json.dumps(snap), encoding="utf-8")
    tmp.replace(DIR / f"{k}.json")
