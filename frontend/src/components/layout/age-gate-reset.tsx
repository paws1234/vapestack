"use client";

import { forgetAgeGateAnswer } from "@/lib/age-gate";

/**
 * Forgets the age answer, so the gate asks again on the next page load.
 *
 * Clearing storage by itself is not enough. The gate is hidden by the unlayered rule at the end of
 * `globals.css`, keyed off `data-age-gate="off"` on `<html>` — an attribute the inline script set
 * during *this* page load. Remove the stored answer and leave the attribute, and the gate stays
 * hidden for good. So the attribute goes as well, and the page reloads: on the next load the script
 * finds no answer, does not set the attribute, and the gate renders.
 *
 * The reload is the honest implementation rather than a shortcut. The alternative is a second store
 * subscribed by `AgeGate` for a control a visitor uses once, and it would still have to undo the
 * attribute the script wrote.
 */
export function AgeGateReset() {
  return (
    <button
      type="button"
      onClick={() => {
        forgetAgeGateAnswer();
        document.documentElement.removeAttribute("data-age-gate");
        window.location.reload();
      }}
      className="text-sm text-ink-400 underline-offset-4 transition hover:text-neon-400 hover:underline"
    >
      Reset age verification
    </button>
  );
}
