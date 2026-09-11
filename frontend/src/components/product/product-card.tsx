import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Price } from "@/components/ui/price";
import type { Product } from "@/lib/wp/types";

/**
 * One product in a grid.
 *
 * @param props.product Product to render.
 * @param props.eager   Load the image immediately. Set it for cards in the first row: they are
 *                      the largest thing on the page, and lazy loading them delays LCP.
 */
export function ProductCard({ product, eager = false }: { product: Product; eager?: boolean }) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-ink-900 transition hover:border-neon-400/60"
    >
      <div className="relative aspect-square bg-ink-800">
        {product.image ? (
          <Image
            src={product.image.url}
            /* Decorative: the product name is the heading immediately below, so an alt
               here would only make a screen reader repeat it. */
            alt=""
            fill
            loading={eager ? "eager" : "lazy"}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : null}

        {product.stockStatus === "out-of-stock" ? (
          <span className="absolute left-3 top-3">
            <Badge tone="muted">Sold out</Badge>
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.category ? (
          <span className="text-xs uppercase tracking-[0.2em] text-ink-400">
            {product.category.name}
          </span>
        ) : null}

        <h3 className="text-base font-medium text-ink-50">{product.name}</h3>

        <div className="mt-auto flex items-center justify-between pt-3">
          <Price
            min={product.price.min}
            max={product.price.max}
            className="font-semibold text-neon-400"
          />
          {product.variations.length > 0 ? (
            <span className="text-xs text-ink-400">
              {product.variations.length} {product.variations.length === 1 ? "option" : "options"}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
