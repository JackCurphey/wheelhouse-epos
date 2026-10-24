#!/usr/bin/env bash
# Runs ON the hosted copy's server, as root, started by setup.sh over SSH
# (WP-0.5). setup.sh has already copied compose.yml, Caddyfile and the
# database's certificate (ca.crt) and deploy.sh into /opt/wheelhouse, and
# passes these as exported variables ahead of this script on stdin:
#   DB_HOST, DB_PORT, DB_ADMIN_PASSWORD, APP_DB_PASSWORD, SITE_ADDRESS,
#   DEPLOY_PUBLIC_KEY (the public half of GitHub's deploy-only key)
# Safe to run again: the sign-up code and the Shopify encryption key are
# kept; everything else is refreshed.
set -euo pipefail

: "${DB_HOST:?}" "${DB_PORT:?}" "${DB_ADMIN_PASSWORD:?}" "${APP_DB_PASSWORD:?}" "${SITE_ADDRESS:?}" "${DEPLOY_PUBLIC_KEY:?}"
# One line, a plain ed25519 key: anything else could slip extra options into
# authorized_keys below.
[[ "$DEPLOY_PUBLIC_KEY" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ [A-Za-z0-9@._-]+)?$ ]] \
  || { echo "The deploy key doesn't look like an ed25519 public key." >&2; exit 1; }
# Both overridable only so the tests can run this in a scratch folder.
DIR=${WHEELHOUSE_DIR:-/opt/wheelhouse}
AUTHORIZED_KEYS=${AUTHORIZED_KEYS:-/root/.ssh/authorized_keys}
cd "$DIR"

echo "Waiting for the server's first-boot setup to finish..."
cloud-init status --wait >/dev/null || true

# The app's login gets ordinary rights on the public schema, exactly as
# docker/init-db.sh does locally. It is not a superuser, so row-level
# security applies to it.
admin_psql() {
  PGPASSWORD="$DB_ADMIN_PASSWORD" PGSSLMODE=verify-full PGSSLROOTCERT=/opt/wheelhouse/ca.crt \
    psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U doadmin -d epos "$@" </dev/null
}
echo "Giving the app's database login its rights..."
# The database's rule letting this server in can take a moment to apply.
for attempt in $(seq 1 12); do
  admin_psql -qc "GRANT ALL ON SCHEMA public TO epos_app;" && break
  [ "$attempt" = 12 ] && { echo "Couldn't reach the database to set up the app's login." >&2; exit 1; }
  echo "  the database isn't accepting this server yet; trying again in 10 seconds..."
  sleep 10
done
# A grant that wasn't allowed only warns, so check it really took.
[ "$(admin_psql -tAc "SELECT has_schema_privilege('epos_app', 'public', 'CREATE')")" = t ] \
  || { echo "The app's login didn't get its rights on the database." >&2; exit 1; }

# The two secrets are made once and kept, so the sign-up code and the
# Shopify encryption key don't change under a running copy. Everything else
# is rewritten every run, so a recreated database or address is picked up.
keep() { [ -f .env ] && grep "^$1=" .env | cut -d= -f2- || true; }
signup_code=$(keep SIGNUP_CODE); signup_code=${signup_code:-$(openssl rand -hex 6)}
shopify_key=$(keep SHOPIFY_TOKEN_ENCRYPTION_KEY); shopify_key=${shopify_key:-$(openssl rand -hex 32)}
# What's running now, which this run replaces (written down below).
was_image=$(keep WHEELHOUSE_IMAGE | tail -n 1); was_commit=$(keep WHEELHOUSE_COMMIT | tail -n 1)
echo "Fetching the latest main from GitHub..."
if [ -d app/.git ]; then
  git -C app fetch --quiet origin main
  git -C app checkout --quiet --force origin/main
else
  git clone --quiet --depth 1 --branch main https://github.com/JackCurphey/wheelhouse-epos.git app
fi
commit=$(git -C app rev-parse HEAD)

app_pw=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$APP_DB_PASSWORD")
echo "Writing the server's settings (.env)..."
umask 077
cat > .env <<SETTINGS
# The hosted copy's settings (WP-0.5), written by remote-install.sh; never
# committed. Test data only: no texting keys, ever.
DATABASE_URL=postgres://epos_app:${app_pw}@${DB_HOST}:${DB_PORT}/epos
PGSSL=require
NODE_ENV=production
WHEELHOUSE_HOSTED_COPY=1
PORT=4000
TRUST_PROXY=1
APP_PUBLIC_URL=https://${SITE_ADDRESS}
SIGNUP_CODE=${signup_code}
SHOPIFY_TOKEN_ENCRYPTION_KEY=${shopify_key}
SITE_ADDRESS=${SITE_ADDRESS}
# What's running: the image built below, from this commit. deploy.sh changes
# these two when GitHub deploys a merge; /healthz shows the commit.
WHEELHOUSE_IMAGE=wheelhouse-app:current
WHEELHOUSE_COMMIT=${commit}
SETTINGS
# The time, for a restore (runbook section D), as deploy.sh writes it.
printf '%s setup %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$commit" >> deploys.log
# The version deploy.sh rollback goes back to: what this run replaced, when
# that was a downloaded image, kept by its commit. The image built here is
# rebuilt in place below, so it can't come back as it was: nothing to go back
# to then, rather than an older record (fresh review, 24 Oct).
case "$was_image" in
  ghcr.io/*) printf 'WHEELHOUSE_IMAGE=%s\nWHEELHOUSE_COMMIT=%s\n' "$was_image" "$was_commit" > release.previous ;;
  *) rm -f release.previous ;;
esac

# GitHub's deploy-only key may run deploy.sh and nothing else: no shell, no
# forwarding (restrict). An older deploy key is replaced; other keys stay.
echo "Letting GitHub's automatic updates in (deploy.sh only)..."
mkdir -p "$(dirname "$AUTHORIZED_KEYS")"
touch "$AUTHORIZED_KEYS"
{ grep -v -F 'command="/opt/wheelhouse/deploy.sh"' "$AUTHORIZED_KEYS" || true
  printf 'restrict,command="/opt/wheelhouse/deploy.sh" %s\n' "$DEPLOY_PUBLIC_KEY"; } > "$AUTHORIZED_KEYS.new"
chmod 600 "$AUTHORIZED_KEYS.new"
mv "$AUTHORIZED_KEYS.new" "$AUTHORIZED_KEYS"

echo "Building and starting the app (the first build takes several minutes)..."
docker compose up -d --build </dev/null
docker image prune -f >/dev/null

echo "Waiting for the app to say it's healthy..."
for _ in $(seq 1 60); do
  if curl -fsS "https://${SITE_ADDRESS}/healthz" >/dev/null 2>&1; then
    echo "The app is up at https://${SITE_ADDRESS}"
    exit 0
  fi
  sleep 10
done
echo "The app didn't answer within 10 minutes. Recent logs:" >&2
docker compose logs --tail 50 app caddy >&2
exit 1
