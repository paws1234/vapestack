#!/usr/bin/env bash
#
# Drive the state mirror by hand.
#
#     bash tools/mirror.sh status          what is local, and what the mirror holds
#     bash tools/mirror.sh list            every snapshot on the mirror, newest first
#     bash tools/mirror.sh push            serialise the current state as a new snapshot
#     bash tools/mirror.sh pull            rebuild from the newest snapshot, discarding local state
#     bash tools/mirror.sh pull --apply    same, but without asking first
#     bash tools/mirror.sh logs            what the last automatic export said
#
# The automatic half of the mirror needs none of this: `mirror/entrypoint.sh` hydrates on boot when
# the local database is empty, and writes a snapshot on every clean stop. These commands exist for
# the two cases that leaves - wanting a snapshot *now*, without stopping the site, and wanting to go
# back to one.
#
# `pull` stops the wordpress container first, and that is deliberate. Stopping it writes a snapshot
# of the state being replaced, so a pull is reversible: the thing you discarded is on the mirror,
# one `pull` away. It also means the database is only ever touched while nothing is serving from it.
#
# Everything here runs `mirror/state.sh` inside the container, so there is one implementation of the
# mirror and not two.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/mirror/.mirror.env"
STATE=/opt/mirror/state.sh

compose() { (cd "$PROJECT_DIR" && docker compose "$@"); }

while [ $# -gt 0 ]; do
	case "$1" in
	-h | --help)
		sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
		exit 0
		;;
	*) break ;;
	esac
done

COMMAND="${1:-status}"
shift || true

running() { compose ps --status running --services 2>/dev/null | grep -qx wordpress; }

require_running() {
	if ! running; then
		echo 'The wordpress container is not running, so there is nothing to read from.' >&2
		echo 'Start the site first: wpdev up' >&2
		exit 1
	fi
}

# `status` and `logs` are read-only, and they are what you reach for when the mirror is not working -
# so they deliberately do not need it to be configured. `push` and `pull` do, and say so themselves.
require_configured() {
	if [ ! -f "$ENV_FILE" ]; then
		echo 'The mirror is not configured yet. Run: bash tools/configure-mirror.sh' >&2
		exit 1
	fi
}

case "$COMMAND" in
status | list)
	require_running
	compose exec -T wordpress "$STATE" "$COMMAND"
	;;
logs)
	# Every automatic export writes here, so this is where a snapshot that never arrived explains
	# itself: Compose discards the output of a lifecycle hook.
	require_running
	compose exec -T wordpress sh -c 'tail -30 /var/www/html/wp-content/mirror.log 2>/dev/null || echo "(no automatic export has run yet)"'
	;;
push)
	require_configured
	require_running
	compose exec -T wordpress "$STATE" export
	;;
pull)
	require_configured
	FORCE_ARG="${1:-}"
	if [ "$FORCE_ARG" != '--apply' ]; then
		echo 'This replaces the local database and uploads with the newest snapshot.'
		echo 'The state being replaced is snapshotted on the way down, so this is reversible.'
		printf 'Continue? [y/N] '
		read -r reply
		case "$reply" in
		y | Y | yes | YES) ;;
		*)
			echo 'Nothing changed.'
			exit 0
			;;
		esac
	fi
	# The stop is what writes the undo snapshot, and it takes as long as the export does.
	echo 'Stopping wordpress (this snapshots the current state first)…'
	compose stop wordpress
	echo 'Rebuilding from the newest snapshot…'
	# A one-off container with the same mounts, but with the mirror as its entrypoint so Apache never
	# starts: the restore needs the database to itself.
	compose run --rm --entrypoint "$STATE" wordpress hydrate --force
	echo 'Starting wordpress again…'
	compose start wordpress
	;;
*)
	echo "Unknown command: $COMMAND" >&2
	echo 'Try: status | list | push | pull [--apply]' >&2
	exit 2
	;;
esac
