import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { serverApi } from "@/lib/api/server";

export const metadata: Metadata = {
  title: "States & union territories of India",
  description:
    "Browse destinations by state. Madhya Pradesh is live with 29 curated destinations; the remaining 27 states and 8 union territories are being curated.",
  alternates: { canonical: "/states" },
};

export const revalidate = 3600;

export default async function StatesPage() {
  const states = await serverApi.states();
  const live = states.filter((s) => s.status === "live");
  const soon = states.filter((s) => s.status === "coming_soon");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "States and union territories of India on YatraGo",
    numberOfItems: live.length,
    itemListElement: live.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.name,
      url: `/states/${s.code}`,
    })),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="text-3xl font-semibold tracking-tight">
        Where in India?
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        The MVP pilots one state properly rather than twenty-eight badly. The
        catalogue is curated by hand, not crowdsourced, because content quality
        is the thing that breaks first at scale.
      </p>

      <section className="mt-10" aria-labelledby="live-heading">
        <h2 id="live-heading" className="text-sm font-semibold tracking-wider uppercase">
          Live now
        </h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {live.map((s) => (
            <Link
              key={s.code}
              href={`/states/${s.code}`}
              className="group rounded-(--radius-card) border border-border bg-card p-6 transition-colors hover:border-primary"
            >
              <span className="grid size-11 place-items-center rounded-lg bg-primary-soft text-primary">
                <MapPin className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-semibold group-hover:underline">
                {s.name}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.tagline}</p>
              <p className="mt-4 text-xs font-medium">
                {s.destinationCount} destinations published
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-14" aria-labelledby="soon-heading">
        <h2 id="soon-heading" className="text-sm font-semibold tracking-wider uppercase">
          Being curated
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Five more states in Phase 2, all 28 states and 8 union territories by
          Phase 3.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {soon.map((s) => (
            <li
              key={s.code}
              className="rounded-full border border-dashed border-border px-3.5 py-1.5 text-sm text-muted-foreground"
            >
              {s.name}
              <span className="ml-1.5 text-xs opacity-60">
                {s.type === "ut" ? "UT" : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
