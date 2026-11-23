"""A short device label (OS and browser or app) from a User-Agent string."""

import re

# First match wins, so the more specific names come first.
OS = (
    (r"Android", "Android"),
    (r"iPhone", "iPhone"),
    (r"iPad", "iPad"),
    (r"Windows", "Windows"),
    (r"CrOS", "ChromeOS"),
    (r"Mac OS X|Macintosh|Darwin", "Mac"),
    (r"Linux", "Linux"),
)
APP = (
    (r"candroid|Canvas.*Android", "Canvas app"),
    (r"iCanvas|Canvas.*iOS", "Canvas app"),
    (r"Edg/|EdgA/|EdgiOS/", "Edge"),
    (r"OPR/|Opera", "Opera"),
    (r"Brave", "Brave"),
    (r"SamsungBrowser", "Samsung Internet"),
    (r"Firefox/|FxiOS/", "Firefox"),
    (r"Chrome/|CriOS/", "Chrome"),
    (r"Safari/", "Safari"),
    (r"curl/|python|Go-http", "script"),
)


def _first(table, ua: str) -> str:
    return next((name for pat, name in table if re.search(pat, ua)), "")


def label(ua: str) -> str:
    """`Windows Chrome`, `Android Canvas app`, or `unknown` for an empty UA."""
    ua = ua or ""
    parts = [p for p in (_first(OS, ua), _first(APP, ua)) if p]
    return " ".join(parts) or ("unknown" if not ua else ua[:40])
