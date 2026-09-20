import { ArrowDown } from "lucide-react";
import { formatDuration } from "@/lib/format";
import type { Itinerary } from "@/lib/types";

/** PRD F3 — the hour-by-hour suggested plan. */
export function ItineraryTimeline({ itinerary }: { itinerary: Itinerary }) {
  const days = Array.from(new Set(itinerary.stops.map((s) => s.day))).sort();

  return (
    <section aria-labelledby="itinerary-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="itinerary-heading" className="text-xl font-semibold tracking-tight">
          {itinerary.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {itinerary.dayCount === 1
            ? "Single day"
            : `${itinerary.dayCount} days`}{" "}
          · {formatDuration(itinerary.totalDurationMin)} of planned activity
        </p>
      </div>

      <div className="mt-5 space-y-8">
        {days.map((day) => {
          const stops = itinerary.stops.filter((s) => s.day === day);
          return (
            <div key={day}>
              {itinerary.dayCount > 1 ? (
                <h3 className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Day {day}
                </h3>
              ) : null}

              <ol className="relative space-y-0">
                {stops.map((stop, i) => (
                  <li key={stop.id} className="relative flex gap-4 pb-6 last:pb-0">
                    <div className="flex flex-col items-center">
                      <time className="w-14 shrink-0 text-right text-xs font-semibold tabular-nums">
                        {stop.startTime}
                      </time>
                      {i < stops.length - 1 ? (
                        <span
                          aria-hidden
                          className="mt-1.5 w-px flex-1 bg-border"
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1 -mt-0.5 pb-1">
                      <p className="text-sm font-medium">{stop.activity}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDuration(stop.durationMin)}
                      </p>
                      {stop.travelNotes ? (
                        <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                          <ArrowDown className="size-3 shrink-0" aria-hidden />
                          {stop.travelNotes}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}
