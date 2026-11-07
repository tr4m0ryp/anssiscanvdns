# Shared settings for the server scripts. Sourced, not executed.

# Public side: any device sets the DoH URL https://$PUBLIC_HOST/dns-query as
# its secure DNS and trusts https://$PUBLIC_HOST/ca.crt once. Proxied hosts
# resolve to PUBLIC_IP, where Caddy terminates TLS and hands them to mitmproxy.
PUBLIC_IP=51.159.106.197
PUBLIC_HOST=anssis.51-159-106-197.nip.io
MITM_PORT=8444
DOH_PORT=8053
ADMIN_PORT=8088

# Optional WireGuard tunnel: system-wide DNS for a machine (the Mac uses it).
WG_IF=wg0
WG_IP=10.77.0.1
WG_PREFIX=10.77.0
WG_PORT=51820

ETC=/etc/anssiscanvdns
# The proxy CA may only sign names under these domains (X.509 name
# constraints), so a leaked CA key cannot impersonate any other site.
# Changing this means regenerating the CA and re-trusting it on each client.
CA_DOMAINS="uva.nl"
