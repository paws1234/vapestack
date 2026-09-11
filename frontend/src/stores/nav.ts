import { create } from "zustand";

/**
 * Whether the mobile navigation panel is showing.
 *
 * A module-level store rather than React state, for the same reason the cart is one: the trigger
 * lives in the header and the panel is mounted by the root layout, so the two are not in the same
 * subtree and there is nowhere for a provider to sit without wrapping the whole app. They share
 * this module instead.
 *
 * Deliberately not persisted — a reload must never reopen a menu — so there is none of the
 * `skipHydration` care the cart store needs.
 */
type NavState = {
  isOpen: boolean;
  /** Shows the panel, and closes the cart drawer so the two are never both up. */
  open: () => void;
  /** Hides the panel. */
  close: () => void;
};

export const useNavStore = create<NavState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
