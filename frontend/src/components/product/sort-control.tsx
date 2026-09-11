"use client";

import type { ChangeEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DEFAULT_SORT, SORT_OPTIONS, type Sort } from "@/lib/product-sort";

/**
 * The shop's sort control, with the URL as its state.
 *
 * Sorting is a server concern here: the page reads `?sort=` and orders the catalogue before it
 * renders, so a sorted shop is a link a visitor can share, reload or go back to, and the grid
 * arrives ordered with JavaScript switched off. That is why the control is a real `GET` form
 * rather than a controlled select: the submit button is the whole no-JS path, and it costs one
 * button's worth of chrome.
 *
 * With JavaScript the form is a progressive enhancement — `onChange` pushes the parameter instead,
 * so the list re-orders without a reload. The select stays controlled by the URL, which is what
 * keeps it honest after a back button: the server's value is the only value it shows.
 *
 * @param props.sort The ordering the server actually used, so the control never disagrees with the
 *                   grid beside it.
 */
export function SortControl({ sort }: { sort: Sort }) {
  const pathname = usePathname();
  const router = useRouter();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as Sort;
    const query = DEFAULT_SORT === next ? "" : `?sort=${next}`;

    router.push(`${pathname}${query}`, { scroll: false });
  }

  return (
    <form method="get" action={pathname} className="flex items-center gap-2">
      <Select id="sort" name="sort" label="Sort" value={sort} onChange={handleChange}>
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      {/*
        The no-JS path, and the only reason this button exists: without JavaScript a select cannot
        navigate on its own. It is a real submit, so it works with scripting off and is harmless
        with it on. `aria-label` only adds the noun, so the visible label stays the start of the
        accessible name.
      */}
      <Button type="submit" variant="outline" size="sm" aria-label="Apply sort">
        Apply
      </Button>
    </form>
  );
}
