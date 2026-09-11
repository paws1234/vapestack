# Tasks: Vapestack headless storefront

From `.claude/plan.md`, written 2026-09-11.

Any single task can be run on its own in a fresh session by asking for it by id, for example:
`do T9 of .claude/tasks.md`. Each task carries the context it needs, what it may touch, what
proves it, and how it is verified — so a session needs this file and the repository, nothing else.

## How to run a task

1. Invoke one task by id — `do T9 of .claude/tasks.md` — in a fresh session if you like. The task
   carries its own Goal, Context to load, In scope / Out of scope, Acceptance criteria and Verify,
   so the session needs this file and the repository, nothing else.
2. The session loads only that task's **Context to load** (a handful of files, never the whole
   repo), makes the change, then runs its **Verify** command.
3. It ticks that task's checkbox and adds a `> verified:` line underneath with the command and the
   observed result. That line is the record the next session reads — no separate status document.
4. Report, then take the next unticked task in order, unless a task names something under
   **Parallel with**.
5. If a task turns out to be wrong or impossible, stop and correct this file rather than quietly
   substituting different work.
6. If the task's **Verify** used a browser, close the page once the screenshots are taken, and
   re-open the URL rather than reusing a page id from an earlier session. Every task here ends
   with "Playwright screenshots of ...", so a run that never closes leaves the next task reading
   a render from before its change — which is exactly what happened while chasing T9's stock
   status.

The source plan (`.claude/plan.md`) is never edited. The checklist, the status and the evidence all
live here.

## Where context comes from

- `.claude/plan.md` — the source plan: Goal, Steps, Constraints / Out of scope, Done when.
- `docs/headless-contract.md` — the GraphQL shape and the traps already proved against the live
  endpoint. T5, T9, T10 and T13 depend on it.
- `docs/Start.md` — the original brief. Background only; the plan supersedes it where they differ.
- Skills, when a task names them: `wordpress-best-practices` before any PHP, `visual-testing`
  before claiming anything visual works.

## Status

| Task | What | Status | Depends on |
| --- | --- | --- | --- |
| T1 | Install the three project plugins | done | — |
| T2 | Seed the demo catalogue | done | T1 |
| T3 | Freeze the GraphQL contract | done | T2 |
| T4 | Scaffold the frontend app | done | T3 |
| T5 | Data layer over the GraphQL endpoint | done | T4 |
| T6 | Design system and layout shell | done | T4 |
| T7 | Home page | done | T5, T6 |
| T8 | Shop and category listings | done | T5, T6 |
| T9 | Product detail page | done | T8 |
| T10 | Variable selectors | done | T9 |
| T11 | Cart store and slide-over drawer | done | T10 |
| T12 | Age verification gate | done | T6, T11 (shared dialog hook) |
| T13 | Checkout API that creates a WooCommerce order | done | T2, T5 |
| T14 | Checkout page and success page | done | T11, T13 |
| T15 | Repository preparation | done | T14 |
| T16 | Self-contained product images | not started | T15 |
| T17 | Tunnel-proof catalogue and degraded checkout | not started | T16 |
| T18 | Publish: tunnel, GitHub, Vercel, first deploy | not started | T17, the user's accounts |
| T19 | Verify from the public URL | not started | T18 |

Notes on the remaining rows:

- **T13** was blocked on a WooCommerce REST credential and no longer is: its step 1 was run first,
  and the site's existing admin application password authenticated `/wp-json/wc/v3/orders` with a
  200. No key was created and the route's authentication was not weakened. See T13 below for why
  that pair works over plain HTTP and a consumer key would not have.
- **T15** was one Size-L task, "Deploy so it can be clicked". It was split on 2026-09-11 because an
  L is split before starting, and because it was gated on decisions only the user could make. Those
  decisions are now taken, and they are what the rows above implement:
  - **Repository layout** — one repository for the whole project, deployed from Vercel with
    **Root Directory = `frontend`**. The WordPress side is local-only, but its theme, seeder and
    docs belong with the app.
  - **Tunnel** — a **cloudflared quick tunnel**, so the host is a random `*.trycloudflare.com` name
    that changes whenever the tunnel restarts. T18 therefore ships `tools/tunnel.sh` to re-point the
    Vercel environment and redeploy in one command, rather than pretending the URL is stable.
  - **Build-time data** — the four catalogue routes become **dynamic**, so the Vercel build never
    fetches WordPress and cannot fail because the tunnel is down.
  - **Product images** — the nine seeded PNGs are **committed into `frontend/public/products/`**, so
    the deployed site looks complete with WordPress unreachable.
  - **Where the tunnel leaves a gap** — with dynamic routes the wordpress data cache still serves a
    warm entry when the tunnel is down, but a route never requested since the deploy has no entry.
    T19 warms every route while the tunnel is up and then proves the offline behaviour. If a
    **warmed** route still fails with the tunnel down, the fallback is a committed six-product JSON
    snapshot that `catalog.ts` reads when WordPress is unreachable; record that in T19 rather than
    assuming it.
- **T18 needs the user**: there is no GitHub account, no Vercel account and no cloudflared on this
  machine, and both `gh`/`vercel` logins are interactive, so the agent cannot complete them alone.
  Plan the handoff explicitly and do not paste a token into the conversation.

Keep this table in step with the checkboxes: when a task is ticked, change its row here too.

Definition of done for the whole plan: the site serves a six-product catalogue over GraphQL with
WooCommerce and WPGraphQL active and `wpdev smoke` at 10/10; the storefront browses correctly at
desktop, tablet and mobile with a working age gate, live variation selectors and a persisted cart;
a mock checkout creates a real `processing` WooCommerce order visible with `wc_get_orders()` and in
wp-admin; and the deployed Vercel URL loads with images resolving to the tunnel host.

---

## T1 — Install the three project-specific plugins — `[x]` done

**Goal** — WooCommerce, WPGraphQL and GraphQL for eCommerce are installed and active on the site,
installed from inside the project rather than by editing the shared kit.

**Depends on** none. **Parallel with** T2.

**Context to load** — `docs/headless-contract.md` for the versions; `.env`; `wp-kit/scripts/setup-site.sh`
read-only, to see how `BUNDLED_PLUGINS` resolves against `/opt/packages`.

**Do**

1. Create `tools/install-plugins.sh`, a host script that installs each plugin by public URL with
   `wpdev wp plugin install <url> --activate`, skipping ones already installed.
2. Keep `BUNDLED_PLUGINS` in `.env` at `elementor mcp-adapter`: it resolves against the shared
   image's `/opt/packages`, which is baked from the kit's own cache, so a project-specific plugin
   listed there would only work if the kit had been edited.
3. Flush rewrites so `/graphql` resolves.

**In scope** — `tools/install-plugins.sh`, `.env`. **Out of scope** — anything under `wp-kit/`,
`docker-compose.yml`, and WooCommerce settings the app does not depend on.

**Acceptance criteria** — `wpdev wp plugin list --status=active` lists WooCommerce 11.1.0,
WPGraphQL 2.22.3 and GraphQL for eCommerce 1.0.3 alongside Elementor, mcp-adapter and
wp-agent-bridge; `wpdev smoke` still reports 10/10; `git -C wp-kit status --short` is empty.

**Verify** — `wpdev wp plugin list --status=active --fields=name,version`;
`node --input-type=module -e` posting a `products` query to `http://localhost:8889/graphql`;
`wpdev smoke`.

**Size** S

> verified: plugins listed at
> `woocommerce 11.1.0 / wp-graphql 2.22.3 / wp-graphql-woocommerce 1.0.3 / elementor 4.3.0-beta2 /
> mcp-adapter 0.6.1 / wp-agent-bridge 0.1.0`; products query returned `HTTP 200` with
> `{"data":{"products":{"nodes":[{"name":"Pulse Pod Kit"}]}}}` and no `errors`; `wpdev smoke`
> `10/10 checks passed`; `git -C wp-kit status --short` printed nothing, and
> `docker run --rm wp-dev:php8.3 ls /opt/packages` lists only elementor, hello-elementor and
> mcp-adapter.
> The installer itself was proved by deleting both GraphQL plugins
> (`wpdev wp plugin delete wp-graphql-woocommerce wp-graphql` → `Success: Deleted 2 of 2 plugins.`)
> and running `bash tools/install-plugins.sh`, which reinstalled and reactivated them.

---

## T2 — Seed the demo catalogue — `[x]` done

**Goal** — Six products with their attributes, categories, variations, images and prices exist in
WooCommerce, and re-running the seeder never duplicates them.

**Depends on** T1. **Parallel with** T1.

**Context to load** — `.env` for `PROJECT_THEME`; the bind-mount list in `docker-compose.yml`, which
is why the script lives under the theme directory.

**Do**

1. Create `wp-content/themes/vapestack-theme/tools/seed-products.php`, run with
   `wpdev wp eval-file <path> [reset]`.
2. Create the `flavour`, `nicotine-strength` and `colour` global attributes and their terms, and
   the Disposables / E-Liquids / Pod Kits categories.
3. Create six products by SKU — Neon Rush 6000, Frost Rush 3000, Midnight Berry E-Liquid, Coastal
   Tobacco E-Liquid, Pulse Pod Kit, Aero Pod Kit — mixing variable and simple types, with per
   variation price, stock and image, one combination deliberately sold out.
4. Generate one 1200x1200 gradient PNG per option with GD, register it in the media library, and
   keep its alt text naming the option.
5. Set USD currency and suppress the WooCommerce onboarding wizard.

**In scope** — the new seed script. **Out of scope** — theme templates, `wp-agent-bridge`, real
product photography.

**Acceptance criteria** — a re-run reports `0 created, N skipped`; `wc_get_products` counts 6
products and 20 variations; Neon Rush reports a `12.99-14.99` range and one `OUT_OF_STOCK`
variation; the media library holds 9 `vapestack-*.png` files with no duplicates.

**Verify** — `wpdev wp eval-file <path>` twice; `wpdev wp eval` counting products, variations and
attachments.

**Size** M

> verified: first run `Success: 6 created, 0 skipped.`; second run `Success: 0 created, 6 skipped.`;
> `reset` run printed `deleted` for all six then `created` for all six;
> `products=6 variations=20 range=12.99-14.99` and `VS-DSP-6000-mango-sunset-6mg 14.99 outofstock`;
> attachment listing showed 9 files, e.g. `vapestack-frost-mint.png alt=Frost Mint`.

---

## T3 — Freeze the GraphQL contract — `[x]` done

**Goal** — `docs/headless-contract.md` records the exact query shape the frontend may rely on, and
the traps that were proved while finding it.

**Depends on** T2.

**Context to load** — the seeded catalogue; the GraphQL endpoint at `http://localhost:8889/graphql`.

**Do**

1. Probe the endpoint until the catalogue query, product lookup, attributes, variations, prices,
   stock and images are all confirmed.
2. Record each finding with the evidence, including the ones that contradict the obvious guess.
3. Record the seeded catalogue so a later task can sanity-check what it sees.

**In scope** — the new doc. **Out of scope** — application code.

**Acceptance criteria** — every rule in the doc was observed against the live endpoint, and the
sample response is a real response.

**Verify** — re-running the documented query returns the documented shape.

**Size** S

> verified: contract written from live responses, including `stockStatus` needing
> `... on InventoriedProduct`; term labels needing `... on GlobalProductAttribute { terms {...} }`;
> `price(format: RAW)` on a variable product returning `"12.99, 12.99, 12.99, 14.99, 14.99, 14.99"`
> rather than a range; and an unknown slug returning `data.product: null` **with** an error
> (`No product ID was found corresponding to the slug: does-not-exist`).

---

## T4 — Scaffold the frontend app — `[x]` done

**Goal** — A Next.js 16 app exists inside the project, builds clean, and reads its configuration
from the environment.

**Depends on** T3.

**Context to load** — `docs/headless-contract.md` for the endpoint shape.

**Do**

1. Scaffold `frontend/` with `create-next-app` (TypeScript, ESLint, Tailwind, App Router, `src/`,
   alias `@/*`) and add `zustand`.
2. Add `.env.local.example` documenting `WP_GRAPHQL_URL`, `WP_REST_URL`, `WP_INTERNAL_URL`,
   `WP_PUBLIC_URL`, `WP_CONSUMER_KEY`, `WP_CONSUMER_SECRET`, and a gitignored `.env.local`.
3. Exempt `.env.local.example` from the scaffold's `.env*` ignore rule, and extend the project
   `.gitignore` for `frontend/node_modules` and `frontend/.next`.
4. Do not create a repository. `create-next-app` initialises one by default; delete it.

**In scope** — `frontend/**`, the project `.gitignore`. **Out of scope** — the WordPress side, and
any repository decision, which belongs to T15.

**Acceptance criteria** — `npm run build`, `npx tsc --noEmit` and `npm run lint` are clean; no
`.git` exists anywhere under the project.

**Verify** — the three commands, plus
`find vapestack -maxdepth 2 -name .git -print` returning nothing.

**Size** S

> verified: build `✓ Compiled successfully in 3.9s` with `Route (app) ┌ ○ / └ ○ /_not-found`;
> `eslint` completed with no output; `find` returned nothing after
> `rm -rf frontend/.git`. Dev server runs on port 3001 because port 3000 is held by another
> process on this machine.

---

## T5 — Data layer over the GraphQL endpoint — `[x]` done

**Goal** — Components receive plain product objects and never see a GraphQL response shape.

**Depends on** T4.

**Context to load** — `docs/headless-contract.md`; the rules there are the specification.

**Do**

1. `src/lib/wp/graphql.ts` — POST wrapper with revalidation and explicit, useful errors.
2. `src/lib/wp/queries.ts` — the catalogue document, including the inline fragments.
3. `src/lib/wp/types.ts` — domain types; one price range, one stock state, one selection map.
4. `src/lib/wp/catalog.ts` — `getProducts`, `getProductBySlug`, `getCategories`, plus the mapping
   that computes price ranges from variations and treats a product as available when any variation
   is.
5. `src/lib/wp/publicUrl.ts` — rewrite the WordPress origin onto `WP_PUBLIC_URL`.

**In scope** — `src/lib/wp/*`. **Out of scope** — components and pages.

**Acceptance criteria** — a probe returns six products with correct ranges, resolved option labels
and the sold-out combination identified; `getProductBySlug` returns null for an unknown slug
instead of throwing.

**Verify** — a temporary probe route rendering the mapped data, then deleted;
`npx tsc --noEmit`.

**Size** M

> verified: probe returned `"count": 6`, three categories with counts, and per product a computed
> range (`Frost Rush 3000 min 9.99 max 10.99`), resolved labels
> (`Flavour [pa_flavour]: Frost Mint=frost-mint`) and `"soldOut": ["mango-sunset+6mg"]`.
> Probe deleted; the file's own notes record that an `__probe` folder is never routed because
> App Router treats anything starting with `_` as private.

---

## T6 — Design system and layout shell — `[x]` done

**Goal** — A dark-neon visual language exists as tokens, with reusable primitives and a header and
footer every page shares.

**Depends on** T4. **Parallel with** T5.

**Context to load** — `src/app/globals.css`, `src/app/layout.tsx`; the `visual-testing` skill for
widths and what to look for.

**Do**

1. Define colour, font and radius tokens in `@theme` in `src/app/globals.css`, with surface and
   accent scales.
2. Add `Button` (with an exported `buttonStyles` so links can match), `Badge` and `Price`.
3. Add `Header` (wordmark, category nav from the catalogue, shop link) and `Footer` (21+ notice),
   and wire them into the root layout.

**In scope** — `src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui/*`,
`src/components/layout/*`. **Out of scope** — page content, and the cart button, which belongs to
T11.

**Acceptance criteria** — the page renders dark with lime accents and no horizontal overflow at
1440, 768 and 390.

**Verify** — Playwright screenshots at the three widths.

**Size** M

> verified: screenshots at 1440x900 and 390x844 show the token palette applied — dark surfaces,
> lime primary button, lime price text — the shell present, and no overflow.
> Note for whoever touches `globals.css` next: an edit to the `@layer base` block landed with
> `::selection` unclosed and `:focus-visible` nested inside it, which made PostCSS reject the file
> and returned **500 on every route** until repaired. After any CSS edit, load a page before
> believing it.

---

## T7 — Home page — `[x]` done

**Goal** — The home page introduces the shop, lists the ranges, and shows one product per range.

**Depends on** T5, T6. **Parallel with** T8, T12.

**Do**

1. Hero with the proposition and two calls to action.
2. Range tiles linking to `/shop/<slug>` with product counts.
3. One featured product per range, using `ProductCard`.

**In scope** — `src/app/page.tsx`, `src/components/product/product-card.tsx`.
**Out of scope** — the listing pages.

**Acceptance criteria** — one card per range, counts matching the catalogue, all three images
loading, no overflow on mobile.

**Verify** — Playwright screenshots at 1440 and 390, plus image `naturalWidth` checks.

**Size** M

> verified: three range tiles reading `Disposables 2 products`, `E-Liquids 2 products`,
> `Pod Kits 2 products`; three cards `Frost Rush 3000 from $9.99 4 options`,
> `Coastal Tobacco E-Liquid $13.99 1 option`, `Aero Pod Kit $24.99`; image check
> `naturalWidth 475` for all three; mobile screenshot shows a single column with no overflow.
> Two bugs were caught by looking rather than assuming: `getCategories()`/`getProducts()` were
> destructured in the wrong order (the ranges section listed products), and "1 options" needed
> pluralising.

---

## T8 — Shop and category listings — `[x]` done

**Goal** — `/shop` lists everything and `/shop/<category>` filters by range, both sortable, with
filtering expressed in the URL.

**Depends on** T5, T6. **Parallel with** T7, T12.

**Do**

1. `src/components/product/product-grid.tsx` — client component holding the sort choice and
   rendering the grid, loading the first row's images eagerly.
2. `src/components/product/category-chips.tsx` — range filter as links, with the active range
   marked.
3. `src/app/shop/page.tsx` and `src/app/shop/[category]/page.tsx`, the latter with
   `generateStaticParams`, `generateMetadata` and `notFound()` for an unknown range.

**In scope** — `src/app/shop/**`, `src/components/product/*`. **Out of scope** — server-side
filtering, pagination, faceted search.

**Acceptance criteria** — sorting by price reorders in both directions; a range page shows only its
products with its chip active; an unknown range is a 404; six images load without scrolling.

**Verify** — Playwright at 1440, 768 and 390; status codes for `/shop`, `/shop/<valid>` and
`/shop/<invalid>`.

**Size** M

> verified: `/ 200`, `/shop 200`, `/shop/e-liquids 200`, `/shop/not-a-range 404`;
> price desc → `Pulse Pod Kit, Aero Pod Kit, Coastal Tobacco E-Liquid, Midnight Berry E-Liquid,
> Neon Rush 6000, Frost Rush 3000`, price asc the exact reverse; range page heading `E-Liquids`,
> `2 products in this range.`, active chip `E-Liquids`, 2 cards; tablet 768 shows 2 columns, 3 rows,
> no overflow; all six images `naturalWidth 475` without scrolling after the first row was made
> eager (before that, all six reported `0` because Chrome defers lazy images in an automated tab —
> the optimiser itself was fine, returning `200` and a valid 640x640 PNG).

---

## T9 — Product detail page — [x] done

**Goal** — `/product/<slug>` shows one product in full: image, price, availability, description and
its options.

**Depends on** T8.

**Context to load** — `docs/headless-contract.md` rules 3, 4 and 6; `src/lib/wp/catalog.ts`;
`src/components/product/product-card.tsx` for house style; the `visual-testing` skill.

**Do**

1. `src/app/product/[slug]/page.tsx` with `generateStaticParams` from `getProducts()` and
   `generateMetadata` for title and description.
2. Call `notFound()` when `getProductBySlug` returns null.
3. Render the image (alt from `product.image.alt`), name, category, price range, stock state and
   the HTML description with `dangerouslySetInnerHTML`, styled for the dark theme.
4. Render one selector group per attribute, listing options by their label — static for now;
   T10 adds behaviour.
5. Link back to the product's range.
6. Render the options as plain text, not controls: nothing is interactive until T10, so the markup
   must not look clickable.

**In scope** — `src/app/product/**`, and a `variant="ghost"`/`outline` use of existing primitives.
**Out of scope** — add-to-cart and variation resolution (T10, T11); no new dependencies.

**Acceptance criteria** — every product page renders 200 at 1440, 768 and 390 with no overflow; an
unknown slug is a 404; availability reads as in stock for every seeded product, and the
out-of-stock presentation is verified by temporarily forcing one product out of stock,
screenshotting it and restoring it (no seeded product is fully sold out — measured 2026-09-11);
option labels read as names ("Frost Mint"), never slugs.

**Verify** — Playwright screenshots of one variable and one simple product at three widths, plus
status codes for a valid and an invalid slug.

**Size** M

> verified: `/product/[slug]/page.tsx` created; all six slugs return 200 and `does-not-exist`
> returns 404; `tsc`, `lint` and `build` clean, with the six product routes prerendered as SSG.
> Neon Rush 6000 at 1440/768/390: `h1` "Neon Rush 6000", price "from $12.99", badge "In stock",
> terms `Flavour` / `Nicotine Strength`, options `Blue Razz Ice, Frost Mint, Mango Sunset, 3mg,
> 6mg` — names, not slugs; the description renders as a real `<p>` rather than escaped text;
> image `naturalWidth` 720/768/390 matching its 50vw/100vw `sizes`; no overflow at any width.
> Aero Pod Kit (simple) at the same three widths: `$24.99` with no "from", 0 attribute groups,
> back link "← Pod Kits", title "Aero Pod Kit | Vapestack".
> Sold-out path, forced because no seeded product is sold out: `set_stock_status()` was ignored
> while the product manages stock, so the quantity was set to 0 (`qty=0 status=outofstock`); the
> PDP then showed the "Sold out" badge at 1440 and 390 with no overflow, and the shop card read
> "Sold out POD KITS Aero Pod Kit $24.99". Restored to `qty=16 status=instock` and confirmed in
> the rendered page: PDP "In stock", no sold-out badge in the shop.
> Traps: `.next` retained the earlier `npm run build` output, so a running `next dev` served the
> prerendered page — the stale "In stock" survived a `.next/cache` purge *and* a restart, and only
> went away after `rm -rf .next`. Separately, `wpdev` resolves the project by walking up from cwd,
> so it fails from the parent directory; `env -C <project> .../wpdev wp ...` is the reliable form.

---

## T10 — Variable selectors — `[x]` done

**Goal** — Choosing a flavour and a strength resolves to a real variation, and the page shows that
combination's price, image and availability.

**Depends on** T9.

**Context to load** — contract rules 3, 4, 6; `ProductVariation.selection` in
`src/lib/wp/types.ts`; the T9 page.

**Do**

1. Add a client component that holds the chosen option per attribute, resolving a variation by
   matching every selection against `variation.selection`.
2. Update price, image and stock text when the resolution changes; fall back to the product image
   when a variation has none.
3. When a combination is unavailable, show it as unavailable rather than silently accepting it, and
   say which other option would be needed.
4. Keep the heading and price in the server-rendered HTML so the page is useful before hydration.

**In scope** — the new client component and the T9 page's option area. **Out of scope** — the cart;
nothing is added to a basket in this task.

**Acceptance criteria** — selecting `Mango Sunset` + `6mg` on Neon Rush 6000 shows that
combination as unavailable while the other five stay buyable; selecting a different combination
changes the displayed price between 12.99 and 14.99 and swaps the image; the console has no React
warnings.

**Verify** — paired before/after Playwright screenshots of the price and image, and the console
output.

**Size** M

> verified: `src/lib/variations.ts` (`matchesSelection`, `findVariation`, `initialSelection`,
> `isOptionAvailable`, `unavailableMessage`) plus `src/components/product/product-detail.tsx`
> ("use client"), and the page reduced to metadata, `notFound()` and the back link;
> `npx tsc --noEmit`, `npm run lint` and `npm run build` clean, six product routes prerendered.
> Pre-hydration HTML (`neon-rush-6000.html`) contains the `<h1>` "Neon Rush 6000", one `$12.99`
> (no "from"), `In stock`, 5 radios with 2 checked (`blue-razz-ice`, `3mg`) and no `line-through`
> — T9's "from $12.99" is thereby superseded, as the plan said it would be. The build output was
> then removed with `rm -rf .next` and the dev server restarted, which is the T9 trap in reverse,
> so run `npm run build` again to re-inspect that file.
> In the browser at 1440x900, 768x1024 and 390x844 the same sequence repeats: start `$12.99` /
> `In stock` / `vapestack-blue-razz-ice.png`; `Mango Sunset` then `6mg` gives `$14.99` / `Sold out`
> / `vapestack-mango-sunset.png` with the notice "Mango Sunset · 6mg is sold out — 3mg is
> available."; `Mango Sunset` and `6mg` are struck through, `3mg` stays plain, and the remaining
> five combinations stay buyable. `Frost Mint` with `6mg` swaps the image to
> `vapestack-frost-mint.png` and reads `In stock`, and `3mg`/`6mg` move the price between 12.99
> and 14.99. `scrollWidth - innerWidth` was -15 at all three widths, so no horizontal overflow.
> Simple `aero-pod-kit`: `$24.99`, `In stock`, 0 fieldsets and no notice element. `pulse-pod-kit`
> (colour only): 1 fieldset, image `midnight-black` → `neon-lime`.
> Console after a reload with listeners attached: React DevTools info, `[HMR] connected` and two
> `next/font` preload warnings for `.woff2` files only — no React warnings, no hydration errors,
> no page errors. The font warnings predate this change (they were already in the page's event
> log from 2026-09-10) and are untouched by it.
> Screenshots looked at: desktop default, desktop sold-out, 390 top and 390 selectors in the
> sold-out state, 390 simple product.
> Trap: an `sr-only` radio inside its own `<label>` makes Playwright's `check()` fail with
> "<label> intercepts pointer events" — click the wrapping label (what a real click does) or
> match the option with `label:has(input[value=…])`.

---

## T11 — Cart store and slide-over drawer — [x] done

**Goal** — A cart that survives a reload, visible in a drawer, with a count in the header.

**Depends on** T10.

**Context to load** — `Product` and `ProductVariation` in `src/lib/wp/types.ts`; `src/components/layout/header.tsx`.

**Do**

1. `src/stores/cart.ts` — Zustand store with `persist`, keyed by variation id (or product id for
   simple products), holding just enough to render: id, product slug, name, option labels, unit
   price, image, quantity.
2. `add`, `remove`, `setQuantity` and a derived count and subtotal. The subtotal is display only:
   WooCommerce prices the order it creates.
3. A slide-over drawer with a focus trap, Escape to close and body scroll lock, reachable from a
   header button that shows the item count.

**In scope** — `src/stores/cart.ts`, `src/components/cart/*`, the header's cart button.
**Out of scope** — checkout (T13), and any server-side cart.

**Acceptance criteria** — adding two different variations shows two lines with the right quantities
and a subtotal; the count badge matches; the cart survives a reload; Escape and the close button
both dismiss the drawer and return focus to the trigger.

**Verify** — Playwright screenshots of the empty and populated drawer at 1440 and 390, plus a
reload with the items still present.

**Size** M

> verified: new `src/stores/cart.ts`, `src/lib/modal-behaviour.ts`,
> `src/components/cart/{cart-button,cart-line,cart-drawer}.tsx`; edited `variations.ts`
> (`chosenOptionLabels`), `product-detail.tsx` (Add to cart), `header.tsx`, `app/layout.tsx`.
> `tsc`, `lint` and `build` clean, 14 routes prerendered.
> Two variations of Neon Rush became **two lines** — `Frost Mint · 6mg $14.99` and
> `Frost Mint · 3mg $12.99` — with `Subtotal $27.98` and badge `Cart, 2 items`, both thumbnails
> loaded (`naturalWidth > 0`). After a reload both lines were back with the same subtotal and
> badge. The stepper took the first line to 2 (`$40.97`, badge `Cart, 3 items`) and the `−` button
> is `disabled` at 1; `Remove` left one line at `$14.99`. Escape and Close both close it, the
> panel carries `inert`, `document.body.style.overflow` returns to `""`, and focus goes back to
> the trigger (`Cart, 1 item`) — the close path did that from the start, Escape only after the fix
> below. Closed, the drawer is `aria-hidden="true"` with `inert`, and `inert` keeps its controls
> out of the tab order. Panel 448px right-aligned at 1440, full width at 390. `overflowX` was 0 on
> the home page, the PDP and both drawer widths at 1440/768/390 and even 320.
> Traps, in the order they bit:
> 1. **Zustand hydrates a synchronous `localStorage` during store creation**, so the persisted
>    items land in the *first* client render while the prerendered HTML says the cart is empty.
>    `skipHydration: true` plus one `rehydrate()` in the drawer is what keeps the console clean.
> 2. **`backdrop-blur` on the header is a `backdrop-filter`**, which makes that element the
>    containing block for `position: fixed` descendants. Both overlays are therefore mounted in
>    `app/layout.tsx` as siblings of `<Header />`, never inside it.
> 3. **`hidden md:inline-flex` does not hide anything.** Tailwind v4 emits `.inline-flex` *after*
>    `.hidden` in the utilities layer, so the unprefixed `hidden` loses to the display utility
>    `buttonStyles()` already sets, and "Shop all" stayed on a phone — with 38px of horizontal
>    overflow at 320px. `max-md:hidden` works, because a variant is emitted after base utilities.
>    Caught by reading computed `display` at 320/390/767/768, not by looking at a screenshot.
> 4. **Focus work has to wait a frame.** React applies `inert` in the commit, and a focus restore
>    done in the same tick is undone by the blur that `inert` causes. Both the opening focus and
>    the restore now run in a `requestAnimationFrame`, and the restore checks `isConnected`.
> 5. A dev-only Next advisory appears when the drawer opens over the PDP ("Image … was detected as
>    the Largest Contentful Paint … add `loading="eager"`"). The cart thumbnails are deliberately
>    lazy; it is noise, not a defect.

---

## T12 — Age verification gate — [x] done

**Goal** — A first-time visitor must confirm they are 21+ before browsing, and is not asked again.

**Depends on** T6, and on T11 for `useModalBehaviour`. **Parallel with** T7-T10 — T11 landed
first, so this reuses the shared dialog behaviour rather than growing a second focus trap.

**Context to load** — `src/app/layout.tsx`; the `visual-testing` skill.

**Do**

1. A client component rendered from the root layout that shows a blocking modal until the visitor
   confirms, remembering the answer in `localStorage`.
2. Keyboard accessible: focus moves into the dialog, Escape is not a way past it, focus stays
   inside, and the underlying page cannot be scrolled while it is open.
3. A decline path that explains the shop is 21+ rather than silently re-prompting.

**In scope** — the new component and one line in `src/app/layout.tsx`. **Out of scope** — server-side
age checks; this is a demo gate, and the footer notice stays.

**Acceptance criteria** — a first visit shows the gate and the page cannot be scrolled behind it;
confirming dismisses it and a reload does not show it again; clearing `localStorage` brings it back;
declining does not let the shop be browsed.

**Verify** — Playwright screenshots at 1440 and 390 of the gate, and a screenshot after reload with
no gate; check `localStorage` between visits.

**Size** S

> verified: new `src/lib/age-gate.ts` (storage key, reader, writer and the pre-paint script),
> `src/components/age-gate.tsx`, one unlayered rule at the end of `globals.css`, and `layout.tsx`
> carrying the inline script plus `<AgeGate />` after the drawer.
> First visit at 1440 and 390: gate up, focus already on "Yes, I am 21 or over",
> `document.body.style.overflow === "hidden"`, `data-age-gate` absent. Escape did **not** dismiss
> it, and Tab cycled `Yes → No → Yes → No`, so focus never left the dialog. Decline replaced the
> question with "Come back when you are 21" and no controls at all, left `localStorage` empty
> (a decline is not remembered) and kept the page covered — `elementFromPoint(8, 8)` is the gate,
> not the header behind it. A reload after declining asked again. Confirming removed the gate from
> the DOM, released the scroll lock, and wrote `{"vapestack-age-verified":"true"}`; a reload then
> showed no gate, and clearing that key brought it back.
> The no-flash claim was proved rather than assumed: with only `.js` responses delayed 5s, the
> served HTML had `data-age-gate="off"` set by the inline script, the gate still in the DOM, and
> `display: none` with height 0 while React had not run — so a returning visitor's very first
> paint is the shop with no gate. After hydration the gate leaves the DOM and the persisted
> **2-line cart** appears (`Cart, 2 items`) with no React or hydration warning, and `pageerror`
> empty. Traps:
> 1. **Centring is not enough for a tall panel.** `items-center` on a panel taller than the
>    viewport pushes its top out of reach. The backdrop is the scroll container and a
>    `min-h-full` wrapper does the centring, so the heading and first button stay reachable on a
>    short window. (Playwright's failed clicks on this panel were what exposed it.)
> 2. **The hiding rule must be unlayered.** Tailwind's `utilities` layer comes after `base`, so
>    `display: flex` on the gate would beat a layered `display: none` no matter the specificity.
> 3. **Removing the buttons on decline drops focus onto `<body>`** while a modal is still open;
>    the panel takes focus back, which also announces the new heading.
> 4. `setState` inside an effect is a lint error here (`react-hooks/set-state-in-effect`).
>    Reading `localStorage` during render is an external-store read: `useSyncExternalStore` with a
>    server snapshot of `false` is what React provides for it, and the hydration render uses the
>    server's answer.
> 5. An inline `<script>` waits for pending stylesheets, so a probe that delays CSS also delays
>    the pre-paint script. Delay only `.js` when proving this one.

---

## T13 — Checkout API that creates a WooCommerce order — [x] done

**Goal** — A posted basket becomes a real `processing` WooCommerce order, priced by WooCommerce, and
the browser never sees a credential.

**Depends on** T5, T2. **Blocks** T14.

**Context to load** — the plan's checkout notes; `src/lib/wp/graphql.ts` for house style;
`docs/headless-contract.md` for the product ids the client will send.

**Needs** — a WooCommerce REST key in `frontend/.env.local` (`WP_CONSUMER_KEY`,
`WP_CONSUMER_SECRET`), created in wp-admin under WooCommerce → Settings → Advanced → REST API →
Add key (read/write). If that is not available, first test whether the site's existing admin
application password authenticates against `/wp-json/wc/v3/orders` and record the outcome; do not
weaken the route to work around a missing credential.

**Do**

1. `src/app/api/checkout/route.ts`: validate the posted line items (ids are integers, quantities
   are positive and bounded), reject unknown or unbuyable variations, and build the order.
2. Create it with `POST /wp-json/wc/v3/orders` as `status: processing`, `payment_method: cod`,
   billing details and `line_items` carrying real `product_id` and `variation_id`.
3. Return only the order id and number.
4. `src/app/api/orders/[id]/route.ts` returning a trimmed summary — number, status, total, line
   items — so no order key and no customer data beyond the demo's own fields reach the browser.

**In scope** — `src/app/api/checkout/route.ts`, `src/app/api/orders/[id]/route.ts`, a server-only
REST client. **Out of scope** — payments, emails, stock changes, and the checkout page itself.

**Acceptance criteria** — posting a valid basket returns 200 with an order id, and the order exists
as `processing` with the right line items and a WooCommerce-computed total; posting a bad id or a
negative quantity returns 400 and creates nothing; no credential appears in any response.

**Verify** — `wpdev wp eval` with `wc_get_orders()` showing the new order as `processing` with the
expected lines and total; plus 400 cases for a nonsense product id and a negative quantity.

**Size** M

> verified: the credential probe came first and passed — Basic auth with `ADMIN_USER` and
> `WP_API_PASSWORD` from `vapestack/.env` against `/wp-json/wc/v3/orders?per_page=1` answered
> **200** with `[]`, so the site's existing admin application password authenticates the REST API
> and no key was created. `WP_CONSUMER_KEY` is that user and `WP_CONSUMER_SECRET` its application
> password, which is what `frontend/.env.local.example` now documents as an alternative to a key
> pair.
> Why that pair works and a consumer key would not, read from WC 11.1's
> `WC_REST_Authentication`: over plain HTTP `authenticate()` never runs
> `perform_basic_authentication()` — it is gated on `is_ssl()`, and that path only looks up rows in
> `wp_woocommerce_api_keys` — while core's `wp_authenticate_application_password` still
> authenticates the request, and `WP_ENVIRONMENT_TYPE=local` in `docker-compose.yml` makes
> application passwords available without SSL. A key/secret pair would have needed OAuth 1.0a
> signatures over HTTP.
> New: `src/lib/wp/rest.ts` (server-only; Basic auth from env, `cache: "no-store"`, throws
> `WooCommerceError` carrying the status), `src/app/api/checkout/route.ts`,
> `src/app/api/orders/[id]/route.ts`, and `CheckoutRequest`/`OrderSummary`/`OrderSummaryLine` in
> `src/lib/wp/types.ts`. Both routes carry `export const dynamic = "force-dynamic"` and show as `ƒ`
> in the build output.
> A valid basket posted to `:3001/api/checkout` answered `{"id":93,"number":"93"}` with 200, and
> `wc_get_orders()` shows order 93 as `processing`, `cod`, total **84.97** with
> "Aero Pod Kit x2 = 49.98" and "Pulse Pod Kit - Neon Lime x1 = 34.99" — priced by WooCommerce from
> ids alone, which is the point of sending no prices. `GET /api/orders/93` answered the trimmed
> summary `{"id":93,"number":"93","status":"processing","total":84.97,"items":[…]}`.
> Eleven rejection paths each answered **400** and created nothing (`wc_get_orders()` still held
> exactly that one order afterwards): a nonsense product id, negative, zero and over-cap
> quantities, the seeded sold-out variation 60/66, a variation belonging to a different product, a
> variable product with no option chosen, duplicate lines, an empty cart, an address that is not an
> email, and a body that is not JSON. An unknown order id answers **404** and a non-numeric one
> **400**. `grep` for `order_key`, `billing` and the credential in the response found none of them.

---

## T14 — Checkout page and success page — [x] done

**Goal** — A visitor can complete the mock checkout from the cart and land on a summary of the
order that was actually created.

**Depends on** T11, T13.

**Do**

1. `/checkout` with name, email, address and order note, required-field validation, and a loading
   state while the order is created.
2. On success, redirect to `/checkout/success/[id]` and empty the cart only then; on failure keep
   the cart and show what went wrong.
3. The success page renders the summary from the T13 order route, with a link back to the shop and
   a note that this is a demo order.
4. Disable the submit button while the request is in flight so a double click cannot create two
   orders.

**In scope** — `src/app/checkout/**`, the cart's clear action. **Out of scope** — real payment
fields, shipping options, taxes.

**Acceptance criteria** — a full checkout from the drawer creates exactly one order, the cart is
empty afterwards, the success page matches the order in wp-admin, and a failed request leaves the
cart intact.

**Verify** — Playwright screenshots of the form, the loading state and the success page; one order
placed end to end and shown in wp-admin; a `wc_get_orders()` count proving exactly one order was
created.

**Size** M

> verified: `/checkout` is a server shell with metadata around
> `src/components/checkout/checkout-form.tsx` ("use client"), `/checkout/success/[id]` is a server
> component on `force-dynamic` calling the same `getOrderSummary` the orders route returns, and the
> drawer's footer carries the Checkout link. `npm run build`, `npx tsc --noEmit` and `npm run lint`
> are all clean; the build lists `/checkout` as static and both API routes and the success page as
> `ƒ`.
> End to end from the drawer in the integrated browser: add Aero Pod Kit on the PDP → drawer →
> Checkout → fill → submit → `/checkout/success/94` in **886 ms**, stored cart left as
> `{"state":{"items":[]}}`, header reading `Cart, empty`, and order 94 `processing` in
> `wc_get_orders()` with the total WooCommerce computed. Screenshots at the requested sizes (each
> confirmed with `file`): drawer 1440x900, form 1440x900, 768x1024, 390x844, success 1440x900 and
> 390x844 — dark-neon layout intact, order summary card and address fields present, total in neon
> on the success page, no horizontal overflow.
> Failure path: with only the checkout call stubbed to answer 400, the form showed
> "Product 999999 is not in the catalogue." in its `role="alert"`, the button came back as
> `Place the demo order` and enabled, the URL stayed `/checkout`, and the cart still held its line;
> nothing was created.
> Double click: a second click while the button was disabled did nothing, and the two clicks
> produced exactly one order (`wc_get_orders()` count 5 → 6).
> The store now holds six orders, one per submit that reached WordPress and none for the two that
> were stubbed: 93 the T13 curl, 94-96 the browser runs, 97 leaked through the interception trap
> below, 98 the double-click test. Delete them from wp-admin if they become noise.
> Console during the runs: only the two known `next/font` preload warnings, no React or hydration
> warnings.
> Traps:
> 1. **Playwright route interception is broken here and dangerous.** `page.route('**/api/checkout')`
>    with a delayed `route.continue()` left the fetch pending forever — the page sat on "Placing the
>    order…" and never settled. A delayed `route.fulfill()` hung the client *and* still let the
>    request reach WordPress, so order 97 came from a run whose browser never received a response.
>    Use CDP `Network.emulateNetworkConditions` latency instead, as the runs above did.
> 2. **A resized viewport does not survive into a capture.** `await setViewportSize(...)` followed
>    immediately by `await screenshot(...)`, in that order, does produce the requested size
>    (390x900, 768x900, 1440x900, all checked with `file`); putting the screenshot first in a
>    `Promise.all` loses the race and yields the pane width. Element screenshots and scrolled
>    captures are unreliable: `locator.screenshot()` on the submit button returned 188x48 of pure
>    background, and neither `scrollIntoView` nor `scrollTo` survived to the shot — which is why
>    the loading state is evidenced by its DOM (button reading `Placing the order…` with
>    `disabled: true` and "Keep shopping" `aria-disabled` while a submit took 5044 ms under 2500 ms
>    of injected latency) rather than by a picture.
> 3. The hydrated-cart gate matters here as much as in the drawer: `skipHydration` means the first
>    client render has an empty cart, so the form waits on `useCartStore.persist.hasHydrated()`
>    through `useSyncExternalStore` (server snapshot `false`) rather than announcing an empty cart
>    to someone whose lines are about to appear. A `setState` in an effect is a lint error here,
>    which is why it is `useSyncExternalStore` and not `useEffect`.

---

## T15 — Repository preparation — [x] done

**Goal** — The whole project is a git repository whose first commit carries the project's own code
and none of its secrets.

**Depends on** T14. **Parallel with** none.

**Context to load** — the project root `.gitignore`, which is already written for this layout;
`vapestack/.env` (read only, to know which values must never be committed); `CLAUDE.md`;
`docs/SETUP.md` for how the site is run.

**Do**

1. `git init` inside `/home/adminpaws/Desktop/dev/vapestack` with `main` as the initial branch. No
   repository is created anywhere else — `frontend/` stays an ordinary directory inside it.
2. Add `.elementor-mcp-credential` to `.gitignore`. It is a literal Basic credential at the project
   root and is unignored today, while `.env` and `.mcp.json` already are.
3. Grep the working tree for the application password and that base64 credential, excluding `.git`,
   and resolve anything still holding one.
4. Review `git status --porcelain` in full before committing. The tree must carry `docs/`, `tools/`,
   `wp-content/themes/vapestack-theme/`, `frontend/src/`, `frontend/public/`, `docker-compose.yml`,
   `CLAUDE.md`, `.claude/`, `.vscode/mcp.json` and `.wpdev-project`, and must not carry `.env`,
   `.mcp.json`, `.elementor-mcp-credential`, `wp-content/uploads/`, `frontend/node_modules/`,
   `frontend/.next/` or any `.env.local`.
5. Add a short root `README.md`: what this is, how to run it locally (`wpdev up`, then the frontend
   dev server), how the deploy works, and the caveat that WordPress is reached through a tunnel that
   only lives while this machine is running. Replace `frontend/README.md`, which is still the
   `create-next-app` boilerplate and still says port 3000, with the storefront's own notes.
6. Commit.

**In scope** — `git init`, `.gitignore`, `README.md`. **Out of scope** — the GitHub remote, which
belongs to T18, and any change to application or WordPress code.

**Acceptance criteria** — `git status --porcelain` is empty after the commit; `git check-ignore -v`
names a rule for each of `.env`, `.mcp.json`, `.elementor-mcp-credential`, `frontend/.env.local`
and `wp-content/uploads/`; the tracked file list contains no secret and no dependency directory.

**Verify** — `git status --porcelain`; `git check-ignore -v .env .mcp.json
.elementor-mcp-credential frontend/.env.local wp-content/uploads/index.html`;
`git ls-files | grep -E '\.env|credential|node_modules|\.next/'`; `git log --stat -1`.

**Size** S

> verified: `git -C /home/adminpaws/Desktop/dev/vapestack init -b main`, identity `Reyvand Medrano
> <reyvand@icopylegal.com>` already configured globally. The scan for the credential values found
> the 24-character application password only in `.env` and `frontend/.env.local`, and the
> 40-character MCP credential only in `.elementor-mcp-credential` and `.mcp.json`; the second
> matched value was the generic word `password` used as prose across 11 files. `git check-ignore -v`
> named a rule for each of `.env` (`:2`), `.mcp.json` (`:3`), `.elementor-mcp-credential` (`:7`,
> added here), `frontend/.env.local` (`frontend/.gitignore:34`) and `wp-content/uploads/index.html`
> (`:13`). The pre-commit review listed 67 files - `docs/`, `tools/`, the theme, `frontend/src/`,
> `frontend/public/`, `docker-compose.yml`, `CLAUDE.md`, `.claude/`, `.vscode/mcp.json`,
> `.wpdev-project` - with `git status --porcelain -uall | grep -E '\\.env|credential|node_modules|\\.next/'` matching only
> `frontend/.env.local.example`, the intended exception. Commit `9a77cc2` holds 67 files and 13423
> insertions; `git grep -I -l -F` over the committed blobs found neither the application password
> nor the MCP credential; `git status --porcelain` is empty.
> Also done here because it is repository presentation, not app work: the root `README.md` (what
> this is, local run, deploy shape, the tunnel caveat) and `frontend/README.md`, which was still
> `create-next-app` boilerplate promising port 3000 when the app runs on 3001.

---

## T16 — Self-contained product images — [ ]

**Goal** — The nine seeded product images are served by the frontend itself, so the shop looks
complete when WordPress is unreachable.

**Depends on** T15.

**Context to load** — `src/lib/wp/publicUrl.ts` and its single call site `mapImage()` in
`src/lib/wp/catalog.ts`; the source files in `wp-content/uploads/2026/09/`; `frontend/next.config.ts`.

**Do**

1. Add `tools/copy-product-images.sh`, which copies the nine full-size `vapestack-*.png` from
   `wp-content/uploads/2026/09/` into `frontend/public/products/` and skips WordPress's generated
   `-<w>x<h>` variants (63 files exist there; nine are wanted). Run it.
2. Add `src/lib/wp/localImages.ts` holding the nine known basenames and a function that maps a
   WordPress upload URL onto `/products/<basename>` when the basename is one of them, stripping a
   `-<w>x<h>` suffix first, because WordPress may hand back a resized variant.
3. Use that before the origin rewrite in `publicUrl()`, leaving the existing `WP_INTERNAL_URL` →
   `WP_PUBLIC_URL` rewrite as the fallback for anything not in the list.
4. Leave `next.config.ts` as it is: `remotePatterns` and `dangerouslyAllowLocalIP` still cover the
   fallback path, and the deploy task does not have to touch them when the tunnel host changes.

**In scope** — the new script, the new module, `publicUrl.ts`, and the committed copies.
**Out of scope** — `catalog.ts` (no change needed), `next.config.ts`, and the WordPress seeder.

**Acceptance criteria** — `frontend/public/products/` holds exactly nine PNGs; the shop and the PDP
render every product and variation image from `/products/`; no image request leaves the app for
`localhost:8889`; `npm run build`, `npx tsc --noEmit` and `npm run lint` are clean.

**Verify** — `ls frontend/public/products`; the rendered `img` sources and their `naturalWidth`
through Playwright, plus `curl -o /dev/null -w '%{http_code}'` for one local copy; the three build
commands.

**Size** S

---

## T17 — Tunnel-proof catalogue and degraded checkout — [ ]

**Goal** — Nothing in the deployed app fetches WordPress at build time, and with the tunnel down the
catalogue still renders while checkout explains itself instead of failing.

**Depends on** T16.

**Context to load** — `src/lib/wp/graphql.ts` and `catalog.ts`; the four catalogue routes
`src/app/page.tsx`, `src/app/shop/page.tsx`, `src/app/shop/[category]/page.tsx`,
`src/app/product/[slug]/page.tsx`; `src/app/api/checkout/route.ts`;
`src/components/checkout/checkout-form.tsx`; `src/app/checkout/success/[id]/page.tsx`; the
`visual-testing` skill.

**Do**

1. Add `export const dynamic = "force-dynamic"` to the four catalogue routes and remove both
   `generateStaticParams` functions, which would otherwise be contradictory; keep both
   `generateMetadata` functions.
2. Give `wpQuery` a typed failure — an `UpstreamUnavailableError` thrown when the request cannot be
   made at all or answers 5xx — keeping it distinct from a GraphQL error and from a 4xx.
3. Add one shared component rendering the offline message and catch the typed error in the four
   catalogue routes, so a cold cache miss is that message rather than a 500. An unknown slug or
   range still goes through `notFound()` exactly as it does now.
4. In `/api/checkout`, answer 200 with `{ demo: true }` when WordPress is unreachable. Validation
   failures stay 400 and a WooCommerce refusal stays 502; nothing about the existing rejections
   changes.
5. In `checkout-form.tsx`, on a demo payload write the cart's own lines and subtotal to
   `sessionStorage` under one documented key, then route to `/checkout/success/demo`. The client
   already holds every line's name, options and price, so no server data is needed for this.
6. In `/checkout/success/[id]`, treat the literal id `demo` as that stored summary plus a demo-mode
   notice, and catch an unreachable backend on the real path instead of failing the page.

**In scope** — the four catalogue routes, `graphql.ts`, one new shared component,
`checkout-form.tsx`, the success route, and the new demo summary component. **Out of scope** — the
cart store, `catalog.ts`'s mapping, and the WordPress side.

**Acceptance criteria** — `npm run build` reports the four catalogue routes as dynamic and fetches
nothing from WordPress; with `WP_GRAPHQL_URL` pointed at a dead port, home, `/shop`, a range and a
product each render the offline message rather than erroring, and `/checkout` reaches
`/checkout/success/demo` with the cart's lines and subtotal; with WordPress reachable, every T7-T14
behaviour is unchanged and the console stays clean.

**Verify** — `npm run build`, `npx tsc --noEmit`, `npm run lint`; Playwright at 1440, 768 and 390
for the offline message; a checkout run with the REST URL pointed at a dead port; and one ordinary
end-to-end order to prove nothing regressed.

**Size** M

---

## T18 — Publish: tunnel, GitHub, Vercel, first deploy — [ ]

**Goal** — A public Vercel URL serves the storefront, with WordPress reached through a running
cloudflared quick tunnel.

**Depends on** T17, and on the user, who has to create the two accounts and complete both
interactive logins. **Needs** — a GitHub account, a Vercel account, and a terminal the user can
type into.

**Context to load** — `docs/SETUP.md`; `vapestack/.env` for the admin application password that
becomes `WP_CONSUMER_KEY`/`WP_CONSUMER_SECRET`; `docs/headless-contract.md` for the endpoints.

**Do**

1. Install cloudflared as a static binary into `~/.local/bin` — the release binary needs no root —
   and confirm `cloudflared --version`.
2. Add `tools/tunnel.sh`: start `cloudflared tunnel --url http://localhost:8889` if it is not
   running, read the `https://<random>.trycloudflare.com` host out of its output, print it, and
   update the Vercel project's environment for Production. Keep the process's log somewhere stable
   so the host can be recovered without restarting the tunnel.
3. Hand off to the user: create the GitHub repository and authenticate the CLI, then add the remote
   and push `main`. Never ask the user to paste a token here.
4. Hand off to the user: `npx vercel login`, then create the project with **Root Directory =
   `frontend`** and set `WP_GRAPHQL_URL` (the tunnel's `/graphql`), `WP_REST_URL` (the tunnel's
   `/wp-json/wc/v3`), `WP_INTERNAL_URL` (`http://localhost:8889`), `WP_PUBLIC_URL` (the tunnel
   origin) and `WP_CONSUMER_KEY`/`WP_CONSUMER_SECRET` for Production.
5. Deploy to production and record the URL.
6. With the tunnel up, warm every route once — home, `/shop`, the three ranges, the six products and
   `/checkout` — so the data cache holds the catalogue before the tunnel can disappear.

**In scope** — `tools/tunnel.sh` and the deploy configuration. **Out of scope** — a permanent
WordPress host, a custom domain, CI, and a named tunnel.

**Acceptance criteria** — the public URL answers 200 for home, `/shop`, a range and a product; the
pages are dynamic in the build output, so the deploy did not depend on WordPress being reachable;
`tools/tunnel.sh` re-points the environment and redeploys in one command.

**Verify** — `curl -sI` for the four routes; the Vercel build log; `tools/tunnel.sh` run twice to
show the host is picked up rather than hard-coded.

**Size** M

---

## T19 — Verify from the public URL — [ ]

**Goal** — The deployed storefront is proved, from the outside, to browse, to create a real order,
and to survive the tunnel going down.

**Depends on** T18.

**Context to load** — the `visual-testing` skill and the session's browser notes; T13's order
evidence; `docs/headless-contract.md` for the catalogue the screenshots should show.

**Do**

1. Screenshot the public URL at 1440x900, 768x1024 and 390x844, confirming each PNG's real size
   rather than trusting the tool's description, and check for horizontal overflow at each width.
2. Place one ordinary order from the public URL and confirm it exists as `processing` with the right
   line items and total through `wc_get_orders()`; record the order id.
3. Stop the tunnel, then reload home, `/shop`, a range, a product and `/checkout`: the catalogue must
   still render with its images from `/products/`, and checkout must reach the demo-mode success
   with its explanation. Screenshot both. If a route that step 6 of T18 warmed fails instead, add
   the snapshot fallback described in the Notes table above and record that decision here.
4. Tick T15-T19, add a `> verified:` line under each with the command and its observed result, and
   bring the Status table in step.

**In scope** — verification, the evidence lines, the Status table, and the snapshot fallback only if
step 3 shows it is needed. **Out of scope** — new features, restyling, and any WordPress change.

**Acceptance criteria** — three screenshots of the public URL with no overflow; one order placed
from it and read back through `wc_get_orders()`; a screenshot of the catalogue and of a demo-mode
checkout with the tunnel stopped; every task in this file either ticked with evidence or named as
still open.

**Verify** — the screenshots, `wpdev wp eval` with `wc_get_orders()`, and `git status` showing the
evidence committed.

**Size** M
