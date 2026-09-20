/**
 * Where data comes from.
 *
 * Unset (the default) means the built-in mock route handlers at /api/v1. Set
 * NEXT_PUBLIC_API_BASE_URL to Member B's NestJS API and every call in the app
 * goes there instead — no component changes.
 */
export const REMOTE_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

export const USING_MOCK_API = !REMOTE_API_BASE;

/** Path used by browser-side fetches when no remote API is configured. */
export const LOCAL_API_BASE = "/api/v1";

export const API_BASE = REMOTE_API_BASE ?? LOCAL_API_BASE;

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
