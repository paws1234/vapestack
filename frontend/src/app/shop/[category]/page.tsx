import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OfflineNotice } from "@/components/layout/offline-notice";
import { CategoryChips } from "@/components/product/category-chips";
import { ProductGrid } from "@/components/product/product-grid";
import { Container } from "@/components/ui/container";
import { listingHref, paginate, parsePage } from "@/lib/pagination";
import { parseSort, sortProducts } from "@/lib/product-sort";
import { getCatalogue } from "@/lib/wp/catalog";

type CategoryPageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ sort?: string | string[]; page?: string | string[] }>;
};

/**
 * Titles the page after the range being viewed, and canonicals the page number.
 *
 * A range whose catalogue could not be read gets no title here: the page itself then shows the
 * offline notice, and an empty object keeps that failure out of the metadata.
 *
 * @param props.params       Route parameters, awaited because Next 16 hands them over as a promise.
 * @param props.searchParams The requested ordering and page, so a paged range canonicals itself.
 */
export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const { sort: requestedSort, page: requestedPage } = await searchParams;
  const match = (await getCatalogue())?.categories.find((candidate) => candidate.slug === category);

  if (!match) {
    return {};
  }

  const sort = parseSort(requestedSort);
  const value = Number(Array.isArray(requestedPage) ? requestedPage[0] : requestedPage);
  const page = Number.isInteger(value) && value > 1 ? value : 1;

  return {
    title: match.name,
    description: `Shop ${match.name} at Vapestack.`,
    alternates: { canonical: listingHref(`/shop/${match.slug}`, sort, page) },
  };
}

/**
 * One range, with the same grid, the same nine-per-page paging and the same grid as the full shop.
 *
 * The ordering is read from the URL here too, so the sort survives moving between ranges — the
 * chips carry it, and a range is as shareable as the whole shop is.
 *
 * @param props.params       Route parameters carrying the range slug.
 * @param props.searchParams The requested ordering and page; anything unrecognised falls back.
 */
export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category } = await params;
  const { sort: requestedSort, page: requestedPage } = await searchParams;
  const sort = parseSort(requestedSort);
  const catalogue = await getCatalogue();

  if (!catalogue) {
    return <OfflineNotice />;
  }

  const { categories, products } = catalogue;
  const match = categories.find((candidate) => candidate.slug === category);

  if (!match) {
    notFound();
  }

  const inRange = sortProducts(
    products.filter((product) => product.category?.slug === category),
    sort,
  );
  const page = parsePage(requestedPage, inRange.length);

  if (null === page) {
    notFound();
  }

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-semibold text-ink-50 sm:text-4xl">{match.name}</h1>
      <p className="mt-2 max-w-2xl text-ink-200">
        {match.productCount} {match.productCount === 1 ? "product" : "products"} in this range.
      </p>

      <div className="mt-8">
        <CategoryChips categories={categories} active={match.slug} sort={sort} />
      </div>

      <div className="mt-10">
        <ProductGrid
          paged={paginate(inRange, page)}
          sort={sort}
          basePath={`/shop/${match.slug}`}
        />
      </div>
    </Container>
  );
}
