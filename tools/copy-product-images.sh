#!/usr/bin/env bash
#
# Copy the catalogue's product images into the storefront so the deployed site does not depend on
# WordPress being reachable.
#
# WordPress serves its uploads from its own host, and generates several sizes of every one. The
# deployed storefront cannot rely on either: the WordPress it reads from lives behind a tunnel that
# only exists while this machine is running. The nine full-size images the seeder generates are
# therefore committed into frontend/public/products/, and the data layer maps the catalogue's image
# URLs onto them (see frontend/src/lib/wp/localImages.ts).
#
# Re-run this after re-seeding with different images, then commit the result.
#
#   bash tools/copy-product-images.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPLOADS_DIR="$PROJECT_DIR/wp-content/uploads"
TARGET_DIR="$PROJECT_DIR/frontend/public/products"

if [ ! -d "$UPLOADS_DIR" ]; then
	echo "No $UPLOADS_DIR. Run this from a checkout of the project." >&2
	exit 1
fi

mkdir -p "$TARGET_DIR"

# WordPress's own resizes end in -<width>x<height>. Only the originals are wanted: Next's image
# optimiser generates whatever sizes the pages actually ask for.
copied=0

while IFS= read -r source; do
	name="$(basename "$source")"
	cp "$source" "$TARGET_DIR/$name"
	copied=$((copied + 1))
done < <(find "$UPLOADS_DIR" -type f -name 'vapestack-*.png' ! -name '*-[0-9]*x[0-9]*.png' | sort)

if [ "$copied" -eq 0 ]; then
	echo "No full-size vapestack-*.png under $UPLOADS_DIR - has the catalogue been seeded?" >&2
	exit 1
fi

echo "Copied $copied image(s) into frontend/public/products/"
ls -1 "$TARGET_DIR"
