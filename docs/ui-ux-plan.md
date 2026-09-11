# Plan: Vapestack storefront — UI/UX enhancement

Run `/plan docs/ui-ux-plan.md` to split this into `docs/ui-ux-tasks.md` and work through it one
task at a time. This file is never edited; the checklist and the evidence live in the task file.

This plan is a second pass over the same project as `.claude/plan.md`. That file and its
`.claude/tasks.md` are the record of T1–T19 (backend, data layer, cart, checkout, deploy) and are
left exactly as they are. Everything here is frontend-only.

## Goal

The storefront stops looking like a developer demo and behaves like a shop. A visitor on a phone
can reach every range, the footer is a real footer with navigation, legal links and the 21+ notice,
every route has a designed state instead of Next's default 404, no interactive control sits below
the 3:1 contrast WCAG asks of it, and the page depth a storefront is judged on — breadcrumbs,
quantity, shipping details, related products, shareable sort, real metadata — is present.

The standards that produced those changes are written down once, in `frontend/UI-STANDARDS.md`,
so the next session inherits measured numbers instead of re-deriving taste.

## What the audit found — evidence, not opinion

All of it read out of the source on 2026-09-11, before any change:

| # | Finding | Where |
| --- | --- | --- |
| 1 | **A phone has no navigation at all.** The category nav is `hidden md:flex` *and* the "Shop all" button is `max-md:hidden`, both deliberate and commented. At 390px the header holds only the wordmark and the cart button. The footer has no links either, so no category is reachable from mobile at all. | `frontend/src/components/layout/header.tsx`, `footer.tsx` |
| 2 | **The footer is a placeholder.** Two grey paragraphs in one flex row: no columns, no navigation, no legal links, no copyright, no 21+ band. Its copy is developer-facing ("Next.js and Tailwind in front, WooCommerce and WPGraphQL behind"). | `frontend/src/components/layout/footer.tsx` |
| 3 | **Three routes 404 unstyled.** `notFound()` is called by the product page, the category page and the order-success page, but there is no `not-found.tsx`, `error.tsx` or `loading.tsx` anywhere in `src/app/`. | `frontend/src/app/` |
| 4 | **Interactive borders fail WCAG 1.4.11.** `--color-ink-700` #1d212c is **1.21:1** against `--color-ink-900` #0b0d13 and **1.25:1** against `--color-ink-950` #07080c; the guidance asks 3:1 for a UI component boundary. That is the `outline` button, every checkout `input`, and the shop `<select>`. Text contrast is fine (ink-400 is 5.2:1 on ink-900; the neon focus ring is 16.5:1 on ink-950). | `frontend/src/app/globals.css` + every consumer |
| 5 | No skip link, and `<main>` has no `id` to skip to. | `frontend/src/app/layout.tsx` |
| 6 | No `sitemap.ts`, `robots.ts` or OpenGraph image; no `metadataBase` or canonical. | `frontend/src/app/` |
| 7 | No `motion-reduce:` variant anywhere, though the drawer, the nav and the card zoom all animate. | `frontend/src/components/**` |
| 8 | `getCatalogue()` is not wrapped in React `cache()`, and it is read by the header *and* by every page. The footer is about to become a third reader. | `frontend/src/lib/wp/catalog.ts` |
| 9 | Duplication with no primitive: the container string `mx-auto w-full max-w-6xl px-5 sm:px-8` appears in six files, seven near-identical label+input blocks sit in the checkout form, and the shop `<select>` is `rounded-full` while the form fields are `rounded-xl`. | six files in `frontend/src/` |
| 10 | The `ProductDetail` component never renders `shortDescription`, which the data layer already maps. | `frontend/src/components/product/product-detail.tsx` |
| 11 | `public/` still holds create-next-app's unused `file.svg`, `globe.svg`, `next.svg`, `vercel.svg` and `window.svg`. | `frontend/public/` |

## Steps

### Phase 0 — standards and foundations

Everything visual blocks on this phase: the token change in step 2 is what the later steps style
against, and step 1 is the file they all load as context.

1. **T1 — Audit and standards.** Measure the running site and write `frontend/UI-STANDARDS.md`:
   the measured contrast table, the type and spacing rhythm, component-state rules
   (hover / focus / disabled / empty / error), the accessibility checklist, the reduced-motion
   rule, the responsive breakpoint contract, the two Tailwind v4 traps this project has already
   paid for (unlayered beats layered; `hidden` loses to a later display utility on order, so use a
   variant), and the recipe for verifying a UI change here. Record the findings in repository
   memory so a later session does not re-derive them.
2. **T2 — Tokens and primitives.** Depends on T1. Add a compliant interactive-border token
   (≥3:1, measured) and a danger token to `globals.css`; extract `Container`, `Field`, `Select`,
   `Prose` / `InfoPage` shell and `SkipLink`; wrap `getCatalogue()` in React `cache()`.

### Phase 1 — the shell

3. **T3 — Mobile navigation.** Depends on T2. A real menu below 768px, reusing
   `useModalBehaviour` for the focus trap, Escape and scroll lock. The panel is mounted in
   `app/layout.tsx`, **not inside `<header>`**: that element is `backdrop-blur`, and a
   `backdrop-filter` makes it the containing block for `position: fixed` descendants. Open state
   is shared by a small zustand store, mirroring the `cart-button` / `CartDrawer` pair — no
   provider, no new dependency. Categories arrive as props from the layout.
4. **T4 — Header polish.** Depends on T2, T3. Skip link and its `<main id>` target, active-route
   `aria-current`, the nav re-checked for crowding at 768px, and wordmark / cart hit areas.
5. **T5 — Footer rebuild.** Depends on T2. Brand column, Shop column fed by the live catalogue
   with a static fallback, About/Contact column, Help & legal column, a 21+/nicotine band, and a
   bottom bar carrying the year and the honest demo disclaimer. Copy in shop voice. Includes a
   *reset age verification* action, which needs a new `forgetAgeGateAnswer()` in
   `lib/age-gate.ts` **and** removal of `data-age-gate="off"` from `<html>` — otherwise the
   unlayered rule in `globals.css` keeps the gate hidden after the answer is forgotten.
6. **T6 — Info and legal pages.** Depends on T2, T5. `/about`, `/contact`,
   `/shipping-returns`, `/privacy` and `/terms` as static server components with demo-honest copy,
   sharing one `InfoPage` shell. No WordPress dependency, so they render with the tunnel closed.
   No contact form: nothing would receive it.

### Phase 2 — states

7. **T7 — Not-found, error and loading.** Depends on T2, T5. Designed `not-found.tsx`,
   `error.tsx` (with `reset`) and `loading.tsx` skeletons, plus a real empty state for a range with
   no products.

### Phase 3 — catalogue and product page

8. **T8 — Shop listing.** Depends on T2, T7. Sort moves into the URL so a sorted view is
   shareable and the back button is correct, announcements via `aria-live`, `aria-current` on the
   chips, an empty state, and the stray `rounded-full` select replaced by the `Select` primitive.
9. **T9 — Product card.** Depends on T2. One focus target with a visible ring, an honest sold-out
   treatment, a clearer "from" price, and the `alt=""` decision re-justified in the standards doc
   rather than only in an inline comment.
10. **T10 — Product page depth.** Depends on T2, T9. Breadcrumbs with `BreadcrumbList` JSON-LD,
    `Product` JSON-LD, a quantity selector (the store already accepts one — `add(item, quantity)`
    and `clampQuantity` are exported, so no store change), a spec and shipping detail block fed by
    the currently unused `shortDescription`, and related products from the same range.

### Phase 4 — home, metadata, motion

11. **T11 — Home page.** Depends on T2. Section rhythm and heading hierarchy, a trust and
    compliance band, and hero copy in shop voice — today it reads like a README ("served straight
    out of WordPress"), which is the same flaw the footer has.
12. **T12 — Metadata, OG image, sitemap, robots.** Depends on T2. `metadataBase`, canonical and
    OpenGraph/Twitter defaults, a site-wide `opengraph-image.tsx`, `sitemap.ts`, `robots.ts` and
    `themeColor`.
13. **T13 — Motion and reduced motion.** Depends on T2. `motion-reduce:` variants for the drawer,
    the nav, the card zoom and the skeletons, with durations and easings named in the standards
    doc.

### Phase 5 — record and prove

14. **T14 — Documentation.** Update `frontend/README.md`, the root `README.md`, `CLAUDE.md`,
    `docs/PROMPTS.md`, and point `frontend/AGENTS.md` at the standards doc — verifying that the
    addition survives a `next dev` restart, since that file is regenerated, and falling back to
    `frontend/CLAUDE.md` if it does not.
15. **T15 — Verification sweep.** Depends on all. Every route and state at three widths, a
    keyboard-only pass, and the contrast table re-measured in the browser rather than trusted from
    the hex values.

## Constraints / Out of scope

- **Frontend only.** `frontend/` is the whole change surface. No PHP, no theme, no plugin, no
  Elementor, no `wp-kit/` — the kit is shared infrastructure and a project must never edit it.
- **No new dependencies.** No typography plugin, no animation library, no headless UI kit. The
  prose styling, the nav panel and the primitives are hand-built against existing tokens.
- **No WordPress or tunnel changes.** `docker-compose.yml`, `.env` and `PROJECT_NAME` are
  untouched.
- **Every route stays `force-dynamic`** (`frontend/src/app/layout.tsx`). The Vercel build must
  never fetch WordPress, so `sitemap.ts` and `opengraph-image.tsx` must not depend on the
  catalogue at build time. Do not add `generateStaticParams` or make a page static.
- **Overlays are never mounted inside `<header>`.** It is `backdrop-blur`, which makes it the
  containing block for `position: fixed` descendants. Both existing overlays live in
  `app/layout.tsx` for this reason and the mobile nav joins them there.
- **The offline and demo paths keep working.** WordPress unreachable is an expected state:
  `OfflineNotice` replaces the catalogue pages, checkout answers demo mode, and the header falls
  back to a plain shop link. The new footer, nav and info pages must not fail a page when the
  catalogue cannot be read.
- **Cart and checkout behaviour is not re-decided.** No cart API changes, no checkout API changes,
  no new persisted state.
- **Out of scope:** header search, quick-add from cards, wishlist, reviews, upsells, real payments,
  shipping, tax, coupons, customer accounts, and any automated E2E suite or CI.
- `.claude/plan.md` and `.claude/tasks.md` are left as the record of T1–T19. Only a one-line
  pointer is added to `.claude/plan.md`.

## Done when

- `env -C frontend npm run build`, `npx tsc --noEmit` and `npm run lint` are all clean, and the
  build makes no request to WordPress.
- At **390x844** every range and the shop are reachable from the header in two taps or fewer, and
  the footer links to Shop, all three ranges, About, Contact, Shipping & Returns, Privacy and
  Terms.
- The footer renders the 21+ notice, a copyright line, and the demo disclaimer; it still renders
  with WordPress stopped.
- An unknown product slug, an unknown category slug, a thrown error and a slow route each show a
  designed page, and the unknown slug answers **404**.
- Every interactive border measures **≥3:1** against what it sits on, re-measured in the browser.
- The product page shows breadcrumbs, a quantity selector, spec/shipping details and related
  products, and emits valid `Product` and `BreadcrumbList` JSON-LD.
- The shop sorts by URL (`/shop?sort=price-asc`) and an empty range shows a designed empty state.
- `/sitemap.xml` and `/robots.txt` answer with real content; a shared link has an OG image.
- `frontend/UI-STANDARDS.md` exists and is what the visual tasks load as context.

## Relevant files

Paths are relative to the project root (`vapestack/`).

| Path | Role |
| --- | --- |
| `frontend/UI-STANDARDS.md` | **New.** The measured standards every visual task loads. Written by T1, appended to only when a task proves a new rule. |
| `frontend/src/app/globals.css` | Tokens, the new border/danger values, prose styling. The age-gate switch rule stays **unlayered** — a layered `display: none` loses to Tailwind's utilities layer. |
| `frontend/src/app/layout.tsx` | Skip link target, the mobile nav panel, `metadataBase`. Every route is `force-dynamic` here and stays that way. |
| `frontend/src/components/layout/header.tsx` | Mobile nav trigger, skip link, `aria-current`. Read the `max-md:hidden` comment before touching the nav: it exists because `hidden` loses to a later display utility. |
| `frontend/src/components/layout/footer.tsx` | Replaced outright by T5. |
| `frontend/src/components/layout/mobile-nav.tsx`, `frontend/src/stores/nav.ts` | **New.** The panel and its shared open state, mirroring `cart-button.tsx` + `stores/cart.ts`. |
| `frontend/src/lib/modal-behaviour.ts` | Reused by the nav. Do not write a second focus trap. |
| `frontend/src/components/ui/*.tsx` | `Container`, `Field`, `Select`, `Prose`, `SkipLink` added beside the existing `Button`, `Badge`, `Price`. |
| `frontend/src/lib/age-gate.ts` | Gains `forgetAgeGateAnswer()`; the gate reads the same key. |
| `frontend/src/lib/wp/catalog.ts` | `getCatalogue()` gains `cache()`. |
| `frontend/src/components/checkout/checkout-form.tsx` | Seven duplicated field blocks collapse into `Field`. |
| `frontend/src/components/product/product-detail.tsx` | T10 adds quantity, `shortDescription`, spec block and JSON-LD here. |
| `frontend/src/app/not-found.tsx`, `error.tsx`, `loading.tsx`, `sitemap.ts`, `robots.ts`, `opengraph-image.tsx` | **New.** None of these exist today. |
| `frontend/src/app/(info)/**` | **New.** The five info and legal routes. |
| `frontend/public/` | The five unused create-next-app SVGs go. Product images stay. |
| `docs/ui-ux-tasks.md` | Generated from this file. The checklist and the evidence. |

## Verification

1. **Build and types.** `env -C frontend npm run build`, `env -C frontend npx tsc --noEmit`,
   `env -C frontend npm run lint`. The build must not reach WordPress.
2. **Three widths per route**, 1440x900 / 768x1024 / 390x844. Use the Playwright-bundled Chromium
   directly — it is the only way to get a real 1440px layout here, because the VS Code browser
   pane cannot be resized past its own width and silently pads the canvas instead:
   `~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome --headless=new --window-size=W,H --screenshot=/tmp/ui/<name>.png URL`,
   then confirm the PNG's real dimensions with `file`. Never report success from a screenshot
   taken before the last change, and never reuse a page id from an earlier session.
3. **WordPress must be up** (`/home/adminpaws/Desktop/dev/wp-kit/bin/wpdev up .`) or every
   catalogue route renders `OfflineNotice` and there is nothing to look at. Check the frontend
   port too — `next dev` uses 3000 and falls back to 3001, and a dev server outlives the terminal
   that started it, so look for a listener before starting another one.
4. **Contrast re-measured in the browser** from `getComputedStyle`, not from the hex table.
5. **Keyboard-only pass:** the skip link is first, the nav opens and closes with Escape, focus
   returns to the trigger, and the nav and cart drawer are never open together.
6. **`curl -s http://localhost:3000/robots.txt`** and **`/sitemap.xml`** return real content; an
   unknown product slug returns the designed 404 **with a 404 status**.

## Decisions

- **Scope is a storefront polish, not a commerce build.** Search, quick-add, wishlist, reviews and
  upsells all need WordPress-side work and are deliberately excluded.
- **The new pages live in the storefront, not in WordPress.** Legal copy must render with the
  tunnel closed, and a GraphQL page query would add a dependency for content that never changes.
- **Adopted defaults for the three open questions**, because the plan is being executed and each
  is cheap to reverse:
  - `/robots.txt` disallows indexing and still publishes the sitemap. A portfolio demo behind a
    development-machine tunnel should not be surfaced by search.
  - **No sticky mobile add-to-cart bar.** It overlaps the cart drawer and the age gate in z-order
    and earns little in a demo.
  - The **mobile nav carries Shop, the three ranges and a "Shop all" primary action.**
- **The interactive-border token is new rather than a change to `ink-700`.** `ink-700` is used for
  panel borders and dividers where 3:1 is not wanted; moving it would repaint the whole site.
- **`alt=""` on product cards stays.** The heading inside the same link already names the product;
  the reasoning moves from an inline comment into the standards doc.
- **The mobile nav is a slide-over panel**, matching the cart drawer, not a full-screen takeover.
- **No per-product OG images.** Generating them would mean fetching or embedding the catalogue at
  build time, which the dynamic-routes decision forbids.
