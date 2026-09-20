# Bharat Trails — Backend

**Member B · API, database, points ledger, verification pipeline**

NestJS + PostgreSQL/PostGIS + Redis/BullMQ. Owns every rule that decides whether a check-in is
real and what it is worth.

Companion docs: [PRD.md](../PRD.md) · [TEAM_PLAN.md](../TEAM_PLAN.md)

---

## Quick start

```bash
cp .env.example .env
npm install
docker compose up -d          # Postgres+PostGIS, Redis, MinIO (S3 stand-in)
npm run migration:run
npm run seed
npm run start:dev             # API   → http://localhost:3000/v1  · docs at /docs
npm run worker:dev            # worker (separate terminal)
```

Seeded logins (development only): `super@bharattrails.test`, `state.mp@bharattrails.test`,
`moderator@bharattrails.test` — password `local-dev-password-1`.
Phone OTP in development is returned in the response as `devCode` and logged; no SMS is sent.

## For Member A and Member C — start here

You do **not** need this stack running to build against the API.

```bash
npm install
npm run mock:server           # → http://localhost:4010/v1
```

No database, no Redis, starts in under a second. It returns believable data — a real Orchha with
timings and fees, a Tier-4 stepwell worth 150 points, a moderation queue item with every
verification signal populated. Built-in triggers so you can build the hard screens without
travelling anywhere:

| To test | Do this |
|---|---|
| OTP login | code is always `123456` |
| Outside the geofence (422) | `POST /v1/check-ins` with `lat: 0, lng: 0` |
| Pending → approved transition | submit a check-in; it approves itself after 4 s |
| Publish gate rejection (422) | `POST /v1/admin/destinations/:id/publish?simulate=incomplete` |
| Missing idempotency key (400) | omit the `Idempotency-Key` header |

Every response also carries 120–300 ms of deliberate latency, so a screen that looks fine against
an instant mock still has to show a spinner.

The contract itself: `npm run openapi:generate` writes `openapi/openapi.json`, and CI fails if the
committed spec drifts from the code. Browsable at `/docs` when the API is running.

**If you need a field that isn't there, ask — don't work around it.** Adding a field is cheap.
Changing or removing one is a breaking change for all three of us.

---

## Layout

```
src/
  config/              environment parsing, fail-fast validation
  common/              guards, decorators, error filter, pagination, constants
  entities/            all 28 PRD entities + 4 operational tables
  database/
    migrations/        hand-written SQL — the only schema authority
    seeds/             idempotent; safe to re-run on every deploy
  modules/
    auth/              phone OTP, JWT + rotating refresh, scrypt passwords
    geo/               states, districts, categories
    destinations/      8-dimension filters, PostGIS nearby, typo-tolerant search, CMS
    media/             signed S3 uploads, thumbnails, perceptual hashing
    check-ins/         submission, approval, rejection, history
    verification/      the async pipeline + BullMQ worker
    points/            the ledger
    badges/            criteria engine, idempotent and backfillable
    challenges/        progress tracking, multipliers, completion
    leaderboards/      Redis sorted sets + scheduled snapshots
    moderation/        queue, decisions, reports, enforcement
    reviews/           check-in gated
    users/             profile, saved places, admin user search
    analytics/         footfall, redistribution KPI, campaign lift, CSV export
    audit/             append-only log
    jobs/              scheduled work (worker only)
  main.ts              API
  worker.ts            verification worker + scheduler
```

## Commands

| Command | What it does |
|---|---|
| `npm run start:dev` | API with reload |
| `npm run worker:dev` | Verification worker + crons |
| `npm run mock:server` | Contract mock, no dependencies |
| `npm run migration:run` / `:revert` | Apply / roll back migrations |
| `npm run seed` | States, districts, categories, badges, admin users, sample destinations, 3 challenges |
| `npm test` / `test:cov` | Unit tests |
| `npm run test:e2e` | E2E against a real database |
| `npm run typecheck` | `tsc --noEmit` over src and test |
| `npm run lint` | ESLint + Prettier |
| `npm run openapi:generate` | Write `openapi/openapi.json` |

---

## The parts worth reading before you change them

### The points ledger — `modules/points/points.service.ts`

Financial-grade, because double-awarding points destroys leaderboard trust permanently and there
is no way to earn it back. Three invariants:

1. **Never double-award.** A partial unique index on `(user_id, reason_code, ref_type, ref_id)`
   plus `ON CONFLICT DO NOTHING`. Not a read-then-write check — that races. A retried request, a
   redelivered queue job and a double-clicked moderator button are all no-ops.
2. **Every balance is explainable.** Each row names its source and records the balance it produced.
   Rows are immutable, enforced by a database trigger, not by convention.
3. **Reversible without corruption.** A moderator reverses by appending an opposing row.

`user_profiles.total_points` is a cache written in the same transaction under a row lock on the
profile — which is what serialises concurrent awards and keeps `balance_after` a true running
balance.

The daily cap (`POINTS_DAILY_CAP`) clips the **leaderboard contribution**, not the award. A
genuinely big day of travel keeps its points; it just stops buying unlimited rank.

There are 24 tests on this file. Add to them before you change it.

### Check-in — `modules/check-ins/check-ins.service.ts`

Split deliberately between synchronous and asynchronous:

- **Synchronous at submit**: in-app-camera check, geofence containment, capture window, cooldown,
  daily cap. Everything the user must be told *now*. A 422 means "this will never succeed".
- **Asynchronous in the worker**: perceptual-hash duplicate detection, impossible-velocity,
  trust-score routing. Everything needing I/O or history.

The row is created before the async work starts, so the app shows "submitted" immediately and
resolves points when the job lands.

Geofence containment uses **intersection, not point-in-polygon**: if the GPS accuracy circle
overlaps the fence, the user is inside as far as we can tell. Demanding exact containment rejects
honest visitors standing 15 m from a boundary under tree cover — which is most visitors at a
forested Tier-4 site. Reported accuracy is clamped to `CHECKIN_GPS_ACCURACY_CEILING_M` so a client
cannot claim a 5 km error and check in from the next district.

### Verification — `modules/verification/verification.service.ts`

Two rules:

1. **Auto-reject only on proof, never on suspicion.** A duplicate photo and a mock-location flag
   are proof. A fast journey, a rooted phone and a poor GPS fix are suspicion, and suspicion goes
   to a human. Wrongly rejecting someone who drove four hours to a Tier-4 site loses that user
   permanently; thirty seconds of moderator time costs almost nothing.
2. **Fail closed.** A signal that cannot be computed sends the check-in to review rather than
   letting it through.

Impossible-velocity is deliberately *not* an auto-reject: the same arithmetic that catches
Bhopal → Leh in 40 minutes also flags a genuine domestic flight plus a taxi.

ML scene matching is Phase 2. The `scene_match_score` column exists and stays null, so the
moderation console and its queries don't change when the model ships.

### Leaderboards — `modules/leaderboards/leaderboards.service.ts`

Live ranks come from Redis sorted sets; `leaderboard_snapshots` is the durable copy. **Never**
computed from `points_ledger` on the request path. `applyDelta` is allowed to fail silently
because the scheduled rebuild from the ledger is the correction mechanism — a dropped ZINCRBY
during a Redis blip self-heals within the hour.

### Audit log — `modules/audit/`

Append-only, enforced by a `BEFORE UPDATE OR DELETE` trigger rather than by permissions (the
application owns the table, so a `REVOKE` would not bind it). The API physically cannot rewrite
its own history — which is the thing a government deployment actually audits for.

The audit interceptor also logs a warning when a mutating `/admin` route has no `@Audit()`
decorator, so a forgotten annotation shows up in the logs instead of as a silent gap.

---

## Two decisions that differ from the PRD

Both are flagged for the team rather than quietly implemented.

**1. Multipliers take the maximum, not the product.** PRD §5.2 F11 lists four multipliers
(off-season ×1.5, monsoon-site-in-season ×1.5, active challenge ×2, new destination ×2) without
saying how they combine. Multiplied together they reach ×9, which makes one lucky check-in worth
more than a month of honest travel and makes the leaderboard impossible to explain to the person
in second place. `resolveMultiplier` takes the single highest applicable multiplier. If stacking
is wanted, it should be capped explicitly rather than by accident.

**2. The quarterly tier recompute proposes rather than applies.** Tier drives every point award
on the platform. A cron silently re-pricing 150 destinations at 4 a.m. is not something anyone
should discover from a support ticket, so `JobsService.proposeTierRecompute` writes proposals to
the audit log for a Super Admin to confirm in the CMS.

---

## Scope

**In**, per TEAM_PLAN Member B: API contract + mock server · schema + migrations · auth + RBAC ·
destinations service · media service · check-in service · verification pipeline · points ledger ·
badge engine · challenges engine · leaderboards · moderation + reports API · audit log · Docker +
CI.

**Deferred** (tables exist in the migration, no code references them, so Phase 2 is a code change
rather than a migration against live data): rewards and redemptions, partners, trips and trip
items, custom lists beyond the single flat "Saved" list.

**Not built**: ML scene matching, partner portal, monetary rewards. Out of MVP per PRD §12.1.

---

## Deployment

Two containers from one image: `node dist/main` for the API, `node dist/worker` for the worker.
They are separated because image decoding is CPU-bound and would add latency to every API request
sharing the event loop, because the crons must run exactly once, and because a launch-day traffic
spike and a moderation backlog need different things scaled.

- `GET /v1/health` — liveness, no dependency checks (a Redis blip must not take the API out of
  rotation)
- `GET /v1/health/ready` — Postgres, Redis and PostGIS; use this as the deployment gate

Migrations run as a separate step before the new image goes live, never on boot: two containers
starting at once would race, and `synchronize` is `false` in every environment.

Target: AWS Mumbai (ap-south-1). Data residency is a hard requirement for government contracts
(PRD §11).

## Definition of done (TEAM_PLAN)

| Criterion | Status |
|---|---|
| OpenAPI spec matches implementation | Generated from the code; CI fails on drift |
| > 70% coverage on points + verification | 42 unit tests across both |
| p95 latency < 300 ms | Needs a load test against staging — not yet run |
| Staging and prod deployed | Dockerfile and CI ready; infrastructure not provisioned |
| Moderation queue drains correctly | Endpoints and bulk decisions built; not yet exercised by a human at volume |
