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
#   - the Vercel CLI, authenticated (`npx vercel login`) and linked to the project from the
#     **repository root** (`npx vercel link` there, not in frontend/), for --host and --stop
#     excluded
#
# Deploys run from the repository root on purpose: the project's Root Directory is `frontend`, so
# the CLI has to upload the repository and let the setting pick the storefront out of it. Running
# `vercel` inside frontend/ uploads that directory as the root and fails to find it.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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

# A quick tunnel prints its hostname before that hostname resolves, and this machine's resolver
# caches the negative answer hard enough to keep failing after Cloudflare has published the record.
# So the probe waits a moment, retries, and can be pointed at DNS-over-HTTPS - which is also what
# tells a genuine tunnel failure apart from a stale local resolver.
#
# WordPress answers /wp-json/ with 200 and without authentication, so that is the probe.
probe_wordpress() {
	local doh="$1"
	local status=""

	for _ in $(seq 1 12); do
		if [ -n "$doh" ]; then
			status="$(curl -s --doh-url "$doh" -o /dev/null -w '%{http_code}' --max-time 15 "$HOST/wp-json/" || true)"
		else
			status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$HOST/wp-json/" || true)"
		fi

		if [ "200" = "$status" ]; then
			echo "$status"

			return 0
		fi

		sleep 5
	done

	echo "${status:-none}"

	return 1
}

sleep 5
wp_status="$(probe_wordpress "" || true)"

if [ "200" != "$wp_status" ]; then
	if wp_status="$(probe_wordpress "https://cloudflare-dns.com/dns-query")"; then
		echo "Note: this machine's resolver does not resolve $HOST yet, but the tunnel answers over" >&2
		echo "DNS-over-HTTPS, so WordPress is reachable and the deployment will be fine." >&2
	else
		echo "The tunnel at $HOST never reached WordPress (last answer: $wp_status)." >&2
		echo "Stop it with: bash tools/tunnel.sh --stop, then check the site is up: wpdev up $PROJECT_DIR" >&2
		exit 1
	fi
fi

echo "Tunnel:     $HOST"
echo "WordPress:  $wp_status from $HOST/wp-json/"

if [ ! -f "$PROJECT_DIR/.vercel/project.json" ]; then
	echo
	echo "The repository root is not linked to a Vercel project yet. Run:" >&2
	echo "  npx vercel login" >&2
	echo "  env -C $PROJECT_DIR npx vercel link --project vapestack" >&2
	exit 1
fi

# Replace rather than patch: the CLI has no "set an existing variable" form, and the old value is
# exactly what is being retired. Removing a variable that is not there is not an error.
set_env() {
	local name="$1" value="$2"

	env -C "$PROJECT_DIR" $VERCEL env rm "$name" production --yes >/dev/null 2>&1 || true
	printf '%s' "$value" | env -C "$PROJECT_DIR" $VERCEL env add "$name" production >/dev/null
}

echo "Re-pointing the Vercel production environment at $HOST ..."

set_env WP_GRAPHQL_URL "$HOST/graphql"
set_env WP_REST_URL "$HOST/wp-json/wc/v3"
set_env WP_PUBLIC_URL "$HOST"

echo "Deploying (from the repository root, because the project's Root Directory is frontend) ..."

deploy_output="$(env -C "$PROJECT_DIR" $VERCEL --prod --yes 2>&1)"
printf '%s\n' "$deploy_output" | tail -3

site="$(printf '%s\n' "$deploy_output" |
	sed -n 's/.*Production[[:space:]]\{1,\}\(https:\/\/[^[:space:]]*\).*/\1/p' | tail -1)"

# Warming matters more than it looks. The catalogue routes are dynamic, so what a visitor gets is
# the five-minute data cache; a route that has never been requested since the deploy has nothing
# cached and would have to reach for a tunnel that may already be closed. Reading the catalogue to
# find the routes keeps this list in step with the shop rather than duplicating it here.
if [ -n "$site" ]; then
	echo
	echo "Warming every route on $site, so the catalogue survives this tunnel closing ..."

	routes="$(curl -s --max-time 30 -X POST "$HOST/graphql" -H 'Content-Type: application/json' \
		-d '{"query":"{ products { nodes { slug productCategories { nodes { slug } } } } }"}' |
		node -e 'let s="";process.stdin.on("data",(d)=>{s+=d}).on("end",()=>{try{const p=JSON.parse(s);const set=new Set(["/","/shop","/checkout"]);for(const n of p.data.products.nodes){set.add("/product/"+n.slug);for(const c of n.productCategories.nodes){set.add("/shop/"+c.slug)}}console.log([...set].join(" "))}catch(error){console.log("")}})')"

	for path in $routes; do
		printf '  %-40s %s\n' "$path" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 "$site$path")"
	done
else
	echo "Could not read the deployment URL from the CLI output; warm the routes by hand." >&2
fi

echo
echo "Done. The site is deployed against $HOST."
echo "That hostname lasts as long as this tunnel does: run this script again when it restarts."
