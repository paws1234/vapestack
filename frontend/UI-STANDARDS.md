# Vapestack frontend — UI standards

The measured rules for this storefront, written once so a change can be judged against numbers
instead of taste. Every ratio below was read out of the running site with `getComputedStyle` on
2026-09-11, not out of the token hex values — the two nearly always disagree once a semi-transparent
surface is involved.

Read this before changing anything in `frontend/src`. It is the context file for every visual task
in `docs/ui-ux-tasks.md`.

## How to verify a UI change here

```bash
WPDEV=/home/adminpaws/Desktop/dev/wp-kit/bin/wpdev
$WPDEV up .                                     # WordPress must be up or every catalogue page is the offline notice
ss -ltn | grep -E ':300[01]'                    # a dev server outlives its terminal; look before starting one
env -C frontend npm run dev                     # 3000, falling back to 3001 — use the port it prints
env -C frontend npm run build && env -C frontend npx tsc --noEmit && env -C frontend npm run lint
```

After a production build, a running `next dev` serves the prerendered output for SSG routes and
stays stale through a dev-server restart. `rm -rf frontend/.next` is what clears it.

### Screenshots at a real width

**The VS Code browser pane is not evidence for desktop.** It cannot be resized past its own width:
the layout stays at the pane width and is padded into a wider canvas, so a "1440px" screenshot is a
narrow layout in a wide frame and reads as a lie. `Emulation.setDeviceMetricsOverride` is silently
ignored there too, so a failed override leaves the viewport at whatever it last was — which is how a
loop once produced three identical files.

Use the Playwright-bundled Chromium, which lays out at the real width:

```bash
CHROME=$(ls -d ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome | tail -1)
mkdir -p /tmp/ui
"$CHROME" --headless=new --no-sandbox --hide-scrollbars --window-size=390,844 \
  --virtual-time-budget=8000 --screenshot=/tmp/ui/shop-390.png http://localhost:3000/shop
file /tmp/ui/shop-390.png          # must say 390 x 844 — check, do not assume
```

That flag set cannot seed storage, and the age gate covers the page, so it is the wrong tool for a
logged-in-looking audit. The alternative that can — and that also lets you resize, click and read
computed styles — is the bundled Chromium through Playwright, with `localStorage` established by
clicking the gate's own button rather than by writing the key by hand:

```bash
NODE_PATH=$(ls -d ~/.npm/_npx/*/node_modules | head -1) node your-script.cjs
```

Three widths, every time: **390x844, 768x1024, 1440x900.** Never report a change from a screenshot
taken before the last edit, and never reuse a page id from an earlier session.

### Measure after the transition settles

Tailwind's `transition` utility includes `outline-color` in its property list, so a focus ring
**animates in** over ~150ms rather than appearing. Reading `getComputedStyle(el).outlineColor` in
the same tick as a `Tab` press therefore returns the *starting* value — the element's own text
colour — which reads exactly like a focus ring that ignores the token. It does not:
`CSS.getMatchedStylesForNode` shows `:focus-visible { outline: 2px solid var(--color-neon-400) }`
matching, and the same element reports `rgb(182, 255, 61)` once the wait is added.

Wait for the transition before measuring any animated property, or the measurement is of the
previous state.

## Colour

Tokens live in `@theme` in `src/app/globals.css`. Tailwind v4 turns each into utilities, so there is
no config file.

| Token | Value | Role |
| --- | --- | --- |
| `--color-ink-950` | `#07080c` | Page background. |
| `--color-ink-900` | `#0b0d13` | Panels, cards, the drawer. |
| `--color-ink-800` | `#12151d` | Separators inside a panel, image wells. |
| `--color-ink-700` | `#1d212c` | Panel outlines and dividers. **Not for controls.** |
| `--color-ink-400` | `#7c8598` | Muted text. |
| `--color-ink-200` | `#c9cfdb` | Body text. |
| `--color-ink-50` | `#f5f7fb` | Headings and primary text. |
| `--color-neon-400` | `#b6ff3d` | Actions, accent text, focus ring. |
| `--color-neon-300` | `#d4ff7a` | Primary hover. |
| `--color-volt-400` | `#35e6ff` | The unavailable-combination notice. |

### Measured ratios

WCAG 1.4.11 asks **3:1** for anything a visitor must perceive to identify a control — a border, an
outline, an indicator. 1.4.3 asks **4.5:1** for body text and **3:1** for text 24px and over.

| Measured pair | Ratio | Needs | Result |
| --- | --- | --- | --- |
| `ink-700` border on `ink-900` (product card, range tile, sort select) | **1.21:1** | 3:1 | ✗ fail |
| `ink-700` border on `ink-950` (cart button, chips, billing input, textarea) | **1.25:1** | 3:1 | ✗ fail |
| `ink-800` border on `ink-900` (order-summary panel — decorative, not a control) | 1.06:1 | — | ok |
| `ink-400` text on `ink-900` | 5.24:1 | 4.5:1 | ✓ pass |
| `ink-400` text on `ink-950` | 5.4:1 | 4.5:1 | ✓ pass |
| `ink-200` text on `ink-900` | 12.42:1 | 4.5:1 | ✓ pass |
| `ink-50` text on `ink-950` | 18.66:1 | 4.5:1 | ✓ pass |
| `neon-400` text on `ink-950` | 16.55:1 | 4.5:1 | ✓ pass |
| `ink-950` text on a `neon-400` fill (primary button) | 16.55:1 | 4.5:1 | ✓ pass |

**The one real contrast failure is the border token, and it is system-wide.** Nine separate controls
were sampled and every one of them draws its boundary with `ink-700`, at 1.21:1 or 1.25:1 — roughly
a quarter of what is required. The primary button is fine because it is a filled surface, not an
outline; it is the *outline* variant, the inputs, the select and the cards that disappear. On a dark
screen a 1.21:1 border is not "subtle", it is invisible.

### Border roles

| Role | Token | Why |
| --- | --- | --- |
| Interactive boundary — button outline, input, select, chip, card-as-link | `--color-line` | ≥3:1, measured. |
| Panel outline, divider inside a panel | `ink-700` / `ink-800` | Decoration. 3:1 is not required and would make the page shout. |

`--color-line` is a **new token introduced in T2**, not a change to `ink-700`: `ink-700` is also the
panel and divider colour, and moving it would repaint the whole site. Target value `#5b6478` — it
computes to ≈3.28:1 on `ink-900` and ≈3.38:1 on `ink-950`. **Re-measure it in the browser and raise
it if it lands under 3:1 on either surface.**

## Type and spacing rhythm

Two families, loaded with `next/font`: Geist Sans (`--font-geist-sans`) and Geist Mono
(`--font-geist-mono`, currently unused).

| Role | Classes | Notes |
| --- | --- | --- |
| Page `h1` | `text-3xl sm:text-4xl font-semibold text-ink-50` | Shop, category, product, info pages. |
| Home hero `h1` | `text-4xl sm:text-6xl font-semibold leading-tight` | The one exception, and it earns it. |
| Section `h2` | `text-2xl font-semibold text-ink-50` | Not `text-xs`. The current home page uses both for `h2`, which is the bug T11 fixes. |
| Eyebrow / label | `text-xs uppercase tracking-[0.25em] text-ink-400` | One tracking value. `[0.2em]` and `[0.3em]` are in use today and are drift. |
| Body | `text-base` / `leading-relaxed text-ink-200` | |
| Secondary | `text-sm text-ink-400` | Metas, captions, counts. |
| Small print | `text-xs text-ink-400` | Footer, disclaimers. Still 5.24:1, so it stays legible. |

| Rhythm | Value | Where |
| --- | --- | --- |
| Container | `max-w-6xl` + `px-5 sm:px-8` | Every page. Now `Container`. |
| Section gap | `mt-16` (4rem) | Between major sections on a page. |
| Footer separation | `mt-20` (5rem) | The end of every page. |
| Page padding | `py-10` | Listing and detail pages. |
| Card grid | `gap-5`, `sm:grid-cols-2 lg:grid-cols-3` | |
| Tile grid | `gap-4`, `sm:grid-cols-3` | |

Radii are role-based, not decorative: `rounded-full` for anything pill-shaped (buttons, chips,
badges), `rounded-xl` for inputs and small thumbs, `rounded-2xl` for cards and tiles, `rounded-3xl`
for hero panels, modals and large image wells.

## Component and state rules

Every interactive element must define **five** states, and none of them may be conveyed by colour
alone:

| State | Rule |
| --- | --- |
| Rest | Names its role. A button with no visible boundary is not a button — see the contrast table. |
| Hover | A change in boundary or fill. `hover:` only; never required to understand the control. |
| Focus | `:focus-visible` draws `2px solid neon-400` with `2px` offset, set globally in `globals.css`. Nothing may remove it. An element that is a `peer` gets `peer-focus-visible:ring-2 peer-focus-visible:ring-neon-400`. |
| Disabled | `disabled:opacity-50` and `disabled:cursor-not-allowed`. A disabled control stays in the layout — a control that vanishes is harder to account for than one that is plainly unavailable. |
| Loading | The control keeps its size and says what is happening. Never swap a label for a spinner alone. |

Empty, error and offline are states of a *page*, not of a control: each gets a designed block with a
heading, an explanation and a way out. `OfflineNotice` is the reference implementation.

**An error page's "Try again" needs `router.refresh()` as well as `reset()`.** Measured while
implementing T7: a click on a `reset`-only button issued **no request at all**. `reset()` re-renders
the payload the browser already holds, so an error thrown while rendering on the server comes
straight back and the button looks dead. `app/error.tsx` calls both, and the same click then
refetches the segment and the page recovers — proved by a probe route that stopped throwing the
moment the test changed a cookie.

**The shop's sort control is a real `GET` form, and its "Apply" button is deliberate.** It is the
no-JS path — a `<select>` cannot navigate on its own — and `onChange` only adds a `router.push` on
top of it. Do not "simplify" it to a controlled select. The URL is the state: the pages read
`searchParams`, order the catalogue on the server, and the grid stays a server component. That is
what makes a sorted shop shareable and the back button correct (both verified: the select follows
the URL back to `name`, and the grid follows it).

Sold-out is not disabled. An option that is unavailable stays clickable and stays reachable by
keyboard, is struck through, and is explained by a notice that names the working alternative.

**Every product image is contained, never cropped.** The card tile, the product page's image and the
cart line all use `object-contain` against a panel-coloured background, so the tile is a frame rather
than a crop. The whole catalogue is imported now, and its photographs are not a uniform shape: of the
first eleven, ten were square and fitted the tile exactly and the eleventh was 300x404, where
`object-cover` threw away **26%** of its long edge — which on a product photograph means cutting the
product. Nothing is cropped, so nothing has to be checked for what it cut off.

### The cart's hold is a clock, and clocks are a hydration trap

The drawer holds the cart for ten minutes and says so. Three rules came out of building it, and
they apply to any future feature with a clock in it:

1. **Store a deadline, never a countdown.** `expiresAt` in `stores/cart.ts` is an absolute time.
   The remaining time is derived on each tick, so a tab the browser has throttled catches up
   instead of drifting behind by however long it was in the background.
2. **The tick runs only while somebody is looking.** `lib/use-live-hold.ts` starts one interval on
the first subscriber and clears it when the last leaves; the drawer subscribes only while it is
   **open and has lines in it**. Because the state is a stored deadline, a closed drawer loses
   nothing by not watching — reopening re-reads it and shows the truth, expired included.
3. **`getServerSnapshot` is what keeps hydration quiet.** React uses it for the server render *and*
   for the hydration render, so the served HTML and the first client render agree on "no clock, no
   hold to show" whatever the real clock says. That is also what lets the module hold a real
   `Date.now()` without a mismatch. A countdown computed during render would be the bug
   `skipHydration` exists to prevent, in a different disguise.

**A per-second countdown is not a live region.** A number that changes every second is noise to a
screen reader, and this feature has exactly one transition worth announcing — the hold running
out. That transition goes through a `role="status"` element that is already in the DOM while the
hold is merely counting, so the change is announced rather than silently mounted. The three states
(`counting`, `expired`, none) are also exposed as `data-cart-hold` so a test reads a state instead
of guessing from the text.

Nothing in the hold animates, so it carries no `motion-reduce:` neighbour — the rule is about
animations, not about states that change.

### There are three overlays now, and one rule

The search dialog is the third thing that covers the screen, so the one-overlay-at-a-time rule has
to hold three ways rather than two.

- **Each trigger closes the other two**, through the stores, exactly as the cart and the nav already
did. `SearchButton` closes the nav and the cart before opening; the cart button and the mobile nav
button both close search. There is no second mechanism and no provider.
- **The panel is mounted by `app/layout.tsx`**, never inside `<header>`, and stays mounted with
  `inert` while closed. Verified: closed, the panel is `inert`, its wrapper is `aria-hidden="true"`,
  and it holds **0** tabbable controls.
- **While one overlay is open its backdrop covers the header** (`z-50` over the header's `z-40`), so
the pointer cannot reach another trigger. That is why the *reachable* way to start a second overlay
is `Cmd/Ctrl+K` — which is precisely the path that closes the first. Measured at 390 across six
  pairs, in both orders: exactly **one** dialog is open every time.
- **`Cmd/Ctrl+K` is refused while the age gate is up.** The gate owns the screen until it is
  answered, and it sets `data-age-gate="off"` on `<html>` when it is — so the shortcut reads that
  attribute rather than keeping a second store in step. Measured with the gate showing: `searchOpen`
  **false**, and the only non-`inert` dialog is the gate's own.

**The dialog is a combobox, not a list of links.** The input keeps focus and the highlight moves by
`aria-activedescendant` (`role="combobox"` + `role="listbox"`/`role="option"`), which is the
standard shape and the only one where typing keeps working while arrow keys move a selection. Enter
follows the highlighted result; Escape closes and `useModalBehaviour` hands focus back — to the
trigger when the trigger opened it, and to wherever focus was when the shortcut did.

**The query lives in the store, not in the dialog, and `open()` clears it.** Three things can open
this dialog and the one thing that matters is that a fresh open starts empty; putting the reset in
`open()` avoids an effect watching `isOpen`, which would be the `set-state-in-effect` lint error
this project forbids.

**Zero requests.** The index is built on the server from the catalogue read the layout already makes,
and filtering it is a function call: typing six characters recorded **0** requests, and so did
opening the dialog. A substring match over a lowercased string is enough for a catalogue this size,
and a fuzzy-matching dependency would need its own written decision.

### A timeline says where it is, and the control that moves it says what it is

- **Exactly one stage carries `aria-current="step"`**, at every width and on both the real order
  page and the demo receipt. Reached stages also carry a drawn tick and an `sr-only` suffix
  (`— current stage` / `— already reached` / `— not yet`), so progress never depends on colour.
- **The reviewer control is not part of the order.** It is a dashed-outline button in its own block
  with its own sentence — *"A reviewer control, not part of the order"* — and it is disabled at the
  last stage. A disabled control stays in the layout (see the five-state rules above), relabelled
  `Every stage reached`, so the end of the sequence is visible rather than the control vanishing.
- **The log is the live region, not the stage list.** Announcing the whole `<ol>` on every step
  would be noise; the `aria-live="polite"` log gains one line per advance, which is the thing worth
  announcing. The same shape as the cart's hold and the reward ladder.
- **The stage is persisted per order id**, keyed `vapestack-timeline:<id>`, so two orders never
  share one, and read through `useSyncExternalStore` with a `getServerSnapshot` of "nothing
  recorded" — the hydration rule the hold and the demo receipt also follow. A real order's own
  WooCommerce status is a *floor*: a persisted stage can move it forward, never back.
- **Advancing issues no request at all**, proved by counting them (0 across four clicks): the stage
  lives in the browser and the WooCommerce order is never updated. There is no courier name, no
  tracking number, no arrival date and no map in the copy, because none of those exist here.

### The payment sandbox is a step machine, and the card never leaves the browser

Three rules came out of the checkout's payment block, and they are rules rather than choices.

1. **The flow is a written-down machine, exposed as `data-state`.** `lib/payment-simulation.ts`
   holds the steps (`idle → validating → challenge → authorising → approved | declined`) and the
   transitions each may make; the checkout form moves through `go(next)`, which refuses a step the
   machine does not have. The payment `<section>` carries `data-state={step}`, so a test reads the
   state instead of inferring it from which paragraph is on screen.
2. **The card fields are uncontrolled and are read once.** `card-form.tsx` never puts a digit into
   React state: the checkout form reads `cardName`/`cardNumber`/`cardExpiry`/`cardCvc` out of its
   own `FormData` at submit, `validateCard` returns only *errors* and the outcome is derived by
   `cardOutcome` — the digits go out of scope with the local object. The request body carries
   `payment: "card"` and nothing else. Fields carry `autoComplete="off"` and `inputMode="numeric"`
   and deliberately **no** `autocomplete="cc-number"`.
3. **Only the chosen method's fields are in the DOM.** The panel is keyed on the selection, so
   switching method unmounts the card inputs. There is nowhere for a typed number to be left behind.

**A `required` control in an always-mounted, `inert` dialog is a bug.** The 3-D Secure dialog stays
mounted so it can be `inert` when closed (the same reason the drawer and the nav do), and a
`required` input inside it makes the browser refuse to submit the *checkout* form with *"An invalid
form control with name='tdsCode' is not focusable"* — the payment never starts. The empty code is
refused by the dialog's own message instead. Verified while building T3.

**Escape cancels the challenge; it does not refuse to close.** The dialog is a retryable step, not a
question that must be answered like the age gate, so `useModalBehaviour` is given a real `onEscape`
that returns to the form: the cart is untouched, no order exists and the typed details are still
where the visitor left them. Cancel does the same thing.

**A decline is a designed state, not an error page.** It is rendered as a `role="alert"` block in the
form, the submit button says "Try another card", and the dialog closes — there is no dead end and
nothing is silently swallowed.

### A ladder is a pure function, and its track is a boundary

The drawer's spend ladder is `rewardProgress(subtotal)` in `lib/cart-rewards.ts`: a number in, a
state out, no store and no state of its own. Anything derived from the cart belongs there —
putting it in the store would be derived state in a store that deliberately has none.

Two things about it are rules rather than choices:

- **The track uses `--color-line`, not a decorative token.** The *extent* of a progress bar is the
  information, so the bar has to be perceivable: `ink-800` on `ink-900` is 1.06:1 and a visitor
  cannot see where the bar starts. The fill is `neon-400`, well clear of the track.
- **The claim and its disclaimer live in the same block.** This shop can unlock nothing — it takes
  no payment and ships nothing — so the ladder carries a `Simulation` pill **and** a sentence
  saying so. A pill alone is a label; the sentence is what a visitor actually reads. (F4 has the
  same problem for a tracking timeline, and gets the same answer.)

## Accessibility checklist

- **Skip link first.** `SkipLink` is the first focusable element in `<body>`; it targets
  `#main-content`, which is `<main>` with `tabIndex={-1}` so focus actually moves.
- **One `h1` per page**, no skipped levels. Captions and eyebrows are not headings.
- **Announce the transition, not the value.** A live region holds the thing worth interrupting
  for — a hold running out, a rung of the ladder being reached — never a number that moves on its
  own. Both live regions here are `role="status"` elements that are already in the DOM before the
  change, so the change announces instead of mounting silently. Text that does not change is not
  re-announced, which is how "once per crossing" is achieved without a timer or a stored
  previous value.
- **`aria-current="page"`** on the nav link and the chip for the range being viewed.
- **`aria-live="polite"`** for anything that changes without navigation: the chosen price and
  availability, the cart count, the shop result count.
- **Native controls over ARIA.** Selectors are real radios, `sr-only` inside their own `<label>`,
  with the visible pill in a sibling span so `peer-focus-visible:` can draw the ring. Arrow keys and
  grouping come free.
- **`alt=""` on product imagery inside a card**, because the product name is the heading in the same
  link and a second name would only repeat it. Alt text is required on the product page's main
  image, where WordPress supplies it.
- **Modals**: `role="dialog"`, `aria-modal="true"`, labelled by their heading, focus trapped, focus
  returned to the trigger, and `inert` when closed. All of it comes from `useModalBehaviour` — do not
  write a second focus trap.
- **Overlays are never mounted inside `<header>`.** That element is `backdrop-blur`, and a
  `backdrop-filter` is the containing block for `position: fixed` descendants, so a fixed overlay
  inside it would be positioned against the header box. Every overlay lives in `app/layout.tsx`.
- **No horizontal overflow.** `document.documentElement.scrollWidth === clientWidth` at every width,
  on every route.
- **Zoom and reflow** to 320px wide without loss of content or function.

## Motion and reduced motion

A transition may never be the thing that makes a change understandable. Every animation carries a
`motion-reduce:` neighbour and the state still changes, it just stops moving.

There are exactly **five** things in this app that move, and each is guarded. `grep -rn
"animate-\|duration-" src/` is the check, and every hit that is not a pure colour transition is in
this table:

| What moves | Duration / easing | Guard |
| --- | --- | --- |
| Cart drawer panel slides in | `300ms`, `ease-out` | `motion-reduce:transition-none` |
| Cart drawer backdrop fades | `300ms`, default easing (`cubic-bezier(0.4, 0, 0.2, 1)`) | `motion-reduce:transition-none` |
| Mobile nav panel slides in | `300ms`, `ease-out` | `motion-reduce:transition-none` |
| Mobile nav backdrop fades | `300ms`, default easing | `motion-reduce:transition-none` |
| Product card image zooms on hover | `500ms`, default easing | `motion-safe:group-hover:scale-105` **plus** `motion-reduce:duration-0` |
| 3-D Secure dialog and its backdrop fade in | `300ms`, default easing | `motion-reduce:transition-none` (`transitionProperty` measured as `none` under `prefers-reduced-motion: reduce`, and the steps still change) |
| Search dialog and its backdrop fade in | `300ms`, default easing | `motion-reduce:transition-none` |

Note the shape of the card's guard: the zoom is written as `motion-safe:` so there is no transform
to animate at all under reduced motion, and `duration-0` is kept alongside it because the
acceptance check is a grep for a `motion-reduce:` neighbour on anything with a `duration-`. The two
together mean the image is simply still.

**The skeleton is gone, so there is nothing to pulse.** T7 removed `app/loading.tsx` because it cost
every `notFound()` route its 404 status (see below). A loading state, if it is ever wanted, has to
be an explicit `<Suspense>` inside a page — and it has to carry the same `motion-reduce:` treatment
when it arrives.

`transition` on its own — a colour, border or opacity change with no movement — is exempt: that is
not motion, and a link that stops changing colour under reduced motion would be worse, not better.
The utilities in use are `transition-colors`-shaped even when written as the bare `transition`.

**Nothing becomes usable only after a transition finishes.** Both overlays are always mounted: the
drawer and the nav are hidden with `inert` and `pointer-events-none`, applied in the same commit
that changes `translate`, so a reduced-motion (or interrupted) animation cannot leave a panel
unreachable or a closed panel clickable.

## There is no root `loading.tsx`, and adding one would be a bug

Measured on 2026-09-11, toggling only that file:

| State | `/product/does-not-exist` | `/shop/does-not-exist` |
| --- | --- | --- |
| `app/loading.tsx` present | **200** | **200** |
| `app/loading.tsx` removed | **404** | **404** |

A `loading.tsx` creates a Suspense boundary around the whole page, so Next flushes the shell and
commits to a 200 before the page body is rendered — and `notFound()` is thrown inside that body, too
late to change the status. The visitor still sees the designed 404; a crawler sees a success. Five
repeats in each state, so it is the file and not timing.

The unknown-slug status is a correctness matter and the skeleton is decoration, so **the status
wins**. If a loading state is wanted later, it has to be an explicit `<Suspense>` inside a page
around its slow subtree — the page function then runs first and `notFound()` still decides the
status — not a `loading.tsx` at any level above the routes that 404.

Reproduced independently while implementing T7: 5/5 `200/200` with the file, 5/5 `404/404` without
it. Two further measurements, so nobody repeats the search: `app/shop/loading.tsx` alone is enough
to cost `/shop/<unknown>` its 404 as well, because the `[category]` child inherits its parent's
boundary, while `/product/<unknown>` keeps its own; and raising `notFound()` from `generateMetadata`
does not rescue the status — metadata streams too.


## Responsive contract

| Width | Must be true |
| --- | --- |
| **390x844** — phone | Header is wordmark + menu + cart, and the menu reaches Shop, every range and "Shop all" in two taps or fewer. Footer stacks in one column. Cards 1-up. Page `h1` is `text-3xl`. No horizontal overflow. |
| **768x1024** — tablet | Header is wordmark, "Shop all", search, menu and cart; the **menu panel** reaches every range, because the inline nav starts at `xl` (see below). Cards 2-up. Footer may be 2-up. No horizontal overflow. |
| **1024x1280** — small laptop | Same header as the tablet: the panel, not the inline nav. Cards 3-up. |
| **1280x** and up — desktop | Inline nav, all nine ranges plus "Shop all", cards 3-up, container capped at `max-w-6xl`. |

**Why the inline nav starts at `xl` and not `md`.** Measured on 2026-09-11 with the nine ranges the
catalogue holds, the ten nav links need **703px**. Beside the wordmark and the header's controls that
is **+353px** of overflow at 768 and **+97px** at 1024, and it fits from 1280 (0 at 1280, 1440 and
1600). `NavLinks` is therefore `xl:flex` and `MobileNavButton` / the panel are `xl:hidden`; the
panel's resize guard matches at `(min-width: 1280px)`. Before the range count grew, the same header
overflowed by 45px at exactly 768 — with the nav out of the way that is **0** at 390, 768, 1024, 1280,
1440 and 1600.

Target size: a standalone target (a nav link, a button, a chip) needs **24x24 CSS px** (WCAG 2.5.8).
Links inside a sentence are exempt; links in a nav are not. Measured today, the desktop nav links are
20px tall without padding and 28px with `py-1`.

Tailwind defaults in use: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.

## Tailwind v4 traps this project has already paid for

1. **Unlayered rules beat every layer.** A `display: none` inside `@layer base` loses to
   `display: flex` from the `utilities` layer regardless of specificity. The age gate's pre-paint
   switch at the end of `globals.css` is deliberately outside any layer, and it must stay there.
2. **`hidden` does not reliably hide a display utility.** In the generated stylesheet the order is
   `.flex` → `.hidden` → `.inline-flex`, so `class="inline-flex … hidden"` stays visible: the later
   `.inline-flex` wins on order, not specificity. `hidden md:flex` happens to work, `hidden
   md:inline-flex` does not. **Use a variant** — `max-md:hidden`, `md:hidden` — because variants are
   emitted after the base utilities. This is why the header's "Shop all" link is `max-md:hidden`.
3. **No config file.** Tokens are `@theme { --color-… }` in `globals.css` and nothing else.

## The audit trail

The findings this document was written from, and the fixes they justify, are in
`docs/ui-ux-plan.md`. The tasks that apply them are in `docs/ui-ux-tasks.md`. When a task proves a
new rule, add it here — this file is the record, not the plan.
