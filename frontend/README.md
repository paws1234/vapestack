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

Only the mail key is optional: without it the site runs, and the contact form says so rather than
swallowing a message. See **Configuration** below.

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
| `RESEND_API_KEY` | `src/lib/contact-mail.ts` — sends the contact form. Optional; unset, the route answers 503 and the form falls back to the visitor's mail client. |
| `CONTACT_FROM_EMAIL` | `src/lib/contact-mail.ts` — the sender, defaulting to Resend's shared `onboarding@resend.dev`, which only delivers to the account's own address. |
| `CONTACT_TO_EMAIL` | `src/lib/contact-mail.ts` — the recipient, defaulting to `CONTACT_EMAIL` in `src/lib/site.ts`. |

## Where things live

| Path | What it holds |
| --- | --- |
| `UI-STANDARDS.md` | The measured UI record: contrast ratios, type and spacing rhythm, control states, a11y checklist, motion rules, the responsive contract, Tailwind v4 traps. Read it before any visual change. |
| `src/app/` | Routes: `/`, `/shop`, `/shop/[category]`, `/product/[slug]`, `/checkout`, `/checkout/success/[id]`, the five info pages (`/about`, `/contact`, `/shipping-returns`, `/privacy`, `/terms`), the four API routes (`checkout`, `orders/[id]`, `contact`, `stripe/webhook`), and the four metadata routes (`robots.txt`, `sitemap.xml`, `opengraph-image`, `favicon.ico`). Plus `not-found.tsx` and `error.tsx`. `favicon.ico` is generated, not hand-made: it is the brand mark cut square by `../resources/make-icons.mjs`. |
| `src/components/` | UI primitives, the layout shell, product and cart components, the checkout form with its two steps (details, then Stripe's own card fields), the order timeline, the search dialog, the age gate, and the strip that says the shop behind the site is offline. The cart drawer's hold banner and reward ladder live with the cart. |
| `src/components/product/` | Everything that describes one product: the card, the photo tile every photograph sits on, the detail block, the quantity picker, the breadcrumbs, the spec/shipping notes, the related row, and the JSON-LD emitters. |
| `src/lib/wp/` | Everything that knows about WordPress: the GraphQL transport, the query documents, the catalogue mapping, the REST client, and the liveness probe the offline strip reads. |
| `src/lib/` | Helpers that are not about WordPress: variation resolution, the shop sort, `site.ts` (the absolute origin metadata needs), the shared modal behaviour, the cart hold's arithmetic (`cart-hold.ts`) with its clock (`use-live-hold.ts`), the spend ladder (`cart-rewards.ts`), the payment methods (`payment-simulation.ts`), the product tile's colour (`product-image.ts`), the order timeline's stages with their per-order storage (`order-timeline.ts`), and the search index built from the layout's catalogue read (`search-index.ts`). |
| `src/lib/stripe/` | Everything that knows about Stripe, all of it server-only: the client (`client.ts`, the one place `STRIPE_SECRET_KEY` is read), the money conversion (`amount.ts`), and the Payment Intent (`payment.ts`). |
| `src/stores/` | The persisted Zustand cart, the mobile nav's open state, and the search dialog's open state with its query. |
| `public/` | Static assets. Product images are not among them: the catalogue is imported, and each product's photograph is served from the WordPress media library. |

## Four things worth knowing before changing this app

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
  order is created server-side with a credential the browser never sees. No order is shipped or
  emailed, and the only charge that can happen is a Stripe one in test mode — which moves no real
  money. The cart also holds its lines for ten minutes — a **simulated**
  reservation, stored as a deadline in `stores/cart.ts` and ticked only while the drawer is open.
  Nothing is really held back, and the copy says so. (The contact form is the one part of this app
  that does send email — see `src/lib/contact-mail.ts`.)
- **A card is paid through Stripe in test mode, and no card digit reaches this app.** Card is the
  default method, and it is a **two-step** checkout: `POST /api/checkout` creates the WooCommerce
  order **first** — `pending`, priced by WooCommerce — and then a Stripe **Payment Intent for that
  total**, which is what the second step's card fields need. The amount charged is therefore never
  the subtotal the browser displayed. The card itself is entered into Stripe's own fields, in
  Stripe's own iframe, so nothing in this app's requests, orders, storage or logs can contain one.
  The order is marked paid only when Stripe says the money moved: the webhook
  (`app/api/stripe/webhook`) or, if that delivery is late or lost, the next read of the order
  (`reconcileOrder()`). Keys come from `tools/configure-stripe.sh`; with none set the route answers
  503 before creating anything and the two simulated methods carry on. `../docs/stripe-plan.md` is
  the plan, `../docs/stripe-tasks.md` the record.
- **QR payment and cash on delivery are simulations, and say so.** Both are recorded on the
  WooCommerce order as `payment_method`/`payment_method_title` in words that include "simulated", so
  the shop's own record cannot be read as a real payment either, and the demo receipt carries the
  same words. The QR method's symbol is a **real** one: `qrcode.react` encodes
  `absoluteUrl("/checkout")` into a scannable code and the address is printed beside it, because a
  code that points at nothing is the dishonest version — there is still no merchant behind it, so it
  cannot charge anything.
- **There is no root `loading.tsx`, and adding one is a bug, not a nicety.** Measured by toggling
  only that file: with it, `/product/does-not-exist` and `/shop/does-not-exist` answer **200** five
  times out of five; without it, **404** five times out of five. A `loading.tsx` opens a Suspense
  boundary around the whole page, so Next commits to a 200 before the body — where `notFound()`
  throws — has run. A skeleton has to be an explicit `<Suspense>` inside a page. The table and the
  reasoning are in `UI-STANDARDS.md`.

## Frontend commands

The storefront is a second app in this repository, and none of it is a `wpdev` command. From this
directory:

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on 3000, falling back to 3001 — read the port it prints. |
| `npm run build` | Production build. Safe with WordPress stopped; nothing is fetched at build time. |
| `npm run start` | Serves the production build. |
| `npm run lint` | ESLint over the app. |
| `npx tsc --noEmit` | Type check only. |

After a production build, a running `next dev` serves the prerendered output for statically rendered
routes and stays stale through a dev-server restart. `rm -rf .next` is what clears it.
