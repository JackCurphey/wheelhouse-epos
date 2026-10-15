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
set -euo pipefail

NAME=wheelhouse-test
REGION=lon1
DROPLET_SIZE=s-1vcpu-1gb
DROPLET_IMAGE=ubuntu-24-04-x64
DB_NAME=${NAME}-db
DB_SIZE=db-s-1vcpu-1gb
DB_VERSION=16
SSH_KEY_FILE=${SSH_KEY_FILE:-$HOME/.ssh/id_ed25519}
HERE=$(cd "$(dirname "$0")" && pwd)

step() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nStopped: %s\n' "$*" >&2; exit 1; }

step "Checking your setup"
command -v doctl >/dev/null || fail "doctl isn't installed. Run: brew install doctl"
doctl account get >/dev/null 2>&1 || fail "doctl isn't signed in. Run: doctl auth init (and paste your API token)"
if [ ! -f "$SSH_KEY_FILE.pub" ]; then
  echo "No SSH key found at $SSH_KEY_FILE.pub; making one (press Enter at any questions)."
  ssh-keygen -t ed25519 -f "$SSH_KEY_FILE" -N ""
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
db_id=$(doctl databases list --format ID,Name --no-header | awk -v n="$DB_NAME" '$2==n {print $1}')
if [ -z "$db_id" ]; then
  echo "Creating it (this takes 5 to 10 minutes)..."
  db_id=$(doctl databases create "$DB_NAME" --engine pg --version "$DB_VERSION" --region "$REGION" \
    --size "$DB_SIZE" --num-nodes 1 --wait --format ID --no-header)
else
  echo "Already exists."
fi
if ! doctl databases db list "$db_id" --format Name --no-header | grep -qx epos; then
  doctl databases db create "$db_id" epos >/dev/null
fi
if ! doctl databases user list "$db_id" --format Name --no-header | grep -qx epos_app; then
  doctl databases user create "$db_id" epos_app >/dev/null
fi
if ! doctl databases firewalls list "$db_id" --format Value --no-header | grep -qx "$droplet_id"; then
  doctl databases firewalls append "$db_id" --rule "droplet:$droplet_id" >/dev/null
  echo "Only the server can reach the database."
fi
# The private address: the server and database share DigitalOcean's private
# network in London, so traffic never leaves it. Port 25060 is the direct
# connection; DigitalOcean's optional pools (25061) aren't used (server/db.js).
db_host=$(doctl databases connection "$db_id" --private --format Host --no-header)
db_port=$(doctl databases connection "$db_id" --private --format Port --no-header)
db_admin_pw=$(doctl databases connection "$db_id" --private --format Password --no-header)
app_pw=$(doctl databases user get "$db_id" epos_app --format Password --no-header)
ca_file=$(mktemp)
trap 'rm -f "$ca_file"' EXIT
doctl databases get-ca "$db_id" --format Certificate --no-header | base64 --decode > "$ca_file"

step "Installing the app on the server"
site="$(echo "$ip" | tr . -).sslip.io"
ssh_opts=(-i "$SSH_KEY_FILE" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)
echo "Waiting for the server to accept SSH..."
for _ in $(seq 1 30); do ssh "${ssh_opts[@]}" "root@$ip" true 2>/dev/null && break; sleep 10; done
ssh "${ssh_opts[@]}" "root@$ip" 'mkdir -p /opt/wheelhouse'
scp -q "${ssh_opts[@]}" "$HERE/compose.yml" "$HERE/Caddyfile" "root@$ip:/opt/wheelhouse/"
scp -q "${ssh_opts[@]}" "$ca_file" "root@$ip:/opt/wheelhouse/ca.crt"
ssh "${ssh_opts[@]}" "root@$ip" \
  "DB_HOST='$db_host' DB_PORT='$db_port' DB_ADMIN_PASSWORD='$db_admin_pw' APP_DB_PASSWORD='$app_pw' SITE_ADDRESS='$site' bash -s" \
  < "$HERE/remote-install.sh"

signup_code=$(ssh "${ssh_opts[@]}" "root@$ip" "grep '^SIGNUP_CODE=' /opt/wheelhouse/.env | cut -d= -f2")
cat <<DONE

All done. The test copy is at:

    https://$site

Sign up there with this code (keep it private; it's what stops strangers
making accounts):

    $signup_code

Photos and attachments aren't kept on the test copy for now.
DONE
