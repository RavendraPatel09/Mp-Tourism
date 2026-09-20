/**
 * A handful of real MP destinations spanning all four tiers, so that every path
 * in the app has something to render on a fresh database: a Tier-1 marquee site
 * worth almost nothing, a Tier-4 site worth 150, an eco-sensitive one, a
 * monsoon-only one, and one with a genuine hazard.
 *
 * This is **not** the content set. The 150 curated destinations come from the
 * team's shared sheet through Member C's bulk importer (TEAM_PLAN, content
 * pipeline). These exist so nobody has to wait for that to build a screen.
 */
export interface DestinationSeed {
  name: string;
  district: string;
  description: string;
  story?: string;
  lat: number;
  lng: number;
  geofenceRadiusM: number;
  tier: 1 | 2 | 3 | 4;
  categories: string[];
  aliases?: string[];
  bestSeason: string[];
  isMonsoonOnly?: boolean;
  minDurationMin: number;
  recommendedDurationMin: number;
  difficulty: 'easy' | 'moderate' | 'hard' | 'strenuous';
  avgBudget: 'free' | 'low' | 'medium' | 'high';
  crowdLevel: 'low' | 'moderate' | 'high' | 'at_capacity';
  isEcoSensitive?: boolean;
  annualVisitors?: number;
  hazards?: string[];
  accessibilityFlags?: Record<string, boolean>;
  thingsToDo: { title: string; description?: string; durationMin?: number }[];
  info: Record<string, unknown>;
}

export const DESTINATION_SEED: DestinationSeed[] = [
  {
    name: 'Khajuraho Group of Monuments',
    district: 'Chhatarpur',
    aliases: ['Khajurao', 'Khajraho', 'खजुराहो'],
    description:
      'The Chandela temple complex, and the one place in Madhya Pradesh that needs no ' +
      'introduction. Come for the sculpture, then use it as a base for the district.',
    story:
      'Built between 885 and 1050 CE, twenty-five of an original eighty-five temples survive. ' +
      'The carvings that made the site famous are a fraction of the surface; most of it is ' +
      'domestic and courtly life.',
    lat: 24.8318,
    lng: 79.9199,
    geofenceRadiusM: 900,
    tier: 1,
    categories: ['historical', 'heritage', 'architecture'],
    bestSeason: ['winter', 'post_monsoon'],
    minDurationMin: 180,
    recommendedDurationMin: 360,
    difficulty: 'easy',
    avgBudget: 'medium',
    crowdLevel: 'high',
    annualVisitors: 1_200_000,
    accessibilityFlags: { wheelchair: true, senior_friendly: true, child_friendly: true },
    thingsToDo: [
      { title: 'Kandariya Mahadeva at opening time, before the coaches', durationMin: 60 },
      { title: 'The Eastern Group — Jain temples, almost always quiet', durationMin: 60 },
      { title: 'Archaeological Museum for the fragments not on the temples', durationMin: 45 },
      { title: 'Evening sound and light show at the Western Group', durationMin: 50 },
    ],
    info: {
      timings: { open: '06:00', close: '18:00', closedDays: [], notes: 'Museum closed Fridays.' },
      entryFees: { indianAdult: 40, foreignAdult: 600, child: 0, currency: 'INR' },
      rules: ['No tripods without permission', 'ASI site — no drones'],
      facilities: { washroom: true, food: true, atm: true, network: 'good', guide: true },
      howToReach:
        'Khajuraho airport (5 km) has seasonal flights. Rail to Khajuraho station (6 km).',
      parking: 'Paid lot at the Western Group entrance.',
      bestTimeOfDay: 'First hour after opening',
      officialUrl: 'https://asi.nic.in/',
      emergencyContacts: {
        police: '100',
        hospital: { name: 'District Hospital Chhatarpur', distanceKm: 42 },
      },
      leaveNoTraceTips: ['Do not touch the carvings — skin oils accelerate erosion'],
    },
  },
  {
    name: 'Orchha Fort Complex',
    district: 'Niwari',
    aliases: ['Orcha', 'ओरछा'],
    description:
      'Palaces, cenotaphs and temples on a bend of the Betwa, mostly empty outside ' +
      'weekends. The Chaturbhuj temple tower is the tallest in the region.',
    story:
      'Founded by the Bundela Rajputs in the sixteenth century and abandoned for ' +
      'Tikamgarh in 1783, which is why so much of it survives unaltered.',
    lat: 25.3478,
    lng: 78.6413,
    geofenceRadiusM: 800,
    tier: 2,
    categories: ['historical', 'heritage', 'architecture'],
    bestSeason: ['winter', 'post_monsoon'],
    minDurationMin: 120,
    recommendedDurationMin: 300,
    difficulty: 'easy',
    avgBudget: 'low',
    crowdLevel: 'moderate',
    annualVisitors: 400_000,
    accessibilityFlags: { wheelchair: false, senior_friendly: true, child_friendly: true },
    thingsToDo: [
      {
        title: 'Climb to the Baradari in Jehangir Mahal for the valley view',
        description: 'Best in the hour before sunset. Steep last flight, no railing.',
        durationMin: 45,
      },
      {
        title: 'Walk the Chhatris along the Betwa at first light',
        description: 'Fourteen cenotaphs, usually deserted before 8 am.',
        durationMin: 60,
      },
      {
        title: 'Catch the evening aarti at Ram Raja Temple',
        description: 'The only temple in India where Rama is worshipped as a king.',
        durationMin: 40,
      },
      { title: 'Try bafla at the stalls outside Gate 2', durationMin: 30 },
    ],
    info: {
      timings: { open: '08:00', close: '18:00', closedDays: [], notes: 'Temple timings differ.' },
      entryFees: { indianAdult: 25, foreignAdult: 300, child: 0, camera: 25, currency: 'INR' },
      rules: ['No drones without ASI permission', 'Remove footwear inside the temple'],
      facilities: { washroom: true, food: true, atm: false, network: 'patchy', guide: true },
      howToReach: 'Rail to Jhansi (18 km), then taxi or bus. Road access is good year-round.',
      lastMileNotes: 'Last 2 km is a single-lane road through the village.',
      parking: 'Free unpaved lot near the fort gate.',
      bestTimeOfDay: 'Early morning or the hour before sunset',
      officialUrl: 'https://mptourism.com/',
      emergencyContacts: { police: '100', hospital: { name: 'CHC Orchha', distanceKm: 1.5 } },
      leaveNoTraceTips: ['Carry your plastic back out', 'Do not climb on the cenotaph walls'],
    },
  },
  {
    name: 'Bhojpur Shiva Temple',
    district: 'Raisen',
    aliases: ['Bhojeshwar', 'भोजपुर'],
    description:
      'An unfinished eleventh-century temple holding one of the largest monolithic ' +
      'lingams in India. The construction ramp is still in place — you can see how it was built.',
    lat: 23.1333,
    lng: 77.6167,
    geofenceRadiusM: 250,
    tier: 3,
    categories: ['religious', 'historical', 'architecture'],
    bestSeason: ['winter', 'monsoon', 'post_monsoon'],
    minDurationMin: 60,
    recommendedDurationMin: 120,
    difficulty: 'easy',
    avgBudget: 'free',
    crowdLevel: 'low',
    annualVisitors: 60_000,
    accessibilityFlags: { wheelchair: false, senior_friendly: true, child_friendly: true },
    thingsToDo: [
      { title: 'The 7.5 m lingam in the sanctum', durationMin: 20 },
      {
        title: 'The earthen construction ramp on the west side',
        description: 'Rare surviving evidence of medieval temple engineering.',
        durationMin: 25,
      },
      { title: 'Mason’s marks and unfinished carvings on the outer walls', durationMin: 30 },
    ],
    info: {
      timings: { open: '07:00', close: '18:30', closedDays: [] },
      entryFees: { indianAdult: 0, foreignAdult: 0, currency: 'INR' },
      rules: ['Remove footwear before the sanctum'],
      facilities: { washroom: true, food: false, atm: false, network: 'patchy', guide: false },
      howToReach: '28 km from Bhopal by road. No public transport after dark.',
      parking: 'Roadside, informal.',
      bestTimeOfDay: 'Morning',
      emergencyContacts: { police: '100', hospital: { name: 'CHC Goharganj', distanceKm: 14 } },
      leaveNoTraceTips: ['No offerings of plastic-wrapped items'],
    },
  },
  {
    name: 'Chandrehi Stepwell',
    district: 'Sidhi',
    aliases: ['Chandrehe'],
    description:
      'A tenth-century stepwell and Shaiva monastery beside the Son, 40 km off the ' +
      'highway and almost entirely undocumented. Effectively nobody comes here.',
    lat: 24.2411,
    lng: 81.6033,
    geofenceRadiusM: 200,
    tier: 4,
    categories: ['offbeat', 'historical', 'heritage'],
    bestSeason: ['winter', 'post_monsoon'],
    minDurationMin: 45,
    recommendedDurationMin: 90,
    difficulty: 'moderate',
    avgBudget: 'free',
    crowdLevel: 'low',
    isEcoSensitive: true,
    annualVisitors: 1_200,
    hazards: [
      'Unlit approach road; do not attempt after dark',
      'River bank is unfenced and undercut in places',
    ],
    accessibilityFlags: { wheelchair: false, senior_friendly: false, child_friendly: false },
    thingsToDo: [
      { title: 'The circular monastery — one of very few surviving in India', durationMin: 30 },
      { title: 'Carved panels on the stepwell’s inner face', durationMin: 25 },
      { title: 'Walk down to the Son for the view back up at the site', durationMin: 25 },
    ],
    info: {
      timings: { open: 'sunrise', close: 'sunset', closedDays: [], notes: 'Unstaffed site.' },
      entryFees: { indianAdult: 0, foreignAdult: 0, currency: 'INR' },
      rules: ['Do not remove anything from the site', 'No open fires'],
      facilities: { washroom: false, food: false, atm: false, network: 'none', guide: false },
      howToReach:
        'Rail to Rewa (95 km), then hired car. The last 12 km is unsurfaced and impassable ' +
        'to low-clearance vehicles in the rains.',
      lastMileNotes: 'Ask for the Chandrehe math, not the stepwell — the local name differs.',
      parking: 'None. Park on the track and walk 200 m.',
      bestTimeOfDay: 'Late morning, once the light reaches the well floor',
      emergencyContacts: {
        police: '100',
        hospital: { name: 'District Hospital Sidhi', distanceKm: 58 },
      },
      leaveNoTraceTips: [
        'Carry out everything you bring in — there is no collection here',
        'Do not chalk or mark the carvings',
      ],
    },
  },
  {
    name: 'Bee Falls, Pachmarhi',
    district: 'Hoshangabad',
    aliases: ['Jamuna Prapat'],
    description:
      'A monsoon waterfall in the Satpura hills, reached by a steep stepped descent. ' +
      'Worth the trip between July and September and largely dry outside it.',
    lat: 22.4543,
    lng: 78.4326,
    geofenceRadiusM: 400,
    tier: 3,
    categories: ['waterfalls', 'nature', 'adventure'],
    bestSeason: ['monsoon'],
    isMonsoonOnly: true,
    minDurationMin: 90,
    recommendedDurationMin: 180,
    difficulty: 'moderate',
    avgBudget: 'low',
    crowdLevel: 'moderate',
    isEcoSensitive: true,
    annualVisitors: 150_000,
    hazards: [
      'Rocks are extremely slippery in the rains',
      'Flash flooding after upstream rainfall — leave the pool if the water clouds',
    ],
    accessibilityFlags: { wheelchair: false, senior_friendly: false, child_friendly: false },
    thingsToDo: [
      { title: 'The descent to the lower pool — roughly 300 steps', durationMin: 60 },
      { title: 'The upper viewpoint, for the fall in full', durationMin: 30 },
    ],
    info: {
      timings: { open: '07:00', close: '17:00', closedDays: [] },
      entryFees: { indianAdult: 30, foreignAdult: 30, currency: 'INR' },
      rules: ['No alcohol', 'No swimming when the flow is high'],
      facilities: { washroom: true, food: true, atm: false, network: 'patchy', guide: true },
      howToReach: 'Rail to Pipariya (47 km), then taxi to Pachmarhi and a short drive.',
      parking: 'Paid lot at the trailhead.',
      bestTimeOfDay: 'Morning, before the crowd and the afternoon rain',
      emergencyContacts: {
        police: '100',
        hospital: { name: 'Civil Hospital Pachmarhi', distanceKm: 4 },
      },
      leaveNoTraceTips: ['Do not wash with soap in the pool — it is a drinking source downstream'],
    },
  },
];
