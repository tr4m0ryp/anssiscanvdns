#!/bin/sh
# Create a proxy signing CA once, limited by X.509 name constraints to its
# domains: browsers reject anything it signs for other names, and it can never
# sign IP addresses. Writes mitmproxy's confdir as the given user.
#   ca.sh <user>          main CA, $CA_DOMAINS, published as $ETC/ca.crt
#   ca.sh <user> social   social CA, $CA_SOCIAL_DOMAINS, as $ETC/ca-social.crt
set -eu
. "$(dirname "$0")/env.sh"
USER_NAME="$1"
HOME_DIR="$(getent passwd "$USER_NAME" | cut -d: -f6)"
DIR="$HOME_DIR/.config/anssiscanvdns/mitm"
if [ "${2:-}" = social ]; then
  NAME=social-ca; PUB=ca-social.crt; DOMAINS="$CA_SOCIAL_DOMAINS"; CN="anssiscanvdns social CA"
else
  NAME=mitmproxy-ca; PUB=ca.crt; DOMAINS="$CA_DOMAINS"; CN="anssiscanvdns proxy CA"
fi
[ -f "$DIR/$NAME.pem" ] && exit 0

install -d -m 700 -o "$USER_NAME" "$HOME_DIR/.config/anssiscanvdns" "$DIR"
PERMIT=""
for d in $DOMAINS; do PERMIT="${PERMIT}permitted;DNS:$d,"; done
TMP="$(mktemp -d)"
openssl req -x509 -newkey rsa:3072 -nodes -sha256 -days 3650 \
  -keyout "$TMP/ca.key" -out "$TMP/ca.crt" \
  -subj "/O=anssiscanvdns/CN=$CN ($DOMAINS)" \
  -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
  -addext "keyUsage=critical,keyCertSign,cRLSign" \
  -addext "nameConstraints=critical,${PERMIT}excluded;IP:0.0.0.0/0.0.0.0,excluded;IP:0:0:0:0:0:0:0:0/0:0:0:0:0:0:0:0" \
  2>/dev/null
cat "$TMP/ca.key" "$TMP/ca.crt" > "$DIR/$NAME.pem"
cp "$TMP/ca.crt" "$DIR/$NAME-cert.pem"
rm -rf "$TMP"
chown -R "$USER_NAME" "$DIR"; chmod 600 "$DIR/$NAME.pem"
install -m 644 "$DIR/$NAME-cert.pem" "$ETC/$PUB"
echo "CA created: $ETC/$PUB"
