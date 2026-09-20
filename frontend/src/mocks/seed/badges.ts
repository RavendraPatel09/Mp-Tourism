import type { Badge } from "@/lib/types";

/** ~20 badges for MVP (PRD §12.1), grouped as PRD F13 describes. */
export const badges: Badge[] = [
  // Geographic
  { id: "b-mp-explorer", code: "MP_EXPLORER", name: "Madhya Pradesh Explorer", description: "Check in at 10 destinations in Madhya Pradesh", icon: "MapPin", group: "geographic" },
  { id: "b-district-five", code: "DISTRICT_FIVE", name: "Five Districts", description: "Check in across five different districts", icon: "Map", group: "geographic" },
  { id: "b-state-completionist", code: "STATE_COMPLETIONIST", name: "State Completionist", description: "Check in at 80% of a state's listed destinations", icon: "Trophy", group: "geographic" },
  { id: "b-all-28-8", code: "ALL_28_8", name: "All 28+8", description: "A verified check-in in every state and union territory", icon: "Globe", group: "geographic" },

  // Thematic
  { id: "b-fort-hunter", code: "FORT_HUNTER", name: "Fort Hunter", description: "Check in at 15 forts", icon: "Castle", group: "thematic" },
  { id: "b-waterfall-chaser", code: "WATERFALL_CHASER", name: "Waterfall Chaser", description: "Check in at 10 waterfalls", icon: "Waves", group: "thematic" },
  { id: "b-wildlife-tracker", code: "WILDLIFE_TRACKER", name: "Wildlife Tracker", description: "Check in at 5 national parks", icon: "PawPrint", group: "thematic" },
  { id: "b-temple-trail", code: "TEMPLE_TRAIL", name: "Temple Trail", description: "Check in at 20 religious sites", icon: "Church", group: "thematic" },
  { id: "b-street-food-scout", code: "STREET_FOOD_SCOUT", name: "Street Food Scout", description: "Check in at 10 food destinations", icon: "UtensilsCrossed", group: "thematic" },
  { id: "b-rock-reader", code: "ROCK_READER", name: "Rock Reader", description: "Check in at 5 rock-art or rock-cut cave sites", icon: "Mountain", group: "thematic" },
  { id: "b-craft-keeper", code: "CRAFT_KEEPER", name: "Craft Keeper", description: "Check in at 5 tribal or craft destinations", icon: "Hand", group: "thematic" },

  // Behavioural
  { id: "b-pioneer", code: "PIONEER", name: "Pioneer", description: "Be the first ever verified check-in at a destination", icon: "Flag", group: "behavioural" },
  { id: "b-off-the-map", code: "OFF_THE_MAP", name: "Off the Map", description: "20 verified check-ins at Tier-4 destinations", icon: "Compass", group: "behavioural" },
  { id: "b-monsoon-soul", code: "MONSOON_SOUL", name: "Monsoon Soul", description: "10 check-ins during the monsoon months", icon: "CloudRain", group: "behavioural" },
  { id: "b-sunrise-club", code: "SUNRISE_CLUB", name: "Sunrise Club", description: "10 check-ins before 7 am", icon: "Sunrise", group: "behavioural" },
  { id: "b-long-tail", code: "LONG_TAIL", name: "Long Tail", description: "Keep a Tier-3+4 share above 60% over 25 check-ins", icon: "TrendingUp", group: "behavioural" },
  { id: "b-circuit-closer", code: "CIRCUIT_CLOSER", name: "Circuit Closer", description: "Complete a full curated circuit", icon: "Route", group: "behavioural" },
  { id: "b-responsible-traveller", code: "RESPONSIBLE_TRAVELLER", name: "Responsible Traveller", description: "Take the leave-no-trace pledge and honour it on 10 check-ins", icon: "Leaf", group: "behavioural" },

  // Contribution
  { id: "b-chronicler", code: "CHRONICLER", name: "Chronicler", description: "50 photos accepted into destination galleries", icon: "Camera", group: "contribution" },
  { id: "b-cartographer", code: "CARTOGRAPHER", name: "Cartographer", description: "10 accepted destination corrections", icon: "PenLine", group: "contribution" },
  { id: "b-reviewer", code: "REVIEWER", name: "Field Notes", description: "25 detailed reviews with photos", icon: "MessageSquare", group: "contribution" },
];

export const badgeByCode = new Map(badges.map((b) => [b.code, b]));
