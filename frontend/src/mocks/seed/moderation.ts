import { haversineKm } from "@/lib/geo";
import type { LatLng, ModerationItem, VerificationSignal } from "@/lib/types";
import { destinations } from "./destinations";
import { intBetween, mulberry32, pick } from "./rand";
import { adminUsers } from "./users";

/**
 * The moderation queue. Each item carries the full set of automated signals
 * from PRD F18 so the console can show a moderator every input the pipeline
 * used, rather than just a verdict.
 */

type Scenario =
  | "clean_low_trust"
  | "geofence_edge"
  | "phash_duplicate"
  | "mock_location"
  | "velocity"
  | "scene_mismatch"
  | "stale_timestamp";

const SCENARIOS: Scenario[] = [
  "clean_low_trust",
  "geofence_edge",
  "phash_duplicate",
  "mock_location",
  "velocity",
  "scene_mismatch",
  "stale_timestamp",
  "clean_low_trust",
  "geofence_edge",
  "clean_low_trust",
];

function offset(centre: LatLng, metres: number, bearingDeg: number): LatLng {
  const R = 6371000;
  const br = (bearingDeg * Math.PI) / 180;
  const lat1 = (centre.lat * Math.PI) / 180;
  const lng1 = (centre.lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(metres / R) +
      Math.cos(lat1) * Math.sin(metres / R) * Math.cos(br),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(br) * Math.sin(metres / R) * Math.cos(lat1),
      Math.cos(metres / R) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

function signalsFor(
  scenario: Scenario,
  distanceM: number,
  radiusM: number,
  accuracyM: number,
  captureLagMin: number,
): VerificationSignal[] {
  const geoPass = distanceM <= radiusM + accuracyM;
  return [
    {
      key: "geofence",
      label: "Geofence containment",
      status: geoPass ? (distanceM > radiusM ? "warn" : "pass") : "fail",
      detail: geoPass
        ? distanceM > radiusM
          ? `${Math.round(distanceM)} m from centre, outside the ${radiusM} m fence but inside it once the ±${accuracyM} m accuracy circle is allowed for.`
          : `${Math.round(distanceM)} m from centre, well inside the ${radiusM} m fence.`
        : `${Math.round(distanceM)} m from centre against a ${radiusM} m fence and ±${accuracyM} m accuracy. Outside.`,
    },
    {
      key: "timestamp",
      label: "Capture-to-submit window",
      status: scenario === "stale_timestamp" ? "fail" : captureLagMin > 8 ? "warn" : "pass",
      detail:
        scenario === "stale_timestamp"
          ? `Photo captured ${captureLagMin} minutes before submission. Well outside the window; server time is authoritative.`
          : `Captured ${captureLagMin} minute${captureLagMin === 1 ? "" : "s"} before submission.`,
    },
    {
      key: "mock_location",
      label: "Mock location / device integrity",
      status: scenario === "mock_location" ? "fail" : "pass",
      detail:
        scenario === "mock_location"
          ? "Android mock-location provider active at capture. Device also reports an unlocked bootloader."
          : "No mock-location provider. Bootloader locked, Play Integrity basic verdict passed.",
    },
    {
      key: "phash_duplicate",
      label: "Perceptual hash duplicate",
      status: scenario === "phash_duplicate" ? "fail" : "pass",
      detail:
        scenario === "phash_duplicate"
          ? "Hamming distance 3 against an approved submission from another account 11 days ago. Near-certain re-upload."
          : "Nearest match in the corpus is at Hamming distance 27. No duplicate.",
    },
    {
      key: "velocity",
      label: "Impossible velocity",
      status: scenario === "velocity" ? "fail" : "pass",
      detail:
        scenario === "velocity"
          ? "Previous approved check-in 640 km away 52 minutes earlier. Implied ground speed 738 km/h with no matching flight window."
          : "Previous approved check-in is consistent with road travel since.",
    },
    {
      key: "scene_match",
      label: "Scene match",
      status:
        scenario === "scene_mismatch"
          ? "warn"
          : "skipped",
      detail:
        scenario === "scene_mismatch"
          ? "Low similarity against reference imagery. Routed to review rather than rejected — the reference set for this destination is thin and unusual angles are expected."
          : "ML scene matching is Phase 2. Not run at MVP.",
    },
    {
      key: "device_integrity",
      label: "Device-to-account limit",
      status: "pass",
      detail: "Device fingerprint linked to 1 account. Within limit.",
    },
  ];
}

const rng = mulberry32(556677);

export const moderationQueue: ModerationItem[] = SCENARIOS.map((scenario, i) => {
  const dest = destinations[(i * 5 + 3) % destinations.length];
  const user = adminUsers[(i * 3 + 1) % adminUsers.length];
  const radiusM = dest.geofenceRadiusM;

  const distanceM =
    scenario === "geofence_edge"
      ? radiusM + intBetween(rng, 10, 45)
      : intBetween(rng, 10, Math.max(20, Math.floor(radiusM * 0.6)));
  const accuracyM =
    scenario === "geofence_edge" ? intBetween(rng, 45, 90) : intBetween(rng, 6, 24);
  const captureLagMin = scenario === "stale_timestamp" ? intBetween(rng, 40, 180) : intBetween(rng, 1, 9);

  const deviceLocation = offset(dest.location, distanceM, intBetween(rng, 0, 359));
  const actualDistanceM = haversineKm(deviceLocation, dest.location) * 1000;

  const submitted = new Date("2026-09-20T06:00:00.000Z");
  submitted.setHours(submitted.getHours() - i * 2 - intBetween(rng, 0, 3));
  const captured = new Date(submitted.getTime() - captureLagMin * 60_000);

  return {
    id: `mod-${i + 1}`,
    checkInId: `checkin-${dest.slug}-${user.username}`,
    destinationSlug: dest.slug,
    destinationName: dest.name,
    stateCode: dest.stateCode,
    tier: dest.tier,
    username: user.username,
    userTrustScore: scenario === "clean_low_trust" ? intBetween(rng, 18, 38) : user.trustScore,
    userCheckInCount: user.checkIns,
    userRejectionCount: user.rejectedCheckIns,
    submittedAt: submitted.toISOString(),
    capturedAt: captured.toISOString(),
    photoUrl: `bt://gradient/${dest.slug}-submission-${i}`,
    referencePhotos: dest.gallery.slice(0, 3).map((m) => m.url),
    deviceLocation,
    destinationLocation: dest.location,
    accuracyM,
    geofenceRadiusM: radiusM,
    distanceFromCentreM: Math.round(actualDistanceM),
    pointsAtStake: dest.basePoints,
    signals: signalsFor(scenario, actualDistanceM, radiusM, accuracyM, captureLagMin),
    slaHoursRemaining: +(12 - (i * 2 + 1) * 0.9).toFixed(1),
    status: "pending",
  };
});

export const pickReferenceScenario = (i: number) => SCENARIOS[i % SCENARIOS.length];
export const randomFromQueue = () => pick(rng, moderationQueue);
