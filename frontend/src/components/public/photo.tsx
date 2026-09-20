import Image from "next/image";
import type { Media, Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Destination imagery.
 *
 * Real photos are Wikimedia Commons files under verified free licences, carried
 * in the seed with photographer and file page. Most are CC BY-SA, which makes
 * credit a licence condition rather than a nicety — pass `credit` anywhere the
 * image renders large enough to show it.
 *
 * Anything still awaiting rights keeps a `bt://gradient/...` URL and renders a
 * generated, tier-tinted panel. Swapping a placeholder for a real photo stays a
 * data change, not a code change.
 */

const TIER_GRADIENT: Record<Tier, [string, string]> = {
  1: ["#4a5564", "#2b323c"],
  2: ["#1f6f66", "#123f3a"],
  3: ["#9a640d", "#5c3b06"],
  4: ["#a93c1c", "#61200e"],
};

function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** A licence we actually cleared, as opposed to a seed placeholder. */
function cleared(
  media: Media | { url: string; caption?: string },
): media is Media {
  const l = (media as Media).licence;
  return Boolean(l) && l !== "TBD";
}

export function Photo({
  media,
  tier = 3,
  alt,
  className,
  sizes,
  priority,
  fill = true,
  credit = false,
  scrim = false,
}: {
  media: Media | { url: string; caption?: string };
  tier?: Tier;
  alt?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  fill?: boolean;
  /** Render the photographer/licence overlay. Required by CC BY-SA. */
  credit?: boolean;
  /** Darken the top edge so badges overlaid on the image stay legible. */
  scrim?: boolean;
}) {
  const label = alt ?? media.caption ?? "";
  const isGenerated = media.url.startsWith("bt://gradient/");

  if (!isGenerated) {
    return (
      <>
        <Image
          src={media.url}
          alt={label}
          fill={fill}
          sizes={sizes ?? "100vw"}
          priority={priority}
          className={cn("object-cover", className)}
        />
        {scrim ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/35 to-transparent"
          />
        ) : null}
        {credit && cleared(media) ? (
          <span className="pointer-events-none absolute right-1.5 bottom-1.5 max-w-[90%] truncate rounded bg-black/55 px-1.5 py-0.5 text-[10px] leading-tight text-white/90 backdrop-blur-[2px]">
            © {media.attribution} · {media.licence}
          </span>
        ) : null}
      </>
    );
  }

  const seed = hash(media.url);
  const [from, to] = TIER_GRADIENT[tier];
  const angle = 115 + (seed % 90);
  // Contour-like bands give the panel some texture without shipping an asset.
  const bandOffset = seed % 37;

  return (
    <div
      role="img"
      aria-label={label || "Imagery pending licence"}
      className={cn("absolute inset-0 overflow-hidden", className)}
      style={{ background: `linear-gradient(${angle}deg, ${from}, ${to})` }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage: `repeating-radial-gradient(circle at ${18 + bandOffset}% ${72 - bandOffset}%, rgba(255,255,255,0.22) 0 1px, transparent 1px 22px)`,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.42), rgba(0,0,0,0.05) 55%, transparent)",
        }}
      />
      {label ? (
        <span className="absolute right-3 bottom-3 left-3 line-clamp-2 text-[11px] leading-snug font-medium text-white/85">
          {label}
        </span>
      ) : null}
    </div>
  );
}
