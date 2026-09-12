#!/usr/bin/env bash
#
# Give the checkout a Stripe account, in one command.
#
# Without these values the shop still works: QR payment and cash on delivery are recorded exactly as
# they are now, and the card method says why it cannot start. This script supplies the missing half —
# it takes the keys from the Stripe dashboard, refuses anything that is not test mode, proves the
# secret key against Stripe's own API, and writes all three into `frontend/.env.local`.
#
# **Run this yourself, in your own terminal.** Both secrets are read with `read -s`, so neither is
# echoed, passed as an argument (which would put it in your shell history and in `ps`) or seen by
# anything but this shell and the file it writes.
#
#   bash tools/configure-stripe.sh                 # asks for all three
#   bash tools/configure-stripe.sh --no-webhook    # just the two API keys
#
# The two API keys come from <https://dashboard.stripe.com/test/apikeys> with the dashboard's
# **Test mode** toggle on. They start `pk_test_` and `sk_test_`; a live key (`pk_live_`, `sk_live_`)
# is refused here, because every page that takes a card says test mode and that has to stay true.
# Test mode needs no activated account: no bank details, no company details, no verification.
#
# The webhook signing secret comes from one of two places. Locally, `stripe listen --forward-to
# localhost:3002/api/stripe/webhook` prints one — the Stripe CLI is not installed on this machine,
# so that is a download from <https://github.com/stripe/stripe-cli/releases>. On the deployment it is
# the secret of the endpoint registered in the dashboard (Developers → Webhooks). Leave it blank and
# the shop still takes payments; the order simply stays `pending` until a webhook or a read
# reconciles it, which is slower but not wrong.
#
# For the deployed site the same three values also go into Vercel (Settings → Environment
# Variables, then redeploy). `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is inlined at build time, so it
# must exist *before* the build; the two secrets are read at request time.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/frontend/.env.local"

WANT_WEBHOOK=1

while [ $# -gt 0 ]; do
	case "$1" in
	--no-webhook)
		WANT_WEBHOOK=0
		shift
		;;
	-h | --help)
		sed -n '2,32p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
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

printf 'Paste your Stripe **publishable** key (pk_test_…): '
read -r PUBLISHABLE

if [ -z "$PUBLISHABLE" ]; then
	echo "No key entered, nothing changed." >&2
	exit 1
fi

case "$PUBLISHABLE" in
pk_live_*)
	echo "That is a live publishable key. This shop takes test-mode payments only." >&2
	exit 1
	;;
pk_test_*) ;;
*) echo "That does not look like a Stripe publishable key (they start with pk_test_). Continuing anyway." >&2 ;;
esac

printf 'Paste your Stripe **secret** key (sk_test_…, input is hidden): '
read -rs SECRET
printf '\n'

if [ -z "$SECRET" ]; then
	echo "No secret key entered, nothing changed." >&2
	exit 1
fi

case "$SECRET" in
sk_live_*)
	echo "That is a live secret key. This shop takes test-mode payments only, and a live key here would charge real cards." >&2
	exit 1
	;;
sk_test_*) ;;
*) echo "That does not look like a Stripe secret key (they start with sk_test_). Continuing anyway." >&2 ;;
esac

WEBHOOK=""

if [ "$WANT_WEBHOOK" -eq 1 ]; then
	printf 'Paste the webhook signing secret (whsec_…), or just press Enter to skip: '
	read -rs WEBHOOK
	printf '\n'

	case "$WEBHOOK" in
	"") echo "No webhook secret: the order will stay pending until something reconciles it." >&2 ;;
	whsec_*) ;;
	*) echo "That does not look like a signing secret (they start with whsec_). Continuing anyway." >&2 ;;
	esac
fi

if [ -z "$WEBHOOK" ]; then
	# Keep whatever is already there rather than blanking it: `--no-webhook` must not undo a
	# previous run.
	WEBHOOK="$(sed -n 's/^STRIPE_WEBHOOK_SECRET=//p' "$ENV_FILE" | head -1)"
fi

echo "Asking Stripe about the account …"

# The same request the dashboard makes in its own right, so a key that works here works in the app.
rm -f /tmp/stripe-key-check.json
STATUS="$(
	curl -sS -o /tmp/stripe-key-check.json -w '%{http_code}' \
		https://api.stripe.com/v1/balance \
		-H "Authorization: Bearer $SECRET"
)"

if [ "$STATUS" != "200" ]; then
	echo >&2
	echo "Stripe refused the secret key (HTTP $STATUS):" >&2
	# Stripe's own message echoes the beginning and end of a bad key, so mask anything key-shaped
	# before it reaches the terminal.
	sed 's/\(sk_\|pk_\|whsec_\)[A-Za-z0-9_]*/\1***/g' /tmp/stripe-key-check.json >&2 2>/dev/null || true
	echo >&2
	echo "Nothing was written to $ENV_FILE. Check the key (and that the dashboard is in test mode)." >&2
	rm -f /tmp/stripe-key-check.json
	exit 1
fi

rm -f /tmp/stripe-key-check.json

# Replaces each line if the example's empty one is already there, appends it if not.
awk -v publishable="$PUBLISHABLE" -v secret="$SECRET" -v webhook="$WEBHOOK" '
	/^NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=/ { print "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=" publishable; seen_pk = 1; next }
	/^STRIPE_SECRET_KEY=/ { print "STRIPE_SECRET_KEY=" secret; seen_sk = 1; next }
	/^STRIPE_WEBHOOK_SECRET=/ { print "STRIPE_WEBHOOK_SECRET=" webhook; seen_wh = 1; next }
	{ print }
	END {
		if (!seen_pk) print "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=" publishable
		if (!seen_sk) print "STRIPE_SECRET_KEY=" secret
		if (!seen_wh) print "STRIPE_WEBHOOK_SECRET=" webhook
	}
' "$ENV_FILE" >"$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE"

printf '\nStripe accepted the key. Written to %s (mode 600).\n' "$ENV_FILE"

# Quoted delimiter, deliberately: an unquoted one runs every backtick in this block as a command,
# so `next dev` in prose becomes "next: command not found" and the instructions come out mangled.
cat <<'EOF'

Next:

  1. Restart anything already serving the app, so it picks the keys up. `next dev` reloads them by
     itself; a running `next start` does not.
  2. Pay with a test card at /checkout: 4242 4242 4242 4242 succeeds, 4000 0000 0000 0002 is
     declined, and 4000 0025 0000 3155 needs Stripe's own authentication step. Any future expiry,
     any 3-digit code, any postcode.
  3. Add the same three values to the deployed site: Vercel → the project → Settings →
     Environment Variables, then redeploy (the publishable key is inlined at build time, so it has
     to be there before the build). Register the webhook endpoint in the Stripe dashboard against
     https://<your-deployment>/api/stripe/webhook, and put *its* signing secret in Vercel.
EOF
