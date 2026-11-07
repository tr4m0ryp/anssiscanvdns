"""HTML for the admin page: file list, editor, recent proxy actions, git log."""

from html import escape
from urllib.parse import quote

STYLE = """
body{font:14px/1.45 -apple-system,system-ui,sans-serif;margin:0;display:grid;
grid-template-columns:230px 1fr;min-height:100vh;color:#1d1d1f}
nav{background:#f4f4f6;padding:16px;border-right:1px solid #ddd}
nav a{display:block;padding:3px 6px;border-radius:4px;color:#333;text-decoration:none;
font:12px ui-monospace,monospace}
nav a.on{background:#1d1d1f;color:#fff}
main{padding:16px 24px;min-width:0}
textarea{width:100%;height:58vh;font:12px/1.5 ui-monospace,monospace;box-sizing:border-box;
padding:10px;border:1px solid #ccc;border-radius:6px;tab-size:2}
button{margin-top:8px;padding:6px 18px;border:0;border-radius:6px;background:#1d1d1f;color:#fff}
.msg{padding:6px 10px;border-radius:6px;background:#e8f4ea;margin-bottom:10px}
.msg.err{background:#fbe9e9}
table{border-collapse:collapse;width:100%;font:12px ui-monospace,monospace}
td{padding:2px 8px 2px 0;border-bottom:1px solid #eee;vertical-align:top;word-break:break-all}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#666;margin:22px 0 6px}
pre{font:12px ui-monospace,monospace;margin:0}
"""


def render(files: list[str], current: str, text: str, msg: str, events: list[dict], log: str) -> str:
    nav = "".join(
        f'<a href="/?f={quote(f)}" class="{"on" if f == current else ""}">{escape(f)}</a>' for f in files
    )
    note = ""
    if msg:
        cls = "msg err" if msg.startswith("Not saved") else "msg"
        note = f'<div class="{cls}">{escape(msg)}</div>'
    rows = "".join(
        f"<tr><td>{escape(e['t'])}</td><td>{escape(e['action'])}</td>"
        f"<td>{escape(e['host'])}{escape(e['path'])}</td><td>{escape(e.get('note', ''))}</td></tr>"
        for e in events
    )
    return f"""<!doctype html><html><head><meta charset="utf-8">
<title>anssiscanvdns</title><style>{STYLE}</style></head><body>
<nav><b>anssiscanvdns</b><h2>Files</h2>{nav}</nav>
<main>{note}
<form method="post" action="/"><input type="hidden" name="f" value="{escape(current)}">
<div><b>{escape(current)}</b></div>
<textarea name="content" spellcheck="false">{escape(text)}</textarea>
<button>Save and push</button></form>
<h2>Recent proxy actions</h2><table>{rows or "<tr><td>none yet</td></tr>"}</table>
<h2>Recent commits</h2><pre>{escape(log)}</pre>
</main></body></html>"""
