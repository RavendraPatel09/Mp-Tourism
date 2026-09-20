import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/api/config";
import { challenges } from "@/mocks/seed/challenges";
import { circuits } from "@/mocks/seed/circuits";
import { destinations } from "@/mocks/seed/destinations";
import { states } from "@/mocks/seed/states";

/** Public surface only — /admin and /api are excluded here and in robots.ts. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const statics: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, priority: 1, changeFrequency: "weekly", lastModified: now },
    { url: `${SITE_URL}/explore`, priority: 0.9, changeFrequency: "daily", lastModified: now },
    { url: `${SITE_URL}/states`, priority: 0.8, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/circuits`, priority: 0.8, changeFrequency: "weekly", lastModified: now },
    { url: `${SITE_URL}/challenges`, priority: 0.7, changeFrequency: "daily", lastModified: now },
    { url: `${SITE_URL}/leaderboards`, priority: 0.6, changeFrequency: "daily", lastModified: now },
    { url: `${SITE_URL}/points`, priority: 0.7, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/responsible-travel`, priority: 0.6, changeFrequency: "monthly", lastModified: now },
    { url: `${SITE_URL}/search`, priority: 0.4, changeFrequency: "monthly", lastModified: now },
  ];

  return [
    ...statics,
    // State hubs are the highest-value SEO pages in the product.
    ...states
      .filter((s) => s.status === "live")
      .map((s) => ({
        url: `${SITE_URL}/states/${s.code}`,
        priority: 0.95,
        changeFrequency: "weekly" as const,
        lastModified: now,
      })),
    ...destinations.map((d) => ({
      url: `${SITE_URL}/destinations/${d.slug}`,
      priority: 0.9,
      changeFrequency: "monthly" as const,
      lastModified: new Date(d.updatedAt),
    })),
    ...circuits.map((c) => ({
      url: `${SITE_URL}/circuits/${c.slug}`,
      priority: 0.7,
      changeFrequency: "monthly" as const,
      lastModified: now,
    })),
    ...challenges.map((c) => ({
      url: `${SITE_URL}/challenges/${c.slug}`,
      priority: 0.6,
      changeFrequency: "weekly" as const,
      lastModified: now,
    })),
  ];
}
