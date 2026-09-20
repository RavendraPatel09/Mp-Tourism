"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Circle, Pentagon, RotateCcw, Target } from "lucide-react";
import { haversineKm, isWithinGeofence } from "@/lib/geo";
import type { LatLng } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MapView = dynamic(
  () => import("@/components/public/map-view").then((m) => m.MapView),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> },
);

/**
 * Geofence editor (PRD F22).
 *
 * TEAM_PLAN: "support both draw polygon and drop pin + radius, because 90% of
 * destinations only need the latter." So pin+radius is the default mode and
 * polygon is opt-in. The containment tester below mirrors the server-side rule
 * exactly — accept if the device's accuracy circle intersects the fence — so
 * an editor can check a real GPS reading before publishing.
 */
export function GeofenceEditor({
  name,
  tier,
  centre,
  radiusM,
  polygon,
  onChange,
}: {
  name: string;
  tier: 1 | 2 | 3 | 4;
  centre: LatLng;
  radiusM: number;
  polygon?: LatLng[];
  onChange?: (next: { centre: LatLng; radiusM: number; polygon?: LatLng[] }) => void;
}) {
  const [mode, setMode] = React.useState<"radius" | "polygon">(
    polygon?.length ? "polygon" : "radius",
  );
  const [radius, setRadius] = React.useState(radiusM);
  const [testLat, setTestLat] = React.useState(centre.lat.toFixed(5));
  const [testLng, setTestLng] = React.useState(centre.lng.toFixed(5));
  const [testAccuracy, setTestAccuracy] = React.useState(20);

  React.useEffect(() => {
    onChange?.({ centre, radiusM: radius, polygon: mode === "polygon" ? polygon : undefined });
    // onChange is a callback prop; re-running on its identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius, mode]);

  const testPoint: LatLng = {
    lat: Number(testLat) || centre.lat,
    lng: Number(testLng) || centre.lng,
  };
  const distanceM = Math.round(haversineKm(testPoint, centre) * 1000);
  const inside = isWithinGeofence(testPoint, centre, radius, testAccuracy);
  const strictlyInside = distanceM <= radius;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          <button
            type="button"
            onClick={() => setMode("radius")}
            aria-pressed={mode === "radius"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
              mode === "radius" ? "bg-muted" : "text-muted-foreground",
            )}
          >
            <Circle className="size-3.5" aria-hidden />
            Pin + radius
          </button>
          <button
            type="button"
            onClick={() => setMode("polygon")}
            aria-pressed={mode === "polygon"}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
              mode === "polygon" ? "bg-muted" : "text-muted-foreground",
            )}
          >
            <Pentagon className="size-3.5" aria-hidden />
            Polygon
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === "radius"
            ? "Covers around 90% of destinations. Use polygon only for large parks with an awkward shape."
            : polygon?.length
              ? `${polygon.length} vertices stored for ${name}.`
              : "No polygon stored yet — falls back to the radius until one is drawn."}
        </p>
      </div>

      <div className="h-80 overflow-hidden rounded-(--radius-card) border border-border">
        <MapView
          pins={[{ slug: "target", name, tier, district: "", location: centre }]}
          center={centre}
          zoom={radius > 2000 ? 12 : radius > 600 ? 14 : 15}
          fitToPins={false}
          geofence={{
            centre,
            radiusM: radius,
            polygon: mode === "polygon" ? polygon : undefined,
          }}
        />
      </div>

      {mode === "radius" ? (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="radius" className="text-sm font-medium">
              Geofence radius
            </label>
            <span className="text-sm font-semibold tabular-nums">{radius} m</span>
          </div>
          <input
            id="radius"
            type="range"
            min={100}
            max={5000}
            step={50}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--primary)]"
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>100 m — a single monument</span>
            <span>5 km — a national park zone</span>
          </div>
          {radius !== radiusM ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRadius(radiusM)}
              className="mt-2 gap-1.5"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Reset to saved ({radiusM} m)
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------------------------ containment tester */}
      <div className="rounded-(--radius-card) border border-border bg-muted/40 p-4">
        <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <Target className="size-4" aria-hidden />
          Containment tester
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste a real GPS reading from a device at the site. This applies the
          same rule the server does — accepted if the accuracy circle
          intersects the fence, not a strict point-in-circle.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs">
            <span className="block font-medium">Latitude</span>
            <input
              value={testLat}
              onChange={(e) => setTestLat(e.target.value)}
              inputMode="decimal"
              className="mt-1 h-9 w-full rounded-lg border border-border bg-input px-2.5 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="block font-medium">Longitude</span>
            <input
              value={testLng}
              onChange={(e) => setTestLng(e.target.value)}
              inputMode="decimal"
              className="mt-1 h-9 w-full rounded-lg border border-border bg-input px-2.5 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="block font-medium">Accuracy ±m</span>
            <input
              type="number"
              min={0}
              max={500}
              value={testAccuracy}
              onChange={(e) => setTestAccuracy(Number(e.target.value))}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-input px-2.5 text-sm"
            />
          </label>
        </div>

        <div
          className={cn(
            "mt-3 rounded-lg px-3 py-2.5 text-sm",
            inside ? "bg-success/12 text-success" : "bg-danger/12 text-danger",
          )}
        >
          <strong>{inside ? "Would be accepted" : "Would be rejected"}</strong> —{" "}
          {distanceM} m from centre against a {radius} m fence.
          {inside && !strictlyInside
            ? ` Outside the fence itself, but inside once ±${testAccuracy} m accuracy is allowed for.`
            : ""}
        </div>
      </div>
    </div>
  );
}
