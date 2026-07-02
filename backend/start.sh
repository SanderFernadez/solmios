#!/bin/bash
eval "$(grep '^export ' .env 2>/dev/null)"
exec /home/phantom/.bun/bin/bun --hot src/composition-root.ts
