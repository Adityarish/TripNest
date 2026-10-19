#!/bin/sh
set -eu

# Docker creates a fresh named volume as root; the app writes mock objects as nextjs.
chown nextjs:nodejs /app/.tripnest-mock-drive
exec su-exec nextjs "$@"
