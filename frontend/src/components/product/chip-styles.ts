/**
 * The range filter's pill classes, in one place.
 *
 * `CategoryChips` renders the plain ones and `ChipRangeGroup` renders the grouped one, and they have
 * to look like one row of controls: a shared module rather than one importing the other keeps that
 * true without a circular import between a server component and a client one.
 */

const BASE = "rounded-full border px-4 py-2 text-sm transition";

/** The range being viewed — colour *and* `aria-current`, never colour alone. */
export const CHIP_SELECTED = `${BASE} border-neon-400 bg-neon-400/10 text-neon-400`;

/** Every other range. */
export const CHIP_UNSELECTED = `${BASE} border-line text-ink-200 hover:border-neon-400/60 hover:text-neon-400`;
