import Link from "next/link";
import { ProductCard } from "@/components/product/product-card";
import type { Product } from "@/lib/wp/types";

/**
 * The rest of the range the product being viewed belongs to.
 *
 * Read from the catalogue the page has already loaded rather than from a second query: the range
 * is already a field on every product, so asking WordPress again for something the render is
 * holding would be a round trip for nothing.
 *
 * `ProductCard` is reused rather than reimplemented, which keeps a related card and a listing card
 * one component — including the decision that a sold-out card stays a link.
 *
 * @param props.products Products to show, already excluding the one being viewed.
 * @param props.range    Name of the range, for the heading and the link.
 * @param props.rangeSlug Slug of the range, so the heading can link to the full listing.
 */
export function RelatedProducts({
  products,
  range,
  rangeSlug,
}: {
  products: Product[];
  range: string;
  rangeSlug: string;
}) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-2xl font-semibold text-ink-50">More from {range}</h2>
        <Link
          href={`/shop/${rangeSlug}`}
          className="text-sm text-neon-400 transition hover:text-neon-300"
        >
          See the whole range →
        </Link>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
