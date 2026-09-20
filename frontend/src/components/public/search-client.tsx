"use client";

import * as React from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { DestinationCardCompact } from "./destination-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

const RECENT_KEY = "bt-recent-searches";
const SUGGESTIONS = ["fort", "waterfall", "Khajurao", "Mandav", "tribal", "rock art", "Morena"];

export function SearchClient() {
  const [term, setTerm] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [recent, setRecent] = React.useState<string[]>([]);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw) as string[]);
    } catch {
      // Corrupt or unavailable storage is not worth failing search over.
    }
  }, []);

  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(term.trim()), 250);
    return () => window.clearTimeout(id);
  }, [term]);

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api.search(debounced),
    enabled: debounced.length >= 2,
  });

  function remember(value: string) {
    const next = [value, ...recent.filter((r) => r !== value)].slice(0, 6);
    setRecent(next);
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // Ignore — recents are a convenience, not state we depend on.
    }
  }

  const results = data ?? [];

  return (
    <div>
      <div className="relative">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onBlur={() => debounced.length >= 2 && remember(debounced)}
          placeholder="Try a name, a district, or an interest…"
          aria-label="Search destinations"
          className="h-14 w-full rounded-xl border border-border bg-card pr-12 pl-12 text-base"
        />
        {term ? (
          <button
            type="button"
            onClick={() => setTerm("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-4 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {debounced.length < 2 ? (
        <div className="mt-8 space-y-8">
          {recent.length > 0 ? (
            <section aria-labelledby="recent-heading">
              <h2 id="recent-heading" className="text-xs font-semibold tracking-wider uppercase">
                Recent
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {recent.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setTerm(r)}
                    className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm hover:border-primary"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="suggest-heading">
            <h2 id="suggest-heading" className="text-xs font-semibold tracking-wider uppercase">
              Try
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Misspellings are handled — &ldquo;Khajurao&rdquo;, &ldquo;Orcha&rdquo;
              and &ldquo;Mandav&rdquo; all resolve.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTerm(s)}
                  className="rounded-full border border-border bg-card px-3.5 py-1.5 text-sm hover:border-primary hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : isFetching && results.length === 0 ? (
        <div className="mt-8 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<SearchIcon className="size-8" />}
          title={`Nothing found for "${debounced}"`}
          description="The catalogue is 29 destinations in Madhya Pradesh at MVP. Try a broader term like 'fort', 'waterfall' or a district name."
        />
      ) : (
        <div className="mt-8">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {results.length} {results.length === 1 ? "result" : "results"} for
            &ldquo;{debounced}&rdquo;
          </p>
          <div className="mt-4 space-y-3">
            {results.map((d) => (
              <DestinationCardCompact key={d.slug} destination={d} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
