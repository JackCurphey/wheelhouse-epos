#!/usr/bin/env bash
# Waits for the hosted copy's /healthz to answer ok with a commit (WP-0.5;
# add-hosted-copy design, Decision 3, "Watching to the end"):
#
#   scripts/hosting/wait-healthy.sh <https://site> <commit> <seconds>
#
# Counted by the clock, not by tries, so a slow answer can't stretch the wait
# past what the design and runbook promise. Fails when the time is up.
set -euo pipefail
site=$1 commit=$2 seconds=$3
interval=${WAIT_INTERVAL:-10}
deadline=$(( $(date +%s) + seconds ))
body=""
while :; do
  left=$(( deadline - $(date +%s) ))
  [ "$left" -gt 0 ] || break
  body=$(curl -fsS -m "$(( left < 10 ? left : 10 ))" "$site/healthz" || true)
  if [ "$(jq -r '.status' <<<"$body" 2>/dev/null)" = ok ] && [ "$(jq -r '.commit' <<<"$body" 2>/dev/null)" = "$commit" ]; then
    echo "Deployed: $body"
    exit 0
  fi
  sleep "$interval"
done
echo "::error::The hosted copy didn't answer ok with $commit within $seconds seconds. Last answer: ${body:-none}"
exit 1
