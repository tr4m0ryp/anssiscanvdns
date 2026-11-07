#!/bin/sh
# Pull rule edits pushed to GitHub, then regenerate dnsmasq's rules and
# restart it only when they changed. HTTP rules need nothing here: the proxy
# hot-reloads them. Runs as root from the sync timer.
set -eu
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
. "$ROOT/deploy/server/env.sh"
OWNER="$(stat -c %U "$ROOT")"

runuser -u "$OWNER" -- git -C "$ROOT" pull -q --ff-only --autostash origin main || \
  echo "anssis-sync: git pull failed, using the local checkout" >&2

NEW="$ETC/dnsmasq.rules.conf.new"
if python3 "$ROOT/tools/gen_dnsmasq.py" "$ROOT" "$WG_IP" > "$NEW"; then
  if ! cmp -s "$NEW" "$ETC/dnsmasq.rules.conf"; then
    mv "$NEW" "$ETC/dnsmasq.rules.conf"
    systemctl restart anssis-dns.service
    echo "anssis-sync: DNS rules changed, resolver restarted"
  else
    rm -f "$NEW"
  fi
else
  rm -f "$NEW"
  echo "anssis-sync: rules invalid, keeping the live DNS config" >&2
fi
