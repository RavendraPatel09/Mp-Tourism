# YatraGo — Web

The public discovery site and the admin / government dashboard, in one Next.js app.

Companion to [../PRD.md](../PRD.md), [../TEAM_PLAN.md](../TEAM_PLAN.md) and
[FRONTEND_PLAN.md](./FRONTEND_PLAN.md).

---

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

No API key, no database, no backend required. The app ships with a mock API and
29 curated Madhya Pradesh destinations, and the map uses MapLibre with
OpenStreetMap tiles, which needs no access token.

```bash
npm run build        # production build
npm start            # serve the production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest — points, geofence, query and catalogue logic
```

---

## What is here

| Surface | Routes | Rendering |
|---|---|---|
| **Public** | `/`, `/explore`, `/states/*`, `/destinations/*`, `/circuits/*`, `/challenges/*`, `/leaderboards`, `/u/*`, `/search`, `/saved`, `/points`, `/responsible-travel` | SSR / SSG — SEO is the acquisition channel |
| **Admin** | `/admin`, `/admin/moderation`, `/admin/destinations`, `/admin/media`, `/admin/challenges`, `/admin/analytics`, `/admin/users`, `/admin/audit-logs`, `/admin/reports` | Client-heavy, `noindex`, role-gated |
| **Mock API** | `/api/v1/*` | Route handlers over an in-memory store |

### Highlights

- **`/destinations/[slug]`** — the core content unit. Gallery, why-go, things-to-do
  checklist, hour-by-hour itinerary, visitor info, hazards, accessibility, geofence
  map, crowd indicator, points rationale, nearby-within-100 km, reviews. Every one
  of the 29 listings is complete; there are no placeholder sections.
- **`/states/MP`** — "Places to visit in Madhya Pradesh", with `ItemList`, `FAQPage`
  and `BreadcrumbList` JSON-LD. The highest-value SEO page in the product.
- **`/admin/moderation`** — keyboard-first console. `A` approve, `R` reject,
  `→`/`J` next, `←`/`K` previous, `U` undo. Submitted photo, reference gallery, GPS
  against the geofence and all seven verification signals side by side.
- **`/admin/destinations/[slug]`** — the CMS, including a geofence editor with
  pin+radius, polygon and a live containment tester that applies the same rule the
  server does.

---

## Where the data comes from

Three layers. Only the bottom one changes when the real API lands.

```
  Components and pages
        │  import typed functions only — nothing calls fetch directly
        ▼
  src/lib/api/server.ts  (RSC)   ·   src/lib/api/client.ts  (browser)
        │
        ├── NEXT_PUBLIC_API_BASE_URL unset (default)
        │     ├── server: reads src/mocks/db.ts in-process (fast SSG, no absolute-URL problem)
        │     └── browser: fetches /api/v1/* route handlers
        │
        └── NEXT_PUBLIC_API_BASE_URL set → both go to that host over HTTP
```

Point `NEXT_PUBLIC_API_BASE_URL` at Member B's NestJS API and every call in the
app goes there. **No component changes.**

- `src/lib/types.ts` mirrors the entities in PRD §7 and the responses in PRD §8.
  Regenerate it from the OpenAPI spec when that exists; nothing else should
  redeclare these shapes.
- `src/app/api/v1/**` honours the real query parameters, pagination envelope and
  error shape, so the contract is exercised rather than approximated.
- Mutations (moderation decisions, destination edits) live in module state. They
  survive within a server process and reset on restart — it is a mock, and it
  should not pretend to be a database.

### Environment

Copy `.env.example` to `.env.local`. Everything is optional.

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | unset → `/api/v1` | Point at the live API |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical origin for metadata, sitemap and OG URLs |
| `NEXT_PUBLIC_MAP_STYLE_URL` | unset → OSM raster | A Mapbox or MapLibre style URL |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | unset | Required only with a `mapbox://` style |

---

## Content

`src/mocks/seed/` holds 29 hand-curated Madhya Pradesh destinations, deliberately
weighted toward the long tail — **17 of 29 are Tier 3 or 4**. A catalogue that
mirrored existing footfall would reinforce it; the content has to embody the
redistribution thesis, not just the points table.

`src/mocks/seed/factory.ts` defines the field list, which doubles as the column
schema for the shared content-curation sheet.

**Imagery ships unlicensed on purpose.** A `bt://gradient/...` URL renders a
generated tier-tinted panel instead of a photo, and the `attribution` / `licence`
fields are left blank rather than fabricated. The media library flags every
uncleared image and the CMS publish checklist blocks on it. Swap in a real
`https://` URL and fill in the two fields, and `next/image` takes over — a data
change, not a code change.

---

## Design system

One token set in `src/app/globals.css`, shared by both surfaces so the app and
the web read as one product. Light and dark, `prefers-color-scheme` with a
`.dark` class override.

The load-bearing part is the **tier scale** — grey → teal → ochre → red for
Tier 1 → 4 — used identically on badges, map pins, charts and OG images. How
rare a place is should be legible anywhere in the app without reading a number.

---

## Conventions worth knowing

- **Filters live in the URL.** `/explore` state is query-string only, so a
  filtered view is shareable, bookmarkable, back-button-safe and indexable.
  `src/lib/api/params.ts` is the single serialise/parse implementation, and it is
  round-trip tested.
- **The default sort favours the long tail.** `recommended` sorts by tier before
  rating. A popularity sort would undo the product thesis.
- **Nearby is ordered by tier before distance.** That list is the redistribution
  engine, not a convenience.
- **Nothing calls `Math.random()`** in the mock layer — seed data must be
  identical on the server and the client or hydration breaks. `src/mocks/seed/rand.ts`
  is a seeded PRNG.
- **RBAC in `src/lib/rbac.ts` is presentation only.** It decides what the admin UI
  shows. Real enforcement is server-side on every endpoint, as PRD §11 requires.
  The sidebar role switcher exists to demonstrate the eight roles.
- **Maps are client-only.** MapLibre touches `window` at import time, so `MapView`
  is always loaded through `next/dynamic`.

---

## Not built here

Cut to Phase 2 by TEAM_PLAN Option A, or owned by another member:

Trip builder (F7) · custom lists (F8) · partner portal (F26) · rewards
marketplace (F16) · real auth and uploads · ML scene matching · multilingual ·
offline · the mobile app (Member A) · the API, points ledger and verification
pipeline (Member B).
