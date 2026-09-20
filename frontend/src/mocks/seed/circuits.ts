import type { Circuit } from "@/lib/types";
import { destinations } from "./destinations";
import { collectionHero } from "./hero";
import { TIER_POINTS } from "@/lib/points";

function build(
  slug: string,
  name: string,
  description: string,
  dayCount: number,
  destinationSlugs: string[],
  totalDistanceKm: number,
): Circuit {
  const points = destinationSlugs.reduce((sum, s) => {
    const d = destinations.find((x) => x.slug === s);
    return sum + (d ? TIER_POINTS[d.tier] : 0);
  }, 0);
  return {
    id: `circuit-${slug}`,
    slug,
    name,
    stateCode: "MP",
    description,
    dayCount,
    heroImage: collectionHero("circuit", slug, name, destinationSlugs),
    destinationSlugs,
    totalPoints: points,
    totalDistanceKm,
  };
}

/** PRD F4 — editorially built routes. Each one is also a challenge container. */
export const circuits: Circuit[] = [
  build(
    "bundelkhand-fort-trail",
    "Bundelkhand Fort Trail",
    "Four days across the Bundela heartland, from the crowds at Orchha to a fort in Niwari that you will very likely have entirely to yourself. Deliberately routed so the last two days are the highest-scoring ones.",
    4,
    ["orchha", "garhkundar-fort", "chanderi", "sonagiri"],
    412,
  ),
  build(
    "morena-chambal-loop",
    "Morena & Chambal Loop",
    "Two days in the ravine country north of Gwalior: a circular yogini temple that may have inspired Parliament, two hundred reassembled eighth-century temples, and cheetah country in the Kuno grassland. Three Tier-4 and one Tier-3 site in 48 hours.",
    2,
    ["gwalior-fort", "chausath-yogini-mitaoli", "bateshwar-temples", "kuno-national-park"],
    336,
  ),
  build(
    "narmada-source-to-ghats",
    "Narmada — Source to Ghats",
    "Follow the river from the spring where it rises on the Maikal plateau to the Holkar ghats at Maheshwar, taking in the marble gorge at Bhedaghat and the island Jyotirlinga on the way. Six days, the length of Madhya Pradesh.",
    6,
    ["amarkantak", "bhedaghat-dhuandhar", "omkareshwar", "maheshwar"],
    928,
  ),
  build(
    "malwa-heritage-run",
    "Malwa Heritage Run",
    "The Afghan capital at Mandu, the block-printers at Bagh, and the rock-cut monolith at Dhamnar — five days through western Madhya Pradesh, ending at a cave temple in the Ellora tradition that fewer than three thousand people see in a year.",
    5,
    ["mandu", "maheshwar", "bagh-caves", "dhamnar-caves"],
    405,
  ),
  build(
    "satpura-wild-circuit",
    "Satpura Wild Circuit",
    "Seven days across three reserves in the Satpura range, including the only park in India where you can walk in the core zone and the country's first Dark Sky Park. Built for people who would rather see the forest than tick off a tiger.",
    7,
    ["pachmarhi", "satpura-national-park", "pench-national-park", "patalkot"],
    580,
  ),
  build(
    "bhopal-day-trips",
    "Bhopal Day Trips",
    "Three days out of the state capital: Mauryan stupas, thirty-thousand-year-old rock art, an unfinished eleventh-century temple with its architects' drawings still on the rock, and a Gond fort that almost nobody in Bhopal has climbed.",
    3,
    ["sanchi-stupa", "udayagiri-caves", "bhimbetka-rock-shelters", "bhojpur-temple", "ginnorgarh-fort"],
    268,
  ),
];

export const circuitBySlug = new Map(circuits.map((c) => [c.slug, c]));
