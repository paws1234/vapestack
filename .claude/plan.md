# Plan: Vapestack headless storefront (Next.js + WooCommerce/WPGraphQL)

Source brief: `docs/Start.md` — read, but kept as-is. It describes LocalWP and a Day 1-3
schedule; this project is a `wpdev` Docker site, so the brief is superseded by this plan.

## Goal

A headless vape storefront. The WordPress site at `http://localhost:8889` becomes a
WooCommerce + WPGraphQL commerce backend seeded with a six-product catalogue, and a Next.js 16 /
Tailwind v4 / Zustand app in `vapestack/frontend/` renders a dark-neon shop with a 21+ age gate,
live flavour and nicotine-strength variation selectors, a persisted slide-over cart, and a mock
checkout that creates a real `processing` WooCommerce order. Then it is deployed to Vercel
behind a tunnel so it can be clicked from a link.

## Steps

### Phase 0 — persist the plan

0. This file. Run `/plan` to generate `.claude/tasks.md`. Do not run `/plan docs/Start.md`: that
   file has none of the Goal / Steps / Constraints / Done-when headings the skill needs.

### Phase A — WordPress becomes a headless commerce backend

1. **Install the three plugins the project needs.** WooCommerce, WPGraphQL and GraphQL for
   eCommerce (formerly WPGraphQL for WooCommerce) are specific to this site, so
   `tools/install-plugins.sh` installs them from their public URLs into the site's own
   `wp-content/plugins`. They must not be added to `BUNDLED_PLUGINS`: that list is resolved
   against `/opt/packages`, which the shared kit image bakes from its own cache, and editing the
   kit so that one project gets what it needs is out of bounds. Flush rewrites afterwards so
   `/graphql` resolves.
2. **Seed the catalogue.** New re-runnable script at
   `wp-content/themes/vapestack-theme/tools/seed-products.php`, run with `wpdev wp eval-file`:
   global product attributes (flavour, nicotine strength) and their terms, categories
   Disposables / E-Liquids / Pod Kits, six products with SKUs (a mix of simple and variable),
   per-variation price, stock and image, 0/3/6 mg strengths, USD currency with two decimals,
   the WooCommerce onboarding wizard suppressed, and product images generated locally as
   gradient PNGs with GD and registered in the media library. Idempotent by SKU.
3. **Freeze the GraphQL contract** in `docs/headless-contract.md`: the catalogue query, single
   product by slug, variation attributes/price/image, categories, and how variable-product
   prices are represented. This is the input to the frontend data layer and the proof that the
   backend is ready before any React is written.

### Phase B — frontend foundation

4. **Scaffold `frontend/`** with `create-next-app` (TypeScript, ESLint, Tailwind, App Router,
   `src/`, alias `@/*`) on Next 16, add `zustand`, `git init` it as its own repository, ignore
   `.env*.local`, and commit `.env.local.example` holding `WP_GRAPHQL_URL`, `WP_REST_URL`,
   `WP_CONSUMER_KEY`, `WP_CONSUMER_SECRET`, `WP_PUBLIC_URL`.
5. **Data layer** — `src/lib/wp/graphql.ts` (fetch wrapper with `revalidate` and explicit
   errors), `types.ts` (plain TS shapes; no raw GraphQL types in components), `queries.ts`,
   `catalog.ts` (`getProducts`, `getProductBySlug`, `getCategories`) and `publicUrl.ts` mapping
   the WordPress origin onto `WP_PUBLIC_URL` so image URLs survive a tunnel. Parallel with 6.
6. **Design system and shell** — Tailwind v4 `@theme` tokens in `src/app/globals.css`
   (near-black surfaces, one neon accent pair, radius and spacing scale), fonts via
   `next/font`, UI primitives (`Button`, `Badge`, `Price`, `Card`), and the layout shell in
   `src/components/layout/` (header with wordmark, nav and cart button; footer with the 21+
   notice). Parallel with 5.

### Phase C — catalogue UI

7. **Home page** — hero, category tiles, featured product grid. Parallel with 8 and 12.
8. **Shop and category listings** — `/shop` and `/shop/[category]` with client-side filter and
   sort over server-fetched data, cards linking to the PDP.
9. **Product detail page** — `/product/[slug]` with `generateStaticParams` and
   `generateMetadata`: image, price, stock, description, variation options.
10. **Variable selectors** — client component resolving flavour + nicotine strength to a real
    variation id, updating price, image and availability instantly, disabling out-of-stock
    combinations.
11. **Global cart** — Zustand store with `persist`, add/update/remove, subtotal and item count,
    the slide-over drawer (focus trap, Escape to close, scroll lock) and a header badge.
12. **Age gate** — blocking 21+ modal on first load, remembered in `localStorage`, keyboard
    accessible, not shown on return visits. Parallel with 7-11.

### Phase D — mock checkout

13. **Order creation API** — `src/app/api/checkout/route.ts` (server-only) validating posted
    line items against WordPress, then creating the order through WC REST v3 at
    `/wp-json/wc/v3/orders` with `status: processing`, `payment_method: cod`, billing details
    and real product/variation ids, using a consumer key held in env; plus
    `src/app/api/orders/[id]/route.ts` returning a trimmed summary so no order key reaches the
    browser.
14. **Checkout UI and success page** — `/checkout` form (name, email, address, order note) with
    a loading state, redirect to `/checkout/success/[id]`, and a cart emptied only on success.

### Phase E — make it clickable

15. **Deploy** — push `frontend/` to GitHub, create the Vercel project (root = repository root)
    with the WP env vars, start a cloudflared quick tunnel to `localhost:8889`, set
    `WP_PUBLIC_URL` to the tunnel host and add it to `images.remotePatterns`, then verify from
    the public URL.

## Relevant files

- `.claude/plan.md` — this file. `.claude/tasks.md` is generated from it by `/plan`.
- `tools/install-plugins.sh` — new. Installs and activates the three project-specific plugins from
  their public URLs, and is the thing to re-run after `wpdev destroy`.
- `.env` — `BUNDLED_PLUGINS` names only packages the shared image already carries.
  `PROJECT_NAME` must never change (it names the volumes).
- `wp-kit/scripts/setup-site.sh` — read-only reference: installs each bundle as
  `/opt/packages/<entry>.zip` and checks installed-ness by slug, so the zip basename must equal
  the plugin folder slug.
- `wp-content/themes/vapestack-theme/tools/seed-products.php` — new. The theme directory is one
  of only three bind-mounted paths, so a WP-CLI script has to live there to be visible.
- `docs/headless-contract.md` — new. The proven GraphQL shape.
- `frontend/**` — new Next.js app: `src/lib/wp/*`, `src/components/{ui,layout}/*`,
  `src/app/{page,shop,product,checkout}/**`, `src/app/api/**`.
- `docs/Start.md` — source brief. Never edited.

## Constraints / Out of scope

- WordPress stays a `wpdev` project on port 8889. Do not change `PROJECT_NAME` in `.env`, do not
  edit `docker-compose.yml`, and do not add mounts by hand — `wpdev add plugin|theme` is the only
  supported way to add a mounted directory.
- No Elementor work: the storefront is fully headless, so Elementor, the `vapestack-theme`
  stylesheet and `wp-agent-bridge` are untouched by this plan.
- `frontend/` is an ordinary directory inside the project, outside every Docker mount, so it needs
  no compose changes and is served by its own dev server.
- The kit is shared infrastructure, not part of this project. Nothing under `wp-kit/` may be
  edited, and its cache and image must keep carrying only the kit's own packages.
- Project-specific plugins are installed by `tools/install-plugins.sh` from public URLs into
  `wp-content/plugins`, which lives in this project's Docker volume — so they survive a container
  rebuild or recreate and only go when the volume does. They must not be put in `BUNDLED_PLUGINS`,
  which resolves against the shared image's `/opt/packages`.
- Cart state is client-side (Zustand + `persist`) and orders are created over WC REST v3 with a
  consumer key held server-side. WooGraphQL's cart and checkout mutations are rejected: they need
  session-token plumbing (JWT or Cart-Token) for no portfolio-visible gain.
- All browser-to-WordPress traffic is proxied through Next.js server code: no CORS configuration,
  and no credential ever reaches the browser.
- Out of scope: real payments, shipping, tax, coupons, customer accounts, order emails,
  inventory sync, automated E2E suites, CI, and accessibility work beyond keyboard-operable
  modals and the drawer.
- `docs/Start.md` stays as written.

## Done when

- `wpdev wp plugin list --status=active` shows WooCommerce, WPGraphQL and GraphQL for eCommerce
  active alongside Elementor, mcp-adapter and wp-agent-bridge, and `wpdev smoke` is still 10/10.
- A products query posted to `http://localhost:8889/graphql` returns the six seeded products with
  no `errors`, and `docs/headless-contract.md` records the shape.
- `frontend/` builds clean (`npm run build`, `npx tsc --noEmit`, `npm run lint`).
- The storefront is browsable at desktop, tablet and mobile widths: age gate on first load, six
  products with images, working flavour/nicotine selectors, and a cart drawer that persists
  across reloads.
- Placing a mock order creates a `processing` order in WooCommerce with the right line items and
  total, observable with `wc_get_orders()` and in wp-admin, and the success page shows its
  summary.
- The deployed Vercel URL loads with product images resolving to the tunnel host, and an order
  placed from it appears in WooCommerce.

## Verification

1. Backend: `wp-kit/bin/wpdev wp plugin list --status=active --fields=name,version`; a host Node
   POST of a products query to `http://localhost:8889/graphql`; `wc_get_orders()` via
   `wpdev wp eval` for orders; `wp-kit/bin/wpdev smoke` after every plugin or theme change.
   `tools/install-plugins.sh` is itself verified by deleting a plugin with `wpdev wp plugin delete`
   and running the script to put it back.
2. Frontend: `npm run build`, `npx tsc --noEmit` and `npm run lint` in `frontend/`, plus
   Playwright screenshots at 1440x900, 768x1024 and 390x844 through the `playwright` MCP server
   against `http://localhost:3000` for every visual task.
3. End to end: place an order in the UI, then show it as `processing` in the WordPress dashboard
   and through `wc_get_orders()` with correct line items and totals.
4. Deployed: load the Vercel URL, confirm images resolve to the tunnel host, place one order.

## Decisions

- Headless. Elementor is not used for the storefront and no Elementor tasks appear here.
- `frontend/` is built in place as a plain directory: no repository is created for the project,
  and the frontend is not given one either. Version control is a decision for the deploy task, and
  Vercel can deploy only `frontend/` through its Root Directory setting whichever way that goes.
- Orders are read with `wc_get_orders()` because it is store-agnostic. Verified on 2026-09-11:
  this install reports `woocommerce_custom_orders_table_enabled=no`, so HPOS is off and orders
  are written to `shop_order` posts. Do not assume HPOS; `wc_get_orders()` is correct either
  way and is the only evidence worth quoting.
- Product images are generated locally as gradient PNGs: deterministic and no network dependency
  at seed time.

---

This plan is finished. The storefront's UI/UX work continues in **`docs/ui-ux-plan.md`** (findings,
steps, Done-when) with its tasks in **`docs/ui-ux-tasks.md`** — read those instead of adding to this
file, and leave `.claude/tasks.md` as the record of the backend and deploy work it already is.

