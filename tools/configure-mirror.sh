#!/usr/bin/env bash
#
# Give the site a state mirror, in one command.
#
# **Run this yourself, in your own terminal.** The connection string is read with `read -s`, so it is
# never echoed and never passed as an argument - which would put it in your shell history and in
# `ps` - and from then on it lives only in `mirror/.mirror.env`, mode 600 and gitignored.
#
#     bash tools/configure-mirror.sh
#
# It does five things, in this order, and stops at the first one that fails:
#
#   1. copies `mirror/.mirror.env.example` to `mirror/.mirror.env` if it is not there yet
#   2. validates the connection string, and refuses the one Supabase address that cannot work here
#   3. builds `vapestack-wp:php8.3`, the thin layer over the kit's image that adds the two clients
#   4. proves the connection by opening one, then creates the schema
#   5. takes a first snapshot, if the site is running
#
# Step 5 matters more than it looks. Until one snapshot exists, the mirror holds nothing to rebuild
# from, and a `wpdev destroy` in that window loses the site exactly as it would without a mirror.
#
# To point at a different database later, just run this again: the strongest connection wins, and the
# old snapshots stay where they are.
#
# Supabase note: use the **session pooler** host from the Connect dialog -
# `...@aws-0-<region>.pooler.supabase.com:5432/postgres`. `db.<ref>.supabase.co` publishes only an
# AAAA record and the containers have no IPv6 route to it, so it never answers, and this script
# refuses it rather than letting you find that out at shutdown. The pooler host cannot be derived
# from the region - the digit is a pooler cluster index, not a region number, and a wrong one fails
# with "Tenant or user not found" - so copy the whole string from the dialog.
#
# There are two ways to supply it: paste it at the prompt, which is read with `read -s`, or put it in
# `mirror/.mirror.env` yourself first, in which case the script notices and offers to use that. The
# second keeps the password out of a clipboard entirely.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/mirror/.mirror.env"
EXAMPLE="$PROJECT_DIR/mirror/.mirror.env.example"
IMAGE="vapestack-wp:php8.3"

while [ $# -gt 0 ]; do
	case "$1" in
	-h | --help)
		sed -n '2,28p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
		exit 0
		;;
	*)
		echo "Unknown argument: $1 (try --help)" >&2
		exit 2
		;;
	esac
done

command -v docker >/dev/null 2>&1 || {
	echo 'docker is required.' >&2
	exit 1
}

if [ ! -f "$EXAMPLE" ]; then
	echo "$EXAMPLE is missing; this does not look like the vapestack project." >&2
	exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
	cp "$EXAMPLE" "$ENV_FILE"
	chmod 600 "$ENV_FILE"
	echo "Created mirror/.mirror.env from the example."
fi

# Nothing this script prints ever contains a password, including the URL it is working on.
redact() {
	printf '%s' "$1" | sed -E 's#(://[^:/@]+:)[^@]*@#\1***@#'
}

# A URL already in `.mirror.env` is the way that keeps the password off the clipboard, out of the
# shell history and out of anything else that echoes a command line.
EXISTING="$(sed -n 's/^MIRROR_DATABASE_URL=//p' "$ENV_FILE" | head -1)"
CONNECTION=""

if [ -n "$EXISTING" ]; then
	echo 'mirror/.mirror.env already points at:'
	printf '  %s\n' "$(redact "$EXISTING")"
	printf 'Use that? [Y/n] '
	read -r reuse || reuse=""
	case "$reuse" in
	n | N | no | NO) ;;
	*) CONNECTION="$EXISTING" ;;
	esac
fi

if [ -z "$CONNECTION" ]; then
	printf 'Paste the PostgreSQL connection string (postgresql://…), or leave blank to disable the mirror: '
	read -rs CONNECTION || CONNECTION=""
	printf '\n'
fi

if [ -z "$CONNECTION" ]; then
	echo 'Nothing entered. The mirror stays off and the site is unchanged.' >&2
	exit 1
fi

case "$CONNECTION" in
postgres://* | postgresql://*) ;;
*)
	echo 'That is not a PostgreSQL URL - it should start postgresql://' >&2
	exit 1
	;;
esac

case "$CONNECTION" in
*'[YOUR-PASSWORD]'*)
	echo >&2
	echo 'That string still says [YOUR-PASSWORD] where the password goes. The dashboard shows that' >&2
	echo 'placeholder until the password is revealed - use the eye icon, or press Copy with it visible,' >&2
	echo 'and paste the result. Nothing was changed.' >&2
	exit 1
	;;
esac

case "$CONNECTION" in
*@db.*.supabase.co*)
	echo >&2
	echo 'That is Supabase'"'"'s direct-connection host, and it cannot work from here.' >&2
	echo 'It publishes an AAAA record only, while these containers have no IPv6 route, so the' >&2
	echo 'connection never answers. Copy the **session pooler** string instead: that one is IPv4,' >&2
	echo 'and its username is postgres.<ref> rather than postgres.' >&2
	exit 1
	;;
esac

# The value goes in through a builtin, never through sed's argv, because argv is world-readable.
# Comments and the other settings are carried over untouched.
BACKUP=""
if [ -s "$ENV_FILE" ]; then
	BACKUP="$(mktemp)"
	cp "$ENV_FILE" "$BACKUP"
fi

restore_backup() {
	[ -n "$BACKUP" ] && cp "$BACKUP" "$ENV_FILE" && rm -f "$BACKUP"
}
trap 'restore_backup' EXIT

{
	grep -v '^MIRROR_DATABASE_URL=' "$ENV_FILE" || true
	printf 'MIRROR_DATABASE_URL=%s\n' "$CONNECTION"
} >"$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"

# Runs psql inside the mirror image, reading the settings from the mounted file so that the
# credential never appears in a command line - its own or the container's.
run_psql() {
	docker run --rm \
		-v "$PROJECT_DIR/mirror:/opt/mirror:ro" \
		--entrypoint bash "$IMAGE" -lc \
		'set -a; . /opt/mirror/.mirror.env; set +a; exec psql "$MIRROR_DATABASE_URL" -X -q "$@"' _ "$@"
}

echo 'Building the mirror image (mariadb-client and postgresql-client on top of the kit image)…'
(cd "$PROJECT_DIR" && docker compose build wordpress >/dev/null)

echo 'Proving the connection…'
if ! run_psql -tA -c 'select 1' >/dev/null; then
	echo >&2
	echo "Could not connect to $(redact "$CONNECTION"), so nothing was changed." >&2
	echo 'If this is a paused Supabase project, resume it in the dashboard and run this again.' >&2
	exit 1
fi

echo 'Creating the schema…'
run_psql -v ON_ERROR_STOP=1 -f /opt/mirror/schema.sql >/dev/null

HAVE_TABLES="$(run_psql -tA -c "select to_regclass('public.vapestack_snapshots') is not null and to_regclass('public.vapestack_media') is not null")"
if [ "$HAVE_TABLES" != 't' ]; then
	echo 'The schema did not apply cleanly. Nothing was changed.' >&2
	exit 1
fi

# Past this point the settings are good, so the backup is no longer a safety net.
trap - EXIT
[ -n "$BACKUP" ] && rm -f "$BACKUP"

echo 'Mirror configured: vapestack_snapshots and vapestack_media are in place.'

if (cd "$PROJECT_DIR" && docker compose ps --status running --services 2>/dev/null | grep -qx wordpress); then
	echo 'Taking a first snapshot…'
	(cd "$PROJECT_DIR" && docker compose exec -T wordpress /opt/mirror/state.sh export)
else
	echo 'The site is not running, so no snapshot was taken yet.'
	echo 'Start it with `wpdev up`, then run: bash tools/mirror.sh push'
fi

echo
echo 'From here:'
echo '  bash tools/mirror.sh status   # what is local and what the mirror holds'
echo '  bash tools/mirror.sh push     # snapshot now'
echo '  bash tools/mirror.sh pull     # rebuild from the newest snapshot, discarding local state'
echo 'Snapshots are also written automatically every time the container stops.'
