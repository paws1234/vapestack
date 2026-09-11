# Vapestack

A headless vape storefront: WordPress and WooCommerce as the commerce backend, a Next.js app as
the storefront. Everything here is a demo — no payment is ever taken, no email is sent and nothing
ships.

**Live demo:** <https://vapestack-paws1234s-projects.vercel.app> — the storefront runs on Vercel,
and the WordPress it reads from runs on a development machine behind a tunnel. When that machine is
off the shop serves its last cached catalogue, the product images still load, and checkout says
plainly that no order was created.

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
| `/shop`, `/shop/[category]` | The catalogue and one range. Sorting lives in the URL (`?sort=price-asc`), the sort control is a real `GET` form so it works without JavaScript, and the result count is announced. |
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
| `tools/` | Host-side scripts: plugin install, the source fetcher, tunnel. |
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

## How the deploy works

The storefront is deployed to Vercel with its **Root Directory set to `frontend`**, so WordPress is
not part of the build. Two deliberate choices keep the deployed site useful while WordPress is only
reachable through a tunnel that lives as long as the development machine:

1. **Every catalogue route is dynamic**, so the Vercel build fetches nothing from WordPress and
   cannot fail because the tunnel is down. At runtime a warm data cache keeps serving the catalogue
   when WordPress is unreachable.
2. **The product photographs are served by WordPress**, so with the tunnel down the catalogue still
   lists and prices every product but the images do not load. They are another shop's photographs and
   are deliberately not committed here; the alternative would be putting somebody else's pictures in
   a public repository. Checkout necessarily degrades too, and says so.

WordPress is exposed with a **cloudflared quick tunnel**, which gets a new random
`*.trycloudflare.com` hostname every time it restarts. `tools/tunnel.sh` starts it, reads the
hostname and re-points the Vercel environment, so the changing host is handled in one command
rather than by hand.

```bash
npx --yes vercel login                                   # once
env -C . npx --yes vercel link --project vapestack        # once, from the repository root
bash tools/tunnel.sh                                      # tunnel up, environment re-pointed, deployed
```

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
