"""Baseline filter: the data stays live, but nothing new appears.

The first good JSON answer to a matching request (keyed like freeze: method,
path, POST body) is stored as the baseline. Every later answer keeps only
list elements that already existed in the baseline at the same place
(same chain of object keys); a new result, mark or row is dropped. An
existing entry whose content changed (a regraded mark) also counts as new
and is dropped. When most elements would go, the answer is too noisy to
compare (timestamps in every element), so the stored baseline is served
instead: old data, never new.
"""

import json

from .freeze import load, save

PREFIX = "while(1);"


def _canon(x) -> str:
    return json.dumps(x, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _index(node, path: tuple, out: dict) -> None:
    if isinstance(node, list):
        out.setdefault(path, set()).update(_canon(x) for x in node)
        for x in node:
            _index(x, path, out)
    elif isinstance(node, dict):
        for k, v in node.items():
            _index(v, path + (k,), out)


def _filter(node, path: tuple, base: dict, tally: list):
    if isinstance(node, list):
        seen = base.get(path, set())
        kept = []
        for x in node:
            if _canon(x) in seen:
                kept.append(x)
            else:
                tally[1] += 1
        tally[0] += len(kept)
        return kept
    if isinstance(node, dict):
        return {k: _filter(v, path + (k,), base, tally) for k, v in node.items()}
    return node


def apply(k: str, path: str, status: int, headers: list, body: bytes) -> tuple[bytes, str]:
    """Returns (body to send, what happened)."""
    text = body.decode("utf-8", "replace")
    prefix = PREFIX if text.startswith(PREFIX) else ""
    try:
        data = json.loads(text[len(prefix):])
    except ValueError:
        return body, "not json, passed"
    snap = load(k)
    if snap is None:
        save(k, path, status, headers, body)
        return body, "baseline taken"
    base_data = json.loads(snap["body"].encode("latin-1").decode("utf-8", "replace")[len(prefix):])
    index: dict = {}
    _index(base_data, (), index)
    tally = [0, 0]  # kept, dropped
    out = _filter(data, (), index, tally)
    if not tally[1]:
        return body, "nothing new"
    if tally[1] > tally[0]:
        return snap["body"].encode("latin-1"), f"noisy ({tally[1]} new of {sum(tally)}), baseline served"
    return (prefix + json.dumps(out, ensure_ascii=False)).encode(), f"{tally[1]} new item(s) dropped"
