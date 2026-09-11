import type { ReactNode } from "react";

/** How wide the page is allowed to get. */
type Width = "default" | "narrow";

const WIDTHS: Record<Width, string> = {
  default: "max-w-6xl",
  narrow: "max-w-3xl",
};

/**
 * The page's horizontal wrapper.
 *
 * Every page used to repeat `mx-auto w-full max-w-6xl px-5 sm:px-8`, which is the kind of thing
 * that drifts: one page quietly becomes `max-w-5xl` and nobody notices until the headers stop
 * lining up. Vertical padding stays at the call site — a page that needs `py-10` and a state page
 * that needs `py-16` are making different decisions, and this component should not guess which.
 *
 * @param props.width `default` is the 1152px shell; `narrow` is the 768px reading column.
 * @param props.className Extra classes, for vertical padding.
 */
export function Container({
  width = "default",
  className = "",
  children,
}: {
  width?: Width;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`mx-auto w-full px-5 sm:px-8 ${WIDTHS[width]} ${className}`}>{children}</div>
  );
}
