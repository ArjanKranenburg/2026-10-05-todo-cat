#!/usr/bin/env bash
# Waits for the CI run of the pushed HEAD commit and watches it to the end.
# A run appears a few seconds after the push, so a bare `gh run watch` right after
# pushing finds no run. Exits non-zero if the run fails or never shows up.
# Usage: npm run ci:watch (or bash scripts/ci-watch.sh).

set -euo pipefail

cd "$(dirname "$0")/.."

sha="$(git rev-parse HEAD)"
id=""
for _ in $(seq 1 30); do
  id="$(gh run list --commit "$sha" --workflow ci.yml --limit 1 \
    --json databaseId --jq '.[0].databaseId // empty')"
  [ -n "$id" ] && break
  sleep 2
done
if [ -z "$id" ]; then
  echo "ci-watch: no CI run for ${sha:0:7} after 60s; is the commit pushed?" >&2
  exit 1
fi

echo "ci-watch: run $id for ${sha:0:7}"
if gh run watch "$id" --exit-status --compact --interval 10 >/dev/null; then
  echo "ci-watch: PASS $(gh run view "$id" --json url --jq .url)"
else
  echo "ci-watch: FAIL $(gh run view "$id" --json url --jq .url)"
  gh run view "$id" --log-failed | tail -n 80
  exit 1
fi
