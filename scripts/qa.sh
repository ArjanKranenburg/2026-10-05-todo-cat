#!/usr/bin/env bash
# Runs every quality gate and reports one PASS/FAIL line per section.
# Output of passing sections goes only to the log; failing sections print theirs.
# Exits non-zero if any section fails. Usage: npm run qa (or bash scripts/qa.sh).

set -uo pipefail

cd "$(dirname "$0")/.."

LOG="${QA_LOG:-qa.log}"
export NO_COLOR=1 NEXT_TELEMETRY_DISABLED=1

: >"$LOG"
results=()
failed=0

run() {
  local name="$1"
  shift
  local out start status
  out="$(mktemp)"
  start=$SECONDS
  "$@" >"$out" 2>&1
  status=$?
  local secs=$((SECONDS - start))
  {
    echo "=== $name: $* (exit $status, ${secs}s)"
    cat "$out"
    echo
  } >>"$LOG"
  if [ "$status" -eq 0 ]; then
    echo "$name: PASS (${secs}s)"
    results+=("PASS  $name")
  else
    echo "$name: FAIL (${secs}s)"
    echo "--- $name output ---"
    cat "$out"
    echo "--- end $name output ---"
    results+=("FAIL  $name")
    failed=1
  fi
  rm -f "$out"
}

run biome npm run --silent lint -- --colors=off
run typecheck npm run --silent typecheck -- --pretty false
run build npm run --silent build
run cli-build npm run --silent build -w todo-cat-cli
run vitest npm run --silent test
run playwright npm run --silent test:e2e

echo
echo "QA summary:"
printf '  %s\n' "${results[@]}"
echo "Full log: $LOG"
if [ "$failed" -ne 0 ]; then
  echo "QA: FAIL"
  exit 1
fi
echo "QA: PASS"
