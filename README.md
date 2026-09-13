# Vapestack

A headless vape storefront: WordPress and WooCommerce as the commerce backend, a Next.js app as
the storefront. Everything here is a demo — no payment is ever taken, no email is sent and nothing
ships.

**Live demo:** <https://vapestack-paws1234s-projects.vercel.app> — the storefront runs on Vercel and
needs nothing else running. It reads WordPress when WordPress is reachable, and answers from a
published copy of the catalogue and its photographs when it is not. Checkout is the exception: it
needs WooCommerce itself to create an order, so it says plainly that no order was created.

- **Backend** — WordPress with WooCommerce 11, WPGraphQL and GraphQL for eCommerce, running in
  Docker through the `wpdev` kit on `http://localhost:8889`. The catalogue is **290 imported
  products across nine ranges** (40 per range, except `nicotine-pouches` at 9 and `e-liquids` at the
  single product its source publishes): their names, factual specifications and photographs were
  read from a public product listing, while their prices and stock are generated. The import is
  re-runnable, so demo stock and demo prices are predictable.
- **Storefront** — Next.js 16 (App Router), Tailwind v4 and Zustand in `frontend/`. Dark-neon
  design system, a 21+ age gate, a cart that survives a reload, and a mock checkout that creates a
  real `processing` WooCommerce order.

## The storefront's routes

| Route | What it is |
| --- | --- |
| `/` | Hero, every range with one product each, and one honest paragraph about what this shop is. |
| `/shop`, `/shop/[category]` | The catalogue and one range, **nine products a page** with the page in the URL (`?page=3`). Sorting lives in the URL too (`?sort=price-asc`), the sort control is a real `GET` form and the pager is made of links, so both work without JavaScript, and the result count is announced. |
| `/product/[slug]` | One product: breadcrumbs, live option selectors with per-combination stock, a quantity stepper, details and the shipping statement, the rest of its range, and `Product` + `BreadcrumbList` JSON-LD. |
| `/checkout`, `/checkout/success/[id]` | The demo checkout and the receipt for the order it created. No payment is taken. |
| `/about`, `/contact`, `/shipping-returns`, `/privacy`, `/terms` | Info and legal pages. None of them reads the catalogue, so all five render with WordPress stopped. |
| `/robots.txt`, `/sitemap.xml`, `/opengraph-image` | Metadata routes. The sitemap is rendered per request and lists the catalogue as well as the static routes. |
| `app/not-found.tsx`, `app/error.tsx` | The designed 404 and the error state. Unknown product and range slugs answer a real 404, which is why there is no `app/loading.tsx` — see `frontend/UI-STANDARDS.md`. |

Everything visual is governed by `frontend/UI-STANDARDS.md`: measured contrast ratios, the type and
spacing rhythm, the five states a control must define, the a11y checklist and the reduced-motion
rule. It is the file to read before changing anything on screen.

## Layout

| Path | What it is |
| --- | --- |
| `frontend/` | The Next.js storefront. Its own README covers the app itself. |
| `wp-content/themes/vapestack-theme/` | The project's WordPress code: `tools/import-source-products.php` imports the fixture in `tools/data/`, and `tools/seed-products.php` is the original six-product demo catalogue, no longer loaded. |
| `mirror/` | The state mirror: the thin image layer over the kit's, the entrypoint that hydrates before Apache, and `state.sh`, which serialises the database and the uploads to PostgreSQL and rebuilds from them. `docs/state-mirror.md` explains it. |
| `tools/` | Host-side scripts: plugin install, the source fetcher, the tunnel, the contact form's mail key, and the two mirror commands. |
| `resources/` | Brand assets: the supplied artwork and the generator that turns it into the site's tab icon. Nothing here is served directly. |
| `docs/` | The original brief, setup notes, and the frozen GraphQL contract. |
| `.claude/` | The plan and its task list — the record of what was built and how it was verified. |

## Running it locally

```bash
/home/adminpaws/Desktop/dev/wp-kit/bin/wpdev up .          # WordPress on :8889
bash tools/install-plugins.sh                              # WooCommerce, WPGraphQL, WooGraphQL

# The catalogue. The fetch needs network and writes a fixture a person reviews; the import then
# copies one product per entry, photographs included, and is safe to re-run.
node tools/fetch-source-products.mjs
/home/adminpaws/Desktop/dev/wp-kit/bin/wpdev wp eval-file \
  wp-content/themes/vapestack-theme/tools/import-source-products.php

/home/adminpaws/Desktop/dev/wp-kit/bin/wpdev smoke         # 10 checks through the MCP endpoint

cp frontend/.env.local.example frontend/.env.local         # then fill in the credentials
env -C frontend npm install
env -C frontend npm run dev                                # storefront on :3000
```

`next dev` uses port 3000 and falls back to 3001 when something else already holds it, so check
the port it prints rather than assuming one.

### The contact form's mail key

The contact form is the one part of this site that sends email, and it needs a provider to send it
through. Both the form and the route work without one — a submission is answered honestly and handed
to the visitor's own mail client — but nothing is delivered until a key exists:

```bash
bash tools/configure-contact-mail.sh    # prompts for a Resend key, sends a test message, saves it
```

The prompt reads the key with `read -s`, so it is never echoed and never passed as an argument. The
same key has to be added to the deployed project's environment variables as well, or the deployed
form keeps answering that it has no provider.

## Keeping the site (the state mirror)

The database lives in a Docker volume, and the uploads are on this disk and gitignored. So
`wpdev destroy`, a dead disk, or a different machine loses the shop - its products, its orders, every
photograph - with nothing to rebuild it from. The state mirror is a one-way copy of exactly those two
things to an external PostgreSQL database, plus a boot script that puts them back.

```bash
bash tools/configure-mirror.sh    # once: connection string, schema, first snapshot
bash tools/mirror.sh status       # what is local, and what the mirror holds
bash tools/mirror.sh push         # snapshot now          pull: rebuild from the newest snapshot
```

It is off until it is configured. With no connection string, nothing is exported and nothing is
hydrated, and the site behaves exactly as it did before this existed. Two things are worth knowing
before leaning on it:

- **Hydration fills an empty database and never overwrites a populated one**, so it rebuilds a wiped
  machine without discarding anything done since the last snapshot.
- **Plugin code is not in a snapshot.** Elementor, WooCommerce and the MCP adapter live in a Docker
  volume and are reinstalled from the kit's cache by `wpdev setup` and `tools/install-plugins.sh`;
  the mirror carries the content, not other people's PHP.

`docs/state-mirror.md` has the hooks, what a snapshot holds, the measurements taken while building
it, and the limitations.

## How the deploy works

The storefront is deployed to Vercel with its **Root Directory set to `frontend`**, so WordPress is
not part of the build — and the deployment does not depend on the development machine being on.
Three deliberate choices make that true:

1. **Every catalogue route is dynamic**, so the Vercel build fetches nothing from WordPress and
   cannot fail because the shop is away.
2. **The catalogue is published to a durable copy** — the same PostgreSQL database the state mirror
   writes to (`docs/state-mirror.md`). Every complete read is stored there, and a read that cannot
   reach WordPress is answered from it instead of by the offline notice: the header's navigation,
   the ranges, the product pages, the search index and `/sitemap.xml` all come out of that copy.
3. **The photographs are published with it.** `mirror/state.sh` already stores every upload in that
   same database, so `/media/<path>` serves them from there, immutably cached at the edge. They are
   another shop's photographs and are still deliberately not committed to this repository — the
   alternative would be putting somebody else's pictures in a public one.

Checkout is the one thing that cannot survive this: an order is what Stripe's Payment Intent is
created against, so with the shop away the checkout says so rather than pretending.

The tunnel is still how a *fresh* read happens. WordPress is exposed with a **cloudflared quick
tunnel**, which gets a new random `*.trycloudflare.com` hostname every time it restarts.
`tools/tunnel.sh` starts it, reads the hostname and re-points the Vercel environment, so the
changing host is handled in one command — run it when you want the published copy refreshed. The
site is complete without it.

```bash
npx --yes vercel login                                   # once
env -C . npx --yes vercel link --project vapestack        # once, from the repository root
npx --yes vercel env add NEXT_PUBLIC_SITE_URL production \
  --value https://vapestack-paws1234s-projects.vercel.app --no-sensitive --yes   # once
bash tools/tunnel.sh                                      # tunnel up, environment re-pointed, deployed
```

`NEXT_PUBLIC_SITE_URL` is the storefront's own origin, and it is the one variable `tools/tunnel.sh`
does not set. The contact form's `RESEND_API_KEY` is the other one it does not: it is set once in
the Vercel dashboard (or with `vercel env add`), not per tunnel, because nothing about it depends on
the tunnel. A new variable needs a deployment to exist at all; a changed one is read at request
time. It is a `NEXT_PUBLIC_` variable, so Next inlines it at build time and it has to be in
place **before** a build — setting it afterwards only affects the next deployment. Unset, it falls
back to `http://localhost:3000`, which is right for `next dev` and wrong for everything else: the
canonical link on every page, `/robots.txt` and all 306 entries in `/sitemap.xml` would name the
author's laptop.

`MIRROR_DATABASE_URL` is the third variable the tunnel script does not touch, and like
`RESEND_API_KEY` it is set once rather than per tunnel: it is the PostgreSQL database holding the
published copy, and it does not care which host the live shop is reachable through. It is the same
variable, with the same value, as the one `mirror/.mirror.env` defines - one database, one name -
and it has to be a Supabase project's **session pooler**, never `db.<ref>.supabase.co`, which
publishes no A record at all and so cannot be reached from a serverless function. Unset, the
deployment still works and simply has no copy to fall back on.

One value, two consumers, and they need different modes of the same pooler: `mirror/state.sh`
connects through session mode (5432) for its scripts, while the storefront rewrites the port to the
transaction pooler (6543), because session mode caps concurrent clients at 15 and a serverless
function scaling out reaches that in seconds. The rule lives in `frontend/src/lib/snapshot/db.ts`.

Deploys run from the repository root rather than from `frontend/`. The project's Root Directory is
`frontend`, so the CLI has to upload the repository and let that setting pick the storefront out of
it; running `vercel` inside `frontend/` uploads that directory as the root and fails to find it.

## More

- `docs/headless-contract.md` — the GraphQL shape the storefront relies on, with the traps that
  were proved against the live endpoint.
- `docs/SETUP.md` — how the `wpdev` kit wires WordPress and the MCP servers together.
- `frontend/UI-STANDARDS.md` — the measured UI record: contrast ratios, type and spacing rhythm,
  control states, the a11y checklist and the reduced-motion rule.
- `docs/ui-ux-plan.md` / `docs/ui-ux-tasks.md` — the storefront polish pass, finished, with the
  evidence for every task.
- `docs/features-plan.md` — the next phase: cart hold countdown, cart reward ladder, a simulated
  payment sandbox, a post-purchase timeline and client-side search. Planned, not built.
- `CLAUDE.md` — the working notes for an AI agent in this repository.
