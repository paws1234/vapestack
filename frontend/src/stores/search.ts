import { create } from "zustand";

/**
 * Whether the search dialog is showing, and what is in it.
 *
 * A module-level store for the same reason the nav's is: the trigger lives in the header, the panel
 * is mounted by the root layout, and the shortcut can fire from anywhere, so there is nowhere for a
 * provider to sit without wrapping the whole app.
 *
 * The query and the highlight live here rather than in the dialog because **opening is the one
 * moment they must be cleared**, and three different things open this dialog: the header button,
 * the `Cmd/Ctrl+K` shortcut, and nothing else. Putting the reset in `open()` means every one of
 * them starts a fresh search without an effect that watches `isOpen` — which would be the
 * `set-state-in-effect` lint error this project does not allow.
 *
 * Deliberately not persisted: a reload must never reopen a search.
 */
type SearchState = {
  isOpen: boolean;
  /** What has been typed. Cleared on open. */
  query: string;
  /** Index of the highlighted result, for the arrow keys. Cleared on open. */
  active: number;
  /** Shows the dialog, with an empty query and the first result highlighted. */
  open: () => void;
  /** Hides it, keeping nothing. */
  close: () => void;
  /**
   * Replaces the query and puts the highlight back on the first result.
   *
   * @param query What the visitor has typed.
   */
  setQuery: (query: string) => void;
  /**
   * Moves the highlight.
   *
   * @param active Index of the result to highlight.
   */
  setActive: (active: number) => void;
};

export const useSearchStore = create<SearchState>((set) => ({
  isOpen: false,
  query: "",
  active: 0,
  open: () => set({ isOpen: true, query: "", active: 0 }),
  close: () => set({ isOpen: false }),
  setQuery: (query) => set({ query, active: 0 }),
  setActive: (active) => set({ active }),
}));
