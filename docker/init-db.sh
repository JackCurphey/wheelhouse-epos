#!/bin/sh
# Runs once, automatically, when the postgres container's data volume is
# empty. Creates epos_app as an ordinary (non-superuser) role - critical,
# not cosmetic: the official postgres image's bootstrap POSTGRES_USER
# becomes the actual Postgres superuser, and superusers always bypass Row-
# Level Security regardless of FORCE ROW LEVEL SECURITY. If the app
# connected as that bootstrap user, every RLS policy in
# server/migrations/001_init_schema.sql would be silently ignored and shop
# isolation would be gone. So POSTGRES_USER stays a separate
# internal-only superuser (never used by the app), and this script creates
# the real app role exactly the way it was created by hand for the native
# Postgres install: a plain LOGIN role with no elevated privileges beyond
# what it's explicitly granted on the public schema.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE epos_app WITH LOGIN PASSWORD '$EPOS_APP_PASSWORD';
  GRANT ALL ON SCHEMA public TO epos_app;
EOSQL
