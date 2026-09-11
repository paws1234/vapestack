# Headless contract

What the frontend may rely on from `http://localhost:8889/graphql`, and how it was proved.

Verified on 2026-09-11 against WordPress, WooCommerce 11.1.0, WPGraphQL 2.22.3 and GraphQL for
eCommerce (the plugin in `wp-graphql-woocommerce/`) 1.0.3.

The catalogue is **161 imported products**, every one of them simple, created by
`wp-content/themes/vapestack-theme/tools/import-source-products.php` from the reviewed fixture in
`tools/data/source-products.json`. Nothing is seeded any more: `tools/seed-products.php` is still in
the repository as the six-product demo catalogue it started as, and re-running it brings those six
variable products back, but they are not part of the shop. The consequence for this contract is
simple and worth stating: **the variation rules below are documented but currently unexercised**, and
every imported product carries custom specification attributes instead, which is the one place this
contract has to say more than it used to.

Endpoint: `POST /graphql`. Introspection is disabled on this site, so new fields have to be
probed directly — the error messages name the correct type, which is how `GlobalProductAttribute`
below was found.

## The query

One query serves the catalogue and the product page. `$slug` is only used on the product page.

```graphql
query Catalogue($first: Int = 100, $after: String) {
  products(first: $first, after: $after) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      databaseId
      name
      slug
      description
      shortDescription
      image { sourceUrl altText }
      productCategories { nodes { name slug } }
      ... on InventoriedProduct {
        stockStatus
      }
      ... on SimpleProduct {
        price(format: RAW)
        # An imported product's published specifications: custom (non-taxonomy) attributes, where
        # label is the human name and options hold the values themselves. Aliased away from
        # attributes, which is what the variation selectors are built from.
        specs: attributes {
          nodes {
            label
            options
          }
        }
      }
      ... on VariableProduct {
        attributes {
          nodes {
            name
            label
            options
            ... on GlobalProductAttribute {
              terms { nodes { name slug } }
            }
          }
        }
        variations(first: 100) {
          nodes {
            databaseId
            sku
            price(format: RAW)
            stockStatus
            image { sourceUrl }
            attributes { nodes { name value } }
          }
        }
      }
    }
  }
}
```

**One page holds at most 100 nodes.** `products(first: 200)` does not fail on this site — it answers
with 100 — so the catalogue is walked with `after` until `pageInfo.hasNextPage` is false, which is
three requests for 290 products. Trusting one page truncates the shop silently: the ranges would be
derived from whichever hundred came back, and every product page past them would 404, because
`getProductBySlug()` resolves from the catalogue rather than querying the node directly.

Product page lookup by slug is a single node, and is confirmed working:

```graphql
query Product($slug: ID!) {
  product(id: $slug, idType: SLUG) {
    databaseId
    name
    slug
    shortDescription
    description
    image { sourceUrl altText }
    productCategories { nodes { name slug } }
    ... on InventoriedProduct { stockStatus }
    ... on SimpleProduct {
      price(format: RAW)
      specs: attributes { nodes { label options } }
    }
    ... on VariableProduct {
      attributes {
        nodes {
          name
          label
          options
          ... on GlobalProductAttribute { terms { nodes { name slug } } }
        }
      }
      variations(first: 100) {
        nodes {
          databaseId
          sku
          price(format: RAW)
          stockStatus
          image { sourceUrl }
          attributes { nodes { name value } }
        }
      }
    }
  }
}
```

## Rules the frontend must follow

**The examples in these rules name products from the retired seeded catalogue** — Neon Rush 6000, the
Pulse Pod Kit, Midnight Berry E-Liquid. They were the only variable products this site has ever had,
so they are what the variation rules were proved against. Nothing in the current catalogue exercises
them; rules 12 and the specification notes are what today's products rely on.

1. **Prices need `format: RAW`.** Without it, `price` is a formatted string including the currency
   symbol (`"$14.99"`). With it, a variation returns a plain decimal string (`"14.99"`).
2. **A variable product's own price is unusable.** `price(format: RAW)` on a `VariableProduct`
   returns every variation's price joined with commas — for Neon Rush that is literally
   `"12.99, 12.99, 12.99, 14.99, 14.99, 14.99"`. Compute the range in the app from the variation
   nodes (the same product formats as `"$12.99 - $14.99"` when formatted).
3. **Attribute options are slugs, not labels.** `ProductAttribute.options` returns
   `["blue-razz-ice", "frost-mint", "mango-sunset"]`. The display names come from
   `... on GlobalProductAttribute { terms { nodes { name slug } } }`, which returns
   `{ name: "Blue Razz Ice", slug: "blue-razz-ice" }`. Without the inline fragment the query fails
   with `Cannot query field "terms" on type "ProductAttribute"`.
4. **A variation identifies itself by slug.** `variations.nodes[].attributes.nodes[]` gives
   `{ name: "pa_flavour", value: "mango-sunset" }`. `value` is the slug and `name` is the taxonomy,
   so joining a selection to a variation means matching slugs, then presenting the term `name`.
   `label` on those nodes is the attribute's label ("Flavour"), not the term's.
5. **`label` on a product attribute is the attribute name** ("Flavour", "Nicotine Strength",
   "Colour") — that is the selector heading.
6. **Stock is an enum:** `IN_STOCK` or `OUT_OF_STOCK`. It is per variation, so a combination can be
   sold out while the parent stays `IN_STOCK` — Neon Rush `mango-sunset` + `6mg` was seeded that way
   and must render as an unavailable selection. A product is only unsellable when *every*
   variation is `OUT_OF_STOCK`.
7. **Image URLs are absolute on the WordPress origin** and include the site URL, for example
   `http://localhost:8889/wp-content/uploads/2026/09/vapestack-neon-lime.png`. Behind a tunnel
   those have to be rewritten to the public origin, which is what `src/lib/wp/publicUrl.ts` exists
   for. Nothing else in the payload needs rewriting.
8. **Ordering is not guaranteed.** `products` returns them in an order defined by WordPress, not by
   the catalogue, so the app sorts explicitly for anything that must be stable.
9. **Descriptions contain HTML** (`<p>6000 puffs…</p>` plus a trailing newline), so they must be
   rendered as rich text, not as escaped text.
10. **An unknown slug is an error, not a null.** `product(id: "does-not-exist", idType: SLUG)`
    returns `data.product = null` **and** an `errors` entry — `No product ID was found
    corresponding to the slug: does-not-exist`. A client that treats any `errors` entry as fatal
    turns a missing product into a 500 instead of a 404, so the app resolves a slug against the
    catalogue it already fetches rather than querying the node directly. The by-slug query above
    is documented because it is the correct API, not because the storefront uses it.
11. **`stockStatus` is not on `Product`.** Asking for it there fails the whole query with
    `Cannot query field "stockStatus" on type "Product". Did you mean to use an inline fragment
    on "InventoriedProduct", "SimpleProduct", or "VariableProduct"?`. `image` and
    `productCategories` *are* on the interface, so only this one field needs
    `... on InventoriedProduct { stockStatus }`, which covers both simple and variable products
    and still arrives merged into the product object. The same field on `ProductVariation` needs
    no fragment and is used unqualified.
12. **A custom attribute's options are values, not slugs.** The imported products carry their
    specifications as custom (non-taxonomy) attributes — `id: 0`, no taxonomy. GraphQL answers
    them through the same `attributes` field a variable product uses, but the union member is
    `LocalProductAttribute`, where `label` is the human name and `options` are the values
    themselves: `{ label: "Battery", options: ["1300 mAh"] }`. There is no `terms` on this member,
    and asking for one fails, which is why the storefront aliases the field to `specs` for simple
    products and keeps `attributes` for the selectors. Probed directly: the query in
    *The query* above returns six spec nodes for `adalya-myvo-30k`.
13. **The catalogue does not fit in one page.** A connection answers at most **100** nodes however
    large `first` is, so reading the catalogue means following `pageInfo.endCursor` until
    `hasNextPage` is false. Everything downstream is derived from that read — the nine ranges, the
    search index, the sitemap, and which slugs `getProductBySlug()` can find — so a truncated read
    is not a smaller shop but a broken one. Probed: `first: 100` then `after: <cursor>` returned
    **100 + 61 = 161** nodes with **0** overlap on the 161-product catalogue; the same walk over 290
    products is three requests.

## Specifications on an imported product

## Sample response (trimmed)

```json
{
  "data": {
    "products": {
      "nodes": [
        {
          "databaseId": 53,
          "name": "Pulse Pod Kit",
          "slug": "pulse-pod-kit",
          "price": "34.99, 34.99, 34.99",
          "attributes": {
            "nodes": [
              {
                "name": "pa_colour",
                "label": "Colour",
                "options": ["arctic-white", "midnight-black", "neon-lime"],
                "terms": {
                  "nodes": [
                    { "name": "Arctic White", "slug": "arctic-white" },
                    { "name": "Midnight Black", "slug": "midnight-black" },
                    { "name": "Neon Lime", "slug": "neon-lime" }
                  ]
                }
              }
            ]
          },
          "variations": {
            "nodes": [
              {
                "databaseId": 56,
                "sku": "VS-POD-PULSE-neon-lime",
                "price": "34.99",
                "stockStatus": "IN_STOCK",
                "image": { "sourceUrl": "http://localhost:8889/wp-content/uploads/2026/09/vapestack-neon-lime.png" },
                "attributes": { "nodes": [{ "name": "pa_colour", "value": "neon-lime" }] }
              }
            ]
          }
        }
      ]
    }
  }
}
```

## The catalogue

290 products, all simple, all created by
`wp-content/themes/vapestack-theme/tools/import-source-products.php` from the reviewed fixture in
`tools/data/source-products.json`. Their names, specifications and photographs come from a public
product listing; their prices and stock are generated. **The fixture is the list** — it is committed,
so the exact set of SKUs lives there rather than in a copy here that goes stale.

| Range | Source category | Products |
| --- | --- | --- |
| Disposable Vape | `disposable-vape` | 40 |
| Vape Kit | `vape-kit` | 40 |
| Pod Cartridge | `pod-cartridge` | 40 |
| Vape Mod | `vape-mod` | 40 |
| Vape Tanks | `vape-tanks` | 40 |
| Vape Coils | `vape-coils` | 40 |
| Vape Accessories | `vape-accessories` | 40 |
| Nicotine Pouches | `nicotine-pouches` | 9 |
| E-Liquids | `e-liquids` | 1 |

One product per range, as a sample of the shape:

| SKU | Product | Category | Specs |
| --- | --- | --- | --- |
| VO-33225 | Adalya Myvo 30K | Disposable Vape | 6 |
| VO-33028 | Vozol Salt Nic Prime E-liquid | E-Liquids | 1 |
| VO-33384 | ALP Caffeine Nicotine Pouches | Nicotine Pouches | 1 |
| VO-30316 | ADVKEN Artha Pro Pod Cartridge | Pod Cartridge | 3 |
| VO-31408 | Aspire 10pcs Aspire Vilter Paper Filter Drip Tip | Vape Accessories | 1 |
| VO-30348 | ADVKEN DC Series Coil | Vape Coils | 2 |
| VO-30322 | ADVKEN Artha Pro Pod System Kit | Vape Kit | 5 |
| VO-33047 | Ambition Mods Emira SBS 60W Box Mod | Vape Mod | 5 |
| VO-30334 | ADVKEN Artha Gen 2 RDA Atomizer | Vape Tanks | 4 |

**Why the thinnest ranges are thin.** The source publishes eleven e-liquids and exactly one of them
carries any specification at all; its twelve nicotine pouches carry one shared `Device Type` line
and three have no attributes whatever. A product is skipped rather than guessed at when it carries no
specs — the importer writes the product page's description from them — so those two ranges are as
large as the source's own data allows. It also means some spec values are the source's own prose
fragments (measured: **15 of 401** values on the labels added for the new ranges, kept because
rejecting lowercase openings would have thrown away real ones like `built-in 2500mAh battery`).

The SKU is derived from the source product id rather than taken from the source, which lists no
SKUs at all. Each product also carries `_vapestack_source_id` and `_vapestack_source_url`, and the
first of those is what marks a product as imported — it is how `reset` finds exactly the products it
created and nothing else.

Each product's photograph is copied into this site's media library by `media_sideload_image()`, so
`image { sourceUrl }` points at `http://localhost:8889/wp-content/uploads/...` and not at the other
shop. The attachment carries the same two pieces of provenance and `_vapestack_source_image`, and
`reset` deletes it with the product. No image file is committed to the storefront, so every product
image — there is one per product, none shared — is served by WordPress.

**The listings page in memory, not with a second query.** `products` is asked for once, unpaged, and
`/shop` slices the result nine at a time (`lib/pagination.ts`). A range's page is therefore the same
read as the shop page, and `?page=99` needs no request to be refused — the app already knows how
many products it has. `first:`/`after:` are for reading the catalogue, not for paging a listing.

The nine ranges are not registered anywhere: `getCatalogue()` derives them from the products, so they
appear in the navigation, the shop chips and the home page by themselves. Delete the last product in
a range and the range goes with it — which is why an empty range answers 404 rather than rendering an
empty state.

## The retired seeded catalogue

`tools/seed-products.php` is kept in the repository and no longer loaded. For the record, it created
six fictional products — Neon Rush 6000, Frost Rush 3000, Midnight Berry E-Liquid, Coastal Tobacco
E-Liquid, Pulse Pod Kit, Aero Pod Kit — carrying 20 variations between them, which is what the
storefront's option selectors, per-combination stock and sold-out states were built against. Running
it with `reset` recreates all of it, images included. It is the only thing in this project that
exercises the variation half of this contract.

## Order REST contract

Checkout is the one thing that does not go through GraphQL: the order is created with
`POST /wp-json/wc/v3/orders` from server-side Next.js code, so no credential ever reaches the
browser. Verified on 2026-09-11 against WooCommerce 11.1.0.

**Authentication.** HTTP Basic with the site's admin user and its **application password** —
`WP_CONSUMER_KEY` and `WP_CONSUMER_SECRET` in `frontend/.env.local`, carrying `ADMIN_USER` and
`WP_API_PASSWORD` from `.env`. A WooCommerce key/secret pair does *not* work over plain HTTP:
`WC_REST_Authentication::authenticate()` only attempts Basic auth for its own keys when `is_ssl()`
and otherwise falls through to OAuth 1.0a, which needs request signatures. Core's
`wp_authenticate_application_password` authenticates the pair either way, and
`WP_ENVIRONMENT_TYPE=local` in `docker-compose.yml` is what makes application passwords available
without SSL. Proved with a 200 from `/wp-json/wc/v3/orders?per_page=1`.

**Creating one.** `POST /wp-json/wc/v3/orders` with `status: "processing"`,
`payment_method: "cod"`, `set_paid: false`, `billing` from the form, `customer_note` from the
optional note, and `line_items: [{ product_id, variation_id?, quantity }]` — ids and quantities
only, no prices, so WooCommerce computes every total itself. It answers the whole order; the app
keeps `id` and `number` and returns 200 `{"id":…,"number":…}` from `POST /api/checkout`.

**Reading one back.** `GET /wp-json/wc/v3/orders/<id>` answers 404
(`woocommerce_rest_shop_order_invalid_id`) for an unknown id. The app trims the order to
`{ id, number, status, total, items: [{ name, quantity, total }] }` and drops `order_key`, the
billing block and the customer note on purpose: `GET /api/orders/<id>` is public and
unauthenticated, so anything it returns can be read by anyone who guesses an id. A variation's
`line_items[].name` already names the option bought, e.g. `Pulse Pod Kit - Neon Lime`.

Every product image is a photograph copied into this site's media library by the import, one per
product and none shared, by `media_sideload_image()` — see *The catalogue* above. There is no
committed image and no local-image map any more: those existed to serve the seeded catalogue's
generated gradients offline, and the gradients went with it. The consequence is that with WordPress
unreachable the shop still lists and prices every product but the images do not load. Every product
image is rendered with `object-contain`, because the photographs are not all the same shape.
