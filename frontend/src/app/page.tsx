import Link from "next/link";
import { ProductCard } from "@/components/product/product-card";
import { buttonStyles } from "@/components/ui/button";
import { getCategories, getProducts } from "@/lib/wp/catalog";

export default async function Home() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);

  // One product per range, so the home page shows the breadth of the shop without
  // duplicating the listing page.
  const featured = categories.flatMap((category) => {
    const product = products.find((candidate) => candidate.category?.slug === category.slug);

    return product ? [product] : [];
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <section className="relative mt-8 overflow-hidden rounded-3xl border border-ink-800 bg-ink-900 px-6 py-16 sm:px-12 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-neon-400/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-volt-400/10 blur-3xl"
        />

        <div className="relative max-w-2xl space-y-6">
          <span className="text-xs uppercase tracking-[0.3em] text-neon-400">
            Headless storefront demo
          </span>
          <h1 className="text-4xl font-semibold leading-tight text-ink-50 sm:text-6xl">
            Devices, liquids and pods, served straight out of WordPress.
          </h1>
          <p className="text-lg text-ink-200">
            A Next.js front end reading a live WooCommerce catalogue over GraphQL, with a cart that
            survives a refresh and a checkout that writes a real order back.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/shop" className={buttonStyles("primary", "lg")}>
              Shop everything
            </Link>
            <Link href="/shop/e-liquids" className={buttonStyles("outline", "lg")}>
              Browse e-liquids
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-xs uppercase tracking-[0.25em] text-ink-400">Ranges</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/shop/${category.slug}`}
              className="group rounded-2xl border border-ink-700 bg-ink-900 p-6 transition hover:border-neon-400/60"
            >
              <p className="text-lg font-medium text-ink-50">{category.name}</p>
              <p className="mt-1 text-sm text-ink-400">
                {category.productCount} {category.productCount === 1 ? "product" : "products"}
              </p>
              <span className="mt-4 inline-block text-sm text-neon-400">Browse →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold text-ink-50">One from each range</h2>
          <Link href="/shop" className="text-sm text-neon-400 transition hover:text-neon-300">
            See all {products.length} products →
          </Link>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} eager />
          ))}
        </div>
      </section>
    </div>
  );
}

