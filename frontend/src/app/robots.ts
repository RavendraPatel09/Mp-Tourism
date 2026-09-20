import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/api/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The admin console and the API are never indexed.
      disallow: ["/admin", "/admin/", "/api/", "/saved"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
