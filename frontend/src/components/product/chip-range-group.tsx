"use client";

import Link from "next/link";
import { useState } from "react";
import { CHIP_SELECTED, CHIP_UNSELECTED } from "@/components/product/chip-styles";
import { listingHref } from "@/lib/pagination";
import type { Sort } from "@/lib/product-sort";
import { useDisclosure } from "@/lib/use-disclosure";
import type { Category } from "@/lib/wp/types";

/** The panel's minimum width, used to pick the side it opens from. Matches Tailwind's `min-w-52`. */
const PANEL_WIDTH = 208;

/** Breathing room kept between the panel and the edge of the viewport. */
const GUTTER = 16;

/**
 * The grouped ranges, as one chip in the filter row.
 *
 * The filter row had grown to ten pills — All plus nine ranges — which wrapped onto three lines on a
 * phone before the first product. Grouping the hardware shelf leaves All and four ranges in the row
 * and puts the rest one press away, with the same rule and the same behaviour as the header's menu
 * and the footer's column (`lib/nav.ts`, `lib/use-disclosure.ts`).
 *
 * The trigger looks and behaves like the chip it replaces: `aria-expanded`, `aria-controls` over a
 * list of links, and the selected styling when the range being viewed is one of its own. Its links
 * are built with `listingHref`, so the ordering rides along exactly as it does in the plain chips.
 *
 * @param props.label  The group's label, e.g. "Vape".
 * @param props.items  Ranges in the group.
 * @param props.active Slug of the range being viewed.
 * @param props.sort   Ordering in use, carried into every link.
 */
export function ChipRangeGroup({
  label,
  items,
  active,
  sort,
}: {
  label: string;
  items: Category[];
  active?: string;
  sort?: Sort;
}) {
  const { open, toggle, close, containerRef, triggerRef } = useDisclosure();
  const [placement, setPlacement] = useState<{ side: "start" | "end"; maxWidth: number }>({
    side: "start",
    maxWidth: PANEL_WIDTH,
  });
  const selected = items.some((category) => category.slug === active);

  /*
    Open towards whichever side of the chip has more room, measured when it is opened.

    The chip wraps to wherever the row breaks, so a panel always anchored to its left edge runs off
    the viewport when the chip has wrapped right: measured at 768px the panel reached x=839 in a
    768px viewport and at 320px it reached x=359, overflowing by 71px and 39px. Anchoring to the
    roomier side removes both, and it is measured in the click handler rather than in an effect so
    nothing is set during render.
  */
  function openPanel() {
    const box = triggerRef.current?.getBoundingClientRect();

    if (box) {
      const toStart = window.innerWidth - box.left - GUTTER;
      const toEnd = box.right - GUTTER;
      const side = toEnd > toStart ? "end" : "start";

      /*
        The width is clamped to the room on that side as well as the side being chosen: a chip in
        the middle of a narrow row has less than `PANEL_WIDTH` on both sides, and the measured side
        alone would still hang the far edge off the viewport. This is the one place a style
        attribute earns its keep — the value cannot be known until the chip has been laid out.
      */
      setPlacement({ side, maxWidth: Math.max(PANEL_WIDTH, "end" === side ? toEnd : toStart) });
    }

    toggle();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        ref={triggerRef}
        aria-expanded={open}
        aria-controls="chip-range-group"
        onClick={openPanel}
        className={`${selected ? CHIP_SELECTED : CHIP_UNSELECTED} inline-flex items-center gap-1`}
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
        id="chip-range-group"
        hidden={!open}
        style={{ maxWidth: placement.maxWidth }}
        className={`absolute top-full z-50 mt-2 min-w-52 rounded-2xl border border-line bg-ink-900 p-2 shadow-2xl ${
          "end" === placement.side ? "right-0" : "left-0"
        }`}
      >
        {items.map((category) => (
          <li key={category.slug}>
            <Link
              href={listingHref(`/shop/${category.slug}`, sort ?? "name")}
              aria-current={category.slug === active ? "page" : undefined}
              onClick={close}
              className={`block rounded-xl px-3 py-2 text-sm transition ${
                category.slug === active
                  ? "bg-neon-400/10 text-neon-400"
                  : "text-ink-200 hover:bg-ink-800 hover:text-neon-400"
              }`}
            >
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
