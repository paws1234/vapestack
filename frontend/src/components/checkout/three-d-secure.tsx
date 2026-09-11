"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { CONTROL_CLASSES, LABEL_CLASSES } from "@/components/ui/field";
import { useModalBehaviour } from "@/lib/modal-behaviour";
import { TEST_OTP, digitsOnly } from "@/lib/payment-simulation";

/**
 * The simulated 3-D Secure challenge.
 *
 * A step of the checkout rather than a second overlay competing with the drawers: it is mounted by
 * the checkout form, it exists only while a card payment is being authorised, and the cart drawer
 * and the mobile nav are not open on this page. It is not in `app/layout.tsx` because what it shows
 * depends on the form that owns it, and nothing else in the app has a reason to render it.
 *
 * **Escape cancels the challenge cleanly back to the form.** Unlike the age gate — where Escape
 * would be a way past a question that has to be answered — this is a step a visitor is allowed to
 * abandon: nothing has been created, the cart still holds the lines, and cancelling simply returns
 * to the checkout with the card details still in the form. That is the documented behaviour in
 * `UI-STANDARDS.md` as well as here.
 *
 * No timer lives here at all. The only thing that changes on its own is the `busy` flag, which the
 * checkout form sets while the request is in flight, so nothing has to be cleared on unmount.
 *
 * @param props.open      Whether the challenge is showing.
 * @param props.busy      Whether the authorisation is in flight.
 * @param props.onApprove Called when the correct code is entered.
 * @param props.onCancel  Called on Escape or Cancel; returns to the checkout form.
 */
export function ThreeDSecure({
  open,
  busy,
  onApprove,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  useModalBehaviour({ open, panelRef, onEscape: onCancel });

  /**
   * Checks the code the visitor typed.
   *
   * The comparison happens here and the code is dropped on the spot: it is never stored, never
   * posted, and the only thing that leaves this component is "the code was right".
   */
  function checkCode(): void {
    if (busy) {
      return;
    }

    if (digitsOnly(code) === TEST_OTP) {
      /* Cleared here rather than in an effect, so the next challenge starts empty. */
      setCode("");
      setCodeError(null);
      onApprove();

      return;
    }

    setCodeError("That is not the code this simulation accepts. It is printed below the field.");
  }

  /**
   * Enter in the code field authorises, the way it would in a real challenge.
   *
   * Handled here rather than by a `<form>`: this dialog sits inside the checkout's own form, and a
   * nested one is invalid HTML whose Enter key would also submit the checkout.
   *
   * @param event Key event from the code field.
   */
  function onCodeKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if ("Enter" === event.key) {
      event.preventDefault();
      checkCode();
    }
  }

  /** Abandons the challenge without creating anything. */
  function cancel(): void {
    setCode("");
    setCodeError(null);
    onCancel();
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
        open ? "" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <div
        onClick={cancel}
        aria-hidden="true"
        className={`absolute inset-0 bg-ink-950/80 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tds-title"
        tabIndex={-1}
        inert={!open}
        className={`relative w-full max-w-md rounded-3xl border border-line bg-ink-900 p-6 shadow-2xl transition-opacity duration-300 motion-reduce:transition-none ${
          open ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="tds-title" className="text-lg font-semibold text-ink-50">
            Simulated 3-D Secure
          </h2>
          <span className="rounded-full border border-ink-700 bg-ink-900/80 px-2.5 py-1 text-xs font-medium text-ink-400">
            Simulation
          </span>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-ink-200">
          A real bank would ask for a code here and check it with the cardholder&rsquo;s bank. This
          is a demonstration of that step: there is no bank, no card and nothing to charge, and the
          code below is printed on the page rather than sent to you.
        </p>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <label className={LABEL_CLASSES} htmlFor="tds-code">
              Six-digit code
            </label>

            <input
              id="tds-code"
              name="tdsCode"
              value={code}
              onChange={(event) => setCode(digitsOnly(event.target.value).slice(0, 6))}
              onKeyDown={onCodeKeyDown}
              inputMode="numeric"
              autoComplete="off"
              /*
                Deliberately not `required`: this dialog stays mounted and `inert` while closed,
                and a `required` control inside a hidden dialog makes the browser refuse to submit
                the checkout form with "an invalid form control is not focusable". The empty code is
                refused by the message below instead, in words a visitor can act on.
              */
              aria-invalid={codeError ? true : undefined}
              aria-describedby={codeError ? "tds-code-error" : "tds-code-hint"}
              className={`${CONTROL_CLASSES} h-11 font-mono tracking-[0.4em] tabular-nums`}
            />

            <p id="tds-code-hint" className="text-xs text-ink-400">
              The simulation accepts{" "}
              <span className="font-mono tabular-nums text-ink-200">{TEST_OTP}</span>.
            </p>

            {codeError ? (
              <p id="tds-code-error" role="alert" className="text-xs text-danger">
                {codeError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={checkCode} disabled={busy}>
              {/*
                The label changes and the button keeps its size: a spinner alone loses the word
                that says what is being waited for, which is the loading rule in the standards doc.
              */}
              {busy ? "Authorising…" : "Authorise the simulation"}
            </Button>

            <Button type="button" variant="outline" onClick={cancel} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
