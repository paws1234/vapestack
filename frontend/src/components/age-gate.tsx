"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { readAgeGateAnswer, rememberAgeGateAnswer } from "@/lib/age-gate";
import { useModalBehaviour } from "@/lib/modal-behaviour";

/**
 * Nothing to subscribe to: the only thing that writes the answer is this component's own
 * button, which puts it in state as well. React needs the function anyway, and it has to keep
 * the same identity across renders, hence module scope.
 */
function subscribe(): () => void {
  return () => {};
}

/**
 * What the server renders. It cannot read storage, so the gate is always in the HTML the server
 * sends, and React keeps that answer for the hydration render before checking the real one.
 */
function answerOnServer(): boolean {
  return false;
}

/**
 * The 21+ gate.
 *
 * Visible by default, because the server cannot read `localStorage` and the question is
 * therefore what the served HTML has to say. A visitor who confirmed on an earlier visit is
 * handled before the first paint by the inline script in `app/layout.tsx`, which sets
 * `data-age-gate="off"` on `<html>` for the CSS to hide this element with; `useSyncExternalStore`
 * then removes it from the DOM and the tab order for good once hydration is done.
 *
 * That is also what keeps hydration quiet: React uses the server's answer for the hydration
 * render, so the first client render still shows the gate and only the render after it reacts to
 * storage - the same reasoning as the cart's `skipHydration`.
 *
 * A decline is not stored. It is a statement about this visit, and it is not a re-prompt either:
 * the dialog stays, explaining rather than asking again.
 */
export function AgeGate() {
  const panelRef = useRef<HTMLDivElement>(null);

  /** Confirmed on an earlier visit, which is what storage knows. */
  const remembered = useSyncExternalStore(subscribe, readAgeGateAnswer, answerOnServer);

  /** Confirmed just now: the write above does not notify a store nothing subscribes to. */
  const [justConfirmed, setJustConfirmed] = useState(false);

  /** Declined, which is deliberately not remembered. */
  const [declined, setDeclined] = useState(false);

  const confirmed = remembered || justConfirmed;

  /* Escape is not a way past this question, so the hook is given no Escape handler at all. */
  useModalBehaviour({ open: !confirmed, panelRef, onEscape: null });

  if (confirmed) {
    return null;
  }

  return (
    /*
      The scroll container is the backdrop, and the panel is centred by a wrapper with
      `min-h-full` rather than by the backdrop itself. Centring a taller-than-viewport panel with
      `items-center` alone would push its top above the viewport, where it cannot be scrolled to
      - the heading and the first button would be unreachable on a short window.
    */
    <div
      data-age-gate-root=""
      className="fixed inset-0 z-[60] overflow-y-auto bg-ink-950/95 backdrop-blur-sm"
    >
      <div className="flex min-h-full items-center justify-center p-5">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="age-gate-title"
          tabIndex={-1}
          className="w-full max-w-md rounded-3xl border border-ink-800 bg-ink-900 p-8 shadow-2xl"
        >
          {declined ? (
            <>
              <h2 id="age-gate-title" className="text-2xl font-semibold text-ink-50">
                Come back when you are 21
              </h2>

              <p className="mt-3 leading-relaxed text-ink-400">
                Vapestack sells nicotine products, so its shop is open to adults aged 21 and over
                only. There is nothing else to see here without confirming that.
              </p>
            </>
          ) : (
            <>
              <h2 id="age-gate-title" className="text-2xl font-semibold text-ink-50">
                Are you 21 or older?
              </h2>

              <p className="mt-3 leading-relaxed text-ink-400">
                This shop carries nicotine products and is for adults only. Vapestack is a
                portfolio demo: nothing is really sold, a card runs through Stripe in test mode so
                no real card is charged, and no order ships.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  size="lg"
                  onClick={() => {
                    rememberAgeGateAnswer();
                    setJustConfirmed(true);
                  }}
                  className="flex-1"
                >
                  Yes, I am 21 or over
                </Button>

                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    setDeclined(true);
                    /*
                      The two buttons are about to go, which would drop focus onto <body> while a
                      modal is still open. The panel survives the re-render, so it takes focus -
                      and being labelled by the new heading, it is announced as well.
                    */
                    panelRef.current?.focus();
                  }}
                  className="flex-1"
                >
                  No, I am under 21
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
