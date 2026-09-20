/**
 * Hero imagery for collections (circuits, challenges).
 *
 * A collection has no photograph of its own, so it borrows one from a
 * destination genuinely on its route — carrying that photo's real attribution
 * with it rather than minting a new credit. Falls back to the generated
 * gradient panel when none of the member destinations has a cleared photo.
 */

import type { Media } from "@/lib/types";
import { destinationImages } from "./images";

export function collectionHero(
  kind: "circuit" | "challenge",
  slug: string,
  caption: string,
  destinationSlugs: readonly string[],
): Media {
  const borrowedSlug = destinationSlugs.find((s) => destinationImages[s]);
  const borrowed = borrowedSlug ? destinationImages[borrowedSlug] : undefined;

  if (borrowed) {
    return {
      id: `media-${kind}-${slug}`,
      url: borrowed.url,
      caption,
      source: "official",
      attribution: borrowed.attribution,
      licence: borrowed.licence,
      sourceUrl: borrowed.sourceUrl,
      width: borrowed.width,
      height: borrowed.height,
    };
  }

  return {
    id: `media-${kind}-${slug}`,
    url: `bt://gradient/${kind}-${slug}`,
    caption,
    source: "official",
    attribution: "Pending — awaiting licensed imagery",
    licence: "TBD",
    width: 1600,
    height: 900,
  };
}
