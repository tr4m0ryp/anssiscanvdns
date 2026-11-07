# anssiscanvdns

Self-hosted DNS + intercepting HTTPS proxy on the workstation (`ssh claude-ws`)
that edits or blocks canvas.uva.nl / ans.uva.nl for clients on its WireGuard
tunnel. Successor to the `extentionans` browser extension.

## Flow
Client DNS (tunnel) -> dnsmasq on 10.77.0.1 answers proxied hosts with
10.77.0.1 -> tcp 80/443 on wg0 is redirected to mitmproxy :8443 -> addon routes
by SNI, applies `rules/http.json` (block / redirect / replace), injects the
`inject/` scripts inline after `<head>` -> real site.

## Layout
- `rules/http.json` proxied hosts, their inject list, HTTP rules (`"off": true` disables one)
- `rules/dns.txt` `block <domain>` / `point <domain> <ip>`
- `inject/` page scripts (ported content scripts; `shim/storage.js` stands in for chrome.storage)
- `proxy/` mitmproxy addon (`addon.py`) and its package `anssis/`
- `admin/` tunnel-only editor at http://10.77.0.1:8088 (saves, commits, pushes)
- `tools/gen_dnsmasq.py` rules -> dnsmasq config
- `deploy/server/` idempotent `install.sh`, `add-peer.sh`, `ca.sh`, `sync.sh`, systemd units
- `deploy/mac/setup.sh` client side (CA trust, wireguard-tools, LaunchDaemon)

## Conventions
- Rules are the only thing edited day to day. HTTP rules hot-reload in ~2 s;
  DNS rules apply via the 30 s sync timer, which also `git pull`s main.
- The CA is name-constrained to `CA_DOMAINS` in `deploy/server/env.sh`. A new
  proxied domain outside it needs a new CA and a re-trust on every client.
- Nothing listens on the public IP except WireGuard (udp 51820).
