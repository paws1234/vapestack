# Product import — plan

A second catalogue, read from a public WooCommerce Store API, imported into the same WooCommerce
site as the seeded one and displayed by the same storefront. Written 2026-09-11; the tasks that
implement it are in `docs/import-tasks.md`, which carries the evidence.

## What this is

The site at `https://vapeobservation.com` exposes the standard public WooCommerce Store API at
`/wp-json/wc/store/v1/products`. Its `robots.txt` disallows only `wc-logs`, the WooCommerce upload
directories, `?add-to-cart=` URLs and `/wp-admin/`; the JSON API and the product pages themselves
are crawlable, so reading it read-only, politely and without authentication is allowed.

**What is taken: facts, and one photograph per product.** Names, the specification attributes the site
publishes — battery capacity, puff count, liquid capacity, coil type, nicotine strength — and the
product image itself. **What is not taken:** its product copy, which is prose. Product names, brands
and specifications are facts about a device; a shop's description is not, and its photography is its
own work rather than a fact about the device.

## What the source does not have

Three facts drive the whole design, all measured on 2026-09-11:

1. **No prices.** A hundred products sampled came back with `prices.price: "0"`,
   `regular_price: "0"`, `is_purchasable: false` and an "Add to cart" button reading *Read more*. It
   is a specification catalogue, not a priced shop. A storefront cannot work without prices: the
   cart, the checkout, the sort control and the reward ladder all read one, and the headless
   contract freezes a price range per product. So prices are **generated**, deterministically.
2. **No SKUs.** `sku` is an empty string. Idempotency therefore cannot key on SKU the way the
   seeder does; it keys on the **source product id**, which also gives the local SKU, the product
   meta and the image filename.
3. **Specifications are structured**, arriving as non-taxonomy attributes
   (`{name: "Battery", terms: [{name: "1300 mAh"}]}`), and are the only part of the page worth
   keeping.

## Decisions

Taken with the owner before any code was written.

| # | Question | Decision |
| --- | --- | --- |
| D1 | Prices, when the source has none | **Generated**, deterministically per source id inside a per-category band. Same id, same price, every run — so `reset` produces the same shop and screenshots stay comparable. |
| D2 | Copy and images | **Specs as data, our copy.** No verbatim prose. The photographs are copied into the media library and credited — see the revision below. |
| D3 | Scale, and what happens to the seeded catalogue | **~12 products, seeded six stay.** Both catalogues coexist, so every existing screenshot and doc stays true. **Superseded the same day — see the second revision.** |
| D4 | Categories | **The source's own slugs.** The storefront derives its ranges from the products, so the new ranges appear by themselves. |
| D5 | Are the specs visible on the product page | **Yes, as a read-only list** — not as the option pills a variable product gets. |

## Revision, same day: the photographs are imported after all

D2 originally read *our own art*: generated gradient placeholders, nothing copied. The owner asked
for real product photography instead, so the import was changed to copy each product's image into
the media library. What that changes, and what it does not:

- **The trade is bounded by four rules.** One image per product; copied into *this* site's uploads
  rather than hot-linked, so the shop serves its own file; credited on the product page next to the
  specifications; and **not committed to the storefront or to this repository**, which is public.
- **Hot-linking was ruled out** rather than merely dispreferred. `next.config.ts` only allows this
  site's own origin, and the deployed demo is supposed to survive the other shop being unreachable —
  an external URL would 400 in the optimiser or vanish when they rename a file.
- **A failed copy is not a failed import.** The generated gradient stays in the importer as the
  fallback, so an import with the network down still produces a complete catalogue.
- **The container had to learn to contain.** Ten of the eleven photographs are square and fitted the
  square tile exactly; the eleventh is 300x404, and `object-cover` was throwing away 26% of it. The
  card, the product page and the cart line now use `object-contain`, recorded in `UI-STANDARDS.md`.

## Second revision, same day: the catalogue is entirely imported

D3 said the seeded six would stay. The owner then asked for real photography on every product, and
since those six are fictional there is no photograph of them to have — only photographs of *other,
real* devices, which would put a made-up name on somebody else's product. So they were removed and
replaced by six more imported products, three pod cartridges and three box mods, and the shop is now
**17 imported products and nothing else**.

What that costs, stated plainly:

- **The variation demo is gone.** Option selectors, per-combination stock and the struck-through
  sold-out state have no product left to run on. `tools/seed-products.php` stays in the repository and
  recreates all of it — six products, 20 variations, images included — so it is a command away, but it
  is not what the shop sells.
- **Nothing is committed for images any more.** `localImages.ts`, `copy-product-images.sh` and the
  twelve committed PNGs existed only to serve the seeded art offline. With the seeded catalogue gone
  they mapped nothing, so they went too. The deployed demo now needs WordPress reachable to show
  photographs — it still lists and prices the catalogue from its cache with the tunnel down, but the
  images are blank.
- **Everything else got simpler.** One product shape (simple), one image source (the media library),
  one way in (the import).

## Architecture: two stages, split at a file

```
fetch (host, Node, network)  ->  reviewed JSON fixture  ->  import (PHP, WP-CLI, database)
```

- `tools/fetch-source-products.mjs` reads the API and writes
  `wp-content/themes/vapestack-theme/tools/data/source-products.json`.
- `wp eval-file wp-content/themes/vapestack-theme/tools/import-source-products.php` reads that
  fixture and creates the products.

The fixture in between is the point. It is committed, so a person reviews what is about to enter the
shop; it is the reproducibility story, so the import runs with no network and survives the source
changing or disappearing; and it is a hard boundary — the fetch stage cannot leak prose into the
catalogue because it never asks for the fields that hold it.

The fixture has to live inside the theme directory: only `wp-content/themes/vapestack-theme`,
`wp-content/uploads` and the kit's plugin are mounted into the container, so a file anywhere else is
invisible to `wp eval-file`.

## Constraints

- **Never `wp-kit/`.** Shared infrastructure across every project on this machine; a project does
  not get to edit it to get what it needs.
- **No new dependencies.** Node 22's `fetch` and WooCommerce's own CRUD API are enough.
- **Deterministic.** No `rand()`, no `time()`: the price and the stock come from the source id, so a
  re-run and a screenshot are both reproducible.
- **Untrusted input.** The fixture arrives from the internet. Even though a person has read it,
  everything is sanitised on the way into WordPress.
- **The demo's honesty rules still hold.** Nothing on the page may be untrue: the description says
  the listing is a demo, the price is generated and the source is credited.

## Out of scope

- Variable products and variations. The source lists its products as simple, and inventing option
  combinations would be inventing data.
- The source's real prices, which do not exist, and its prose, which is not ours.
- Re-hosting the photographs anywhere other than this site's own media library, or committing them
  to the repository.
- Brand and tag taxonomies, scheduled re-imports, and any admin UI — a CLI tool is this project's
  convention, and a settings screen nobody asked for is the thing the WordPress standards here
  exist to prevent.

## Risks

| Risk | Answer |
| --- | --- |
| The source's API changes or goes away | The committed fixture is what the import reads. The fetch is re-runnable, never part of a build or a deploy. |
| Range proliferation: five ranges in a three-up grid | Accepted with D4. The fetcher caps itself at three categories, and each pick is brand-spread rather than five products from one maker. |
| The demo looks like it is selling someone else's stock | The description says what it is, the credit names the source and covers the photograph as well as the specs, the price is obviously demo-priced and the shop already takes no payment. |
| A copy of somebody else's photograph ends up in a public repository | The import copies images into the WordPress media library only, and nothing image-related is committed to the storefront any more — the local image map and the committed copies were removed with the seeded catalogue. |
| Generated prices read as real prices | They are inside a plausible band per category and the product page states plainly that they are generated. |
