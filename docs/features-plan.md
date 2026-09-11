# Plan: Vapestack — the five interactive features

Five feature ideas from the project owner, written up as a plan on **2026-09-11** against the code
as it stands after the UI/UX pass (`docs/ui-ux-plan.md` and `docs/ui-ux-tasks.md`, T1–T15, all
done). The owner's original wording is kept under **Origin** in each feature, so nothing is lost
when the plan rephrases it.

To turn this into tasks: `plan docs/features-plan.md` — or ask a session to do `F3` of this file
once `docs/features-tasks.md` exists. Task ids here are proposals; the task file is the record.

## Goal

The storefront stops being a page-by-page shop and starts behaving like a shop with a memory and a
clock: a cart that holds a bag for a limited time, cart thresholds that reward spend, a checkout
that asks how you want to pay and simulates the friction of doing so, a post-purchase page that
shows movement, and a way to find a product without knowing which range it is in.

Every one of the five is a **simulation on top of a real backend**, because that is what this
project is: WooCommerce really creates orders, and nothing really ships. The plan is written so
each simulation is *labelled as one* and no page gains a claim that is not true — that is this
repo's own rule (`UI-STANDARDS.md`, and the plan's Done-when: "No claim on the page is untrue of a
shop that takes no payment and ships nothing").

## What is actually there today

A task starts from these facts rather than from the "gap" as originally worded.

| Thing | What it actually does now | The hook the feature uses |
| --- | --- | --- |
| Cart | `stores/cart.ts`, Zustand + `persist`, `skipHydration: true`, `partialize` to `items`, `version: 1`. No notion of time. | Add a deadline to the persisted state. |
| Cart drawer | Always mounted in `app/layout.tsx`, `inert` when closed, focus from `useModalBehaviour`. | The banner and the expired state live here. |
| Subtotal | `cartSubtotal(items)`, a plain function, display only — WooCommerce prices the order. | Thresholds read this, nothing else. |
| Checkout | One step: seven billing fields, an order note, POST to `/api/checkout`, real WooCommerce order via REST. **No payment method anywhere.** | A method selector plus a simulated challenge. |
| Demo mode | `/api/checkout` answers with a demo receipt when WordPress is unreachable; the receipt is read client-side through `useSyncExternalStore`. | The payment method must reach the demo receipt too. |
| Success page | `/checkout/success/[id]` shows order number, status, lines, total, two links. Nothing after that. | The timeline goes here, on both the real and demo paths. |
| Header | Wordmark, categories, "Shop all", menu, cart. **No search.** | The trigger, plus `Cmd/Ctrl+K`. |
| Catalogue | Six products, three ranges, 20 variations, read once per render by `getCatalogue()` and already cached per request. | The whole search index — no new fetch is needed. |
| Storage-derived state | Three existing examples (`age-gate.tsx`, `checkout-form.tsx`, `demo-order-summary.tsx`) all use `useSyncExternalStore` with module-scope identities, because `react-hooks/set-state-in-effect` is a lint **error** here. | Any ticking clock must follow the same shape. |

## Steps

### Phase 0 — settle the honesty questions first

1. Three of the five features want to say something the shop cannot make true. Decide the wording
   before any code, using the table under **Decisions**: F1's "reserved", F2's "free express
   shipping", F3/F4's implied real payment and real courier.
2. Decide F2's shape: an **honestly-labelled simulated band** (default, no WordPress work) or a
   **real reward** — a WooCommerce coupon applied through the existing REST route, which is
   genuinely true and needs a coupon created in WooCommerce. The second is better and bigger;
   pick one rather than building both.
3. Decide whether F3's payment method is recorded on the order. Recommended: yes, as a simulated
   payment title on the WooCommerce order, so the shop's own record is not misleading either.

### Phase 1 — the cart gains a clock and a ladder (F1, F2)

4. F1: a deadline in the cart store, a countdown banner in the drawer, an expired state with
   Extend, and a hidden-until-mounted countdown so the prerendered HTML still matches the first
   client render.
5. F2: a pure reward ladder in `lib/`, one progress component, two tiers, and the honest copy
   Phase 0 chose.

### Phase 2 — paying, and what happens after (F3, F4)

6. F3a: the method selector and a card form that validates locally and never leaves the browser.
7. F3b: the simulated 3-D Secure challenge as a step machine with observable states, plus the
   declined path that creates no order.
8. F3c: carry the method through the API contract, the real order and the demo receipt.
9. F4: the four-stage timeline on the success page for both a real order and a demo receipt, with
   a clearly-marked reviewer control that advances it.

### Phase 3 — finding things (F5)

10. A client-side index built from the catalogue the layout already reads, a command-palette
    dialog with `Cmd/Ctrl+K`, keyboard navigation, and the one-overlay-at-a-time rule extended to
    three overlays.

### Phase 4 — record and prove

11. Each feature updates `frontend/UI-STANDARDS.md` (new states, new motion, any new boundary
    token use) and `frontend/README.md` (new components, new lib files) as part of its own task,
    not afterwards.
12. Each task records its `> verified:` line with the command and the observed result.

---

## F1 — Cart hold countdown, and what happens when it runs out

**Goal** — A cart line is held for ten minutes; the drawer says how long is left, and reaching zero
is a designed state with a way back rather than a silent emptying.

**Where it lands** — `frontend/src/stores/cart.ts` (a deadline in the persisted state),
`frontend/src/lib/cart-hold.ts` (new, pure: duration, remaining time, `isExpired`),
`frontend/src/components/cart/cart-hold-banner.tsx` (new), `components/cart/cart-drawer.tsx`,
`components/cart/cart-line.tsx` (the expired treatment).

**The hard parts, named so they are not discovered late**

- **The countdown must not break hydration.** The drawer is always mounted and rehydrates once on
  mount; a countdown computed during render would differ from the prerendered HTML. It has to be
  `useSyncExternalStore` over a ticking snapshot with module-scope identities (the pattern
  `age-gate.tsx` already uses), or hidden until mounted — never a `setState` in an effect, which
  is a lint error here.
- **One interval, cleaned up.** The interval belongs to the component, not the store, and must be
  cleared on unmount. Nothing may keep ticking in a background tab for a cart nobody is looking at
  — prefer recomputing remaining time from the stored deadline over counting down in state, so a
  throttled tab cannot drift.
- **Expiry must be a state, not a deletion.** The items stay until the visitor chooses; "Extend
  Timer" restores the deadline, and the default after expiry is to keep the lines and disable
  checkout rather than to empty a cart behind the visitor's back.
- **The deadline is per cart, not per line.** A line added at 09:00 to a cart holding since 08:55
  renews the whole hold; that is one rule, and it needs saying in the code.

**Acceptance criteria**

1. With a deadline in the near future the drawer shows a live `mm:ss` countdown, and it keeps
   counting across a reload because the deadline is persisted.
2. At zero the drawer shows the expired state with an Extend action, the lines are still listed,
   and checkout is refused until the hold is extended.
3. Extend restores a full hold and the expired state clears.
4. The countdown is absent from the server-rendered HTML and the page hydrates with **no React
   warning** in the console.
5. The copy says the hold is a simulation. Nothing is really reserved, and no page says it is.

**Verify** — Playwright: seed `vapestack-cart` with a deadline 30 s out and one already past, open
the drawer, read the banner text twice 3 s apart, read the expired state and the disabled checkout
control, click Extend and re-read; capture the console for hydration warnings; screenshots at
1440x900 / 768x1024 / 390x844. Report `scrollWidth === clientWidth` at 390.

**Size** — M. Split into **F1a** (store + pure lib + tests by hand) and **F1b** (banner, expired
state, Extend) if the deadline work turns out to need its own session.

**Origin** — *"Simulated Flash-Sale Inventory & Cart Hold Countdown … a 10-minute Cart Reservation
Timer … a subtle banner reads: 'Your inventory is reserved for 09:59' … If the timer expires, the
cart drawer updates to a 'Reservation Expired' state, gracefully moving items back to a saved state
or showing an inline notice that stock was returned to the pool (triggered by a simple 'Extend
Timer' button)."* — The mechanic and the Extend button are kept exactly. "Stock was returned to the
pool" is dropped: nothing was taken from a pool. See **Decisions**.

---

## F2 — Cart threshold ladder

**Goal** — The drawer shows how far the cart is from the next reward and celebrates crossing it,
from a pure function over the subtotal.

**Where it lands** — `frontend/src/lib/cart-rewards.ts` (new, pure: the ladder and a progress
function), `frontend/src/components/cart/reward-progress.tsx` (new), `components/cart/cart-drawer.tsx`.

**The hard parts, named so they are not discovered late**

- **It is a pure function of `cartSubtotal`, not state.** `lib/cart-rewards.ts` takes a number and
  returns `{ tiers, current, next, remaining, progress }`; the component reads `cartSubtotal(items)`
  and renders. Adding progress to the store would put derived data in state, which this store has
  deliberately avoided (`cartSubtotal` and friends are plain functions because zustand v5 has no
  shallow equality).
- **Honest tiers.** "Free Express Shipping" is not true of a shop that ships nothing. Phase 0 picks
  between an explicitly-labelled simulated band and a real coupon applied through the existing REST
  route.
- **Announce the crossing, not the number.** A progress bar that re-announces on every cent is
  noise; `aria-live="polite"` belongs on the tier message, and the bar itself is a `role="progressbar"`
  with `aria-valuenow` / `aria-valuemin` / `aria-valuemax`.
- **Not by colour alone.** "Unlocked" changes the copy and the icon, not only the fill.

**Acceptance criteria**

1. Three states are reachable and correct: below the first tier (shows the amount remaining),
   between the tiers (shows the second target), above the top tier (shows a completed state with
   no further ask).
2. Progress is a real progress bar: `role="progressbar"`, `aria-valuenow` equal to the subtotal
   capped at the top tier, `aria-valuemax` equal to the top tier.
3. Crossing a tier is announced once, not once per change below it.
4. At 390x844 the bar and both messages fit with no horizontal overflow and no clipping.
5. Whatever the tiers promise, the shop actually does — no unlocked reward is a lie.

**Verify** — Playwright with three seeded carts (below, between, above) at three widths: read
`aria-valuenow`, the tier copy and the completed state; screenshot each; report overflow at 390.

**Size** — S (or M if Phase 0 chooses the real-coupon option, which adds a WooCommerce coupon and a
change to the checkout request).

**Origin** — *"Multi-Tiered 'Free Shipping & Gift' Progress Bar … 'Add $15.00 more to unlock Free
Express Shipping!' … 'You unlocked Free Express Shipping! 🎉 Add $20 more to get a Free Lanyard.'"*
— The ladder, the two thresholds and the celebratory second state are kept. The rewards are not,
unless Phase 0 makes one of them real.

---

## F3 — Payment method sandbox with a simulated 3-D Secure step

**Goal** — The checkout asks how you want to pay, the card path simulates a challenge, and the
resulting order records which method was simulated.

**Where it lands** — `components/checkout/payment-methods.tsx` (new), `components/checkout/card-form.tsx`
(new), `components/checkout/three-d-secure.tsx` (new), `components/checkout/checkout-form.tsx`,
`lib/payment-simulation.ts` (new, pure: the test numbers and the step machine's transitions),
`lib/wp/types.ts` (`CheckoutRequest.payment`), `app/api/checkout/route.ts` (validate and record),
`lib/demo-order.ts` and `components/checkout/demo-order-summary.tsx` (the receipt carries the method).

**The hard parts, named so they are not discovered late**

- **Card digits never leave the browser.** Not in the request body, not in `localStorage`, not in a
  log line. The API receives a method id and a simulated outcome — nothing else. This is the single
  most important constraint in the plan, and the task's evidence has to show it (a request-body
  capture, and a `grep` of the route for any card handling).
- **It must not look like a real payment.** A visible "simulation" label on the method block, test
  numbers printed on the page, no card brand logos, no padlock iconography, and the checkout's
  existing "nothing is charged" copy kept.
- **The step machine is explicit.** `idle → validating → challenge → authorising → approved |
  declined`, exposed as `data-state` on the container so the acceptance test reads a state rather
  than guessing from the DOM. No timers that outlive the component.
- **A decline creates no order.** The only path that reaches `/api/checkout` is an approved
  simulation; a declined attempt stays on the page with a clear message and an obvious retry.
- **The form fields keep the existing primitives.** `inputMode="numeric"`, `autocomplete="off"`,
  no `autocomplete="cc-number"` — there is no real card to autofill and tempting a browser to
  offer one is the wrong invitation.
- **The API stays the only source of truth.** An unknown method id is a 400, exactly as a bad
  quantity is today. The browser cannot talk the server into a method the server does not know.

**Acceptance criteria**

1. Three methods are selectable, and the fields below the selector change with it; the selection is
   keyboard-reachable as a native radio group and the chosen method's fields appear in the DOM only
   when chosen.
2. A card beginning `4242` reaches the challenge step, a wrong code is refused with a message, and
   `123456` completes to the success page. A card beginning `4000 0000 0000 0002` reaches the
   declined state and **no order is created**.
3. The request body posted to `/api/checkout` contains no field of any card number and no OTP —
   proved by capturing the request.
4. `POST /api/checkout` with an unknown method answers **400**, and an order created through the
   UI records the simulated method.
5. Each simulated element is visibly labelled as a simulation.

**Verify** — Playwright driving the whole flow at three widths with `page.on("request")` capturing
every post and asserting the body; `curl` for the 400 and a success; screenshots of each step;
`grep -n "card\|pan\|cvv" app/api/checkout/route.ts` to show the route never sees them.

**Size** — L, and it must be split before starting: **F3a** selector + card form + method in the
request; **F3b** the challenge, the OTP and the declined path; **F3c** the order and demo-receipt
plumbing. Each is independently verifiable.

**Origin** — *"API-Free, Multi-Method Payment Sandbox (with Simulated 3D Secure) … Mock Credit
Card, Simulated GCash/Maya QR, and Cash on Delivery (Simulated) … Typing a test card like 4242…
triggers a mock 3D Secure / OTP Modal asking the user for a 6-digit code ('Enter code 123456'),
complete with a loading spinner and a success checkmark before routing to the success page."* — All
kept. The QR method is a rendered, non-functional QR image with its own explanatory note, since
there is no merchant to pay.

---

## F4 — Post-purchase timeline

**Goal** — The order page shows where the order is and lets a reviewer move it along, honestly
labelled as a simulation.

**Where it lands** — `components/checkout/order-timeline.tsx` (new client component),
`app/checkout/success/[id]/page.tsx`, `components/checkout/demo-order-summary.tsx`.

**The hard parts, named so they are not discovered late**

- **Nothing ships, so the timeline is fiction.** It is a demonstration of the post-purchase UX, and
  it has to say so on the page, in the same voice the footer already uses. No courier name, no
  tracking number that pretends to be real, no "arriving Tuesday".
- **The reviewer control must not read as content.** "Simulate courier movement" is a dotted-border
  or otherwise distinct control with its own label, not a button that looks like part of the
  order's status.
- **It works on both paths.** A real order (`/checkout/success/<id>`) and the demo receipt
  (`/checkout/success/demo`) both show a timeline; the real one starts from the order's own status
  and the demo one from the receipt's.
- **Persisted per order, not globally.** A reload keeps the stage it reached, keyed by order id, so
  two orders do not share a stage. `useSyncExternalStore` again, with the module-scope identity
  pattern the demo receipt already uses.
- **Accessible progression.** An `<ol>` with `aria-current="step"` on the current stage, and a log
  region with `aria-live="polite"` so advancing is announced.
- **No server writes.** The stage lives in the browser; the WooCommerce order is not updated.

**Acceptance criteria**

1. Four stages render in order, exactly one carrying `aria-current="step"`, on both the real and
   the demo path.
2. The reviewer control advances one stage at a time and stops at the last; the status log gains a
   line per advance and is announced.
3. A reload keeps the stage reached, and a different order id starts at the first stage.
4. The page states that the tracking is simulated and that nothing ships.
5. No request is issued by advancing (proved by counting requests).

**Verify** — Playwright at three widths: read the stages and `aria-current`, click the control
four times and read the stage and the log, reload and re-read, count requests during the clicks;
screenshots of the first and last stage on both paths.

**Size** — M.

**Origin** — *"Interactive Live Order Tracking & Status Timeline … a visual logistics timeline
(Order Confirmed → Quality Check → Dispatched → Out for Delivery) … an interactive 'Simulate
Courier Movement' toggle right on the page for reviewers, letting them click through the steps to
watch simulated GPS updates or status logs change in real time."* — The four stages, the toggle
and the live log are kept. "GPS updates" becomes a text status log: there is no courier to locate,
and a fake map is a bigger lie than a fake status.

---

## F5 — Instant search dialog over a client-side index

**Goal** — `Cmd/Ctrl+K` (and a visible trigger) opens a dialog that filters products, ranges and
options as you type, with no request per keystroke and no new dependency.

**Where it lands** — `lib/search-index.ts` (new, pure: build a flat index from the catalogue and
score a query), `components/search/search-dialog.tsx` (new), `components/search/search-button.tsx`
(new), `components/layout/header.tsx` (the trigger), `app/layout.tsx` (mounting the dialog),
`app/globals.css` only if a token is needed.

**The hard parts, named so they are not discovered late**

- **The index comes from the read the layout already makes.** `app/layout.tsx` calls
  `getCatalogue()` for the navigation; the same result builds the index. No new fetch, no route
  handler, no build-time catalogue.
- **Pass a slim index, not the catalogue.** Every product carries `description` and
  `shortDescription` as HTML; sending those to the client to power a title search would balloon the
  RSC payload on every page. The index entries are `{ slug, name, range, options, image }` only.
- **The overlay lives in `app/layout.tsx`, never in `<header>`.** That element is `backdrop-blur`,
  and a `backdrop-filter` is the containing block for `position: fixed` descendants (the drawer and
  the nav were moved out for exactly this reason).
- **Three overlays now, so the rule has to hold three ways.** Opening search closes the nav and the
  cart; opening either of those closes search. The existing pattern is each trigger closing the
  others through the stores — extend it rather than inventing a second mechanism.
- **The age gate owns the screen until it is answered.** `Cmd+K` must not open the dialog behind a
  gate that traps focus.
- **Focus and keys.** `useModalBehaviour` gives the trap, Escape and focus return — do not write a
  second focus trap. Arrow keys move through results, Enter follows the highlighted one, Escape
  closes and returns focus to the trigger (or to wherever focus came from when opened by shortcut).
- **Typing costs nothing.** `page.on("request")` while typing must record **zero** requests. The
  filter is a plain `Array.filter` over ~26 entries; a fuzzy-matching dependency is not justified
  at this size and would need its own written decision.

**Acceptance criteria**

1. `Cmd/Ctrl+K` opens the dialog from any page, and the header trigger opens it for a keyboard and
   a pointer alike; both are announced with the shortcut in the trigger's accessible name.
2. Typing filters products, ranges and options as you type with **zero** network requests, and an
   empty result is a designed state with a way out rather than an empty list.
3. Arrow keys move the highlight, Enter follows it, Escape closes and returns focus to the trigger.
4. Opening search closes the nav and the cart, and opening either of those closes search — never
   two overlays open, wherever the pair is started from.
5. The dialog is `inert` (or absent) while closed and does not appear over the age gate.
6. No new dependency in `package.json`; the panel obeys the reduced-motion rule.

**Verify** — Playwright: open by shortcut and by click, capture the request count while typing six
characters, walk the results with the keyboard, assert focus return, try every overlay pair in both
orders and read how many dialogs are open; screenshots of open, filtered and empty results at three
widths.

**Size** — M.

**Origin** — *"Instant Type-Ahead Product Search Drawer (Client-Side Index) … build a fast, local
fuzzy-search index … triggered via a global shortcut (Cmd+K or clicking a header search bar) …
instant command-palette style dropdown that filters products, categories, and variations instantly
as you type."* — All kept. The fuzzy-matching *utility* is left as a decision rather than a
requirement: at 26 entries a substring match over a lowercased string is instant, and a dependency
needs to earn its place.

---

## Constraints / Out of scope

**Nothing may break, in any of the five.**

- **WordPress stays optional.** F1, F2 and F5 are client-side and must work with the tunnel closed;
  F3 keeps its demo mode; F4 works on the demo receipt. A feature that turns an offline shop into an
  error is a regression.
- **The build must not reach WordPress.** No feature may add build-time catalogue access, which
  rules out per-product images, a prerendered search index and a generated sitemap of results.
- **No root `loading.tsx`,** ever: it costs every `notFound()` route its 404 status. A skeleton, if
  wanted, is an explicit `<Suspense>` inside a page.
- **Every route stays `force-dynamic`** (`app/layout.tsx`) for the reason recorded there.
- **The cart stays display-only.** WooCommerce prices the order; no new client number is trusted.
- **`react-hooks/set-state-in-effect` is a lint error here.** Timers, storage and anything else that
  changes on its own go through `useSyncExternalStore` with module-scope identities.
- **One overlay at a time**, and every overlay stays mounted in `app/layout.tsx`.
- **The UI standards still apply**: new boundaries use `--color-line` (≥3:1), new animation carries
  a `motion-reduce:` neighbour, new controls define the five states, and every new page keeps one
  `h1`, no skipped heading levels and no horizontal overflow at 390.
- **No claim on the page may be untrue.** Every simulated thing says it is simulated.

**Out of scope**

- Real payment, real shipping, real inventory reservation, real couriers, real tracking numbers.
- Analytics, A/B testing, personalisation, recommendations, email.
- Server-side search (Algolia, Elasticsearch, WPGraphQL search) — six products do not need it, and
  it would make search fail when the tunnel closes.
- Wishlist, quick-add, reviews, upsells, related-by-purchase — still excluded from the earlier plan.
- New runtime dependencies without a written decision in this file.
- PHP, unless Phase 0 chooses the real-coupon option in F2; then `CLAUDE.md`'s WordPress rules apply
  in full, and the coupon is created through WP-CLI rather than by editing the theme.
- Anything under `wp-kit/`.

## Done when

- A cart line is held for ten minutes, the drawer counts down, expiry is a designed state with
  Extend, and the copy says the hold is simulated.
- The drawer shows a two-tier reward ladder driven by `cartSubtotal`, and whatever the tiers promise
  is something the shop really does.
- The checkout offers three payment methods, the card path simulates a 3-D Secure challenge, a
  declined card creates no order, the method is recorded on the order, and **no card digit ever
  leaves the browser**.
- The order page shows a four-stage timeline on both the real and demo paths, with a clearly-marked
  reviewer control, a persisted stage per order, and a statement that nothing ships.
- `Cmd/Ctrl+K` opens a search dialog that filters the catalogue with zero requests, keyboard
  navigable, with the one-overlay-at-a-time rule holding across all three overlays.
- `npm run build`, `npx tsc --noEmit` and `npm run lint` are clean; the build still runs with
  WordPress stopped.
- Every route and every new state has been screenshotted at 1440x900, 768x1024 and 390x844, with
  real dimensions confirmed and zero horizontal overflow.
- `UI-STANDARDS.md` and `frontend/README.md` describe what now exists.

## Verification

The shared commands from `docs/ui-ux-tasks.md` apply unchanged, and so does the screenshot recipe:
the VS Code browser pane cannot be resized past its own width, so real widths come from the
Playwright-bundled Chromium, and every PNG's dimensions are confirmed with `file` before a
conclusion is drawn from it.

```bash
WPDEV=/home/adminpaws/Desktop/dev/wp-kit/bin/wpdev
$WPDEV status                                             # WordPress up?
ss -ltn | grep -E ':300[01]'                              # a dev server outlives its terminal
env -C frontend npm run dev
env -C frontend npm run build && env -C frontend npx tsc --noEmit && env -C frontend npm run lint
```

Four extra checks this plan adds, because its features are simulations:

1. **The honesty check.** `grep` the new copy, and read every page a simulation appears on, asking
   whether a stranger would be misled. "Nothing is charged, nothing ships" stays true.
2. **The leak check for F3.** Capture the request body and assert no card field or OTP is in it, and
   `grep` the API route to show it never handles one.
3. **The no-request check for F5.** Type into the search box with `page.on("request")` attached and
   assert the count does not move.
4. **The hydration check.** Any feature with a clock reads the console for React hydration warnings
   after a reload with state already in `localStorage` — the failure mode `skipHydration` exists to
   prevent.

## Decisions

**To settle in Phase 0** (these change what gets built, so they come before any code):

| # | The tempting claim | What is true | Proposed default |
| --- | --- | --- | --- |
| F1 | "Your inventory is reserved for 09:59" | Nothing is reserved; the cart is a browser's own record and WooCommerce prices the order | Keep the timer and Extend; the copy says the hold is a simulation of one, and no stock is really taken |
| F2 | "Add $15.00 more to unlock Free Express Shipping!" | Nothing ships, so nothing can be unlocked | Either label the band as a simulation, or make tier 1 a **real** WooCommerce coupon applied through the existing REST route — genuinely true, and more work |
| F3 | A 3-D Secure modal | It is a simulation of a challenge, with no merchant and no card | Keep the modal, print the test numbers on the page, label the block as a simulation, and let a declined card create no order |
| F4 | "Out for delivery" | Nothing was dispatched and there is no courier | Keep the four stages as a labelled simulation; a text log rather than a fake map or GPS |

**Proposed already**, since they follow from the repo's own rules rather than from taste:

- **The cart's deadline is per cart, and expiry keeps the lines.** Emptying a cart behind a
  visitor's back is a worse experience than showing it expired.
- **F3's card data never leaves the browser.** A demo that handled a card number would be teaching
  the wrong pattern, and the API has no reason to see one.
- **F5 passes a slim index, not the catalogue.** Descriptions are HTML and would be paid for on
  every page.
- **No new dependencies.** Six products and 26 index entries do not need a fuzzy-matching library,
  and each of the five features is expressible in what is already installed.
- **F4 gets no fake map.** A status log is honest about being a simulation; a map of a fake courier
  is harder to label as one and adds a dependency for tiles.

## Further considerations, not planned here

Ideas that came up writing this and are deliberately **not** tasks: server-side search through
WPGraphQL for a larger catalogue; a real stock reservation held in WooCommerce; saved carts across
devices; an order-status webhook so the timeline reflects reality; a coupon engine with more than
one tier; a keyboard shortcut help sheet once there are enough shortcuts to need one.
