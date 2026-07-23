#!/bin/sh
# Runs both processes; exits (non-zero) as soon as either dies so the
# container restarts as a unit. All configuration comes from the environment.
set -eu

node /app/api/dist/main.js &
API_PID=$!
node /app/ui/server/index.mjs &
UI_PID=$!

shutdown() {
  kill -TERM "$API_PID" "$UI_PID" 2>/dev/null || true
}
trap shutdown TERM INT

# busybox-sh-portable "wait -n": poll until either child is gone.
while kill -0 "$API_PID" 2>/dev/null && kill -0 "$UI_PID" 2>/dev/null; do
  sleep 1
done
shutdown
wait || true
exit 1
