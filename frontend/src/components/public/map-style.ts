import type { StyleSpecification } from "maplibre-gl";

/**
 * Default basemap.
 *
 * MapLibre is API-compatible with Mapbox GL (the PRD's pick) but needs no
 * access token, so the app runs for anyone who clones the repo. Set
 * NEXT_PUBLIC_MAP_STYLE_URL and NEXT_PUBLIC_MAPBOX_TOKEN to switch to a Mapbox
 * vector style when there is a billing account.
 */
export const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#e8e4dd" } },
    {
      id: "osm",
      type: "raster",
      source: "osm",
      paint: { "raster-saturation": -0.35, "raster-contrast": 0.05 },
    },
  ],
};

export const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL;
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function resolveStyle(): string | StyleSpecification {
  if (MAP_STYLE_URL && MAPBOX_TOKEN) {
    return MAP_STYLE_URL.replace(
      "mapbox://styles/",
      "https://api.mapbox.com/styles/v1/",
    ).concat(`?access_token=${MAPBOX_TOKEN}`);
  }
  if (MAP_STYLE_URL) return MAP_STYLE_URL;
  return OSM_STYLE;
}

/** Tier colours as literals — MapLibre paint expressions cannot read CSS vars. */
export const TIER_PIN_COLOR: Record<number, string> = {
  1: "#5b6573",
  2: "#1f6f66",
  3: "#9a640d",
  4: "#a93c1c",
};
