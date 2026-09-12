#!/usr/bin/env bash
#
# Install the Gutenberg-to-GraphQL plugin into this project's WordPress.
#
# Why a script rather than a commit: the plugin is 83 files of somebody else's PHP, and this
# repository does not vendor dependencies it can pin instead. The version is pinned here, the files
# land in `wp-content/plugins/wp-graphql-content-blocks/` - a bind-mounted project directory, not
# the container's volume - and the whole thing is reversible by deleting that directory and the
# mount line `wpdev add plugin` wrote.
#
# `wpdev add plugin <slug>` creates the directory, adds the mount and activates a local stub; this
# then replaces the stub with the release. It is safe to re-run: it unpacks over the top.
#
# Usage:  tools/install-blocks-plugin.sh [--version 4.8.6]
#
set -euo pipefail

# wpengine/wp-graphql-content-blocks - the maintained one. The plugin the brief named,
# pristas-peter/wp-graphql-gutenberg, last shipped in 2022 and targets wp-graphql 1.x, which this
# project (2.22.3) is a major version past.
VERSION="4.8.6"
SLUG="wp-graphql-content-blocks"
REPO="wpengine/wp-graphql-content-blocks"

while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="${2:?--version needs a value}"; shift 2 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="$PROJECT_DIR/wp-content/plugins/$SLUG"
ARCHIVE="https://github.com/$REPO/releases/download/v$VERSION/$SLUG.zip"

if [ ! -d "$PROJECT_DIR/wp-content/plugins" ]; then
  echo "not a project with a plugins directory: $PROJECT_DIR" >&2
  exit 1
fi

if [ ! -d "$PLUGIN_DIR" ]; then
  cat >&2 <<EOF
$PLUGIN_DIR does not exist yet.

Run this first, from the project directory, so the directory is created *and mounted* (a plugin
unpacked into the container's volume would survive a restart but not a fresh clone):

  wpdev add plugin $SLUG
EOF
  exit 1
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

echo "downloading $REPO v$VERSION"
curl -fsSL -o "$work/$SLUG.zip" "$ARCHIVE"

python3 - "$work/$SLUG.zip" "$PLUGIN_DIR" "$SLUG" <<'PY'
"""Unpack the release into the plugin directory, preserving the mode bits it ships with."""
import os
import shutil
import sys
import zipfile

archive, destination, slug = sys.argv[1], sys.argv[2], sys.argv[3]
extracted = os.path.join(os.path.dirname(archive), "unpacked")

with zipfile.ZipFile(archive) as bundle:
    names = bundle.namelist()
    if not any(name.startswith(f"{slug}/") for name in names):
        raise SystemExit(f"{archive} does not contain a {slug}/ directory")
    bundle.extractall(extracted)

source = os.path.join(extracted, slug)
if not os.path.isfile(os.path.join(source, f"{slug}.php")):
    raise SystemExit(f"the release has no {slug}.php: refusing to install a partial plugin")

copied = 0
for root, _directories, files in os.walk(source):
    relative = os.path.relpath(root, source)
    target = destination if relative == "." else os.path.join(destination, relative)
    os.makedirs(target, exist_ok=True)
    for name in files:
        shutil.copy2(os.path.join(root, name), os.path.join(target, name))
        copied += 1

print(f"unpacked {copied} files into {destination}")
PY

echo
echo "version in the plugin header:"
grep -m1 -i '^ \* Version:' "$PLUGIN_DIR/$SLUG.php" || echo "  (no header version found)"

echo
echo "now activate it and check:"
echo "  wpdev wp plugin activate $SLUG"
echo "  wpdev wp plugin list --status=active"
