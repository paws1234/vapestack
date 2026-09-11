#!/usr/bin/env bash
#
# Point the deployed storefront at this machine's WordPress.
#
# The deployment reads WordPress over a cloudflared quick tunnel, and a quick tunnel is handed a
# fresh random *.trycloudflare.com hostname every time it starts. That hostname is part of three
# Vercel environment variables, and those are read when the deployment is built, so restarting the
# tunnel means deploying again as well. This script does the three steps that belong together:
# start the tunnel, read its hostname out of its own log, and re-point Vercel at it.
#
#   bash tools/tunnel.sh            # start the tunnel if it is not already up, then re-point Vercel
#   bash tools/tunnel.sh --host     # print the current hostname and stop
#   bash tools/tunnel.sh --stop     # stop the tunnel
#
# Only the deployed site needs this. Local development reads http://localhost:8889 directly.
#
# Needs:
#   - cloudflared, no account required for a quick tunnel
#   - the Vercel CLI, authenticated (`npx vercel login`) and linked to the project
#     (`npx vercel link` inside frontend/), for everything except --host and --stop

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$PROJECT_DIR/frontend"
RUN_DIR="${TUNNEL_RUN_DIR:-$PROJECT_DIR/.tunnel}"
LOG="$RUN_DIR/cloudflared.log"
PID_FILE="$RUN_DIR/cloudflared.pid"
HOST_FILE="$RUN_DIR/host"

PORT="${WORDPRESS_PORT:-8889}"
CLOUDFLARED="${CLOUDFLARED:-$(command -v cloudflared || echo "$HOME/.local/bin/cloudflared")}"
VERCEL="${VERCEL:-npx --yes vercel}"

action="${1:-deploy}"

mkdir -p "$RUN_DIR"

# Alive means the pid file names a process that is still there. The port itself is not a signal:
# anything could be listening on it.
tunnel_pid() {
	if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
		cat "$PID_FILE"

		return 0
	fi

	return 1
}

stop_tunnel() {
	if pid="$(tunnel_pid)"; then
		kill "$pid"
		echo "Stopped the tunnel (pid $pid)."
	else
		echo "No tunnel was running."
	fi

	rm -f "$PID_FILE" "$HOST_FILE"
}

start_tunnel() {
	if tunnel_pid >/dev/null && [ -s "$HOST_FILE" ]; then
		echo "Tunnel already up at $(cat "$HOST_FILE")" >&2

		return
	fi

	if [ ! -x "$CLOUDFLARED" ]; then
		echo "cloudflared not found at $CLOUDFLARED. Set CLOUDFLARED=/path/to/cloudflared." >&2
		exit 1
	fi

	echo "Starting a quick tunnel to http://localhost:$PORT ..." >&2

	: >"$LOG"

	nohup "$CLOUDFLARED" tunnel --url "http://localhost:$PORT" --no-autoupdate >"$LOG" 2>&1 &
	echo $! >"$PID_FILE"

	# The hostname appears a few seconds in; the tunnel is not usable until it does.
	for _ in $(seq 1 40); do
		if grep -qoE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" 2>/dev/null; then
			grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 >"$HOST_FILE"

			return
		fi

		sleep 1
	done

	echo "No quick-tunnel hostname appeared within 40s. See $LOG." >&2
	stop_tunnel
	exit 1
}

case "$action" in
--stop)
	stop_tunnel
	exit 0
	;;
--host)
	start_tunnel
	cat "$HOST_FILE"
	exit 0
	;;
deploy) ;;
*)
	echo "Usage: bash tools/tunnel.sh [--host|--stop]" >&2
	exit 2
	;;
esac

start_tunnel
HOST="$(cat "$HOST_FILE")"

# A quick tunnel can be up before WordPress is behind it, so check both ends before spending a
# deployment on it. WordPress answers /wp-json/ with 200 and without authentication.
status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$HOST/wp-json/" || echo 000)"

if [ "200" != "$status" ]; then
	echo "The tunnel is up at $HOST but WordPress answered $status there." >&2
	echo "Start the site first: wpdev up $PROJECT_DIR" >&2
	exit 1
fi

echo "Tunnel:     $HOST"
echo "WordPress:  $status from $HOST/wp-json/"

if [ ! -f "$FRONTEND_DIR/.vercel/project.json" ]; then
	echo
	echo "frontend/ is not linked to a Vercel project yet. Run:" >&2
	echo "  env -C $FRONTEND_DIR npx vercel login" >&2
	echo "  env -C $FRONTEND_DIR npx vercel link" >&2
	exit 1
fi

# Replace rather than patch: the CLI has no "set an existing variable" form, and the old value is
# exactly what is being retired. Removing a variable that is not there is not an error.
set_env() {
	local name="$1" value="$2"

	env -C "$FRONTEND_DIR" $VERCEL env rm "$name" production --yes >/dev/null 2>&1 || true
	printf '%s' "$value" | env -C "$FRONTEND_DIR" $VERCEL env add "$name" production >/dev/null
}

echo "Re-pointing the Vercel production environment at $HOST ..."

set_env WP_GRAPHQL_URL "$HOST/graphql"
set_env WP_REST_URL "$HOST/wp-json/wc/v3"
set_env WP_PUBLIC_URL "$HOST"

echo "Deploying ..."

env -C "$FRONTEND_DIR" $VERCEL --prod --yes

echo
echo "Done. The site is deployed against $HOST."
echo "That hostname lasts as long as this tunnel does: run this script again when it restarts."
