import type { District, StateSummary } from "@/lib/types";
import { destinations } from "./destinations";

/**
 * All 28 states and 8 union territories are listed — the product is national in
 * ambition (README) — but only the MVP pilot state is `live`. Listing the rest
 * as `coming_soon` is honest and it is also the SEO surface for phase 2.
 */
const raw: Omit<StateSummary, "destinationCount">[] = [
  {
    id: "st-mp",
    name: "Madhya Pradesh",
    code: "MP",
    type: "state",
    status: "live",
    tagline: "The heart of India, and the pilot state",
    description:
      "Three UNESCO World Heritage sites, six tiger reserves and the two rivers that define central India. Madhya Pradesh has more nationally protected monuments than any state except Uttar Pradesh, and a long tail of forts, rock-cut caves and craft villages that receive almost no visitors at all. It is the pilot state for YatraGo for exactly that reason.",
    center: { lat: 23.4733, lng: 77.9479 },
  },
  { id: "st-ap", name: "Andhra Pradesh", code: "AP", type: "state", status: "coming_soon", center: { lat: 15.9129, lng: 79.74 } },
  { id: "st-ar", name: "Arunachal Pradesh", code: "AR", type: "state", status: "coming_soon", center: { lat: 28.218, lng: 94.7278 } },
  { id: "st-as", name: "Assam", code: "AS", type: "state", status: "coming_soon", center: { lat: 26.2006, lng: 92.9376 } },
  { id: "st-br", name: "Bihar", code: "BR", type: "state", status: "coming_soon", center: { lat: 25.0961, lng: 85.3131 } },
  { id: "st-cg", name: "Chhattisgarh", code: "CG", type: "state", status: "coming_soon", center: { lat: 21.2787, lng: 81.8661 } },
  { id: "st-ga", name: "Goa", code: "GA", type: "state", status: "coming_soon", center: { lat: 15.2993, lng: 74.124 } },
  { id: "st-gj", name: "Gujarat", code: "GJ", type: "state", status: "coming_soon", center: { lat: 22.2587, lng: 71.1924 } },
  { id: "st-hr", name: "Haryana", code: "HR", type: "state", status: "coming_soon", center: { lat: 29.0588, lng: 76.0856 } },
  { id: "st-hp", name: "Himachal Pradesh", code: "HP", type: "state", status: "coming_soon", center: { lat: 31.1048, lng: 77.1734 } },
  { id: "st-jh", name: "Jharkhand", code: "JH", type: "state", status: "coming_soon", center: { lat: 23.6102, lng: 85.2799 } },
  { id: "st-ka", name: "Karnataka", code: "KA", type: "state", status: "coming_soon", center: { lat: 15.3173, lng: 75.7139 } },
  { id: "st-kl", name: "Kerala", code: "KL", type: "state", status: "coming_soon", center: { lat: 10.8505, lng: 76.2711 } },
  { id: "st-mh", name: "Maharashtra", code: "MH", type: "state", status: "coming_soon", center: { lat: 19.7515, lng: 75.7139 } },
  { id: "st-mn", name: "Manipur", code: "MN", type: "state", status: "coming_soon", center: { lat: 24.6637, lng: 93.9063 } },
  { id: "st-ml", name: "Meghalaya", code: "ML", type: "state", status: "coming_soon", center: { lat: 25.467, lng: 91.3662 } },
  { id: "st-mz", name: "Mizoram", code: "MZ", type: "state", status: "coming_soon", center: { lat: 23.1645, lng: 92.9376 } },
  { id: "st-nl", name: "Nagaland", code: "NL", type: "state", status: "coming_soon", center: { lat: 26.1584, lng: 94.5624 } },
  { id: "st-or", name: "Odisha", code: "OR", type: "state", status: "coming_soon", center: { lat: 20.9517, lng: 85.0985 } },
  { id: "st-pb", name: "Punjab", code: "PB", type: "state", status: "coming_soon", center: { lat: 31.1471, lng: 75.3412 } },
  { id: "st-rj", name: "Rajasthan", code: "RJ", type: "state", status: "coming_soon", center: { lat: 27.0238, lng: 74.2179 } },
  { id: "st-sk", name: "Sikkim", code: "SK", type: "state", status: "coming_soon", center: { lat: 27.533, lng: 88.5122 } },
  { id: "st-tn", name: "Tamil Nadu", code: "TN", type: "state", status: "coming_soon", center: { lat: 11.1271, lng: 78.6569 } },
  { id: "st-tg", name: "Telangana", code: "TG", type: "state", status: "coming_soon", center: { lat: 18.1124, lng: 79.0193 } },
  { id: "st-tr", name: "Tripura", code: "TR", type: "state", status: "coming_soon", center: { lat: 23.9408, lng: 91.9882 } },
  { id: "st-up", name: "Uttar Pradesh", code: "UP", type: "state", status: "coming_soon", center: { lat: 26.8467, lng: 80.9462 } },
  { id: "st-uk", name: "Uttarakhand", code: "UK", type: "state", status: "coming_soon", center: { lat: 30.0668, lng: 79.0193 } },
  { id: "st-wb", name: "West Bengal", code: "WB", type: "state", status: "coming_soon", center: { lat: 22.9868, lng: 87.855 } },
  { id: "st-an", name: "Andaman & Nicobar Islands", code: "AN", type: "ut", status: "coming_soon", center: { lat: 11.7401, lng: 92.6586 } },
  { id: "st-ch", name: "Chandigarh", code: "CH", type: "ut", status: "coming_soon", center: { lat: 30.7333, lng: 76.7794 } },
  { id: "st-dh", name: "Dadra & Nagar Haveli and Daman & Diu", code: "DH", type: "ut", status: "coming_soon", center: { lat: 20.1809, lng: 73.0169 } },
  { id: "st-dl", name: "Delhi", code: "DL", type: "ut", status: "coming_soon", center: { lat: 28.7041, lng: 77.1025 } },
  { id: "st-jk", name: "Jammu & Kashmir", code: "JK", type: "ut", status: "coming_soon", center: { lat: 33.7782, lng: 76.5762 } },
  { id: "st-la", name: "Ladakh", code: "LA", type: "ut", status: "coming_soon", center: { lat: 34.2268, lng: 77.5619 } },
  { id: "st-ld", name: "Lakshadweep", code: "LD", type: "ut", status: "coming_soon", center: { lat: 10.5667, lng: 72.6417 } },
  { id: "st-py", name: "Puducherry", code: "PY", type: "ut", status: "coming_soon", center: { lat: 11.9416, lng: 79.8083 } },
];

export const states: StateSummary[] = raw.map((s) => ({
  ...s,
  destinationCount: destinations.filter((d) => d.stateCode === s.code).length,
}));

export const stateByCode = new Map(states.map((s) => [s.code, s]));

/** Districts are derived from the catalogue so the two can never disagree. */
export const districts: District[] = Object.entries(
  destinations.reduce<Record<string, number>>((acc, d) => {
    acc[d.district] = (acc[d.district] ?? 0) + 1;
    return acc;
  }, {}),
)
  .map(([name, destinationCount]) => ({
    id: `dist-${name.toLowerCase().replace(/\s+/g, "-")}`,
    stateId: "st-mp",
    stateCode: "MP",
    name,
    destinationCount,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
