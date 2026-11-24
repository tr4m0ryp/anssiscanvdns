#!/bin/sh
# Issue the TLS certificates Caddy presents for the proxied hosts (and their
# subdomains). Hosts under $CA_SOCIAL_DOMAINS get proxy-social.crt from the
# social CA, every other host proxy.crt from the main CA, so each certificate
# stays inside its CA's name constraints. Re-issued when a host list in
# rules/http.json changes or within 60 days of expiry; Caddy is reloaded.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
. "$HERE/env.sh"
OWNER_HOME="$(getent passwd "$(stat -c %U "$ROOT")" | cut -d: -f6)"
MITM="$OWNER_HOME/.config/anssiscanvdns/mitm"
DIR="$ETC/tls"
install -d -m 750 -g caddy "$DIR"

# Hosts of one CA: `main` or `social`, split by $CA_SOCIAL_DOMAINS.
hosts_for() {
  python3 - "$ROOT/rules/http.json" "$1" "$CA_SOCIAL_DOMAINS" <<'PY'
import json, sys
hosts = json.load(open(sys.argv[1]))["hosts"]
social = sys.argv[3].split()
is_social = lambda h: any(h == d or h.endswith("." + d) for d in social)
print(" ".join(h for h in hosts if is_social(h) == (sys.argv[2] == "social")))
PY
}

# issue <name> <ca.pem> <hosts...>: write $DIR/<name>.crt/.key when needed.
issue() {
  NAME="$1"; CA="$2"; shift 2
  [ $# -gt 0 ] || { rm -f "$DIR/$NAME.crt" "$DIR/$NAME.key" "$DIR/$NAME.san"; return 0; }
  SAN="$(for h in "$@"; do printf 'DNS:%s,DNS:*.%s,' "$h" "$h"; done | sed 's/,$//')"
  if [ -f "$DIR/$NAME.crt" ] && [ "$(cat "$DIR/$NAME.san" 2>/dev/null)" = "$SAN" ] \
     && openssl x509 -in "$DIR/$NAME.crt" -noout -checkend $((60 * 86400)) >/dev/null; then
    return 0
  fi
  TMP="$(mktemp -d)"
  openssl req -new -newkey rsa:2048 -nodes -keyout "$TMP/k" -out "$TMP/csr" -subj "/CN=$1" 2>/dev/null
  printf 'subjectAltName=%s\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n' "$SAN" > "$TMP/ext"
  openssl x509 -req -in "$TMP/csr" -CA "$CA" -CAkey "$CA" -CAcreateserial -CAserial "$TMP/srl" \
    -days 397 -sha256 -extfile "$TMP/ext" -out "$TMP/crt" 2>/dev/null
  install -m 644 -g caddy "$TMP/crt" "$DIR/$NAME.crt"
  install -m 640 -g caddy "$TMP/k" "$DIR/$NAME.key"
  echo "$SAN" > "$DIR/$NAME.san"
  rm -rf "$TMP"
  CHANGED=1
  echo "anssis: $NAME certificate issued for $SAN"
}

# The main CA's state file was `san` before the split; carry it over.
[ -f "$DIR/san" ] && [ ! -f "$DIR/proxy.san" ] && mv "$DIR/san" "$DIR/proxy.san"
CHANGED=0
# shellcheck disable=SC2046
issue proxy "$MITM/mitmproxy-ca.pem" $(hosts_for main)
# shellcheck disable=SC2046
issue proxy-social "$MITM/social-ca.pem" $(hosts_for social)
[ "$CHANGED" = 1 ] && { systemctl reload caddy 2>/dev/null || true; }
exit 0
