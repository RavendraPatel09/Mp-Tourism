# PRD — Bharat Trails

**India Tourism Discovery & Exploration Platform**

| Field | Value |
|---|---|
| Working name | Bharat Trails (final naming TBD) |
| Version | 0.1 (Draft) |
| Date | 2026-09-20 |
| Owner | Product — Ravendra Patel |
| Status | For review |

---

## 1. Summary

Bharat Trails is a mobile-first platform that helps travellers discover what to explore in **any state or union territory of India**, filtered by what they actually care about — history, religion, nature, adventure, wildlife, food, culture, heritage.

Each destination ships with the things to do there, a suggested itinerary, realistic time estimates, location, and practical visitor information.

On top of discovery sits a **gamified exploration layer**: users check in at places, upload verified on-location photos, and earn points, badges and levels. State-wise and national leaderboards, seasonal challenges and partner rewards turn travel into progression.

The strategic wedge: **points are weighted to favour lesser-known destinations**. This deliberately pushes footfall away from the same twelve overcrowded landmarks and toward the thousands of under-visited forts, lakes, tribal-craft villages and eco-trails — spreading tourist spend into local economies and giving state tourism boards a measurable lever over visitor distribution.

---

## 2. Problem

| Stakeholder | Problem today |
|---|---|
| **Traveller** | Discovery is fragmented across blogs, YouTube, Instagram reels and outdated government PDFs. Hard to answer "I have 2 days in Chhattisgarh and I like waterfalls — where do I go?" |
| **Lesser-known destination** | Zero digital visibility. A 12th-century stepwell 40 km off the highway gets no traffic while the state capital's fort is at carrying capacity. |
| **Local economy** | Homestays, guides, craft sellers and dhabas near non-marquee sites have no demand channel. |
| **State tourism board** | No live, granular data on where domestic tourists actually go, why they skip certain circuits, or whether a promotion campaign moved footfall. |
| **Sustainability** | Over-tourism degrades marquee sites while capacity elsewhere sits idle. |

**Insight:** people don't avoid lesser-known places because they dislike them — they avoid them because they've never heard of them and can't assess whether the detour is worth it. Discovery plus a reason to go (points, badges, status) fixes both.

---

## 3. Goals & Non-Goals

### 3.1 Goals

| # | Goal | Success measure (12 months post-launch) |
|---|---|---|
| G1 | Become the default "what should I explore here" app for domestic travel | 250k MAU |
| G2 | Redistribute footfall toward lesser-known sites | ≥ 35% of verified check-ins at Tier-2/Tier-3 destinations |
| G3 | Make exploration habit-forming | D30 retention ≥ 22%; ≥ 3 check-ins per active explorer per quarter |
| G4 | Prove measurable value to at least 2 state tourism boards | 2 signed government partnerships / MoUs |
| G5 | Generate real local economic activity | 10k+ partner offer redemptions |
| G6 | Maintain trust in the leaderboard | < 2% fraudulent check-ins surviving moderation |

### 3.2 Non-Goals (explicitly out of scope for v1)

- Not an OTA. We do not build flight/hotel inventory or payments for bookings in MVP — we deep-link out.
- Not a social network. No DMs, no follower feeds in MVP.
- Not an international travel product. India only.
- Not a ticketing/permit-issuing authority. We surface official links.
- No user-generated *destinations* in MVP — the catalogue is curated to protect data quality.

---

## 4. Users & Roles

### 4.1 Personas

| Persona | Profile | Primary need |
|---|---|---|
| **Aarav, 23 — The Collector** | Student, weekend rider, competitive | Status. Wants to top the state leaderboard and "complete" a circuit. Core gamification user. |
| **Sneha, 34 — The Planner** | IT professional, travels 4×/year with family | A trustworthy 2-day itinerary with time estimates and practical info. Barely cares about points. |
| **The Sharmas, 50s — Pilgrimage travellers** | Religious circuit travel | Temple timings, darshan info, accessibility, nearby stays. |
| **Ramesh, 41 — Homestay owner** | Runs 4 rooms near an under-visited lake | Visibility and footfall. Partner-side user. |
| **Ms. Iyer — State Tourism Officer** | Govt. tourism department | Live footfall data, campaign levers, content control over official listings. |

### 4.2 Roles & permissions

| Role | Capabilities |
|---|---|
| **Guest** | Browse destinations, search/filter, view itineraries and maps. No check-in, no save. |
| **Explorer** (registered) | All guest rights + check-in, photo upload, points/badges, leaderboards, saved places, reviews, trip planning. |
| **Verified Explorer** | Explorer + phone-verified + trust score above threshold. Eligible for high-value rewards and faster photo auto-approval. |
| **Local Guide** (earned, L5+) | Can suggest new destinations and edit corrections; submissions enter review queue. Earns contribution points. |
| **Partner** (business) | Manages own business listing, offers, redemption validation. Sees own footfall analytics only. |
| **Moderator** | Works the photo/review moderation queue, issues warnings, reverses points. |
| **State Admin** (govt) | Full CRUD on destinations within their state, creates state challenges, sees state analytics, approves official content. |
| **Super Admin** | Platform-wide config, role management, fraud tooling, national challenges, audit log access. |

---

## 5. Core Features

### 5.1 Discovery

**F1 — Location picker.** State → district/city → optional region. Plus "Near me" (GPS radius) and "Anywhere in India" for inspiration browsing.

**F2 — Interest filters.** Multi-select categories: Historical, Cultural, Religious, Nature, Adventure, Wildlife, Food, Heritage, Architecture, Offbeat, Waterfalls, Lakes & Rivers, Tribal & Craft, Museums, Sunrise/Sunset points.

Secondary filters: time available (2h / half-day / full-day / multi-day), difficulty (easy → strenuous), budget band, family/solo/accessible-friendly, best season, distance from me.

**F3 — Destination detail page.** The core content unit:

- Hero gallery (official + top community photos)
- One-paragraph "why go" + historical/cultural context
- **Things to explore/do** — a concrete checklist, not prose ("Climb to the Baradari for the valley view", "Catch the 6 pm aarti", "Try bafla at the stalls outside Gate 2")
- **Estimated time** — minimum and recommended duration
- **Suggested itinerary** — hour-by-hour plan for the site and its immediate cluster
- **Location** — map pin, road access notes, last-mile advice, parking
- **Visitor info** — timings, entry fee, best season, best time of day, photography rules, dress code, guide availability, washroom/food availability, network coverage, nearest ATM/hospital, official website link
- **Accessibility** — wheelchair, senior-friendly, child-friendly flags
- **Crowd & capacity indicator** — typical crowd level by day/season; "high pressure" badge on over-visited sites
- **Nearby** — other destinations within 25/50/100 km (this is the redistribution engine)
- **Points value** — what a verified check-in here is worth, and why
- Reviews, community photos, save button, "Add to trip"

**F4 — Curated circuits.** Editorially built multi-day routes ("Bundelkhand Fort Trail — 4 days, 7 stops"). Circuits are also challenge containers.

**F5 — Search.** Text search across names, categories, descriptions with typo tolerance and regional-language aliases (e.g. "Khajurao" → Khajuraho).

**F6 — Maps.** Cluster pins by category, filter on map, route preview, deep-link to Google Maps for turn-by-turn.

**F7 — Trip planner.** Create a trip (name, dates, state), add destinations, auto-order by geography, see per-day time budget with travel time between stops, flag over-packed days, export/share as a read-only link.

**F8 — Saved places & lists.** Bookmark to default "Want to visit" or custom lists.

**F9 — Reviews & tips.** 1–5 star + text + optional photo. Structured "tip" field ("Go before 9 am to avoid tour buses"). Reviews only from users with a verified check-in at that destination — this is a key quality and trust decision.

### 5.2 Gamification

**F10 — Check-in.** The atomic action. User is physically at a destination, opens the app, takes a photo **through the in-app camera**, and submits. Requires GPS inside the destination geofence.

**F11 — Points engine.**

| Action | Base points |
|---|---|
| Verified check-in — Tier 1 (marquee, e.g. Taj Mahal) | 10 |
| Verified check-in — Tier 2 (known, regional) | 30 |
| Verified check-in — Tier 3 (lesser-known / offbeat) | 75 |
| Verified check-in — Tier 4 (rare / remote / newly listed) | 150 |
| Quality photo accepted into destination gallery | +25 |
| First-ever verified check-in at a destination ("Pioneer") | +100 |
| Detailed review (≥ 100 chars, with photo) | +15 |
| Completing a circuit/challenge | 200–1000 |
| Accepted destination correction (Local Guides) | +20 |
| Eco-pledge honoured / clean-up drive participation | +50 |

Multipliers: off-season visit ×1.5 · monsoon-only site in season ×1.5 · state challenge active ×2 · new destination bonus ×2 (first 90 days of listing).

Tier is assigned by the platform from annual footfall + review volume + state board input, and is **re-evaluated quarterly** — a site that becomes popular drops in tier, keeping the incentive pointed at the long tail.

**F12 — Levels.** Explorer → Wanderer → Pathfinder → Trailblazer → Voyager → Legend, at cumulative point thresholds. Levels unlock capabilities (Local Guide at L5) and reward tiers.

**F13 — Badges & achievements.**

- *Geographic*: "Madhya Pradesh Explorer" (10 destinations in state), "State Completionist" (80% of a state's listed destinations), "All 28+8" (a check-in in every state and UT)
- *Thematic*: "Fort Hunter" (15 forts), "Waterfall Chaser", "Wildlife Tracker" (5 national parks), "Temple Trail", "Street Food Scout"
- *Behavioural*: "Pioneer" (first check-in at any destination), "Off the Map" (20 Tier-4 check-ins), "Monsoon Soul", "Sunrise Club"
- *Contribution*: "Chronicler" (50 accepted photos), "Cartographer" (10 accepted corrections)

**F14 — Leaderboards.** National · State · District · Friends · Seasonal (monthly reset). Ranked by points earned in the window, with all-time as a separate board. Anti-farming: only the highest-value check-in per destination per user counts toward leaderboard points, and per-day point caps apply.

**F15 — Challenges.** Time-boxed, created by admins or state boards:
- *Circuit challenges* — "Visit 5 of 7 Bundelkhand forts before 31 Dec"
- *Discovery challenges* — "3 Tier-4 destinations this month"
- *Seasonal/event* — "Khajuraho Dance Festival week"
- *Government campaign* — a state board pushing a new circuit, with sponsored rewards

**F16 — Rewards.** Points redeemable for: partner discounts (homestays, cafés, guides, adventure operators), state tourism vouchers (MPTDC-style property discounts), free/discounted entry where boards agree, merchandise, and non-monetary status (profile frames, featured explorer spot). Redemption generates a time-limited QR code validated by the partner in the Partner app.

**F17 — Profile.** Public: username, level, badge wall, states visited map (fills in as you travel — a strong retention artifact), stats, top photos. Private: full check-in history, trips, points ledger.

### 5.3 Trust & Integrity

**F18 — Photo verification pipeline.** Layered, automatic first:

1. **Capture constraint** — in-app camera only; gallery upload blocked for check-ins (allowed for non-scoring gallery contributions, which are flagged as such).
2. **Geo check** — device GPS must fall inside the destination geofence (radius per destination, 100 m–5 km for large parks).
3. **Time check** — capture timestamp within minutes of submission; server time authoritative.
4. **Spoof detection** — Android mock-location API check, root/jailbreak detection, emulator detection, impossible-velocity check against the user's previous check-in (e.g. Bhopal → Leh in 40 minutes).
5. **Duplicate check** — perceptual hash (pHash) against the platform's existing photo corpus and against the user's own history; blocks re-submitted and screenshot-of-screenshot images.
6. **Scene match** — ML similarity between the submission and reference imagery for that destination; low similarity routes to manual review rather than auto-rejecting.
7. **Trust-score routing** — high-trust users auto-approve and get points instantly; new or flagged users are held pending review.
8. **Human moderation** — queue for anything the pipeline flagged, plus a random audit sample of auto-approved submissions.

**F19 — Anti-fraud.** Device fingerprinting with device-to-account limits · per-day and per-destination check-in cooldowns · collusion detection (clusters of accounts checking in together repeatedly) · phone verification required before any monetary reward redemption · retroactive point reversal with audit trail · graduated enforcement: warning → points reversal → leaderboard suspension → ban.

**F20 — Content moderation.** Report flow on every review, photo and profile. Auto-screen for NSFW, violence, PII (faces of minors, visible number plates — blur or reject), and abusive text. Moderators act against a documented policy; users can appeal once.

**F21 — Sustainable tourism guardrails.** Carrying-capacity indicator on high-pressure sites; points for marquee sites deliberately low; "responsible traveller" pledge and badge; leave-no-trace tips on every listing; ability for a state admin to temporarily suppress promotion of an ecologically stressed site.

### 5.4 Admin / Government Dashboard (web)

**F22 — Destination CMS.** Full CRUD with rich content editor, media library, geofence drawing on a map, tier assignment, publish/unpublish, versioning and approval workflow (state admin edits → super admin publishes for cross-state consistency).

**F23 — Moderation console.** Photo queue with side-by-side reference imagery and all automated signals surfaced; bulk approve/reject; review queue; user report queue; SLA timers.

**F24 — Challenge & reward manager.** Create challenges, set point multipliers, define reward inventory and eligibility, monitor redemption burn-down and budget.

**F25 — Analytics.** Footfall by destination/district/category over time · Tier-3/4 share of check-ins (the redistribution KPI) · visitor origin-state flows · seasonality curves · campaign lift (before/after a challenge) · top-rising destinations · demographic breakdown · exportable CSV/PDF reports for the department. State admins see only their own state; super admins see national.

**F26 — Partner management.** Onboarding, verification (GSTIN/registration check), offer approval, redemption reconciliation.

**F27 — Audit log.** Every admin action recorded, immutable, queryable. Non-negotiable for government deployments.

---

## 6. Key User Journeys

### J1 — Discovery to visit (Sneha, planner)
Opens app → picks *Madhya Pradesh* → selects *Historical + Nature*, time = *2 days* → sees ranked list with a "Bundelkhand Fort Trail" circuit → opens Orchha detail page → reads things-to-do, 1.5-day itinerary, timings, entry fees → taps "Nearby", finds an unknown stepwell 18 km away that's Tier-4 → adds both to a trip → exports itinerary → shares with family.

### J2 — Check-in (Aarav, collector)
At the stepwell → app detects he's inside a geofence, surfaces a "Check in here — 150 pts" prompt → in-app camera → shoots the carved arch → submits → auto-verification passes in ~4 s → **+150 pts, +100 Pioneer bonus, "Off the Map" badge unlocked, state rank 214 → 168** → prompted: "You're 2 stops from finishing the Bundelkhand Challenge (800 pts)."

### J3 — Reward redemption
Profile → Rewards → "20% off at Riverside Homestay, Orchha — 500 pts" → phone already verified → redeem → time-limited QR → owner scans in Partner app → validated → points debited, partner sees the redemption in their dashboard.

### J4 — Moderation
User's submission fails scene-match → queued → moderator opens it with reference photos, GPS map pin, device signals and user trust history side-by-side → it's a genuine photo of an unlisted angle → approve → points credited → photo promoted into the destination gallery → user notified.

### J5 — Government campaign
State admin creates "Monsoon Waterfalls of Chhattisgarh" — 8 destinations, 2× multiplier, Aug 1–Sep 30, 500 state vouchers as rewards → publishes → push notification to users in/near the state → dashboard shows a 3.4× footfall lift at Tirathgarh vs. the prior year → exported as a campaign report.

### J6 — Partner
Homestay owner signs up → uploads registration proof → verified in 48 h → creates a 20%-off offer targeted at Level 3+ explorers → offer appears on nearby destination pages → tracks redemptions and footfall in the partner dashboard.

---

## 7. Data Model

Core entities (PostgreSQL + PostGIS):

| Entity | Key fields |
|---|---|
| `users` | id, phone, email, password_hash/oauth, role, created_at, status |
| `user_profiles` | user_id, username, display_name, avatar, bio, home_state, level, total_points, trust_score, is_phone_verified |
| `states` | id, name, code, type (state/UT), geometry, hero_media, description |
| `districts` | id, state_id, name, geometry |
| `destinations` | id, state_id, district_id, name, slug, description, story, location (POINT), geofence (POLYGON), geofence_radius_m, tier, status, best_season, min_duration_min, recommended_duration_min, difficulty, avg_budget, accessibility_flags, crowd_level, is_eco_sensitive, published_at, created_by |
| `categories` | id, name, slug, icon |
| `destination_categories` | destination_id, category_id (M:N) |
| `destination_info` | destination_id, timings (jsonb), entry_fees (jsonb), rules, facilities (jsonb), how_to_reach, parking, official_url, emergency_contacts |
| `things_to_do` | id, destination_id, title, description, duration_min, order_index |
| `itineraries` | id, destination_id \| circuit_id, title, total_duration_min, day_count |
| `itinerary_stops` | id, itinerary_id, day, order_index, destination_id, activity, start_time, duration_min, travel_notes |
| `circuits` | id, name, state_id, description, day_count, status |
| `circuit_destinations` | circuit_id, destination_id, order_index |
| `media` | id, owner_type, owner_id, url, thumb_url, type, source (official/community), phash, exif (jsonb), width, height, status |
| `check_ins` | id, user_id, destination_id, captured_at, submitted_at, device_lat, device_lng, accuracy_m, media_id, status (pending/approved/rejected), verification_score, points_awarded, rejection_reason |
| `verification_signals` | check_in_id, geo_pass, time_pass, mock_location, device_fingerprint, phash_match_id, scene_match_score, velocity_kmh, raw (jsonb) |
| `points_ledger` | id, user_id, delta, reason_code, ref_type, ref_id, balance_after, created_at, reversed_by |
| `badges` | id, code, name, description, icon, criteria (jsonb), tier |
| `user_badges` | user_id, badge_id, earned_at, ref_id |
| `challenges` | id, title, description, scope (national/state), state_id, type, criteria (jsonb), multiplier, starts_at, ends_at, reward_points, created_by, status |
| `challenge_progress` | user_id, challenge_id, progress (jsonb), completed_at, points_awarded |
| `rewards` | id, title, type, partner_id, state_id, points_cost, inventory_total, inventory_left, min_level, requires_verification, terms, valid_from, valid_to |
| `reward_redemptions` | id, user_id, reward_id, code, status, redeemed_at, validated_by |
| `partners` | id, name, type, owner_user_id, destination_id, address, location, registration_no, verification_status, contact |
| `reviews` | id, user_id, destination_id, rating, body, tip, media_id, check_in_id, status, helpful_count |
| `saved_places` / `lists` | list_id, user_id, name, destination_id, added_at |
| `trips` | id, user_id, title, state_id, start_date, end_date, is_public, share_slug |
| `trip_items` | trip_id, day, order_index, destination_id, planned_duration_min, notes |
| `leaderboard_snapshots` | scope, scope_id, period, user_id, rank, points, computed_at (materialized, refreshed on schedule) |
| `reports` | id, reporter_id, target_type, target_id, reason, status, resolved_by |
| `moderation_actions` | id, moderator_id, target_type, target_id, action, reason, created_at |
| `audit_logs` | id, actor_id, action, entity, entity_id, before (jsonb), after (jsonb), ip, created_at |
| `analytics_events` | id, user_id, event, properties (jsonb), session_id, created_at |

**Notable relationships:** a `check_in` is the hinge entity — it gates `reviews`, feeds `points_ledger`, drives `challenge_progress`, and is the atomic unit of every analytics footfall query.

---

## 8. API Surface (REST v1)

```
# Auth
POST   /v1/auth/register            POST /v1/auth/login
POST   /v1/auth/otp/send            POST /v1/auth/otp/verify
POST   /v1/auth/refresh             POST /v1/auth/logout

# Discovery
GET    /v1/states                   GET  /v1/states/:code/districts
GET    /v1/categories
GET    /v1/destinations             ?state&district&categories&duration&difficulty
                                    &tier&near=lat,lng&radius&season&sort&page
GET    /v1/destinations/:slug
GET    /v1/destinations/:id/nearby  ?radius=50
GET    /v1/destinations/:id/itinerary
GET    /v1/destinations/:id/reviews
GET    /v1/destinations/:id/photos
GET    /v1/circuits                 GET  /v1/circuits/:slug
GET    /v1/search                   ?q

# Check-in & gamification
POST   /v1/check-ins                (multipart: media, lat, lng, captured_at, device attestation)
GET    /v1/check-ins/:id            GET  /v1/me/check-ins
GET    /v1/me/points                GET  /v1/me/badges
GET    /v1/leaderboards             ?scope=national|state|district|friends&period=month|all&state=MP
GET    /v1/challenges               ?scope&state&active=true
GET    /v1/challenges/:id/progress
GET    /v1/rewards                  POST /v1/rewards/:id/redeem
GET    /v1/me/redemptions

# User content
POST   /v1/reviews                  PATCH/DELETE /v1/reviews/:id
POST   /v1/reports
GET/POST /v1/me/lists               POST /v1/me/lists/:id/items
GET/POST /v1/trips                  PATCH /v1/trips/:id   POST /v1/trips/:id/items
GET    /v1/trips/shared/:slug
GET    /v1/users/:username          (public profile)
GET/PATCH /v1/me/profile

# Partner
GET    /v1/partner/offers           POST /v1/partner/offers
POST   /v1/partner/redemptions/validate   { code }
GET    /v1/partner/analytics

# Admin
GET/POST/PATCH/DELETE /v1/admin/destinations
POST   /v1/admin/destinations/:id/publish
GET    /v1/admin/moderation/queue   POST /v1/admin/moderation/:id/decide
GET/POST /v1/admin/challenges       GET/POST /v1/admin/rewards
GET    /v1/admin/users              POST /v1/admin/users/:id/enforce
GET    /v1/admin/analytics/footfall ?state&from&to&granularity
GET    /v1/admin/analytics/redistribution
GET    /v1/admin/audit-logs
```

**Conventions:** JWT access + refresh tokens · cursor pagination on lists · `Idempotency-Key` required on `POST /check-ins` and `/redeem` · rate limits per user and per IP · all write endpoints audit-logged.

---

## 9. Analytics & KPIs

| Category | Metric | Target (yr 1) |
|---|---|---|
| **Growth** | MAU · DAU/MAU · installs · organic share | 250k MAU · 18% |
| **Engagement** | Check-ins/active user/month · destinations viewed/session · trips created | 2.5 · 6 · — |
| **Redistribution** ⭐ | % verified check-ins at Tier 3+4 · unique destinations receiving ≥1 check-in/month · Gini coefficient of footfall distribution | ≥ 35% · 4,000+ · declining trend |
| **Retention** | D1 / D7 / D30 · quarterly reactivation | 45% / 28% / 22% |
| **Content** | Destinations published · % with complete visitor info · community photos approved | 10,000 · 90% · 100k |
| **Integrity** | Photo auto-approval rate · manual review SLA · fraud rate post-moderation · appeal overturn rate | 75% · < 12h · < 2% · < 10% |
| **Gamification** | Challenge participation rate · completion rate · badge earn rate · reward redemption rate | 20% · 45% · — · 12% |
| **Partner/Revenue** | Active partners · offers redeemed · GMV influenced · ARPU | 1,500 · 10k · — · — |
| **Government** | States onboarded · MoUs signed · dashboard WAU per board | 6 · 2 · — |

Instrumentation: event stream into a warehouse (BigQuery/ClickHouse), dashboards in Metabase. Every screen view, filter application, destination impression and check-in step is tracked so we can find where the discovery funnel leaks.

---

## 10. Monetization

| Stream | Model | Timing |
|---|---|---|
| **Government SaaS** | Annual licence per state tourism board for the admin dashboard, analytics, campaign tooling and white-labelled state portal. ₹15–40 L/state/yr. **Primary revenue.** | Phase 3 |
| **Sponsored placements** | Local businesses pay for prominence on nearby destination pages and in category listings. Clearly labelled. | Phase 3 |
| **Booking commissions** | Affiliate/commission on homestays, guides, adventure operators, transport booked via deep-links, later in-app. | Phase 4 |
| **Partner subscriptions** | Tiered plans for businesses: analytics, offer slots, response tools. ₹500–5,000/mo. | Phase 3 |
| **Premium (Explorer Pro)** | Offline maps & content packs, advanced trip planning, ad-free, exclusive challenges, early access. ₹99/mo or ₹799/yr. | Phase 4 |
| **Data & insights** | Anonymised, aggregated tourism-flow reports sold to boards, hospitality chains and researchers. Never individual-level. | Phase 4 |
| **Events & ticketing** | Commission on festival/event tickets and permits sold through partner integrations. | Phase 5 |
| **CSR & grants** | Sustainable-tourism grants, corporate CSR sponsorship of clean-up challenges and circuit development. | Phase 2 onward |

Government revenue upside is the partnership pitch: every Tier-3/4 check-in is a measurable increment of visitor spend in a district that was previously getting none — quantifiable as additional GST and local income.

---

## 11. Security & Privacy

- **Auth**: phone OTP + email/password + Google sign-in. JWT with short-lived access tokens, rotating refresh tokens. Role-based access control enforced server-side on every endpoint.
- **Location privacy**: precise GPS used only at the moment of check-in and never stored beyond the check-in record. Public profiles show destinations visited, never raw coordinates or timestamps to the minute. "Hide my profile from leaderboards" toggle. Real-time location is never shared with other users.
- **Media**: uploads scanned for NSFW and PII; faces of identifiable minors rejected; EXIF stripped from public-facing copies while the original EXIF is retained privately for verification and audit.
- **Data protection**: compliance with India's DPDP Act 2023 — explicit consent, purpose limitation, data export and account deletion within 30 days, breach notification. Data residency in Indian regions (required for government contracts).
- **Minors**: 13+ minimum; under-18 accounts get restricted profiles, no public leaderboard, no monetary rewards.
- **Infrastructure**: TLS everywhere, encryption at rest, secrets in a managed vault, least-privilege IAM, signed URLs for media, WAF, DDoS protection, per-endpoint rate limiting.
- **Government-grade requirements**: immutable audit logs, SSO for department users, annual third-party pen test, documented incident response, state-scoped data access controls.
- **Safety**: destination listings flag genuine hazards (monsoon crossings, wildlife zones, Naxal-affected advisories where officially declared); emergency numbers on every listing; no promotion of restricted or permit-only areas without the official permit link.

---

## 12. Scope

### 12.1 MVP (v1) — 4–5 months, student/startup team of 4–6

**Ruthlessly scoped to prove one thing: does gamified discovery move people to lesser-known places?**

| Area | In MVP |
|---|---|
| Coverage | **2 pilot states** (Madhya Pradesh + one partner state), ~300 hand-curated destinations |
| Discovery | State/district picker, category + duration filters, destination detail with things-to-do, static suggested itinerary, visitor info, map, nearby destinations |
| Accounts | Phone OTP signup, basic profile, saved places |
| Gamification | Check-in with in-app photo, tiered points, ~20 badges, levels, national + state leaderboards, 3 seeded challenges |
| Verification | In-app camera only, geofence check, timestamp check, pHash duplicate check, mock-location detection, **manual moderation queue for everything else** |
| Content | Reviews (check-in gated), community photo gallery |
| Trips | Simple list-based trip builder, no auto-routing |
| Rewards | Points + badges only — **no monetary rewards in MVP** (removes fraud pressure and partner ops entirely) |
| Admin | Destination CMS, moderation console, challenge creator, basic analytics, audit log |
| Platform | React Native (Expo) app for Android-first; Next.js admin dashboard; public web destination pages for SEO |

**Explicitly deferred out of MVP:** ML scene matching, partner portal, rewards marketplace, trip auto-routing, offline mode, multilingual, social features, bookings, iOS parity (fast-follow).

### 12.2 Phase 2 (months 6–9)
ML scene-match verification · trust scores and auto-approval · partner onboarding + first offers · reward redemption with QR · circuits · trip auto-routing with travel times · Hindi + 4 regional languages · iOS · 5 more states (~2,000 destinations) · Local Guide role and community corrections.

### 12.3 Phase 3 (months 10–15)
Full government dashboard with campaign analytics and exportable reports · state white-label portals · sponsored placements · partner subscriptions · all 28 states + 8 UTs · social layer (follow, friend leaderboards, group trips) · offline packs · Explorer Pro.

### 12.4 Future / vision
AI itinerary generation from natural-language prompts ("5 days, MP, temples and waterfalls, ₹15k budget") · AR heritage overlays at monuments · audio guides in regional languages · verified local guide marketplace · in-app bookings via ONDC/IRCTC integration · carbon-footprint tracking per trip · crowd prediction and capacity-based nudging · accessibility-first mode for differently-abled travellers · school/college educational heritage programmes.

---

## 13. Technical Approach (recommended for a lean team)

| Layer | Choice | Why |
|---|---|---|
| Mobile | React Native + Expo | One codebase, Android-first, in-app camera and GPS modules available off the shelf |
| Web | Next.js (SSR) | Destination pages are an SEO goldmine — "places to visit in X" is enormous search volume and our cheapest acquisition channel |
| Backend | NestJS (Node/TS) or Django REST | Typed, batteries-included, fast for a small team |
| Database | PostgreSQL + **PostGIS** | Geofencing, radius queries and "nearby" are first-class, not bolted on |
| Cache/queue | Redis + BullMQ | Leaderboard caching, async verification jobs |
| Storage/CDN | S3 + CloudFront (or Cloudflare R2) | Cheap image delivery at scale |
| Maps | Mapbox or Google Maps SDK | Mapbox is materially cheaper at volume |
| Analytics | PostHog / ClickHouse + Metabase | Self-hostable, avoids per-event pricing early |
| Hosting | AWS Mumbai (ap-south-1) | Data residency requirement for government contracts |

**Leaderboards** are precomputed into `leaderboard_snapshots` on a schedule (and Redis sorted sets for live ranks), never computed live from `points_ledger`.

---

## 14. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Fake check-ins destroy leaderboard credibility | High | Layered verification; no monetary rewards until verification is proven; visible enforcement |
| Content quality at 10,000 destinations | High | Curate, don't crowdsource, at first. Local Guides only after L5 gating. State board partnerships for official content |
| Cold start — empty leaderboards, no photos | High | Launch in 2 states only; seed with campus ambassador programme and a launch challenge; pre-populate official imagery |
| Government sales cycles are long | Medium | Build consumer traction first; approach boards with live footfall data as the pitch, not a slide deck |
| Sending crowds to fragile ecosystems | Medium | Eco-sensitive flag, capacity indicators, admin suppression control, responsible-travel education |
| Safety incident at a remote destination we promoted | High | Hazard flags, difficulty ratings, emergency contacts, explicit disclaimers, no promotion of restricted areas |
| Storage/maps cost blowout | Medium | Aggressive image compression, tiered retention, Mapbox over Google, CDN caching |

---

## 15. Open Questions

1. Which second state do we pilot with — the one with the best board relationship, or the best offbeat density?
2. Should reviews be strictly check-in-gated at launch? It guarantees authenticity but starves early content.
3. Do monetary rewards launch in Phase 2, or wait until the fraud rate is measured below 2%?
4. Is tier assignment transparent to users? Visible tiers invite gaming; hidden tiers feel arbitrary.
5. What's the appeal SLA for a rejected check-in, and who staffs it at scale?
6. Do we let state boards edit *scores/tiers* for their own destinations, or is that platform-controlled to prevent inflation? (Recommendation: platform-controlled.)

---

## Appendix A — Points & Tier Reference

| Tier | Definition | Example | Base points |
|---|---|---|---|
| 1 | > 1M annual visitors; nationally iconic | Taj Mahal, Khajuraho | 10 |
| 2 | 200k–1M; regionally well known | Orchha, Pachmarhi | 30 |
| 3 | 20k–200k; known locally, low outside footfall | Bhojpur Temple, Chanderi | 75 |
| 4 | < 20k; remote, newly listed, or undocumented | Village craft clusters, minor forts, unlisted waterfalls | 150 |

Tiers recomputed quarterly from check-in volume + official footfall data + state board input. A destination that rises in popularity *drops* in tier — the incentive permanently chases the long tail.
