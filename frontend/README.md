# Vapestack storefront

The Next.js half of Vapestack. It reads the catalogue from WordPress over GraphQL, reads and creates
orders over the WooCommerce REST API, and holds the cart in the browser. See the repository's root
`README.md` for how the two halves fit together.

## Running it

```bash
cp .env.local.example .env.local    # then fill in the four URL values and the credential
npm install
npm run dev                         # http://localhost:3000
```

Next uses port 3000 and falls back to 3001 when that port is taken, so read the port it prints.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server with Turbopack. |
| `npm run build` | Production build. |
| `npm run start` | Serves the production build. |
| `npm run lint` | ESLint over the app. |

## Configuration

Every variable is server-side. None of them is a `NEXT_PUBLIC_` variable, so no credential and no
internal URL can reach the browser.

| Variable | Read by |
| --- | --- |
| `WP_GRAPHQL_URL` | `src/lib/wp/graphql.ts` — every catalogue read. |
| `WP_REST_URL` | `src/lib/wp/rest.ts` — order creation and reading. |
| `WP_INTERNAL_URL` | `src/lib/wp/publicUrl.ts` — the origin WordPress advertises for its uploads. |
| `WP_PUBLIC_URL` | `src/lib/wp/publicUrl.ts` — the origin the browser should load them from. |
| `WP_CONSUMER_KEY` | `src/lib/wp/rest.ts` — the Basic auth user. |
| `WP_CONSUMER_SECRET` | `src/lib/wp/rest.ts` — its application password. |

## Where things live

| Path | What it holds |
| --- | --- |
| `src/app/` | Routes: home, `/shop`, `/shop/[category]`, `/product/[slug]`, `/checkout`, and the two API routes. |
| `src/components/` | UI primitives, the layout shell, product and cart components, the checkout form, the age gate. |
| `src/lib/wp/` | Everything that knows about WordPress: the GraphQL transport, the catalogue mapping, the REST client. |
| `src/lib/` | Framework-free helpers: variation resolution and the shared modal behaviour. |
| `src/stores/` | The persisted Zustand cart. |
| `public/products/` | The catalogue's nine product images, committed so the deployed site does not depend on WordPress being reachable. |

## Three things worth knowing before changing this app

- **Every route is dynamic on purpose, declared once in `src/app/layout.tsx`.** The header reads the
  catalogue for its navigation, so every page touches WordPress, and nothing may be fetched during
  `npm run build`: a build must not fail because the WordPress tunnel happens to be closed. Do not
  add `generateStaticParams`, and do not make a page static, without re-deciding that trade. The
  catalogue's five-minute data cache is what keeps this from being a read on every view.
- **WordPress being unreachable is an expected state, not an error.** `src/lib/wp/upstream.ts` types
  it, the listing pages render `OfflineNotice` instead of failing, and the checkout answers demo
  mode rather than an error: no order is created, and the browser is shown the receipt for what it
  was about to send. Keep that path working when touching `catalog.ts`, `rest.ts` or the checkout
  route.
- **Cart state lives in `localStorage`, and checkout is a demo.** The cart is client-side only; the
  order is created server-side with a credential the browser never sees. Nothing is charged, shipped
  or emailed.
