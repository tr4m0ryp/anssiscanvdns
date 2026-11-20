#!/bin/sh
# Copy Caddy's certificate for DOT_HOST to where dnsdist can read it, and
# restart dnsdist when it changed. Run by anssis-dot-cert.path when Caddy
# renews, by a daily timer as a fallback, and by dot.sh at install.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
. "$HERE/env.sh"
DST="$ETC/dot"

# Newest copy across ACME issuers (Caddy may fall back to another CA).
CRT="$(ls -t "$CADDY_CERTS"/*/"$DOT_HOST/$DOT_HOST.crt" 2>/dev/null | head -n 1 || true)"
if [ -z "$CRT" ]; then
  echo "anssis-dot: Caddy has no certificate for $DOT_HOST yet" >&2
  exit 0
fi
KEY="${CRT%.crt}.key"

# Caddy writes the certificate and key as two files; wait until they match.
tries=0
until [ -f "$KEY" ] && [ "$(openssl x509 -in "$CRT" -noout -pubkey)" = "$(openssl pkey -in "$KEY" -pubout)" ]; do
  tries=$((tries + 1))
  if [ "$tries" -ge 10 ]; then echo "anssis-dot: key does not match certificate yet" >&2; exit 0; fi
  sleep 2
done

if cmp -s "$CRT" "$DST/cert.pem" && cmp -s "$KEY" "$DST/key.pem"; then
  systemctl is-active -q dnsdist || systemctl restart dnsdist
  exit 0
fi
install -d -m 750 -g _dnsdist "$DST"
install -m 640 -g _dnsdist "$CRT" "$DST/cert.pem.new"
install -m 640 -g _dnsdist "$KEY" "$DST/key.pem.new"
mv "$DST/cert.pem.new" "$DST/cert.pem"
mv "$DST/key.pem.new" "$DST/key.pem"
systemctl restart dnsdist
echo "anssis-dot: certificate for $DOT_HOST installed, dnsdist restarted"
