# Team Plan — 3-Person Split

**Companion to [PRD.md](./PRD.md) · MVP (v1) scope only**

| Field | Value |
|---|---|
| Team size | 3 |
| Target | MVP per PRD §12.1 |
| Realistic timeline | 20 weeks (5 months) part-time, ~14 weeks full-time |
| Date | 2026-09-20 |

---

## ⚠️ Read this first — scope reality check

The PRD scoped MVP for **4–6 people**. With 3, something has to give. You have three honest options:

| Option | What changes | Recommendation |
|---|---|---|
| **A. Cut scope** | 1 pilot state not 2 · 150 destinations not 300 · drop Trip Builder (F7) and Lists (F8) to Phase 2 | ✅ **Do this** |
| **B. Extend timeline** | Keep full scope, ship in 7–8 months | Risky — momentum dies |
| **C. Add a 4th** | Ideally a content/ops person, not a 4th engineer | Best if possible |

This plan assumes **Option A**. Deltas from the PRD are marked 🔻.

**The silent critical path is content, not code.** 150 destinations × (description + 5–8 things to do + itinerary + full visitor info + geofence + photos) is ~120–200 hours of research. If all three of you only write code until week 15, you will ship a beautiful empty app. Content starts **week 1** and runs in parallel for everyone.

---

## The split at a glance

```
┌─────────────────┐   ┌──────────────────┐   ┌─────────────────┐
│   MEMBER A      │   │    MEMBER B      │   │   MEMBER C      │
│  Mobile App     │◄──┤  Backend & Core  ├──►│  Web, Admin &   │
│  (React Native) │   │  Platform        │   │  Content        │
│                 │   │                  │   │                 │
│ What travellers │   │ API, DB, points, │   │ What admins and │
│ touch           │   │ verification     │   │ Google see      │
└─────────────────┘   └──────────────────┘   └─────────────────┘
        │                      │                      │
        └──────── shared: content curation ───────────┘
                  (50 destinations each)
```

**Why this split:** each member owns one deployable artifact end-to-end, so nobody waits on a code review to ship. B is the natural bottleneck — which is why **week 1 is a frozen API contract + mock server**, so A and C can build against fake data from day 2 and never block.

---

## MEMBER A — Mobile App Lead

> **Owns:** the React Native app. Everything a traveller touches.
> **PRD features:** F1–F6, F9, F10 (client), F12–F14 (display), F15 (display), F17, F20 (report flow)

### Deliverables

| # | Screen / flow | Notes |
|---|---|---|
| 1 | Onboarding + phone OTP auth | Token storage, refresh handling, logged-out browse mode |
| 2 | Home + state/district picker | Also "Near me" and "Anywhere in India" |
| 3 | Category & filter sheet | Multi-select categories, duration, difficulty, season |
| 4 | Destination list + map toggle | Pin clustering, filter-on-map |
| 5 | **Destination detail** | The single most important screen. Gallery, why-go, things-to-do checklist, itinerary, visitor info accordion, nearby carousel, points badge, reviews |
| 6 | Search | Typo tolerance handled server-side; you own UX + recent searches |
| 7 | **Check-in flow** | Geofence prompt → in-app camera → GPS capture → submit → pending/approved state → points animation. Hardest flow in the app. |
| 8 | Profile | Badge wall, **India map that fills in by state** (the retention artifact — make it beautiful), stats, check-in history |
| 9 | Leaderboards | National / state tabs, own-rank pinning, period toggle |
| 10 | Challenges | List + detail + progress bars |
| 11 | Reviews | Write (check-in gated) + read + report |
| 12 | Notifications | Push registration, check-in result, challenge nudges |

🔻 **Cut from MVP:** Trip builder (F7), custom lists (F8). Keep a single flat "Saved" list only.

### Stack
Expo (managed) · React Navigation · TanStack Query · Zustand · `expo-camera` · `expo-location` · `react-native-maps` or Mapbox · `react-native-reanimated` (points/badge animations) · MMKV cache

### Watch out for
- **Camera + location permissions on Android** are a swamp — budget 3× your estimate, test on real low-end devices, handle "denied forever"
- **Map perf** with 300+ pins — cluster server-side or use a viewport query, don't render all pins
- **The check-in must feel instant.** Optimistic UI: show "submitted" immediately, resolve points async
- Poor connectivity is the norm at Tier-4 destinations — cache aggressively, queue failed check-in submissions for retry

### Definition of done
App runs on Android 9+, all 12 flows work against staging, cold start < 3 s, works on 3G, crash-free rate > 99%.

---

## MEMBER B — Backend & Platform Lead

> **Owns:** the API, the database, and every rule that decides whether a check-in is real and what it's worth.
> **PRD features:** F10 (server), F11, F13, F14 (compute), F15 (engine), F18, F19, plus all APIs in §8

### Deliverables

| # | Module | Notes |
|---|---|---|
| 1 | **API contract + mock server** | **WEEK 1, non-negotiable.** OpenAPI spec, frozen, mock server deployed. Unblocks A and C. |
| 2 | DB schema + migrations | 28 entities per PRD §7, PostGIS enabled, seed scripts |
| 3 | Auth + RBAC | OTP send/verify, JWT + refresh rotation, role guards on every endpoint |
| 4 | Destinations service | List with 8 filter dimensions, detail, **PostGIS `nearby` query**, search |
| 5 | Media service | S3 signed uploads, thumbnail generation, EXIF retained privately / stripped publicly |
| 6 | **Check-in service** | Idempotency keys, transactional, never double-awards |
| 7 | **Verification pipeline** | Async BullMQ jobs: geofence containment → timestamp window → pHash duplicate → mock-location flag → impossible-velocity → route to auto-approve or manual queue |
| 8 | **Points ledger** | Append-only, every award traceable to a source, reversible by moderators without corrupting balances |
| 9 | Badge engine | Criteria evaluated on check-in event, idempotent, backfillable |
| 10 | Challenges engine | Progress tracking, multipliers, completion detection |
| 11 | Leaderboards | Redis sorted sets for live rank + scheduled snapshot job. **Never compute live from the ledger.** |
| 12 | Moderation + reports API | Queue endpoints, decision endpoint, enforcement actions |
| 13 | Audit log | Middleware on all admin writes, immutable |
| 14 | Infra | Docker, CI/CD, staging + prod on AWS Mumbai, Redis, backups, monitoring/Sentry |

### Stack
NestJS (TypeScript) · PostgreSQL 16 + **PostGIS** · Redis + BullMQ · S3/R2 · `sharp` + `imghash` for pHash · Docker · GitHub Actions

### Watch out for
- **The points ledger is financial-grade.** Double-awarding points destroys leaderboard trust permanently. Unique constraint on `(user_id, destination_id, day)`, idempotency keys, transactional awards. Write tests for this before writing the feature.
- **Geofence containment** = `ST_Contains` / `ST_DWithin`. Account for GPS accuracy — accept if `accuracy_m` circle intersects the fence, don't demand a perfect point-in-polygon.
- Impossible-velocity check needs the user's *previous approved* check-in, and must not false-positive on flights.
- Don't build ML scene matching. It's Phase 2. Manual queue is fine at MVP volume.

### Definition of done
OpenAPI spec matches implementation, > 70% test coverage on points + verification, p95 latency < 300 ms, staging and prod deployed, moderation queue drains correctly.

---

## MEMBER C — Web, Admin & Content Lead

> **Owns:** the admin dashboard, the public web presence, and the destination data itself.
> **PRD features:** F22–F27, plus public SEO pages and analytics instrumentation

### Deliverables

| # | Item | Notes |
|---|---|---|
| 1 | Admin shell + auth | Role-scoped nav (Moderator / State Admin / Super Admin see different things) |
| 2 | **Destination CMS** | Rich editor, things-to-do repeater, itinerary builder, visitor-info forms, **geofence drawing on a map**, tier assignment, publish workflow |
| 3 | Media library | Upload, crop, caption, set hero, rights/attribution field |
| 4 | **Moderation console** | Side-by-side: submitted photo + reference gallery + GPS pin on map + all verification signals + user trust history. Keyboard shortcuts for approve/reject. Bulk actions. This is where moderator hours are won or lost — make it fast. |
| 5 | Challenge creator | Destination multi-select, criteria builder, date range, multiplier, preview |
| 6 | Analytics dashboards | Footfall by destination/district/category · **Tier-3+4 share** (the headline KPI) · visitor origin flows · seasonality · campaign lift · CSV export |
| 7 | User management | Search, trust score, enforcement actions, appeal handling |
| 8 | Audit log viewer | Filterable, exportable |
| 9 | **Public SEO site** | SSR destination pages + "Places to visit in {state}" hub pages. This is the cheapest acquisition channel that exists for this product — treat it as a feature, not a marketing afterthought. Schema.org `TouristAttraction` markup, sitemap, OG images. |
| 10 | **Content pipeline** | Sheet → validated CSV → bulk import tool. Content style guide so all three members write consistently. |
| 11 | Analytics instrumentation | PostHog events across app + web, Metabase dashboards |

### Stack
Next.js 14 (App Router) · Tailwind + shadcn/ui · TanStack Table · Mapbox GL Draw (geofences) · Recharts · PostHog · Vercel (web) / AWS (admin)

### Watch out for
- **Build the CMS before the content sprint, not after.** Everyone else is blocked on it for data entry from ~week 8.
- Geofence drawing is fiddlier than it looks — support both "draw polygon" and "drop pin + radius", because 90% of destinations only need the latter.
- Don't gold-plate the analytics. Two charts that a tourism officer actually understands beat twelve they don't.
- The moderation console is used for hours at a time. Keyboard-first. `A` approve, `R` reject, `→` next.

### Definition of done
Admin covers full destination lifecycle, moderator can clear 100 items/hour, SEO pages score > 90 Lighthouse, 150 destinations imported and published.

---

## Shared work — do these together

| Week | Activity | Why |
|---|---|---|
| **1** | **Freeze the API contract.** All three in a room, walk every endpoint in PRD §8, B writes the OpenAPI spec, deploys a mock server. | The single highest-leverage thing you will do. Prevents all blocking. |
| **1** | DB schema review | Everyone should understand `check_ins` — it's the hinge entity all three of you touch |
| **1–2** | Design system in Figma | Colours, type, components. Shared by app and web. Agree once, never argue again. |
| **1–2** | Repo, CI, env, branch strategy | Monorepo (Turborepo) or 3 repos — decide and commit |
| **1–20** | **Content curation — 50 destinations each** | 2–3 hours/week, every week, all 20 weeks. Not a sprint at the end. |
| **11–14** | Integration weeks | Pair across boundaries. A+B on check-in, B+C on moderation |
| **18–20** | QA + beta | Everyone tests everything on real devices in real locations |

### Content ownership split
Divide by **geography, not by task** — one person owns a district end-to-end so the voice stays consistent and the research compounds.

- **A** → districts 1–5 · **B** → districts 6–10 · **C** → districts 11–15

Use a shared Google Sheet with the exact column schema C defines in week 2. Photos: official tourism board imagery (check licence), Wikimedia Commons, or your own — log the source for every image.

---

## Timeline

| Weeks | A — Mobile | B — Backend | C — Web/Admin | Milestone |
|---|---|---|---|---|
| 1–2 | Setup, design system, nav skeleton | **API spec + mock server**, schema, auth | Admin shell, content schema | 🎯 Contract frozen |
| 3–6 | Discovery: picker, filters, list, map, detail | Destinations API, PostGIS, media, search | Destination CMS + geofence tool | 🎯 Browse works end-to-end |
| 7–10 | Check-in flow, camera, profile | Check-in + verification + points ledger | Moderation console | 🎯 **First real verified check-in** |
| 11–14 | Leaderboards, badges, challenges, reviews | Badges, challenges, leaderboards, moderation API | Analytics, challenge creator, user mgmt | 🎯 Gamification loop closed |
| 15–17 | Polish, offline handling, push, perf | Hardening, rate limits, load test, prod | **SEO site**, bulk content import | 🎯 150 destinations live |
| 18–20 | Bug fix, device testing | Monitoring, fraud tuning | Dashboards, launch content | 🎯 **Closed beta → launch** |

**Hard gate at week 10.** If a real verified check-in doesn't work on a real phone at a real destination by then, cut challenges and reviews from MVP and protect the core loop. Everything else in this app is decoration around that one interaction.

---

## Risks specific to a 3-person team

| Risk | Mitigation |
|---|---|
| B is a bottleneck for both others | Week-1 mock server; A and C never wait on real endpoints |
| Bus factor of 1 on every component | Weekly 30-min architecture walkthrough; everyone can run the whole stack locally |
| Content starts too late | Weekly quota, tracked publicly in the sheet. Treat a missed content week like a missed sprint. |
| Integration hell at week 15 | Integrate continuously from week 3 against staging, never "integration phase" |
| Scope creep from the PRD's Phase 2/3 list | The PRD is the vision. **This doc is the contract.** Anything not listed here is a "no" until launch. |
