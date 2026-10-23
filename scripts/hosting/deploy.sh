#!/usr/bin/env bash
# Runs ON the hosted copy's server, as root (WP-0.5 task 3.4; add-hosted-copy
# design, Decision 3). GitHub's deploy workflow reaches it over SSH with the
# deploy-only key, which the server's authorized_keys ties to this script and
# nothing else (remote-install.sh), so what that key asked for arrives in
# SSH_ORIGINAL_COMMAND. Mark or Jack can also run it by hand on the server:
#
#   /opt/wheelhouse/deploy.sh deploy <full 40-character commit>
#   /opt/wheelhouse/deploy.sh rollback
#
# deploy downloads that commit's image from GitHub's container registry and
# starts it; the one it replaces is kept to go back to. rollback starts the
# kept one again. Neither touches the database: a rollback that needs the
# database put back too is the runbook's section D.
set -euo pipefail

DIR=${WHEELHOUSE_DIR:-/opt/wheelhouse}
# Fixed here, not taken from the caller, so the deploy key can only ever start
# this repository's images.
IMAGE_REPO=ghcr.io/jackcurphey/wheelhouse-epos
# The image remote-install.sh builds on the server when setup.sh is run.
BUILT_HERE=wheelhouse-app:current

fail() { echo "deploy.sh: $*" >&2; exit 1; }

if [ "$#" -gt 0 ]; then asked="$*"; else asked=${SSH_ORIGINAL_COMMAND:-}; fi
case "$asked" in
  rollback) action=rollback ;;
  "deploy "*)
    action=deploy
    commit=${asked#deploy }
    [[ "$commit" =~ ^[0-9a-f]{40}$ ]] || fail "deploy needs a full 40-character commit, got \"$commit\"."
    ;;
  *) fail "only \"deploy <commit>\" or \"rollback\" are allowed, got \"$asked\"." ;;
esac

cd "$DIR"
# One at a time, even when started by hand beside the workflow.
if command -v flock >/dev/null; then
  exec 9>"$DIR/.deploy.lock"
  flock 9
fi

# A setting from the server's settings file (.env), or nothing.
setting() { grep "^$1=" "${2:-.env}" 2>/dev/null | tail -n 1 | cut -d= -f2- || true; }
# Rewrites the settings file with these two lines changed, keeping every other
# line (and the file private, as remote-install.sh writes it).
use_release() {
  umask 077
  { grep -v -e '^WHEELHOUSE_IMAGE=' -e '^WHEELHOUSE_COMMIT=' .env || true
    printf 'WHEELHOUSE_IMAGE=%s\nWHEELHOUSE_COMMIT=%s\n' "$1" "$2"; } > .env.new
  mv .env.new .env
}
note() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> deploys.log; }

running_image=$(setting WHEELHOUSE_IMAGE)
running_commit=$(setting WHEELHOUSE_COMMIT)
if [ -z "$running_image" ]; then
  # Set up by hand before automatic deploys: the image built on the server,
  # from the code fetched into app/.
  running_image=$BUILT_HERE
  running_commit=$(git -C app rev-parse HEAD 2>/dev/null || true)
fi

if [ "$action" = deploy ]; then
  if [ "$commit" = "$running_commit" ]; then
    echo "Already running $commit."
    exit 0
  fi
  image="$IMAGE_REPO:$commit"
  # Downloaded before anything changes, so a failed download leaves the
  # running version alone.
  docker pull "$image" >/dev/null || fail "couldn't download $image. Is the package public on GitHub?"
  # The time before the deploy: the moment a restore goes back to (runbook D).
  note "deploy $commit (was ${running_commit:-unknown})"
  printf 'WHEELHOUSE_IMAGE=%s\nWHEELHOUSE_COMMIT=%s\n' "$running_image" "$running_commit" > release.previous
  use_release "$image" "$commit"
else
  [ -f release.previous ] || fail "there's nothing to go back to yet."
  previous_image=$(setting WHEELHOUSE_IMAGE release.previous)
  previous_commit=$(setting WHEELHOUSE_COMMIT release.previous)
  [ -n "$previous_image" ] || fail "there's nothing to go back to yet."
  note "rollback ${previous_commit:-unknown} (was ${running_commit:-unknown})"
  use_release "$previous_image" "$previous_commit"
fi

# --no-build: start exactly the image named, never build one here instead.
if ! docker compose up -d --no-build app; then
  if [ "$action" = deploy ]; then
    # The new version wouldn't start: put the one before straight back.
    use_release "$running_image" "$running_commit"
    note "deploy $commit didn't start; back on ${running_commit:-unknown}"
    docker compose up -d --no-build app || true
  fi
  fail "the app didn't start."
fi

# Keep the running image and the one before; older ones would fill the disk.
keep_now=$(setting WHEELHOUSE_IMAGE)
keep_before=$(setting WHEELHOUSE_IMAGE release.previous)
for old in $(docker image ls "$IMAGE_REPO" --format '{{.Repository}}:{{.Tag}}'); do
  [ "$old" = "$keep_now" ] || [ "$old" = "$keep_before" ] || docker rmi "$old" >/dev/null 2>&1 || true
done
echo "Started $(setting WHEELHOUSE_COMMIT)."
