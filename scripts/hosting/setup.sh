#!/usr/bin/env bash
# Sets up the hosted test copy on DigitalOcean in London (WP-0.5). Jack runs
# this on his own Mac, following docs/runbooks/hosted-copy.md, after
# `doctl auth init`. It creates only what doesn't exist yet, so if it stops
# part way, run it again and it carries on.
#
# What it makes (about £20 a month with VAT, billed by DigitalOcean):
#   - a 1GB server ("droplet") with Docker and Caddy, about $6 a month
#   - a managed Postgres database, smallest plan, about $15 a month
#   - a firewall (web and SSH only) and database access for that server only
# It also sets up automatic updates (task 3.4): a deploy-only key that can run
# deploy.sh on the server and nothing else, and the settings GitHub's deploy
# workflow (.github/workflows/deploy-hosted-copy.yml) needs, set with `gh`.
set -euo pipefail

NAME=wheelhouse-test
REGION=lon1
DROPLET_SIZE=s-1vcpu-1gb
DROPLET_IMAGE=ubuntu-24-04-x64
DB_NAME=${NAME}-db
DB_SIZE=db-s-1vcpu-1gb
DB_VERSION=16
SSH_KEY_FILE=${SSH_KEY_FILE:-$HOME/.ssh/id_ed25519}
DEPLOY_KEY_FILE=${DEPLOY_KEY_FILE:-$HOME/.ssh/wheelhouse-deploy}
REPO=JackCurphey/wheelhouse-epos
HERE=$(cd "$(dirname "$0")" && pwd)

step() { printf '\n==> %s\n' "$*"; }
# doctl 2.0 (Oct 2026) dropped --format from some database commands and masks
# database passwords unless --show is passed, so database answers are read
# as JSON, with --show, and picked out with jq (in macOS since 15; brew install jq).
# Usage: db_field <field> <doctl databases arguments...>; prints the field of
# every item, one per line.
db_field() {
  local field=$1; shift
  doctl databases "$@" -o json --show | jq -r --arg f "$field" '(if type == "array" then .[] else . end) | .[$f] // empty'
}
fail() { printf '\nStopped: %s\n' "$*" >&2; exit 1; }

step "Checking your setup"
command -v doctl >/dev/null || fail "doctl isn't installed. Run: brew install doctl"
command -v jq >/dev/null || fail "jq isn't installed. Run: brew install jq"
doctl account get >/dev/null 2>&1 || fail "doctl isn't signed in. Run: doctl auth init (and paste your API token)"
command -v gh >/dev/null || fail "GitHub's gh isn't installed. Run: brew install gh"
gh auth status >/dev/null 2>&1 || fail "gh isn't signed in to GitHub. Run: gh auth login"
if [ ! -f "$SSH_KEY_FILE.pub" ]; then
  echo "No SSH key found at $SSH_KEY_FILE.pub; making one (press Enter at any questions)."
  ssh-keygen -t ed25519 -f "$SSH_KEY_FILE" -N ""
fi
if [ ! -f "$DEPLOY_KEY_FILE.pub" ]; then
  echo "Making the key GitHub uses for automatic updates, at $DEPLOY_KEY_FILE."
  ssh-keygen -q -t ed25519 -f "$DEPLOY_KEY_FILE" -N "" -C wheelhouse-deploy
fi
echo "Signed in to DigitalOcean as $(doctl account get --format Email --no-header)."

cat <<INFO

This creates the Wheelhouse test copy in DigitalOcean's London region:
  - a server (${DROPLET_SIZE}), about \$6 a month
  - a managed Postgres database (${DB_SIZE}), about \$15 a month
Roughly £20 a month with VAT, charged to your DigitalOcean account until
you delete them. Things that already exist are reused, not created twice.
INFO
read -r -p "Type yes to continue: " answer
[ "$answer" = "yes" ] || fail "nothing was created."

step "Your SSH key"
fingerprint=$(ssh-keygen -l -E md5 -f "$SSH_KEY_FILE.pub" | awk '{print $2}' | sed 's/^MD5://')
if ! doctl compute ssh-key list --format FingerPrint --no-header | grep -qx "$fingerprint"; then
  doctl compute ssh-key import "$NAME-$(whoami)" --public-key-file "$SSH_KEY_FILE.pub" >/dev/null
  echo "Added your SSH key to DigitalOcean."
else
  echo "Already there."
fi

step "The server"
droplet_id=$(doctl compute droplet list --format ID,Name --no-header | awk -v n="$NAME" '$2==n {print $1}')
if [ -z "$droplet_id" ]; then
  echo "Creating it (about a minute)..."
  droplet_id=$(doctl compute droplet create "$NAME" --region "$REGION" --size "$DROPLET_SIZE" \
    --image "$DROPLET_IMAGE" --ssh-keys "$fingerprint" --user-data-file "$HERE/cloud-init.yaml" \
    --tag-names "$NAME" --enable-monitoring --wait --format ID --no-header)
else
  echo "Already exists."
fi
ip=$(doctl compute droplet get "$droplet_id" --format PublicIPv4 --no-header)
echo "Server address: $ip"
# DigitalOcean reuses addresses: forget any old server this Mac saw there.
ssh-keygen -R "$ip" >/dev/null 2>&1 || true

step "The firewall (web and SSH only)"
if ! doctl compute firewall list --format Name --no-header | grep -qx "$NAME"; then
  everywhere="address:0.0.0.0/0,address:::/0"
  doctl compute firewall create --name "$NAME" --tag-names "$NAME" \
    --inbound-rules "protocol:tcp,ports:22,$everywhere protocol:tcp,ports:80,$everywhere protocol:tcp,ports:443,$everywhere" \
    --outbound-rules "protocol:tcp,ports:all,$everywhere protocol:udp,ports:all,$everywhere protocol:icmp,$everywhere" >/dev/null
  echo "Created."
else
  echo "Already exists."
fi

step "The database"
db_id=$(doctl databases list -o json | jq -r --arg n "$DB_NAME" '.[] | select(.name == $n) | .id')
if [ -z "$db_id" ]; then
  echo "Creating it (this takes 5 to 10 minutes)..."
  db_id=$(db_field id create "$DB_NAME" --engine pg --version "$DB_VERSION" --region "$REGION" \
    --size "$DB_SIZE" --num-nodes 1 --wait)
else
  echo "Already exists."
fi
if ! db_field name db list "$db_id" | grep -qx epos; then
  doctl databases db create "$db_id" epos >/dev/null
fi
if ! db_field name user list "$db_id" | grep -qx epos_app; then
  doctl databases user create "$db_id" epos_app >/dev/null
fi
if ! db_field value firewalls list "$db_id" | grep -qx "$droplet_id"; then
  doctl databases firewalls append "$db_id" --rule "droplet:$droplet_id" >/dev/null
  echo "Only the server can reach the database."
fi
# The database's public address, which its certificate is sure to cover (the
# app checks the certificate's name). Only the server may connect: the
# trusted-source rule above. Port 25060 is the direct connection;
# DigitalOcean's optional pools (25061) aren't used (server/db.js).
db_host=$(db_field host connection "$db_id")
db_port=$(db_field port connection "$db_id")
db_admin_pw=$(db_field password connection "$db_id")
app_pw=$(db_field password user get "$db_id" epos_app)
# A masked password would install an app that can't reach its database.
for pw in "$db_admin_pw" "$app_pw"; do
  case "$pw" in ''|'********') fail "doctl didn't give the database passwords. Run it again; if it stops here twice, ask Mark." ;; esac
done
ca_file=$(mktemp)
trap 'rm -f "$ca_file"' EXIT
db_field certificate get-ca "$db_id" | base64 --decode > "$ca_file"

step "Installing the app on the server"
site="$(echo "$ip" | tr . -).sslip.io"
ssh_opts=(-i "$SSH_KEY_FILE" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)
echo "Waiting for the server to accept SSH..."
for _ in $(seq 1 30); do ssh "${ssh_opts[@]}" "root@$ip" true 2>/dev/null && break; sleep 10; done
ssh "${ssh_opts[@]}" "root@$ip" 'mkdir -p /opt/wheelhouse'
scp -q "${ssh_opts[@]}" "$HERE/compose.yml" "$HERE/Caddyfile" "$HERE/deploy.sh" "root@$ip:/opt/wheelhouse/"
scp -q "${ssh_opts[@]}" "$ca_file" "root@$ip:/opt/wheelhouse/ca.crt"
ssh "${ssh_opts[@]}" "root@$ip" 'chmod 644 /opt/wheelhouse/ca.crt && chmod 755 /opt/wheelhouse/deploy.sh'
# The database details go in on standard input, not the command line, so no
# password shows up in a process list on either machine.
{
  printf 'export DB_HOST=%q DB_PORT=%q DB_ADMIN_PASSWORD=%q APP_DB_PASSWORD=%q SITE_ADDRESS=%q DEPLOY_PUBLIC_KEY=%q\n' \
    "$db_host" "$db_port" "$db_admin_pw" "$app_pw" "$site" "$(cat "$DEPLOY_KEY_FILE.pub")"
  cat "$HERE/remote-install.sh"
} | ssh "${ssh_opts[@]}" "root@$ip" 'bash -s'

step "Automatic updates (GitHub)"
# The server's own host key, read over the SSH login above, so GitHub only
# ever talks to this server.
host_key=$(ssh "${ssh_opts[@]}" "root@$ip" 'cat /etc/ssh/ssh_host_ed25519_key.pub' | awk '{print $1" "$2}')
[ -n "$host_key" ] || fail "couldn't read the server's host key. Run it again; if it stops here twice, ask Mark."
gh secret set HOSTED_COPY_SSH_KEY --repo "$REPO" < "$DEPLOY_KEY_FILE" >/dev/null
gh variable set HOSTED_COPY_HOST --body "$ip" --repo "$REPO" >/dev/null
gh variable set HOSTED_COPY_URL --body "https://$site" --repo "$REPO" >/dev/null
gh variable set HOSTED_COPY_KNOWN_HOSTS --body "$ip $host_key" --repo "$REPO" >/dev/null
echo "GitHub can now update the test copy after every merge to main."
# Public means the server can download it without a password, so ask the
# registry exactly that, signed in as nobody. (gh's own package lookup needs
# a permission gh usually isn't given, and answers "not found" without it.)
package_is_public() {
  local token
  token=$(curl -fsS -m 10 "https://ghcr.io/token?scope=repository:jackcurphey/wheelhouse-epos:pull" | jq -r '.token // empty') || return 1
  [ -n "$token" ] || return 1
  curl -fsS -m 10 -o /dev/null -H "Authorization: Bearer $token" "https://ghcr.io/v2/jackcurphey/wheelhouse-epos/tags/list"
}
if ! package_is_public; then
  cat <<PACKAGE

One more thing, once: the server downloads each update from GitHub without a
password, so the app's package on GitHub must be public (the code already
is). It appears after the first automatic update has run; then open
  https://github.com/users/${REPO%%/*}/packages/container/wheelhouse-epos/settings
choose "Change visibility", then Public, and re-run the failed update from
the Actions tab. docs/runbooks/hosted-copy.md, "Automatic updates", has it
step by step.
PACKAGE
fi

signup_code=$(ssh "${ssh_opts[@]}" "root@$ip" "grep '^SIGNUP_CODE=' /opt/wheelhouse/.env | cut -d= -f2")
cat <<DONE

All done. The test copy is at:

    https://$site

Sign up there with this code (keep it private; it's what stops strangers
making accounts):

    $signup_code

Photos and attachments aren't kept on the test copy for now.
DONE
