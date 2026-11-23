"""Devices seen by the blocker, from Caddy's access log for its sites.

Every client reaches the box through Caddy: DNS lookups over DoH
(/dns-query) and the proxied sites (canvas.uva.nl and the rest). Grouping the
log by client IP shows which devices are using it, what they look like (OS
and browser from the User-Agent), and when they were last active. Only the
tail of the log is read, so the page stays fast as the log grows.
"""

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "proxy"))
from anssis.device import label  # noqa: E402

LOG = Path("/var/log/caddy/anssis-access.log")
TAIL_BYTES = 8_000_000


def _lines() -> list[str]:
    try:
        with LOG.open("rb") as f:
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - TAIL_BYTES))
            data = f.read().decode("utf-8", "replace")
    except OSError:
        return []
    lines = data.splitlines()
    return lines[1:] if size > TAIL_BYTES else lines  # first line may be cut


def _kind(host: str, uri: str) -> str:
    if uri.startswith("/dns-query"):
        return "dns"
    for site in ("canvas.uva.nl", "ans.uva.nl", "uva.nl", "github.com"):
        if host == site or host.endswith("." + site):
            return site.split(".")[0] if site != "uva.nl" else "uva"
    return "admin"


def devices() -> list[dict]:
    """One row per client IP, most recently active first."""
    seen: dict[str, dict] = {}
    for ln in _lines():
        try:
            e = json.loads(ln)
            r = e["request"]
        except (ValueError, KeyError, TypeError):
            continue
        ip = r.get("client_ip") or r.get("remote_ip") or "?"
        ua = (r.get("headers", {}).get("User-Agent") or [""])[0]
        d = seen.setdefault(ip, {"ip": ip, "first": e["ts"], "last": e["ts"], "labels": {}, "counts": {}})
        d["last"] = max(d["last"], e["ts"])
        d["first"] = min(d["first"], e["ts"])
        if ua:
            name = label(ua)
            d["labels"][name] = d["labels"].get(name, 0) + 1
        k = _kind(r.get("host", ""), r.get("uri", ""))
        d["counts"][k] = d["counts"].get(k, 0) + 1
    out = []
    for d in seen.values():
        labels = sorted(d["labels"], key=d["labels"].get, reverse=True)
        out.append({
            "ip": d["ip"],
            "device": ", ".join(labels) or "unknown (DNS only)",
            "first": time.strftime("%m-%d %H:%M", time.localtime(d["first"])),
            "last": time.strftime("%m-%d %H:%M", time.localtime(d["last"])),
            "counts": " ".join(f"{k} {n}" for k, n in sorted(d["counts"].items(), key=lambda x: -x[1])),
            "_ts": d["last"],
        })
    return sorted(out, key=lambda d: -d["_ts"])
