"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "@/lib/types";

/**
 * Mock session.
 *
 * Auth is Member B's (PRD §8 /v1/auth/*). Until those endpoints exist this
 * store stands in for the signed-in user, and the admin shell exposes a role
 * switcher so the eight PRD roles can be demonstrated. Replacing it with real
 * JWT handling touches this file and lib/api/client.ts, nothing else.
 */
interface SessionState {
  username: string;
  displayName: string;
  role: Role;
  signedIn: boolean;
  setRole: (role: Role) => void;
  signIn: () => void;
  signOut: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      username: "aarav_rides",
      displayName: "Aarav Deshmukh",
      role: "super_admin",
      signedIn: true,
      setRole: (role) => set({ role }),
      signIn: () => set({ signedIn: true }),
      signOut: () => set({ signedIn: false }),
    }),
    { name: "bt-session" },
  ),
);
