"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { buttonStyles } from "@/components/ui/button";
import { useModalBehaviour } from "@/lib/modal-behaviour";
import type { Category } from "@/lib/wp/types";
import { useNavStore } from "@/stores/nav";

/** Class list for one entry in the panel. */
function linkClasses(active: boolean): string {
  return [
    "block rounded-2xl px-4 py-3 text-base transition",
    active
      ? "bg-ink-800 text-neon-400"
      : "text-ink-200 hover:bg-ink-800 hover:text-ink-50",
  ].join(" ");
}

/**
 * The storefront's navigation below `xl`, as a slide-over panel.
 *
 * Mounted by the root layout rather than by the header, and it has to be: `<header>` is
 * `backdrop-blur`, and a `backdrop-filter` makes that element the containing block for any
 * `position: fixed` descendant — a fixed panel inside the header would be positioned against the
 * header box instead of the viewport. The cart drawer is outside the header for the same reason.
 *
 * It reuses `useModalBehaviour`, so focus moves in, Tab stays inside, Escape closes, the page
 * behind stops scrolling and focus returns to the trigger. Nothing here invents a second trap.
 *
 * Categories come from the layout, which reads the catalogue once per render. An empty list is a
 * normal state, not a failure: WordPress is reached through a tunnel that is sometimes closed, and
 * the panel still has to open and offer the shop.
 *
 * @param props.categories Ranges to list, or an empty array when the catalogue could not be read.
 */
export function MobileNav({ categories }: { categories: Category[] }) {
  const isOpen = useNavStore((state) => state.isOpen);
  const close = useNavStore((state) => state.close);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  useModalBehaviour({ open: isOpen, panelRef, onEscape: close });

  /*
    The panel is `xl:hidden`, but `useModalBehaviour` locks the page scroll while it is open. A
    visitor who opens the menu on a phone and then rotates or widens past the breakpoint would be
    left with a hidden panel and a page that will not scroll, so crossing it closes the panel.

    The number has to match the class on the panel: it is where `NavLinks` appears, not 768.
  */
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1280px)");
    const onChange = () => {
      if (desktop.matches) {
        useNavStore.getState().close();
      }
    };

    desktop.addEventListener("change", onChange);

    return () => desktop.removeEventListener("change", onChange);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 xl:hidden ${isOpen ? "" : "pointer-events-none"}`}
      aria-hidden={!isOpen}
    >
      <div
        onClick={close}
        aria-hidden="true"
        className={`absolute inset-0 bg-ink-950/70 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={panelRef}
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-nav-title"
        tabIndex={-1}
        inert={!isOpen}
        className={`absolute inset-y-0 right-0 flex w-full max-w-xs flex-col border-l border-ink-800 bg-ink-900 shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-ink-800 px-5 py-4">
          <h2 id="mobile-nav-title" className="text-lg font-semibold text-ink-50">
            Menu
          </h2>

          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="inline-flex size-9 items-center justify-center rounded-full border border-line text-ink-50 transition hover:border-neon-400 hover:text-neon-400"
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        <nav aria-label="Shop" className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            <li>
              <Link
                href="/shop"
                onClick={close}
                aria-current={"/shop" === pathname ? "page" : undefined}
                className={linkClasses("/shop" === pathname)}
              >
                Shop
              </Link>
            </li>

            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/shop/${category.slug}`}
                  onClick={close}
                  aria-current={`/shop/${category.slug}` === pathname ? "page" : undefined}
                  className={linkClasses(`/shop/${category.slug}` === pathname)}
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-ink-800 p-4">
          <Link href="/shop" onClick={close} className={`${buttonStyles("primary", "md")} w-full`}>
            Shop all
          </Link>
        </div>
      </div>
    </div>
  );
}
