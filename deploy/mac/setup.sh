#!/bin/sh
# Connect this Mac to the anssiscanvdns resolver on the workstation.
#   sh deploy/mac/setup.sh [ssh-host] [peer-name]
# Fetches the tunnel config and the proxy CA, trusts the CA (name-constrained
# to the intercepted domains), installs wireguard-tools, and keeps the tunnel
# up across reboots with a LaunchDaemon. Asks for the sudo password once.
set -eu
HOST="${1:-claude-ws}"
PEER="${2:-mac}"
BREW_PREFIX="$(brew --prefix)"
CONF_DIR="$BREW_PREFIX/etc/wireguard"
CONF="$CONF_DIR/anssis.conf"
LABEL="com.anssiscanvdns.wireguard"
PLIST="/Library/LaunchDaemons/$LABEL.plist"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

echo "== fetching config and CA from $HOST"
ssh "$HOST" "sudo cat /etc/anssiscanvdns/peers/$PEER.conf" > "$TMP/anssis.conf"
ssh "$HOST" "cat /etc/anssiscanvdns/ca.crt" > "$TMP/ca.crt"
openssl x509 -in "$TMP/ca.crt" -noout -ext nameConstraints

echo "== wireguard-tools"
command -v wg-quick >/dev/null || brew install -q wireguard-tools

echo "== trusting the proxy CA (System keychain)"
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "$TMP/ca.crt"

echo "== tunnel config -> $CONF"
sudo mkdir -p "$CONF_DIR"
sudo install -m 600 "$TMP/anssis.conf" "$CONF"

echo "== LaunchDaemon (tunnel up at boot)"
sudo tee "$PLIST" >/dev/null <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array><string>$BREW_PREFIX/bin/wg-quick</string><string>up</string><string>$CONF</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$BREW_PREFIX/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>StandardErrorPath</key><string>/var/log/anssiscanvdns-wg.log</string>
</dict></plist>
PL
sudo "$BREW_PREFIX/bin/wg-quick" down "$CONF" 2>/dev/null || true
sudo launchctl bootout system "$PLIST" 2>/dev/null || true
sudo launchctl bootstrap system "$PLIST"
sleep 3
sudo wg show
echo "== done. Off switch: sudo wg-quick down $CONF"
