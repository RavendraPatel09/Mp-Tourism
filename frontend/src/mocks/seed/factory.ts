/**
 * Destination seed factory.
 *
 * Each seed carries the real, researched specifics for a destination; the
 * factory fills the structural boilerplate so every record is complete. The
 * field list here doubles as the column schema for the shared content-curation
 * sheet (TEAM_PLAN "Content pipeline").
 */

import { TIER_POINTS } from "@/lib/points";
import { destinationImages } from "./images";
import type {
  AccessibilityFlags,
  CrowdLevel,
  Destination,
  Difficulty,
  Media,
  Season,
  Tier,
} from "@/lib/types";

/** [title, description, durationMin] */
export type ThingSeed = [string, string, number];
/** [day, startTime, activity, durationMin, travelNotes?] */
export type StopSeed = [number, string, string, number, string?];
/** [label, value] */
export type TimingSeed = [string, string];
/** [label, amountInr, note?] */
export type FeeSeed = [string, number, string?];

export interface DestinationSeed {
  slug: string;
  name: string;
  district: string;
  tier: Tier;
  categories: string[];
  lat: number;
  lng: number;
  short: string;
  whyGo: string;
  story: string;
  minDurationMin: number;
  recommendedDurationMin: number;
  difficulty: Difficulty;
  bestSeasons: Season[];
  avgBudgetInr: number;
  crowdLevel: CrowdLevel;
  ecoSensitive?: boolean;
  access?: Partial<AccessibilityFlags>;
  geofenceRadiusM: number;
  rating: number;
  reviewCount: number;
  checkInCount: number;
  thingsToDo: ThingSeed[];
  itineraryTitle: string;
  stops: StopSeed[];
  timings: TimingSeed[];
  fees: FeeSeed[];
  bestTimeOfDay: string;
  photographyRules?: string;
  dressCode?: string;
  guideAvailability?: string;
  facilities: {
    parking: boolean;
    washrooms: boolean;
    food: boolean;
    drinkingWater: boolean;
    networkCoverage: "none" | "patchy" | "good";
    nearestAtmKm?: number;
    nearestHospitalKm?: number;
  };
  howToReach: string;
  lastMileNotes?: string;
  officialUrl?: string;
  hazards?: string[];
  pointsRationale: string;
  gallery: string[];
}

const EMERGENCY = [
  { label: "Police", number: "100" },
  { label: "Ambulance", number: "108" },
  { label: "MP Tourism helpline", number: "1800-233-7777" },
];

/**
 * Hero shots come from `images.ts` — Wikimedia Commons files under verified free
 * licences, with the photographer and file page carried on the record so the UI
 * can render real credit. We still do not invent attribution: any destination
 * missing from that map, and every gallery slot past the hero, keeps the
 * `bt://gradient/...` panel until the content pipeline clears a licensed photo.
 */
function media(slug: string, tier: Tier, caption: string, index: number): Media {
  const real = index === 0 ? destinationImages[slug] : undefined;

  if (real) {
    return {
      id: `media-${slug}-${index}`,
      url: real.url,
      caption,
      source: "official",
      attribution: real.attribution,
      licence: real.licence,
      sourceUrl: real.sourceUrl,
      width: real.width,
      height: real.height,
    };
  }

  return {
    id: `media-${slug}-${index}`,
    url: `bt://gradient/${slug}-${index}`,
    caption,
    source: "official",
    attribution: "Pending — awaiting licensed imagery",
    licence: "TBD",
    width: 1600,
    height: 1067,
  };
}

export function buildDestination(seed: DestinationSeed): Destination {
  const gallery = seed.gallery.map((caption, i) =>
    media(seed.slug, seed.tier, caption, i),
  );
  const totalDurationMin = seed.stops.reduce((sum, s) => sum + s[3], 0);
  const dayCount = Math.max(...seed.stops.map((s) => s[0]));

  return {
    id: `dest-${seed.slug}`,
    slug: seed.slug,
    name: seed.name,
    stateCode: "MP",
    stateName: "Madhya Pradesh",
    district: seed.district,
    shortDescription: seed.short,
    whyGo: seed.whyGo,
    story: seed.story,
    tier: seed.tier,
    basePoints: TIER_POINTS[seed.tier],
    categories: seed.categories,
    location: { lat: seed.lat, lng: seed.lng },
    minDurationMin: seed.minDurationMin,
    recommendedDurationMin: seed.recommendedDurationMin,
    difficulty: seed.difficulty,
    bestSeasons: seed.bestSeasons,
    avgBudgetInr: seed.avgBudgetInr,
    crowdLevel: seed.crowdLevel,
    isEcoSensitive: seed.ecoSensitive ?? false,
    accessibility: {
      wheelchair: false,
      seniorFriendly: true,
      childFriendly: true,
      ...seed.access,
    },
    status: "published",
    geofenceRadiusM: seed.geofenceRadiusM,
    rating: seed.rating,
    reviewCount: seed.reviewCount,
    checkInCount: seed.checkInCount,
    heroImage: gallery[0],
    gallery,
    thingsToDo: seed.thingsToDo.map(([title, description, durationMin], i) => ({
      id: `ttd-${seed.slug}-${i}`,
      title,
      description,
      durationMin,
      orderIndex: i,
    })),
    itinerary: {
      id: `itin-${seed.slug}`,
      title: seed.itineraryTitle,
      totalDurationMin,
      dayCount,
      stops: seed.stops.map(
        ([day, startTime, activity, durationMin, travelNotes], i) => ({
          id: `stop-${seed.slug}-${i}`,
          day,
          orderIndex: i,
          startTime,
          activity,
          durationMin,
          travelNotes,
        }),
      ),
    },
    info: {
      timings: seed.timings.map(([label, value]) => ({ label, value })),
      entryFees: seed.fees.map(([label, amountInr, note]) => ({
        label,
        amountInr,
        note,
      })),
      bestTimeOfDay: seed.bestTimeOfDay,
      photographyRules: seed.photographyRules,
      dressCode: seed.dressCode,
      guideAvailability: seed.guideAvailability,
      facilities: seed.facilities,
      howToReach: seed.howToReach,
      lastMileNotes: seed.lastMileNotes,
      officialUrl: seed.officialUrl,
      emergencyContacts: EMERGENCY,
      hazards: seed.hazards ?? [],
    },
    pointsRationale: seed.pointsRationale,
    publishedAt: "2026-08-14T00:00:00.000Z",
    updatedAt: "2026-09-12T00:00:00.000Z",
  };
}

/* --------------------------------------------- shared facility presets */

export const FACILITIES_FULL = {
  parking: true,
  washrooms: true,
  food: true,
  drinkingWater: true,
  networkCoverage: "good" as const,
  nearestAtmKm: 1,
  nearestHospitalKm: 3,
};

export const FACILITIES_BASIC = {
  parking: true,
  washrooms: true,
  food: false,
  drinkingWater: false,
  networkCoverage: "patchy" as const,
  nearestAtmKm: 12,
  nearestHospitalKm: 18,
};

export const FACILITIES_NONE = {
  parking: false,
  washrooms: false,
  food: false,
  drinkingWater: false,
  networkCoverage: "none" as const,
  nearestAtmKm: 28,
  nearestHospitalKm: 35,
};
