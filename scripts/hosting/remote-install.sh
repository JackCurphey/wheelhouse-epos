#!/usr/bin/env bash
# Runs ON the hosted copy's server, as root, started by setup.sh over SSH
# (WP-0.5). setup.sh has already copied compose.yml, Caddyfile and the
# database's certificate (ca.crt) into /opt/wheelhouse, and passes the
# database details in the environment:
#   DB_HOST, DB_PORT, DB_ADMIN_PASSWORD, APP_DB_PASSWORD, SITE_ADDRESS
# Safe to run again: settings already written are kept, so the sign-up code
# and the Shopify encryption key don't change under a running copy.
set -euo pipefail

: "${DB_HOST:?}" "${DB_PORT:?}" "${DB_ADMIN_PASSWORD:?}" "${APP_DB_PASSWORD:?}" "${SITE_ADDRESS:?}"
cd /opt/wheelhouse

echo "Waiting for the server's first-boot setup to finish..."
cloud-init status --wait >/dev/null || true

# The app's login gets ordinary rights on the public schema, exactly as
# docker/init-db.sh does locally. It is not a superuser, so row-level
# security applies to it.
echo "Giving the app's database login its rights..."
PGPASSWORD="$DB_ADMIN_PASSWORD" PGSSLMODE=verify-full PGSSLROOTCERT=/opt/wheelhouse/ca.crt \
  psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U doadmin -d epos \
  -c "GRANT ALL ON SCHEMA public TO epos_app;"

if [ ! -f .env ]; then
  echo "Writing the server's settings (.env)..."
  app_pw=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$APP_DB_PASSWORD")
  umask 077
  cat > .env <<SETTINGS
# The hosted copy's settings (WP-0.5). Written once by remote-install.sh;
# never committed. Test data only: no texting keys, ever.
DATABASE_URL=postgres://epos_app:${app_pw}@${DB_HOST}:${DB_PORT}/epos
PGSSL=require
NODE_ENV=production
WHEELHOUSE_HOSTED_COPY=1
PORT=4000
TRUST_PROXY=1
SIGNUP_CODE=$(openssl rand -hex 6)
SHOPIFY_TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)
SITE_ADDRESS=${SITE_ADDRESS}
SETTINGS
else
  echo "Settings (.env) already exist; keeping them."
fi

echo "Fetching the latest main from GitHub..."
if [ -d app/.git ]; then
  git -C app fetch --quiet origin main
  git -C app checkout --quiet --force origin/main
else
  git clone --quiet --depth 1 --branch main https://github.com/JackCurphey/wheelhouse-epos.git app
fi

echo "Building and starting the app (the first build takes several minutes)..."
docker compose up -d --build

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
