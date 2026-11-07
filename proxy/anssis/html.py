"""Inline-script injection into HTML pages, with the CSP adjusted to allow it.

The script goes right after <head>, so it runs before the body is parsed:
the same timing as a `document_start` content script. A page whose CSP
forbids inline scripts gets a fresh per-response nonce added to the directive
that governs <script> elements; a policy that already allows inline scripts
is left untouched (adding a nonce there would switch 'unsafe-inline' off).
"""

import re
import secrets

HEAD = re.compile(r"<head\b[^>]*>", re.I)
CSP_HEADER = "content-security-policy"
SCRIPT_DIRECTIVES = ("script-src-elem", "script-src", "default-src")


def patch_policy(policy: str, nonce: str) -> str:
    parts = [p.strip() for p in policy.split(";") if p.strip()]
    names = [p.split()[0].lower() for p in parts]
    for directive in SCRIPT_DIRECTIVES:
        if directive not in names:
            continue
        i = names.index(directive)
        tokens = parts[i].split()
        sources = [t.lower() for t in tokens[1:]]
        keyed = any(s.startswith(("'nonce-", "'sha")) or s == "'strict-dynamic'" for s in sources)
        if "'unsafe-inline'" in sources and not keyed:
            return policy
        tokens = [t for t in tokens if t.lower() != "'none'"] + [f"'nonce-{nonce}'"]
        parts[i] = " ".join(tokens)
        return "; ".join(parts)
    return policy  # no directive governs scripts: inline is allowed


def inject(flow, bundle: str) -> bool:
    """Insert `bundle` into a full HTML page. Returns True when it did."""
    req, resp = flow.request, flow.response
    if resp.status_code != 200 or not bundle:
        return False
    if "text/html" not in resp.headers.get("content-type", "").lower():
        return False
    if "turbo-frame" in req.headers:  # a page fragment, not a document
        return False
    text = resp.get_text(strict=False)
    if text is None:
        return False
    m = HEAD.search(text)
    if not m:
        return False
    nonce = secrets.token_urlsafe(18)
    tag = f'<script nonce="{nonce}" data-anssis>{bundle}</script>'
    resp.set_text(text[: m.end()] + tag + text[m.end():])
    policies = resp.headers.get_all(CSP_HEADER)
    if policies:
        resp.headers.set_all(CSP_HEADER, [patch_policy(p, nonce) for p in policies])
    return True
