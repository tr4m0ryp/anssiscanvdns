# Shared settings for the server scripts. Sourced, not executed.

# Public side: any device sets the DoH URL https://$PUBLIC_HOST/dns-query as
# its secure DNS and trusts https://$PUBLIC_HOST/ca.crt once. Proxied hosts
# resolve to PUBLIC_IP, where Caddy terminates TLS and hands them to mitmproxy.
PUBLIC_IP=51.159.106.197
PUBLIC_HOST=anssis.51-159-106-197.nip.io
# Extra names for the same public site (each needs an A record to PUBLIC_IP,
# DNS only). Caddy fetches their certificates on its own.
PUBLIC_ALIASES="dns.husimi.ai"
MITM_PORT=8444
DOH_PORT=8053
ADMIN_PORT=8088

# DNS-over-TLS on TCP 853 for Android's Private DNS setting (dnsdist in front
# of the same dnsmasq). It reuses the certificate Caddy keeps for DOT_HOST,
# which must be one of PUBLIC_HOST / PUBLIC_ALIASES.
DOT_HOST=dns.husimi.ai
CADDY_CERTS=/var/lib/caddy/.local/share/caddy/certificates

# Optional WireGuard tunnel: system-wide DNS for a machine (the Mac uses it).
WG_IF=wg0
WG_IP=10.77.0.1
WG_PREFIX=10.77.0
WG_PORT=51820

ETC=/etc/anssiscanvdns
# The proxy CA may only sign names under these domains (X.509 name
# constraints), so a leaked CA key cannot impersonate any other site.
# Changing this means regenerating the CA and re-trusting it on each client.
CA_DOMAINS="uva.nl github.com"
# A second CA, equally name-constrained, for the social sites (self-block of
# own profiles). Separate so adding it never invalidates the first CA on
# devices that already trust it; each client trusts both (ca.crt, ca-social.crt).
CA_SOCIAL_DOMAINS="x.com twitter.com instagram.com"
