#!/usr/bin/env bash
# Which commit the deploy workflow puts on the hosted copy (WP-0.5; add-hosted-copy
# design, Decision 3, "Order"). Run in a checkout of main with its history:
#
#   scripts/hosting/pick-deploy.sh <commit running now, or ""> <the main commit this merge made>
#
# Prints "deploy <commit>" or "skip". GitHub keeps one run waiting per
# concurrency group and cancels it when another arrives, so every run deploys
# the newest tested commit rather than only its own: a merge whose run was
# cancelled still goes on with the next one. It skips when that commit is
# already running, or is older than the one running (merges finishing out of
# order, or a newer version put on by hand).
set -euo pipefail
running=${1:-}
newest=${2:-}
[[ "$newest" =~ ^[0-9a-f]{40}$ ]] || { echo "pick-deploy.sh: no tested commit on main to deploy (got \"$newest\")." >&2; exit 1; }
if [ "$newest" = "$running" ]; then
  echo skip
elif [ -n "$running" ] && git merge-base --is-ancestor "$newest" "$running" 2>/dev/null; then
  echo skip
else
  echo "deploy $newest"
fi
