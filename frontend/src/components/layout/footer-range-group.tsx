"use client";

import Link from "next/link";
import { useDisclosure } from "@/lib/use-disclosure";
import type { Category } from "@/lib/wp/types";

/**
 * The footer's grouped ranges, behind one trigger.
 *
 * The footer's shop column lists the shop and its ranges as a stack of links, which is ten rows now
 * that the catalogue has nine ranges. The hardware shelf goes behind a disclosure so the column
 * reads as "Shop, four ranges, Vape" — the same grouping, and the same rule, as the header's menu
 * (`lib/nav.ts`).
 *
 * It expands **in place** rather than floating: inside a footer column there is nothing to overlay,
 * and pushing the rows below it down is the honest way for a list to open. The trigger and the
 * behaviour come from `useDisclosure`, so Escape, the focus return and the outside press are the
 * same here as in the header.
 *
 * @param props.label The group's label, e.g. "Vape".
 * @param props.items Ranges in the group.
 */
export function FooterRangeGroup({ label, items }: { label: string; items: Category[] }) {
  const { open, toggle, close, containerRef, triggerRef } = useDisclosure();

  return (
    <div ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        aria-expanded={open}
        aria-controls="footer-range-group"
        onClick={toggle}
        className="inline-flex items-center gap-1 text-ink-200 transition hover:text-neon-400"
      >
        {label}
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={`size-3 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 4.5L6 8l3.5-3.5" />
        </svg>
      </button>

      <ul
        id="footer-range-group"
        hidden={!open}
        className="mt-2 space-y-2 border-l border-ink-800 pl-3 text-sm"
      >
        {items.map((category) => (
          <li key={category.slug}>
            <Link
              href={`/shop/${category.slug}`}
              onClick={close}
              className="text-ink-200 transition hover:text-neon-400"
            >
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
