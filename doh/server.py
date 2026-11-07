#!/usr/bin/env python3
"""DNS-over-HTTPS bridge (RFC 8484) in front of the local dnsmasq.

Usage: server.py <bind-ip> <port> <dns-ip>

Caddy terminates TLS for https://<public-host>/dns-query and forwards here.
Each query (GET ?dns=<base64url> or POST application/dns-message) is relayed
to dnsmasq over UDP, retried over TCP when the answer is truncated. DoH runs
over TCP+TLS, so unlike plain UDP DNS it cannot be abused for amplification.
"""

import base64
import socket
import struct
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

CT = "application/dns-message"
MAX_QUERY = 4096
TIMEOUT = 4.0


def ask_udp(server: tuple, query: bytes) -> bytes:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.settimeout(TIMEOUT)
        s.sendto(query, server)
        while True:
            data, _ = s.recvfrom(65535)
            if data[:2] == query[:2]:  # same transaction id
                return data


def ask_tcp(server: tuple, query: bytes) -> bytes:
    with socket.create_connection(server, timeout=TIMEOUT) as s:
        s.sendall(struct.pack("!H", len(query)) + query)
        buf = b""
        while len(buf) < 2 or len(buf) < 2 + struct.unpack("!H", buf[:2])[0]:
            chunk = s.recv(65535)
            if not chunk:
                break
            buf += chunk
        return buf[2:]


def resolve(server: tuple, query: bytes) -> bytes:
    answer = ask_udp(server, query)
    if len(answer) > 2 and answer[2] & 0x02:  # TC bit: retry over TCP
        answer = ask_tcp(server, query)
    return answer


def min_ttl(answer: bytes) -> int:
    """Smallest TTL in the answer section, for Cache-Control; 0 if unparsable."""
    try:
        qd, an = struct.unpack("!HH", answer[4:8])
        i = 12
        for _ in range(qd):
            i = skip_name(answer, i) + 4
        ttls = []
        for _ in range(an):
            i = skip_name(answer, i)
            ttl, rdlen = struct.unpack("!IH", answer[i + 4:i + 10])
            ttls.append(ttl)
            i += 10 + rdlen
        return min(ttls) if ttls else 0
    except (struct.error, IndexError):
        return 0


def skip_name(msg: bytes, i: int) -> int:
    while True:
        n = msg[i]
        if n == 0:
            return i + 1
        if n & 0xC0 == 0xC0:  # compression pointer
            return i + 2
        i += n + 1


class Handler(BaseHTTPRequestHandler):
    upstream: tuple = ("127.0.0.1", 53)
    protocol_version = "HTTP/1.1"

    def _answer(self, query: bytes | None) -> None:
        if not query or len(query) < 12 or len(query) > MAX_QUERY:
            return self.send_error(400, "bad dns query")
        try:
            answer = resolve(self.upstream, query)
        except OSError:
            return self.send_error(502, "resolver unavailable")
        self.send_response(200)
        self.send_header("Content-Type", CT)
        self.send_header("Content-Length", str(len(answer)))
        self.send_header("Cache-Control", f"max-age={min(min_ttl(answer), 300)}")
        self.end_headers()
        self.wfile.write(answer)

    def do_GET(self) -> None:
        url = urlparse(self.path)
        if url.path != "/dns-query":
            return self.send_error(404)
        raw = parse_qs(url.query).get("dns", [""])[0]
        try:
            query = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
        except ValueError:
            query = None
        self._answer(query)

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/dns-query":
            return self.send_error(404)
        if self.headers.get("Content-Type", "").split(";")[0].strip() != CT:
            return self.send_error(415)
        length = int(self.headers.get("Content-Length", 0))
        self._answer(self.rfile.read(length) if 0 < length <= MAX_QUERY else None)

    def log_message(self, fmt, *args) -> None:
        pass


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    Handler.upstream = (sys.argv[3], 53)
    ThreadingHTTPServer((sys.argv[1], int(sys.argv[2])), Handler).serve_forever()


if __name__ == "__main__":
    main()
