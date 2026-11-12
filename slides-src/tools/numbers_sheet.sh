#!/usr/bin/env bash
# Rebuilds specs/_numbers.md from the app's docs/numbers.md and the vfun numbers this deck reuses.
cd "$(dirname "$0")/.." || exit 1
vfun=${VFUN_NUMBERS:-/Users/bazlur/projects/vfun/slides-src/specs/_numbers.md}
{
  cat ../docs/numbers.md
  echo
  echo "## Reused from vfun (plain Java, measured for the vfun talk)"
  echo
  echo "These are vfun's numbers, copied verbatim from its \`_numbers.md\`. Label them \"plain Java\" on screen."
  echo
  sed -n '/^## Warm-up/,/^## Demo 1/p' "$vfun" | sed '$d' | sed 's/^## /### /'
  echo "### Pinning probe (backup slide)"
  grep -A2 "^- Pinning probe" "$vfun"
  echo
  echo "### Structured concurrency (the \`scope\` slide)"
  grep -A2 "^- Structured" "$vfun"
} > specs/_numbers.md
echo "wrote specs/_numbers.md"
