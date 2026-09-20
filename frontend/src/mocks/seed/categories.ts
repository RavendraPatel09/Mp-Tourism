import type { Category } from "@/lib/types";

/** PRD F2 — the multi-select interest filter. Icons are lucide-react names. */
export const categories: Category[] = [
  { id: "cat-historical", name: "Historical", slug: "historical", icon: "Landmark", description: "Forts, palaces, ruins and archaeological sites" },
  { id: "cat-heritage", name: "Heritage", slug: "heritage", icon: "Castle", description: "UNESCO sites and protected monuments" },
  { id: "cat-religious", name: "Religious", slug: "religious", icon: "Church", description: "Temples, mosques, Jain and Buddhist sites" },
  { id: "cat-nature", name: "Nature", slug: "nature", icon: "Trees", description: "Forests, plateaus, gorges and viewpoints" },
  { id: "cat-adventure", name: "Adventure", slug: "adventure", icon: "Mountain", description: "Treks, rafting, caving and climbing" },
  { id: "cat-wildlife", name: "Wildlife", slug: "wildlife", icon: "PawPrint", description: "National parks, tiger reserves and sanctuaries" },
  { id: "cat-architecture", name: "Architecture", slug: "architecture", icon: "Building2", description: "Notable building, sculpture and engineering" },
  { id: "cat-cultural", name: "Cultural", slug: "cultural", icon: "Drama", description: "Festivals, performance and living traditions" },
  { id: "cat-waterfalls", name: "Waterfalls", slug: "waterfalls", icon: "Waves", description: "Falls and cascades, best after monsoon" },
  { id: "cat-lakes-rivers", name: "Lakes & Rivers", slug: "lakes_rivers", icon: "Droplets", description: "Ghats, gorges, reservoirs and riverfronts" },
  { id: "cat-tribal-craft", name: "Tribal & Craft", slug: "tribal_craft", icon: "Hand", description: "Weaving, printing and tribal communities" },
  { id: "cat-museums", name: "Museums", slug: "museums", icon: "Library", description: "Site museums and state collections" },
  { id: "cat-offbeat", name: "Offbeat", slug: "offbeat", icon: "Compass", description: "The long tail — remote and under-documented" },
  { id: "cat-sunrise-sunset", name: "Sunrise & Sunset", slug: "sunrise_sunset", icon: "Sunrise", description: "Viewpoints worth timing a day around" },
  { id: "cat-monsoon", name: "Monsoon", slug: "monsoon", icon: "CloudRain", description: "Places that are transformed by rain" },
];

export const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));
