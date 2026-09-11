/**
 * The age gate's storage key and its pre-paint switch.
 *
 * A plain module rather than a client one: `app/layout.tsx` is a server component and needs
 * this string to embed in the served HTML, while the gate component needs the key to read and
 * write. Importing one from the other would either cross a client module boundary or drag the
 * whole layout into the browser bundle.
 */

/** Where a confirmed visitor is remembered. Only ever written after a confirmation. */
export const AGE_GATE_STORAGE_KEY = "vapestack-age-verified";

/** The stored value that means "this visitor confirmed they are 21 or over". */
const CONFIRMED = "true";

/**
 * Runs in the browser before the first paint, as part of the HTML the server sent.
 *
 * Setting `data-age-gate="off"` on `<html>` is what the rule at the end of `globals.css` turns
 * into "hide the gate", so a visitor who has already confirmed never sees the shop flash behind
 * it. `JSON.stringify` rather than quotes by hand, so the key cannot drift from the one the
 * component reads. Wrapped in try/catch because storage throws in some privacy modes, and a
 * gate that is visible when it should not be is much better than a page that never paints.
 */
export const AGE_GATE_SCRIPT = `try{if(${JSON.stringify(CONFIRMED)}===window.localStorage.getItem(${JSON.stringify(
  AGE_GATE_STORAGE_KEY,
)})){document.documentElement.dataset.ageGate="off"}}catch(e){}`;

/** Whether this visitor has already confirmed they are 21 or over. */
export function readAgeGateAnswer(): boolean {
  try {
    return CONFIRMED === window.localStorage.getItem(AGE_GATE_STORAGE_KEY);
  } catch {
    /* Storage can be unavailable; treat it as unanswered and ask. */
    return false;
  }
}

/** Remembers that this visitor confirmed. A decline is deliberately not remembered. */
export function rememberAgeGateAnswer(): void {
  try {
    window.localStorage.setItem(AGE_GATE_STORAGE_KEY, CONFIRMED);
  } catch {
    /* Storage can be unavailable; the visitor is asked again next time and nothing breaks. */
  }
}

/**
 * Forgets a confirmation, so the gate asks again.
 *
 * Clearing the key is not on its own enough to bring the gate back: it is hidden by an unlayered
 * rule keyed off `data-age-gate="off"` on `<html>`, which `AGE_GATE_SCRIPT` set during the current
 * page load. The caller has to remove that attribute too — see `components/layout/age-gate-reset.tsx`,
 * which does that and reloads rather than threading a second store through the gate for a control
 * used once in a visit.
 */
export function forgetAgeGateAnswer(): void {
  try {
    window.localStorage.removeItem(AGE_GATE_STORAGE_KEY);
  } catch {
    /* Storage can be unavailable, in which case there is nothing stored to forget. */
  }
}
