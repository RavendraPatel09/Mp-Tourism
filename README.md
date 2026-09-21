# YatraGo

**An India tourism discovery & exploration platform that pays you to go where nobody goes.**

> Status: 📋 **Pre-development** — planning complete, implementation not started.
> Repo name is `Mp-Tourism` after the MP Tourism inspiration; the product is scoped for all 28 states and 8 union territories.

---

## What it is

Pick a state, pick what you're into — forts, waterfalls, temples, wildlife, street food — and get the places worth going, the things to actually do there, a suggested itinerary, realistic time estimates, and the practical visitor info you'd otherwise hunt across six blogs and an outdated PDF for.

Then go. Check in at the destination, take a photo through the app, and earn points.

## The idea that makes it different

**Points are inverted against popularity.**

| Destination | Annual visitors | Points |
|---|---|---|
| Taj Mahal | > 1M | **10** |
| Orchha | 200k–1M | **30** |
| Bhojpur Temple | 20k–200k | **75** |
| An unlisted fort 40 km off the highway | < 20k | **150** |

Tiers are recomputed quarterly, so a place that gets popular *drops* in value. The incentive permanently chases the long tail.

Why that matters: people don't skip lesser-known places because they dislike them — they skip them because they've never heard of them. Fix discovery, add a reason to go, and footfall spreads off the same twelve overcrowded landmarks and into districts that currently see none of the spend. That redistribution is the product's reason to exist, the pitch to state tourism boards, and the headline KPI (`% of check-ins at Tier 3+4`).

## Core features

- **Discovery** — filter by state, district, category, time available, difficulty, season, budget, accessibility
- **Destination pages** — things to do, hour-by-hour itineraries, timings, fees, how to reach, facilities, hazards, nearby destinations
- **Verified check-ins** — in-app camera only, GPS geofencing, timestamp validation, duplicate-photo detection, mock-location detection
- **Gamification** — tiered points, levels, badges, an India map that fills in as you travel
- **Leaderboards** — national, state, district, seasonal
- **Challenges** — circuit trails, discovery streaks, and campaigns run by state tourism boards
- **Rewards** — points redeemable at partner homestays, guides and operators *(Phase 2)*
- **Admin & government dashboard** — destination CMS, moderation console, challenge builder, footfall analytics, audit logs
- **Sustainability guardrails** — carrying-capacity indicators, eco-sensitive flags, low point values on over-visited sites

## Documentation

| Doc | What's in it |
|---|---|
| **[PRD.md](./PRD.md)** | Full product spec — personas, 8 user roles, 27 features, 6 user journeys, 28 database entities, REST API surface, KPIs, monetization, security/DPDP compliance, MVP vs. future phases |
| **[TEAM_PLAN.md](./TEAM_PLAN.md)** | 3-person work split, 20-week timeline, scope cuts, content-curation quotas, delivery gates |

## Planned stack

| Layer | Choice | Why |
|---|---|---|
| Mobile | React Native + Expo | One codebase, Android-first |
| Web | Next.js (SSR) | "Places to visit in X" is enormous search volume — our cheapest acquisition channel |
| Backend | NestJS (TypeScript) | Typed and batteries-included for a small team |
| Database | PostgreSQL + **PostGIS** | Geofencing and radius queries are first-class, not bolted on |
| Cache / jobs | Redis + BullMQ | Leaderboards, async photo verification |
| Storage | S3 / Cloudflare R2 + CDN | Cheap image delivery at scale |
| Maps | Mapbox | Materially cheaper than Google at volume |
| Analytics | PostHog + Metabase | Self-hostable, avoids per-event pricing early |
| Hosting | AWS Mumbai (ap-south-1) | Data residency is a hard requirement for government contracts |

## MVP scope

Deliberately narrow — it exists to test one thing: *does gamified discovery actually move people to lesser-known places?*

**In:** 1 pilot state · ~150 curated destinations · discovery + filters + maps · phone OTP auth · check-in with photo verification · points, badges, levels · national + state leaderboards · 3 seeded challenges · check-in-gated reviews · admin CMS + moderation console · Android

**Out:** monetary rewards (removes the entire fraud and partner-ops surface from v1) · ML scene matching · partner portal · trip auto-routing · offline mode · multilingual · social features · bookings · iOS

Full breakdown in [PRD §12](./PRD.md#12-scope).

## Team

Three members, each owning one deployable artifact end-to-end:

| Member | Owns |
|---|---|
| **A** | Mobile app — everything a traveller touches |
| **B** | Backend, database, points ledger, verification pipeline |
| **C** | Admin dashboard, public SEO site, content pipeline |

Content curation (150 destinations) is shared — 50 each, split by district, every week from week 1. See [TEAM_PLAN.md](./TEAM_PLAN.md).

## Roadmap

| Phase | Focus |
|---|---|
| **1 — MVP** (wks 1–20) | 1 state, core discovery + check-in loop, admin tooling |
| **2** (mths 6–9) | ML verification, partner offers & rewards, iOS, 5 more states, Hindi + 4 regional languages |
| **3** (mths 10–15) | Government dashboards, white-label state portals, all 28 states + 8 UTs, social layer, monetization |
| **Future** | AI itinerary generation, AR heritage overlays, audio guides, in-app bookings, carbon tracking, accessibility-first mode |

## Getting started

Nothing to run yet — this repo currently holds planning documents only. Setup instructions land with the first scaffolding commit.

Start by reading [PRD.md](./PRD.md), then [TEAM_PLAN.md](./TEAM_PLAN.md).

## License

TBD
