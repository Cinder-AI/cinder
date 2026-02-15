#!/bin/sh
set -eu

# В dev-режиме с bind mount зависимости должны ставиться в named volume.
# Если volume пустой - ставим зависимости.
if [ ! -d /app/node_modules ] || [ -z "$(ls -A /app/node_modules 2>/dev/null)" ]; then
  pnpm install --no-frozen-lockfile
fi

exec "$@"
