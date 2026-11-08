#!/bin/sh
# Writes the backend URL when the container starts, so it can change without rebuilding the image.
# Vite fixes its environment variables at build time, so they can't do this on their own.
set -eu

printf 'window.__APP_CONFIG__ = { apiBaseUrl: "%s" }\n' "${API_BASE_URL:-http://localhost:8080}" \
  > /usr/share/nginx/html/config.js
