import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { formatNumber } from "@/lib/format";
import { TIER_META, TIER_POINTS } from "@/lib/points";
import { states } from "@/mocks/seed/states";
import { DestinationCard } from "@/components/public/destination-card";
import { categoryBySlug } from "@/mocks/seed/categories";
import type { Tier } from "@/lib/types";

export const revalidate = 3600;

export function generateStaticParams() {
  return states.filter((s) => s.status === "live").map((s) => ({ code: s.code }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const state = await serverApi.state(code);
  if (!state) return { title: "State not found" };

  const title = `Places to visit in ${state.name} — ${state.destinationCount} destinations`;
  const description = `Forts, temples, waterfalls, wildlife and craft villages across ${state.name}, with things to do, itineraries, timings and fees. Lesser-known sites are worth up to 150 points each.`;

  return {
    title,
    description,
    alternates: { canonical: `/states/${state.code}` },
    openGraph: { title, description, url: `/states/${state.code}` },
  };
}

const TIERS: Tier[] = [4, 3, 2, 1];

export default async function StatePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const state = await serverApi.state(code);
  if (!state) notFound();

  if (state.status !== "live") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{state.name}</h1>
        <p className="mt-3 text-muted-foreground">
          {state.name} is not curated yet. The MVP pilots Madhya Pradesh; five
          more states land in Phase 2 and the rest by Phase 3.
        </p>
        <Link
          href="/states/MP"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          See Madhya Pradesh instead
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    );
  }

  const [all, districts] = await Promise.all([
    serverApi.destinations({ state: state.code, pageSize: 60 }),
    serverApi.districts(state.code),
  ]);

  const byTier = TIERS.map((tier) => ({
    tier,
    items: all.items.filter((d) => d.tier === tier),
  })).filter((g) => g.items.length > 0);

  const tier34 = all.items.filter((d) => d.tier >= 3).length;
  const categoryCounts = Array.from(
    all.items
      .flatMap((d) => d.categories)
      .reduce<Map<string, number>>((m, c) => m.set(c, (m.get(c) ?? 0) + 1), new Map()),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Places to visit in ${state.name}`,
    numberOfItems: all.items.length,
    itemListElement: all.items.map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: d.name,
      url: `/destinations/${d.slug}`,
    })),
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `How many places are there to visit in ${state.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `YatraGo lists ${all.items.length} curated destinations across ${districts.length} districts of ${state.name}, from UNESCO World Heritage sites to forts and craft villages that take under twenty thousand visitors a year.`,
        },
      },
      {
        "@type": "Question",
        name: `What is the best time to visit ${state.name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "October to March is comfortable across the state. Monsoon, July to September, transforms Mandu, Pachmarhi and the Narmada waterfalls, though several forest and waterfall routes close or become unsafe.",
        },
      },
      {
        "@type": "Question",
        name: `Which lesser-known places in ${state.name} are worth visiting?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${tier34} of the ${all.items.length} listed destinations are Tier 3 or Tier 4 — under two hundred thousand visitors a year. The Chausath Yogini temple at Mitaoli, the reassembled Bateshwar temple group and the rock-cut caves at Dhamnar are among the most remarkable and the least visited.`,
        },
      },
    ],
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      <section className="border-b border-border bg-gradient-to-br from-primary-soft via-background to-background">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted-foreground">
            <Link href="/states" className="hover:underline">
              India
            </Link>
            <span aria-hidden> / </span>
            <span className="text-foreground">{state.name}</span>
          </nav>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Places to visit in {state.name}
          </h1>
          <p className="prose-trail mt-4 text-lg text-muted-foreground">
            {state.description}
          </p>

          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
            {[
              { label: "Destinations", value: formatNumber(all.items.length) },
              { label: "Districts", value: formatNumber(districts.length) },
              { label: "Tier 3 & 4", value: `${tier34} of ${all.items.length}` },
              {
                label: "Points available",
                value: formatNumber(all.items.reduce((s, d) => s + d.basePoints, 0)),
              },
            ].map((s) => (
              <div key={s.label}>
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <section aria-labelledby="districts-heading">
          <h2 id="districts-heading" className="text-xl font-semibold tracking-tight">
            By district
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {districts.map((d) => (
              <Link
                key={d.id}
                href={`/explore?state=${state.code}&district=${encodeURIComponent(d.name)}`}
                className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm hover:border-primary hover:text-primary"
              >
                {d.name}
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {d.destinationCount}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="interests-heading">
          <h2 id="interests-heading" className="text-xl font-semibold tracking-tight">
            By interest
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {categoryCounts.map(([slug, count]) => (
              <Link
                key={slug}
                href={`/explore?state=${state.code}&categories=${slug}`}
                className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm hover:border-primary hover:text-primary"
              >
                {categoryBySlug.get(slug)?.name ?? slug}
                <span className="ml-1.5 text-xs text-muted-foreground">{count}</span>
              </Link>
            ))}
          </div>
        </section>

        {byTier.map((group) => (
          <section key={group.tier} className="mt-14" aria-labelledby={`tier-${group.tier}`}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  id={`tier-${group.tier}`}
                  className="flex items-center gap-2 text-xl font-semibold tracking-tight"
                >
                  {TIER_META[group.tier].label}
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{
                      background: `color-mix(in srgb, var(--color-tier-${group.tier}) 14%, transparent)`,
                      color: `var(--color-tier-${group.tier})`,
                    }}
                  >
                    <Sparkles className="size-3" aria-hidden />
                    {TIER_POINTS[group.tier]} pts each
                  </span>
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {TIER_META[group.tier].definition}
                </p>
              </div>
              <Link
                href={`/explore?state=${state.code}&tier=${group.tier}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Filter to Tier {group.tier}
              </Link>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((d) => (
                <DestinationCard key={d.slug} destination={d} />
              ))}
            </div>
          </section>
        ))}

        <section className="mt-16 border-t border-border pt-10" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-xl font-semibold tracking-tight">
            Common questions
          </h2>
          <dl className="mt-5 max-w-3xl divide-y divide-border">
            {faqLd.mainEntity.map((q) => (
              <div key={q.name} className="py-5">
                <dt className="font-medium">{q.name}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {q.acceptedAnswer.text}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
