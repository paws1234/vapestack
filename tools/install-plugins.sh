#!/usr/bin/env bash
#
# Install the plugins this project needs and the shared kit image does not carry.
#
# The kit bakes only its own packages into /opt/packages when the shared image is built. WooCommerce
# and the two GraphQL plugins are specific to this site, so they are fetched here instead of being
# added to the kit's cache: a project does not get to edit the shared kit to get what it needs.
#
# They land in wp-content/plugins, which this project's Docker volume holds, so they survive a
# container rebuild or recreate, and only go when the volume does (`wpdev destroy`). Re-run this
# script after that.
#
# Safe to re-run. Needs network the first time.
#
#   bash tools/install-plugins.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WPDEV="${WPDEV:-$(command -v wpdev || echo "$HOME/Desktop/dev/wp-kit/bin/wpdev")}"

if [ ! -x "$WPDEV" ]; then
	echo "wpdev not found at $WPDEV. Set WPDEV=/path/to/wp-kit/bin/wpdev and re-run." >&2
	exit 1
fi

# slug|url. Order matters: WooCommerce has to be active before the plugin that extends its schema.
PLUGINS=(
	"woocommerce|https://downloads.wordpress.org/plugin/woocommerce.zip"
	"wp-graphql|https://downloads.wordpress.org/plugin/wp-graphql.zip"
	# Not published under this name in the plugin directory, so it comes from the GitHub release.
	"wp-graphql-woocommerce|https://github.com/wp-graphql/wp-graphql-woocommerce/releases/latest/download/wp-graphql-woocommerce.zip"
)

cd "$PROJECT_DIR"

for entry in "${PLUGINS[@]}"; do
	slug="${entry%%|*}"
	url="${entry##*|}"

	if "$WPDEV" wp plugin is-installed "$slug" >/dev/null 2>&1; then
		echo "  $slug: already installed"
		"$WPDEV" wp plugin activate "$slug" --quiet
	else
		echo "  $slug: installing"
		"$WPDEV" wp plugin install "$url" --activate
	fi
done

echo
"$WPDEV" wp plugin list --status=active --fields=name,version
