import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

/**
 * The look every text control in the storefront shares.
 *
 * `border-line` rather than `border-ink-700`: measured in the browser, `ink-700` is 1.25:1 against
 * this field's own background, and WCAG 1.4.11 asks 3:1 for a boundary that identifies a control.
 * See `frontend/UI-STANDARDS.md`.
 */
export const CONTROL_CLASSES = [
  "w-full rounded-xl border border-line bg-ink-950 px-4 text-ink-50",
  "placeholder:text-ink-400 focus:border-neon-400",
].join(" ");

/** The label above a control. */
export const LABEL_CLASSES = "text-sm font-medium text-ink-200";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Must be set: the label points at it. */
  id: string;
  label: string;
  /** Wrapper classes, for grid placement. Not forwarded to the input. */
  className?: string;
};

/**
 * A labelled text input.
 *
 * The `id` is required rather than generated with `useId`, for two reasons: these are server
 * components as often as not, and hooks are not available in them; and every caller here already
 * has a stable name to use — the checkout form's fields are `firstName`, `email`, `postcode` —
 * which is more useful in a form payload than a generated id would be.
 *
 * There is deliberately no per-field hint or error slot. The checkout form reports failure once,
 * for the whole request, because that is the only failure this app can actually produce; adding
 * per-field plumbing nobody calls would be the abstraction the project's own rules warn against.
 *
 * @param props.label     Visible label text.
 * @param props.className Wrapper classes, e.g. `sm:col-span-2`.
 */
export function Field({ id, label, className = "", ...props }: FieldProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className={LABEL_CLASSES} htmlFor={id}>
        {label}
      </label>
      <input id={id} className={`${CONTROL_CLASSES} h-11`} {...props} />
    </div>
  );
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  label: string;
  className?: string;
};

/**
 * A labelled textarea, in the same look as {@link Field}.
 *
 * @param props.label Visible label text.
 */
export function TextAreaField({ id, label, className = "", ...props }: TextAreaFieldProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className={LABEL_CLASSES} htmlFor={id}>
        {label}
      </label>
      <textarea id={id} className={`${CONTROL_CLASSES} py-3`} {...props} />
    </div>
  );
}
