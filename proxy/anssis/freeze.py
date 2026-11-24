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
import re
from pathlib import Path
from urllib.parse import parse_qsl, urlencode

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


# Whole-site freeze (PeopleSoft SIS). Requests carry per-visit counters and
# session tokens (ICStateNum, ICSID, SAMLResponse, cache busters), so the key
# drops the parameters named by the rule's `volatile` regex from the query
# and from a form body; a later visit then finds the same snapshot.
def _strip(pairs: list, volatile: re.Pattern) -> str:
    return urlencode(sorted((k, v) for k, v in pairs if not volatile.search(k)))


def site_key(host: str, method: str, path: str, body: bytes, ctype: str, volatile: re.Pattern) -> str:
    base, _, query = path.partition("?")
    norm = base + "?" + _strip(parse_qsl(query, keep_blank_values=True), volatile)
    h = hashlib.sha256(f"site\n{host}\n{method}\n{norm}\n".encode())
    if method != "GET":
        if "x-www-form-urlencoded" in ctype:
            text = (body or b"").decode("utf-8", "replace")
            h.update(_strip(parse_qsl(text, keep_blank_values=True), volatile).encode())
        else:
            h.update(body or b"")
    return h.hexdigest()
