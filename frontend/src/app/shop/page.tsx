import type { Metadata } from "next";
import { OfflineNotice } from "@/components/layout/offline-notice";
import { CategoryChips } from "@/components/product/category-chips";
import { ProductGrid } from "@/components/product/product-grid";
import { Container } from "@/components/ui/container";
import { parseSort, sortProducts } from "@/lib/product-sort";
import { getCatalogue } from "@/lib/wp/catalog";

export const metadata: Metadata = {
  title: "Shop",
  description: "Every device, liquid and pod in the Vapestack catalogue.",
};

type ShopPageProps = {
  searchParams: Promise<{ sort?: string | string[] }>;
};

/**
 * The whole catalogue.
 *
 * The ordering lives in the URL (`?sort=price-asc`) and is applied here rather than in the browser,
 * so a sorted shop is a shareable link, the back button returns to the previous order, and the
 * served HTML is already sorted for a visitor without JavaScript.
 *
 * @param props.searchParams The requested ordering; anything unrecognised falls back to name.
 */
export default async function ShopPage({ searchParams }: ShopPageProps) {
  const { sort: requested } = await searchParams;
  const sort = parseSort(requested);
  const catalogue = await getCatalogue();

  if (!catalogue) {
    return <OfflineNotice />;
  }

  const { categories, products } = catalogue;

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
        <ProductGrid products={sortProducts(products, sort)} sort={sort} />
      </div>
    </Container>
  );
}
