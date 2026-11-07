#!/bin/sh
# One-shot, idempotent server setup. Run from the repo checkout:
#   sudo sh deploy/server/install.sh
# Installs dnsmasq + mitmproxy, creates the name-constrained CA and the proxy
# certificate, the systemd units, and the Caddy sites (DoH endpoint, CA
# download, editor, proxied hosts). The optional WireGuard tunnel is kept if
# it already exists; add tunnel clients with add-peer.sh.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
. "$HERE/env.sh"
OWNER="$(stat -c %U "$ROOT")"
OWNER_HOME="$(getent passwd "$OWNER" | cut -d: -f6)"

echo "== packages"
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq dnsmasq-base python3-venv openssl wireguard-tools >/dev/null
if [ ! -x "$ROOT/.venv/bin/mitmdump" ]; then
  runuser -u "$OWNER" -- python3 -m venv "$ROOT/.venv"
  runuser -u "$OWNER" -- "$ROOT/.venv/bin/pip" install -q --upgrade pip mitmproxy
fi

echo "== CA and proxy certificate"
install -d -m 755 "$ETC"
sh "$HERE/ca.sh" "$OWNER"
sh "$HERE/leaf.sh"

echo "== dnsmasq rules"
install -m 644 "$HERE/dnsmasq.conf" "$ETC/dnsmasq.conf"
python3 "$ROOT/tools/gen_dnsmasq.py" "$ROOT" "$PUBLIC_IP" > "$ETC/dnsmasq.rules.conf"

echo "== systemd units"
for f in "$HERE"/units/*; do
  sed -e "s|@USER@|$OWNER|g" -e "s|@HOME@|$OWNER_HOME|g" -e "s|@ROOT@|$ROOT|g" \
      -e "s|@MITM_PORT@|$MITM_PORT|g" -e "s|@DOH_PORT@|$DOH_PORT|g" \
      -e "s|@ADMIN_PORT@|$ADMIN_PORT|g" -e "s|@PUBLIC_HOST@|$PUBLIC_HOST|g" \
      "$f" > "/etc/systemd/system/$(basename "$f")"
done
systemctl daemon-reload
systemctl enable --now anssis-dns anssis-doh anssis-proxy anssis-admin anssis-sync.timer >/dev/null 2>&1
systemctl restart anssis-dns anssis-doh anssis-proxy anssis-admin

echo "== Caddy (public side)"
if command -v ufw >/dev/null && ufw status | grep -q active; then
  ufw allow 80/tcp >/dev/null; ufw allow 443 >/dev/null
fi
sh "$HERE/caddy.sh"

echo "== done"
echo "DoH URL:  https://$PUBLIC_HOST/dns-query"
echo "CA cert:  https://$PUBLIC_HOST/ca.crt"
echo "Editor:   https://$PUBLIC_HOST/  (user anssis)"
