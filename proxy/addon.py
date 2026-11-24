"""mitmproxy addon: the HTTPS side of the DNS redirect.

The resolver answers the configured hosts (canvas.uva.nl, ans.uva.nl and
their subdomains) with the server's public IP. Caddy terminates TLS there with
the name-constrained CA's certificate and forwards plain HTTP to this proxy on
loopback. The addon re-targets each request to the real host named in Host,
applies block/redirect rules before it leaves, then rewrites, filters and
injects scripts into the response.

Run: mitmdump --mode reverse:https://canvas.uva.nl@127.0.0.1:8444 \
        --set keep_host_header=true --set connection_strategy=lazy -s addon.py
"""

import os
import sys

from mitmproxy import http

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from urllib.parse import unquote_plus, urlsplit  # noqa: E402

from anssis import Rules, device_label, drop_json, freeze, host_matches, inject, record  # noqa: E402

TYPES = {"html": "text/html", "json": "json", "js": "javascript", "css": "text/css", "text": "text/"}


class Anssis:
    def __init__(self):
        self.rules = Rules()

    def request(self, flow: http.HTTPFlow) -> None:
        rs = self.rules.current()
        req = flow.request
        host = (req.host_header or "").split(":")[0].lower()
        site = rs.site(host)
        if site is None:
            # Only configured sites are proxied; anything else is refused so
            # the box never acts as an open relay.
            flow.response = http.Response.make(421, b"anssiscanvdns: host not intercepted\n")
            return
        # Who sent it: Caddy's X-Forwarded-For holds the device's IP. Kept for
        # the action log only, then stripped with the other forwarding headers.
        who = {
            "client": (req.headers.get("x-forwarded-for") or "").split(",")[0].strip(),
            "device": device_label(req.headers.get("user-agent", "")),
        }
        flow.metadata["anssis_who"] = who
        # Caddy's forwarding headers would reveal the proxy to the real site.
        for h in ("x-forwarded-for", "x-forwarded-proto", "x-forwarded-host", "via"):
            req.headers.pop(h, None)
        req.scheme, req.host, req.port = "https", host, 443
        req.host_header = host
        flow.metadata["anssis_site"] = site

        # Rules with a `request` regex see the decoded URL plus the body.
        text = ""
        if any(r.request for r in rs.rules if r.host == "*" or host_matches(r.host, host)):
            text = unquote_plus(req.path) + "\n" + unquote_plus(req.get_text(strict=False) or "")
        # Frozen site: snapshot, or record while the window is open, or refuse.
        site_rule = next((r for r in rs.rules if r.action == "freeze" and r.site and host_matches(r.host, host)), None)
        if site_rule:
            k = freeze.site_key(host, req.method, req.path, req.raw_content or b"",
                                req.headers.get("content-type", ""), site_rule.volatile)
            snap = freeze.load(k)
            if snap:
                headers = http.Headers([(n.encode(), v.encode()) for n, v in snap["headers"]])
                flow.response = http.Response.make(snap["status"], snap["body"].encode("latin-1"), headers)
                flow.response.headers["Cache-Control"] = "no-store"
                flow.metadata["anssis_frozen"] = "served"
                record("freeze", host, req.path[:120], "site: served from snapshot", **who)
                return
            if site_rule.sealed():
                flow.response = http.Response.make(404, b"", {"Cache-Control": "no-store"})
                record("freeze", host, req.path[:120], "site sealed: no snapshot, refused", **who)
                return
            flow.metadata["anssis_frozen"] = k
            flow.metadata["anssis_site_freeze"] = True

        # Frozen page: answer from the snapshot, or mark the flow for capture.
        referer = req.headers.get("referer", "")
        if not site_rule and freeze.freezable(req.method, req.path) and any(r.freezes(host, req.path, referer) for r in rs.rules):
            k = freeze.key(host, req.method, req.path, req.raw_content or b"")
            snap = freeze.load(k)
            if snap:
                headers = http.Headers([(n.encode(), v.encode()) for n, v in snap["headers"]])
                flow.response = http.Response.make(snap["status"], snap["body"].encode("latin-1"), headers)
                flow.response.headers["Cache-Control"] = "no-store"
                flow.metadata["anssis_frozen"] = "served"
                record("freeze", host, req.path, "served from snapshot", **who)
                return
            # Once the page itself is frozen, a request from it that has no
            # snapshot yet (another device, a different query) is refused
            # instead of fetched, so no newer data can arrive.
            page = urlsplit(referer).path if referer else ""
            if page and page != req.path and freeze.load(freeze.key(host, "GET", page, b"")):
                flow.response = http.Response.make(404, b"", {"Cache-Control": "no-store"})
                record("freeze", host, req.path, "refused: page frozen, no snapshot", **who)
                return
            flow.metadata["anssis_frozen"] = k

        for rule in rs.matching("block", host, req.method, req.path, text):
            headers = {"Cache-Control": "no-store"}
            if rule.body:
                headers["Content-Type"] = rule.ctype
            flow.response = http.Response.make(rule.status, rule.body.encode(), headers)
            record("block", host, req.path, rule.note, **who)
            return
        for rule in rs.matching("redirect", host, req.method, req.path, text):
            if req.path != rule.to:
                flow.response = http.Response.make(302, b"", {"Location": rule.to, "Cache-Control": "no-store"})
                record("redirect", host, req.path, rule.note, **who)
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
        who = flow.metadata.get("anssis_who", {})
        ctype = resp.headers.get("content-type", "").lower()

        # First good answer to a frozen request: keep it as the snapshot,
        # before any rewrite or injection touches it.
        k = flow.metadata.get("anssis_frozen")
        # A frozen site also keeps redirects (login hops), never errors.
        ok = resp.status_code == 200 or (flow.metadata.get("anssis_site_freeze") and resp.status_code < 400)
        if k and k != "served" and ok:
            freeze.save(k, req.path, resp.status_code, list(resp.headers.items(multi=True)), resp.get_content() or b"")
            record("freeze", req.host, req.path, "snapshot taken", **who)

        for rule in rs.matching("replace", req.host, req.method, req.path):
            if rule.type and TYPES.get(rule.type, rule.type) not in ctype:
                continue
            text = resp.get_text(strict=False)
            if text is None:
                continue
            new, n = rule.find.subn(rule.repl, text)
            if n:
                resp.set_text(new)
                record("replace", req.host, req.path, f"{rule.note} ({n}x)", **who)

        if "json" in ctype:
            for rule in rs.matching("drop", req.host, req.method, req.path):
                text = resp.get_text(strict=False)
                new, n = drop_json(text or "", rule.drop, rule.within)
                if n:
                    resp.set_text(new)
                    record("drop", req.host, req.path, f"{rule.note} ({n} items)", **who)

        # Scripts go only into the exact configured host (as the extension's
        # match patterns did), not into subdomains such as the login portal.
        if req.host == site and inject(flow, rs.bundles.get(site, "")):
            record("inject", req.host, req.path, **who)


addons = [Anssis()]
