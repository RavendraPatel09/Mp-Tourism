# Frontend Plan — YatraGo Web

**Companion to [../PRD.md](../PRD.md) and [../TEAM_PLAN.md](../TEAM_PLAN.md) · MVP (v1) scope**

| Field | Value |
|---|---|
| Artifact | `frontend/` — single Next.js app serving both the public web product and the admin/government dashboard |
| Owner | Member B (this repo's assignment; note TEAM_PLAN.md nominally scopes web to Member C) |
| Date | 2026-09-20 |
| Status | Plan → implementation |

---

## 1. What this app is

One Next.js 15 App Router application with two distinct surfaces sharing a design system, type layer and API client:

| Surface | Route prefix | Rendering | Audience |
|---|---|---|---|
| **Public web** | `/`, `/explore`, `/states/*`, `/destinations/*`, `/circuits/*`, `/leaderboards`, `/challenges/*`, `/u/*` | SSR / static where possible — SEO is the acquisition channel (PRD §13) | Travellers, search engines |
| **Admin & government** | `/admin/*` | Client-heavy, `noindex`, role-gated | Moderators, State Admins, Super Admins |

The Android app (Member A) and the NestJS API (the backend contract in PRD §8) are separate artifacts. This app consumes the same REST contract.

### Why one app, not two

Both surfaces need the same domain types, the same destination/tier/points vocabulary, the same map component and the same API client. Splitting them at MVP doubles the config and the shared-code problem for no benefit. They are separated by route group and layout, and `/admin` is excluded from the sitemap and robots.

---

## 2. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, React 19 | SSR destination pages per PRD §13; route handlers give us the mock API for free |
| Language | TypeScript, strict | Domain model is 28 entities — types are the cheapest documentation |
| Styling | Tailwind CSS v4 (CSS-first `@theme`) | No JS config to drift; design tokens live in one CSS file |
| UI primitives | Hand-written shadcn-style components in `src/components/ui` | No CLI/registry dependency, full control, ~12 primitives is all MVP needs |
| Server data | React Server Components + `fetch` | Public pages render on the server — good for SEO and first paint |
| Client data | TanStack Query v5 | Admin tables, filters, infinite lists, optimistic moderation decisions |
| Client state | Zustand | Filter state, saved places, mock session. Small and sufficient |
| Maps | MapLibre GL JS + OpenStreetMap raster tiles | API-compatible with Mapbox (PRD's pick) but needs **no access token** to run. Native GeoJSON clustering handles 300+ pins. Swap in a Mapbox style + token via env when there's a billing account |
| Charts | Recharts | Admin analytics, per TEAM_PLAN Member C stack |
| Icons | lucide-react | |
| Tests | Vitest (unit, on points/tier/filter logic) | The points/tier maths is the one place a silent frontend bug misleads users |

### Deliberately not used

- **No auth library.** MVP mock session is a Zustand store + a role switcher in the admin shell. Real JWT handling lands when Member B's auth endpoints exist — it is isolated to `lib/api/client.ts` and `store/session.ts`.
- **No CMS/rich-text SaaS.** The destination CMS is plain controlled forms; the "story" field is markdown in a textarea with preview.
- **No i18n.** PRD defers multilingual to Phase 2.

---

## 3. Data layer — how this runs before the backend exists

This is the core architectural decision. Three layers, and only the bottom one changes when the real API lands.

```
  Components / pages
        │  import typed functions only
        ▼
  src/lib/api/*        ← typed client: one function per PRD §8 endpoint
        │  fetch(`${API_BASE_URL}${path}`)
        ▼
  NEXT_PUBLIC_API_BASE_URL
        │
        ├── default  "/api/v1"  → src/app/api/v1/**  (mock route handlers, in-memory seeded store)
        └── set to   "https://staging.../v1" → Member B's real NestJS API
```

- **`src/lib/types.ts`** mirrors PRD §7 entities and §8 response shapes. Single source of truth for both surfaces.
- **`src/lib/api/`** — one function per endpoint, typed in and out, no component ever calls `fetch` directly.
- **`src/app/api/v1/**`** — Next route handlers implementing the PRD §8 paths against an in-memory store. They honour real query params (`state`, `categories`, `duration`, `difficulty`, `tier`, `near`, `radius`, `sort`, `page`), real pagination, and real error shapes, so swapping to the live API is a config change, not a rewrite.
- **`src/mocks/seed/`** — ~24 hand-curated real Madhya Pradesh destinations spanning all four tiers, plus states, districts, categories, challenges, leaderboard rows, reviews and check-ins. This doubles as the content-schema reference for the shared curation sheet (TEAM_PLAN "Content pipeline").

**Contract drift guard:** when Member B publishes the OpenAPI spec, `src/lib/types.ts` gets regenerated from it and the mock handlers are validated against it. Until then, this app *is* the working reference for what the frontend expects.

---

## 4. Public surface — routes and content

| Route | PRD feature | Rendering | Notes |
|---|---|---|---|
| `/` | F1 | Static + server data | Hero, state picker, category tiles, "Tier 4 spotlight" (the redistribution pitch, above the fold), featured circuits, live leaderboard strip |
| `/explore` | F1–F2, F4, F6 | Server shell + client filters | The workhorse. Filter rail (categories, duration, difficulty, tier, season, accessibility) + result grid + **map toggle** with clustered pins. Filters are URL state, so a filtered view is shareable and indexable |
| `/states` | F1 | Static | All 28 states + 8 UTs grid; MP marked live, the rest "coming soon" |
| `/states/[code]` | F1 | SSR | **"Places to visit in Madhya Pradesh"** — the highest-value SEO page in the product. District breakdown, top destinations by tier, categories, FAQ block |
| `/destinations/[slug]` | **F3** | SSR + JSON-LD | The core content unit. Gallery · why-go · things-to-do checklist · duration · hour-by-hour itinerary · visitor info accordion · location + access · accessibility flags · crowd/capacity indicator · **nearby within 25/50/100 km** · points value with tier explainer · reviews |
| `/circuits/[slug]` | F4 | SSR | Multi-day route, ordered stops, map polyline, total points |
| `/search` | F5 | Client | Debounced, typo-tolerant server-side, recent searches in localStorage |
| `/leaderboards` | F14 | Client | National / state tabs, month / all-time toggle, own-rank pinning |
| `/challenges`, `/challenges/[id]` | F15 | SSR | Active/upcoming/past, progress bars, destination checklist, multiplier badge |
| `/u/[username]` | F17 | SSR | Public profile: level, badge wall, **India map that fills in by state**, stats, top photos |
| `/saved` | F8 (cut to flat list) | Client | Single "Want to visit" list, localStorage-backed at MVP |
| `/responsible-travel` | F21 | Static | Leave-no-trace, eco-sensitive policy. Also a trust signal for government partners |

### SEO implementation (treated as a feature, not an afterthought)

- `generateMetadata` on every dynamic route: title, description, canonical, OG/Twitter.
- **JSON-LD**: `TouristAttraction` on destination pages, `ItemList` on state hubs, `BreadcrumbList` everywhere, `FAQPage` on state hubs.
- Dynamic OG images via `next/og` — destination name, state, tier badge, points.
- `sitemap.ts` (states, destinations, circuits, challenges) and `robots.ts` (disallow `/admin`, `/api`).
- Semantic headings, real `<a>` navigation, images through `next/image` with explicit dimensions.
- Target: Lighthouse > 90 on destination and state hub pages (TEAM_PLAN definition of done).

---

## 5. Admin surface — routes

| Route | PRD feature | Notes |
|---|---|---|
| `/admin` | — | Overview: moderation queue depth + SLA, today's check-ins, Tier-3+4 share, recent audit entries |
| `/admin/destinations` | F22 | Filterable table: status, tier, district, completeness %. Bulk publish |
| `/admin/destinations/[id]` | **F22** | Tabbed editor — Basics · Content (story, things-to-do repeater with drag order) · Itinerary builder (day → stops → duration) · Visitor info (timings, fees, facilities, hazards, emergency contacts) · **Geofence** · Media · Publish. Autosave draft, completeness meter, diff-vs-published preview |
| `/admin/destinations/[id]` → Geofence tab | F22 | **Pin + radius** (the 90% case per TEAM_PLAN) and **polygon draw**, both on a MapLibre canvas, with a live containment tester |
| `/admin/media` | F22 | Library: upload, hero selection, caption, licence/attribution field (required — TEAM_PLAN flags image rights) |
| `/admin/moderation` | **F23** | The hours-are-won-or-lost screen. Submitted photo beside reference gallery, GPS pin on map, every verification signal (geo/time/mock-location/pHash/velocity) as a pass-fail row, user trust history. **Keyboard-first: `A` approve, `R` reject, `→` next, `U` undo.** Bulk actions, SLA timer per item |
| `/admin/reports` | F20 | User reports on photos, reviews, profiles |
| `/admin/challenges` | F24 | List + creator: destination multi-select, criteria builder, date range, multiplier, reward points, live preview of the traveller-facing card |
| `/admin/analytics` | **F25** | Footfall over time · **Tier-3+4 share (the headline KPI, given its own hero tile)** · by district · by category · visitor origin flows · seasonality · campaign lift · CSV export. Deliberately few charts, each legible to a tourism officer |
| `/admin/users` | F19 | Search, trust score, check-in history, graduated enforcement actions |
| `/admin/audit-logs` | F27 | Filterable by actor/entity/action/date, exportable, read-only |

### RBAC in the UI

`src/lib/rbac.ts` maps the 8 PRD roles to capability flags; the shell filters nav and pages guard on capability. A role switcher (dev-only, visible while the session is mocked) lets us demo Moderator vs. State Admin vs. Super Admin views. **This is presentation-layer only** — real enforcement is server-side on Member B's endpoints, as PRD §11 requires.

---

## 6. Design system

Single token set in `src/app/globals.css` via Tailwind v4 `@theme`, shared by both surfaces so the app and web stay visually one product (TEAM_PLAN week 1–2 shared work).

- **Palette**: deep indigo primary (trust/government), warm terracotta accent (heritage), and a **tier scale** — Tier 1 slate → Tier 4 amber-gold — used consistently on badges, map pins and charts so tier reads instantly anywhere.
- **Type**: one sans stack, fluid scale, generous measure on destination prose.
- **Components**: Button, Card, Badge, Input, Select, Checkbox, Textarea, Tabs, Dialog, Sheet, Accordion, Table, Skeleton, Toast, Progress, Tooltip, EmptyState.
- **Domain components**: `TierBadge`, `PointsPill`, `DestinationCard`, `FilterRail`, `MapView`, `ThingsToDoList`, `ItineraryTimeline`, `VisitorInfoAccordion`, `NearbyCarousel`, `CrowdIndicator`, `IndiaMap`, `BadgeWall`, `LeaderboardTable`, `ChallengeCard`, `GeofenceEditor`, `VerificationSignals`, `DataTable`, `StatTile`.
- Dark mode via `prefers-color-scheme` + class override; all tier colours validated for contrast in both.

---

## 7. Build order

| Step | What | Unblocks |
|---|---|---|
| 1 | Scaffold, tooling, Tailwind tokens, UI primitives | everything |
| 2 | `types.ts` + seed content + mock route handlers + typed API client | every screen |
| 3 | Public shell, home, `/states`, `/states/[code]` | SEO spine |
| 4 | `/explore` — filters, grid, map | discovery loop |
| 5 | **`/destinations/[slug]`** — the core content unit + JSON-LD | the product |
| 6 | Search, circuits, leaderboards, challenges, profile, saved | public surface complete |
| 7 | Admin shell + RBAC + destinations table | admin spine |
| 8 | **Destination CMS + geofence editor** | content sprint (TEAM_PLAN: needed by ~wk 8) |
| 9 | **Moderation console** | first verified check-in gate (wk 10) |
| 10 | Challenges creator, analytics, users, audit log | admin complete |
| 11 | sitemap/robots/OG, metadata sweep, a11y pass, build | launch-ready |

---

## 8. Definition of done

- `npm run build` clean, `tsc --noEmit` clean, lint clean.
- Every public route renders server-side with correct metadata and JSON-LD where applicable.
- Destination detail covers **every** field listed in PRD §5.1 F3 — no placeholder sections.
- Moderation console is fully keyboard-drivable; a moderator can clear an item without touching the mouse.
- Geofence editor supports pin+radius and polygon, and round-trips GeoJSON.
- Admin is `noindex` and absent from the sitemap.
- Pointing `NEXT_PUBLIC_API_BASE_URL` at a real server requires zero component changes.

## 9. Explicitly out of scope here

Trip builder (F7) and custom lists (F8) — cut to Phase 2 by TEAM_PLAN Option A · partner portal (F26) · rewards marketplace (F16) · real auth, real uploads, real payments · ML scene matching · multilingual · offline.
