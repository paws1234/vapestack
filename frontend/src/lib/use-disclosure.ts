"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The open/closed behaviour of a disclosure, for the two places that have one.
 *
 * The header's range menu and the footer's range group are styled differently and positioned
 * differently, but they have to *behave* identically — and the behaviour is the fiddly part, so it
 * lives here once rather than twice:
 *
 * - the trigger is a `<button>` with `aria-expanded`, never a link to nowhere;
 * - Escape closes it and hands focus back to the trigger;
 * - a pointer press anywhere else closes it, without stealing focus — a document listener rather
 *   than `onBlur`, because clicking the page background does not move focus and would leave the
 *   menu open;
 * - following one of its links closes it, which is why no effect has to watch the pathname.
 *
 * The listeners only exist while the group is open.
 */
export function useDisclosure() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if ("Escape" !== event.key) {
        return;
      }

      setOpen(false);
      triggerRef.current?.focus();
    }

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return {
    open,
    toggle: () => setOpen((value) => !value),
    close: () => setOpen(false),
    containerRef,
    triggerRef,
  };
}
