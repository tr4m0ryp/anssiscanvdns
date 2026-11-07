#!/bin/sh
# Add a client (laptop, phone) to the tunnel and write its config to
# $ETC/peers/<name>.conf. The client sends all DNS to the box but only the
# tunnel subnet through it; the rest of its traffic goes direct.
set -eu
. "$(dirname "$0")/env.sh"
NAME="$1"
OUT="$ETC/peers/$NAME.conf"
[ -f "$OUT" ] && { echo "peer exists: $OUT"; exit 0; }
install -d -m 700 "$ETC/peers"

USED="$(grep -ho "$WG_PREFIX\.[0-9]*" "/etc/wireguard/$WG_IF.conf" | cut -d. -f4 | sort -n | tail -1)"
IP="$WG_PREFIX.$((USED + 1))"
KEY="$(wg genkey)"; PUB="$(printf %s "$KEY" | wg pubkey)"; PSK="$(wg genpsk)"
ENDPOINT="$(curl -4 -fsS https://ifconfig.me 2>/dev/null || hostname -I | cut -d' ' -f1)"

printf '\n# %s\n[Peer]\nPublicKey = %s\nPresharedKey = %s\nAllowedIPs = %s/32\n' \
  "$NAME" "$PUB" "$PSK" "$IP" >> "/etc/wireguard/$WG_IF.conf"
umask 077
cat > "$OUT" <<CONF
[Interface]
PrivateKey = $KEY
Address = $IP/32
DNS = $WG_IP

[Peer]
PublicKey = $(cat "/etc/wireguard/$WG_IF.pub")
PresharedKey = $PSK
Endpoint = $ENDPOINT:$WG_PORT
AllowedIPs = $WG_PREFIX.0/24
PersistentKeepalive = 25
CONF
if wg show "$WG_IF" >/dev/null 2>&1; then
  wg set "$WG_IF" peer "$PUB" preshared-key /dev/stdin allowed-ips "$IP/32" <<PSKIN
$PSK
PSKIN
fi
echo "peer $NAME = $IP, config: $OUT"
