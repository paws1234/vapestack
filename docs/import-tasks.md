# Tasks: Vapestack — importing a second catalogue

From `docs/import-plan.md`, written 2026-09-11. The plan is the source and is **never edited**; the
checklist and the evidence live here.

Every task was done in one session; the `> verified:` lines carry the command and the numbers rather
than a claim.

| # | Task | Size | Depends on |
| --- | --- | --- | --- |
| T1 | Fetch stage: the source fetcher and the reviewed fixture | M | — |
| T2 | Import stage: the PHP importer, attributes, images, `reset` | L | T1 |
| T3 | Frontend data layer: the `specs` field | S | — |
| T4 | Product page: the read-only specification list | S | T3 |
| T5 | Photography: copied into the media library, and shown whole | M | T2 |
| T6 | Copy corrections the second catalogue makes stale | S | — |
| T7 | Verification sweep | M | T2, T4, T5 |
| T8 | The record: README, contract, memory | S | T7 |
| T9 | The seeded images are unique per product too | M | T2 |
| T10 | The catalogue is entirely imported; the seeded six retire | M | T9 |
| T11 | The catalogue grows to a shop-sized list per range | M | T10 |
| T12 | Four more ranges, a wider spec list, and a header that has to hold nine of them | M | T11 |

**Parallelism.** T3 and T6 can run alongside T1/T2. T4 needs T3. T5 and T7 need T2. T9 touches
`seed-products.php` and the storefront's committed images, so it runs after T5.

## T1 — Fetch stage

**What it does.** Adds `tools/fetch-source-products.mjs`: reads three categories from the public
Store API (one request each, at least 1.5s apart, with an identifying User-Agent, cached under
`tools/.cache/`), keeps only products that are simple and carry specs, takes five per category with
a brand round-robin, and writes the fixture the importer reads.

**May touch.** `tools/fetch-source-products.mjs` (new),
`wp-content/themes/vapestack-theme/tools/data/source-products.json` (new), `.gitignore`.

**What proves it.**

> verified: `node tools/fetch-source-products.mjs --force` ran after the first attempt, which had
> produced 9 products clustered by brand (four `Adjust…`, four `ADVKEN…`). The name-sorted listing
> arrives in brand blocks, so `spreadByBrand()` was added and the limit raised to 5 per category.

> verified: the fixture holds **11** entries across **3** categories, `disposable-vape` 5,
> `vape-kit` 5, `e-liquids` 1 (`10 skipped, 11 listed` — the only e-liquid with specs).
> `python3` assertions: 11 unique source ids, **0** entries with no specs, every `source_url` on the
> source origin, every band ascending, **11** entries carrying an image URL, all of them under
> `https://vapeobservation.com/wp-content/uploads/`, and **no** asset URL in any field but `image`.

> verified: the fetcher refuses to overwrite the fixture without `--force`, and the fixture records
> no prose because `description` and `short_description` are never requested.

## T2 — Import stage

**What it does.** Adds `import-source-products.php`, mirroring `seed-products.php`'s shape: a
WP-CLI guard, one final class, `reset` as a bare word, `WP_CLI::log` per product and a
created/skipped summary. Creates the source categories, one simple product per entry with SKU
`VO-<source id>`, meta `_vapestack_source_id` / `_vapestack_source_url`, a deterministic price and
stock, the specs as **custom** product attributes, and an image: the product's photograph copied into
the media library, or generated art when there is none to copy.

**May touch.** `wp-content/themes/vapestack-theme/tools/import-source-products.php` (new).

**What proves it.**

> verified: `php -l` clean; first run `11 created, 0 skipped`; the second run `0 created, 11
> skipped` — idempotent on SKU derived from the source id, which is necessary because the source's
> own `sku` is an empty string.

> verified: `reset` deleted exactly the 11 imported posts and recreated them, and the seeded six
> were unaffected: `wc_get_products()` without a `_vapestack_source_id` still reports
> `VS-DSP-6000 12.99 6 var`, `VS-DSP-3000 9.99 4 var`, `VS-ELQ-BERRY 12.99 6 var`,
> `VS-ELQ-TOBACCO 13.99 1 var`, `VS-POD-PULSE 34.99 3 var`, `VS-POD-AERO 24.99 0 var`, all
> `instock`.

> verified: prices land inside their band and end in `.99` — disposables `9.99, 13.99, 10.99,
> 10.99, 13.99` (band 9.99–14.99), the e-liquid `15.99` (12.99–19.99), kits `26.99, 24.99, 24.99,
> 32.99, 31.99` (24.99–39.99). The first attempt derived `dollars - 0.01` and produced `8.99` for a
> band that starts at `999`; the fix is `dollars + 0.99`, because the band's own bounds are
> 9.99-style prices.

> verified: a product's specs are real WooCommerce attributes, not text in the description — the
> GraphQL probe returns six nodes for `adalya-myvo-30k` with `label`/`options`, and the seeded
> `product-detail.tsx` selector branch is untouched because they are `variation: false`.

## T3 — Frontend data layer

**What it does.** Aliases the custom attributes into a new `specs` field on `Product`, kept
separate from `attributes`, which is what the variation selectors and their price notice are built
from.

**May touch.** `frontend/src/lib/wp/queries.ts`, `types.ts`, `catalog.ts`.

**What proves it.**

> verified: the first attempt put backticks inside the GraphQL document's template literal and
> `npx tsc --noEmit` failed with `TS1005: ',' expected` at `queries.ts(46,16)` — the trap the file's
> own header documents. Backticks removed; `tsc` and `eslint` both clean.

> verified: a GraphQL probe of `adalya-myvo-30k` answers
> `{ name: "battery", label: "Battery", options: ["1300 mAh"] }` — for a custom attribute `options`
> are the values themselves, where a global attribute's are term slugs.

## T4 — Product page

**What it does.** Renders the specs as a `<dl>` inside `ProductNotes`, under a "Specifications"
`h2`, only when the product has any. Imported products deliberately get **no short description**, so
they show one specification list instead of the same values twice.

**May touch.** `frontend/src/components/product/product-notes.tsx`.

**What proves it.**

> verified: measured in a real Chromium at 1440x900 — the imported product page exposes
> `h2 = [Specifications, Shipping and payment, More from Disposable Vape, …]` with **6** `dt` rows
> labelled `Device Type, Puffs, Battery, Capacity, Coil Type, Nicotine`; the seeded
> `neon-rush-6000` page reports **0** spec rows and keeps `Details`.

## T5 — Photography: copied into the media library, and shown whole

**What it does.** Copies each product's photograph into the media library with
`media_sideload_image()` — one per product, keyed on the source URL so it is never copied twice,
carrying `_vapestack_source_id` so `reset` deletes it, and carrying `_vapestack_source_image` as the
record of where it came from. Keeps the generated gradient as the fallback for a product with no
photograph and for one that cannot be fetched. Then renders images uncropped, which the mixed aspect
ratios make necessary.

**May touch.** `wp-content/themes/vapestack-theme/tools/import-source-products.php`,
`frontend/src/components/product/product-card.tsx`, `product-detail.tsx`,
`frontend/src/components/cart/cart-line.tsx`, `frontend/UI-STANDARDS.md`.

**What proves it.**

> verified: the import created **11** attachments, all under `2026/09/`, with the correct alt text
> from the product name and `_vapestack_source_image` recording the source path — e.g. `#175
> pm-adalya-1787316859.jpg alt="Adalya Myvo 30K" from=/wp-content/uploads/2026/08/
> pm-adalya-1787316859.jpg`. GraphQL then answers
> `http://localhost:8889/wp-content/uploads/2026/09/pm-adalya-1787316859.jpg`, i.e. this site's own
> copy rather than the other shop's URL.

> verified: `reset` deleted **11 attachments** along with the 11 products and rebuilt both, and a
> further run without `reset` reported `0 created, 11 skipped` with the attachment count still at
> **21** — no duplicates, and nothing left behind in the media library.

> verified: the URL is validated before it is fetched (https, the source's own host, under
> `/wp-content/uploads/`), so a tampered fixture cannot point the server at itself or anywhere else.

> verified: the frontend served the **stale** catalogue after the re-import — image URLs still
> naming the deleted `vapestack-src-*.png` — because of the 300s data cache. Stopping the dev server,
> `rm -rf .next` and restarting was what cleared it; the shop then referenced the 11 WordPress
> uploads.

> verified: with `object-contain`, the one non-square photograph (`aspire-aspire-bp-stik-2500-mah-
> main.webp`, 300x404) renders whole in its 347x347 tile, where `object-cover` was discarding 26% of
> its long edge. Measured across the 17 product images: sixteen are square and lose nothing, one is
> 0.74. The cart drawer renders the same photograph at 78x78. The seeder's gradients are exactly
> 1200x1200, so the seeded catalogue is unchanged.

> verified: `tsc` and `lint` clean after the change; screenshots refreshed at 1440/768/390.

## T6 — Copy corrections

**What it does.** Corrects the statements the second catalogue makes untrue: the OpenGraph card's
"in three ranges", the checkout route's "the catalogue has six products" comment, and the README's
"six products with 20 variations" — plus `UI-STANDARDS.md`, which now records the uncropped-image
rule and the measurement behind it.

**May touch.** `frontend/src/app/opengraph-image.tsx`, `frontend/src/app/api/checkout/route.ts`,
`frontend/UI-STANDARDS.md`, `README.md`.

**What proves it.**

> verified: the shop now renders `17 products` across **5** ranges — `Disposables, E-Liquids, Pod
> Kits, Disposable Vape, Vape Kit` — all data-driven from the products, so the new ranges reached
> the navigation, the chips and the home page with no code change. `MAX_LINES = 20` is lines per
> order, not catalogue size, so the value stays and only the comment changed.

## T7 — Verification sweep

**What proves it.**

> verified: `npm run build` clean from a wiped `.next` (Next 16.3.4, 17 routes),
> `npx tsc --noEmit` clean, `npm run lint` clean.

> verified: against the production server on `:3000` — `/` 200, `/shop` 200,
> `/shop/disposable-vape` 200, `/shop/vape-kit` 200, `/shop/e-liquids` 200,
> `/product/adalya-myvo-30k` 200, `/product/bd-vape-blaster-starter-kit` 200,
> `/product/does-not-exist` **404**, `/shop/does-not-exist` **404**, `/sitemap.xml` 200 and
> listing `adalya-myvo-30k`, `aspire-bp-stik-pod-kit`, `disposable-vape`, `vape-kit`.

> verified: cart and checkout on an imported product. `POST /api/checkout` with
> `productId: 156` (SKU `VO-33225`) × 2 answered `{"id":167,"number":"167"}`, and WooCommerce
> holds it as `processing`, total **19.98 USD**, line `Adalya Myvo 30K x2 @ 19.98`. Orders went
> from 19 to 20.

> verified: `wpdev smoke` — **10/10 checks passed**.

> verified: screenshots at 1440x900, 768x1024 and 390x844 of the imported product page, the seeded
> product page, `/shop` and `/`, taken with the Playwright package and its own Chromium so
> `window.innerWidth` reads the width actually requested (1440/768/390 confirmed in the same
> `evaluate`). Files under `/tmp/ui/import/`.

> **Not verified, and not caused by this work:** at exactly 768px every page reports 61px of
> horizontal overflow (`scrollWidth 829`, `clientWidth 768`). The offending element is the
> always-mounted **cart drawer** (`absolute inset-y-0 right-0 … max-w-md`, moved out of the way with
> `translate-x-full`), and it appears identically on `/` and on the untouched seeded product page.
> Overflow is 0 at 1440 and at 390. This is a pre-existing layout bug, left alone here and worth a
> task of its own.

## T8 — The record

**What proves it.**

> verified: `docs/headless-contract.md` gained rule 12 and an *Imported catalogue* section with the
> 11 SKUs, the custom-attribute shape, and the note that the two new ranges are derived rather than
> registered; `README.md` gained the two commands and the corrected catalogue description;
> `tools/copy-product-images.sh` and `localImages.ts` no longer claim the seeder is the only source
> of images.

## T9 — The seeded images are unique per product too

**What it does.** Keys each generated image on the product **and** its option, so no file can serve

two products, and derives each accent hue from the product's position in the catalogue and the
option's position inside it. Driven by the owner's "make sure all products have a unique image".

**May touch.** `wp-content/themes/vapestack-theme/tools/seed-products.php`,
`frontend/src/lib/wp/localImages.ts`, `frontend/public/products/`, `tools/copy-product-images.sh`.

**What proves it.**

> verified: the audit came first, and it said most of the catalogue was already right — **17/17**
> products had an image, all 17 URLs answered 200, and no two *products* shared a file. The real
> gap was one level down: `vapestack-blue-razz-ice.png` served both Neon Rush 6000's card and
> Midnight Berry E-Liquid's Blue Razz Ice options, and `frost-mint` and `arctic-white` were shared
> the same way.

> verified: hashing the key into 360° failed on measurement rather than on inspection. Reading the
> accent pixel out of each generated PNG with PIL, the closest pair was **3 RGB units** apart — two
> products showing what looks like the same picture. Of eleven hash variants tried, the best left a
> **10°** hue gap, which is two of Neon Rush's own flavours.

> verified: **the trap that cost the detour.** The positional rewrite produced hues belonging to the
> wrong product: Neon Rush's second and third flavours came out in Frost Rush's band, and Pulse Pod
> Kit's in Neon Rush's. The variation loop already read `foreach ( $spec['attributes'] as $index =>
> $attribute_slug )`, so the new parameter of the same name was **shadowed** and, after that loop,
> `$index` was the last *attribute* index — 1 for a two-attribute product, 0 for a one-attribute one,
> which is exactly the pattern in the measurements. The parameter is now `$catalogue_index` and the
> loop keeps `$attribute_index`.

> verified: **the stale-file trap.** Deleting the old generated attachments matched nothing at first,
> because `_wp_attached_file` is `2026/09/vapestack-<key>.png` and the pattern was anchored at
> `^vapestack-`. The seeded files were therefore never removed, `ensure_image()` found them by URL and
> returned early, and the "new" images were the old ones — the colour change silently did not happen.
> Caught by re-measuring the accents, not by looking at the import log.

> verified: after re-seeding, the twelve generated files are at least **72 RGB units** apart
> (closest pairs 72.0–73.0), and the catalogue reports **0** items — parents and variations together
> — without an image and **0** files used by more than one product, across **23** distinct files
> (12 seeded gradients + 11 imported photographs).

> verified: rendered, not just present. Driving a real browser over `/shop`, all **17** cards had a
> decoded image (`complete && naturalWidth > 0`) and every card named its own file. `tsc` and `lint`
> clean after the `localImages.ts` allowlist moved to the twelve new keys.

## T10 — The catalogue is entirely imported; the seeded six retire

**What it does.** Adds two source ranges to the fetcher — three pod cartridges and three box mods, at
a per-category limit — imports those six, deletes the six fictional seeded products and their 20
variations, and removes the local-image mechanism and its twelve committed PNGs with them. This
supersedes **D3** in the plan, and it is the owner's answer to "give the six seeded products real
photographs": those six are invented, so the only available photographs belong to other, real
devices.

**May touch.** `tools/fetch-source-products.mjs`, `wp-content/themes/vapestack-theme/tools/data/`,
`frontend/src/lib/wp/publicUrl.ts`, `frontend/public/products/`, `tools/copy-product-images.sh`,
`README.md`, `frontend/README.md`, `docs/headless-contract.md`, `frontend/UI-STANDARDS.md`.

**What proves it.**

> verified: the fixture grew from 11 to **17** entries with **the existing eleven keeping their source
> ids** — the two new categories carry their own `limit: 3`, so the fetcher's brand round-robin could
> not quietly reshuffle the products already in the shop. Checked by set comparison against a copy of
> the previous fixture: `added: [25220, 30273, 30316, 31529, 31563, 33047]`, `dropped: none`.

> verified: the first fetch was refused by the fixture's own guard — `Fixture entry 30316 carries an
> asset URL outside its image`. A **false positive**: the pattern looked for a dot followed by three
> or four alphanumerics, which reads `3.0mL` and `0.4Ω` as file extensions. Narrowed to real image
> extensions, which is the invariant it was really there for.

> verified: import without `reset` → **`6 created, 11 skipped`**, the six new products at
> `$6.99–$47.99` (`VO-30316`, `VO-31529`, `VO-25220`, `VO-33047`, `VO-31563`, `VO-30273`).

> verified: the seeded six deleted — `VS-DSP-6000`, `VS-DSP-3000`, `VS-ELQ-BERRY`, `VS-ELQ-TOBACCO`,
> `VS-POD-PULSE`, `VS-POD-AERO` — along with their twelve generated images. The catalogue then reads:
> **17 products, 0 not imported, 0 without an image, 0 variations, 17 distinct image files, 0 shared,
> 0 problems**, and all 17 image URLs answer 200.

> verified: `localImages.ts`, `copy-product-images.sh` and `frontend/public/products/` are gone,
> `publicUrl.ts` no longer short-circuits to a local file, and `tsc` and `lint` are clean. The seeder
> stays in the repository, documented as the retired demo catalogue and the only thing that exercises
> the variation half of the contract.

## T11 — The catalogue grows to a shop-sized list per range

**What it does.** Raises the fetcher's per-category limits to 40 so each range holds a real listing
rather than a sample (E-Liquids is the exception: its source publishes eleven products and only one
with a specification), re-imports, and paginates the frontend's catalogue read, because a GraphQL
connection does not answer more than 100 nodes however large `first` is. Driven by the owner's
"add more products, at least 20-50 on each option".

**May touch.** `tools/fetch-source-products.mjs`,
`wp-content/themes/vapestack-theme/tools/data/source-products.json`,
`frontend/src/lib/wp/queries.ts`, `frontend/src/lib/wp/catalog.ts`, `docs/headless-contract.md`,
`README.md`.

**What proves it.**

> verified: the fixture went from **17 to 161** entries — `disposable-vape` 40, `vape-kit` 40,
> `pod-cartridge` 40, `vape-mod` 40, `e-liquids` 1 — with **`dropped: none`** against a copy of the
> previous fixture: every product already in the shop kept its source id, and with it its SKU, its
> generated price and the photograph already in the media library. The four new limits are 40 rather
> than "as many as possible" because `spreadByBrand()` only ever appends when a limit rises.

> verified: the fetcher reads all five categories **from its cache** (no network), and reports
> `40 kept, 1 skipped, 100 listed` for disposables, `40 kept, 0 skipped` for kits, `40 kept, 14
> skipped` for pod cartridges, `40 kept, 13 skipped` for mods and `1 kept, 10 skipped, 11 listed` for
> e-liquids. 161 entries, every one with specs, one image URL each, all on `vapeobservation.com`.

> verified: import without `reset` → **`144 created, 17 skipped`, 0 warnings**, so no photograph fell
> back to generated art. An audit script (`wp eval-file`) then read: **161 published products, 161
> imported, 0 not imported, 0 without an image, 161 distinct image files, 0 shared, 0 variations**,
> and the media library holds 162 attachments — the 161 photographs plus WooCommerce's own
> `woocommerce-placeholder.webp`, which no product uses. All **161** image URLs answer 200 from the
> host (141 jpg, 18 webp, 2 png).

> verified: **the frontend read was capped and had to be paginated.** The catalogue query asked for
> `first: 50`; with 161 products that meant 111 product pages would have 404'd, because
> `getProductBySlug()` resolves from the catalogue. Probed the endpoint directly: `first: 200`
> **does not error, it answers 100**, so the read now follows `pageInfo.endCursor` — `100 + 61 = 161`
> nodes, **0** overlap between the pages, `hasNextPage` false at the end. Recorded as rule 13 in
> `docs/headless-contract.md`. `catalog.ts` needed an explicit type annotation on the page result:
> `tsc` reported `TS7022: 'page' implicitly has type 'any' because it does not have a type
> annotation and is referenced directly or indirectly in its own initializer` once the cursor it is
> asked for came from the previous page.

> verified: `npm run build` clean from a wiped `.next` (Next 16.3.4, 17 routes), `npx tsc --noEmit`
> clean, `npm run lint` clean; served with `next start -p 3001`.

> verified: measured in a real Chromium at three widths — `/shop` reports **161 cards, 161 images, 0
> broken, 1 `h1`**, and **overflow 0** at 1440 and 390 and 45 at 768. The 768px overflow is the
> **pre-existing** header/cart-drawer bug and not this work's: `/about`, which reads no catalogue at
> all, measures the identical 45px, with the same two offenders (the header's `flex items-center
> gap-3` group ending at x=813, and the always-mounted cart drawer at 768..1216).
>
> verified: the per-range counts render as **40 / 40 / 40 / 40 / 1** at `/shop/disposable-vape`,
> `/shop/vape-kit`, `/shop/pod-cartridge`, `/shop/vape-mod` and `/shop/e-liquids`, `/sitemap.xml`
> lists **173** urls (161 products plus 12 routes), and scrolling the whole 28,199px shop decoded
> **161 of 161** images with **0** broken.
>
> verified: screenshots at `/tmp/ui/grow/` — `{shop}-{1440,768,390}.png`, `shop-scrolled-1440.png`,
> `vape-kit-1440.png` — with `file` confirming 1440x900, 768x1024 and 390x844.

> **Not addressed, pre-existing:** the 768px overflow above, and the fact that E-Liquids holds one
> product because that is all its source publishes. Both are recorded rather than papered over.

## T12 — Four more ranges, a wider spec list, and a header that has to hold nine of them

**What it does.** Adds the source's remaining hardware ranges — `vape-tanks`, `vape-coils`,
`vape-accessories` and `nicotine-pouches` — at 40 products each where the source has them, taking the
catalogue to **290 products across nine ranges**. Then repairs the two things that made those ranges
second-rate: the spec whitelist, which was throwing away the fact a coil *is* (`Coil Resistance` is a
different label on the source from `Resistance`), and the header, which cannot hold ten nav links
below 1280px. Driven by the owner's "add those different products".

**May touch.** `tools/fetch-source-products.mjs`,
`wp-content/themes/vapestack-theme/tools/data/source-products.json`,
`frontend/src/components/layout/{header,nav-links,mobile-nav,mobile-nav-button}.tsx`,
`docs/headless-contract.md`, `README.md`, `frontend/UI-STANDARDS.md`.

**What proves it.**

> verified: the new ranges landed at **40 kept, 8 skipped** (tanks), **40/21** (coils), **40/0**
> (accessories) and **9/3** (pouches, which the source only has twelve of). The fixture went from
> **161 to 290** entries with **`dropped: none`**: every product already in the shop kept its source
> id.

> verified: **the whitelist was dropping real facts, and the measurement is what showed it.** 79 of
> the first 129 new entries carried a **single** spec, and for coils and pouches that spec was
> `Device Type = Coil` / `= Nicotine Pouches` — the range restated as a fact. Across all nine cached
> categories the five labels added (`Coil Resistance`, `Wattage`, `Material`, `Dimensions`, `Weight`)
> account for **401** distinct values (`0.1-3.0ohm`, `5-100W`, `97.6mm by 38mm by 30mm`). A stricter
> rule was written and **rejected on its own numbers**: dropping values that start lowercase would
> have removed real ones (`built-in 2500mAh battery`, `about 4-5mL`), so the remaining
> **15 of 401 (3.7%)** prose fragments are tolerated, as the longer-standing labels already do.

> verified: the wider rule changed **90 of the 161** products already in the shop, so a fixture that
> described them and a database that did not would have been a lie. The 90 were deleted by a
> throwaway script that compared each product's attributes with the fixture, **leaving their
> attachments in the media library** — `image_for()` finds a photograph by `_vapestack_source_image`,
> so the comparison before and after shows **162 attachments before, 291 after** (290 photographs
> plus WooCommerce's owner placeholder) and no duplicates: the 90 were rebuilt with **no
> re-download**.

> verified: `219 created, 71 skipped`, **0 warnings**, 150s. Audit: **290 published, 290 imported,
> 0 without an image, 290 distinct image files, 0 shared, 869 spec rows**, all nine ranges at
> 40/40/40/40/40/40/40/9/1. Every one of the **290** image URLs answers 200 from the host
> (267 jpg, 20 webp, 3 png).

> verified: **the fixture and the database now agree exactly** — comparing every imported product's
> attributes with its fixture entry: **290 ids, 0 differences**.

> verified: the rendered pages carry the new facts — `advken-dc-series-coil` shows
> `Device Type=Coil | Coil Resistance=0.2Ω`, `advken-artha-gen-2-rda-atomizer` shows
> `Device Type=RDA | Capacity=1.5mL | Material=304 Stainless steel&Resin | Dimensions=20 * 32.9mm`.

> verified: a product from a new range is **buyable**: `POST /api/checkout` for
> `productId: 811` (SKU `VO-30348`, ADVKEN DC Series Coil) × 2 answered
> `{"id":1042,"number":"1042"}`, and WooCommerce holds it as `processing`, **29.98 USD**
> (`ADVKEN DC Series Coil x2 @ 29.98`), i.e. 14.99 each inside the 899–1999 band the fixture gives
> that range. Orders went 20 → 21.

> verified: **the header had to move.** With ten nav links (Shop plus nine ranges) measured in a real
> Chromium: the nav needs **703px**, and beside the wordmark and the controls that overflows by
> **353px at 768** and **97px at 1024**, fitting from 1280. `NavLinks` is now `xl:flex` and the menu
> panel is `xl:hidden` with its resize guard moved to `(min-width: 1280px)`. Overflow after the
> change: **0** at 390, 768, 1024, 1280, 1440 and 1600 — which also clears the **45px** that the old
> five-range header leaked at exactly 768 (T11's note above).

> verified: **a documented a11y behaviour had been lost and is now restored.** `docs/ui-ux-tasks.md`
> records that T1 moved the header's inline nav into `NavLinks` so the current range carries
> `aria-current="page"`; the header on disk had an inline copy again, with no `aria-current` and no
> active colour. `Header` renders `NavLinks` once more, and the shop page shows "Shop" in `neon-400`
> with the attribute while the other nine do not.

> verified: `npm run build` clean from a wiped `.next`, `npx tsc --noEmit` clean, `npm run lint`
> clean; `/shop` serves **290 cards, 290 images, 1 h1, 10 chips** and `/shop/vape-coils` 40, at 1440,
> 768 and 390. Scrolling the whole 50,279px shop decoded **290 of 290** images, 0 broken. The menu
> panel at 1024 lists all nine ranges plus Shop and "Shop all". Screenshots in `/tmp/ui/grow/`:
> `shop-{1440,768,390}.png`, `vape-coils-1440.png`, `menu-1024.png`.

> **Not addressed:** the E-Liquids range still holds one product and Nicotine Pouches nine — that is
> the source's inventory, not a limit chosen here. And some spec values are the source's own prose
> fragments (15 of 401 measured above); they are left as published rather than filtered by a rule
> that would also discard good values.
