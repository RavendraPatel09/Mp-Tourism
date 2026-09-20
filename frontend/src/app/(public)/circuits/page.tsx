import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, MapPin, Route, Sparkles } from "lucide-react";
import { serverApi } from "@/lib/api/server";
import { Photo } from "@/components/public/photo";

export const metadata: Metadata = {
  title: "Curated circuits across India",
  description:
    "Multi-day routes through Madhya Pradesh — fort trails, the Narmada from source to ghats, the Chambal ravine temples — built so the highest-scoring stops come last.",
  alternates: { canonical: "/circuits" },
};

export const revalidate = 3600;

export default async function CircuitsPage() {
  const circuits = await serverApi.circuits();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Curated circuits</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Editorially built multi-day routes. Each one is also a challenge
        container — complete the circuit and the bonus lands on top of the
        check-in points.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {circuits.map((c) => (
          <article
            key={c.slug}
            className="group relative overflow-hidden rounded-(--radius-card) border border-border bg-card"
          >
            <div className="relative aspect-[21/9] bg-muted">
              <Photo media={c.heroImage} tier={4} alt={c.name} credit scrim sizes="(max-width: 1024px) 100vw, 50vw" />
            </div>
            <div className="p-6">
              <h2 className="text-lg font-semibold">
                <Link
                  href={`/circuits/${c.slug}`}
                  className="after:absolute after:inset-0 hover:underline"
                >
                  {c.name}
                </Link>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {c.description}
              </p>
              <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                <div className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 text-muted-foreground" aria-hidden />
                  <dt className="sr-only">Duration</dt>
                  <dd>{c.dayCount} days</dd>
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-muted-foreground" aria-hidden />
                  <dt className="sr-only">Stops</dt>
                  <dd>{c.destinationSlugs.length} stops</dd>
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <Route className="size-3.5 text-muted-foreground" aria-hidden />
                  <dt className="sr-only">Distance</dt>
                  <dd>{c.totalDistanceKm} km</dd>
                </div>
                <div className="ml-auto inline-flex items-center gap-1.5 font-semibold text-accent">
                  <Sparkles className="size-3.5" aria-hidden />
                  <dt className="sr-only">Points</dt>
                  <dd>{c.totalPoints} pts</dd>
                </div>
              </dl>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
