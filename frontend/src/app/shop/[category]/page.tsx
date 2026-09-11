import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryChips } from "@/components/product/category-chips";
import { ProductGrid } from "@/components/product/product-grid";
import { getCategories, getProducts } from "@/lib/wp/catalog";

type CategoryPageProps = {
  params: Promise<{ category: string }>;
};

/** Pre-renders one page per range that actually has products. */
export async function generateStaticParams() {
  const categories = await getCategories();

  return categories.map((category) => ({ category: category.slug }));
}

/**
 * Titles the page after the range being viewed.
 *
 * @param props.params Route parameters, awaited because Next 16 hands them over as a promise.
 */
export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const match = (await getCategories()).find((candidate) => candidate.slug === category);

  if (!match) {
    return {};
  }

  return {
    title: match.name,
    description: `Shop ${match.name} at Vapestack.`,
  };
}

/**
 * One range, with the same grid as the full shop.
 *
 * @param props.params Route parameters carrying the range slug.
 */
export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const match = categories.find((candidate) => candidate.slug === category);

  if (!match) {
    notFound();
  }

  const inRange = products.filter((product) => product.category?.slug === category);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
      <h1 className="text-3xl font-semibold text-ink-50 sm:text-4xl">{match.name}</h1>
      <p className="mt-2 max-w-2xl text-ink-200">
        {match.productCount} {match.productCount === 1 ? "product" : "products"} in this range.
      </p>

      <div className="mt-8">
        <CategoryChips categories={categories} active={match.slug} />
      </div>

      <div className="mt-10">
        <ProductGrid products={inRange} />
      </div>
    </div>
  );
}
