#!/usr/bin/env python3
"""Remote rule editor, reachable only through the WireGuard tunnel.

Usage: server.py <bind-ip> <port>

Lists the editable files (rules/ and inject/), saves edits, and commits and
pushes them so GitHub stays the source of truth. The proxy hot-reloads HTTP
rules within ~2 s; the sync timer regenerates DNS within ~30 s.

Requests must name this exact address in Host (defeats DNS rebinding) and
POSTs must come from this origin (defeats cross-site form posts from any
other tab in the same browser).
"""

import json
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "proxy"))
sys.path.insert(0, str(ROOT / "tools"))
from anssis.events import tail  # noqa: E402
from gen_dnsmasq import dns_lines  # noqa: E402

from page import render  # noqa: E402

EDITABLE_DIRS = ("rules", "inject")
GIT_LOCK = threading.Lock()


def editable() -> list[str]:
    files = []
    for d in EDITABLE_DIRS:
        files += sorted(str(p.relative_to(ROOT)) for p in (ROOT / d).rglob("*") if p.is_file())
    return files


def resolve(rel: str) -> Path | None:
    return ROOT / rel if rel in editable() else None


def git(*args: str) -> str:
    r = subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True, timeout=60)
    return (r.stdout + r.stderr).strip()


def commit_and_push(rel: str) -> None:
    with GIT_LOCK:
        git("add", "--", rel)
        git("commit", "-q", "-m", f"edit({rel}): via admin page", "--", rel)
        if subprocess.run(["git", "-C", str(ROOT), "push", "-q", "origin", "HEAD"], capture_output=True).returncode:
            git("pull", "-q", "--rebase", "--autostash", "origin", "main")
            git("push", "-q", "origin", "HEAD")


def validate(rel: str, text: str) -> str | None:
    if rel.endswith(".json"):
        try:
            json.loads(text)
        except ValueError as e:
            return f"Not saved: invalid JSON ({e})"
    if rel == "rules/dns.txt":
        try:
            dns_lines(text, "dns.txt", "0.0.0.0")
        except SystemExit as e:
            return f"Not saved: {e}"
    return None


class Handler(BaseHTTPRequestHandler):
    origin = ""

    def _guard(self) -> bool:
        if self.headers.get("Host") != self.origin:
            self.send_error(421, "wrong host")
            return False
        return True

    def _send(self, body: str, status: int = 200) -> None:
        data = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        if not self._guard():
            return
        q = parse_qs(urlparse(self.path).query)
        rel = q.get("f", ["rules/http.json"])[0]
        path = resolve(rel)
        if path is None:
            return self.send_error(404)
        msg = q.get("msg", [""])[0]
        self._send(render(editable(), rel, path.read_text(encoding="utf-8"), msg, tail(80), git("log", "--oneline", "-8")))

    def do_POST(self) -> None:
        if not self._guard():
            return
        if self.headers.get("Origin") != f"http://{self.origin}":
            return self.send_error(403, "cross-origin post")
        length = int(self.headers.get("Content-Length", 0))
        form = parse_qs(self.rfile.read(length).decode(), keep_blank_values=True)
        rel = form.get("f", [""])[0]
        text = form.get("content", [""])[0].replace("\r\n", "\n")
        path = resolve(rel)
        if path is None:
            return self.send_error(404)
        error = validate(rel, text)
        if error is None:
            path.write_text(text, encoding="utf-8")
            threading.Thread(target=commit_and_push, args=(rel,), daemon=True).start()
        msg = error or "Saved. Live in ~2 s (HTTP rules) or ~30 s (DNS)."
        self.send_response(303)
        self.send_header("Location", "/?" + urlencode({"f": rel, "msg": msg}))
        self.end_headers()

    def log_message(self, fmt, *args) -> None:
        pass


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    ip, port = sys.argv[1], int(sys.argv[2])
    Handler.origin = f"{ip}:{port}"
    ThreadingHTTPServer((ip, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
