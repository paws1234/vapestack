# Vapestack

A headless vape storefront: WordPress and WooCommerce as the commerce backend, a Next.js app as
the storefront. Everything here is a demo — no payment is ever taken, no email is sent and nothing
ships.

- **Backend** — WordPress with WooCommerce 11, WPGraphQL and GraphQL for eCommerce, running in
  Docker through the `wpdev` kit on `http://localhost:8889`. The catalogue is six products with 20
  variations, seeded by a re-runnable script, so demo stock is predictable.
- **Storefront** — Next.js 16 (App Router), Tailwind v4 and Zustand in `frontend/`. Dark-neon
  design system, a 21+ age gate, live flavour and nicotine-strength selectors, a cart that survives
  a reload, and a mock checkout that creates a real `processing` WooCommerce order.

## Layout

| Path | What it is |
| --- | --- |
| `frontend/` | The Next.js storefront. Its own README covers the app itself. |
| `wp-content/themes/vapestack-theme/` | The project's WordPress code: `tools/seed-products.php` seeds the catalogue. |
| `tools/` | Host-side scripts: plugin install, product-image copy, tunnel. |
| `docs/` | The original brief, setup notes, and the frozen GraphQL contract. |
| `.claude/` | The plan and its task list — the record of what was built and how it was verified. |

## Running it locally

```bash
/home/adminpaws/Desktop/dev/wp-kit/bin/wpdev up .          # WordPress on :8889
bash tools/install-plugins.sh                              # WooCommerce, WPGraphQL, WooGraphQL
/home/adminpaws/Desktop/dev/wp-kit/bin/wpdev wp eval-file \
  wp-content/themes/vapestack-theme/tools/seed-products.php
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
2. **The nine seeded product images are committed** under `frontend/public/products/`, so the site
   looks complete with the tunnel down. Checkout then degrades to a demo-mode confirmation instead
   of an error.

WordPress is exposed with a **cloudflared quick tunnel**, which gets a new random
`*.trycloudflare.com` hostname every time it restarts. `tools/tunnel.sh` starts it, reads the
hostname and re-points the Vercel environment, so the changing host is handled in one command
rather than by hand.

## More

- `docs/headless-contract.md` — the GraphQL shape the storefront relies on, with the traps that
  were proved against the live endpoint.
- `docs/SETUP.md` — how the `wpdev` kit wires WordPress and the MCP servers together.
- `CLAUDE.md` — the working notes for an AI agent in this repository.
