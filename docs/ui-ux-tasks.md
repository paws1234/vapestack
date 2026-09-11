# Tasks: Vapestack storefront — UI/UX enhancement

From `docs/ui-ux-plan.md`, written 2026-09-11.

Any single task can be run on its own in a fresh session by asking for it by id, for example:
`do T5 of docs/ui-ux-tasks.md`. Each task carries the context it needs, what it may touch, what
proves it, and how it is verified — so a session needs this file and the repository, nothing else.

This is the second pass over this project. `.claude/tasks.md` holds T1–T19 (backend, data layer,
cart, checkout, deploy) and is **finished**; nothing here edits it, and nothing here touches PHP.

## How to run a task

1. Invoke one task by id in a fresh session if you like. The task carries its own Goal, Context to
   load, In scope / Out of scope, Acceptance criteria and Verify.
2. Load only that task's **Context to load** — a handful of files, never the whole repo — make the
   change, then run its **Verify**.
3. Tick that task's checkbox and add a `> verified:` line underneath with the command and the
   observed result. That line is the record the next session reads; there is no separate status
   document.
4. Report, then take the next unticked task in order, unless a task names something under
   **Parallel with**.
5. If a task turns out to be wrong or impossible, stop and correct this file rather than quietly
   substituting different work.
6. **Never report a visual change from a screenshot taken before the last edit**, and never reuse a
   browser page opened in an earlier session — it may be holding a render from before the change.
   Re-navigate and re-shoot after every edit.

## Where context comes from

- `docs/ui-ux-plan.md` — the source plan: Goal, Steps, Constraints / Out of scope, Done when, and
  the eleven audit findings that justify every task here.
- `frontend/UI-STANDARDS.md` — **written by T1**, and the context file for every task from T2 on:
  measured contrast table, type and spacing rhythm, state rules, a11y checklist, reduced-motion
  rule, breakpoint contract, and the Tailwind v4 traps.
- `frontend/README.md` — the app's own rules. Two of them bind every task: every route is
  `force-dynamic` on purpose, and WordPress being unreachable is an expected state rather than an
  error.
- `frontend/src/lib/wp/catalog.ts` — `getCatalogue()` answers `null` when WordPress is away.
  Anything reading the catalogue must handle that.
- Skill `visual-testing` (`/home/adminpaws/.agents/skills/visual-testing/SKILL.md`) — read it
  before any task whose Verify takes a screenshot.
- Skill `wordpress-best-practices` (`/home/adminpaws/.agents/skills/wordpress-best-practices/SKILL.md`)
  — its "evidence over assertion" section applies to every task here, even though no task writes
  PHP.

### Shared commands

```bash
WPDEV=/home/adminpaws/Desktop/dev/wp-kit/bin/wpdev
PORT=3000                # check before assuming: next dev falls back to 3001

$WPDEV status                                        # is WordPress up?  (frontend needs it for a catalogue)
ss -ltn | grep -E ':300[01]'                         # is a dev server already listening?
env -C frontend npm run dev                           # if not
env -C frontend npm run build && env -C frontend npx tsc --noEmit && env -C frontend npm run lint
```

A `next dev` server **outlives the terminal that started it**, so killing a terminal is not a
restart. After a production build, `rm -rf frontend/.next` is what clears a stale prerender.

### Shared screenshot recipe

The VS Code browser pane cannot be resized past its own width — it silently pads the canvas, so a
"1440px" shot taken there is a 306px layout in a wide frame. Use the Playwright-bundled Chromium,
which lays out at the real width:

```bash
CHROME=$(ls -d ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome | tail -1)
mkdir -p /tmp/ui
"$CHROME" --headless=new --window-size=1440,900 --hide-scrollbars \
  --screenshot=/tmp/ui/<page>-1440.png "http://localhost:$PORT/<route>"
file /tmp/ui/<page>-1440.png      # must say 1440x900, not the pane width
```

Repeat at `768,1024` and `390,844`. Confirm each PNG's real dimensions with `file` before
believing it, and measure where content actually ends before drawing a conclusion from a wide one.

## Status

| Task | What | Status | Depends on |
| --- | --- | --- | --- |
| T1 | Audit and UI standards doc | done | — |
| T2 | Tokens and shared primitives | done | T1 |
| T3 | Mobile navigation | done | T2 |
| T4 | Header polish | done | T2, T3 |
| T5 | Footer rebuild | done | T2 |
| T6 | Info and legal pages | done | T2, T5 |
| T7 | Not-found, error and loading states | done | T2, T5 |
| T8 | Shop listing: URL sort, empty state, a11y | done | T2, T7 |
| T9 | Product card polish | not started | T2 |
| T10 | Product page depth | not started | T2, T9 |
| T11 | Home page sections and copy | not started | T2 |
| T12 | Metadata, OG image, sitemap, robots | not started | T2 |
| T13 | Motion and reduced-motion pass | not started | T2 |
| T14 | Documentation updates | not started | T2–T13 |
| T15 | End-to-end verification sweep | not started | T1–T14 |
| T16 | Header ranges, regrouped | done | T2, T3 |
| T17 | The home hero, after the catalogue grew | done | T2, T11, T16 |

Keep this table in step with the checkboxes: when a task is ticked, change its row here too.

Definition of done for the whole plan: every range and the shop are reachable from a phone header
in two taps or fewer; the footer is a real footer with navigation, legal links, the 21+ notice and
a copyright line, and it renders with WordPress stopped; unknown slugs, thrown errors and slow
routes each show a designed page, the unknown slug with a 404 status; every interactive border
measures ≥3:1 in the browser; the product page has breadcrumbs, quantity, spec/shipping details,
related products and valid JSON-LD; the shop sorts by URL and has an empty state; `/sitemap.xml`,
`/robots.txt` and an OG image exist; `frontend/UI-STANDARDS.md` records the measured standards;
and `build`, `tsc --noEmit` and `lint` are clean.

---

## T1 — Audit the rendered site and write the UI standards — `[x]` done

**Goal** — `frontend/UI-STANDARDS.md` exists and holds measured numbers, and the audit findings are
recorded in repository memory.

**Depends on** none. **Parallel with** none — everything else loads this file.

**Context to load** — `docs/ui-ux-plan.md` (the eleven audit findings); `frontend/src/app/globals.css`;
`frontend/src/components/ui/{button,badge,price}.tsx`; `frontend/src/components/layout/{header,footer}.tsx`;
the shared commands and screenshot recipe above; memory file `/memories/repo/vapestack-storefront.md`.

**Do**

1. Bring the site up: `$WPDEV up .`, then a dev server on `:3000` (`ss -ltn` first — 3000 may be
   taken, in which case use the port `next dev` prints and use that number everywhere below).
2. Walk the six routes — `/`, `/shop`, `/shop/disposables`, `/shop/e-liquids`,
   `/product/neon-rush-6000`, `/checkout` — at 1440x900, 768x1024 and 390x844 with the recipe
   above, and note what is actually broken at each width. Confirm the phone-header finding (no
   nav and no "Shop all" below 768px) rather than assuming it.
3. **Measure contrast in the browser**, from `getComputedStyle`, not from the hex values: for every
   element with a border or a background that a visitor is meant to perceive as a control, take its
   `color`, `backgroundColor` and `borderTopColor`, and compute the WCAG relative-luminance ratio
   against the nearest opaque background. Report the pairs in a table. The plan predicts
   `ink-700` on `ink-900` = 1.21:1 and on `ink-950` = 1.25:1 — either reproduce those or say what
   the real numbers are.
4. Write `frontend/UI-STANDARDS.md` with these sections, and no padding:
   - **How to verify a UI change here** — the shared commands and the screenshot recipe, including
     *why* the VS Code pane is not evidence for 1440px.
   - **Colour** — the token table with the measured ratios and a pass/fail against 3:1 for UI
     boundaries and 4.5:1 for body text.
   - **Type and spacing rhythm** — the scale actually in use (sizes, weights, tracking, section
     gaps), so `mt-16` is a decision rather than a habit.
   - **Component and state rules** — what hover, focus, active, disabled, loading, empty and error
     look like, and which token each uses.
   - **Accessibility checklist** — skip link, focus visibility, `aria-current`, `aria-live`,
     keyboard operability, the `sr-only` radio pattern, and the `alt=""` rule for product imagery
     with its justification (the heading inside the same link already names the product).
   - **Reduced motion** — the rule T13 implements.
   - **Responsive contract** — the three widths above and what must be true at each.
   - **Tailwind v4 traps already paid for** — unlayered rules beat every layer; `hidden` loses to a
     later-emitted display utility, so use a variant (`max-md:hidden`), not `hidden md:flex`.
5. Record the same findings in `/memories/repo/vapestack-storefront.md` (a `## UI standards` line
   pointing at the doc plus the measured ratios).

**In scope** — `frontend/UI-STANDARDS.md` (new); `/memories/repo/vapestack-storefront.md`.
**Out of scope** — any change to application code. This task measures and writes down; T2 onwards
changes things. Do not "fix as you go".

**Acceptance criteria**

1. `frontend/UI-STANDARDS.md` exists and its contrast table contains ratios measured in the browser
   this session, each labelled pass or fail against 3:1 or 4.5:1.
2. The document names the screenshot method that works here and the reason the VS Code pane is not
   evidence for desktop widths.
3. The phone-header finding is confirmed or corrected from a screenshot at 390x844, not from
   reading the source.
4. Repository memory carries the measured ratios.

**Verify** — `cat frontend/UI-STANDARDS.md` plus the three screenshots of `/shop` at
`/tmp/ui/shop-{1440,768,390}.png` with `file` output showing the real dimensions, and the computed
ratio table. Report the actual numbers.

**Size** — M

> verified: `frontend/UI-STANDARDS.md` written. 15 screenshots at real widths —
> `file /tmp/ui/*.png` reports `1440 x 900`, `768 x 1024`, `390 x 844` for `/`, `/shop`,
> `/shop/e-liquids`, `/product/neon-rush-6000` and `/checkout`. No horizontal overflow anywhere:
> `scrollWidth === clientWidth` (1440/1440, 768/768, 390/390) on all five routes; document heights
> 946–3732px, so nothing was lost to a clipped capture.
> Contrast measured in the browser with `getComputedStyle` and backgrounds composited to the nearest
> opaque ancestor (throwaway script, `/tmp/ui/measure.cjs`): **`ink-700` `#1d212c` borders measure
> 1.21:1 on `ink-900` and 1.25:1 on `ink-950`**, sampled on the cart button, the unselected range
> chip, the sort select, the billing input, the note textarea, the product card and the range tile —
> nine controls, every one failing 1.4.11's 3:1. `ink-800` on `ink-900` is 1.06:1 and is decorative.
> Text passes everywhere: `ink-400` 5.24:1 / 5.4:1, `ink-200` 12.42:1, `ink-50` 18.66:1, `neon-400`
> 16.55:1, primary-button `ink-950` on `neon-400` 16.55:1. The plan's predicted numbers were 1.21:1
> and 1.25:1 — reproduced exactly.
> The phone-header finding is confirmed from the 390x844 screenshot, not from the source: the header
> holds only `VAPESTACK` and `Cart`, with no menu and no "Shop all". The hero eyebrow reads
> "HEADLESS STOREFRONT DEMO" and the body explains the stack — README voice on a shop page.
> Recorded in `/memories/repo/vapestack-storefront.md` under `## UI standards`.
> Two things worth carrying forward: `/checkout` with an empty cart renders the empty state and not
> the form, so anything measuring `input#firstName` must add an item through the PDP first; and
> `chrome --headless=new --screenshot` cannot seed `localStorage`, so the age gate covers the page —
> dismissing it means driving the Playwright package from the npx cache and clicking the gate's own
> button.

---

## T2 — Tokens and shared primitives — `[x]` done

**Goal** — An interactive-border token that measures ≥3:1, a danger token, and five primitives
(`Container`, `Field`, `Select`, `Prose`/`InfoPage`, `SkipLink`) exist; `getCatalogue()` is cached.

**Depends on** T1. **Parallel with** T5, T6, T11, T12, T13.

**Context to load** — `frontend/UI-STANDARDS.md` (written by T1 — this is the token table and the
contrast targets); `frontend/src/app/globals.css`; `frontend/src/components/ui/button.tsx`;
`frontend/src/components/checkout/checkout-form.tsx`; `frontend/src/lib/wp/catalog.ts`;
`frontend/src/lib/wp/graphql.ts` (for the `revalidate` and `tags` already in use).

**Do**

1. Add to `@theme` in `globals.css`: a border token for interactive controls at ≥3:1 against both
   `ink-900` and `ink-950` — **a new token, not a change to `ink-700`**, which is also used for
   panel borders and dividers where 3:1 is not wanted — and a `danger` colour for error text.
   Keep every existing token value unchanged.
   Then apply that token to **every interactive boundary the audit listed**, not only the new
   primitives: the outline button, the cart stepper, the chips, the product card, the range tile and
   the option pill each need one class changed. The token and its consumers are one change — leaving
   consumers on `ink-700` would mean the contrast fix is not actually delivered, and the later
   styling tasks (T8, T9, T10) then restyle rather than repair. Panel outlines and dividers stay on
   `ink-700`/`ink-800`.
2. `Container` — replaces the container string `mx-auto w-full max-w-6xl px-5 sm:px-8` repeated in
   six files. Narrow/wide variants if a page needs them; do not invent variants nobody uses.
3. `Field` — label + input + optional hint and error, with `useId` for the pairing. Collapses the
   seven near-identical blocks in `checkout-form.tsx`; the checkout form is the proof it fits.
   Every field keeps its `autoComplete` and `required`.
4. `Select` — a native `<select>` in the `Field` look (`rounded-xl`, compliant border), replacing
   the `rounded-full` select in `components/product/product-grid.tsx` and the sort label beside it.
5. `Prose` — the styling the info pages will need, applied as a component so the legal copy in T6
   is plain markup. Hand-written against tokens: no `@tailwindcss/typography`, no new dependency.
   Note in the file why it is unlayered or layered, whichever you choose.
6. `SkipLink` — visually hidden until focused, targeting `#main-content`.
7. `getCatalogue()` gains React `cache()`. It is read by the header and by every page today, and
   T5 adds a third reader; the wrapper is the cheap fix. Do not change its signature or its
   `null`-on-unreachable contract.

**In scope** — `frontend/src/app/globals.css`; `frontend/src/components/ui/**`;
`frontend/src/components/product/product-grid.tsx` (the `Select` swap and nothing else);
`frontend/src/components/checkout/checkout-form.tsx` (the `Field` migration and nothing else);
`frontend/src/lib/wp/catalog.ts`.
**Out of scope** — the header, the footer, the product card, the home page, any route file, the
mobile nav. No behaviour change anywhere: this is a structural task and its evidence is that
nothing looks or behaves differently.

**Acceptance criteria**

1. The new border token measures ≥3:1 against `ink-900` and `ink-950` in the browser.
2. `grep -rn "max-w-6xl px-5" frontend/src` returns no matches outside `Container`.
3. The checkout form still validates and still posts the same payload — compare the `fetch` body
   before and after.
4. `getCatalogue` is wrapped in `cache()` and its `null`-on-unreachable behaviour is unchanged.

**Verify** — `env -C frontend npm run build && env -C frontend npx tsc --noEmit && env -C frontend npm run lint`;
screenshots of `/shop` and `/checkout` at all three widths compared against T1's, showing no visual
change; the computed ratio of the new border token.

**Size** — M

> verified: `--color-line: #5b6478` and `--color-danger: #ff6b6b` added to `@theme`; `Container`,
> `Field`, `TextAreaField`, `Select`, `Prose` and `SkipLink` written under `components/ui/`; the
> token applied to the outline button, the cart stepper, the chips, the product card, the range tile
> and the option pill; `getProducts`, `getCategories` and `getCatalogue` wrapped in React `cache()`.
>
> `npx tsc --noEmit` exit 0, `npm run lint` clean, `npm run build` `✓ Compiled successfully`, and
> every route listed as `ƒ (Dynamic)` — so the build still fetches nothing from WordPress.
>
> Contrast re-measured in the browser after the change: the new border reads **3.37:1 on ink-950**
> and **3.27:1 on ink-900** (predicted 3.38 / 3.28), against 1.25:1 and 1.21:1 before. Every
> sampled control now takes it — cart button 3.37, sort select 3.37, unselected chip 3.37, product
> card 3.27, range tile 3.27, billing input 3.37, note textarea 3.37. All seven now pass 1.4.11.
> The order-summary panel stays on `ink-800` at 1.06:1, which is a decorative panel and not a
> control.
>
> The refactor changed no layout: all fifteen screenshots have document heights identical to T1's
> to the pixel (`/shop` 1440 = 1581, 768 = 2072, 390 = 3732; `/checkout` 390 = 880), with
> `scrollWidth === clientWidth` at all three widths.
>
> The checkout payload is unchanged: the form still exposes exactly seven named controls —
> `firstName`, `lastName`, `email`, `address1`, `city`, `postcode` (input) and `note` (textarea) —
> with the same `type`, `required` and `autocomplete` values as before, each resolving to a label.
> The sort control is `select#sort` with the same three option values, and its accessible name is
> exactly **"Sort"** read from the CDP accessibility tree — a wrapping `<label>` did not fold the
> option text into the name.
>
> Two deliberate departures from the task text, recorded so the next session is not misled:
> `grep -rn "max-w-6xl px-5 sm:px-8" frontend/src` now returns nothing, but only four files ever had
> that exact string — the header and footer use a different wrapper and are rewritten in T3 and T5 
> rather than migrated here. And `Field` has no per-field `hint`/`error` slot: the checkout form
> reports failure once for the whole request because that is the only failure the app produces, so
> the slot would have had no caller.

---

## T3 — Mobile navigation — `[x]` done

**Goal** — Below 768px a visitor can open a menu from the header and reach Shop, all three ranges
and "Shop all" with the keyboard as well as the mouse.

**Depends on** T2. **Parallel with** T4, T6.

**Context to load** — `frontend/src/components/layout/header.tsx` (read the `max-md:hidden`
comment: it exists because `hidden` loses to a later display utility); `frontend/src/app/layout.tsx`
(where the overlays live and why); `frontend/src/components/cart/cart-drawer.tsx` and
`frontend/src/components/cart/cart-button.tsx` (the pattern to copy); `frontend/src/lib/modal-behaviour.ts`;
`frontend/src/lib/wp/catalog.ts`.

**Do**

1. Add `frontend/src/stores/nav.ts` — a tiny zustand store with `isOpen`, `open`, `close`. Not
   persisted, no `skipHydration` needed. Mirrors `stores/cart.ts` so there is one pattern.
2. Add `frontend/src/components/layout/mobile-nav-button.tsx` — the trigger, a client component
   using that store. Give it an accessible name that changes with state, and `aria-expanded` and
   `aria-controls`.
3. Add `frontend/src/components/layout/mobile-nav.tsx` — the panel. Reuse `useModalBehaviour` for
   the focus trap, Escape and scroll lock; **do not write a second trap**. It stays mounted while
   closed so the transition runs both ways, and carries `inert` when hidden, exactly as the drawer
   does.
4. Mount `<MobileNav categories={…} />` in `app/layout.tsx` **outside `<header>`** — that element
   is `backdrop-blur`, and a `backdrop-filter` is the containing block for `position: fixed`
   descendants, so a fixed panel inside it would be positioned against the header box. This is the
   single easiest thing to get wrong in this task.
5. Feed it categories from the layout. `app/layout.tsx` is a server component: read the catalogue
   there and pass `categories` down (the `cache()` added in T2 keeps this from doubling the read).
   When the catalogue is unavailable, pass `[]` and render Shop plus "Shop all" only — the panel
   must never fail a page.
6. The panel lists Shop, the three ranges, and "Shop all"; links close the panel on click. The
   button is visible below `md` and hidden at `md` and up, using a **variant** (`md:hidden`), not an
   unprefixed `hidden`.

**In scope** — `frontend/src/stores/nav.ts` (new), `frontend/src/components/layout/mobile-nav.tsx`
(new), `frontend/src/components/layout/mobile-nav-button.tsx` (new),
`frontend/src/components/layout/header.tsx` (the trigger only),
`frontend/src/app/layout.tsx` (the mount and the catalogue read).
**Out of scope** — the footer (T5), the desktop nav's appearance (T4), any route file, the cart.
Do not change `dynamic = "force-dynamic"`.

**Acceptance criteria**

1. At 390x844 the header shows the menu trigger, and opening it lists Shop, all three ranges and
   "Shop all"; each navigates.
2. `Escape` closes it and focus returns to the trigger; Tab does not leave the panel while it is
   open; the page behind it does not scroll.
3. The nav and the cart drawer are never open at the same time.
4. At 768x1024 and 1440x900 the trigger is gone and the existing desktop nav is unchanged.
5. With WordPress stopped, the panel still opens and shows Shop and "Shop all".

**Verify** — Screenshots at all three widths with the panel open and closed; a keyboard walk
(Tab to the trigger, Enter, Tab through the links, Escape, confirm focus is back on the trigger);
`$WPDEV down` and repeat the 390px check, then `$WPDEV up .`. Report the specific key sequence and
what focus did.

**Size** — M

> verified: `stores/nav.ts`, `layout/mobile-nav.tsx` and `layout/mobile-nav-button.tsx` added; the
> trigger wired into `header.tsx`; the panel mounted in `app/layout.tsx` with the catalogue read
> there and passed down as props. `npx tsc --noEmit` exit 0, `npm run lint` clean.
>
> Geometry read in the browser at 390x844: closed, the panel is `translate: 100%` with its box at
> 390→710 in a 390px viewport — **0 visible pixels** — plus `pointer-events: none` and `inert`;
> open, `translate: 0px` with the box at 70→390, so **320px visible** (`max-w-xs`), `pointer-events:
> auto`, `inert` gone, `aria-expanded="true"`, `document.body.style.overflow` `hidden`. At 768 and
> 1440 the wrapper computes to `display: none`, 0 visible pixels, the trigger `display: none`, the
> desktop nav `flex`, and `scrollWidth === clientWidth`.
>
> Entries at 390: `/shop`, `/shop/disposables`, `/shop/e-liquids`, `/shop/pod-kits`, `/shop`
> ("Shop all"), with `aria-current="page"` on Shop while on `/shop` and on nothing else.
>
> Keyboard: focus lands on the panel's first control ("Close menu") when it opens; eight Tabs walk
> Shop → Disposables → E-Liquids → Pod Kits → Shop all → Close menu → Shop …, every stop reported
> `inside=true`; Escape closes it, restores `body.style.overflow` to `""` and returns focus to the
> **trigger** ("Open menu").
>
> Never both open: with the nav up, opening the cart leaves the nav `inert` with
> `aria-expanded="false"` while the drawer's `inert` is removed.
>
> Widening past `md` while it is open closes it — `body.style.overflow` goes from `hidden` back to
> `""` and `aria-expanded` to `false`, so the `md:hidden` wrapper cannot leave a phantom scroll
> lock behind.
>
> Offline: with WordPress stopped **and the dev data cache removed**, `/shop` serves `OfflineNotice`
> and the panel still opens offering exactly `["/shop", "/shop"]` — Shop and "Shop all", no
> categories, nothing broken. WordPress was brought back up afterwards and the catalogue re-checked
> at `200`.
>
> Four things this task cost, all worth knowing before the next one:
> 1. **Tailwind v4's `translate-x-*` sets the CSS `translate` property, not `transform`.**
>    `getComputedStyle(el).transform` reads `"none"` for a correctly hidden panel, which looks
>    exactly like a panel sitting on screen. Read `translate`.
> 2. **The dev data cache is `frontend/.next/dev/cache`, not `.next/cache`.** `rm -rf .next/cache`
>    removes nothing and the cached catalogue keeps serving with WordPress down, so an offline test
>    silently passes as an online one. `rm -rf .next/dev` is what forces an uncached read — and the
>    server must be stopped first, because deleting it underneath a running dev server makes Next
>    restart itself.
> 3. **A forced click while the age gate is up hits the gate.** The gate is server-rendered HTML, so
>    a click before hydration is silently lost and the gate stays; `{ force: true }` then dispatches
>    at the trigger's coordinates, which the gate covers — one run landed on "No, I am under 21".
>    Click the gate's own button without forcing, then wait for `[data-age-gate-root]` to disappear.
> 4. `cart-button.tsx` was changed, slightly outside this task's stated scope: it closes the nav
>    when the cart opens, which is what makes "never both open" true rather than hopeful.
>
> Known gap until T6 lands: the footer still has no links, so nothing here is reachable from it yet.

---

## T4 — Header polish — `[x]` done

**Goal** — A skip link is the first focusable element, the current range is marked in the nav, and
the header is comfortable at 768px.

**Depends on** T2, T3. **Parallel with** T6.

**Context to load** — `frontend/UI-STANDARDS.md`; `frontend/src/components/layout/header.tsx`;
`frontend/src/app/layout.tsx`; `frontend/src/components/ui/skip-link.tsx` (from T2).

**Do**

1. Render `<SkipLink />` as the first child of `<body>` in `app/layout.tsx`, and give the existing
   `<main>` an `id="main-content"` and `tabIndex={-1}` so the jump moves focus rather than only the
   scroll position.
2. Mark the active range with `aria-current="page"`. The header is a server component and does not
   know the pathname, so put the links in a small client component that reads `usePathname()` —
   keep `Header` itself a server component and keep fetching the catalogue there.
3. Re-check the nav at **768x1024** specifically: at that width the header now holds the wordmark,
   Shop, three ranges, "Shop all" and the cart. If it crowds or wraps, take the smallest fix
   (shorten the wordmark's tracking, drop "Shop all" at `md` and show it from `lg`, or reduce the
   gap) and record the choice in the standards doc.
4. Check the wordmark and the cart button for an adequate hit area and a visible focus ring, and
   confirm the sticky header does not cover an anchored target when the skip link is used.

**In scope** — `frontend/src/app/layout.tsx`; `frontend/src/components/layout/header.tsx`; the new
nav-links client component.
**Out of scope** — the mobile panel (T3), the footer (T5), route content. Do not change the
`max-md:hidden` reasoning in the comment without replacing it with the new rule.

**Acceptance criteria**

1. The first Tab from a fresh load focuses a visible "Skip to content" link, and activating it puts
   focus inside `<main>`.
2. On `/shop/disposables` the Disposables nav link carries `aria-current="page"`; on `/shop` none
   of the range links does.
3. At 768x1024 the header does not wrap or overflow: `document.documentElement.scrollWidth` equals
   `clientWidth`.
4. Every header control has a visible focus ring.

**Verify** — Screenshots at three widths; a keyboard walk from a fresh load; the `scrollWidth`
check at 768 evaluated in the browser. Report the focus sequence.

**Size** — S

> verified: `SkipLink` is the first child of `<body>`; `<main>` carries `id="main-content"` and
> `tabIndex={-1}`; the header's inline nav moved into a new client `NavLinks` that reads
> `usePathname()`, so `Header` stays a server component. `npx tsc --noEmit` exit 0, `npm run lint`
> clean.
>
> Keyboard walk from a fresh load at 1440: `Skip to content` → `VAPESTACK` → `Shop` →
> `Disposables` → `E-Liquids` → `Pod Kits` → `Shop all` → `Cart, empty`. The skip link is the first
> stop, is 135x36 and fully visible when focused (absolute, clip-path `none`, neon background), and
> pressing Enter moves focus to **`main#main-content`** rather than only scrolling. At 390 the order
> is `Skip to content` → `VAPESTACK` → `Open menu` → `Cart, empty` → the chips.
>
> `aria-current="page"` lands on exactly one link per route — `Shop` on `/shop`, `Disposables` on
> `/shop/disposables`, `E-Liquids` on `/shop/e-liquids` — and the active link is the only one in
> `neon-400` (verified as `rgb(182, 255, 61)` against `rgb(201, 207, 219)` for the rest).
>
> Every focus stop reports `2px solid rgb(182, 255, 61)` — the neon token — at both 1440 and 390.
>
> The header does not wrap or overflow: at 768, 1024 and 1440 `scrollWidth === clientWidth`, all four
> nav links share one row (`top` = 20 for each) and the wordmark, nav and cart sit on one row.
>
> Two corrections this task forced, both recorded in `frontend/UI-STANDARDS.md`:
> - **The nav links were 20px tall**, under the 24x24 WCAG 2.5.8 asks of a standalone target. They
>   now carry `py-1` and measure 28px, at no layout cost — the 36px cart button sets the row height.
> - **The first focus measurement was taken mid-transition and was wrong.** Tailwind's `transition`
>   utility includes `outline-color`, so the ring animates in over ~150ms; reading `outlineColor` in
>   the same tick as the `Tab` press returns the element's own text colour and reads exactly like a
>   ring that ignores the token. `CSS.getMatchedStylesForNode` shows the `:focus-visible` rule
>   matching, and the same elements report neon once a 250ms wait is added. The standards doc now
>   says to measure after the transition settles.

---

## T5 — Footer rebuild — `[x]` done

**Goal** — The footer is a real footer: four columns, working navigation, legal links, the 21+
notice, a copyright line and the honest demo disclaimer — and it renders with WordPress stopped.

**Depends on** T2. **Parallel with** T3, T4, T6.

**Context to load** — `frontend/UI-STANDARDS.md`; `frontend/src/components/layout/footer.tsx`;
`frontend/src/components/layout/header.tsx` (the "header is not worth failing a page over"
reasoning, which applies here twice over); `frontend/src/lib/age-gate.ts`;
`frontend/src/app/globals.css` (the unlayered age-gate rule); the T6 route list.

**Do**

1. Rebuild `footer.tsx` as a server component with four content columns and a bottom bar:
   - **Brand** — wordmark, a one-line description in shop voice, and the live demo link.
   - **Shop** — from the catalogue: Shop plus the three ranges, each linked. Fall back to Shop
     alone when the catalogue is unavailable. The footer must never fail a page.
   - **About** — About, Contact (T6).
   - **Help & legal** — Shipping & Returns, Privacy, Terms (T6).
   - **Bottom bar** — `© <year> Vapestack`, a plain statement that this is a demo where nothing is
     sold, and the "reset age verification" control.
2. The 21+ band carries the age notice text and the demo disclaimer.
3. **Reset age verification:** add `forgetAgeGateAnswer()` to `frontend/src/lib/age-gate.ts`, and
   the control that calls it must **also remove `data-age-gate="off"` from `<html>`** — otherwise
   the unlayered rule in `globals.css` keeps the gate hidden even though the answer is gone. Read
   `AGE_GATE_SCRIPT` and the writer in that file before writing this; the store-shaped state in
   `components/age-gate.tsx` may also need to be told. Make it a client component and prove the
   gate actually comes back.
4. Rewrite the copy in shop voice. The current text explains the stack ("Next.js and Tailwind in
   front, WooCommerce and WPGraphQL behind") — that belongs in `/about`, not under every page.
5. Keep `mt-20` or replace it with the section rhythm from the standards doc, and make sure the
   footer's narrowest layout has no horizontal overflow at 390px.

**In scope** — `frontend/src/components/layout/footer.tsx`; a new
`frontend/src/components/layout/age-gate-reset.tsx`; `frontend/src/lib/age-gate.ts`;
`frontend/src/components/age-gate.tsx` only if the reset needs it to react.
**Out of scope** — the info pages themselves (T6); the header; any route. Do not add a newsletter
form, social icons that go nowhere, or payment logos for a shop that takes no payment.

**Acceptance criteria**

1. All footer links resolve to real routes (200, not a 404) once T6 is done. Until then, list them
   and confirm the slugs match T6's list exactly.
2. At 390x844 the footer stacks with no horizontal overflow, and at 1440x900 it is four columns
   plus the bottom bar.
3. With WordPress stopped (`$WPDEV down`), the footer still renders, with the static fallback.
4. "Reset age verification" makes the gate reappear on the next load — prove it in the browser,
   with the answer removed from `localStorage` **and** `data-age-gate` gone from `<html>`.

**Verify** — Screenshots at three widths; `$WPDEV down` and re-shoot the 390px footer, then
`$WPDEV up .`; the reset control exercised in the browser with the `<html>` attribute and the
`localStorage` key both read back and reported.

**Size** — M

> verified: `footer.tsx` rebuilt as four columns (brand + live/source links, Shop, About, Help &
> legal), a 21+ panel, and a bottom bar with the copyright and the reset control; `InfoPage` and the
> five routes added (T6); `forgetAgeGateAnswer()` added to `lib/age-gate.ts`. `tsc --noEmit` exit 0,
> `npm run lint` clean, `npm run build` clean with all nine routes `ƒ (Dynamic)`.
>
> Links, checked with a real request for each: **every internal link answers 200** — `/shop`,
> `/shop/disposables`, `/shop/e-liquids`, `/shop/pod-kits`, `/about`, `/contact`,
> `/shipping-returns`, `/privacy`, `/terms` — and both external links answer 200 too, including the
> repository URL, which was verified rather than assumed.
>
> Layout at three widths, from the DOM: **390** one column (`grid-template-columns` = 1, four
> distinct column tops, footer 1060px tall) with `scrollWidth === clientWidth`; **768** two columns
> (columns pair at tops 1956/1956 and 2136/2136, footer 668px); **1440** four columns on one row (all
> tops 1485, footer 500px). The copyright line, the 21+ notice and the reset control are present at
> all three.
>
> Offline, with WordPress stopped and a cold dev cache: `/shop` serves `OfflineNotice` and the footer
> still renders all four columns, with the **Shop column degrading to exactly `["/shop"]`** — "Shop
> all" and nothing else. The About and Help & legal columns keep every link, because those pages
> need no catalogue. No horizontal overflow (390/390).
>
> The reset control, exercised in the browser: before, `localStorage['vapestack-age-verified']` was
> `"true"`, `<html>` carried `data-age-gate="off"` and no gate was in the DOM; after clicking it,
> the key is `null`, the attribute is `null`, the gate is back in the DOM, visible, 900px tall, and
> the page is asking "Are you 21 or older?". This is the trap the plan predicted: clearing the key
> alone would have left the unlayered CSS rule hiding the gate forever, so the attribute is removed
> as well, and the page reloads rather than threading a second store through the gate.
>
> Deliberately absent: no newsletter form, no social icons that go nowhere, and no payment logos for
> a shop that takes no payment.

---

## T6 — Info and legal pages — `[x]` done

**Goal** — `/about`, `/contact`, `/shipping-returns`, `/privacy` and `/terms` exist as static
server components that render with WordPress stopped, sharing one shell.

**Depends on** T2, T5 (the footer links to them). **Parallel with** T3, T4.

**Context to load** — `frontend/UI-STANDARDS.md`; the `Prose`/`InfoPage` primitive from T2;
`frontend/src/app/layout.tsx` for `dynamic`; `frontend/README.md` for the offline-is-expected rule;
the footer built in T5.

**Do**

1. Build the five routes under `frontend/src/app/`. One shared `InfoPage` shell: container, an
   `h1`, a "last updated" line, `<Prose>` around the body, and a back-to-the-shop link.
2. Copy is demo-honest and short. It is a portfolio demo, not a real shop:
   - **About** — what Vapestack is, the stack in one paragraph (this is where the developer
     explanation from the old footer belongs), and that the catalogue is live from WooCommerce.
   - **Contact** — how to reach the person who built it. **No form**: nothing would receive it.
   - **Shipping & Returns** — plainly that nothing ships and nothing is charged, plus what a real
     policy would have to cover.
   - **Privacy** — no tracking or analytics, the cart is in `localStorage`, the order details typed
     at checkout are stored in WooCommerce, and the age answer is in `localStorage`. Verify each
     claim against the code before writing it.
   - **Terms** — the 21+ restriction, the demo disclaimer, and no warranty.
3. `metadata` per page: title, description, canonical.
4. These routes must not read the catalogue — that is what makes them render with the tunnel shut.
   Confirm they are not accidentally made dynamic-only by a catalogue read.

**In scope** — the five new route files, the shared shell, and any nav/footer link correction.
**Out of scope** — any WordPress-side page. No GraphQL or REST read on these routes. No contact
form, no analytics, no cookie banner.

**Acceptance criteria**

1. All five routes answer 200 and render the footer and header.
2. They still render with WordPress stopped (`$WPDEV down`).
3. Each has its own title and description in the served HTML.
4. No claim in `/privacy` is contradicted by the code — check the storage keys and what the
   checkout route sends.

**Verify** — `curl -s -o /dev/null -w '%{http_code}' http://localhost:$PORT/<route>` for all five;
a screenshot at three widths of one of them; `$WPDEV down` and repeat the 200 check; `grep -i
"<title>"` on the served HTML.

**Size** — M

> verified: `/about`, `/contact`, `/shipping-returns`, `/privacy` and `/terms` all answer 200, each
> with its own title in the served HTML — `About | Vapestack`, `Contact | Vapestack`,
> `Shipping &amp; Returns | Vapestack`, `Privacy | Vapestack`, `Terms | Vapestack`. All five share
> `components/layout/info-page.tsx`, which renders the heading, the intro, the "last updated" line
> and the body inside `Prose`, with a link back to the shop.
>
> With WordPress stopped **and the dev cache cleared**, all five still answer 200 — `/privacy` serves
> its body copy ("There is no analytics…") and the footer with the reset control while `/shop`
> serves the offline notice in the same window. That is the point of putting this copy in the
> storefront rather than in WordPress. WordPress was brought back up afterwards and the catalogue
> re-checked.
>
> Deviations, both deliberate:
> - **No canonical URL yet.** Canonicals need `metadataBase`, and that belongs with the deployment
>   URL discussion in T12 — so these five carry a title and a description now, and T12 adds the
>   canonical rather than inventing an env var here that would have been wrong on Vercel.
> - **No contact form**, as the plan decided: there is no mail server behind this demo, so a form
>   would post into nothing.
>
> Each privacy claim was checked against the code before it was written: the two storage keys are the
> ones in `lib/age-gate.ts` (`vapestack-age-verified`) and `stores/cart.ts` (`vapestack-cart`), the
> order is the only thing the browser sends, and the app loads no third-party script and sets no
> cookie.

---

## T7 — Not-found, error and loading states — `[x]`

**Goal** — An unknown slug, a thrown error and a slow route each show a designed page, and the
unknown slug answers 404.

**Depends on** T2, T5. **Parallel with** T8, T9.

**Context to load** — `frontend/UI-STANDARDS.md`; `frontend/src/app/layout.tsx`;
`frontend/src/components/layout/offline-notice.tsx` (the tone and shape a state page should match);
`frontend/src/app/product/[slug]/page.tsx` and `frontend/src/app/shop/[category]/page.tsx` (they
call `notFound()`); `frontend/src/app/page.tsx` and `frontend/src/app/shop/page.tsx` (the empty
catalogue path).

**Do**

1. `frontend/src/app/not-found.tsx` — designed 404 with the shell, a short explanation and links to
   Shop and home. It must not read the catalogue.
2. `frontend/src/app/error.tsx` — `"use client"`, takes `error` and `reset`, offers "Try again" and
   a shop link, and logs the digest. Do not leak the message to the visitor.
3. ~~`frontend/src/app/loading.tsx` — a skeleton matching the real layout's proportions.~~
   **Do not add this, at the root or above the routes that 404.** Measured on 2026-09-11 by toggling
   only that file: with `app/loading.tsx` present, `/product/does-not-exist` and
   `/shop/does-not-exist` both answer **200** (five out of five); with it removed, both answer
   **404** (five out of five). A `loading.tsx` opens a Suspense boundary around the whole page, so
   Next flushes the shell and commits to a 200 before the page body — where `notFound()` is thrown —
   has run. The visitor still sees the designed 404; a crawler sees a success. The status is
   correctness and the skeleton is decoration, so the status wins. If a loading state is wanted, it
   has to be an explicit `<Suspense>` inside a page around its slow subtree. See the section of the
   same name in `frontend/UI-STANDARDS.md`.
4. Empty state for a range with no products: in `components/product/product-grid.tsx`, when
   `products.length === 0`, show a designed message with a link back to Shop instead of an empty
   grid.
5. Prove the 404 is real: request an unknown product slug and check both the rendered page and the
   **HTTP status**. A `notFound()` under a `force-dynamic` layout should answer 404 — confirm it,
   and if it answers 200, say so rather than hiding it.

**In scope** — `frontend/src/app/not-found.tsx` and `frontend/src/app/error.tsx` (the two new
files; step 3 explains why there is no third), the `ProductGrid` empty state.
**Out of scope** — the offline path (`OfflineNotice` already covers it and is correct), the
checkout, any catalogue query change.

**Acceptance criteria**

1. `/product/does-not-exist` answers **404** and shows the designed page, with the header and footer.
2. `/shop/does-not-exist` does the same.
3. A route that throws shows the error page with a working "Try again".
4. The empty state in `ProductGrid` shows when the catalogue has no products at all — load `/shop`
   with every product unpublished. **A range can never be empty.** `getCatalogue()` derives the
   category list *from the products*, so unpublishing every product in a range removes the range
   itself and `/shop/<range>` answers 404 through `notFound()` before the grid is ever reached —
   measured on 2026-09-11 by drafting products 60 and 67, which turned `/shop/disposables` into a
   404 rather than an empty listing. Put the products back afterwards (`--post_status=publish`), and
   note that the five-minute catalogue cache means the change may not be visible for a while: clear
   `frontend/.next/dev` to force a re-read.
5. `not-found.tsx` renders with WordPress stopped.

**Verify** — `curl -s -o /dev/null -w '%{http_code}' http://localhost:$PORT/product/does-not-exist`;
screenshots of the 404, the error page and the empty state at three widths; for the error page,
temporarily throw from a probe route (**not** a folder starting with `_` — the App Router treats
that as private and never routes it) and remove it afterwards.

**Size** — M

> verified: `frontend/src/app/not-found.tsx` and `frontend/src/app/error.tsx` added, `ProductGrid`
> given the empty state, and no `loading.tsx` anywhere (step 3).
>
> Statuses, `curl -s -o /dev/null -w '%{http_code}'`: `/product/does-not-exist` **404**,
> `/shop/does-not-exist` **404**, `/totally-unknown-route` **404** — each showing the designed page
> inside the real shell (`Skip to content`, header, footer, `21+ only` all present in the response).
> The step 3 experiment was re-run five times per configuration: **5/5 `200/200`** with
> `app/loading.tsx` present, **5/5 `404/404`** with it removed, so it is the file and not timing.
> Two dead ends worth not repeating: `app/shop/loading.tsx` alone still costs `/shop/<unknown>` its
> 404 (the `[category]` child inherits the parent boundary) while `/product/<unknown>` keeps its
> own, and raising `notFound()` from `generateMetadata` does not rescue the status either.
>
> The error page was proved with a throwaway `app/error-probe/page.tsx` that threw until the test
> set a `t7-probe` cookie: **500**, `h1` "This page could not be rendered" at 1440/768/390, and
> pressing "Try again" recovered the page to "Probe recovered" at the same URL with no reload.
> **A `reset`-only button did nothing**: the click issued *no request at all* — `page.on("request")`
> recorded zero, because `reset()` re-renders the payload the browser already holds, so a
> server-rendered fault comes straight back. `error.tsx` therefore calls `router.refresh()` as well,
> and the request that follows is what makes the button real. The probe folder was deleted
> afterwards (`/error-probe` answers 404 again).
>
> The empty state was proved the way AC4 asks rather than by faking it: all six products drafted
> with `wp post update 85 81 79 72 67 60 --post_status=draft`, `frontend/.next/dev` cleared, and
> `/shop` answered 200 with `h1` Shop, `h2` "No products to show here yet", **0 product links and 0
> sort controls** — a control over nothing is noise. Screenshots at 1440x900 / 768x1024 / 390x844,
> dimensions confirmed with `file`, `scrollWidth === clientWidth` at all three. Products republished
> afterwards and the shop re-checked (6 products, `/shop/e-liquids` 200). A range can never be the
> empty case, exactly as AC4 now says: the catalogue derives its categories from the products, so an
> emptied range 404s before the grid renders.
>
> `not-found.tsx` renders with WordPress stopped: `wpdev down`, then all three unknown routes still
> **404** with the designed page.
>
> `npx tsc --noEmit` exit 0, `npm run lint` clean, `npm run build` green with every route
> `ƒ (Dynamic)`.

---

## T8 — Shop listing: URL sort, empty state and a11y — `[x]`

**Goal** — A sorted shop is a shareable URL, the result count is announced, and the chips state
which range is current.

**Depends on** T2, T7. **Parallel with** T9, T10.

**Context to load** — `frontend/UI-STANDARDS.md`; `frontend/src/app/shop/page.tsx`;
`frontend/src/app/shop/[category]/page.tsx`; `frontend/src/components/product/product-grid.tsx`;
`frontend/src/components/product/category-chips.tsx`; the `Select` primitive from T2.

**Do**

1. Move the sort into the URL: `/shop?sort=price-asc`. Read `searchParams` in the page (both shop
   and category), sort on the server, and make the control a link or a small client component that
   pushes the parameter. Because of this, `ProductGrid` no longer needs to be a client component —
   check whether it still does, and drop `"use client"` if not.
2. Keep the three existing orderings and no more. Validate an unknown `sort` value and fall back to
   name, rather than rendering an unsorted grid.
3. With JavaScript off, the URLs still work — the sort is a link, not a hydration-only control.
   Confirm by reading the served HTML.
4. Announce the result count with `aria-live="polite"`, and mark the current range with
   `aria-current="page"` in `CategoryChips` (the "All" chip on `/shop`).
5. Replace the `rounded-full` select with the `Select` primitive and give it an accessible label
   that is still visible as "Sort".

**In scope** — the two listing pages, `product-grid.tsx`, `category-chips.tsx`.
**Out of scope** — a price filter, a view toggle, pagination, or any new query. Six products do not
need them, and the plan excludes them.

**Acceptance criteria**

1. `/shop?sort=price-asc` and `/shop?sort=price-desc` serve the products in that order in the raw
   HTML, with no JavaScript.
2. `/shop?sort=nonsense` renders the name order rather than a broken grid.
3. The category page keeps the sort when switching ranges, or drops it cleanly — decide, and state
   which.
4. The current chip carries `aria-current="page"`.
5. `product-grid.tsx` is a server component if nothing needs it to be a client one.

**Verify** — `curl -s "http://localhost:$PORT/shop?sort=price-asc" | grep -o 'product/[a-z-]*' | head`
showing the order; the same with JavaScript disabled in the browser; screenshots at three widths.

**Size** — M

> verified: `frontend/src/lib/product-sort.ts` added (`Sort`, `SORT_OPTIONS`, `parseSort`,
> `sortProducts`); both listing pages await `searchParams` and order the grid on the server;
> `ProductGrid` is now a **server component** — `grep -c '"use client"' product-grid.tsx` is `0` —
> and renders the new `SortControl`; `CategoryChips` carries the sorting and marks the current
> range.
>
> Order read out of the DOM at 1440x900: name → `aero-pod-kit, coastal-tobacco-e-liquid,
> frost-rush-3000, midnight-berry-e-liquid, neon-rush-6000, pulse-pod-kit`; `?sort=price-asc` →
> `$9.99, $12.99, $12.99, $13.99, $24.99, $34.99`; `?sort=price-desc` → exactly those reversed;
> `?sort=nonsense` → the name order again, as AC2 asks.
>
> AC3 decided, and stated: **the sort is kept when switching ranges.** Every chip href carries it
> (`/shop?sort=price-asc`, `/shop/disposables?sort=price-asc`, …) and the default is left out of the
> URL, so an unsorted shop keeps the plain `/shop` address.
>
> AC4: on `/shop/e-liquids?sort=price-asc`, `E-Liquids` is the only chip with
> `aria-current="page"`; the other three report `null`. The count sits in
> `aria-live="polite" aria-atomic="true"` and reads "6 products".
>
> Sorting is a URL change, not a reload: choosing *Price: high to low* set `?sort=price-desc`, a
> marker left on `window` survived (so no document reload) and the grid re-ordered. Back then
> returned to `/shop` with the select reading `name` and the name order restored — the control is
> driven by the URL, so it cannot disagree with the grid beside it.
>
> JavaScript off, `javaScriptEnabled: false`, which is the AC3 claim tested rather than asserted:
> the served form is `<form action="/shop" method="get">` containing `select[name=sort]` and the
> **Apply** button; selecting *Price: low to high* and pressing Enter on the focused button
> navigated to `/shop?sort=price-asc` and the served HTML came back in rising price order. Note that
> the age gate covers the button from the pointer while it is up — the element at its centre is the
> gate — so the keyboard path is the one that proves this.
>
> Screenshots at 1440x900 / 768x1024 / 390x844 with `file` confirming the dimensions; no horizontal
> overflow at any width (1440/1440, 768/768, 390/390) on `/shop`, `/shop?sort=price-desc` and
> `/shop/e-liquids?sort=price-asc`. At 390 the control wraps onto its own row (275x36 at y=393)
> rather than squeezing the count.
>
> `npx tsc --noEmit` exit 0, `npm run lint` clean, `npm run build` green, and the two 404s still
> answer **404** after the build.

---

## T9 — Product card polish — `[x]` done

> verified 2026-09-11. `/tmp/ui/t9/verify.cjs` (Playwright + bundled Chromium, real viewports).
> **Keyboard walk** at 1440: the 12th-15th tab stops are the four cards in view, each reported
> `isCard: true, inCard: true` with `outline: solid 2px rgb(182, 255, 61)` — one stop per card,
> one ring, and four consecutive stops means no card contains a second focusable element.
> **Range**: `Frost Rush 3000 $9.99–$10.99` in the card's own text; `Price` now renders both ends
> for any product whose `min !== max` (it is only ever called with `min === max` everywhere else).
> **Sold out** (product 85 forced out of stock, then restored to qty 6): the badge's own computed
> fill is `ink-950/90` (`oklab(0.135 …)`) — 18.55:1 for `ink-50` over that fill composited on the
> image well, and 15.21:1 in the worst case of a pure-white image showing through the 10%. The
> card stayed a link. **Overflow** 0 at 1440/768/390 (`scrollWidth === clientWidth`), no card text
> clipped. Shots of the normal catalogue: `/tmp/ui/t15/final-shop-{1440,768,390}.png` (taken on a
> later, healthy catalogue — the three `t9/shop-*.png` files are identical to each other because
> the sold-out capture was still in the five-minute data cache, so they are the *sold-out* state,
> not the normal one). Sold-out shots: `/tmp/ui/t9/soldout-shop-{1440,768,390}.png`, `file` says
> `1440x900`, `768x1024`, `390x844`.
>
> TRAP worth keeping: the app's own five-minute catalogue cache (`REVALIDATE_SECONDS`) made two
> runs 30s apart render the same data, so the "before" and "after" screenshots came out
> byte-identical and the first sold-out probe found no badge at all. Delete `.next` and restart
> `next dev` to force the catalogue to be re-read; nothing else does it.
>
---

**Goal** — A card is one clear focus target with a visible ring, a sold-out state that stays
readable, and a price that reads as a range.

**Depends on** T2. **Parallel with** T8, T10.

**Context to load** — `frontend/UI-STANDARDS.md`; `frontend/src/components/product/product-card.tsx`;
`frontend/src/components/ui/{badge,price}.tsx`; `frontend/src/app/page.tsx` and
`frontend/src/components/product/product-grid.tsx` for the `eager` usage.

**Do**

1. Ensure the whole card is a single focus target with one visible focus ring and no second
   focusable element inside it.
2. Sold-out treatment: the badge must stay legible over the image, and the card must still be
   reachable and clickable (the product page explains itself) — do not remove the link.
3. Make the range explicit: "from $9.99" should read as a range, not as a tiny word glued to a
   price. Use the standards doc's type scale.
4. Hover and focus must not be the same visual state; both must be visible against `ink-900`.
5. Confirm the `alt=""` decision against the standards doc's justification. If the heading inside
   the link already names the product, keep `alt=""` and say so; do not add redundant alt text.

**In scope** — `frontend/src/components/product/product-card.tsx`, `components/ui/price.tsx` if the
range needs it.
**Out of scope** — quick-add, wishlist, ratings, hover-only actions, a second link on the card.

**Acceptance criteria**

1. Tabbing through the shop lands on each card exactly once, with a visible ring.
2. The sold-out badge is legible over the image and the card still links.
3. At 390x844 no card text is clipped and the grid has no horizontal overflow.

**Verify** — Screenshots at three widths of `/shop` and `/`; a keyboard walk reporting the number
of tab stops per card.

**Size** — S

---

## T10 — Product page depth — `[x]` done

> verified 2026-09-11. `/tmp/ui/t10/verify.cjs`.
> **Breadcrumbs** — `/product/neon-rush-6000` renders `Home / Shop / Disposables / Neon Rush 6000`
> as `nav[aria-label="Breadcrumb"] > ol > li` ×4, the last one `aria-current="page"` and not a
> link; `/product/midnight-berry-e-liquid` renders `Home / Shop / E-Liquids / Midnight Berry
> E-Liquid`. Both `script[type="application/ld+json"]` blocks **`JSON.parse` cleanly** and carry
> the right `@type` (`BreadcrumbList`, positions 1-4, absolute item URLs; `Product` with name,
> description, url, `sku: "VS-DSP-6000"`, `image`, `offers { price 12.99, priceCurrency USD,
> availability https://schema.org/InStock }`) — no `brand`, no `aggregateRating`.
> **Quantity** — start 1, `+` `+` → 3, Add → `localStorage['vapestack-cart']` holds **one** line
> `key 60:61 quantity 3` (options `Blue Razz Ice · 3mg`); the counter is back at **1** after the
> add; `+` `+` Add → the same line at **6**. 120 clicks on `+` settle at **99** with the button
> `disabled`, and `-` gives 98 — `MAX_QUANTITY` respected. Selecting `Mango Sunset` + `6mg`
> (variation 66, the seeded sold-out one) leaves Add `disabled` with the notice
> `Mango Sunset · 6mg is sold out — 3mg is available.`
> **Details/shipping** — `Details` renders the WordPress short description
> (`6000 puffs, mesh coil, USB-C rechargeable.`), the row is conditional so a product without one
> shows no empty block, and `Shipping and payment` states nothing ships and nothing is charged.
> **Related** — `More from Disposables` lists exactly `Frost Rush 3000` (the range's only other
> product) and never the product being viewed; the section is absent when there are none.
> **Overflow** 0 at 1440/768/390. Shots `/tmp/ui/t10/pdp-{1440,768,390}.png` (1440x900, 768x1024,
> 390x844) plus full-page captures.
>
> TRAP found and fixed while doing this: **WPGraphQL answers a GraphQL *syntax error* with HTTP
> 500.** A JavaScript block comment inside the catalogue document therefore looked exactly like
> "WordPress is away" — every page served the offline notice while `curl` answered the same query
> with a 200. Only GraphQL hash comments belong inside a document; `queries.ts` now says so.
> TRAP: a backtick in a comment inside a template literal ends the literal. Both cost real time.
>
---

**Goal** — The product page gains breadcrumbs with JSON-LD, a quantity selector, spec and shipping
details, related products, and valid `Product` JSON-LD.

**Depends on** T2, T9. **Parallel with** T8.

**Context to load** — `frontend/UI-STANDARDS.md`; `frontend/src/app/product/[slug]/page.tsx`;
`frontend/src/components/product/product-detail.tsx`; `frontend/src/stores/cart.ts` (read it —
`add(item, quantity)` and `clampQuantity` already exist, so **the store is not changed**);
`frontend/src/lib/wp/types.ts` (`Product.shortDescription` is mapped but never rendered);
`frontend/src/lib/wp/catalog.ts` (`getCatalogue()` for related products).

**Do**

1. Breadcrumbs: Home / Shop / Range / Product, rendered as a `<nav aria-label="Breadcrumb">` with an
   ordered list, plus `BreadcrumbList` JSON-LD.
2. Quantity selector next to Add to cart: a native number input or the same stepper pattern the cart
   line uses, bounded by `clampQuantity` and `MAX_QUANTITY`, and clamped rather than rejected. Pass
   the quantity to `add(item, quantity)`. Reset the quantity after adding, and do not add when the
   chosen combination is sold out.
3. Spec and shipping block, from `shortDescription` (which is currently unused) plus the honest
   shipping statement — nothing ships, nothing is charged. Keep it to what the catalogue and the
   demo can actually support; do not invent ingredients, capacity or warranty copy that the data
   does not hold.
4. Related products: the other products in the same range, from the same `getCatalogue()` read the
   page already makes. Hide the section when there are none.
5. `Product` JSON-LD — name, image, description, sku, offers with price and availability, and
   `priceCurrency: "USD"`. Do not emit a `brand` or `aggregateRating` that does not exist.
   Validate the JSON by parsing it, not by eyeballing it.
6. Keep the page's existing 404 and offline behaviour untouched.

**In scope** — `product/[slug]/page.tsx`, `product-detail.tsx`, and new components under
`components/product/`.
**Out of scope** — the cart store, the checkout, the API routes, image galleries, reviews,
    sticky add-to-cart bars (excluded by the plan).

**Acceptance criteria**

1. The breadcrumb trail is correct on a product in each range and the product page emits parseable
   `Product` and `BreadcrumbList` JSON-LD.
2. Adding 3 units creates one cart line with quantity 3; adding again makes 6; `MAX_QUANTITY` is
   respected.
3. The quantity resets after a successful add, and Add is disabled when the combination is sold out.
4. `shortDescription` renders when the product has one, and the block is absent rather than empty
   when it does not.
5. Related products list the other products in the same range and exclude the one being viewed.

**Verify** — Screenshots at three widths of two product pages; a JSON.parse of both emitted
`<script type="application/ld+json">` blocks; the cart exercised in the browser with the resulting
line quantity and `localStorage` read back.

**Size** — L (split before starting if the JSON-LD and the depth work want to be separate)

---

## T11 — Home page sections and copy — `[x]` done

> verified 2026-09-11. `/tmp/ui/t11/verify.cjs`.
> **Heading outline** read from the DOM: `H1 60px "Pick a range, pick a flavour, pick a
> strength."` → `H2 24px "Shop by range"` → `H2 24px "One from each range"` → `H3 16px` ×3
> (the product cards) → `H2 24px "What this shop is"`. No skipped level, one `h1`, and both
> section headings at the same 24px section scale ("Ranges" used to be an `h2` at the eyebrow
> size). **Section rhythm**: `getComputedStyle(section).marginTop` is `64px` for **all four**
> sections — the hero included, so the duplicate value is 1 and not 0. **Hero copy** names no
> technology (`/WordPress|Next\.js|GraphQL|headless/i` on the hero's text → false); the eyebrow is
> the three range names. **Trust band** has three claims: a portfolio demo, 21 and over, nothing
> charged and nothing shipped. **No overflow** at 1440/768/390; shots
> `/tmp/ui/t11/home-{1440,768,390}.png` (1440x900 / 768x1024 / 390x844) plus full-page captures.
> **Offline** — proved with a cold cache instead of a warm one: `$WPDEV down`, `rm -rf .next`,
> `next dev`, then `/` serves the offline notice at 200 while `/about`, `/checkout` and the footer
> still render. See T12 for the same window.

---

**Goal** — The home page reads like a shop, has a consistent section rhythm and heading hierarchy,
and carries one honest trust band.

**Depends on** T2. **Parallel with** T12, T13.

**Context to load** — `frontend/UI-STANDARDS.md` (the type and spacing rhythm); `frontend/src/app/page.tsx`;
`frontend/src/components/product/product-card.tsx`; `frontend/src/components/ui/container.tsx`.

**Do**

1. Rewrite the hero copy in shop voice. Today it explains the stack — that belongs in `/about`. Keep
   the age/compliance honesty, just not as the headline.
2. Fix the heading hierarchy: the "Ranges" heading is `h2` styled like a label while "One from each
   range" is `h2` at `text-2xl`. One scale, applied consistently, with no skipped levels.
3. Apply one section rhythm to every section (the standards doc names the value) so `mt-16` stops
   being a habit.
4. Add one trust/compliance band: the 21+ notice, the demo disclaimer, and what the shop actually is
   — no invented trust badges, no review counts, no payment logos.
5. Keep the featured logic (one product per range) and keep it reading from the existing
   `getCatalogue()` call. Keep the offline path unchanged.

**In scope** — `frontend/src/app/page.tsx` and any new home-only component.
**Out of scope** — new catalogue queries, testimonials, review scores, statistics, or a second data
read.

**Acceptance criteria**

1. Heading levels run h1 then h2 consistently, with no skipped level.
2. Every section uses the same vertical rhythm value.
3. The page renders with WordPress stopped, exactly as before.
4. No claim on the page is untrue of a shop that takes no payment and ships nothing.

**Verify** — Screenshots at three widths of `/`; the heading outline read from the DOM
(`document.querySelectorAll("h1,h2,h3")` with their levels); `$WPDEV down` and re-shoot once.

**Size** — M

---

## T12 — Metadata, OG image, sitemap and robots — `[x]` done

> verified 2026-09-11.
> **`curl -s localhost:3000/robots.txt`** → `User-Agent: * / Disallow: /` plus
> `Sitemap: http://localhost:3000/sitemap.xml`, status 200. **`.../sitemap.xml`** → a real
> `<urlset>` with the 7 static routes **and** the 3 category routes and 6 product routes read at
> request time, status 200. **`/` HTML**: `<link rel="canonical" href="http://localhost:3000">`,
> `og:image` = `/opengraph-image?a14572ff68ba0ef9` (type `image/png`, 1200x630, with `og:image:alt`),
> `twitter:card` = `summary_large_image`, `theme-color` = `#07080c`, and the icon entry.
> `/opengraph-image` itself fetched and `file`d: **PNG 1200x630**. Titles follow the template
> (`Vapestack`, `Shop | Vapestack`).
>
> **`npm run build` with `$WPDEV down`** → `✓ Compiled successfully in 3.9s`, TypeScript clean,
> `✓ Generating static pages (4/4)`, exit 0. Route table: **`/sitemap.xml` is `ƒ (Dynamic)`** — so
> `export const dynamic = "force-dynamic"` *is* honoured for a sitemap and the catalogue half of it
> is real, not the static-only fallback the task allowed for. `/opengraph-image` and `/robots.txt`
> are `○ (Static)`, which is correct: neither reads WordPress. `npx tsc --noEmit` exit 0,
> `npm run lint` exit 0 (both also run with WordPress up).
> **SVGs**: `grep -rn "file.svg\|globe.svg\|next.svg\|vercel.svg\|window.svg" src/` → no matches;
> the five files are deleted and `public/` now holds only `products/`, with the build still green.
>
> Deviation, deliberate: canonical URLs are declared **per route** (`/` in `app/page.tsx`,
> `/product/<slug>` in the product page's `generateMetadata`) rather than once in `app/layout.tsx`.
> A layout-level canonical is inherited by every page and would claim the whole site lives at `/`,
> which is worse than emitting none, so the layout sets `metadataBase` and leaves `alternates`
> alone. The other content pages still carry no canonical; adding one is a one-line change per page
> whenever it is wanted.

---

**Goal** — Share links have an image, titles and canonicals are correct, and `/sitemap.xml` and
`/robots.txt` answer with real content — without the build ever touching WordPress.

**Depends on** T2. **Parallel with** T11, T13.

**Context to load** — `frontend/UI-STANDARDS.md`; `frontend/src/app/layout.tsx` (the `dynamic` rule
and the existing `metadata`); `frontend/README.md` (the build-must-not-fetch-WordPress decision);
`frontend/src/lib/wp/catalog.ts`; `frontend/next.config.ts`.

**Do**

1. `metadataBase` from an env var (a sensible localhost default), a title template, a description,
   OpenGraph and Twitter defaults, and canonical URLs.
2. `frontend/src/app/opengraph-image.tsx` using `ImageResponse` from `next/og` (built in — no new
   dependency). Site-wide and self-contained: tokens, wordmark, one line of copy. **No per-product
   images** — generating them would need the catalogue at build time.
3. `robots.ts` — disallow indexing, publish the sitemap URL. The plan's adopted default: a portfolio
   demo behind a development-machine tunnel should not be surfaced by search.
4. `sitemap.ts` — the static routes always; the catalogue routes as well, read at request time. The
   build must not fetch WordPress, so if `export const dynamic = "force-dynamic"` is not honoured
   for a sitemap the fallback is static entries only — try it, and record which happened rather than
   guessing.
5. `themeColor` and the icon entry. **Do not** delete `app/favicon.ico`.
6. Delete the five unused create-next-app SVGs in `frontend/public/` (`file.svg`, `globe.svg`,
   `next.svg`, `vercel.svg`, `window.svg`) — confirm with `grep -rn` in `frontend/src` that nothing
   references them first. Leave `public/products/` alone.

**In scope** — `app/layout.tsx` metadata, the three new route files, `app/favicon.ico` untouched,
`frontend/public/` cleanup.
**Out of scope** — per-product OG images, a blog feed, structured data beyond what T10 adds, and any
change to `next.config.ts` image patterns.

**Acceptance criteria**

1. `curl -s http://localhost:$PORT/robots.txt` and `.../sitemap.xml` return real content, and the
   sitemap lists the static routes plus the catalogue routes.
2. The served HTML of `/` has a canonical, an `og:image` and a `twitter:card`.
3. `npm run build` succeeds with WordPress stopped — run it that way explicitly.
4. No file in `frontend/src` references the deleted SVGs, and the build is still clean after
   deleting them.

**Verify** — the two `curl` commands with their output; the build run with `$WPDEV down` and the
observed result; `grep` for `og:image` in the served HTML; `grep -rn "next.svg\|vercel.svg" frontend/src`.

**Size** — M

---

## T13 — Motion and reduced motion — `[x]` done

> verified 2026-09-11. `/tmp/ui/t13/{verify,card-hover}.cjs`, two contexts per run (one with
> `reducedMotion: "reduce"`).
> **Cart drawer**: normal `transition-property: transform, translate, scale, rotate`, `0.3s`,
> `cubic-bezier(0, 0, 0.2, 1)` (ease-out), `translate` `100%` closed → `0px` open. Reduced motion:
> `transition-property: none`, `translate` still `100%` → `0px` — the state changes, nothing moves.
> The backdrop keeps `motion-reduce:transition-none` on its opacity transition. **Mobile nav**:
> identical numbers, before and after. **Card image**: measured with a **real pointer move** —
> the first attempt dispatched `mouseover` events and got `scale: none` in *both* modes, which
> proved nothing, because Tailwind's `group-hover:` is a CSS `:hover` rule; with `page.mouse.move`
> the image reports `scale: 1.05` at `0.5s` when motion is allowed and `scale: none` at `0s` when it
> is reduced, with `el.matches(":hover")` true in both. **`grep -rn "animate-\|duration-" src/`**
> finds no `animate-` at all and only these three moving things; every other hit is a bare
> `transition` on colour, border or opacity.
> **No skeleton**: T7 removed `app/loading.tsx` on purpose, so there is no pulse to suppress — and
> `UI-STANDARDS.md` now records what a future `<Suspense>` fallback would have to carry.
> **Nothing depends on a transition finishing**: both overlays stay mounted, and `inert` +
> `pointer-events-none` are applied in the same commit as the `translate` change, so a suppressed
> animation cannot leave a panel unreachable or a "closed" panel clickable.
>
> `frontend/UI-STANDARDS.md` gained a **Motion and reduced motion** table: every moving element with
> its duration, easing and guard, the shape of the card's `motion-safe:` + `motion-reduce:duration-0`
> pair, and the note that the skeleton is gone rather than merely unanimated.

---

**Goal** — Every animation in the app respects `prefers-reduced-motion`, and durations and easings
are named in the standards doc.

**Depends on** T2. **Parallel with** T11, T12.

**Context to load** — `frontend/UI-STANDARDS.md` (the reduced-motion rule written in T1);
`frontend/src/components/cart/cart-drawer.tsx`; `frontend/src/components/layout/mobile-nav.tsx`;
`frontend/src/components/product/product-card.tsx`; `frontend/src/app/loading.tsx`.

**Do**

1. Add `motion-reduce:` variants to: the cart drawer's slide, the mobile nav's transition, the
   product card's `group-hover:scale-105` image zoom, the skeleton animation, and any transition
   added in T5, T6, T8 or T11. Reduced motion means the state still changes — it just does not
   animate.
2. Check that nothing relies on a transition completing to become usable (a panel that only mounts
   after a transition, say).
3. Record the durations, easings and the reduced-motion rule in `frontend/UI-STANDARDS.md` if T1
   did not already fix them; if T1 did, correct the doc to match what shipped.

**In scope** — the components named above and anything else with a `transition`, `duration-` or
`animate-` utility, plus the standards doc's motion section.
**Out of scope** — adding animations that are not there, an animation library, scroll effects, or a
parallax hero.

**Acceptance criteria**

1. `grep -rn "animate-\|duration-" frontend/src` shows a `motion-reduce:` neighbour for every
   animation that is not a pure colour transition.
2. With reduced motion forced on, the drawer and the nav appear and disappear without sliding, and
   the card image does not zoom on hover.
3. Nothing becomes unreachable or unstyled when the animation is suppressed.

**Verify** — Screenshots with the browser's reduced-motion emulation on and off for the drawer and
the nav; the `grep` output; a statement of what changed visually in each mode.

**Size** — S

---

## T14 — Documentation updates — `[x]` done

> verified 2026-09-11.
> **The pointer survives the generator.** `frontend/AGENTS.md` gained a `## Read
> \`UI-STANDARDS.md\` before changing anything visual` section **below** the
> `<!-- END:nextjs-agent-rules -->` marker; `md5sum` was taken before stopping `next dev`, the
> server was restarted, and the file is byte-identical afterwards, so `next dev` re-adds its block
> without rewriting the rest. `grep -n "UI-STANDARDS" frontend/AGENTS.md frontend/CLAUDE.md
> frontend/README.md` reports the new section in `AGENTS.md` and the table row in `README.md`;
> `frontend/CLAUDE.md` is a single line, `@AGENTS.md`, so the import is the one hop.
> **`frontend/README.md`** — the routes row now names `/checkout/success/[id]`, the five info pages,
> the four metadata routes and the designed 404/error; `src/components/product/`, `src/lib/site.ts`
> and `UI-STANDARDS.md` are in the table; a **Frontend commands** table carries `dev` / `build` /
> `start` / `lint` / `tsc --noEmit` and the `rm -rf .next` note. The three existing "worth knowing"
> rules are untouched and a **fourth** was added — there is no root `loading.tsx` and adding one
> costs every `notFound()` route its 404 (5/5 measured each way) — because that fact is new since
> those three were written and is exactly the kind of thing a later agent repeats.
> **Root `README.md`** — a **The storefront's routes** table (nine rows) and a pointer to
> `frontend/UI-STANDARDS.md`, added under the existing backend/storefront bullets.
> **`docs/PROMPTS.md`** — a "The storefront — three reusable UI prompts" section: audit one page at
> three widths, restyle a section against the standards, add a route with a designed state.
> **`.claude/plan.md`** — one closing block saying the UI/UX work continues in
> `docs/ui-ux-plan.md` with its tasks in `docs/ui-ux-tasks.md`, and that `.claude/tasks.md` stays as
> it is. `.claude/tasks.md` was not opened.
>
> **Deviation, and the reason:** the frontend command table went into `frontend/README.md` rather
> than into the root `CLAUDE.md`. `CLAUDE.md` is **generated** — `wpdev sync` (and `wpdev new`)
> writes it from `wp-kit/template/CLAUDE.md`, which `grep -n CLAUDE wp-kit/bin/wpdev` confirms at
> line 331 and again in sync's "regenerated .vscode/mcp.json, .mcp.json and CLAUDE.md for port
> $port". A row added there would survive until the next `wpdev sync` and then vanish, and editing
> the kit to keep it is out of bounds. `frontend/README.md` already had the Scripts table and is
> where a frontend agent starts, so the commands live there. The root `CLAUDE.md` is left exactly
> as `wpdev` wrote it.

---


**Goal** — The repository's own entry points describe the site that now exists, and the UI standards
are reachable from the file an agent reads first inside `frontend/`.

**Depends on** T2–T13.

**Context to load** — `frontend/UI-STANDARDS.md`; `frontend/README.md`; `frontend/AGENTS.md`;
`frontend/CLAUDE.md`; the root `README.md`; `CLAUDE.md`; `docs/PROMPTS.md`.

**Do**

1. `frontend/AGENTS.md` — add a pointer to `UI-STANDARDS.md` **below** the generated
   `nextjs-agent-rules` block. That block is written and re-added by `next dev`, so **verify the
   addition survives a dev-server restart**; if the generator rewrites the whole file, put the
   pointer in `frontend/CLAUDE.md` instead and say so.
2. `frontend/README.md` — the new routes, the new components, the info pages, and the standards doc
   in its "where things live" table. Keep its three "worth knowing" rules intact and add the fourth
   only if something genuinely new became true.
3. Root `README.md` — the storefront description and the route list.
4. `CLAUDE.md` — the task table if it needs a new row for the frontend commands; do not restate the
   WordPress rules.
5. `docs/PROMPTS.md` — add the reusable UI prompts: audit a page at three widths, restyle a section
   against the standards, and add a route with a designed state.
6. Add the one-line pointer in `.claude/plan.md` saying the UI/UX work continues in
   `docs/ui-ux-plan.md`. **Do not touch `.claude/tasks.md`.**

**In scope** — the six markdown files above.
**Out of scope** — rewriting `docs/Start.md`, `docs/SETUP.md`, `docs/headless-contract.md`, or any
file under `wp-kit/`.

**Acceptance criteria**

1. An agent opening `frontend/` finds the UI standards in one hop from the file it reads first.
2. That pointer is still there after restarting `next dev`.
3. Nothing documented is untrue of the code as it now stands — spot-check each claim you add.

**Verify** — `env -C frontend npm run dev`, confirm the pointer survived, stop the server;
`grep -n "UI-STANDARDS" frontend/AGENTS.md frontend/CLAUDE.md frontend/README.md`.

**Size** — S

---

## T15 — End-to-end verification sweep — `[x]` done

> verified 2026-09-11. WordPress on 8889, the storefront on **3000** (`next dev`) and, for the
> keyboard pass, on **3001** (`next start` over the production build — the dev server injects a
> focusable Next.js dev-tools portal, which took the first Tab and made a correct skip link look
> broken). Scripts: `/tmp/ui/t15/{sweep,states,skip-link,skip-activate,prod-states,contrast,empty,offline,footer-slow,slow-nav}.cjs`.
>
> **Routes.** 63 route × width pairs (**21 routes** at 1440x900 / 768x1024 / 390x844), then the
> same 63 again on the final code. Every screenshot's real dimensions confirmed with `file`
> (21 files of each of the three sizes). **Overflow 0 everywhere**, at every width, including the
> 404s. **Exactly one `h1` on every page.** The only non-200 statuses are the three designed 404s
> (`/totally-unknown-route`, `/product/does-not-exist`, `/shop/does-not-exist`), each answering
> **404**, not a 200 with a 404 page.
>
> **States.** Age gate: present at all three widths with its heading and both buttons, no
> overflow. Cart drawer: empty ("Nothing in the cart yet. Browse the shop", no checkout link) and
> full (two lines, subtotal `$38.97`, checkout link present) at all three widths. Mobile nav:
> trigger hidden at 1440/768 and visible at 390, opening onto `/shop` plus the three ranges plus
> "Shop all". Error page: `/error-probe` answers **500** with "This page could not be rendered" and
> two ways out at all three widths, and its own **Try again** recovers the route (probe → 500,
> set the probe cookie, click → "Probe recovered"). The probe was deleted afterwards and the final
> route table no longer lists it. Empty catalogue: with all six products drafted and a cold cache,
> `/shop` shows the designed empty block, the ranges and the product 404 — see the false item
> below. Offline: with `$WPDEV down` and a cold cache, `/`, `/shop`, `/shop/e-liquids`,
> `/product/neon-rush-6000`, `/checkout` and `/about` all answer **200**, `overflow 0`, every
> image still decodes, the footer drops to its single degraded Shop link, and the three info pages
> keep their own content.
>
> **Keyboard pass** (production build, 390 and 1440): with the gate answered the first Tab is
> `A "Skip to content" → #main-content` with `outline: solid 2px rgb(182, 255, 61)`, then the
> wordmark, then Shop; activating it moves focus to `MAIN#main-content (tabIndex -1)` and the next
> Tab continues *inside* `main` ("All"). 14 controls focused in turn: **zero without a ring**, all
> `solid 2px rgb(182, 255, 61)`. The nav opens with Enter, closes with Escape and returns focus to
> the element with `aria-controls="mobile-nav"`; the drawer does the same and returns focus to
> `Cart, 3 items`. **Nav and drawer are never open together**: opening the nav then the cart
> reports **1** open dialog, and the reverse order also reports **1**.
>
> **Contrast, re-measured** on the production server from `getComputedStyle`, compositing each
> element's ancestor stack (the values that reach the browser are not the token hex values — an
> alpha surface arrives as `oklab(...)`, so the script converts it). 15 checks, **0 failures**:
> `--color-line` `rgb(91, 100, 120)` measures **3.37:1** on `ink-950` and **3.27:1** on `ink-900`
> for the product card, an inactive range chip, the sort select, the sort Apply button, the outline
> button, a range tile, the billing input and the checkout textarea — against T1's 1.21:1/1.25:1
> for the old `ink-700` border and T2's predicted 3.28/3.38. Text: `ink-400` 5.24 (on a card) and
> 5.4, `ink-200` 12.8, `ink-50` on `ink-950` 18.66, `neon-400` on a card 16.06, `ink-950` on a
> `neon-400` fill 16.55. Focus ring `solid 2px rgb(182, 255, 61)`.
>
> **Commands.** `npx tsc --noEmit` exit 0, `npm run lint` exit 0, `npm run build` exit 0 **twice
> with `$WPDEV down`** — `✓ Compiled successfully`, `✓ Generating static pages (4/4)`, every route
> `ƒ (Dynamic)` except `○ /opengraph-image` and `○ /robots.txt`, which read nothing from WordPress.
> Dev-only console noise, and it is dev-only: on the production server `/product/does-not-exist`,
> `/shop/does-not-exist`, `/totally-unknown-route`, `/product/neon-rush-6000` and `/` were loaded
> with `console`/`pageerror` listeners attached before navigation and reported **no warnings and no
> errors** at all (only the expected 404 resource messages). In dev, Next's own overlay emits
> "Encountered a script tag while rendering React component" on the 404 routes; it is not the app.
>
> **A false item, reported as a finding.** Done-when item 7 says *"an empty range shows a designed
> empty state"*. It does not, and cannot: `getCatalogue()` derives its categories **from** the
> products, so unpublishing every product in a range deletes the range. Re-proved today with all
> six products drafted and a cold cache: **`/shop` 200 with the designed empty block, while
> `/shop/disposables` and `/shop/e-liquids` answer 404** (`There is nothing at that address`). The
> reachable empty state is the whole shop. The plan's own wording is what is wrong here, not the
> code — the item is false, and this is the finding.
>
> **A small fix the sweep turned up, applied.** With the whole catalogue empty, `/` rendered the
> hero and then a "Shop by range" heading over an empty grid and a "One from each range" heading
> over another — a heading over nothing is the same defect `ProductGrid` already guards against.
> `app/page.tsx` now renders one designed empty block instead of those two sections when
> `products.length === 0` (`There is nothing in the catalogue right now`, with a way out), verified
> at all three widths with the catalogue still empty: headings `[hero, "There is nothing in the
> catalogue right now", "What this shop is"]`, 0 cards, overflow 0, status 200.
>
> **Done-when checklist** — **8 true, 1 false**:
>
> | # | Item | Verdict |
> | --- | --- | --- |
> | 1 | build, tsc, lint clean; build makes no request to WordPress | **true** — exit 0 for all three, build run twice with `$WPDEV down` |
> | 2 | At 390 the ranges and the shop are reachable from the header in ≤2 taps, and the footer links to Shop, the three ranges, About, Contact, Shipping & Returns, Privacy, Terms | **true** — the nav panel holds `/shop` + 3 ranges + "Shop all"; the footer's 11 links include all 8 named |
> | 3 | The footer renders the 21+ notice, a copyright line and the demo disclaimer, and still renders with WordPress stopped | **true** — measured on the last build; the offline pass shows it with the tunnel closed |
> | 4 | Unknown product slug, unknown category slug, a thrown error and a slow route each show a designed page, and the unknown slug answers 404 | **true**, with the slow route stated precisely: a 404 and the error page are designed and answer 500/404; during a **slow client-side navigation** the previous page stays on screen (`stillTheShop: true`, no spinner) and the new page arrives; during a slow **document load** the browser has no HTML yet, so it shows a blank document. There is no skeleton on purpose — a `loading.tsx` would cost every 404 its status (T7) |
> | 5 | Every interactive border ≥3:1, re-measured in the browser | **true** — 15 measurements, 0 failures, 3.27–3.37:1 for every `--color-line` boundary |
> | 6 | The product page shows breadcrumbs, a quantity selector, spec/shipping details and related products, and emits valid `Product` and `BreadcrumbList` JSON-LD | **true** — T10, and both blocks `JSON.parse` cleanly on the final build |
> | 7 | The shop sorts by URL and an empty range shows a designed empty state | **half true, half false** — `?sort=price-asc` / `?sort=price-desc` re-verified on the final code (name, then 9.99→34.99, then 34.99→9.99); **an empty range 404s instead**, because the ranges are derived from the products |
> | 8 | `/sitemap.xml` and `/robots.txt` answer with real content; a shared link has an OG image | **true** — T12; `/opengraph-image` fetched as a real 1200x630 PNG |
> | 9 | `frontend/UI-STANDARDS.md` exists and is what the visual tasks load as context | **true** — it is the context file for T2–T15, and T13 added its motion table |

---


**Goal** — Everything in the plan's Done-when is shown true at three widths, in the browser, with
the evidence reported.

**Depends on** T1–T14.

**Context to load** — `docs/ui-ux-plan.md` (Done when is the checklist); `frontend/UI-STANDARDS.md`;
the shared commands and screenshot recipe above.

**Do**

1. Confirm WordPress and the dev server are up, and note which port is in use.
2. Walk every route **and every state** at 1440x900, 768x1024 and 390x844: `/`, `/shop`,
   `/shop/disposables`, `/shop/e-liquids`, `/shop/pod-kits`, `/product/<each slug>`, `/checkout`,
   the five info pages, the 404, the error page, the empty range, the offline notice, the age gate,
   the cart drawer (empty and full), the mobile nav, and the checkout success page.
3. Confirm no horizontal overflow anywhere: `document.documentElement.scrollWidth === clientWidth`
   at each width for each route.
4. Keyboard-only pass: skip link first, nav opens and closes with Escape and returns focus, drawer
   does the same, nav and drawer never open together, every control has a visible ring.
5. Re-measure the contrast table in the browser and report it against T1's numbers.
6. Confirm the build is clean and does not reach WordPress: run `npm run build` with `$WPDEV down`.
7. Run the plan's Done-when list as a checklist and mark each item true or false with its evidence.
   **A false item is the finding, not a failure to report.**

**In scope** — fixes for anything the sweep turns up, recorded as an addition to the relevant task's
`> verified:` line, or as a new task appended to this file if it is larger than a small fix.
**Out of scope** — new features. If the sweep suggests one, put it in the plan's further
considerations rather than building it.

**Acceptance criteria**

1. Every route and state has a screenshot at all three widths, with `file` output confirming the
   real dimensions.
2. Zero horizontal overflow at 390x844 on every route.
3. The contrast table re-measured meets ≥3:1 for UI boundaries and ≥4.5:1 for body text.
4. `build`, `tsc --noEmit` and `lint` are clean, and the build runs with WordPress stopped.
5. Every Done-when item is marked true with its evidence, or false with the reason.

**Verify** — the screenshots, the `file` output, the ratio table, the three command results, and the
marked-up Done-when checklist. Report the count of items true and false.

**Size** — M

## T16 — Header ranges, regrouped — `[x]` done

**Goal** — The header stops listing every range. Ranges whose name reads "Vape <thing>" sit behind one
`Vape` disclosure, the rest stay inline, and every range is still one click or one tap from the
header at any width.

**Context to load** — `frontend/src/components/layout/nav-links.tsx`, `header.tsx`, `mobile-nav.tsx`,
`mobile-nav-button.tsx`, `frontend/UI-STANDARDS.md` (Responsive contract).

**In scope** — the desktop nav, and the breakpoint at which it appears. **Out of scope** — the mobile
panel, which stays a flat list (a vertical list of nine ranges in a 320px drawer has no width problem
to solve, and one tap still reaches every range), and anything that changes which ranges exist.

**Acceptance criteria**

1. With the catalogue at nine ranges the header does not overflow at 390, 768, 1024, 1280, 1440 or 1600.
2. Every range is one interaction from the header: a click when the nav is shown, the panel below that.
3. The disclosure is a keyboard-reachable `button` with `aria-expanded` and `aria-controls`; its items
   are links; Escape closes it and returns focus to the trigger; a press outside closes it; following a
   link closes it.
4. The current range carries `aria-current="page"` wherever it is listed, and the trigger carries the
   active colour when the current range is one of its items.
5. Any motion added has a `motion-reduce` neighbour.

**Verify** — measured in a real Chromium at six widths, plus a driven pass (open by Enter, Tab into the
items, Escape, press outside, follow a link), plus `build`/`tsc`/`lint` and the route sweep.
Screenshots with the menu open.

**Size** — S

> verified: **the grouping is the difference between "does not fit" and "fits".** The flat nav of nine
> ranges plus Shop measured **703px** and overflowed by **+353px at 768** and **+97px at 1024**. Grouping
> the five `Vape <thing>` ranges behind one trigger brings the nav to **576px** (561px at 1024, where it
> shrinks) — still **135px** too wide at 768, so the nav is `lg:flex`, the panel and its button are
> `lg:hidden`, and the panel's `matchMedia` guard is **(min-width: 1024px)**. Overflow is then **0** at
> 390, 768, 1024, 1280, 1440 and 1600.

> verified: the group is matched on the name (`/^vape\s/i`) rather than on a hard-coded list of slugs,
> because the ranges are derived from the catalogue: a tenth "Vape <thing>" range joins the menu without
> an edit. The inline set is Shop, Disposable Vape, E-Liquids, Nicotine Pouches and Pod Cartridge.

> verified: **the disclosure behaves as one.** Driven against the production build — when closed,
> `aria-expanded="false"` and the panel carries `hidden` (so its five links are out of the tab order);
> **Enter** on the trigger opens it and the panel reports `display` other than `none` with exactly
> `Vape Accessories, Vape Coils, Vape Kit, Vape Mod, Vape Tanks`; **Tab** from the trigger lands on
> `Vape Accessories`; **Escape** closes it and focus is back on the `Vape` trigger; a **pointer press
> outside** closes it; following **Vape Coils** lands on `/shop/vape-coils` with the menu closed, that
> item carrying `aria-current="page"`, and the trigger measured in `rgb(182, 255, 61)` — the neon
> token. `aria-haspopup` is deliberately absent: the contents are links, not a `menu` widget.

> verified: `npm run build` clean from a wiped `.next`, `npx tsc --noEmit` clean, `npm run lint` clean.
> Route sweep — **8 routes × 3 widths: 24/24 at 200, overflow 0, exactly one `h1`** each.
> Screenshots: `/tmp/ui/grow/nav-open-1440.png`, `nav-current-coils-1440.png`.

## T17 — The home hero, after the catalogue grew — `[x]` done

**Goal** — The front door says one thing at a time. The hero leads with its headline, its second
button leads somewhere with stock behind it, the age policy is not the tail of a sentence about
pricing, and the header survives a 320px viewport again.

**Why it is a task.** T12 of `docs/import-tasks.md` took the catalogue to nine ranges and 290
products. The home page grew with it: the hero's eyebrow listed all nine range names, and its second
call to action still pointed at `/shop/e-liquids`, which holds **one** product. Measured before the
change at 390x844: eyebrow **5 lines / 112px**, hero **625px**; at 320: **29px of horizontal
overflow** from the header's own controls.

**Context to load** — `frontend/src/app/page.tsx`, `components/layout/header.tsx`,
`frontend/UI-STANDARDS.md` (Type and spacing rhythm, Responsive contract).

**In scope** — the home hero and the header's smallest width. **Out of scope** — the rest of the home
page, the range cards, and the mobile panel.

**Acceptance criteria**

1. The first element a visitor sees in the hero is the `h1`.
2. Both calls to action lead to a range the shop actually stocks.
3. The age statement is its own line and meets contrast for its size.
4. No horizontal overflow at 320, 390, 768 or 1440 on any route.

**Verify** — measured in a real Chromium at four widths, plus the route sweep and `build`/`tsc`/`lint`.

**Size** — S

> verified: the eyebrow is gone and the `h1` leads. Hero **625px → 509px at 390** (116px shorter) and
> the page with it (8,755px → 8,639px); still 500px at 768 and 1440. Both buttons remain above the
> fold at every width (hero bottom 85px above it at 320, 202px at 390).

> verified: the second call to action is derived — the range with the most products, tie-broken by
> name — and now reads **"Shop Disposable Vape" → `/shop/disposable-vape` (40 products)** instead of
> "Browse e-liquids" → `/shop/e-liquids` (**1**). The hero renders no second button at all when the
> catalogue is empty, because an empty catalogue has no ranges.

> verified: the age line is its own `text-sm text-ink-400` paragraph — measured `14px`,
> `rgb(124, 133, 152)` on the `ink-900` hero, which is the 5.24:1 "Secondary" row of the contrast
> table, not the 18px body line it used to trail.

> verified: **the 320px header overflow is fixed without hiding a control.** Measured before: the
> controls row ended at **x=349** in a 320px viewport, 29px past it, with the wordmark at 146px and
> `0.25em` tracking. Tightening the tracking to `0.12em` and the row gap to `gap-4` below `sm` brings
> the wordmark to **109px** and the row to **x=304**: overflow **0** at 320, on all **11 routes**
> checked (`/`, `/shop`, `/shop/e-liquids`, `/shop/vape-coils`, a product page, `/checkout` and the
> five info pages). Search, menu and cart are all still there.

> verified: `npm run build` clean, `npx tsc --noEmit` clean, `npm run lint` clean, and the route
> sweep is **24/24 at 200 with overflow 0 and one `h1`** at 1440/768/390. Screenshots:
> `/tmp/ui/grow/home-new-{320,390,768,1440}.png`.

> **Left undone deliberately:** capping "One from each range" at six. That section shows one product
> per *range*, so it grows with the range count (stable at nine) rather than the product count, and
> every honest cap needs a heading that no longer describes the section. If the phone page is still
> too long, the lever is the nine range cards, not the product grid — say the word and it is a
> separate task.
