import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OfflineNotice } from "@/components/layout/offline-notice";
import { Breadcrumbs, type Crumb } from "@/components/product/breadcrumbs";
import { ProductDetail } from "@/components/product/product-detail";
import { ProductJsonLd } from "@/components/product/product-json-ld";
import { ProductNotes } from "@/components/product/product-notes";
import { RelatedProducts } from "@/components/product/related-products";
import { Container } from "@/components/ui/container";
import { getCatalogue, getProductBySlug } from "@/lib/wp/catalog";
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
    alternates: { canonical: `/product/${product.slug}` },
  };
}

/**
 * One product in full.
 *
 * The page keeps what only has to be true once - the metadata, the 404 for an unknown slug, the
 * breadcrumb trail and the rest of the range - and hands the block whose image, price and options
 * move together to `ProductDetail`.
 *
 * The range listing comes out of `getCatalogue()`, which is the same `cache()`d read the header
 * and the footer already make, so the related row costs no extra trip to WordPress.
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

  const category = product.category;
  const catalogue = await getCatalogue();

  /* The rest of the range, minus the product being looked at. WordPress is sorted by name, so
     this keeps that order rather than inventing a second one. */
  const related = category
    ? (catalogue?.products ?? []).filter(
      (candidate) => candidate.category?.slug === category.slug && candidate.id !== product.id,
    )
    : [];

  const trail: Crumb[] = [
    { name: "Home", href: "/" },
    { name: "Shop", href: "/shop" },
    ...(category ? [{ name: category.name, href: `/shop/${category.slug}` }] : []),
    { name: product.name, href: `/product/${product.slug}` },
  ];

  const summary = plainText(product.shortDescription || product.description);

  return (
    <Container className="py-10">
      <Breadcrumbs items={trail} />

      <ProductDetail product={product} />

      <ProductNotes product={product} />

      {category ? (
        <RelatedProducts
          products={related.slice(0, 3)}
          range={category.name}
          rangeSlug={category.slug}
        />
      ) : null}

      <ProductJsonLd product={product} description={summary} />
    </Container>
  );
}
