#!/usr/bin/env bash
#
# Give the contact form a mail provider, in one command.
#
# Without `RESEND_API_KEY` the form still works, but it cannot send: `POST /api/contact` answers 503
# and the page hands the visitor's message to their own mail client. This script supplies the missing
# half — it takes a Resend API key, proves it works by sending one real test email, and then writes it
# into `frontend/.env.local`.
#
# **Run this yourself, in your own terminal.** The key is read with `read -s`, so it is never echoed,
# never passed as an argument (which would put it in your shell history and in `ps`) and never seen by
# anything but this shell and the file it writes.
#
#   bash tools/configure-contact-mail.sh              # test email goes to the site's own address
#   bash tools/configure-contact-mail.sh --to me@example.com
#   bash tools/configure-contact-mail.sh --from "Vapestack <contact@yourdomain.com>"
#
# A key comes from <https://resend.com/api-keys>. No verified domain is needed: the default sender is
# Resend's shared `onboarding@resend.dev`, which can only deliver to the address that owns the
# account — which is the site's own inbox, so it fits exactly this use. Set `--from` once you have a
# domain verified at Resend.
#
# For the deployed site the same key goes into Vercel's environment variables (Settings →
# Environment Variables → Add, then redeploy). It is read at request time, so no rebuild is needed
# after a *change* — but a brand-new Variable does need a deployment to exist at all.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/frontend/.env.local"

# Must match CONTACT_EMAIL in frontend/src/lib/site.ts, which is the address the contact page prints.
TO="pawsmedz@gmail.com"

# Must match DEFAULT_FROM in frontend/src/lib/contact-mail.ts.
FROM="Vapestack contact form <onboarding@resend.dev>"

while [ $# -gt 0 ]; do
	case "$1" in
	--to)
		TO="${2:?--to needs an address}"
		shift 2
		;;
	--from)
		FROM="${2:?--from needs a sender}"
		shift 2
		;;
	-h | --help)
		sed -n '2,25p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
		exit 0
		;;
	*)
		echo "Unknown argument: $1 (try --help)" >&2
		exit 2
		;;
	esac
done

if [ ! -f "$ENV_FILE" ]; then
	echo "$ENV_FILE does not exist. Copy the example beside it first:" >&2
	echo "  cp frontend/.env.local.example frontend/.env.local" >&2
	exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
	echo "curl is required." >&2
	exit 1
fi

printf 'Paste your Resend API key (input is hidden): '
read -rs KEY
printf '\n'

if [ -z "$KEY" ]; then
	echo "No key entered, nothing changed." >&2
	exit 1
fi

case "$KEY" in
re_*) ;;
*) echo "That does not look like a Resend key (they start with re_). Continuing anyway." >&2 ;;
esac

echo "Sending a test message to $TO …"

# The same request `src/lib/contact-mail.ts` makes, so a key that works here works there.
BODY="$(KEY="$KEY" FROM="$FROM" TO="$TO" node -e '
	const { KEY, FROM, TO } = process.env;
	process.stdout.write(JSON.stringify({
		from: FROM,
		to: [TO],
		subject: "Vapestack contact form: test message",
		text: "If you are reading this, the contact form can send.\n\nSent by tools/configure-contact-mail.sh.",
	}));
')"

rm -f /tmp/contact-mail-test.json
STATUS="$(
	curl -sS -o /tmp/contact-mail-test.json -w '%{http_code}' \
		-X POST https://api.resend.com/emails \
		-H "Authorization: Bearer $KEY" \
		-H 'Content-Type: application/json' \
		--data-raw "$BODY"
)"

if [ "$STATUS" != "200" ]; then
	echo >&2
	echo "Resend refused the key (HTTP $STATUS):" >&2
	# `>&2 2>/dev/null` in that order: cat's own errors are dropped, its output is what the user
	# needs. Reversed, the body goes to /dev/null and a refusal explains nothing.
	cat /tmp/contact-mail-test.json >&2 2>/dev/null || true
	echo >&2
	echo "Nothing was written to $ENV_FILE. Check the key and run this again." >&2
	rm -f /tmp/contact-mail-test.json
	exit 1
fi

rm -f /tmp/contact-mail-test.json

# Replaces the line if the example's empty `RESEND_API_KEY=` is already there, appends it if not.
awk -v key="$KEY" '
	/^RESEND_API_KEY=/ { print "RESEND_API_KEY=" key; written = 1; next }
	{ print }
	END { if (!written) print "RESEND_API_KEY=" key }
' "$ENV_FILE" >"$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"

printf '\nSent. Check %s — the test message should be there.\n' "$TO"

# Quoted delimiter, deliberately: an unquoted one runs every backtick in this block as a command,
# so `next dev` in prose becomes "next: command not found" and the instructions come out mangled.
cat <<'EOF'

The key is now in frontend/.env.local (mode 600). Next:

  1. Restart anything already serving the app, so it picks the key up. `next dev` reloads it by
     itself; a running `next start` does not:
         kill $(ss -ltnp 2>/dev/null | grep -E ':(3000|3001) ' | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u)
         env -C frontend nohup npx next start -p 3000 >/tmp/vapestack-next-3000.log 2>&1 &
  2. Add the same key to the deployed site: Vercel → the project → Settings → Environment Variables
     → Add, name RESEND_API_KEY, then redeploy so the new variable exists.
EOF
