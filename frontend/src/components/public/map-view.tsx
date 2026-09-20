"use client";

import * as React from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { circlePolygon } from "@/lib/geo";
import { TIER_POINTS } from "@/lib/points";
import type { DestinationSummary, LatLng, Tier } from "@/lib/types";
import { cn } from "@/lib/utils";
import { resolveStyle, TIER_PIN_COLOR } from "./map-style";

export interface MapPin {
  slug: string;
  name: string;
  tier: Tier;
  district: string;
  location: LatLng;
}

export function toPins(rows: DestinationSummary[]): MapPin[] {
  return rows.map((d) => ({
    slug: d.slug,
    name: d.name,
    tier: d.tier,
    district: d.district,
    location: d.location,
  }));
}

const SOURCE = "destinations";

/**
 * Shared map surface.
 *
 * Pins go into a single clustered GeoJSON source rather than being rendered as
 * DOM markers — TEAM_PLAN flags 300+ pins as a performance trap, and cluster
 * layers keep it to one draw call regardless of catalogue size.
 */
export function MapView({
  pins,
  center,
  zoom = 6,
  className,
  activeSlug,
  onSelect,
  geofence,
  fitToPins = true,
  interactive = true,
  routeOrder,
}: {
  pins: MapPin[];
  center?: LatLng;
  zoom?: number;
  className?: string;
  activeSlug?: string;
  onSelect?: (slug: string) => void;
  /** Draws a pin-and-radius geofence, used on detail pages and in the CMS. */
  geofence?: { centre: LatLng; radiusM: number; polygon?: LatLng[] };
  fitToPins?: boolean;
  interactive?: boolean;
  /** When set, connects the pins in array order — used for circuits. */
  routeOrder?: string[];
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const onSelectRef = React.useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the map once.
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: resolveStyle(),
        center: [center?.lng ?? 78.6569, center?.lat ?? 23.4733],
        zoom,
        attributionControl: { compact: true },
        interactive,
      });
    } catch (err) {
      // MapLibre throws synchronously when WebGL is unavailable — a GPU
      // blocklist, WebGL disabled in the browser, or an old low-end Android.
      // Unhandled, that throw takes down the whole destination page. Losing
      // the map is acceptable; losing the listing is not.
      console.warn("Map unavailable, falling back to coordinates:", err);
      setFailed(true);
      return;
    }

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => setReady(true));
    map.on("error", (e) => console.warn("Map error:", e.error?.message ?? e));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Intentionally mount-only; subsequent prop changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pins, clusters and the route line.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: pins.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.location.lng, p.location.lat] },
        properties: {
          slug: p.slug,
          name: p.name,
          tier: p.tier,
          district: p.district,
          points: TIER_POINTS[p.tier],
        },
      })),
    };

    const existing = map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
    } else {
      map.addSource(SOURCE, {
        type: "geojson",
        data,
        cluster: true,
        clusterRadius: 48,
        clusterMaxZoom: 11,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: SOURCE,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#32408c",
          "circle-opacity": 0.9,
          "circle-radius": ["step", ["get", "point_count"], 16, 5, 21, 12, 27],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: SOURCE,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        },
        paint: { "text-color": "#ffffff" },
      });

      map.addLayer({
        id: "pins",
        type: "circle",
        source: SOURCE,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 8,
          "circle-color": [
            "match",
            ["get", "tier"],
            1, TIER_PIN_COLOR[1],
            2, TIER_PIN_COLOR[2],
            3, TIER_PIN_COLOR[3],
            4, TIER_PIN_COLOR[4],
            TIER_PIN_COLOR[3],
          ],
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "pins-active",
        type: "circle",
        source: SOURCE,
        filter: ["==", ["get", "slug"], "__none__"],
        paint: {
          "circle-radius": 13,
          "circle-color": "transparent",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#32408c",
        },
      });

      const popup = new maplibregl.Popup({
        closeButton: false,
        offset: 14,
        className: "bt-popup",
      });

      map.on("mouseenter", "pins", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;
        const props = f.properties as Record<string, string | number>;
        const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
        popup
          .setLngLat([lng, lat])
          .setHTML(
            `<div style="padding:8px 10px;max-width:220px">
               <div style="font-weight:600;font-size:13px">${props.name}</div>
               <div style="font-size:11px;opacity:.7;margin-top:2px">${props.district} · Tier ${props.tier} · ${props.points} pts</div>
             </div>`,
          )
          .addTo(map);
      });
      map.on("mouseleave", "pins", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
      map.on("click", "pins", (e) => {
        const slug = e.features?.[0]?.properties?.slug as string | undefined;
        if (slug) onSelectRef.current?.(slug);
      });
      map.on("click", "clusters", async (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const src = map.getSource(SOURCE) as maplibregl.GeoJSONSource;
        const z = await src.getClusterExpansionZoom(f.properties!.cluster_id as number);
        map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: z });
      });
      map.on("mouseenter", "clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "clusters", () => {
        map.getCanvas().style.cursor = "";
      });
    }

    // Route line for circuits.
    const routeId = "route-line";
    if (routeOrder?.length) {
      const ordered = routeOrder
        .map((slug) => pins.find((p) => p.slug === slug))
        .filter((p): p is MapPin => Boolean(p));
      const line: GeoJSON.Feature = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: ordered.map((p) => [p.location.lng, p.location.lat]),
        },
      };
      const src = map.getSource(routeId) as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(line);
      else {
        map.addSource(routeId, { type: "geojson", data: line });
        map.addLayer(
          {
            id: routeId,
            type: "line",
            source: routeId,
            paint: {
              "line-color": "#32408c",
              "line-width": 2.5,
              "line-dasharray": [2, 1.5],
              "line-opacity": 0.75,
            },
          },
          "clusters",
        );
      }
    }

    if (fitToPins && pins.length > 0) {
      const b = new maplibregl.LngLatBounds();
      pins.forEach((p) => b.extend([p.location.lng, p.location.lat]));
      map.fitBounds(b, { padding: 56, maxZoom: 11, duration: 0 });
    }
  }, [pins, ready, fitToPins, routeOrder]);

  // Geofence overlay.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const id = "geofence";
    if (!geofence) {
      if (map.getLayer(`${id}-fill`)) map.removeLayer(`${id}-fill`);
      if (map.getLayer(`${id}-line`)) map.removeLayer(`${id}-line`);
      if (map.getSource(id)) map.removeSource(id);
      return;
    }
    const ring =
      geofence.polygon?.length && geofence.polygon.length > 2
        ? [...geofence.polygon.map((p) => [p.lng, p.lat] as [number, number]),
           [geofence.polygon[0].lng, geofence.polygon[0].lat] as [number, number]]
        : circlePolygon(geofence.centre, geofence.radiusM);

    const data: GeoJSON.Feature = {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [ring] },
    };

    const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData(data);
    } else {
      map.addSource(id, { type: "geojson", data });
      map.addLayer({
        id: `${id}-fill`,
        type: "fill",
        source: id,
        paint: { "fill-color": "#32408c", "fill-opacity": 0.1 },
      });
      map.addLayer({
        id: `${id}-line`,
        type: "line",
        source: id,
        paint: { "line-color": "#32408c", "line-width": 1.5, "line-dasharray": [3, 2] },
      });
    }
  }, [geofence, ready]);

  // Highlight the hovered/selected card's pin.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer("pins-active")) return;
    map.setFilter("pins-active", ["==", ["get", "slug"], activeSlug ?? "__none__"]);
  }, [activeSlug, ready]);

  // Recentre when the caller moves the viewport.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !center || fitToPins) return;
    map.easeTo({ center: [center.lng, center.lat], zoom, duration: 400 });
  }, [center, zoom, ready, fitToPins]);

  if (failed) {
    return <MapFallback pins={pins} centre={center} className={className} />;
  }

  return (
    <div
      ref={containerRef}
      className={cn("h-full w-full overflow-hidden rounded-(--radius-card) bg-muted", className)}
      role="application"
      aria-label="Destination map"
    />
  );
}

/**
 * Shown when WebGL is unavailable. Everything the map was carrying — where the
 * places are and how to navigate to them — stays reachable as text and links.
 */
function MapFallback({
  pins,
  centre,
  className,
}: {
  pins: MapPin[];
  centre?: LatLng;
  className?: string;
}) {
  const focus = centre ?? pins[0]?.location;

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-(--radius-card) border border-border bg-muted/50",
        className,
      )}
    >
      <p className="border-b border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
        The interactive map needs WebGL, which this browser has turned off or
        cannot use. Locations and directions are below.
      </p>

      <ul className="flex-1 divide-y divide-border overflow-y-auto">
        {pins.map((p) => (
          <li key={p.slug} className="flex items-center gap-3 px-4 py-2.5">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: TIER_PIN_COLOR[p.tier] }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{p.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {p.district ? `${p.district} · ` : ""}
                {p.location.lat.toFixed(4)}, {p.location.lng.toFixed(4)} · Tier{" "}
                {p.tier} · {TIER_POINTS[p.tier]} pts
              </span>
            </span>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${p.location.lat},${p.location.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs font-medium text-primary hover:underline"
            >
              Directions
            </a>
          </li>
        ))}
      </ul>

      {focus && pins.length > 1 ? (
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Centred on {focus.lat.toFixed(4)}, {focus.lng.toFixed(4)}
        </p>
      ) : null}
    </div>
  );
}
