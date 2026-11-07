"""Rules from rules/http.json plus the scripts in inject/, hot-reloaded.

The files are re-checked at most every RECHECK seconds; a change in any of
them (edited over the admin page, pulled from git, or by hand) rebuilds the
whole rule set. A file that fails to parse keeps the last good rule set live.
"""

import json
import logging
import os
import re
import time
from pathlib import Path

ROOT = Path(os.environ.get("ANSSIS_ROOT", Path(__file__).resolve().parents[2]))
HTTP_RULES = ROOT / "rules" / "http.json"
INJECT_DIR = ROOT / "inject"
RECHECK = 2.0

log = logging.getLogger("anssis")


def host_matches(pattern: str, host: str) -> bool:
    """`canvas.uva.nl` matches itself and its subdomains; `*` matches all."""
    return pattern == "*" or host == pattern or host.endswith("." + pattern)


class Rule:
    def __init__(self, d: dict):
        self.action = d["action"]
        if self.action not in ("block", "redirect", "replace"):
            raise ValueError(f"unknown action {self.action!r}")
        self.note = d.get("note", "")
        self.host = d.get("host", "*")
        self.path = re.compile(d.get("path", ""))
        self.method = d.get("method", "").upper()
        self.status = int(d.get("status", 403))
        self.to = d.get("to", "/")
        self.type = d.get("type", "")
        self.find = re.compile(d["find"]) if self.action == "replace" else None
        self.repl = d.get("with", "")

    def matches(self, host: str, method: str, path: str) -> bool:
        return (
            host_matches(self.host, host)
            and (not self.method or self.method == method)
            and self.path.search(path) is not None
        )


class RuleSet:
    def __init__(self, data: dict):
        self.hosts = {h.lower(): cfg for h, cfg in data.get("hosts", {}).items()}
        self.rules = [Rule(r) for r in data.get("rules", []) if not r.get("off")]
        self.bundles = {h: build_bundle(cfg.get("inject", [])) for h, cfg in self.hosts.items()}

    def site(self, host: str) -> str | None:
        """The configured site a request host belongs to, or None."""
        for h in self.hosts:
            if host_matches(h, host):
                return h
        return None

    def matching(self, action: str, host: str, method: str, path: str):
        return [r for r in self.rules if r.action == action and r.matches(host, method, path)]


def build_bundle(files: list[str]) -> str:
    """Concatenate the listed scripts in order, as one inline <script> body."""
    parts = []
    for name in files:
        p = (INJECT_DIR / name).resolve()
        if INJECT_DIR.resolve() not in p.parents:
            raise ValueError(f"inject path escapes inject/: {name}")
        parts.append(f"// --- {name} ---\n" + p.read_text(encoding="utf-8"))
    # A literal </script> inside the code would end the inline tag early.
    return "\n;\n".join(parts).replace("</script", "<\\/script")


def _fingerprint() -> tuple:
    stamps = [HTTP_RULES.stat().st_mtime_ns]
    for dirpath, _, names in os.walk(INJECT_DIR):
        stamps += [(os.path.join(dirpath, n), os.stat(os.path.join(dirpath, n)).st_mtime_ns) for n in names]
    return tuple(sorted(map(str, stamps)))


class Rules:
    """Holds the live RuleSet and swaps it when the files change."""

    def __init__(self):
        self._set = RuleSet({})
        self._fp = None
        self._checked = 0.0
        self.current()

    def current(self) -> RuleSet:
        now = time.monotonic()
        if now - self._checked < RECHECK:
            return self._set
        self._checked = now
        try:
            fp = _fingerprint()
            if fp != self._fp:
                self._set = RuleSet(json.loads(HTTP_RULES.read_text(encoding="utf-8")))
                self._fp = fp
                log.warning("anssis: rules loaded (%d rules, sites %s)", len(self._set.rules), list(self._set.hosts))
        except Exception as e:  # keep serving the last good set
            log.error("anssis: rules reload failed, keeping previous set: %s", e)
        return self._set
