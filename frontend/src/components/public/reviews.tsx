import { BadgeCheck, Lightbulb, Star, ThumbsUp } from "lucide-react";
import { formatDate, initials } from "@/lib/format";
import type { Review } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn(
            "size-3.5",
            i <= Math.round(rating) ? "fill-current text-warning" : "text-border",
          )}
        />
      ))}
    </span>
  );
}

export function ReviewList({
  reviews,
  rating,
  reviewCount,
}: {
  reviews: Review[];
  rating: number;
  reviewCount: number;
}) {
  return (
    <section aria-labelledby="reviews-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="reviews-heading" className="text-xl font-semibold tracking-tight">
          Reviews
        </h2>
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Stars rating={rating} />
          <span className="font-semibold text-foreground">{rating.toFixed(1)}</span>
          from {reviewCount.toLocaleString("en-IN")} explorers
        </p>
      </div>

      <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-xs text-success">
        <BadgeCheck className="size-3.5" aria-hidden />
        Only explorers with a verified check-in here can leave a review.
      </p>

      <ul className="mt-5 space-y-4">
        {reviews.map((r) => (
          <li key={r.id} className="rounded-(--radius-card) border border-border p-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                style={{ background: r.avatarColor }}
              >
                {initials(r.displayName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  @{r.username} · {formatDate(r.createdAt)}
                </p>
              </div>
              <Stars rating={r.rating} />
            </div>

            <p className="mt-3 text-sm leading-relaxed text-foreground">{r.body}</p>

            {r.tip ? (
              <p className="mt-3 flex gap-2 rounded-lg bg-muted p-3 text-sm">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <span>
                  <span className="font-medium">Tip: </span>
                  {r.tip}
                </span>
              </p>
            ) : null}

            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ThumbsUp className="size-3.5" aria-hidden />
              {r.helpfulCount} found this helpful
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
