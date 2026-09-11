"use client";

import { CONTROL_CLASSES, LABEL_CLASSES } from "@/components/ui/field";
import { formatCardNumber, type CardErrors, type CardFields } from "@/lib/payment-simulation";

/**
 * The form field name for each card field.
 *
 * The checkout form reads its `FormData` by name, so these are part of the contract between the
 * two components; keeping them in one map means the input's name and the reader cannot drift.
 */
const INPUT_NAMES: Record<keyof CardFields, string> = {
  name: "cardName",
  number: "cardNumber",
  expiry: "cardExpiry",
  cvc: "cardCvc",
};

/**
 * The sandbox card's fields.
 *
 * Uncontrolled on purpose. The number and the CVC exist only in the browser, and the surest way to
 * keep them there is to never let them into React state, a store or a request body: the form is
 * read once, at submit, by the checkout form's own `FormData`, checked by `validateCard`, and the
 * digits are dropped on the spot. Nothing on this page can log or persist them because nothing on
 * this page holds them.
 *
 * Two details are deliberate rather than incidental:
 *
 * - **No `autocomplete="cc-number"`.** There is no real card to fill in, and inviting a browser or
 *   a password manager to offer one would be the wrong invitation. Both fields carry
 *   `autoComplete="off"` and `inputMode="numeric"`.
 * - **The number formats as it is typed** by rewriting the input's own value in the change handler.
 *   That is a DOM write in an event handler, not state, which is exactly why it is allowed here.
 *
 * The errors come in as a prop rather than being held here, so the one place that decides whether
 * a submission may proceed is the form that submits it.
 *
 * @param props.errors What was wrong with the card at the last submit attempt, per field.
 */
export function CardForm({ errors }: { errors: CardErrors }) {
  /**
   * Rewrites one field's value through a formatter.
   *
   * @param event   Change event from the input.
   * @param format  How to rebuild the value from what has been typed.
   */
  function reformat(
    event: React.ChangeEvent<HTMLInputElement>,
    format: (value: string) => string,
  ): void {
    event.currentTarget.value = format(event.currentTarget.value);
  }

  /** Groups a four-digit year-month pair into `MM/YY`. */
  function formatExpiry(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 4);

    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <CardField
        field="name"
        label="Name on the card"
        autoComplete="off"
        className="sm:col-span-2"
        error={errors.name}
      />

      <CardField
        field="number"
        label="Card number"
        inputMode="numeric"
        autoComplete="off"
        placeholder="4242 4242 4242 4242"
        className="sm:col-span-2"
        error={errors.number}
        onChange={(event) => reformat(event, formatCardNumber)}
      />

      <CardField
        field="expiry"
        label="Expiry (MM/YY)"
        inputMode="numeric"
        autoComplete="off"
        placeholder="04/29"
        maxLength={5}
        error={errors.expiry}
        onChange={(event) => reformat(event, formatExpiry)}
      />

      <CardField
        field="cvc"
        label="Security code"
        inputMode="numeric"
        autoComplete="off"
        placeholder="123"
        maxLength={4}
        error={errors.cvc}
      />
    </div>
  );
}

/** One field with its label and its message, in the storefront's own field look. */
type CardFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "name"> & {
  /** Which card field this is; picks the input's name and its error slot. */
  field: keyof CardFields;
  label: string;
  /** Wrapper classes, for grid placement. */
  className?: string;
  /** Message shown under the control, and nothing when the field is fine. */
  error?: string;
};

/**
 * A labelled sandbox field.
 *
 * The message is tied to the control with `aria-describedby` and the control is marked
 * `aria-invalid`, so the refusal is announced with the field rather than beside it. A message that
 * is only a red line of text is invisible to a screen reader, and colour alone is never the signal.
 *
 * @param props.field     Which card field this is.
 * @param props.label     Visible label text.
 * @param props.error     What is wrong, if anything.
 * @param props.className Wrapper classes, e.g. `sm:col-span-2`.
 */
function CardField({ field, label, className = "", error, ...props }: CardFieldProps) {
  const id = `card-${field}`;
  const errorId = `${id}-error`;

  return (
    <div className={`space-y-2 ${className}`}>
      <label className={LABEL_CLASSES} htmlFor={id}>
        {label}
      </label>

      <input
        id={id}
        name={INPUT_NAMES[field]}
        className={`${CONTROL_CLASSES} h-11 ${error ? "border-danger" : ""}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />

      {error ? (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
