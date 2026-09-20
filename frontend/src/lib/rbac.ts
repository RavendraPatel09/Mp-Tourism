import type { Role } from "./types";

/**
 * Presentation-layer capability map for the 8 roles in PRD §4.2.
 *
 * This only decides what the admin UI shows. Real enforcement is server-side on
 * every endpoint (PRD §11) — never treat this as a security boundary.
 */
export type Capability =
  | "destinations.read"
  | "destinations.write"
  | "destinations.publish"
  | "media.manage"
  | "moderation.review"
  | "reports.review"
  | "challenges.manage"
  | "analytics.state"
  | "analytics.national"
  | "users.manage"
  | "users.enforce"
  | "audit.read";

const CAPABILITIES: Record<Role, Capability[]> = {
  guest: [],
  explorer: [],
  verified_explorer: [],
  local_guide: ["destinations.read"],
  partner: [],
  moderator: [
    "destinations.read",
    "moderation.review",
    "reports.review",
    "users.manage",
  ],
  state_admin: [
    "destinations.read",
    "destinations.write",
    "media.manage",
    "moderation.review",
    "reports.review",
    "challenges.manage",
    "analytics.state",
    "users.manage",
    "audit.read",
  ],
  super_admin: [
    "destinations.read",
    "destinations.write",
    "destinations.publish",
    "media.manage",
    "moderation.review",
    "reports.review",
    "challenges.manage",
    "analytics.state",
    "analytics.national",
    "users.manage",
    "users.enforce",
    "audit.read",
  ],
};

export function can(role: Role, capability: Capability) {
  return CAPABILITIES[role].includes(capability);
}

export const ROLE_LABEL: Record<Role, string> = {
  guest: "Guest",
  explorer: "Explorer",
  verified_explorer: "Verified Explorer",
  local_guide: "Local Guide",
  partner: "Partner",
  moderator: "Moderator",
  state_admin: "State Admin",
  super_admin: "Super Admin",
};

/** Roles that can sign into the admin dashboard at all. */
export const ADMIN_ROLES: Role[] = ["moderator", "state_admin", "super_admin"];
