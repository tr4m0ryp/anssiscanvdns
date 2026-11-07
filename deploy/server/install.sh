#!/bin/sh
# One-shot, idempotent server setup. Run from the repo checkout:
#   sudo sh deploy/server/install.sh [first-peer-name]
# Installs WireGuard + dnsmasq + mitmproxy, creates the name-constrained CA,
# the tunnel, the systemd units and firewall rules, then adds one client.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
. "$HERE/env.sh"
OWNER="$(stat -c %U "$ROOT")"
OWNER_HOME="$(getent passwd "$OWNER" | cut -d: -f6)"
PEER="${1:-mac}"

echo "== packages"
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq wireguard-tools dnsmasq-base python3-venv openssl >/dev/null
if [ ! -x "$ROOT/.venv/bin/mitmdump" ]; then
  runuser -u "$OWNER" -- python3 -m venv "$ROOT/.venv"
  runuser -u "$OWNER" -- "$ROOT/.venv/bin/pip" install -q --upgrade pip mitmproxy
fi

echo "== config dir and CA"
install -d -m 755 "$ETC"
sh "$HERE/ca.sh" "$OWNER"

echo "== WireGuard $WG_IF ($WG_IP, udp $WG_PORT)"
if [ ! -f "/etc/wireguard/$WG_IF.conf" ]; then
  umask 077
  wg genkey > "/etc/wireguard/$WG_IF.key"
  wg pubkey < "/etc/wireguard/$WG_IF.key" > "/etc/wireguard/$WG_IF.pub"
  # Port 443/80 on the public IP belong to Caddy, so tunnel traffic for them
  # is redirected to the proxy's own port before it reaches any socket. UDP
  # 443 is refused so browsers never try HTTP/3 around the proxy.
  cat > "/etc/wireguard/$WG_IF.conf" <<CONF
[Interface]
Address = $WG_IP/24
ListenPort = $WG_PORT
PrivateKey = $(cat "/etc/wireguard/$WG_IF.key")
PostUp = iptables -t nat -A PREROUTING -i %i -p tcp -m multiport --dports 80,443 -j REDIRECT --to-ports $PROXY_PORT
PostUp = iptables -I INPUT -i %i -p udp --dport 443 -j REJECT
PostDown = iptables -t nat -D PREROUTING -i %i -p tcp -m multiport --dports 80,443 -j REDIRECT --to-ports $PROXY_PORT
PostDown = iptables -D INPUT -i %i -p udp --dport 443 -j REJECT
CONF
  umask 022
fi

echo "== dnsmasq"
install -m 644 "$HERE/dnsmasq.conf" "$ETC/dnsmasq.conf"
python3 "$ROOT/tools/gen_dnsmasq.py" "$ROOT" "$WG_IP" > "$ETC/dnsmasq.rules.conf"

echo "== systemd units"
for f in "$HERE"/units/*; do
  sed -e "s|@USER@|$OWNER|g" -e "s|@HOME@|$OWNER_HOME|g" -e "s|@ROOT@|$ROOT|g" \
      -e "s|@WG_IP@|$WG_IP|g" -e "s|@PROXY_PORT@|$PROXY_PORT|g" -e "s|@ADMIN_PORT@|$ADMIN_PORT|g" \
      "$f" > "/etc/systemd/system/$(basename "$f")"
done
systemctl daemon-reload

echo "== firewall"
if command -v ufw >/dev/null && ufw status | grep -q active; then
  ufw allow "$WG_PORT/udp" comment anssiscanvdns-wireguard >/dev/null
  ufw allow in on "$WG_IF" to "$WG_IP" port 53 comment anssiscanvdns-dns >/dev/null
  ufw allow in on "$WG_IF" to "$WG_IP" port "$PROXY_PORT" proto tcp comment anssiscanvdns-proxy >/dev/null
  ufw allow in on "$WG_IF" to "$WG_IP" port "$ADMIN_PORT" proto tcp comment anssiscanvdns-admin >/dev/null
fi

echo "== start"
systemctl enable --now "wg-quick@$WG_IF" >/dev/null 2>&1
systemctl enable --now anssis-dns anssis-proxy anssis-admin anssis-sync.timer >/dev/null 2>&1
systemctl restart anssis-dns anssis-proxy anssis-admin

sh "$HERE/add-peer.sh" "$PEER"
echo "== done. Client config: $ETC/peers/$PEER.conf  CA: $ETC/ca.crt"
