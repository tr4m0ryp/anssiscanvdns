#!/bin/sh
# Issue the TLS certificate Caddy presents for the proxied hosts (and their
# subdomains), signed by the name-constrained CA. Re-issued when the host list
# in rules/http.json changes or within 60 days of expiry; Caddy is reloaded.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
. "$HERE/env.sh"
OWNER_HOME="$(getent passwd "$(stat -c %U "$ROOT")" | cut -d: -f6)"
CA="$OWNER_HOME/.config/anssiscanvdns/mitm/mitmproxy-ca.pem"
DIR="$ETC/tls"
HOSTS="$(python3 -c 'import json,sys; print(" ".join(json.load(open(sys.argv[1]))["hosts"]))' "$ROOT/rules/http.json")"
SAN="$(for h in $HOSTS; do printf 'DNS:%s,DNS:*.%s,' "$h" "$h"; done | sed 's/,$//')"

install -d -m 750 -g caddy "$DIR"
if [ -f "$DIR/proxy.crt" ] && [ "$(cat "$DIR/san" 2>/dev/null)" = "$SAN" ] \
   && openssl x509 -in "$DIR/proxy.crt" -noout -checkend $((60 * 86400)) >/dev/null; then
  exit 0
fi
TMP="$(mktemp -d)"
openssl req -new -newkey rsa:2048 -nodes -keyout "$TMP/k" -out "$TMP/csr" -subj "/CN=$(echo "$HOSTS" | cut -d' ' -f1)" 2>/dev/null
printf 'subjectAltName=%s\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n' "$SAN" > "$TMP/ext"
openssl x509 -req -in "$TMP/csr" -CA "$CA" -CAkey "$CA" -CAcreateserial -CAserial "$TMP/srl" \
  -days 397 -sha256 -extfile "$TMP/ext" -out "$TMP/crt" 2>/dev/null
install -m 644 -g caddy "$TMP/crt" "$DIR/proxy.crt"
install -m 640 -g caddy "$TMP/k" "$DIR/proxy.key"
echo "$SAN" > "$DIR/san"
rm -rf "$TMP"
systemctl reload caddy 2>/dev/null || true
echo "anssis: proxy certificate issued for $SAN"
