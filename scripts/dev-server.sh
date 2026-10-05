#!/usr/bin/env bash
# Starts, stops and reports the background dev server, so agents never need pkill.
# The server runs detached in its own process group (it outlives the calling shell
# and agent task limits); its group id and log live in the gitignored .dev-server/.
# `stop` only stops a server this script started.
# Usage: npm run dev:start | dev:stop | dev:status (PORT overrides 3000).

set -uo pipefail

cd "$(dirname "$0")/.."

port="${PORT:-3000}"
url="http://localhost:$port"
dir=".dev-server"
pidfile="$dir/pgid"
log="$dir/dev.log"

ours() {
  [ -f "$pidfile" ] && kill -0 -- "-$(cat "$pidfile")" 2>/dev/null
}

answers() {
  [ "$(curl -s -o /dev/null -w '%{http_code}' "$url/api/auth/ok")" = 200 ]
}

case "${1:-status}" in
start)
  if ours; then
    echo "dev-server: already running (pgid $(cat "$pidfile")) at $url"
    exit 0
  fi
  if answers; then
    echo "dev-server: $url is served by a server this script did not start; use it, don't stop it"
    exit 0
  fi
  mkdir -p "$dir"
  setsid npm run dev -- --port "$port" >"$log" 2>&1 </dev/null &
  ps -o pgid= -p $! | tr -d ' ' >"$pidfile"
  for _ in $(seq 1 120); do
    if answers; then
      echo "dev-server: running (pgid $(cat "$pidfile")) at $url; log: $log"
      exit 0
    fi
    ours || break
    sleep 0.5
  done
  echo "dev-server: did not come up at $url; last log lines:" >&2
  tail -n 20 "$log" >&2
  ours && kill -- "-$(cat "$pidfile")" 2>/dev/null
  rm -f "$pidfile"
  exit 1
  ;;
stop)
  if ! ours; then
    rm -f "$pidfile"
    echo "dev-server: none started by this script; not stopping anything else"
    exit 0
  fi
  pgid="$(cat "$pidfile")"
  kill -TERM -- "-$pgid"
  for _ in $(seq 1 20); do
    kill -0 -- "-$pgid" 2>/dev/null || break
    sleep 0.5
  done
  kill -KILL -- "-$pgid" 2>/dev/null
  rm -f "$pidfile"
  echo "dev-server: stopped (pgid $pgid)"
  ;;
status)
  if ours; then
    echo "dev-server: running (pgid $(cat "$pidfile")) at $url; log: $log"
  elif answers; then
    echo "dev-server: $url is served by a server this script did not start"
  else
    echo "dev-server: not running at $url"
  fi
  ;;
*)
  echo "usage: dev-server.sh start|stop|status" >&2
  exit 2
  ;;
esac
