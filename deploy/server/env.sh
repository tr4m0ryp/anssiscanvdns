# Shared settings for the server scripts. Sourced, not executed.
WG_IF=wg0
WG_IP=10.77.0.1
WG_PREFIX=10.77.0
WG_PORT=51820
PROXY_PORT=8443
ADMIN_PORT=8088
ETC=/etc/anssiscanvdns
# The proxy CA may only sign names under these domains (X.509 name
# constraints), so a leaked CA key cannot impersonate any other site.
# Changing this means regenerating the CA and re-trusting it on each client.
CA_DOMAINS="uva.nl"
