#!/bin/sh
# Makes a database of your own on the compose Postgres, for this worktree or a
# review (split plan §4.2, rule 1). See scripts/dev/new-db.mjs.
#   scripts/new-db.sh <name>
exec node "$(dirname "$0")/dev/new-db.mjs" "$@"
