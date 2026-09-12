import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OfflineNotice } from "@/components/layout/offline-notice";
import { CategoryChips } from "@/components/product/category-chips";
import { ProductGrid } from "@/components/product/product-grid";
import { Container } from "@/components/ui/container";
import { listingHref, paginate, parsePage } from "@/lib/pagination";
import { parseSort, sortProducts } from "@/lib/product-sort";
import { getCatalogue } from "@/lib/wp/catalog";

type ShopPageProps = {
  searchParams: Promise<{ sort?: string | string[]; page?: string | string[] }>;
};

/**
 * Titles the page, and gives a sorted or paged listing its own canonical.
 *
 * Every page of the shop used to be able to claim it was `/shop`, which tells a crawler that pages 2
 * to 33 are duplicates of page 1 and hides the rest of the catalogue. The ordering and the page
 * number are both part of the address, so both are part of the canonical — `listingHref` builds it,
 * the same function the pager's links come from.
 *
 * @param props.searchParams The requested ordering and page, so the canonical names them.
 */
export async function generateMetadata({ searchParams }: ShopPageProps): Promise<Metadata> {
  const { sort: requestedSort, page: requestedPage } = await searchParams;
  const sort = parseSort(requestedSort);
  const value = Number(Array.isArray(requestedPage) ? requestedPage[0] : requestedPage);
  const page = Number.isInteger(value) && value > 1 ? value : 1;

  return {
    title: "Shop",
    description: "Every device, liquid and pod in the Vapestack catalogue.",
    alternates: { canonical: listingHref("/shop", sort, page) },
  };
}

/**
 * The whole catalogue, nine products at a time.
 *
 * The ordering and the page both live in the URL (`?sort=price-asc&page=3`) and are applied here
 * rather than in the browser, so a sorted, paged shop is a shareable link, the back button returns
 * to the previous view, and the served HTML is already the page a visitor without JavaScript asked
 * for. A page that does not exist is a 404, not a quiet first page.
 *
 * @param props.searchParams The requested ordering and page; anything unrecognised falls back.
 */
export default async function ShopPage({ searchParams }: ShopPageProps) {
  const { sort: requestedSort, page: requestedPage } = await searchParams;
  const sort = parseSort(requestedSort);
  const catalogue = await getCatalogue();

  if (!catalogue) {
    return <OfflineNotice />;
  }

  const { categories, products } = catalogue;
  const ordered = sortProducts(products, sort);
  const page = parsePage(requestedPage, ordered.length);

  if (null === page) {
    notFound();
  }

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-semibold text-ink-50 sm:text-4xl">Shop</h1>
      <p className="mt-2 max-w-2xl text-ink-200">
        The whole catalogue, read live from WooCommerce over GraphQL.
      </p>

      <div className="mt-8">
        <CategoryChips categories={categories} sort={sort} />
      </div>

      <div className="mt-10">
        <ProductGrid paged={paginate(ordered, page)} sort={sort} basePath="/shop" />
      </div>
    </Container>
  );
}
