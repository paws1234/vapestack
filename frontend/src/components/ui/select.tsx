import type { ReactNode, SelectHTMLAttributes } from "react";

/** The select's own look: the field border, at the smaller control height. */
const SELECT_CLASSES = "rounded-xl border border-line bg-ink-950 px-3 py-1.5 text-ink-50";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  /** Visible label, rendered inline before the control. */
  label: string;
  className?: string;
  children: ReactNode;
};

/**
 * A labelled native select.
 *
 * Native rather than a listbox of divs: a `<select>` is keyboard-operable, announced correctly and
 * usable on a phone with no code at all. It was `rounded-full` before this, which made the shop's
 * sort look like a chip that happened to hold a value.
 *
 * @param props.label Text shown before the control, e.g. `Sort`.
 */
export function Select({ id, label, className = "", children, ...props }: SelectProps) {
  return (
    <label className={`flex items-center gap-2 text-sm text-ink-400 ${className}`} htmlFor={id}>
      {label}
      <select id={id} className={SELECT_CLASSES} {...props}>
        {children}
      </select>
    </label>
  );
}
