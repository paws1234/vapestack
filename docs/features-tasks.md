# Tasks: Vapestack — the five interactive features

From `docs/features-plan.md`, written 2026-09-11. The plan file is the source and is **never
edited**; the checklist and the evidence live here.

Any single task can be run on its own in a fresh session by asking for it by id, for example:
`do T4 of docs/features-tasks.md`. Each task carries its own context, what it may touch, what
proves it, and how it is verified — so a session needs this file and the repository, nothing else.

The features are `F1`–`F5` in the plan; the tasks below are the units of work that implement them.

| # | Task | Feature | Size | Depends on |
| --- | --- | --- | --- | --- |
| T1 | Cart hold: deadline, countdown, expiry and Extend | F1 | M | — |
| T2 | Cart reward ladder | F2 | S | T1 |
| T3 | Payment methods: selector, card form, method in the request | F3a | M | — |
| T4 | Simulated 3-D Secure challenge and the declined path | F3b | M | T3 |
| T5 | Record the simulated method on the order and the receipt | F3c | S | T3 |
| T6 | Post-purchase timeline | F4 | M | T5 |
| T7 | Search dialog over a client-side index | F5 | M | — |
| T8 | Sweep: new states at three widths, keyboard, contrast, offline build | all | M | T1–T7 |

**Parallelism.** T1 and T2 collide on `components/cart/cart-drawer.tsx`, so they run in order. T3
and T7 depend on nothing and can run alongside anything. T4 and T5 can run alongside each other
(they touch different files). T6 shares `demo-order-summary.tsx` with T5, so it follows it. T8
comes last.

## Definition of done for the whole plan

- A cart line is held for ten minutes, the drawer counts down, expiry is a designed state with
  Extend, and the copy says the hold is simulated.
- The drawer shows a two-tier reward ladder driven by `cartSubtotal`, and whatever the tiers
  promise is something the shop really does.
- The checkout offers three payment methods, the card path simulates a 3-D Secure challenge, a
  declined card creates no order, the method is recorded on the order, and **no card digit ever
  leaves the browser**.
- The order page shows a four-stage timeline on both the real and demo paths, with a
  clearly-marked reviewer control, a persisted stage per order, and a statement that nothing ships.
- `Cmd/Ctrl+K` opens a search dialog that filters the catalogue with zero requests, keyboard
  navigable, with the one-overlay-at-a-time rule holding across all three overlays.
- `npm run build`, `npx tsc --noEmit` and `npm run lint` are clean; the build still runs with
  WordPress stopped.
- Every route and every new state has been screenshotted at 1440x900, 768x1024 and 390x844, with
  real dimensions confirmed and zero horizontal overflow.
- `UI-STANDARDS.md` and `frontend/README.md` describe what now exists.

## The decisions this file inherits

The plan's Phase 0 asks three questions before any code. The proposed defaults are taken as
decided here, so the tasks can be written at all. **They are the owner's to change** — say so
before the affected task starts, not during it.

| # | Question | Decided here | Where it shows up |
| --- | --- | --- | --- |
| F1 | May the banner say stock is reserved? | **No.** The timer and Extend are kept; the copy says the hold is a simulation and nothing is really reserved. | T1 acceptance 5 |
| F2 | Simulated band, or a real WooCommerce coupon? | **Simulated band**, clearly labelled. **This is the one fork worth revisiting:** the real-coupon option is better and bigger. If it is chosen, T2 becomes an **L**, must be split (create the coupon with WP-CLI, then apply it through the REST route), the checkout request grows a field, and `CLAUDE.md`'s WordPress rules apply in full. | T2 acceptance 5 |
| F3 | Is the simulated method recorded on the order? | **Yes**, as a payment title that says it was simulated, so the shop's own record is not misleading either. | T5 |

Both defaults follow the repo's own rule rather than taste: **no claim on the page may be untrue of
a shop that takes no payment and ships nothing.** The footer, `/checkout` and the order page all
say so today, and none of these five features may contradict them.

## Constraints every task inherits

- **Frontend only.** `frontend/` is the change surface. No PHP unless the F2 fork above is taken.
  Never `wp-kit/` — it is shared infrastructure.
- **No new runtime dependencies.** Six products and 26 search entries do not need a library.
- **WordPress stays optional.** T1, T2 and T7 are client-side and must work with the tunnel closed;
  T3–T6 keep the demo path working. A feature that turns an offline shop into an error is a
  regression.
- **The build must not reach WordPress**, so nothing may add build-time catalogue access. No
  `generateStaticParams`, no static pages.
- **No root `loading.tsx`**, ever: it costs every `notFound()` route its 404 status.
- **`react-hooks/set-state-in-effect` is a lint error here.** Anything that changes on its own — a
  clock, storage, an interval — goes through `useSyncExternalStore` with module-scope identities,
  the pattern `components/age-gate.tsx`, `checkout-form.tsx` and `demo-order-summary.tsx` already
  use. A countdown computed during render is a hydration mismatch waiting to happen.
- **One overlay at a time**, and every overlay stays mounted in `app/layout.tsx`, never inside
  `<header>`: that element is `backdrop-blur`, which is the containing block for `position: fixed`.
- **`frontend/UI-STANDARDS.md` still applies**: new boundaries use `--color-line` (≥3:1), new
  animation carries a `motion-reduce:` neighbour, new controls define the five states, and every
  page keeps one `h1`, no skipped heading levels, and no horizontal overflow at 390.
- **Each task records its own docs**: the standards doc and `frontend/README.md` are updated inside
  the task that changes the behaviour, not afterwards.

## Shared commands

```bash
WPDEV=/home/adminpaws/Desktop/dev/wp-kit/bin/wpdev
PORT=3000                                             # next dev falls back to 3001 — check first
$WPDEV status                                         # WordPress up?  (catalogue pages need it)
ss -ltn | grep -E ':300[01]'                          # a dev server outlives its terminal
env -C frontend npm run dev
env -C frontend npm run build && env -C frontend npx tsc --noEmit && env -C frontend npm run lint
```

After a production build, `rm -rf frontend/.next` is what clears a stale prerender — a running
`next dev` serves the prerendered output otherwise, and stays stale through a dev-server restart.

**Screenshots at real widths** — the VS Code browser pane cannot be resized past its own width and
silently pads the canvas, so a "1440px" shot taken there is a narrow layout in a wide frame. Use
the Playwright-bundled Chromium and confirm every PNG with `file` before believing it:

```bash
CHROME=$(ls -d ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome | tail -1)
mkdir -p /tmp/ui
"$CHROME" --headless=new --no-sandbox --hide-scrollbars --window-size=390,844 \
  --virtual-time-budget=8000 --screenshot=/tmp/ui/<page>-390.png http://localhost:3000/<route>
file /tmp/ui/<page>-390.png      # must say 390 x 844
```

Three widths, every time: **1440x900, 768x1024, 390x844.** The scripting recipes that can seed
`localStorage`, press keys and read computed styles are in `docs/ui-ux-tasks.md`; the working ones
from the last pass are in `/tmp/ui/t15/*.cjs` and are worth copying rather than rewriting.

**How to run one task**

1. Load only that task's **Context to load** — never the whole repository.
2. Make the change, then run its **Verify**.
3. Tick its checkbox and add a `> verified:` line with the command and the observed result.
4. Report, then take the next unticked task in the order above.
5. **Never report a visual change from a screenshot taken before the last edit**, and never reuse a
   browser page opened in an earlier session — it may be holding a render from before the change.
6. If a task turns out to be wrong or impossible, stop and correct this file rather than quietly
   substituting different work.

**Skills.** Read `visual-testing` before any task whose Verify takes a screenshot — every task here
does. `wordpress-best-practices` applies only if the F2 fork puts PHP in scope.

---

## T1 — Cart hold: deadline, countdown, expiry and Extend — `[x]` done

> verified 2026-09-11. `/tmp/ui/f1/{verify,a11y,dom}.cjs`, Playwright against the dev server on
> 3000 with WordPress up.
> **Counting**: seeded deadline 30 s out → `data-cart-hold="counting"`, `Held for 00:29`, and
> **00:26** three seconds later. **Across a reload it resumed at 00:24** — lower than the 00:26
> read before the reload, which is the proof that it reads the persisted deadline rather than
> starting a fresh countdown. Checkout offered while counting: **true**.
> **Expired**: a deadline 1.5 s in the past → `data-cart-hold="expired"`, no countdown, one line
> still listed, **0** `/checkout` links in the panel, and the Extend button present. Clicking it
> gave `data-cart-hold="counting"`, `10:00`, and checkout offered again.
> **Hydration**: `console`/`pageerror` listeners attached before the first navigation collected
> **`[]`** across a reload with a cart already in `localStorage` — no warnings at all.
> **SSR**: `curl -s http://localhost:3000/ | grep -c 'data-cart-hold'` → **0**, so the countdown
> is absent from the served HTML.
> **A11y**: the countdown is **not** inside a live region
> (`countdown.closest("[aria-live], [role='status']")` → null); the `role="status"
> aria-live="polite"` region is present and **empty** while counting, and non-empty once expired —
> so the transition is announced without a per-second announcement.
> **Overflow** 0 at 768 and 390 in both states; panel `scrollHeight === clientHeight`. Shots
> `/tmp/ui/f1/hold-{counting,expired,extended}-1440.png` and `hold-{counting,expired}-{768,390}.png`
> — `file` reports 1440x900, 768x1024 and 390x844, seven files.
>
> TRAP avoided, worth keeping: a clock rendered during render would have been a hydration
> mismatch, and `react-hooks/set-state-in-effect` forbids the obvious `setState` fix. The way
> through is `getServerSnapshot` — React uses it for the server render *and* the hydration render,
> which is what lets the module keep a real `Date.now()` without a mismatch. Measured, not assumed:
> the console is empty.

**Goal** — The cart drawer holds the bag for ten minutes, shows the time left, and turns expiry into
a designed state with an Extend action instead of silently emptying anything.

**Depends on** none. **Parallel with** T3, T7.

**Context to load** — `docs/features-plan.md` under **F1**; `frontend/UI-STANDARDS.md` (the type
and spacing rhythm, the five control states, the reduced-motion rule); `frontend/src/stores/cart.ts`
(read it whole — `clampQuantity`, `cartSubtotal` and the `partialize` contract); the new
`frontend/src/lib/cart-hold.ts` and `frontend/src/components/cart/cart-hold-banner.tsx`; the
existing `frontend/src/components/cart/{cart-drawer,cart-line}.tsx`; and
`frontend/src/components/age-gate.tsx` for the `useSyncExternalStore` pattern this has to copy.

**Do**

1. Add one deadline to the persisted cart state — `expiresAt: number | null`, renewed whenever a
   line is added — and keep it in `partialize` alongside `items`. Do not add derived values to the
   store: `cartSubtotal`, `cartCount` and friends are plain functions on purpose, because zustand
   v5 has no shallow equality.
2. `lib/cart-hold.ts`: pure and framework-free — the hold duration, `remainingMs(expiresAt, now)`,
   `isExpired`, and a `formatCountdown(ms)` returning `mm:ss`. No timers in here.
3. `cart-hold-banner.tsx`: the countdown, hidden until mounted so the prerendered HTML still
   matches the first client render. Read the clock through `useSyncExternalStore` with
   module-scope identities, never a `setState` in an effect. One interval, owned by the component,
   cleared on unmount, and the remaining time recomputed from the stored deadline each tick so a
   throttled background tab cannot drift.
4. The expired state in the drawer: the lines stay listed, a clear notice replaces the banner, an
   **Extend** action restores a full hold, and the checkout control is not offered while expired.
5. Copy that is true: the hold is a simulation of one, and nothing is really reserved. Match the
   voice the footer and `/checkout` already use.
6. `motion-reduce:` on anything that animates; the banner must not rely on colour alone.
7. Update `frontend/UI-STANDARDS.md` (the new states, any motion) and `frontend/README.md` (the new
   files) in this task.

**In scope** — `frontend/src/stores/cart.ts`, `frontend/src/lib/cart-hold.ts` (new),
`frontend/src/components/cart/cart-hold-banner.tsx` (new), `components/cart/{cart-drawer,cart-line}.tsx`,
`frontend/UI-STANDARDS.md`, `frontend/README.md`.

**Out of scope** — the checkout API and the cart's shape beyond the deadline; cross-tab
synchronisation; any per-line deadline; any change to `clampQuantity` or `MAX_QUANTITY`.

**Acceptance criteria**

1. With a deadline in the near future the drawer shows a live `mm:ss` countdown, and it keeps
   counting across a reload because the deadline is persisted.
2. At zero the drawer shows the expired state with an Extend action, the lines are still listed,
   and checkout is not offered until the hold is extended.
3. Extend restores a full hold and the expired state clears.
4. The countdown is absent from the server-rendered HTML, and a reload with a cart already in
   `localStorage` hydrates with **no React warning** in the console.
5. The copy says the hold is a simulation. Nothing is really reserved, and no page says it is.

**Verify** — a Playwright script into `/tmp/ui/f1/`: seed `vapestack-cart` with a deadline 30 s out
and one already past, open the drawer, read the banner twice 3 s apart, read the expired state and
the missing checkout control, click Extend and re-read; attach `console`/`pageerror` listeners
**before** the reload so hydration warnings are caught. Then
`curl -s http://localhost:3000/ | grep -c 'data-cart-hold'` → **0**. Screenshots at 1440x900,
768x1024, 390x844, each confirmed with `file`, and `scrollWidth === clientWidth` reported at 390.

**Size** — M. Split into the store plus the pure lib, then the banner and the expired state, if the
deadline work wants its own session.

---

## T2 — Cart reward ladder — `[x]` done

> verified 2026-09-11. `/tmp/ui/f2/verify.cjs`, Playwright against the dev server on 3000.
> **Three rungs, three widths.** Seeded carts of $12.99, $25.98 and $51.96 →
> `data-tiers-reached` **0 / 1 / 2**, `aria-valuenow` **12.99 / 25.98 / 50** with
> `aria-valuemax` **50** and `aria-valuemin` **0** in every case (the value is the subtotal
> capped at the top tier), the fill at **26% / 52% / 100%**, and the message
> `Add $12.01 more to unlock free express shipping.` → `Add $24.02 more to unlock a free lanyard.`
> → `Every tier reached — free express shipping and a free lanyard.` Identical numbers at 768 and
> 390, **overflow 0** on the page and 0 inside the panel at every width.
> **Announcement, proved by walking the quantity up:** 1 unit (`data-tiers-reached=0`, announced
> `""`) → 2 units (rung 1, announced `"Free express shipping unlocked."`) → **3 units
> (`data-tiers-reached=1`, announced still `"Free express shipping unlocked."` — unchanged, so
> nothing was re-announced for a change inside the same rung)** → 4 units (rung 2, announced
> `"A free lanyard unlocked."`). The "once per crossing" rule therefore falls out of the shape:
> the live region's text only changes when the number of rungs does.
> **Simulation labelling**: a `Simulation` pill in the header row **and** the sentence
> `Nothing is really unlocked: this is a demonstration of a spend ladder, and the shop takes no
> payment and ships nothing.` in the same block as the claim.
> Shots `/tmp/ui/f2/ladder-{below,between,above}-{1440,768,390}.png` — `file` reports 1440x900,
> 768x1024 and 390x844, nine files.
>
> Decision taken as written in the plan (the simulated band, not the real-coupon fork), so no
> WordPress work was in scope and `frontend/` was the whole change. Two things the plan left open
> and this task settled: the thresholds are **$25 and $50** (they straddle a realistic basket
> here — one e-liquid lands under the first, two pod kits go past the second), and the progress
> bar's track uses `--color-line` rather than a decorative token, because the extent of the bar is
> the information and `ink-800` on `ink-900` is 1.06:1.

**Goal** — The drawer shows how far the cart is from the next tier and marks crossing it, computed
from the subtotal by a pure function.

**Depends on** T1 (both edit `cart-drawer.tsx`). **Parallel with** T3, T7.

**Context to load** — `docs/features-plan.md` under **F2** and the F2 row of its Decisions table;
`frontend/UI-STANDARDS.md`; `frontend/src/stores/cart.ts` (`cartSubtotal` only);
`frontend/src/components/cart/cart-drawer.tsx`; the new
`frontend/src/components/cart/reward-progress.tsx`.

**Do**

1. `lib/cart-rewards.ts`: pure, framework-free. Two tiers as constants, and a function taking the
   subtotal and returning `{ tiers, current, next, remaining, progress }`. Nothing here holds
   state, and nothing is stored in the cart store.
2. `reward-progress.tsx`: renders the ladder from `cartSubtotal(items)`. A real
   `role="progressbar"` with `aria-valuenow` (the subtotal capped at the top tier),
   `aria-valuemin` and `aria-valuemax`.
3. Announce the crossing, not the amount: `aria-live="polite"` on the tier message, and no
   announcement while the visitor is still below the same tier.
4. "Unlocked" is conveyed by the copy and an icon, not by colour alone.
5. Copy that is true of a shop that ships nothing. The default here is an **explicitly-labelled
   simulated band**; if the owner takes the real-coupon fork in the plan's Decisions, stop and
   rewrite this task to an L before starting (it needs a coupon created with WP-CLI and applied
   through the REST route).
6. Update `frontend/UI-STANDARDS.md` and `frontend/README.md`.

**In scope** — `frontend/src/lib/cart-rewards.ts` (new),
`frontend/src/components/cart/reward-progress.tsx` (new), `components/cart/cart-drawer.tsx`,
`frontend/UI-STANDARDS.md`, `frontend/README.md`.

**Out of scope** — the cart store (no new state), the checkout, WooCommerce, and any tier beyond
the two.

**Acceptance criteria**

1. Three states are reachable and correct: below the first tier (the amount remaining), between the
   tiers (the second target), and above the top tier (a completed state with no further ask).
2. `role="progressbar"` with `aria-valuenow` equal to the subtotal capped at the top tier, and
   `aria-valuemax` equal to the top tier.
3. Crossing a tier is announced once, not once per change below it.
4. At 390x844 the bar and both messages fit with no clipping and no horizontal overflow.
5. Whatever the tiers promise, the shop actually does — and the copy says which part is a
   simulation.

**Verify** — a Playwright script into `/tmp/ui/f2/` with three seeded carts (below, between, above)
at three widths: read `aria-valuenow`, the tier copy and the completed state; screenshot each;
report `scrollWidth === clientWidth` at 390; confirm each PNG with `file`.

**Size** — S. (M if the real-coupon fork is taken — then stop and split it.)

---

## T3 — Payment methods: selector, card form, method in the request — `[ ]`

**Goal** — The checkout asks how you want to pay, the fields change with the answer, and the method
travels to the API as an id — with no card data ever leaving the browser.

**Depends on** none. **Parallel with** T1, T2, T7.

**Context to load** — `docs/features-plan.md` under **F3** and the F3 row of its Decisions table;
`frontend/UI-STANDARDS.md`; `frontend/src/components/checkout/checkout-form.tsx` (the whole flow);
`frontend/src/components/ui/{field,select,button}.tsx`; `frontend/src/lib/wp/types.ts`
(`CheckoutRequest`); `frontend/src/app/api/checkout/route.ts` (its validation style — the
`invalid()`/`upstream()` shapes and the `MAX_*` constants); `frontend/src/lib/demo-order.ts` for the
receipt contract.

**Do**

1. `lib/payment-simulation.ts`: pure. The three method ids, their labels, the test card numbers and
   the outcome each one produces, and the transitions of the step machine
   (`idle → validating → challenge → authorising → approved | declined`). No timers here.
2. `payment-methods.tsx`: a native radio group, reachable and groupable by keyboard. All three
   methods are selectable; only the chosen method's fields are in the DOM. A visible
   **simulation** label, the test numbers printed on the page, no card-brand logos and no padlock
   iconography.
3. `card-form.tsx`: name, number, expiry, CVC — `inputMode="numeric"`, `autocomplete="off"`, and
   deliberately **no** `autocomplete="cc-number"`. Local validation only. **The number and the CVC
   never reach the request body, `localStorage`, or a log line.**
4. `CheckoutRequest` gains `payment`, and `/api/checkout` validates it against the same three ids
   the client knows, answering **400** for anything else exactly as a bad quantity does today. The
   route receives an id and nothing else.
5. Wire the selection into the existing submit, keeping the current loading, error and demo-mode
   behaviour.
6. Update `frontend/UI-STANDARDS.md` (the new control states) and `frontend/README.md`.

**In scope** — `frontend/src/components/checkout/{payment-methods,card-form}.tsx` (new),
`frontend/src/lib/payment-simulation.ts` (new), `components/checkout/checkout-form.tsx`,
`frontend/src/lib/wp/types.ts`, `frontend/src/app/api/checkout/route.ts` (validation only),
`frontend/UI-STANDARDS.md`, `frontend/README.md`.

**Out of scope** — the challenge modal and the declined path (T4); recording the method on the
order (T5); any real payment, PSP, tokenisation or card storage; the billing fields.

**Acceptance criteria**

1. Three methods are selectable as a native radio group, and the fields under it change with the
   selection; a method's fields are in the DOM only while it is chosen.
2. The request body posted to `/api/checkout` contains a method id and **no field of any card
   number and no CVC** — proved by capturing the request in the browser.
3. `POST /api/checkout` with an unknown method answers **400**, and the same request with a known
   method still creates an order.
4. The method block is visibly labelled as a simulation and prints the test numbers.
5. No new dependency in `package.json`.

**Verify** — Playwright with `page.on("request")` capturing every post: assert the body carries the
method and no digits of the card typed into the form. `curl` the route twice — unknown method
(expect 400) and known method (expect the order shape) — and
`grep -n "card\|cvc\|pan" app/api/checkout/route.ts` to show the route never handles one.
Screenshots of each method selected at three widths.

**Size** — M.

---

## T4 — Simulated 3-D Secure challenge and the declined path — `[ ]`

**Goal** — The card path shows a challenge step that can be failed and passed, and a declined card
creates nothing.

**Depends on** T3. **Parallel with** T5.

**Context to load** — `docs/features-plan.md` under **F3**; `frontend/UI-STANDARDS.md` (including
its Motion and reduced-motion table); `frontend/src/lib/payment-simulation.ts` (the step machine
written in T3); `frontend/src/components/checkout/{card-form,checkout-form}.tsx`;
`frontend/src/lib/modal-behaviour.ts` for the focus trap and Escape handling, and
`components/cart/cart-drawer.tsx` for how a panel consumes it.

**Do**

1. `three-d-secure.tsx`: the challenge step, reaching the modal behaviour from
   `lib/modal-behaviour.ts` rather than a second focus trap. It is a step of the checkout, not a
   second overlay competing with the drawers — decide which and say so in the code.
2. Expose the machine's state as `data-state` on the container
   (`idle|validating|challenge|authorising|approved|declined`) so the acceptance test reads a
   state instead of guessing from the DOM.
3. The six-digit code: a wrong code is refused with a message and the visitor can retry in place;
   the printed test code completes the step. A loading indicator that keeps its size, per the
   standards doc's loading-state rule.
4. The declined path: a clearly-worded failure, an obvious retry, and **no call to
   `/api/checkout`** — the only request that creates an order is made from `approved`.
5. No timer outlives the component; every animation carries a `motion-reduce:` neighbour.
6. Update `frontend/UI-STANDARDS.md` (the new states) and `frontend/README.md`.

**In scope** — `frontend/src/components/checkout/three-d-secure.tsx` (new),
`components/checkout/{card-form,checkout-form}.tsx`, `frontend/src/lib/payment-simulation.ts`,
`frontend/UI-STANDARDS.md`, `frontend/README.md`.

**Out of scope** — the API contract and the order (T5); any real 3-D Secure, iframe or redirect;
the other two payment methods' flows beyond not being affected.

**Acceptance criteria**

1. A card beginning `4242` reaches `data-state="challenge"`; a wrong code is refused with a
   message; the printed code completes to the success page.
2. A card beginning `4000 0000 0000 0002` reaches `data-state="declined"`, and **no order is
   created** — proved by counting posts to `/api/checkout` (zero) and by the order list.
3. The modal traps focus and Escape is not a way to lose the flow half-finished — either it is
   refused like the age gate's `onEscape: null`, or it cancels cleanly back to the form. Say which,
   and make the behaviour match in both the code and the standards doc.
4. Reduced motion: the states still change, nothing slides or pulses.

**Verify** — Playwright driving both cards at three widths, reading `data-state` at each step and
counting requests to `/api/checkout`; screenshots of `challenge`, the refused code, `approved` and
`declined`; a reduced-motion context for the same flow. Then `$WPDEV wp eval` to list orders before
and after the declined run and show the count unchanged.

**Size** — M.

---

## T5 — Record the simulated method on the order and the receipt — `[ ]`

**Goal** — An order created through the UI says which method was simulated, on WooCommerce's own
record and on the demo receipt.

**Depends on** T3. **Parallel with** T4 — but see T6, which shares `demo-order-summary.tsx`.

**Context to load** — `docs/features-plan.md` under **F3** and the F3 row of its Decisions table;
`frontend/src/app/api/checkout/route.ts`; `frontend/src/lib/wp/rest.ts` (`createOrder` and the
`OrderSummary` read); `frontend/src/lib/wp/types.ts`; `frontend/src/lib/demo-order.ts` (the receipt
contract and its `useSyncExternalStore` reader);
`frontend/src/components/checkout/demo-order-summary.tsx`; `docs/headless-contract.md` for the REST
shape already proved against the live endpoint.

**Do**

1. Map the method id to the text WooCommerce records, and say it was simulated — the shop's own
   record must not read like a real payment either.
2. Pass it to `createOrder` so the created order carries it, through a field the REST API already
   accepts (payment method / title). Do not invent an order meta key without checking the API
   first.
3. Carry the same value on the demo receipt, so the demo path is as honest as the real one, and
   only for the run that placed it — `lib/demo-order.ts` writes it and `demo-order-summary.tsx`
   reads it.
4. Keep the existing "nothing is charged" copy on the checkout and the order page.
5. Update `frontend/README.md` if a new lib surface appears.

**In scope** — `frontend/src/app/api/checkout/route.ts`, `frontend/src/lib/wp/rest.ts`,
`frontend/src/lib/wp/types.ts`, `frontend/src/lib/demo-order.ts`,
`components/checkout/demo-order-summary.tsx`, `frontend/README.md`.

**Out of scope** — the selector and the card form (T3); the challenge (T4); any schema change on the
WordPress side; the timeline (T6).

**Acceptance criteria**

1. An order created through the UI records the simulated method — read back with WP-CLI, not from
   the browser.
2. The demo receipt shows the same method for the run that placed it, and shows nothing for a run
   that placed none.
3. The recorded text says the payment was simulated.
4. `npx tsc --noEmit` is clean and the checkout's existing error and demo paths still work.

**Verify** — place one order through the browser, then
`$WPDEV wp eval 'echo wc_get_order(<id>)->get_payment_method_title();'` → the simulated title, with
the order id quoted. Then stop WordPress (`$WPDEV down`) and place another to read the receipt's
method off the success page. Report both, and the `tsc` result.

**Size** — S.

---

## T6 — Post-purchase timeline — `[ ]`

**Goal** — The order page shows four stages with the current one marked, and a clearly-marked
reviewer control moves it along, persisted per order.

**Depends on** T5 (shared `demo-order-summary.tsx`). **Parallel with** T7.

**Context to load** — `docs/features-plan.md` under **F4**; `frontend/UI-STANDARDS.md`;
`frontend/src/app/checkout/success/[id]/page.tsx`; `components/checkout/demo-order-summary.tsx`;
`frontend/src/lib/demo-order.ts` for the `useSyncExternalStore` + module-scope-identity pattern;
`frontend/src/lib/wp/types.ts` (`OrderSummary.status`).

**Do**

1. `lib/order-timeline.ts`: pure. The four stages, the mapping from a WooCommerce status to a
   starting stage, and a reader/writer for the persisted stage keyed by the order id (a real id or
   `demo`), so two orders never share a stage.
2. `order-timeline.tsx`: a client component. An `<ol>` with `aria-current="step"` on exactly one
   stage, and a status log region with `aria-live="polite"`.
3. The reviewer control: visually distinct from the order's own status (its own label and border
   treatment), advancing one stage at a time and stopping at the last.
4. Render it on both paths — the real order page and the demo receipt — and start each from
   something true: the order's own status for the real one.
5. Say on the page that the tracking is a simulation and that nothing ships, in the voice the
   footer already uses. No courier name, no tracking number, no arrival date, no map.
6. No server writes: the stage lives in the browser, and the WooCommerce order is untouched.
7. `motion-reduce:` on any transition; update `frontend/UI-STANDARDS.md` and `frontend/README.md`.

**In scope** — `frontend/src/lib/order-timeline.ts` (new),
`frontend/src/components/checkout/order-timeline.tsx` (new),
`frontend/src/app/checkout/success/[id]/page.tsx`,
`components/checkout/demo-order-summary.tsx`, `frontend/UI-STANDARDS.md`, `frontend/README.md`.

**Out of scope** — any real courier, map, GPS or tracking number; writing the stage to WordPress;
notifications or email; the payment work in T3–T5.

**Acceptance criteria**

1. Four stages render in order with exactly one `aria-current="step"`, on both the real order page
   and the demo receipt.
2. The reviewer control advances one stage at a time and stops at the last; the log gains a line per
   advance and is announced.
3. A reload keeps the stage reached, and a different order id starts at the first stage.
4. The page states that the tracking is simulated and that nothing ships.
5. Advancing issues **no** request — proved by counting requests during the clicks.

**Verify** — Playwright at three widths: read the stages and `aria-current`, click the control four
times and read the stage and the log, reload and re-read, then open a `demo` receipt and a
different order id to show they do not share a stage; count requests during the clicks (expect 0).
Screenshots of the first and last stage at each width, confirmed with `file`.

**Size** — M.

---

## T7 — Search dialog over a client-side index — `[ ]`

**Goal** — `Cmd/Ctrl+K` opens a dialog that filters the catalogue as you type, with no request per
keystroke and no new dependency.

**Depends on** none. **Parallel with** T1–T6.

**Context to load** — `docs/features-plan.md` under **F5**; `frontend/UI-STANDARDS.md`;
`frontend/src/app/layout.tsx` (where the overlays are mounted and where `getCatalogue()` is already
called); `frontend/src/components/layout/{header,mobile-nav,mobile-nav-button}.tsx` and
`frontend/src/components/cart/cart-button.tsx` for how a trigger closes the other overlays;
`frontend/src/stores/nav.ts` and `stores/cart.ts`; `frontend/src/lib/modal-behaviour.ts`;
`frontend/src/components/ui/{button,container}.tsx`.

**Do**

1. `lib/search-index.ts`: pure. Build a flat index from the catalogue the layout already reads —
   products, ranges and their options — and score a query against it. Substring matching over a
   lowercased string is enough at this size; no dependency, fuzzy or otherwise.
2. Pass a **slim** index from `app/layout.tsx`: `{ slug, name, range, options }` and nothing else.
   `description` and `shortDescription` are HTML and must not be sent to the browser to power a
   title search.
3. A small store for the open state, mirroring `stores/nav.ts`, and each trigger closing the other
   two overlays through the existing stores — three overlays, one rule, no second mechanism.
4. `search-dialog.tsx`, mounted in `app/layout.tsx` beside the nav and the drawer, **never inside
   `<header>`**. `useModalBehaviour` gives the trap, Escape and focus return.
5. `Cmd/Ctrl+K` opens it from any page, listed in the trigger's accessible name; it must not open
   while the age gate is up. Arrow keys move through results, Enter follows the highlighted one,
   Escape closes and returns focus to where it came from.
6. Closing leaves the dialog `inert`, and a typed empty result is a designed state with a way out.
7. Update `frontend/UI-STANDARDS.md` (a third overlay, the shortcut, the focus order) and
   `frontend/README.md`.

**In scope** — `frontend/src/lib/search-index.ts` (new),
`frontend/src/components/search/{search-dialog,search-button}.tsx` (new),
`frontend/src/stores/search.ts` (new, or extend `stores/nav.ts` — say which and why),
`frontend/src/app/layout.tsx`, `frontend/src/components/layout/header.tsx`,
`frontend/UI-STANDARDS.md`, `frontend/README.md`.

**Out of scope** — any server-side or WordPress search; any new dependency; searching categories
that have no products; recent searches or analytics.

**Acceptance criteria**

1. `Cmd/Ctrl+K` opens the dialog from any route, and the header trigger opens it for keyboard and
   pointer alike; the trigger's accessible name mentions the shortcut.
2. Typing filters products, ranges and options as you type, with **zero** network requests; an
   empty result is a designed state with a way out.
3. Arrow keys move the highlight, Enter follows it, Escape closes and returns focus to the trigger.
4. Opening search closes the nav and the cart, and opening either of those closes search — never two
   open, from every starting pair.
5. The dialog is `inert` or absent while closed, and does not appear over the age gate.
6. No new dependency in `package.json`, and the panel obeys the reduced-motion rule.

**Verify** — Playwright: open by shortcut and by click, capture the request count while typing six
characters (expect 0 after the page load), walk the results with the keyboard, assert focus return,
then try all three overlay pairs in both orders and report how many dialogs report themselves open
each time. Screenshots of open, filtered and empty results at three widths, confirmed with `file`.

**Size** — M.

---

## T8 — Sweep: new states at three widths, keyboard, contrast, offline build — `[ ]`

**Goal** — Every new state is shown working at three widths with the evidence reported, and nothing
the last pass proved has regressed.

**Depends on** T1–T7.

**Context to load** — `docs/features-plan.md` (`Done when`, and its **Verification** section with
the four extra checks); `docs/ui-ux-tasks.md` T15's record and the scripts named there
(`/tmp/ui/t15/*.cjs` are reusable); `frontend/UI-STANDARDS.md`; the previous contrast table.

**Do**

1. Confirm WordPress and the dev server are up, and note which port is in use.
2. Walk every new state — the hold counting, the hold expired, the reward ladder at all three
   tiers, each payment method, the challenge, the refused code, the decline, the timeline at first
   and last stage, and search open, filtered and empty — at 1440x900, 768x1024 and 390x844.
3. Re-check the routes T1–T7 could have broken: `/`, `/shop`, a range, a product, `/checkout`, the
   success page, the five info pages and the three 404s. No horizontal overflow anywhere, one `h1`
   per page, and the 404s still answering **404**.
4. The keyboard pass, with the third overlay in the mix: skip link first, Escape from each overlay
   returning focus to its trigger, and no two overlays open from any starting pair.
5. Re-measure the contrast table, including any new boundary, against the previous numbers.
6. Run the plan's four extra checks: the honesty check on every new string, the no-card-data leak
   check, the zero-request check for search, and the hydration check for the clock.
7. `npm run build`, `npx tsc --noEmit`, `npm run lint` — and the build again with `$WPDEV down`.
8. Run the plan's Done-when list as a checklist and mark each item true or false with its evidence.
   **A false item is the finding, not a failure to report.**

**In scope** — fixes for anything the sweep turns up, recorded in the relevant task's `> verified:`
line, or as a new task appended to this file if it is larger than a small fix.

**Out of scope** — new features. If the sweep suggests one, put it in the plan's further
considerations rather than building it.

**Acceptance criteria**

1. Every new state has a screenshot at all three widths, with `file` output confirming the real
   dimensions.
2. Zero horizontal overflow at 390x844 on every route and state.
3. The contrast table re-measured meets ≥3:1 for UI boundaries and ≥4.5:1 for body text.
4. The four extra checks pass, or their failures are reported as findings.
5. Every Done-when item is marked true with its evidence, or false with the reason, and the count is
   reported.

**Verify** — the screenshots, the `file` output, the ratio table, the four checks with their
outputs, the three command results plus the offline build, and the marked-up Done-when checklist
with its true/false count.

**Size** — M.
