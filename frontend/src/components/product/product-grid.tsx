"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/product/product-card";
import { Select } from "@/components/ui/select";
import type { Product } from "@/lib/wp/types";

/** The orderings the shop offers. */
type Sort = "name" | "price-asc" | "price-desc";

const SORTS: { value: Sort; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

/**
 * A grid of products with a sort control.
 *
 * Sorting happens here rather than in the query because WordPress does not guarantee an order,
 * and six products do not need a round trip to reorder. Filtering by range stays in the URL.
 *
 * @param props.products Products to show, already filtered by the page.
 */
export function ProductGrid({ products }: { products: Product[] }) {
  const [sort, setSort] = useState<Sort>("name");

  const sorted = useMemo(() => {
    const order = [...products];

    switch (sort) {
      case "price-asc":
        return order.sort((a, b) => a.price.min - b.price.min);
      case "price-desc":
        return order.sort((a, b) => b.price.min - a.price.min);
      default:
        return order.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [products, sort]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-ink-400">
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>

        <Select
          id="sort"
          label="Sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as Sort)}
        >
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((product, index) => (
          <ProductCard key={product.id} product={product} eager={index < 3} />
        ))}
      </div>
    </div>
  );
}
