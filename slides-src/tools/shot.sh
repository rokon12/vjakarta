#!/usr/bin/env bash
# Screenshot one slide state at 1920x1080.
#   tools/shot.sh <deck.html> <slide-id[.step]> <out.png> [still|frames|play|live] [ms]
#     still   finished state of that step, all motion off (default)
#     frames  the step in its finished state, then loops run for <ms> of virtual time
#     play    the transition INTO that step, frozen <ms> after it starts
#     live    everything on; CSS transitions may be caught half way
set -euo pipefail
deck="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
target="$2"
out="$(cd "$(dirname "$3")" && pwd)/$(basename "$3")"
mode="${4:-still}"
ms="${5:-1500}"
case "$mode" in
  still) query='?still' ;;
  frames) query='?frames' ;;
  play) query='?frames&play' ;;
  live) query='' ;;
  *) echo "mode must be still, frames, play or live" >&2; exit 1 ;;
esac
profile="$(mktemp -d)"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1920,1080 --user-data-dir="$profile" \
  --virtual-time-budget="$ms" --enable-logging=stderr --v=0 \
  --screenshot="$out" "file://$deck$query#$target" 2>&1 \
  | grep -E 'CONSOLE' | sed -E 's/^.*CONSOLE[^"]*"/console: "/; s/, source: .*$//' || true
rm -rf "$profile"
echo "wrote $out"
