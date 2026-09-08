#!/bin/sh
set -e

if [ "${LIFEPASS_PRODUCTION_GUARD:-false}" = "true" ] && [ -z "${KAKAO_JAVASCRIPT_KEY:-}" ]; then
  echo "Production readiness guard blocked startup: KAKAO_JAVASCRIPT_KEY is required." >&2
  exit 1
fi

export NGINX_RESOLVER="$(awk '/^nameserver/ {print $2; exit}' /etc/resolv.conf)"
envsubst '${KAKAO_JAVASCRIPT_KEY}' < /etc/lifepass/runtime-config.js.template > /usr/share/nginx/html/runtime-config.js
exec /docker-entrypoint.sh "$@"
