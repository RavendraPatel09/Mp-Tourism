import { BadgeCriteria } from 'src/entities';

/**
 * The ~20 MVP badges (PRD §5.2 F13), grouped as the PRD groups them.
 *
 * Every one is expressed as criteria the badge engine evaluates against current
 * state, never as a counter it increments — which is what lets a new badge be
 * added to a live platform and backfilled correctly.
 */
export const BADGE_SEED: {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold';
  criteria: BadgeCriteria;
}[] = [
  // ---- behavioural: the ones that reward the product's actual goal ----
  {
    code: 'first_steps',
    name: 'First Steps',
    description: 'Your first verified check-in.',
    icon: 'footprints',
    tier: 'bronze',
    criteria: { kind: 'check_in_count', count: 1 },
  },
  {
    code: 'pioneer',
    name: 'Pioneer',
    description: 'The first person ever to verify a destination.',
    icon: 'flag',
    tier: 'gold',
    criteria: { kind: 'pioneer' },
  },
  {
    code: 'off_the_map',
    name: 'Off the Map',
    description: '20 check-ins at Tier-4 destinations — the rarest places on the platform.',
    icon: 'compass',
    tier: 'gold',
    criteria: { kind: 'tier_count', min_tier: 4, count: 20 },
  },
  {
    code: 'road_less_taken',
    name: 'The Road Less Taken',
    description: '10 check-ins at Tier-3 or rarer destinations.',
    icon: 'route',
    tier: 'silver',
    criteria: { kind: 'tier_count', min_tier: 3, count: 10 },
  },
  {
    code: 'sunrise_club',
    name: 'Sunrise Club',
    description: '5 check-ins between 5 am and 7 am.',
    icon: 'sunrise',
    tier: 'silver',
    criteria: { kind: 'time_of_day', from_hour: 5, to_hour: 7, count: 5 },
  },
  {
    code: 'monsoon_soul',
    name: 'Monsoon Soul',
    description: '5 check-ins at places that are at their best in the rains.',
    icon: 'cloud-rain',
    tier: 'silver',
    criteria: { kind: 'season_count', season: 'monsoon', count: 5 },
  },
  {
    code: 'twenty_five',
    name: 'Twenty-Five',
    description: '25 verified check-ins.',
    icon: 'badge-check',
    tier: 'silver',
    criteria: { kind: 'check_in_count', count: 25 },
  },
  {
    code: 'hundred_club',
    name: 'Hundred Club',
    description: '100 verified check-ins.',
    icon: 'trophy',
    tier: 'gold',
    criteria: { kind: 'check_in_count', count: 100 },
  },

  // ---- geographic ----
  {
    code: 'mp_explorer',
    name: 'Madhya Pradesh Explorer',
    description: '10 destinations in Madhya Pradesh.',
    icon: 'map',
    tier: 'bronze',
    criteria: { kind: 'state_destinations', count: 10, state_code: 'MP' },
  },
  {
    code: 'state_regular',
    name: 'State Regular',
    description: '25 destinations in a single state.',
    icon: 'map-pinned',
    tier: 'silver',
    criteria: { kind: 'state_destinations', count: 25 },
  },
  {
    code: 'state_completionist',
    name: 'State Completionist',
    description: '80% of a state’s published destinations.',
    icon: 'crown',
    tier: 'gold',
    criteria: { kind: 'state_completion', ratio: 0.8 },
  },
  {
    code: 'all_states',
    name: 'All 28+8',
    description: 'A verified check-in in every state and union territory.',
    icon: 'globe',
    tier: 'gold',
    criteria: { kind: 'all_states' },
  },

  // ---- thematic ----
  {
    code: 'fort_hunter',
    name: 'Fort Hunter',
    description: '15 historical sites.',
    icon: 'castle',
    tier: 'silver',
    criteria: { kind: 'category_count', category_slug: 'historical', count: 15 },
  },
  {
    code: 'waterfall_chaser',
    name: 'Waterfall Chaser',
    description: '8 waterfalls.',
    icon: 'droplets',
    tier: 'silver',
    criteria: { kind: 'category_count', category_slug: 'waterfalls', count: 8 },
  },
  {
    code: 'wildlife_tracker',
    name: 'Wildlife Tracker',
    description: '5 wildlife destinations.',
    icon: 'paw-print',
    tier: 'silver',
    criteria: { kind: 'category_count', category_slug: 'wildlife', count: 5 },
  },
  {
    code: 'temple_trail',
    name: 'Temple Trail',
    description: '12 religious sites.',
    icon: 'temple',
    tier: 'silver',
    criteria: { kind: 'category_count', category_slug: 'religious', count: 12 },
  },
  {
    code: 'street_food_scout',
    name: 'Street Food Scout',
    description: '10 food destinations.',
    icon: 'utensils',
    tier: 'bronze',
    criteria: { kind: 'category_count', category_slug: 'food', count: 10 },
  },
  {
    code: 'craft_keeper',
    name: 'Craft Keeper',
    description: '6 tribal and craft villages — the places where a visit is income.',
    icon: 'hand',
    tier: 'gold',
    criteria: { kind: 'category_count', category_slug: 'tribal-craft', count: 6 },
  },
  {
    code: 'offbeat_seeker',
    name: 'Offbeat Seeker',
    description: '10 offbeat destinations.',
    icon: 'binoculars',
    tier: 'silver',
    criteria: { kind: 'category_count', category_slug: 'offbeat', count: 10 },
  },

  // ---- contribution ----
  {
    code: 'chronicler',
    name: 'Chronicler',
    description: '50 photos accepted into destination galleries.',
    icon: 'camera',
    tier: 'gold',
    criteria: { kind: 'accepted_media', count: 50 },
  },
  {
    code: 'first_photo',
    name: 'Contributor',
    description: 'Your first photo accepted into a destination gallery.',
    icon: 'image',
    tier: 'bronze',
    criteria: { kind: 'accepted_media', count: 1 },
  },
];
