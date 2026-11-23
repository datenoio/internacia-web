#!/bin/bash
# One-time, idempotent server setup for deploying internacia.io (SPEC §11.4). Run as root on the
# server, from a copy of this directory:
#   ./setup.sh <public key file of the GitHub Actions deploy key>
#
# Creates the user internacia-deploy (no password, its key runs only internacia-receive),
# /srv/internacia/releases, and installs /usr/local/bin/internacia-receive. It does not touch
# Caddy: mounting /srv/internacia into the Caddy container and the site block are manual steps
# in README.md, because that Caddy also serves other sites.
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }
[[ $# -eq 1 && -f $1 ]] || { echo "usage: $0 <deploy-key.pub>" >&2; exit 1; }
key=$(tr -d '\r' <"$1")
[[ $key =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ .*)?$ ]] || { echo "expected one ssh-ed25519 public key" >&2; exit 1; }
here=$(cd "$(dirname "$0")" && pwd)

user=internacia-deploy
home=/var/lib/$user
if ! id "$user" >/dev/null 2>&1; then
	useradd --system --home-dir "$home" --create-home --shell /bin/bash --user-group "$user"
fi
# The forced command needs a login shell; the account has no password and no other key.
passwd -l "$user" >/dev/null

# authorized_keys belongs to root, so the deploy user cannot change its own key or command.
install -d -o root -g root -m 755 "$home/.ssh"
printf 'restrict,command="/usr/local/bin/internacia-receive" %s\n' "$key" >"$home/.ssh/authorized_keys.new"
chmod 644 "$home/.ssh/authorized_keys.new"
mv -f "$home/.ssh/authorized_keys.new" "$home/.ssh/authorized_keys"

install -o root -g root -m 755 "$here/internacia-receive" /usr/local/bin/internacia-receive
install -d -o "$user" -g "$user" -m 755 /srv/internacia /srv/internacia/releases

echo "ok: $user, /srv/internacia, /usr/local/bin/internacia-receive"
