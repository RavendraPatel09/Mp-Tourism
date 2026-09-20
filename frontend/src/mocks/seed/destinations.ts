/**
 * The MVP catalogue: 29 curated Madhya Pradesh destinations across all four tiers.
 *
 * Deliberately weighted toward Tier 3 and 4 (17 of 29). A catalogue that mirrors
 * existing footfall would just reinforce it — the content has to embody the
 * redistribution thesis, not only the points table.
 */

import { buildDestination } from "./factory";
import { tier1 } from "./tier1";
import { tier2 } from "./tier2";
import { tier3 } from "./tier3";
import { tier4 } from "./tier4";

export const destinationSeeds = [...tier1, ...tier2, ...tier3, ...tier4];

export const destinations = destinationSeeds.map(buildDestination);
