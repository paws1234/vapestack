#!/usr/bin/env bash
#
# Hydrate the site, then hand the container over to Apache untouched.
#
# The kit's stack starts WordPress straight from the image's own entrypoint. Wrapping it is the only
# way to run something *before* Apache has the web root, which is where rebuilding from a snapshot
# has to happen. The other half of the architecture - writing a snapshot out on the way down -
# deliberately does **not** live here; it is a `pre_stop` hook in docker-compose.override.yml, and
# the reasoning for that split is worth keeping, because the obvious approach does not work:
#
#     boot   -> hydrate, then exec the image's entrypoint and get out of the way
#     run    -> Apache, exactly as WordPress ships it
#     stop   -> pre_stop runs state.sh export, so this script is not involved at all
#
# **Why the export is not a signal trap here.** The first version of this file trapped SIGTERM,
# forwarded it to Apache, waited, and then exported - the canonical container pattern. It does not
# work on this machine. Measured with Docker 29.7.2 on the kit's image, a bash script as PID 1 with
# `trap ... TERM` never saw the signal at all: `docker stop -t 60` waited the full 60s and SIGKILLed
# (exit 137), with no trap output even written to unbuffered stderr, and Apache logged no "caught
# SIGTERM" line either. `pre_stop` was then verified to run, as root, *before* the container stops -
# so the export happens with Apache and MariaDB both still up, which is strictly better anyway.
#
# Hence `exec`: it hands over to the image's own entrypoint, whose entire setup - copying core into an
# empty web root, generating wp-config.php from WORDPRESS_DB_*, fixing wp-content ownership - is
# nested inside a check on `apache2-foreground`, the first argument Compose passes from `command:`.
# It also leaves Apache as PID 1, which is what makes Docker's SIGTERM stop it properly.
#
# Hydration is best effort. If the mirror is unconfigured, paused or unreachable, the site boots
# empty-handed and serves normally; that isolation is the point, so it may not decide the
# container's fate or its exit code.

set -uo pipefail

/opt/mirror/state.sh hydrate || true

exec /usr/local/bin/docker-entrypoint.sh "$@"
