# anssiscanvdns

Self-hosted DNS + intercepting HTTPS proxy on the workstation (`ssh claude-ws`)
that edits or blocks canvas.uva.nl / ans.uva.nl. Public: any device sets the
DoH URL as its secure DNS and trusts the CA once. Successor to the
`extentionans` browser extension.

## Flow
Device DoH -> https://anssis.51-159-106-197.nip.io/dns-query (Caddy) -> `doh/`
bridge -> dnsmasq answers proxied hosts (and subdomains) with the public IP,
AAAA empty -> device opens https://canvas.uva.nl at the public IP -> Caddy
terminates TLS with a cert from the name-constrained CA -> mitmproxy on
127.0.0.1:8444 applies `rules/http.json` (block / redirect / replace / drop)
and injects `inject/` scripts after `<head>` -> real site.

## Layout
- `rules/http.json` proxied hosts, their inject list, HTTP rules (`"off": true` disables one)
- `rules/dns.txt` `block <domain>` / `point <domain> <ip>`
- `inject/` page scripts (ported content scripts; `shim/storage.js` stands in for chrome.storage)
- `proxy/` mitmproxy addon (`addon.py`) and its package `anssis/`
- `doh/` RFC 8484 bridge to dnsmasq
- `admin/` editor at https://anssis.51-159-106-197.nip.io/ (basic auth, user anssis; saves, commits, pushes)
- `tools/gen_dnsmasq.py` rules -> dnsmasq config
- `deploy/server/` idempotent `install.sh`; `caddy.sh` (sites), `leaf.sh` (proxy cert), `ca.sh`, `sync.sh`, units
- `deploy/server/add-peer.sh`, `deploy/mac/setup.sh` optional WireGuard tunnel for system-wide DNS (the Mac uses it)

## Conventions
- Rules are the only thing edited day to day. HTTP rules hot-reload in ~2 s;
  DNS rules, the proxy cert and Caddy sites follow via the 30 s sync timer,
  which also `git pull`s main.
- The CA is name-constrained to `CA_DOMAINS` in `deploy/server/env.sh`. A new
  proxied domain outside it needs a new CA and a re-trust on every client.
- Plain DNS (udp/tcp 53) is never exposed publicly; DoH only.
