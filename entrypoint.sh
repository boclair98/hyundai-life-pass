#!/bin/sh
set -e

export NGINX_RESOLVER="$(awk '/^nameserver/ {print $2; exit}' /etc/resolv.conf)"
envsubst '${KAKAO_JAVASCRIPT_KEY}' < /etc/lifepass/runtime-config.js.template > /usr/share/nginx/html/runtime-config.js
exec /docker-entrypoint.sh "$@"
