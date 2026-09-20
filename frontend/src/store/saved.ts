"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Saved places (PRD F8).
 *
 * TEAM_PLAN cuts custom lists from MVP, so this is one flat "Want to visit"
 * list. Local-only until /v1/me/lists exists.
 */
interface SavedState {
  slugs: string[];
  toggle: (slug: string) => void;
  has: (slug: string) => boolean;
  clear: () => void;
}

export const useSaved = create<SavedState>()(
  persist(
    (set, get) => ({
      slugs: [],
      toggle: (slug) =>
        set((s) => ({
          slugs: s.slugs.includes(slug)
            ? s.slugs.filter((x) => x !== slug)
            : [...s.slugs, slug],
        })),
      has: (slug) => get().slugs.includes(slug),
      clear: () => set({ slugs: [] }),
    }),
    { name: "bt-saved" },
  ),
);
