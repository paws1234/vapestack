import { JsonLd } from "@/components/product/json-ld";
import { absoluteUrl } from "@/lib/site";
import type { Product } from "@/lib/wp/types";

/**
 * `Product` structured data for one product.
 *
 * Only fields the catalogue actually holds are emitted. An invented `brand`, a made-up
 * `aggregateRating` or a `reviewCount` nobody wrote is exactly the kind of thing structured data
 * is for lying about, and a wrong `offers` is worse than none.
 *
 * A variable product has no single price, so the offer states the cheapest variation and
 * `priceCurrency` fixes the unit: WooCommerce prices the order, and this is the same number the
 * page shows as the low end of the range.
 *
 * @param props.product     Product being described.
 * @param props.description Plain-text summary. WordPress returns HTML, which must not go in here.
 */
export function ProductJsonLd({
  product,
  description,
}: {
  product: Product;
  description: string;
}) {
  const url = absoluteUrl(`/product/${product.slug}`);

  const offers: Record<string, unknown> = {
    "@type": "Offer",
    url,
    price: Number(product.price.min.toFixed(2)),
    priceCurrency: "USD",
    availability:
      "in-stock" === product.stockStatus
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
  };

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description,
    url,
    offers,
  };

  /* Optional on purpose: WordPress will happily hold a product with no SKU or no image, and an
     empty string in `sku` or `image` is a worse answer than saying nothing. */
  if (product.sku) {
    data.sku = product.sku;
  }

  if (product.image) {
    /* Absolute, because a structured-data consumer is not the browser that fetched this page and
       has no origin to resolve a path against. Catalogue images are committed local copies
       (`/products/...`), so this is where that path becomes a URL. */
    data.image = [absoluteUrl(product.image.url)];
  }

  if (product.category) {
    data.category = product.category.name;
  }

  return <JsonLd data={data} />;
}
