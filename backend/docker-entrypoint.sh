#!/bin/sh
set -eu

if [ ! -d /app/node_modules ] || [ -z "$(ls -A /app/node_modules 2>/dev/null)" ]; then
  pnpm install --no-frozen-lockfile
fi

exec "$@"
