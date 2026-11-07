#!/bin/sh
# Create the proxy's signing CA once, limited by X.509 name constraints to
# $CA_DOMAINS: browsers reject anything it signs for other names, and it can
# never sign IP addresses. Writes mitmproxy's confdir as the given user.
set -eu
. "$(dirname "$0")/env.sh"
USER_NAME="$1"
HOME_DIR="$(getent passwd "$USER_NAME" | cut -d: -f6)"
DIR="$HOME_DIR/.config/anssiscanvdns/mitm"
[ -f "$DIR/mitmproxy-ca.pem" ] && { echo "CA exists: $DIR"; exit 0; }

install -d -m 700 -o "$USER_NAME" "$HOME_DIR/.config/anssiscanvdns" "$DIR"
PERMIT=""
for d in $CA_DOMAINS; do PERMIT="${PERMIT}permitted;DNS:$d,"; done
TMP="$(mktemp -d)"
openssl req -x509 -newkey rsa:3072 -nodes -sha256 -days 3650 \
  -keyout "$TMP/ca.key" -out "$TMP/ca.crt" \
  -subj "/O=anssiscanvdns/CN=anssiscanvdns proxy CA ($CA_DOMAINS)" \
  -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
  -addext "keyUsage=critical,keyCertSign,cRLSign" \
  -addext "nameConstraints=critical,${PERMIT}excluded;IP:0.0.0.0/0.0.0.0,excluded;IP:0:0:0:0:0:0:0:0/0:0:0:0:0:0:0:0" \
  2>/dev/null
cat "$TMP/ca.key" "$TMP/ca.crt" > "$DIR/mitmproxy-ca.pem"
cp "$TMP/ca.crt" "$DIR/mitmproxy-ca-cert.pem"
rm -rf "$TMP"
chown -R "$USER_NAME" "$DIR"; chmod 600 "$DIR/mitmproxy-ca.pem"
install -m 644 "$DIR/mitmproxy-ca-cert.pem" "$ETC/ca.crt"
echo "CA created: $ETC/ca.crt"
