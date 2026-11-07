"""mitmproxy addon: the HTTPS side of the DNS redirect.

dnsmasq answers the configured hosts (canvas.uva.nl, ans.uva.nl, ...) with
the tunnel address, so the browser connects here believing it reached the
real site. mitmproxy runs in reverse mode; this addon re-targets each request
to the host named in the TLS SNI, applies block/redirect rules before the
request leaves, then rewrites and injects scripts into the response.

Run: mitmdump --mode reverse:https://canvas.uva.nl@10.77.0.1:8443 \
        --set keep_host_header=true --set connection_strategy=lazy -s addon.py
"""

import os
import sys

from mitmproxy import http

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from anssis import Rules, drop_json, inject, record  # noqa: E402

TYPES = {"html": "text/html", "json": "json", "js": "javascript", "css": "text/css", "text": "text/"}


class Anssis:
    def __init__(self):
        self.rules = Rules()

    def request(self, flow: http.HTTPFlow) -> None:
        rs = self.rules.current()
        req = flow.request
        host = (flow.client_conn.sni or req.host_header or "").split(":")[0].lower()
        site = rs.site(host)
        if site is None:
            # Only configured sites are proxied; anything else is refused so
            # the box never acts as an open relay.
            flow.response = http.Response.make(421, b"anssiscanvdns: host not intercepted\n")
            return
        if not flow.client_conn.tls_established:
            flow.response = http.Response.make(301, b"", {"Location": f"https://{host}{req.path}"})
            return
        req.scheme, req.host, req.port = "https", host, 443
        req.host_header = host
        flow.metadata["anssis_site"] = site

        for rule in rs.matching("block", host, req.method, req.path):
            flow.response = http.Response.make(rule.status, b"", {"Cache-Control": "no-store"})
            record("block", host, req.path, rule.note)
            return
        for rule in rs.matching("redirect", host, req.method, req.path):
            if req.path != rule.to:
                flow.response = http.Response.make(302, b"", {"Location": rule.to, "Cache-Control": "no-store"})
                record("redirect", host, req.path, rule.note)
                return

    def responseheaders(self, flow: http.HTTPFlow) -> None:
        # HTTP/3 advertisements would send the browser around the proxy over
        # UDP; dropping them keeps every connection on this TCP path.
        if flow.response is not None:
            flow.response.headers.pop("alt-svc", None)

    def response(self, flow: http.HTTPFlow) -> None:
        site = flow.metadata.get("anssis_site")
        if site is None or flow.response is None or flow.response.stream:
            return
        rs = self.rules.current()
        req, resp = flow.request, flow.response
        ctype = resp.headers.get("content-type", "").lower()

        for rule in rs.matching("replace", req.host, req.method, req.path):
            if rule.type and TYPES.get(rule.type, rule.type) not in ctype:
                continue
            text = resp.get_text(strict=False)
            if text is None:
                continue
            new, n = rule.find.subn(rule.repl, text)
            if n:
                resp.set_text(new)
                record("replace", req.host, req.path, f"{rule.note} ({n}x)")

        if "json" in ctype:
            for rule in rs.matching("drop", req.host, req.method, req.path):
                text = resp.get_text(strict=False)
                new, n = drop_json(text or "", rule.drop)
                if n:
                    resp.set_text(new)
                    record("drop", req.host, req.path, f"{rule.note} ({n} items)")

        # Scripts go only into the exact configured host (as the extension's
        # match patterns did), not into subdomains such as the login portal.
        if req.host == site and inject(flow, rs.bundles.get(site, "")):
            record("inject", req.host, req.path)


addons = [Anssis()]
