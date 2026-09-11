import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OfflineNotice } from "@/components/layout/offline-notice";
import { ProductDetail } from "@/components/product/product-detail";
import { Container } from "@/components/ui/container";
import { getProductBySlug } from "@/lib/wp/catalog";
import type { Product } from "@/lib/wp/types";
import { UpstreamUnavailableError } from "@/lib/wp/upstream";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

/** The longest a meta description is worth before search engines truncate it. */
const META_DESCRIPTION_LIMIT = 155;

/**
 * Reads one product without making "WordPress is away" fatal.
 *
 * An unknown slug is a 404 and has to stay one, so the two outcomes are kept apart deliberately:
 * null means there is no such product, undefined means the catalogue could not be read at all.
 *
 * @param slug Product slug as it appeared in the URL.
 */
async function readProduct(slug: string): Promise<Product | null | undefined> {
  try {
    return await getProductBySlug(slug);
  } catch (error) {
    if (error instanceof UpstreamUnavailableError) {
      return undefined;
    }

    throw error;
  }
}

/**
 * Flattens WordPress HTML into plain text.
 *
 * Meta descriptions are not HTML: WordPress returns the summary wrapped in a paragraph tag, which
 * would otherwise be escaped into the tag itself.
 *
 * @param html Markup as returned by WordPress.
 */
function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Titles the page after the product and summarises it for search results.
 *
 * @param props.params Route parameters carrying the product slug.
 */
export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await readProduct(slug);

  if (!product) {
    return {};
  }

  const summary = plainText(product.shortDescription || product.description);

  return {
    title: product.name,
    description:
      summary.length > META_DESCRIPTION_LIMIT
        ? `${summary.slice(0, META_DESCRIPTION_LIMIT - 3)}...`
        : summary,
  };
}

/**
 * One product in full.
 *
 * The page keeps what only has to be true once - the metadata, the 404 for an unknown slug and
 * the link back to the range - and hands the block whose image, price and options move together
 * to `ProductDetail`.
 *
 * @param props.params Route parameters carrying the product slug.
 */
export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await readProduct(slug);

  if (undefined === product) {
    return <OfflineNotice what="product" />;
  }

  if (!product) {
    notFound();
  }

  return (
    <Container className="py-10">
      {product.category ? (
        <Link
          href={`/shop/${product.category.slug}`}
          className="text-sm text-ink-400 transition hover:text-neon-400"
        >
          ← {product.category.name}
        </Link>
      ) : null}

      <ProductDetail product={product} />
    </Container>
  );
}
