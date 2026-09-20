import type { Review } from "@/lib/types";
import { destinations } from "./destinations";
import { intBetween, mulberry32, pick } from "./rand";
import { leaderboard } from "./users";

/**
 * Reviews are check-in gated (PRD F9), so every seeded review carries
 * `verifiedCheckIn: true`. The UI says so on each card — that guarantee is the
 * reason to trust the rating at all.
 */
const BODIES: [string, string][] = [
  [
    "Went on a Tuesday morning and had the place almost to myself. The caretaker walked me round for twenty minutes without being asked and knew far more than the signage does. Give yourself longer than the app suggests — I stayed nearly three hours.",
    "Weekday mornings are empty. Weekends are a different place entirely.",
  ],
  [
    "Worth the detour, genuinely. The road in is rough for the last stretch and I would not take a low-clearance car after rain, but the site itself is in better condition than I expected.",
    "Fill up fuel before you turn off the highway — there is nothing after that.",
  ],
  [
    "Second visit, this time at sunset instead of midday, and it is a completely different experience. The light does most of the work here.",
    "Come in the last ninety minutes of daylight.",
  ],
  [
    "Took my parents, both in their seventies. The main section was manageable but the upper part was not — we turned back. Would have liked to know that in advance.",
    "The upper section has no handrail and uneven steps. Plan for it.",
  ],
  [
    "Carried a torch on the advice here and it made the difference. Half the interior is pitch dark and phone lights are not enough.",
    "Bring an actual torch, not a phone.",
  ],
  [
    "Four hours from Bhopal each way for this and I would do it again. Almost nobody here on a Saturday, which still surprises me.",
    "Start at 5 am if you are doing it as a day trip.",
  ],
  [
    "Beautiful, but the plastic around the parking area is depressing. Carried out what I could. The site itself is clean once you are past the entrance.",
    "Carry a bag out with you. It genuinely helps.",
  ],
  [
    "The guide was excellent and cost less than a coffee in a city. Do not skip it — I walked round once alone first and missed most of what matters.",
    "Hire the local guide. ₹600 well spent.",
  ],
  [
    "Monsoon visit. Everything was green and the water was full, but the steps were lethal and I nearly went over twice. Stunning, and I would not bring children.",
    "Monsoon is the best and the most dangerous time. Proper shoes.",
  ],
  [
    "Arrived expecting fifteen minutes and stayed two hours. The detail rewards slowing down, which is not something you can tell from photographs.",
    "Budget more time than you think.",
  ],
  [
    "Facilities are basically non-existent, which the listing is honest about. Carry water and use the toilet before you leave the last town.",
    "No water, no toilets, no signal. Plan accordingly.",
  ],
  [
    "Came for the check-in points and stayed because it turned out to be the best thing I saw all week. That is presumably the idea.",
    "Do not treat it as a quick tick. It deserves the afternoon.",
  ],
];

function buildForDestination(slug: string, count: number): Review[] {
  const r = mulberry32(slug.split("").reduce((a, c) => a + c.charCodeAt(0) * 13, 7));
  const out: Review[] = [];
  const usedUsers = new Set<string>();
  for (let i = 0; i < count; i++) {
    const user = pick(r, leaderboard);
    if (usedUsers.has(user.username)) continue;
    usedUsers.add(user.username);
    const [body, tip] = pick(r, BODIES);
    const date = new Date("2026-09-10T00:00:00.000Z");
    date.setDate(date.getDate() - intBetween(r, 3, 210));
    out.push({
      id: `review-${slug}-${i}`,
      destinationSlug: slug,
      username: user.username,
      displayName: user.displayName,
      avatarColor: user.avatarColor,
      rating: intBetween(r, 4, 5) - (r() > 0.85 ? 1 : 0),
      body,
      tip,
      createdAt: date.toISOString(),
      helpfulCount: intBetween(r, 0, 46),
      verifiedCheckIn: true,
    });
  }
  return out.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export const reviews: Review[] = destinations.flatMap((d) =>
  buildForDestination(d.slug, Math.min(6, Math.max(2, Math.round(d.reviewCount / 120)))),
);

export function reviewsFor(slug: string) {
  return reviews.filter((r) => r.destinationSlug === slug);
}
