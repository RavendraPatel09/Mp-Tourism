import { ImageResponse } from "next/og";
import { serverApi } from "@/lib/api/server";
import { TIER_META } from "@/lib/points";

export const alt = "Destination on YatraGo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TIER_COLOR: Record<number, [string, string]> = {
  1: ["#4a5564", "#2b323c"],
  2: ["#1f6f66", "#123f3a"],
  3: ["#9a640d", "#5c3b06"],
  4: ["#a93c1c", "#61200e"],
};

export default async function OpengraphImage({
  params,
}: {
  params: { slug: string };
}) {
  const d = await serverApi.destination(params.slug);
  const tier = d?.tier ?? 3;
  const [from, to] = TIER_COLOR[tier];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, opacity: 0.85 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(255,255,255,0.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            YG
          </div>
          YatraGo
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, opacity: 0.8, marginBottom: 12 }}>
            {d ? `${d.district}, ${d.stateName}` : "India"}
          </div>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.08, maxWidth: 980 }}>
            {d?.name ?? "Discover where nobody goes"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 24px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.18)",
              fontWeight: 700,
            }}
          >
            {d?.basePoints ?? 150} points
          </div>
          <div style={{ display: "flex", opacity: 0.85 }}>
            {TIER_META[tier as 1 | 2 | 3 | 4].label}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
