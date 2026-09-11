"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { useModalBehaviour } from "@/lib/modal-behaviour";
import { searchCatalogue, type SearchEntry, type SearchResult } from "@/lib/search-index";
import { useCartStore } from "@/stores/cart";
import { useNavStore } from "@/stores/nav";
import { useSearchStore } from "@/stores/search";

/**
 * Whether the age gate is still holding the screen.
 *
 * The gate is server-rendered and hidden by one unlayered rule keyed off `data-age-gate="off"` on
 * `<html>`, set by the inline script for a visitor who has already confirmed. So the attribute is
 * the gate's own answer to "am I up?", and reading it here is more reliable than a second store:
 * it is also absent when a visitor has just declined, which is exactly when the shortcut must not
 * open a dialog behind a question that traps focus.
 */
function ageGateIsUp(): boolean {
  return "off" !== document.documentElement.dataset.ageGate;
}

/** The second line of a result: what it is, and what it belongs to. */
function subtitle(entry: SearchResult): string {
  if ("range" === entry.kind) {
    return "Range";
  }

  if ("option" === entry.kind) {
    return entry.options[0] ? `Option — ${entry.options[0]}` : "Option";
  }

  return entry.range ? `Product — ${entry.range}` : "Product";
}

/**
 * Search over a client-side index.
 *
 * The index arrives as a prop from `app/layout.tsx`, built from the catalogue read the navigation
 * already does, and filtering it is a plain function call: **typing costs no request at all**.
 *
 * It is mounted by the root layout, never inside `<header>` — that element is `backdrop-blur`, and
 * a `backdrop-filter` is the containing block for a `position: fixed` descendant, so an overlay
 * inside the header would be positioned against the header box. It stays mounted while closed and
 * carries `inert`, so a hidden dialog cannot be tabbed into.
 *
 * Keyboard model: the input keeps focus and the highlight moves by `aria-activedescendant`, which
 * is the standard combobox shape. Enter follows the highlighted result, Escape closes and hands
 * focus back where it came from through `useModalBehaviour`.
 *
 * @param props.index The slim index built on the server from the catalogue the layout already read.
 */
export function SearchDialog({ index }: { index: SearchEntry[] }) {
  const isOpen = useSearchStore((state) => state.isOpen);
  const query = useSearchStore((state) => state.query);
  const active = useSearchStore((state) => state.active);
  const close = useSearchStore((state) => state.close);
  const setQuery = useSearchStore((state) => state.setQuery);
  const setActive = useSearchStore((state) => state.setActive);

  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  useModalBehaviour({ open: isOpen, panelRef, onEscape: close });

  const results = searchCatalogue(index, query);
  const highlighted = results[active] ?? null;

  /*
    The global shortcut. Attached once, and it reads the stores imperatively so the listener never
    has to be torn down and rebuilt: an effect that depended on `isOpen` would re-register on every
    toggle, and one that called `setState` would be the lint error this project forbids.
  */
  useEffect(() => {
    /**
     * Opens or closes the dialog on `Cmd/Ctrl+K`.
     *
     * @param event Document key event.
     */
    function onKeyDown(event: KeyboardEvent | globalThis.KeyboardEvent): void {
      if (!(("k" === event.key || "K" === event.key) && (event.metaKey || event.ctrlKey))) {
        return;
      }

      event.preventDefault();

      if (useSearchStore.getState().isOpen) {
        useSearchStore.getState().close();

        return;
      }

      if (ageGateIsUp()) {
        return;
      }

      useNavStore.getState().close();
      useCartStore.getState().close();
      useSearchStore.getState().open();
    }

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  /**
   * Follows a result and closes the dialog.
   *
   * @param entry Result that was chosen.
   */
  function follow(entry: SearchResult): void {
    close();
    router.push(entry.href);
  }

  /**
   * The dialog's own keys: arrows move the highlight, Enter follows it.
   *
   * @param event Key event from the input or the panel.
   */
  function onKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if ("ArrowDown" === event.key) {
      event.preventDefault();
      setActive(Math.min(active + 1, Math.max(results.length - 1, 0)));

      return;
    }

    if ("ArrowUp" === event.key) {
      event.preventDefault();
      setActive(Math.max(active - 1, 0));

      return;
    }

    if ("Enter" === event.key && highlighted) {
      event.preventDefault();
      follow(highlighted);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh] ${
        isOpen ? "" : "pointer-events-none"
      }`}
      aria-hidden={!isOpen}
    >
      <div
        onClick={close}
        aria-hidden="true"
        className={`absolute inset-0 bg-ink-950/80 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={panelRef}
        id="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-title"
        tabIndex={-1}
        inert={!isOpen}
        onKeyDown={onKeyDown}
        className={`relative w-full max-w-xl rounded-3xl border border-line bg-ink-900 shadow-2xl transition-opacity duration-300 motion-reduce:transition-none ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      >
        <h2 id="search-title" className="sr-only">
          Search the shop
        </h2>

        <div className="border-b border-ink-800 p-4">
          <label className="sr-only" htmlFor="search-input">
            Search products, ranges and options
          </label>

          <input
            id="search-input"
            type="search"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls="search-results"
            aria-autocomplete="list"
            aria-activedescendant={highlighted ? `search-result-${active}` : undefined}
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products, ranges and options…"
            className="h-11 w-full rounded-xl border border-line bg-ink-950 px-4 text-ink-50 placeholder:text-ink-400 focus:border-neon-400"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {results.length > 0 ? (
            <ul role="listbox" id="search-results" aria-label="Search results">
              {results.map((entry, i) => (
                <li
                  key={`${entry.kind}-${entry.slug}-${entry.name}`}
                  id={`search-result-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => follow(entry)}
                  className={[
                    "cursor-pointer rounded-2xl px-3 py-2 transition",
                    i === active ? "bg-ink-800" : "hover:bg-ink-800",
                  ].join(" ")}
                >
                  <span className="block text-ink-50">{entry.name}</span>
                  <span className="block text-xs text-ink-400">{subtitle(entry)}</span>
                </li>
              ))}
            </ul>
          ) : (
            /*
              Two different nothings, and they are not the same state: nothing typed yet is a
              prompt, and nothing found is a designed empty result with a way out. An empty list
              would say neither.
            */
            <div className="px-3 py-4">
              {"" === query.trim() ? (
                <p className="text-sm text-ink-400">
                  Type to filter the catalogue. Products, ranges and options all match — try
                  &ldquo;mint&rdquo;, &ldquo;kit&rdquo; or &ldquo;disposables&rdquo;.
                </p>
              ) : (
                <>
                  <p className="text-sm text-ink-200">No matches for &ldquo;{query.trim()}&rdquo;.</p>
                  <p className="mt-1 text-xs text-ink-400">
                    Nothing in the catalogue starts with or contains that. Try a product name, a
                    range like E-liquids, or an option like Frost Mint.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      router.push("/shop");
                    }}
                    className="mt-3 text-sm text-neon-400 transition hover:text-neon-300"
                  >
                    Browse the whole shop
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-ink-800 px-4 py-3">
          <p className="text-xs text-ink-400">
            {results.length > 0
              ? "Arrow keys move the highlight, Enter opens the highlighted result, Escape closes."
              : "Escape closes. The search runs in this browser — it makes no request at all."}
          </p>
        </div>
      </div>
    </div>
  );
}
