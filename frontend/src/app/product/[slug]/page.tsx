import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product/product-detail";
import { getProductBySlug, getProducts } from "@/lib/wp/catalog";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

/** The longest a meta description is worth before search engines truncate it. */
const META_DESCRIPTION_LIMIT = 155;

/** Pre-renders one page per product the catalogue knows about. */
export async function generateStaticParams() {
  const products = await getProducts();

  return products.map((product) => ({ slug: product.slug }));
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
  const product = await getProductBySlug(slug);

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
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
      {product.category ? (
        <Link
          href={`/shop/${product.category.slug}`}
          className="text-sm text-ink-400 transition hover:text-neon-400"
        >
          ← {product.category.name}
        </Link>
      ) : null}

      <ProductDetail product={product} />
    </div>
  );
}
