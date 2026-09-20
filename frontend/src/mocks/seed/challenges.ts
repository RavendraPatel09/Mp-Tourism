import type { Challenge, ChallengeStatus } from "@/lib/types";
import { collectionHero } from "./hero";

const NOW = new Date("2026-09-20T00:00:00.000Z");

function statusFor(startsAt: string, endsAt: string): ChallengeStatus {
  const t = NOW.getTime();
  if (t < new Date(startsAt).getTime()) return "upcoming";
  if (t > new Date(endsAt).getTime()) return "ended";
  return "active";
}

type Seed = Omit<Challenge, "id" | "status" | "heroImage"> & { caption: string };

/** MVP ships three seeded challenges (PRD §12.1); two more are staged for launch. */
const seeds: Seed[] = [
  {
    slug: "off-the-map-september",
    title: "Off the Map — September",
    description:
      "Check in at three Tier-4 destinations before the month is out. These are the places under twenty thousand people a year visit: minor forts, craft villages, rock-cut caves nobody has told you about. Complete it and the Off the Map badge is yours, along with 600 bonus points on top of the 450 the check-ins are already worth.",
    scope: "national",
    type: "discovery",
    multiplier: 1,
    rewardPoints: 600,
    startsAt: "2026-09-01T00:00:00.000Z",
    endsAt: "2026-09-30T23:59:59.000Z",
    destinationSlugs: [
      "chausath-yogini-mitaoli",
      "bateshwar-temples",
      "garhkundar-fort",
      "bhimkund",
      "dhamnar-caves",
      "patalkot",
      "bagh-caves",
      "ginnorgarh-fort",
    ],
    requiredCount: 3,
    participantCount: 1847,
    completedCount: 412,
    caption: "Eight Tier-4 destinations across Madhya Pradesh",
  },
  {
    slug: "bundelkhand-fort-challenge",
    title: "Bundelkhand Fort Challenge",
    description:
      "Visit four of the six forts and fortified towns on the Bundelkhand trail before the end of the year. The route is built so the highest-scoring stops come last — Garhkundar, seventy kilometres from Orchha and from the same dynasty, takes about four thousand visitors a year against Orchha's five hundred thousand.",
    scope: "state",
    stateCode: "MP",
    type: "circuit",
    multiplier: 1.5,
    rewardPoints: 800,
    startsAt: "2026-08-15T00:00:00.000Z",
    endsAt: "2026-12-31T23:59:59.000Z",
    destinationSlugs: [
      "orchha",
      "garhkundar-fort",
      "chanderi",
      "gwalior-fort",
      "sonagiri",
      "ginnorgarh-fort",
    ],
    requiredCount: 4,
    participantCount: 2310,
    completedCount: 288,
    caption: "Six forts across the Bundela heartland",
  },
  {
    slug: "monsoon-narmada",
    title: "Monsoon on the Narmada",
    description:
      "A Madhya Pradesh Tourism Board campaign. Every check-in along the Narmada corridor scores double for the duration, from the source at Amarkantak to the ghats at Maheshwar. Monsoon is when this river is at its most spectacular and its least visited — which is the whole reason the multiplier exists.",
    scope: "state",
    stateCode: "MP",
    type: "government",
    multiplier: 2,
    rewardPoints: 500,
    startsAt: "2026-07-01T00:00:00.000Z",
    endsAt: "2026-09-30T23:59:59.000Z",
    destinationSlugs: [
      "amarkantak",
      "bhedaghat-dhuandhar",
      "omkareshwar",
      "maheshwar",
      "mandu",
    ],
    requiredCount: 3,
    participantCount: 3924,
    completedCount: 1105,
    caption: "The Narmada corridor in monsoon",
  },
  {
    slug: "khajuraho-dance-festival",
    title: "Khajuraho Dance Festival Week",
    description:
      "The festival runs in the Western Group enclosure in February. Check in during the week and the surrounding Tier-3 and Tier-4 sites — Bhimkund, Chanderi, Sonagiri — score double, because the point of a festival crowd is to move some of it outward.",
    scope: "state",
    stateCode: "MP",
    type: "seasonal",
    multiplier: 2,
    rewardPoints: 400,
    startsAt: "2027-02-20T00:00:00.000Z",
    endsAt: "2027-02-26T23:59:59.000Z",
    destinationSlugs: ["khajuraho-monuments", "bhimkund", "chanderi", "sonagiri"],
    requiredCount: 2,
    participantCount: 0,
    completedCount: 0,
    caption: "Khajuraho Dance Festival, February 2027",
  },
  {
    slug: "satpura-on-foot",
    title: "Satpura on Foot",
    description:
      "Three walking destinations in the Satpura range — the only tiger reserve core zone in India you may legally walk in, a 350 m descent into a valley of Bharia villages, and a Gond fort reached by a two-hour trek. Completed in August 2026.",
    scope: "state",
    stateCode: "MP",
    type: "discovery",
    multiplier: 1.5,
    rewardPoints: 700,
    startsAt: "2026-06-01T00:00:00.000Z",
    endsAt: "2026-08-31T23:59:59.000Z",
    destinationSlugs: ["satpura-national-park", "patalkot", "ginnorgarh-fort", "pachmarhi"],
    requiredCount: 3,
    participantCount: 968,
    completedCount: 214,
    caption: "Walking the Satpura range",
  },
];

export const challenges: Challenge[] = seeds.map(({ caption, ...s }) => ({
  ...s,
  id: `challenge-${s.slug}`,
  status: statusFor(s.startsAt, s.endsAt),
  heroImage: collectionHero("challenge", s.slug, caption, s.destinationSlugs),
}));

export const challengeBySlug = new Map(challenges.map((c) => [c.slug, c]));
