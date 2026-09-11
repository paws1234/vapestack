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

## Two things worth knowing before changing this app

- **The catalogue routes are dynamic on purpose.** Nothing is fetched from WordPress during
  `npm run build`, so a build never fails because the WordPress tunnel is down. Do not reintroduce
  `generateStaticParams`, and do not turn these routes static, without re-deciding that trade.
- **Cart state lives in `localStorage`, and checkout is a demo.** The cart is client-side only; the
  order is created server-side with a credential the browser never sees. Nothing is charged, shipped
  or emailed.
