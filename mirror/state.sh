#!/usr/bin/env bash
#
# The state mirror: serialise this site to PostgreSQL, or rebuild it from there.
#
#     state.sh export            write the current state out as a new snapshot
#     state.sh hydrate           rebuild from the newest snapshot, into an empty database only
#     state.sh hydrate --force   rebuild from the newest snapshot, replacing what is here
#     state.sh status            what is local, and what the mirror holds
#     state.sh list              the snapshots on the mirror
#
# It runs *inside* the wordpress container: `hydrate` before Apache starts and `export` after it has
# stopped (see mirror/entrypoint.sh). It is also meant to be run by hand from the host, through
# `tools/mirror.sh`, which is how a restore is usually triggered.
#
# Five rules shape every line below.
#
# 1. **Nothing here may fail the container.** PostgreSQL is a write target when the site stops and a
#    read source when it boots; it is never in the request path. Unconfigured, paused or
#    unreachable, the site must still boot, still serve and still stop cleanly - so no path exits
#    non-zero, and every remote call is wrapped in a timeout.
# 2. **The snapshot is data, not SQL in transit.** The dump is gzipped and base64-encoded, and every
#    media file goes in as base64 as well, because base64 carries no quotes, no backslashes and no
#    newlines: it survives `psql`'s text output with nothing left to escape. Handing the raw dump
#    through instead means trusting psql to round-trip every backslash and newline in it, and
#    getting that wrong restores without complaint to a database that is subtly not the one saved.
# 3. **Remote output is parsed, so its format is pinned** - `-X` for no .psqlrc, `-t`/`-A` for bare
#    values, `-F` for a separator a path cannot contain. A developer's dotfiles must not be able to
#    change what this script reads.
# 4. **Secrets stay out of argv.** `MYSQL_PWD` and the connection string in a mode-600 file rather
#    than on a command line, because a command line is readable in `ps` by every process on the box.
#    The connection string is also in the container's environment either way; that is the one place
#    it cannot be avoided.
# 5. **Hydration is opt-in by emptiness.** A local MariaDB volume is durable; the thing that is
#    ephemeral is the machine. So a boot with a populated database is left completely alone, and
#    `--force` is required to overwrite one. Without that rule every restart of a laptop would
#    silently discard whatever had been added since the last snapshot.
#
# `set -e` is deliberately absent, for the reason in rule 1: the failure that matters here is a
# *missing* snapshot, and that is reported rather than thrown.

set -uo pipefail

MIRROR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPLOADS="${MIRROR_UPLOADS_DIR:-/var/www/html/wp-content/uploads}"
WP_ROOT="${MIRROR_WP_ROOT:-/var/www/html}"

# The mirror's settings sit beside this script, which is mounted into the container. Reading them
# here rather than through Compose's `env_file` keeps a missing or malformed settings file from
# being able to stop the stack from starting at all.
# shellcheck source=/dev/null
if [ -f "$MIRROR_DIR/.mirror.env" ]; then
	set -a
	# shellcheck source=/dev/null
	. "$MIRROR_DIR/.mirror.env"
	set +a
fi

KEEP="${MIRROR_KEEP:-3}"
TIMEOUT="${MIRROR_TIMEOUT:-120}"
URL="${MIRROR_DATABASE_URL:-}"

# WORDPRESS_DB_HOST is `host:port` in the kit's compose file, but a bare host is a reasonable thing
# for someone to write, so the port is only taken when there is one.
DB_HOSTPORT="${WORDPRESS_DB_HOST:-db:3306}"
case "$DB_HOSTPORT" in
*:*) DB_HOST="${DB_HOSTPORT%%:*}" DB_PORT="${DB_HOSTPORT##*:}" ;;
*) DB_HOST="$DB_HOSTPORT" DB_PORT=3306 ;;
esac
DB_NAME="${WORDPRESS_DB_NAME:-wordpress}"
DB_USER="${WORDPRESS_DB_USER:-wordpress}"
DB_PASS="${WORDPRESS_DB_PASSWORD:-wordpress}"

log() { printf '[mirror] %s\n' "$*" >&2; }

# Empty means the mirror was never set up; a placeholder means someone pasted the dashboard's
# connection string and stopped one step short of the password. Both mean "do nothing", but they
# deserve different words, and neither may be mistaken for the mirror being down.
unconfigured_reason() {
	case "$URL" in
	*'[YOUR-PASSWORD]'*)
		printf 'MIRROR_DATABASE_URL still has [YOUR-PASSWORD] where the password goes; run: bash tools/configure-mirror.sh'
		;;
	*)
		printf 'MIRROR_DATABASE_URL is not set'
		;;
	esac
}

configured() {
	case "$URL" in
	'' | *'[YOUR-PASSWORD]'*) return 1 ;;
	*) return 0 ;;
	esac
}

# Reaching Supabase through its direct host cannot work from these containers, and the failure looks
# like a network problem rather than a wrong address, so it is named here. `db.<ref>.supabase.co`
# publishes only an AAAA record; the containers have no IPv6 route.
warn_about_host() {
	case "$URL" in
	*@db.*.supabase.co*)
		log 'warning: db.<ref>.supabase.co is IPv6-only and this container has no IPv6 route.'
		log '         use the shared pooler host from the Supabase Connect dialog, session mode.'
		;;
	esac
}

# One psql session, pinned output format, bounded in time.
remote() { PGCONNECT_TIMEOUT=10 timeout "$TIMEOUT" psql "$URL" -X "$@"; }

# Both MariaDB clients get an outer time bound: without one, talking to a database whose container
# has gone away means SYN retries against a dead address, which is minutes of a shutdown doing
# nothing. Only the `mariadb` client takes `--connect-timeout`; `mariadb-dump` rejects it outright
# ("unknown variable 'connect-timeout=10'"), so it gets the wrapper alone.
db() {
	MYSQL_PWD="$DB_PASS" timeout "$TIMEOUT" mariadb --connect-timeout=10 \
		--protocol=TCP -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$@"
}

# --single-transaction takes a consistent snapshot without holding locks, so this is safe to run
# against a live server. --hex-blob keeps any binary column from putting raw bytes into the dump.
dump_db() {
	MYSQL_PWD="$DB_PASS" timeout "$TIMEOUT" mariadb-dump \
		--protocol=TCP -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" \
		--single-transaction --skip-lock-tables --hex-blob \
		--default-character-set=utf8mb4 --no-tablespaces --routines --triggers \
		"$DB_NAME"
}

db_table_count() {
	local n
	n="$(db -N -B -e "select count(*) from information_schema.tables where table_schema = '$DB_NAME'" 2>/dev/null)"
	case "$n" in
	'' | *[!0-9]*) printf '0' ;;
	*) printf '%s' "$n" ;;
	esac
}

# Reads the version from the files rather than from the database, so it also answers on a container
# whose database is still empty - which is exactly when hydrate runs.
wp_version() {
	timeout 30 wp core version --allow-root --path="$WP_ROOT" --skip-plugins --skip-themes 2>/dev/null ||
		printf 'unknown'
}

site_url() {
	timeout 30 wp option get siteurl --allow-root --path="$WP_ROOT" --skip-plugins --skip-themes 2>/dev/null ||
		printf 'unknown'
}

local_media_count() { find "$UPLOADS" -type f 2>/dev/null | wc -l | tr -d ' '; }

local_media_bytes() {
	find "$UPLOADS" -type f -printf '%s\n' 2>/dev/null | awk '{ t += $1 } END { printf "%d", t + 0 }'
}

human_bytes() {
	awk -v b="${1:-0}" 'BEGIN {
		split("B KiB MiB GiB", unit, " ");
		i = 1;
		while (b >= 1024 && i < 4) { b /= 1024; i++ }
		printf (i == 1 ? "%.0f %s" : "%.1f %s"), b, unit[i]
	}'
}

sql_lit() { printf "'%s'" "${1//\'/\'\'}"; }

# A dollar-quoting tag that the payload does not already contain. The dump is MySQL's own output, so
# a collision is not expected - but a collision would silently truncate the snapshot, and one grep
# is a cheap way to know it did not happen.
unique_tag() {
	local file="$1" tag i
	for i in 1 2 3 4 5; do
		tag="mirror${RANDOM}${RANDOM}"
		grep -qF -- "\$$tag\$" "$file" || {
			printf '%s' "$tag"
			return 0
		}
	done
	return 1
}

cmd_export() {
	if ! configured; then
		log "$(unconfigured_reason); nothing to export"
		return 0
	fi
	warn_about_host

	local label="${1:-$(date -u '+%Y-%m-%dT%H:%M:%SZ')}"
	local work tables dump_bytes tag id media media_count media_bytes
	work="$(mktemp -d)" || return 0

	# WordPress tables specifically, not "any table": a database reached before its first install has
	# none, and snapshotting that would replace a good remote copy with nothing.
	tables="$(db_table_count)"
	if [ "$tables" = '0' ]; then
		log "the local database has no tables (is WordPress installed?); not snapshotting it"
		rm -rf "$work"
		return 0
	fi

	if ! dump_db >"$work/dump.sql" 2>"$work/dump.err"; then
		log "could not dump the database: $(tr '\n' ' ' <"$work/dump.err")"
		rm -rf "$work"
		return 0
	fi
	dump_bytes="$(wc -c <"$work/dump.sql" | tr -d ' ')"
	gzip -9 -c "$work/dump.sql" | base64 -w0 >"$work/dump.b64"

	tag="$(unique_tag "$work/dump.b64")" || {
		log 'could not find a quoting tag absent from the dump; skipping this snapshot'
		rm -rf "$work"
		return 0
	}

	# The row is written `complete = false` and only flipped at the end, so an export that dies
	# half-way is never chosen by hydration.
	id="$({
		printf "insert into vapestack_snapshots (label, wp_version, site_url, table_count, db_bytes, db_dump) values (%s, %s, %s, %s, %s, \$%s\$" \
			"$(sql_lit "$label")" "$(sql_lit "$(wp_version)")" "$(sql_lit "$(site_url)")" \
			"$tables" "$dump_bytes" "$tag"
		cat "$work/dump.b64"
		printf "\$%s\$) returning id;\n" "$tag"
	} | remote -q -tA 2>"$work/insert.err")"

	case "$id" in
	'' | *[!0-9]*)
		log "the mirror refused the snapshot row: $(tr '\n' ' ' <"$work/insert.err")"
		rm -rf "$work"
		return 0
		;;
	esac

	# Every upload in one psql session and one transaction. Roughly 1,700 separate connections would
	# take minutes; this takes seconds, and a failure rolls the whole media set back instead of
	# leaving a partial one behind a `complete = true` row.
	if ! {
		find "$UPLOADS" -type f -print0 2>/dev/null |
			while IFS= read -r -d '' file; do
				printf "insert into vapestack_media (snapshot_id, path, bytes, sha256, content) values (%s, %s, %s, %s, jsonb_build_object('b64', \$b64\$%s\$b64\$)) on conflict (snapshot_id, path) do nothing;\n" \
					"$id" "$(sql_lit "${file#"$UPLOADS"/}")" "$(stat -c%s "$file")" \
					"$(sql_lit "$(sha256sum "$file" | cut -d' ' -f1)")" "$(base64 -w0 "$file")"
			done
	} | remote -q -1 -v ON_ERROR_STOP=1 2>"$work/media.err"; then
		log "the uploads could not be mirrored: $(tr '\n' ' ' <"$work/media.err")"
		log "snapshot #$id stays marked incomplete and will not be used"
		rm -rf "$work"
		return 0
	fi

	# Counted from the mirror rather than from the loop, so the numbers in the row describe what was
	# actually stored.
	media="$(remote -q -tA -F' ' -c "select count(*), coalesce(sum(bytes), 0) from vapestack_media where snapshot_id = $id")"
	media_count="${media%% *}"
	media_bytes="${media##* }"

	if ! remote -q -c "update vapestack_snapshots set complete = true, media_count = $media_count, media_bytes = $media_bytes where id = $id" 2>/dev/null; then
		log "snapshot #$id was written but could not be marked complete; it will not be used"
		rm -rf "$work"
		return 0
	fi

	prune_snapshots
	log "snapshot #$id complete - $tables tables, $media_count uploads ($(human_bytes "$media_bytes")), $(human_bytes "$dump_bytes") dump, $label"
	rm -rf "$work"
}

# Interrupted exports are never restored, so they are only kept long enough to be looked at. Old
# complete snapshots are dropped to KEEP, which is the only thing bounding what the mirror costs.
prune_snapshots() {
	remote -q -c "delete from vapestack_snapshots where not complete and created_at < now() - interval '1 day'" >/dev/null 2>&1
	remote -q -c "delete from vapestack_snapshots where complete and id not in (select id from vapestack_snapshots where complete order by id desc limit $KEEP)" >/dev/null 2>&1
}

restore_media() {
	local id="$1" path b64 written=0
	# A path may contain a space, so the separator is a tab; `order by path` keeps the output
	# deterministic and lets the progress line be meaningful.
	remote -q -tA -F $'\t' -c "select path, content->>'b64' from vapestack_media where snapshot_id = $id order by path" 2>/dev/null |
		while IFS=$'\t' read -r path b64; do
			[ -n "$path" ] || continue
			# The paths come from this project's own uploads directory, but a snapshot is remote data
			# and a path is a path: absolute and parent-traversing ones are refused rather than trusted.
			case "$path" in
			/* | *..*)
				log "refusing a suspicious path in the snapshot: $path"
				continue
				;;
			esac
			mkdir -p "$UPLOADS/$(dirname "$path")" || continue
			if printf '%s' "$b64" | base64 -d >"$UPLOADS/$path" 2>/dev/null; then
				written=$((written + 1))
			else
				log "could not write $path"
			fi
		done
}

cmd_hydrate() {
	local force=0
	[ "${1:-}" = '--force' ] && force=1

	if ! configured; then
		log "$(unconfigured_reason); nothing to hydrate from"
		return 0
	fi
	warn_about_host

	local tables
	tables="$(db_table_count)"
	if [ "$tables" != '0' ] && [ "$force" != '1' ]; then
		log "the local database already holds $tables tables; leaving it alone (--force replaces it)"
		return 0
	fi

	local work id
	work="$(mktemp -d)" || return 0

	id="$(remote -q -tA -c 'select id from vapestack_snapshots where complete order by id desc limit 1' 2>/dev/null)"
	case "$id" in
	'' | *[!0-9]*)
		log 'the mirror holds no complete snapshot; carrying on with whatever is local'
		rm -rf "$work"
		return 0
		;;
	esac

	log "restoring snapshot #$id"
	if ! remote -q -tA -c "select db_dump from vapestack_snapshots where id = $id" >"$work/dump.b64" 2>"$work/fetch.err"; then
		log "the snapshot could not be read: $(tr '\n' ' ' <"$work/fetch.err")"
		rm -rf "$work"
		return 0
	fi

	if ! base64 -d <"$work/dump.b64" 2>"$work/b64.err" | gunzip >"$work/dump.sql" 2>"$work/gunzip.err"; then
		log "the snapshot's database dump is not readable: $(tr '\n' ' ' <"$work/b64.err") $(tr '\n' ' ' <"$work/gunzip.err")"
		rm -rf "$work"
		return 0
	fi

	if [ "$force" = '1' ]; then
		# A dump only drops the tables it names, so a table added since the snapshot would survive a
		# plain restore and leave the site half in each. Recreating the database is the only way to be
		# sure; the app user may not be allowed to, and the restore below is still correct for a
		# snapshot of this same site, so a refusal here is a note rather than a stop.
		db -e "drop database if exists \`$DB_NAME\`; create database \`$DB_NAME\` character set utf8mb4" 2>/dev/null ||
			log 'could not recreate the database; restoring over what is there instead'
	fi

	if ! db "$DB_NAME" <"$work/dump.sql" 2>"$work/restore.err"; then
		log "the restore failed: $(tr '\n' ' ' <"$work/restore.err")"
		rm -rf "$work"
		return 0
	fi

	log "database restored: $(db_table_count) tables"
	restore_media "$id"

	# This script runs as root, and WordPress runs as www-data, which the kit's image maps onto the
	# host developer's uid. Without this the restored photographs would be root-owned on the host and
	# uneditable by the person who owns the project.
	chown -R www-data:www-data "$UPLOADS" 2>/dev/null || true
	log "uploads restored: $(local_media_count) files ($(human_bytes "$(local_media_bytes)"))"

	rm -rf "$work"
}

cmd_status() {
	log "local:  $(db_table_count) tables, $(local_media_count) uploads ($(human_bytes "$(local_media_bytes)")), WordPress $(wp_version)"

	if ! configured; then
		log "mirror: off - $(unconfigured_reason)"
		return 0
	fi

	local latest
	latest="$(remote -q -tA -F'|' -c "select id || ' - ' || to_char(created_at, 'YYYY-MM-DD HH24:MI') || ' - ' || media_count || ' uploads, ' || pg_size_pretty(db_bytes) || ' dump' from vapestack_snapshots where complete order by id desc limit 1" 2>/dev/null)"
	if [ -z "$latest" ]; then
		log 'mirror: reachable, but it holds no complete snapshot yet - run: bash tools/mirror.sh push'
		return 0
	fi
	log "mirror: newest #$latest (keeping $KEEP)"
}

cmd_list() {
	if ! configured; then
		log "$(unconfigured_reason)"
		return 0
	fi
	remote -c "select id,
                         to_char(created_at, 'YYYY-MM-DD HH24:MI') as created,
                         case when complete then 'complete' else 'partial' end as state,
                         table_count                                        as tables,
                         media_count                                        as uploads,
                         pg_size_pretty(db_bytes)                           as dump
                    from vapestack_snapshots
                order by id desc"
}

case "${1:-status}" in
export) shift && cmd_export "$@" ;;
hydrate) shift && cmd_hydrate "$@" ;;
status) cmd_status ;;
list) cmd_list ;;
-h | --help | help) sed -n '2,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' ;;
*)
	log "unknown subcommand: $1"
	printf 'Try: export | hydrate [--force] | status | list\n' >&2
	exit 2
	;;
esac
