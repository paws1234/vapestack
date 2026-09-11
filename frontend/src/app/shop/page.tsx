import type { Metadata } from "next";
import { CategoryChips } from "@/components/product/category-chips";
import { ProductGrid } from "@/components/product/product-grid";
import { getCategories, getProducts } from "@/lib/wp/catalog";

export const metadata: Metadata = {
  title: "Shop",
  description: "Every device, liquid and pod in the Vapestack catalogue.",
};

export default async function ShopPage() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
      <h1 className="text-3xl font-semibold text-ink-50 sm:text-4xl">Shop</h1>
      <p className="mt-2 max-w-2xl text-ink-200">
        The whole catalogue, read live from WooCommerce over GraphQL.
      </p>

      <div className="mt-8">
        <CategoryChips categories={categories} />
      </div>

      <div className="mt-10">
        <ProductGrid products={products} />
      </div>
    </div>
  );
}
