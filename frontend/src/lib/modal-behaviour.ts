"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Everything inside a dialog that can hold focus. */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * What a blocking overlay has to do beyond being visible: move focus into itself, keep Tab
 * inside, stop the page behind it from scrolling, and hand focus back where it came from.
 *
 * Shared by the cart drawer and the age gate, which differ only in whether Escape dismisses -
 * passing no handler is the gate, where Escape is not a way past the question. The two are the
 * only callers; anything more elaborate than this belongs in a library.
 *
 * @param props.open     Whether the dialog is showing.
 * @param props.panelRef The dialog element. Give it `tabIndex={-1}` so it can hold focus when
 *                       it contains no controls of its own.
 * @param props.onEscape Called when Escape is pressed, or null to ignore Escape entirely.
 */
export function useModalBehaviour({
  open,
  panelRef,
  onEscape,
}: {
  open: boolean;
  panelRef: RefObject<HTMLElement | null>;
  onEscape: (() => void) | null;
}): void {
  /*
    Held in a ref so the effect below does not depend on the callback's identity: an inline
    arrow function would otherwise re-run it on every render, dragging focus back to the first
    control and re-locking the page while the customer is in the middle of something.
  */
  const escapeHandler = useRef(onEscape);

  /** A focus restore that is waiting for the next frame, so it can be called off. */
  const pendingRestore = useRef<number | null>(null);

  useEffect(() => {
    escapeHandler.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!open) {
      /* The cleanup that just ran is the one that schedules the focus restore. */
      return;
    }

    if (pendingRestore.current !== null) {
      cancelAnimationFrame(pendingRestore.current);
      pendingRestore.current = null;
    }

    const panel = panelRef.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    /* Read on every keystroke: a quantity stepper disables itself at its bounds. */
    const controls = (): HTMLElement[] =>
      panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];

    /*
      Both halves of the focus work wait a frame, because React has not applied `inert` to the
      panel until the commit that this effect follows. Focusing something inside an element that
      is about to become unfocusable is how focus ends up on <body> for no visible reason.
    */
    const openFrame = requestAnimationFrame(() => (controls()[0] ?? panel)?.focus());

    /**
     * Escape, and the Tab cycle that keeps focus inside the dialog.
     *
     * @param event Key event from the document.
     */
    function onKeyDown(event: KeyboardEvent) {
      if ("Escape" === event.key) {
        const handler = escapeHandler.current;

        if (handler) {
          event.preventDefault();
          handler();
        }

        return;
      }

      if ("Tab" !== event.key || !panel) {
        return;
      }

      const focusable = controls();

      if (0 === focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const inside = panel.contains(active);

      if (event.shiftKey && (active === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(openFrame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;

      /*
        Handing focus back is the mirror of the above: the trigger must have been given focus
        again once the panel is really out of the way. It can be gone - the line a customer
        removed, for instance - so a detached element is skipped rather than focused blindly.
      */
      pendingRestore.current = requestAnimationFrame(() => {
        pendingRestore.current = null;

        if (previousFocus?.isConnected) {
          previousFocus.focus();
        }
      });
    };
  }, [open, panelRef]);
}
