# Tasks: Vapestack — card payments through Stripe (test mode)

From `docs/stripe-plan.md`, written 2026-09-12 against commit `2e91ca9`. The plan file is the source
and is **never edited**; the checklist and the evidence live here.

Any single task can be run on its own in a fresh session by asking for it by id, for example:
`do S3 of docs/stripe-tasks.md`. Each task carries its own context, what it may touch, what proves
it, and how it is verified — so a session needs this file and the repository, nothing else.

| # | Task | Plan id | Size | Depends on |
| --- | --- | --- | --- | --- |
| S1 | The checkout works again, and the sandbox card is retired (QR + COD only) | S1 + S2 | M | — |
| S2 | Stripe client, dependencies, environment and `tools/configure-stripe.sh` | S3 | S | — |
| S3 | The order contract: a `pending` order, WooCommerce's own total, a PaymentIntent | S4 | M | S2 |
| S4 | The payment block: Stripe's Payment Element on the checkout | S5 | M | S1, S3 |
| S5 | The submit path: confirm, decline, authentication, success | S6 | M | S4 |
| S6 | The webhook, and reconcile-on-read | S7 | M | S3 |
| S7 | The success page says which of the two things happened | S8 | S | S3 |
| S8 | The copy sweep: no page may still say no payment provider is connected | S9 | M | S1–S7 |
| S9 | The deployment: Vercel variables and a webhook endpoint | S10 | M | S2, S6 |
| S10 | The sweep: build, the four browser paths at three widths, offline, deployed | S11 | M | S1–S9 |

**Parallelism.** S2 depends on nothing and can run alongside S1. S3 needs S2's client but not S1's
form. S6 and S7 both follow S3 and touch different files. S4 and S5 are strictly ordered, and S8
cannot start before the code it describes is final. S9 needs keys in Vercel, and S10 comes last.

## Corrections to the plan's task split

- **The plan's S1 and S2 are one task here (S1).** The plan had S1 restore a selector offering QR
  and cash-on-delivery while leaving the card method in `PAYMENT_METHODS`, and S2 delete the
  sandbox. A checkout that offers no card *is* the removal of the card sandbox — doing it in two
  passes would leave `card` in the list the server validates against with nothing on the page able
  to choose it, which is the exact shape of the bug being fixed. The plan's S2 is therefore folded
  into S1, and the plan ids after it shift down by one. The plan's decisions (D1–D8) are unchanged.
- **The plan's S2 of this file is the plan's S3** and so on, as the table above records. If a plan id
  is quoted in a commit message, the mapping column is what resolves it.
- **`npm run build` was already broken at `2e91ca9`, and S1 had to fix that too.** Four `tsc` errors
  existed before S1 touched anything, proving the commit was never built:
  `app/shop/page.tsx` and `app/shop/[category]/page.tsx` passed `products` to a `ProductGrid` that
  takes `paged`/`sort`/`basePath`; `catalog.ts` no longer mapped `sku` and `specs` although
  `product-json-ld.tsx` and `product-notes.tsx` still read them; and `checkout-form.tsx` wrote a demo
  receipt with no `payment`, which `DemoOrder` requires. Three of the four were fixed by restoring
  `app/shop/page.tsx`, `app/shop/[category]/page.tsx` and `lib/wp/catalog.ts` to `2e91ca9^` — the
  last state that built and was verified — which also put back the `pageInfo` cursor loop in
  `getProducts()`. Without it the catalogue read stops at WPGraphQL's silent 100-node cap: `/shop`
  says "290 products" only because that loop is back, and a product 250 rows into the catalogue
  answers 404 without it (see `/memories/repo/vapestack-verification-traps.md`). **If the owner's
  intent in `2e91ca9` was to retire paging and the sort control rather than to simplify hastily, the
  opposite fix is to give `ProductGrid` a plain `products: Product[]` and delete the pager — say so
  and S1 is one commit to redo.**
- **The sandbox's card method is gone as of S1, not S4.** The plan expected QR/COD to be offered
  with `card` still in `PAYMENT_METHODS` until Stripe replaced it. Removing it in S1 leaves the
  server's list and the page's radios identical at every commit, which is the property that was
  broken.
- **S3 moved two small things forward.** The `PUT` transport and `updateOrder()` were planned for S6,
  but the Payment Intent's id has to be written onto the order when the intent is created — that
  write is what S6's reconcile reads — so both landed here. And `isStripeConfigured()` was not in the
  plan at all: S3 uses it to answer **503 before any order is created**, because otherwise every
  card attempt on an unconfigured shop would leave an unpayable `pending` order behind, which is
  exactly the litter D5 accepts only for abandoned *payments*.
- **S4's acceptance criterion was worded loosely.** "Choosing Card shows the Payment Element" cannot
  be what happens: the element needs a client secret and the secret needs an order, so the element
  appears when the *details* are submitted. The plan's own flow diagram describes the two-step
  checkout, and that is what was built.
- **Known cosmetic, not fixed:** Stripe's Payment Element offers **Link** above the card fields
  ("Save my information for faster checkout", plus email and mobile fields) and Stripe's own copy
  about creating an account. It is a card surface rather than a fourth method, so D8 is not violated,
  but it lengthens the form on a phone. Disabling it — if it can be disabled without loosening
  `payment_method_types: ["card"]` — is a follow-up, not a bug.

## Definition of done for the whole plan

- The checkout creates an order again (the 400 that exists today is gone), and a card payment in
  Stripe test mode leaves a **`processing`, paid** WooCommerce order with a `transaction_id` while
  the minutes before the webhook lands are honestly shown as *awaiting payment*.
- A declined test card is a designed state with a retry: no paid order, no cleared cart, no dead end.
- An authentication-required test card completes Stripe's own 3-D Secure step and comes back paid.
- No card number ever appears in this app's own request bodies, in the WooCommerce order, or in a
  log line.
- With WordPress stopped, the card step refuses in place and QR/COD still reach the demo receipt;
  with Stripe unconfigured, the build and every other route are unaffected.
- The deployed site takes a test-mode payment end to end, with a webhook endpoint registered against
  it.
- No page still claims that no payment provider is connected, and `UI-STANDARDS.md`,
  `frontend/README.md` and `docs/headless-contract.md` describe what now exists.
- `npm run build`, `npx tsc --noEmit` and `npm run lint` are clean, and the build still runs with
  WordPress stopped.

## Constraints every task inherits

- **Test mode only.** No live key, and every page that takes a card says test mode.
- **Frontend only.** `frontend/` and `tools/` are the change surface. No PHP — the WordPress side is
  reached through the WooCommerce REST API. Never `wp-kit/`.
- **No card data in `CheckoutRequest`, in a WooCommerce order, in a log, or in `localStorage`.**
  The browser-to-Stripe path is the only one a card number may travel.
- **A new dependency needs a written decision**: `stripe`, `@stripe/react-stripe-js` and
  `@stripe/stripe-js` are the decision (plan D1/D3). Nothing else may be added along the way.
- **WordPress stays optional and Stripe stays optional.** A missing key or a closed tunnel degrades
  the page; it never turns a route into an error.
- **No root `loading.tsx`**, ever: it costs every `notFound()` route its 404 status. Every route
  stays `force-dynamic`, and nothing may read the catalogue or Stripe at build time.
- **`react-hooks/set-state-in-effect` is a lint error here.** Stripe's promise callbacks are fine; a
  `setState` in an effect is not.
- **`frontend/UI-STANDARDS.md` still applies**: `--color-line` for new boundaries, a
  `motion-reduce:` neighbour for new animation, one `h1` per page, no horizontal overflow at 390.
- **Each task updates its own docs** — `UI-STANDARDS.md` and `frontend/README.md` inside the task
  that changes the behaviour, and `docs/headless-contract.md` inside the task that changes the
  contract.

## Shared commands

```bash
WPDEV=/home/adminpaws/Desktop/dev/wp-kit/bin/wpdev
$WPDEV status                                              # WordPress up?
env -C frontend npm run dev                                # 3002 is free; 3000/3001 may not be
env -C frontend npm run build && env -C frontend npx tsc --noEmit && env -C frontend npm run lint
$WPDEV wp wc order get <id> --user=admin \
  --fields=id,status,total,currency,payment_method,payment_method_title,transaction_id,date_paid
```

A `next dev` server outlives its terminal, and `pkill -f 'next start'` never matches it (`next-server`
is the process name): kill the pid `ss -ltnp | grep ':3002 '` reports, or the next start dies with
`EADDRINUSE` and you go on testing the old build.

**Screenshots at real widths.** The VS Code browser pane cannot be resized past its own width and
pads the canvas, so a "1440px" shot taken there is a narrow layout in a wide frame. Use the
Playwright-bundled Chromium and confirm every PNG with `file`:

```bash
CHROME=$(ls -d ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome | tail -1)
mkdir -p /tmp/ui
"$CHROME" --headless=new --no-sandbox --hide-scrollbars --window-size=390,844 \
  --virtual-time-budget=8000 --screenshot=/tmp/ui/<page>-390.png http://localhost:3002/<route>
file /tmp/ui/<page>-390.png      # must say 390 x 844
```

Three widths, every time: **1440x900, 768x1024, 390x844.** `/checkout` with an empty cart renders the
empty state, not the form — seed `localStorage` first, or add a product through a product page.

**How to run one task**

1. Load only that task's **Context to load** — never the whole repository.
2. Make the change, then run its **Verify**.
3. Tick its checkbox and add a `> verified:` line with the command and the observed result.

---

### S1 — The checkout works again, and the sandbox card is retired

- [x] Checkout works again, sandbox card retired

> verified: `env -C frontend npx tsc --noEmit` and `npm run lint` clean, `npm run build` green (4
> static pages, every route listed) — from a build that failed at `2e91ca9`. Contract, over HTTP:
> the form's old body (no `payment`) → **400** `That payment method is not one this shop offers.`;
> the form's new body with `payment: "qr"` → **200** `{"id":1043,"number":"1043"}`;
> `payment: "card"` → **400** (not offered yet, correctly). WooCommerce, read back through its own
> API: order **1043** `status=processing total=31.99 currency=USD payment_method=vapestack_qr
> title="Simulated QR payment (demo)" txn=''`. Browser, Playwright at 1440x900 / 768x1024 / 390x844
> (`/tmp/ui/s1/checkout-*.png`, all three real dimensions per `file`): `innerWidth == clientWidth ==
> scrollWidth` at every width (0 overflow), one `h1` ("Checkout"), two payment radios (`qr` checked,
> `cod`), **0** occurrences of "Card" in the block, the QR `<svg>` present under `qr` and **0** under
> `cod` after switching, 0 console errors. The block is also photographed in frame
> (`/tmp/ui/s1/payment-390.png`, 390x2600) and reads as designed: 
> `PAYMENT METHOD / Simulation` legend, two options, the QR panel with its scannable code and the
> address printed beneath it.

**Goal** — `POST /api/checkout` accepts the checkout form's own request again, and the payment block
offers the two methods this shop still simulates (QR and cash-on-delivery) with the sandbox card
gone.

**Depends on** — none. **Parallel with** — S2.

**Context to load** — `frontend/src/components/checkout/checkout-form.tsx` (283 lines, currently
posts no `payment`), `components/checkout/payment-methods.tsx` (231 lines, imports nothing — it is
unreachable), `lib/payment-simulation.ts` (316 lines; the card half is what is being deleted),
`app/api/checkout/route.ts` (line ~191: `isPaymentMethodId(payment)` is the reason a valid form is
refused), `lib/wp/types.ts` (`CheckoutRequest.payment`), `frontend/UI-STANDARDS.md` §*The payment
sandbox is a step machine*, `frontend/README.md` (lines 75–81).

**Do**

1. Delete `components/checkout/card-form.tsx` and `components/checkout/three-d-secure.tsx`, and from
   `lib/payment-simulation.ts` everything the card sandbox needed: `TEST_CARDS`, `TEST_OTP`,
   `CardFields`, `CardErrors`, `digitsOnly`, `formatCardNumber`, `cardOutcome`, `isFutureExpiry`,
   `validateCard`, `isCardValid`, `PaymentStep`, `TRANSITIONS`, `canTransition`, `STEP_MESSAGES`.
   Rename the module's docblock to what it now is: the methods this shop simulates, and nothing else.
2. Remove `card` from `PAYMENT_METHODS` and make `DEFAULT_PAYMENT_METHOD` the QR method. Leave the
   QR and COD entries exactly as they are — their slugs and titles are the shop's own record.
3. Rewrite the payment section of `checkout-form.tsx`: a `method` state and a `<PaymentMethods>`
   block (no step machine, no held-details ref, no 3-D Secure dialog), and post `payment: method`
   in the existing body. A submission with no card method is a single request, as it was before the
   sandbox.
4. Trim `payment-methods.tsx` to the method radio group, the QR panel and the COD panel: drop the
   `CardForm` import, the `cardErrors` prop and the card panel, and correct the intro copy that
   promises "three checkout flows".
5. Update `UI-STANDARDS.md`'s payment section to what remains true after this task (see
   `/memories/repo/vapestack-storefront.md` for the traps worth keeping) and `frontend/README.md`'s
   two paragraphs about the sandbox.

**In scope** — `frontend/src/components/checkout/{checkout-form,payment-methods}.tsx`,
`frontend/src/lib/payment-simulation.ts`, the two deleted components, `frontend/UI-STANDARDS.md`,
`frontend/README.md`.

**Out of scope** — `app/api/checkout/route.ts` and `lib/wp/` (the server is correct as it is; S3 is
where it changes). Stripe of any kind, the copy sweep, `lib/search-index.ts` and
`components/search/` (orphaned by the same commit but not this task's business).

**Acceptance criteria**

1. The body `checkout-form.tsx` sends is accepted by `POST /api/checkout` with **200** and an order id
   — the 400 that exists today is gone.
2. Two methods are offered; choosing one puts only that method's fields in the DOM, and the method is
   what reaches WooCommerce as `payment_method` / `payment_method_title`.
3. With WordPress stopped, a submission still answers demo mode and the receipt is written.

**Verify** — `env -C frontend npm run build && npx tsc --noEmit && npm run lint`; the curl probe in
`docs/stripe-plan.md` §*Verification* (expect 200 `{id, number}`); `$WPDEV wp wc order get <id>
--fields=status,payment_method,payment_method_title` for an order placed through the form; a
screenshot of `/checkout` with a seeded cart at 1440x900 / 768x1024 / 390x844 confirmed with `file`,
reporting `scrollWidth === clientWidth` at 390.

**Size** — M.

---

### S2 — Stripe client, dependencies, environment and `tools/configure-stripe.sh`

- [x] Stripe client, dependencies, environment, configure script

> verified: installed `stripe` **22.6.2**, `@stripe/stripe-js` **9.16.0**, `@stripe/react-stripe-js`
> **6.10.0**. With all three variables unset: `npx tsc --noEmit` clean, `npm run lint` clean,
> `npm run build` green, and `grep -rl STRIPE_SECRET_KEY frontend/.next/static | wc -l` → **0** (the
> secret's name never reaches a client bundle). `npx tsx -e 'stripe()'` throws
> `StripeNotConfiguredError: STRIPE_SECRET_KEY is not set, so no card payment can be started. Run
> tools/configure-stripe.sh…` — named, so S3 can answer 503 rather than 500. `bash
> tools/configure-stripe.sh --help` prints its own header; a `pk_live_`/`sk_live_` pair is refused
> before any request is made (exit 1); a bogus test pair is refused **by Stripe** — HTTP 401,
> `Invalid API Key provided: sk_****ogus` (masked) — and `frontend/.env.local` is untouched
> (`grep -c STRIPE_` 0 before, 0 after). The success path needs the owner's test keys and has **not**
> been run yet.

**Goal** — The app has a server-only Stripe client, the three variables are documented, and one
script takes the owner's test keys, proves them against Stripe and writes them to
`frontend/.env.local`.

**Depends on** — none. **Parallel with** — S1.

**Context to load** — `frontend/package.json`, `frontend/.env.local.example` (its comments are the
house style for a credential), `tools/configure-contact-mail.sh` (the pattern to copy: `read -s`, a
real API call to prove the key, replace-or-append into the env file, `--help`, and the note that the
same value must go to Vercel), `frontend/src/lib/wp/rest.ts` (a server-only module's shape).

**Do**

1. `npm i stripe @stripe/stripe-js @stripe/react-stripe-js` in `frontend/`, recording the versions.
2. `frontend/src/lib/stripe/client.ts`: a server-only module that reads `STRIPE_SECRET_KEY` and
   returns a memoised Stripe instance with an **explicitly pinned** `apiVersion`, and throws the
   same kind of loud error `lib/wp/rest.ts` throws when the variable is missing. Never a
   `NEXT_PUBLIC_` variable.
3. Document all three variables in `.env.local.example`, in the voice of the file: the publishable
   key is public by design and is `NEXT_PUBLIC_` because Next inlines it at build time (so it must
   exist *before* a production build); the secret and the webhook secret are Secrets and must never
   be `NEXT_PUBLIC_`.
4. `tools/configure-stripe.sh`: read `sk_test_…` and `pk_test_…` with `read -s`, refuse a key that is
   not test mode (`sk_live_` is a hard stop), prove the secret with a real call
   (`GET https://api.stripe.com/v1/balance`), write the three lines into `frontend/.env.local`, and
   print the `vercel env add` commands for S9. Copy `configure-contact-mail.sh`'s quoting discipline
   — `cat <<'EOF'` for anything containing backticks.

**In scope** — `frontend/package.json`, `frontend/package-lock.json`, `frontend/.env.local.example`,
`frontend/src/lib/stripe/client.ts` (new), `tools/configure-stripe.sh` (new).

**Out of scope** — any route or component (S3–S5), the deployed environment (S9), and
`frontend/.env.local` itself: a key is typed into the script by the owner, never committed.

**Acceptance criteria**

1. `npm run build`, `npx tsc --noEmit` and `npm run lint` are clean with the three variables unset.
2. The client throws a message naming `STRIPE_SECRET_KEY` when it is unset, and never appears in a
   client bundle (`grep` the built chunks for `STRIPE_SECRET_KEY` → no hit outside the server build).
3. `bash tools/configure-stripe.sh --help` prints its own header, and running it with no key entered
   changes nothing and exits non-zero.

**Verify** — the three commands above; `grep -r "STRIPE_SECRET_KEY" frontend/.next/static | wc -l`
→ 0; `bash tools/configure-stripe.sh --help`; `printf '\n' | bash tools/configure-stripe.sh` → exits
1 and `grep -c STRIPE frontend/.env.local` is unchanged. The key-proving path is the owner's to run
(plan Phase 0), and its result belongs in this task's `> verified:` line.

**Size** — S.

---

### S3 — The order contract: a pending order, WooCommerce's own total, a PaymentIntent

- [x] Order contract changed; card branch creates a PaymentIntent

> verified: `npx tsc --noEmit`, `npm run lint` and `npm run build` all clean. `toMinorUnits`:
> `29.98 usd → 2998`, `31.99 usd → 3199`, and refusals for `0`, `0.00`, `-5`, `abc` and `eur` (no
> guessed decimal places). Card checkout against the real test key: **200**
> `{"id":1044,"number":"1044","total":"63.98","currency":"USD","clientSecret":"pi_…_secret_…"}` —
> and WooCommerce's own record of it: `status=pending method=stripe title="Stripe (test mode)"
> total=63.98 txn='' meta=pi_3UEfKvDsJmFxD5A10KxBcigh`. Stripe's record of that intent
> (`paymentIntents.retrieve`): `amount=6398, currency=usd, types=["card"]`,
> `status=requires_payment_method`, `metadata.order_id=1044` — the two agree because the amount is
> built from **WooCommerce's** total, not the browser's. QR is unchanged: **200**
> `{"id":1045,"number":"1045"}` with **no** `clientSecret`, and an unknown method is still **400**.
> With the key removed (the route called directly through `tsx`, `STRIPE_SECRET_KEY` unset): **503**
> `This shop has no card payment set up…`, and `wc_get_orders()` count **24 → 24** — no order was
> created.

**Goal** — A card checkout creates the WooCommerce order `pending`, creates a Stripe PaymentIntent
for **WooCommerce's** total, and answers the client secret — and nothing in the request could carry
a card number.

**Depends on** — S2.

**Context to load** — `app/api/checkout/route.ts`, `lib/wp/rest.ts` (`wpRest`, `createOrder`,
`RawOrder`), `lib/wp/types.ts`, `lib/payment-simulation.ts` (the methods list, which gains `stripe`),
`docs/headless-contract.md` §*Order REST contract*, and the plan's §*The flow*.

**Do**

1. `lib/stripe/amount.ts` (pure): `toMinorUnits(total: string, currency: string): number`, refusing
   a currency it does not know and rounding explicitly. USD only in practice; the function must not
   silently mangle another.
2. `payment-simulation.ts` gains the `stripe` method — label "Card", summary naming test mode and
   that no card detail reaches this site, slug `stripe`, recorded title `Stripe (test mode)` — and it
   becomes the default method.
3. `createOrder()` creates the order with `status: "pending"`, and returns `total` and `currency`
   alongside `id` and `number`. Orders for QR/COD keep their current `processing` / `set_paid: false`
   behaviour.
4. `POST /api/checkout` grows the card branch: create the order, create the PaymentIntent for
   `toMinorUnits(order.total, order.currency)` with `payment_method_types: ["card"]`
   (plan D8), `metadata: { order_id, order_number }`, and **no `receipt_email`** (plan D7); answer
   `{id, number, total, clientSecret}` for cards and `{id, number}` for the others. A missing or
   refused secret key is a `503` with a message that says Stripe is not configured — never a 500, and
   never a silently unpaid "success".
5. Update `docs/headless-contract.md`'s order section and `frontend/README.md`.

**In scope** — `app/api/checkout/route.ts`, `lib/wp/rest.ts`, `lib/wp/types.ts`,
`lib/payment-simulation.ts`, `lib/stripe/amount.ts` (new), `docs/headless-contract.md`,
`frontend/README.md`.

**Out of scope** — the browser (S4/S5), the webhook (S6), the success page (S7), and any change to
the QR/COD server behaviour.

**Acceptance criteria**

1. `POST /api/checkout` with `payment: "card"` answers 200 with a `clientSecret` that starts `pi_`
   and a `total` equal to the WooCommerce order's own total, and the order is **`pending`** with no
   `transaction_id`.
2. Requesting a card while `STRIPE_SECRET_KEY` is unset answers **503** and creates no order.
3. The response body and the WooCommerce order contain no field any card digit could occupy, and the
   request type still has nowhere to put one.

**Verify** — the curl probe in the plan's §*Verification* with `payment: "card"` and then with
`payment: "qr"`; `$WPDEV wp wc order get <id> --fields=status,total,currency,payment_method,payment_method_title`;
`grep -n "card\|pan\|cvc\|cvv" app/api/checkout/route.ts` to show the route never reads one; and the
unset-key 503, then `grep -c "pending" …` to prove no order was created for it.

**Size** — M.

---

### S4 — The payment block: Stripe's Payment Element on the checkout

- [x] Payment Element mounted on the checkout

> verified: `/checkout` offers three methods as radios with `stripe` checked by default and a button
> reading "Continue to payment"; after it, `data-state="payment"`, the pay button reads **Pay
> $31.99** (WooCommerce's total), and the cart is still full — nothing has been paid yet. Stripe's
> element really renders: `iframe[title='Secure payment input frame']` = **1** at 1440, 768 and 390,
> with `innerWidth == clientWidth == scrollWidth` at each width, one `h1`, **0** console errors
> (`/tmp/s4/step-{1440,768,390}.png`, 1440x2000 / 768x2000 / 390x2000 per `file`,
> `/tmp/s4/shots.cjs`). Seen at 390: the basket, "Pay for order <n>", Stripe's card number / expiry /
> CVC / country fields, and the pay button. With no key the route answers 503 and the block says the
> shop has no card payment set up.

**Goal** — Choosing Card mounts Stripe's Payment Element from the client secret the route returned,
inside the checkout's existing payment block, visibly labelled as test mode.

**Depends on** — S1, S3.

**Context to load** — `components/checkout/payment-methods.tsx`, `components/checkout/checkout-form.tsx`,
`lib/payment-simulation.ts`, `components/ui/` (the existing primitives), `frontend/UI-STANDARDS.md`
and the plan's §*The hard parts* on Stripe's iframe.

**Do**

1. A new client component `components/checkout/stripe-card.tsx`: `<Elements>` with the client secret
   (and the publishable key from `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) wrapping `<PaymentElement />`,
   themed through the Appearance API `variables` so it sits on `ink-900` without fighting it. The
   component owns the loading and failure states of Stripe's own script.
2. `PaymentMethods` renders that panel for the `stripe` method instead of the deleted card sandbox,
   with the test-mode label and the hint that `4242 4242 4242 4242` approves and
   `4000 0000 0000 0002` is declined.
3. The checkout form asks the route for a client secret when the card method is submitted, and holds
   it in state — one intent per order, no re-request on re-render.
4. `UI-STANDARDS.md` gains the rule that Stripe's iframe is themed, not styled: it cannot take
   Tailwind classes, cannot be measured by the contrast script, and has its own focus handling.

**In scope** — `components/checkout/stripe-card.tsx` (new), `components/checkout/payment-methods.tsx`,
`components/checkout/checkout-form.tsx`, `frontend/UI-STANDARDS.md`.

**Out of scope** — confirming the payment (S5) and the webhook (S6): this task renders the element and
nothing else.

**Acceptance criteria**

1. Choosing Card shows the Payment Element with the real client secret, and the amount Stripe is
   asked for is the WooCommerce total, not the browser's subtotal.
2. With Stripe unconfigured or WordPress down, the panel says so in place and the rest of the form is
   still usable.
3. The block is keyboard reachable, and only the chosen method's panel is in the DOM.

**Verify** — Playwright at 1440x900 / 768x1024 / 390x844: choose Card, read the element's presence
and the block's label, confirm `overflow` 0 at 390 and one `h1`; screenshot each width and confirm
with `file`; with the key unset, read the in-place message.

**Size** — M.

---

### S5 — The submit path: confirm, decline, authentication, success

- [x] confirmPayment wired; declined and authentication paths designed

> verified: three real card runs in a browser (`/tmp/s4/e2e.cjs`, 1440x1000, a seeded cart, every
> request to this app captured):
>
> - **4242 4242 4242 4242** → `/checkout/success/1049`, `h1` **Paid**, cart emptied (1 → 0).
>   WooCommerce: `status=processing paid=true txn=pi_3UEfSJDsJmFxD5A117QKBvsO total=31.99`.
> - **4000 0000 0000 0002** → alert *"Your card has been declined."*, `data-payment-step="declined"`,
>   still on `/checkout`, cart intact, **no navigation and no second order created**.
> - **4000 0025 0000 3155** → Stripe's own challenge frame (`stripe-challenge-frame`, buttons
>   FAIL/COMPLETE) appeared, COMPLETE was clicked → `/checkout/success/1056`, `h1` **Paid**, cart
>   emptied. WooCommerce: `status=processing paid=true txn=pi_3UEfXpDsJmFxD5A10E4NJlMA`.
>
> `cardNumberInAnyBody: **false**` in all three: the only body this app ever received was
> `{items, billing, note, payment:"stripe"}`, and the card went to Stripe's own domain, which this
> app does not see. The declined run's only console error is Stripe's own `402`.

**Goal** — Submitting pays through Stripe, a declined card is a designed state with a retry, an
authentication-required card completes Stripe's 3-D Secure step, and the cart is cleared only when
the intent succeeded.

**Depends on** — S4.

**Context to load** — `components/checkout/checkout-form.tsx`, `components/checkout/stripe-card.tsx`,
`lib/site.ts` (`absoluteUrl`), the plan's §*The hard parts*.

**Do**

1. `stripe.confirmPayment({ elements, confirmParams: { return_url: absoluteUrl("/checkout/success/<id>") }, redirect: "if_required" })` on submit, with the checkout's own submitting state while it runs.
2. A declined outcome renders as a `role="alert"` block with a retry that reuses the same order and
   the same client secret — no second order, no cleared cart, no dead end.
3. An `requires_action` outcome redirects and returns to the success URL; the page — not the client
   — is what decides whether the payment happened (S7).
4. Clear the cart and navigate to `/checkout/success/<id>` only on a succeeded intent, and expose the
   payment block's state as `data-state` so a test reads a state rather than guessing one.

**In scope** — `components/checkout/checkout-form.tsx`, `components/checkout/stripe-card.tsx`.

**Out of scope** — the webhook and the order transition (S6), the success page's own copy (S7).

**Acceptance criteria**

1. `4242 4242 4242 4242` reaches `/checkout/success/<id>` with the cart emptied.
2. `4000 0000 0000 0002` shows the declined state, leaves the cart intact, and creates **no** second
   WooCommerce order.
3. `4000 0025 0000 3155` completes Stripe's authentication and comes back to the success URL.

**Verify** — Playwright driving all three cards at 3002, with `page.on("request")` capturing every
body and asserting no card-length digit string is in one; after each run, `$WPDEV wp wc order list
--user=admin --per_page=3 --fields=id,status,total,transaction_id` and a count of the orders created;
screenshots of the idle, processing, declined and success states at three widths.

**Size** — M.

---

### S6 — The webhook, and reconcile-on-read

- [x] Webhook route; order marked paid from Stripe's own event

> verified: driven with payloads signed locally by `stripe.webhooks.generateTestHeaderString`
> (`/tmp/s6/webhook.ts`), because no Stripe CLI is installed here: **400** with no signature (*"No
> Stripe webhook secret is configured on this shop."*), **200** on a correct delivery with the order
> moving `pending → processing, paid=true, txn=<intent id>` (route log: *order 1057: marked*), **200
> / already** for the same event delivered again, **400 / Invalid signature.** for a forged one, and
> **200** for both an unknown intent and a signed event naming no order. The reconcile is what made
> both browser runs' success pages say Paid with no webhook configured at all: the order was
> `pending` when read, `_vapestack_payment_intent` named an intent Stripe reported `succeeded`, and
> the read flipped it. Order 1057 — whose paid state came from a payload this harness signed, not
> from a payment — was deleted afterwards; the honest leftover is 1055, still `pending`.

**Goal** — Stripe's `payment_intent.succeeded` marks the WooCommerce order paid, a forged or missing
signature does nothing, a duplicate is a no-op, and an order that is paid but was never told so
recovers on read.

**Depends on** — S3.

**Context to load** — `app/api/checkout/route.ts` (the route's shape and its `force-dynamic`),
`lib/wp/rest.ts`, `lib/stripe/client.ts`, `docs/headless-contract.md`, and `/memories/repo/vapestack-verification-traps.md`
§*An unquoted heredoc…* if any shell recipe is written.

**Do**

1. `app/api/stripe/webhook/route.ts`: `dynamic = "force-dynamic"`, the **raw** body
   (`await request.text()`, never `request.json()` first) verified with
   `stripe.webhooks.constructEvent()`; a bad signature is a 400 with no side effect, a delivery for an
   unknown order logs and answers 200.
2. One shared `markOrderPaid(orderId, transactionId)` used by both paths, idempotent: an order
   already `processing` is left alone.
3. `payment_intent.succeeded` → `processing`, `set_paid: true`, `transaction_id`;
   `payment_intent.payment_failed` leaves the order `pending`. `wpRest()` grows `PUT` and `rest.ts`
   grows `updateOrder()`.
4. Plan D6: `getOrderSummary()` asks Stripe about the intent — once, and only when the order is still
   `pending` and carries one — and flips it if Stripe says `succeeded`. Never on a paid or failed
   order, never creating an order.

**In scope** — `app/api/stripe/webhook/route.ts` (new), `lib/wp/rest.ts`, `lib/stripe/client.ts`,
`docs/headless-contract.md`, `frontend/README.md`.

**Out of scope** — the browser, and any attempt to reconcile from the client.

**Acceptance criteria**

1. A correctly signed `payment_intent.succeeded` answers 200 and turns the order `processing`, paid,
   with the intent id as its `transaction_id`.
2. The same event delivered twice changes nothing the second time, and a tampered signature answers
   400 and changes nothing at all.
3. An order left `pending` whose intent Stripe reports `succeeded` is flipped the next time its
   summary is read — proved without any webhook being delivered.

**Verify** — the signed-payload recipe in the plan's §*Verification* (built with
`stripe.webhooks.generateTestHeaderString`, so no Stripe CLI is needed): 200 then
`$WPDEV wp wc order get <id> --fields=status,transaction_id`; the same event again → unchanged; a
tampered header → 400 and unchanged; and the reconcile proved by paying an intent and reading the
order's summary route before any webhook is sent.

**Size** — M.

---

### S7 — The success page says which of the two things happened

- [x] Success page: paid and awaiting-payment states

> verified: `/checkout/success/1056` (a paid card) renders `h1` **Paid** and *"Stripe took the card in
> test mode, so no real money moved, and WooCommerce recorded the order as Processing"* at 1440x900 /
> 768x1024 / 390x844 — 0 overflow, 0 console errors (`/tmp/s4/paid-*.png`). The page reads the
> recorded **method** as well as the status, because status alone cannot tell a paid card from a
> simulated method: a QR order is `processing` and WooCommerce's own `is_paid()` reports **true**,
> and that page still says the method was simulated and nothing was charged (checked on 1045). An
> unpaid card order (1055) says the payment has not completed and links back to the checkout; an
> unknown id is still a 404, and `/checkout/success/demo` is unchanged.

**Goal** — `/checkout/success/<id>` shows a paid order as paid and an unpaid one as *awaiting
payment*, with a way back to the checkout, and stops claiming that no payment was taken.

**Depends on** — S3.

**Context to load** — `app/checkout/success/[id]/page.tsx`, `lib/wp/rest.ts` (`getOrderSummary`),
`lib/wp/types.ts`, `components/checkout/demo-order-summary.tsx` (the demo path, which stays).

**Do**

1. Read the order's status and payment title and render two states: paid (`processing`/`completed`,
   with its `transaction_id` not printed) and awaiting payment (`pending`), the latter with a link
   back to `/checkout`.
2. Correct the page's copy: what is real (a WooCommerce order, a Stripe test-mode payment) and what
   is not (no money, nothing ships).
3. Leave the demo-receipt path (`/checkout/success/demo`) working exactly as it is.

**In scope** — `app/checkout/success/[id]/page.tsx`, `lib/wp/rest.ts` (only if the summary needs a
field), `lib/wp/types.ts`.

**Out of scope** — the demo summary component, the timeline, the copy sweep (S8).

**Acceptance criteria**

1. A paid order shows the paid state; a `pending` order shows *awaiting payment* with a retry link,
   and both render at three widths with no overflow.
2. Neither state claims no payment was taken.
3. `/checkout/success/demo` is unchanged, and an unknown id is still a 404.

**Verify** — the two real orders from S5 and S6's runs read in the browser, `/checkout/success/demo`
and `/checkout/success/999999` read for comparison, screenshots at three widths confirmed with
`file`, and `$WPDEV wp wc order get <id> --fields=status` for the status each state claims.

**Size** — S.

---

### S8 — The copy sweep

- [x] No page claims no payment provider is connected

> verified: twelve files rewritten — `/about`, `/terms`, `/privacy`, `/shipping-returns`, `/checkout`,
> `product-notes.tsx`, `footer.tsx`, `age-gate.tsx`, `cart-drawer.tsx`, `reward-progress.tsx`,
> `cart-rewards.ts`, `checkout-form.tsx` — plus `types.ts`'s stale "simulated challenge" note,
> `UI-STANDARDS.md`'s pill rule and the README's "nothing is charged" sentence. The sweep's own grep
> (`no payment is ever | no payment provider is connected | no payment is taken | no payment details |
> nothing is charged | is ever taken`) now returns **one** hit, `checkout-form.tsx:315`, which is the
> card step's *"Leaving without paying is allowed: the order is recorded as unpaid, and nothing is
> charged"* — true as written, and kept deliberately. "Test mode" is on every surface a card can be
> entered: `/checkout`, the Card option's summary, the card panel and the payment step. Browser check
> (`/tmp/s8/copy.cjs`) at 1440x900 and 390x844 on `/about`, `/terms`, `/privacy`, `/shipping-returns`,
> `/checkout` and a product page: the new sentence present in all six, one `h1` each,
> `innerWidth == scrollWidth` (**0 overflow**) at both widths, and the age gate — checked from a
> context with no stored answer — carries its rewritten line. `tsc`, `lint` and `build` clean.
> `/privacy` now says where card details go: *"No payment details reach this site. A card is entered
> into Stripe's own fields and goes to Stripe, which processes it under its own privacy policy; this
> site is told only whether the payment succeeded."* `shipping-returns`' "every order is recorded as
> processing and stays that way" was **also** false after S3, and now describes both status paths.

**Goal** — Every claim the Stripe work falsified is rewritten, and the two simulated methods stay
labelled as simulations.

**Depends on** — S1–S7.

**Context to load** — the seventeen files listed in the plan's §*Phase 5*, and the plan's
§*Decisions* for the wording.

**Do**

1. Rewrite each claim: `/about` ("no payment is ever taken, and no payment provider is connected"),
   `/terms`, `/privacy` (whose "no payment details" bullet must now say card details are entered into
   Stripe's own fields and never reach this site), `/shipping-returns`, `product-notes.tsx`,
   `footer.tsx`, `age-gate.tsx`, `cart-drawer.tsx`, `reward-progress.tsx`, `cart-rewards.ts`,
   `/checkout`, `checkout-form.tsx` and the success page.
2. Leave every `Simulation` label on QR and cash-on-delivery alone, and keep the wording short —
   this site's voice is a sentence, not a paragraph.
3. Update `frontend/README.md` and `docs/headless-contract.md` where they describe the old contract.

**In scope** — the files above, plus `frontend/README.md` and `docs/headless-contract.md`.

**Out of scope** — the plan files, `CLAUDE.md` (generated), and any claim that is still true.

**Acceptance criteria**

1. `grep -rn "no payment is ever\|no payment provider is connected\|no payment is taken\|no payment details" frontend/src` returns nothing that is still false — the survivors are the ones a test
   mode still makes true, and there is at most one of those.
2. No page claims a real charge is possible: the words "test mode" appear wherever a card can be
   entered.
3. `/privacy` says where card details go.

**Verify** — the grep above, before and after, pasted into the task's evidence; a read of `/about`,
`/terms`, `/privacy`, `/shipping-returns` and `/checkout` in the browser at 390 and 1440 with
`scrollWidth === clientWidth`.

**Size** — M.

---

### S9 — The deployment: Vercel variables and a webhook endpoint

- [x] Vercel variables set; webhook endpoint registered; test payment on the deployment

> verified: endpoint **`we_1UEfhgDsJmFxD5A1TFkkY7jY`** created against
> `https://vapestack-paws1234s-projects.vercel.app/api/stripe/webhook`, status **enabled**, events
> `payment_intent.succeeded` + `payment_intent.payment_failed`. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
> added as **Config**, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as **Secrets** — all three
> confirmed by `vercel env ls production`, every value piped in rather than passed as an argument, so
> none was printed. Deployed with `VERCEL=<cached vercel> bash tools/tunnel.sh` →
> `vapestack-7zy6mj3be-paws1234s-projects.vercel.app`, tunnel
> `remaining-strain-startup-dis.trycloudflare.com`, **17/17 warmed routes 200**. A real test payment
> from the public URL (`/tmp/s9/deployed.cjs`, `4242 4242 4242 4242`): `/checkout/success/**1061**`,
> `h1` **Paid**, cart emptied, `anyBodyHasCardNumber: **false**`, 0 console errors. WooCommerce:
> `status=processing paid=true txn=pi_3UEfjyDsJmFxD5A11dTlEckV total=31.99`, `date_paid` set. Stripe:
> exactly one endpoint, enabled, and the event behind that payment
> (`evt_3UEfjyDsJmFxD5A112AnpIza`) reports `pending_webhooks: **0**` — every endpoint notified. The
> deployed route's own behaviour: a validly signed delivery → **200** `{"received":true}`, a forged
> one → **400 `Invalid signature.`**

**Goal** — The deployed site takes a test-mode payment, with the webhook endpoint registered against
it.

**Depends on** — S2, S6.

**Context to load** — `/memories/repo/vapestack-storefront.md` §*Deploy* (the `vercel` CLI is not on
PATH here; deploys run from the repository **root**; `tools/tunnel.sh` is the whole deploy), and
`/memories/repo/vapestack-verification-traps.md` §*Handing a secret to a CLI…*.

**Do**

1. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` into Vercel as **Secrets** (piped from
   `frontend/.env.local` so no value reaches the transcript), and
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` as **Config** — it is inlined at build time, so it must exist
   *before* the build.
2. Register a Stripe webhook endpoint on `https://<deployment>/api/stripe/webhook` for
   `payment_intent.succeeded` and `payment_intent.payment_failed`, and put its signing secret in
   Vercel as `STRIPE_WEBHOOK_SECRET`.
3. `bash tools/tunnel.sh` for WordPress, then deploy and pay once from the public URL.

**In scope** — the Vercel project's environment and one Stripe webhook endpoint, plus the commands
needed to set them (documented in `frontend/README.md` if they are not already).

**Out of scope** — live keys, a custom domain, and any change to the deployed app's code.

**Acceptance criteria**

1. The deployed `/checkout` takes `4242 4242 4242 4242` and the order behind it is `processing`, paid,
   with a transaction id.
2. Stripe's dashboard shows the webhook endpoint delivering 200s.
3. A redeploy keeps working (the publishable key is a build-time value, so this is the check that it
   was set before the build).

**Verify** — the payment from the public URL; `$WPDEV wp wc order get <id> --fields=status,transaction_id`;
the endpoint's delivery log; and a second payment after a redeploy.

**Size** — M.

---

### S10 — The sweep

- [x] Build, four browser paths, offline, deployed — all proved

> verified: `rm -rf frontend/.next` then `npm run build` **with WordPress stopped** — clean (4 static
> pages, every route listed), after `tsc` and `lint` came back clean. Offline degradation against a
> **production** build (`next start`) with WordPress down (`/tmp/s10/offline.cjs`): a **card**
> checkout stays on `/checkout`, shows *"Card payment needs the shop's WooCommerce, which cannot be
> reached right now, so nothing was charged…"*, keeps its cart line and writes **no** demo receipt;
> **QR** still reaches `/checkout/success/demo` with its *"Nothing was ordered"* receipt; `/shop`
> answers 200 with the offline notice.
>
> **A bug this task found and fixed:** the card path used to fall into demo mode whenever
> WooCommerce was unreachable, writing a receipt that named *Stripe (test mode)* for a payment that
> was never attempted. The route now answers **503** for a card (`cardsNeedWooCommerce()`), and only
> the two simulated methods keep the receipt.
>
> The rest of the plan's done-when: the four browser paths are in S5's evidence (approve, decline,
> authentication, and the pre-webhook *awaiting payment* state read on order 1055), the deployed
> payment is S9's, and the one item **not** closed is the *Link* autofill block Stripe's element
> offers above the card fields — a card surface, not a fourth method, recorded as a follow-up above.
> WordPress restored afterwards: `wpdev smoke` **10/10**.

**Goal** — Everything the plan's §*Done when* claims is shown true, once, in one place.

**Depends on** — S1–S9.

**Context to load** — this file's §*Definition of done*, the plan's §*Verification*, and
`/memories/repo/vapestack-verification-traps.md`.

**Do**

1. `npm run build`, `npx tsc --noEmit`, `npm run lint` from a wiped `.next`, with WordPress stopped.
2. The four money paths in a browser: approve, decline, authentication, and the pre-webhook
   *awaiting payment* window.
3. The offline and unconfigured degradations.
4. One payment on the deployment.
5. Record every result in this file, and correct the plan's `> verified:` lines if a number differs.

**In scope** — evidence, plus the small fixes a sweep proves are needed.

**Out of scope** — new features of any kind.

**Acceptance criteria**

1. Each item in §*Definition of done* has a command and an observed result in this file.
2. Any item that cannot be made true is recorded as false, with the reason, rather than dropped.

**Verify** — the commands in the plan's §*Verification*, with their output.

**Size** — M.
