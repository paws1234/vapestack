# A thin layer on top of the kit's shared dev image, adding only what the state mirror needs.
#
# `wp-dev:php8.3` is built once by the kit and shared by every project on this machine, so it is
# deliberately not edited: adding these packages to it would change every other project's image at
# the same time. This file extends it instead, and `docker-compose.override.yml` points the
# wordpress service at the result.
#
# Two clients, one reason each:
#
#   * `mariadb-client` - `mariadb-dump` and `mariadb`, the database half of a snapshot. The image
#     has no client at all today, which is why `wp db export` fails here (see CLAUDE.md), and why
#     the mirror cannot borrow WP-CLI's dump command.
#   * `postgresql-client` - `psql`, the only way to reach the mirror. Note that only the *client* is
#     installed: PostgreSQL is remote, never a local runtime.
#
# `--no-install-recommends` plus the cleared apt lists keep the layer small. The base image already
# appends `precedence ::ffff:0:0/96 100` to /etc/gai.conf, so apt resolves and downloads over IPv4
# rather than hanging on an AAAA record this container has no route to.

FROM wp-dev:php8.3

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		mariadb-client \
		postgresql-client \
	&& rm -rf /var/lib/apt/lists/*

# The mirror's own scripts. Copied in so the image stands alone, and bind-mounted over from
# `./mirror` during development so that editing a script takes effect on restart rather than on
# rebuild.
COPY mirror/ /opt/mirror/
RUN chmod +x /opt/mirror/*.sh
