#!/bin/sh
# Build the dashboard and publish it to the Director deploy branch.
#
#   ./scripts/deploy-director.sh
#
# Then tell the running site to pull:
#
#   curl -X POST https://<site>.tjhsst.edu/__deploy -H "x-deploy-token: <token>"
#
# Env vars:
#   DIRECTOR_REMOTE  git remote to push to (default: origin)
#   DIRECTOR_BRANCH  branch the site pulls from (default: director)

set -e

ROOT=$(cd "$(dirname "$0")/.." && pwd)
REMOTE=${DIRECTOR_REMOTE:-origin}
BRANCH=${DIRECTOR_BRANCH:-director}
REMOTE_URL=$(git -C "$ROOT" remote get-url --push "$REMOTE")
SOURCE_COMMIT=$(git -C "$ROOT" rev-parse --short HEAD)

echo "==> Building dashboard"
cd "$ROOT/dashboard"
npm run build

echo "==> Staging deploy branch"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

cp -a "$ROOT/dashboard/build" "$STAGE/build"
cp "$ROOT/director/server.js" "$ROOT/director/package.json" "$ROOT/director/run.sh" "$STAGE/"
chmod +x "$STAGE/run.sh"

cd "$STAGE"
git init -q
git checkout -q -b "$BRANCH"
git add -A
git commit -q -m "director build from $SOURCE_COMMIT"

echo "==> Pushing $BRANCH to $REMOTE"
git push -q --force "$REMOTE_URL" "$BRANCH"

echo "==> Done ($SOURCE_COMMIT)"
