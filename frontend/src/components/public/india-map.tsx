/**
 * The states-visited map (PRD F17).
 *
 * TEAM_PLAN calls this "the retention artifact — make it beautiful". A real
 * GeoJSON outline of 36 states is a heavy payload for what is a progress
 * display, so this is a schematic grid map: one tile per state and union
 * territory, laid out in roughly the right geographic positions. It fills in
 * as you travel, it reads at a glance, and it costs nothing.
 */

import { cn } from "@/lib/utils";

/** [code, label, column, row] on a 10×9 grid, arranged to echo India's shape. */
const GRID: [string, string, number, number][] = [
  ["LA", "Ladakh", 4, 1],
  ["JK", "J&K", 3, 1],
  ["HP", "Himachal", 4, 2],
  ["PB", "Punjab", 3, 2],
  ["CH", "Chandigarh", 3, 3],
  ["UK", "Uttarakhand", 5, 2],
  ["HR", "Haryana", 4, 3],
  ["DL", "Delhi", 5, 3],
  ["RJ", "Rajasthan", 3, 4],
  ["UP", "Uttar Pradesh", 5, 4],
  ["SK", "Sikkim", 8, 3],
  ["AR", "Arunachal", 10, 3],
  ["BR", "Bihar", 7, 4],
  ["AS", "Assam", 9, 4],
  ["NL", "Nagaland", 10, 4],
  ["GJ", "Gujarat", 2, 5],
  ["MP", "Madhya Pradesh", 4, 5],
  ["JH", "Jharkhand", 7, 5],
  ["WB", "West Bengal", 8, 5],
  ["ML", "Meghalaya", 9, 5],
  ["MN", "Manipur", 10, 5],
  ["DH", "DNH & DD", 2, 6],
  ["MH", "Maharashtra", 3, 6],
  ["CG", "Chhattisgarh", 6, 6],
  ["OR", "Odisha", 7, 6],
  ["TR", "Tripura", 9, 6],
  ["MZ", "Mizoram", 10, 6],
  ["GA", "Goa", 3, 7],
  ["TG", "Telangana", 5, 7],
  ["AN", "Andaman & Nicobar", 9, 8],
  ["KA", "Karnataka", 4, 8],
  ["AP", "Andhra Pradesh", 6, 8],
  ["LD", "Lakshadweep", 2, 9],
  ["KL", "Kerala", 4, 9],
  ["TN", "Tamil Nadu", 5, 9],
  ["PY", "Puducherry", 6, 9],
];

export function IndiaMap({
  visited,
  className,
}: {
  visited: string[];
  className?: string;
}) {
  const set = new Set(visited);

  return (
    <figure className={className}>
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
          gridTemplateRows: "repeat(9, minmax(0, 1fr))",
        }}
        role="img"
        aria-label={`States visited: ${visited.length} of 36. ${visited.join(", ")}`}
      >
        {GRID.map(([code, label, col, row]) => {
          const hit = set.has(code);
          return (
            <span
              key={code}
              title={label}
              style={{ gridColumn: col, gridRow: row }}
              className={cn(
                "grid aspect-square place-items-center rounded-[5px] text-[9px] font-bold transition-colors",
                hit
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground/45",
              )}
            >
              {code}
            </span>
          );
        })}
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{visited.length}</span> of
        36 states and union territories · {36 - visited.length} to go for the
        &ldquo;All 28+8&rdquo; badge
      </figcaption>
    </figure>
  );
}
