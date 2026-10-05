#!/usr/bin/env bash
# Several short Bombadil explorations against the LOCAL preview build, desktop then phone.
# usage: e2e/bombadil/run.sh <limit e.g. 4m> <runs per viewport>
#
# Reliability design (see the header of spec.ts for the why):
#  - short runs, so one wedged browser costs minutes, not a whole session;
#  - a stall watchdog: if trace.jsonl stops growing for STALL_SECS the run is declared wedged and the
#    whole process tree (bombadil AND its Chrome, which otherwise survives and spins a core) is
#    killed, then the next run starts. A wedge is reported but is not a property violation;
#  - exit codes: 0 all runs clean, 1 a property violation, 3 only wedges (no violation seen).
set -uo pipefail
command -v bombadil > /dev/null || {
  echo "bombadil not on PATH"
  exit 1
}
limit="${1:-4m}"
runs="${2:-5}"
STALL_SECS="${STALL_SECS:-75}"
# Extra `bombadil browser test` flags (word-split). Default turns Bombadil's JS coverage
# instrumentation off: with it on, ~3 of 19 runs wedged the browser (Runtime.evaluate and
# Debugger.evaluateOnCallFrame timeouts); with it off, 0 of 12. Opt back in with
# BOMBADIL_ARGS='--instrument-javascript=files,inline'. Coverage only steers exploration.
BOMBADIL_ARGS="${BOMBADIL_ARGS---instrument-javascript=}"

case "$limit" in
  *s) secs=${limit%s} ;;
  *m) secs=$((${limit%m} * 60)) ;;
  *h) secs=$((${limit%h} * 3600)) ;;
  *)
    echo "limit needs a unit: s, m or h"
    exit 1
    ;;
esac

pnpm run build || exit 1
port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1])')
pnpm exec vite preview --port "$port" --strictPort --host 127.0.0.1 > /dev/null 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
until curl -fs "http://127.0.0.1:$port/seshat/" > /dev/null; do sleep 0.5; done

kill_tree() {
  local child
  for child in $(pgrep -P "$1" 2> /dev/null); do kill_tree "$child"; done
  kill -9 "$1" 2> /dev/null || true
}

violations=0
wedges=0
for viewport in "desktop 1024 768" "phone 390 844"; do
  # shellcheck disable=SC2086 # intentional: split "name width height" into positional args
  set -- $viewport
  name=$1 width=$2 height=$3
  for n in $(seq 1 "$runs"); do
    out="target/bombadil/$name-$n"
    log="$out.log"
    mkdir -p target/bombadil
    # shellcheck disable=SC2086 # BOMBADIL_ARGS is a deliberate space-separated extra-args list
    bombadil browser test "http://127.0.0.1:$port/seshat/" e2e/bombadil/spec.ts --headless \
      --width "$width" --height "$height" --time-limit "$limit" --output-path "$out" \
      --output-path-overwrite ${BOMBADIL_ARGS:-} > "$log" 2>&1 &
    pid=$!
    start=$(date +%s)
    last=$start
    size=-1
    wedged=0
    while kill -0 "$pid" 2> /dev/null; do
      sleep 5
      now=$(date +%s)
      cur=$(wc -c < "$out/trace.jsonl" 2> /dev/null || echo 0)
      if [ "$cur" != "$size" ]; then
        size=$cur
        last=$now
      fi
      if [ $((now - last)) -ge "$STALL_SECS" ] || [ $((now - start)) -ge $((secs + 120)) ]; then
        echo "WEDGED $out: no trace progress for $((now - last))s after $((now - start))s; killing"
        kill_tree "$pid"
        wedged=1
        break
      fi
    done
    wait "$pid" 2> /dev/null
    rc=$?
    # Bombadil itself gives up with exit 1 when CDP stops answering ("timed out waiting for response").
    if [ "$wedged" = 0 ] && [ "$rc" -eq 1 ] && grep -q "timed out waiting for response" "$log"; then
      echo "WEDGED $out: bombadil aborted on a CDP timeout"
      wedged=1
    fi
    if [ "$wedged" = 1 ]; then
      wedges=$((wedges + 1))
    elif [ "$rc" -ne 0 ]; then
      echo "VIOLATIONS in $out (exit $rc); see $log"
      violations=$((violations + 1))
    else
      echo "clean $out ($(($(date +%s) - start))s)"
    fi
  done
done
echo "summary: $violations run(s) with violations, $wedges wedged run(s)"
if [ "$violations" -gt 0 ]; then exit 1; fi
if [ "$wedges" -gt 0 ]; then exit 3; fi
exit 0
