/* eslint-disable no-console */
import 'reflect-metadata';
import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * The week-1 mock server (TEAM_PLAN deliverable 1).
 *
 * This is the single highest-leverage thing in the backlog: from day two,
 * Member A builds the app against it and Member C builds the admin dashboard
 * against it, and neither of them waits for me. It has no database, no Redis
 * and no dependencies beyond express — it starts in under a second and never
 * breaks because a migration is half-applied.
 *
 * It returns *believable* data, not `{}`: an Orchha with real timings, a
 * Tier-4 stepwell worth 150 points, a check-in that comes back pending and then
 * approved. Mock data that is too clean produces a UI that only works on clean
 * data, and the whole point of building against a mock is to find that out now.
 *
 *   npm run mock:server        # http://localhost:4010/v1
 */

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use((request, response, next) => {
  response.setHeader('X-Mock-Server', 'yatrago');
  // Deliberate latency: the app must show a spinner, not a frozen screen.
  setTimeout(next, 120 + Math.random() * 180);
});

const STATES = [
  {
    id: 'st-mp',
    name: 'Madhya Pradesh',
    code: 'MP',
    type: 'state',
    isLive: true,
    destinationCount: 150,
    heroMediaId: null,
  },
  {
    id: 'st-cg',
    name: 'Chhattisgarh',
    code: 'CG',
    type: 'state',
    isLive: false,
    destinationCount: 0,
    heroMediaId: null,
  },
  {
    id: 'st-rj',
    name: 'Rajasthan',
    code: 'RJ',
    type: 'state',
    isLive: false,
    destinationCount: 0,
    heroMediaId: null,
  },
];

const CATEGORIES = [
  { id: 'cat-historical', name: 'Historical', slug: 'historical', icon: 'landmark', orderIndex: 1 },
  { id: 'cat-religious', name: 'Religious', slug: 'religious', icon: 'temple', orderIndex: 2 },
  { id: 'cat-nature', name: 'Nature', slug: 'nature', icon: 'tree', orderIndex: 3 },
  { id: 'cat-waterfalls', name: 'Waterfalls', slug: 'waterfalls', icon: 'droplet', orderIndex: 4 },
  { id: 'cat-offbeat', name: 'Offbeat', slug: 'offbeat', icon: 'compass', orderIndex: 5 },
  { id: 'cat-wildlife', name: 'Wildlife', slug: 'wildlife', icon: 'paw', orderIndex: 6 },
];

const TIER_POINTS: Record<number, number> = { 1: 10, 2: 30, 3: 75, 4: 150 };

const DESTINATIONS = [
  {
    id: 'dest-orchha',
    slug: 'orchha-fort-complex',
    name: 'Orchha Fort Complex',
    stateCode: 'MP',
    districtName: 'Niwari',
    tier: 2,
    difficulty: 'easy',
    minDurationMin: 120,
    recommendedDurationMin: 300,
    crowdLevel: 'moderate',
    isEcoSensitive: false,
    ratingAvg: 4.6,
    reviewCount: 218,
    checkInCount: 1042,
    categories: ['historical'],
    lat: 25.3478,
    lng: 78.6413,
    heroImageUrl: 'https://placehold.co/1200x800?text=Orchha',
  },
  {
    id: 'dest-bhojpur',
    slug: 'bhojpur-shiva-temple',
    name: 'Bhojpur Shiva Temple',
    stateCode: 'MP',
    districtName: 'Raisen',
    tier: 3,
    difficulty: 'easy',
    minDurationMin: 60,
    recommendedDurationMin: 120,
    crowdLevel: 'low',
    isEcoSensitive: false,
    ratingAvg: 4.4,
    reviewCount: 41,
    checkInCount: 96,
    categories: ['religious', 'historical'],
    lat: 23.1333,
    lng: 77.6167,
    heroImageUrl: 'https://placehold.co/1200x800?text=Bhojpur',
  },
  {
    id: 'dest-chandrehi',
    slug: 'chandrehi-stepwell',
    name: 'Chandrehi Stepwell',
    stateCode: 'MP',
    districtName: 'Sidhi',
    tier: 4,
    difficulty: 'moderate',
    minDurationMin: 45,
    recommendedDurationMin: 90,
    crowdLevel: 'low',
    isEcoSensitive: true,
    ratingAvg: null,
    reviewCount: 0,
    checkInCount: 0,
    categories: ['offbeat', 'historical'],
    lat: 24.2411,
    lng: 81.6033,
    heroImageUrl: 'https://placehold.co/1200x800?text=Chandrehi',
  },
];

const withPoints = (
  destination: (typeof DESTINATIONS)[number],
  distanceM: number | null = null,
) => ({
  ...destination,
  basePoints: TIER_POINTS[destination.tier],
  distanceM,
});

/** In-memory check-ins, so the app can watch one move pending → approved. */
const checkIns = new Map<string, Record<string, unknown>>();
const idempotency = new Map<string, string>();

const error = (
  response: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) => response.status(status).json({ statusCode: status, code, message, details });

const v1 = express.Router();

// ---------------------------------------------------------------- auth
v1.post('/auth/otp/send', (_request, response) => {
  response.json({ retryAfterSeconds: 60, expiresInSeconds: 300, devCode: '123456' });
});

v1.post('/auth/otp/verify', (request: Request, response: Response) => {
  if (request.body?.code !== '123456') {
    return error(response, 400, 'otp_invalid', 'That code is not correct.');
  }
  response.json({
    accessToken: 'mock.access.token',
    refreshToken: 'mock.refresh.token',
    expiresIn: 900,
    tokenType: 'Bearer',
    user: {
      id: 'user-aarav',
      role: 'explorer',
      username: 'aarav_rides',
      isPhoneVerified: true,
      isNew: false,
    },
  });
});

v1.post('/auth/refresh', (_request, response) => {
  response.json({
    accessToken: 'mock.access.token.2',
    refreshToken: 'mock.refresh.token.2',
    expiresIn: 900,
    tokenType: 'Bearer',
  });
});

v1.post('/auth/logout', (_request, response) => response.status(204).send());

// ----------------------------------------------------------- discovery
v1.get('/states', (_request, response) => response.json(STATES));

v1.get('/states/:code/districts', (request, response) => {
  response.json([
    { id: 'dist-niwari', name: 'Niwari', slug: 'niwari', destinationCount: 12 },
    { id: 'dist-raisen', name: 'Raisen', slug: 'raisen', destinationCount: 9 },
    { id: 'dist-sidhi', name: 'Sidhi', slug: 'sidhi', destinationCount: 4 },
  ]);
});

v1.get('/categories', (_request, response) => response.json(CATEGORIES));

v1.get('/destinations', (request, response) => {
  const limit = Number.parseInt(String(request.query.limit ?? '20'), 10);
  const hasPoint = Boolean(request.query.lat && request.query.lng);

  let data = DESTINATIONS.map((destination, index) =>
    withPoints(destination, hasPoint ? 4200 + index * 18_400 : null),
  );

  if (request.query.tier) {
    const tiers = String(request.query.tier).split(',').map(Number);
    data = data.filter((destination) => tiers.includes(destination.tier));
  }
  if (request.query.categories) {
    const slugs = String(request.query.categories).split(',');
    data = data.filter((destination) =>
      destination.categories.some((slug) => slugs.includes(slug)),
    );
  }

  response.json({
    data: data.slice(0, limit),
    // Always a last page: the mock has three destinations, not three hundred.
    meta: { nextCursor: null, limit },
  });
});

v1.get('/search', (request, response) => {
  const query = String(request.query.q ?? '').toLowerCase();
  const matches = DESTINATIONS.filter(
    (destination) =>
      destination.name.toLowerCase().includes(query) ||
      // Crude stand-in for trigram matching, enough to exercise the UI.
      destination.name.toLowerCase().slice(0, 4) === query.slice(0, 4),
  );
  response.json(matches.map((destination) => withPoints(destination)));
});

v1.get('/destinations/:slug', (request, response) => {
  const destination =
    DESTINATIONS.find((candidate) => candidate.slug === request.params.slug) ??
    DESTINATIONS.find((candidate) => candidate.id === request.params.slug);

  if (!destination) {
    return error(response, 404, 'not_found', 'No published destination matches that.');
  }

  response.json({
    ...withPoints(destination),
    aliases: ['Orcha', 'ओरछा'],
    description:
      'A riverside complex of palaces, cenotaphs and temples on the Betwa, largely ' +
      'empty outside weekends — the Chaturbhuj temple tower is the tallest in the region.',
    story:
      'Founded by the Bundela Rajputs in the sixteenth century, Orchha was abandoned ' +
      'for Tikamgarh in 1783, which is why so much of it survives unaltered.',
    location: { lat: destination.lat, lng: destination.lng },
    geofenceRadiusM: 800,
    pointsExplainer:
      destination.tier >= 3
        ? 'Lesser known. Real points for going somewhere most people skip.'
        : 'Regionally well known. Worth a visit, modestly rewarded.',
    bestSeason: ['winter', 'post_monsoon'],
    accessibilityFlags: { wheelchair: false, senior_friendly: true, child_friendly: true },
    hazards: destination.tier === 4 ? ['Unlit approach road; do not attempt after dark'] : [],
    categories: destination.categories.map((slug) => ({
      slug,
      name: CATEGORIES.find((category) => category.slug === slug)?.name ?? slug,
    })),
    thingsToDo: [
      {
        id: 'ttd-1',
        title: 'Climb to the Baradari in Jehangir Mahal for the valley view',
        description: 'Best in the hour before sunset. Steep last flight, no railing.',
        durationMin: 45,
        orderIndex: 0,
      },
      {
        id: 'ttd-2',
        title: 'Walk the Chhatris along the Betwa at first light',
        description: 'Fourteen cenotaphs, usually deserted before 8 am.',
        durationMin: 60,
        orderIndex: 1,
      },
      {
        id: 'ttd-3',
        title: 'Catch the evening aarti at Ram Raja Temple',
        description: 'The only temple in India where Rama is worshipped as a king.',
        durationMin: 40,
        orderIndex: 2,
      },
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
    itinerary: {
      id: 'itin-1',
      title: 'One day in Orchha',
      dayCount: 1,
      totalDurationMin: 300,
      stops: [
        {
          day: 1,
          orderIndex: 0,
          activity: 'Chhatris at sunrise',
          startTime: '06:30',
          durationMin: 60,
        },
        { day: 1, orderIndex: 1, activity: 'Jehangir Mahal', startTime: '08:00', durationMin: 90 },
        {
          day: 1,
          orderIndex: 2,
          activity: 'Bafla at the stalls outside Gate 2',
          startTime: '12:30',
          durationMin: 45,
        },
        {
          day: 1,
          orderIndex: 3,
          activity: 'Ram Raja evening aarti',
          startTime: '18:00',
          durationMin: 40,
        },
      ],
    },
    gallery: [
      {
        id: 'media-1',
        url: 'https://placehold.co/1200x800?text=Jehangir+Mahal',
        thumbUrl: null,
        caption: 'Jehangir Mahal',
        attribution: 'MP Tourism',
        source: 'official',
      },
      {
        id: 'media-2',
        url: 'https://placehold.co/1200x800?text=Chhatris',
        thumbUrl: null,
        caption: 'Chhatris on the Betwa',
        attribution: 'MP Tourism',
        source: 'official',
      },
    ],
  });
});

v1.get('/destinations/:id/nearby', (_request, response) => {
  // Rarity-first ordering, exactly as the real endpoint behaves.
  response.json([withPoints(DESTINATIONS[2], 18_400), withPoints(DESTINATIONS[1], 62_000)]);
});

v1.get('/destinations/:id/itinerary', (_request, response) => {
  response.json({
    id: 'itin-1',
    title: 'One day in Orchha',
    dayCount: 1,
    totalDurationMin: 300,
    stops: [],
  });
});

v1.get('/destinations/:id/photos', (_request, response) => {
  response.json([
    {
      id: 'media-1',
      url: 'https://placehold.co/1200x800?text=Gallery+1',
      thumbUrl: null,
      caption: null,
      attribution: 'MP Tourism',
      source: 'official',
      uploadedBy: null,
    },
  ]);
});

v1.get('/destinations/:id/reviews', (_request, response) => {
  response.json({
    data: [
      {
        id: 'review-1',
        rating: 5,
        body: 'Went on a Tuesday in February and had the cenotaphs entirely to myself for an hour.',
        tip: 'Go before 9 am to avoid the tour buses.',
        helpfulCount: 12,
        createdAt: new Date(Date.now() - 86_400_000 * 9).toISOString(),
        author: { username: 'sneha_p', displayName: 'Sneha', level: 3 },
        photoUrl: null,
        isVerifiedVisitor: true,
      },
    ],
    meta: { nextCursor: null, limit: 20 },
  });
});

// ------------------------------------------------------------- media
v1.post('/media/uploads', (request, response) => {
  const mediaId = randomUUID();
  response.json({
    mediaId,
    /* httpbin echoes a PUT, so the client's upload code runs for real. */
    uploadUrl: `https://httpbin.org/put?key=${mediaId}`,
    storageKey: `check_in/2026/09/${mediaId}.jpg`,
    expiresInSeconds: 900,
    maxBytes: 10_485_760,
    requiredHeaders: { 'Content-Type': request.body?.mime ?? 'image/jpeg' },
  });
});

v1.post('/media/uploads/finalise', (request, response) => {
  response.json({ mediaId: request.body?.mediaId, isUploaded: true, bytes: 2_184_112 });
});

// ---------------------------------------------------------- check-ins
v1.post('/check-ins', (request: Request, response: Response) => {
  const key = request.header('Idempotency-Key');
  if (!key) {
    return error(
      response,
      400,
      'idempotency_key_required',
      'An Idempotency-Key header is required on check-in submission.',
    );
  }

  const existingId = idempotency.get(key);
  if (existingId) {
    return response.status(202).json({ ...checkIns.get(existingId), deduplicated: true });
  }

  const destination =
    DESTINATIONS.find((candidate) => candidate.id === request.body?.destinationId) ??
    DESTINATIONS[0];

  /*
   * Coordinate 0,0 is the agreed trigger for the outside-geofence path, so the
   * app can build and test that screen without driving anywhere.
   */
  if (request.body?.lat === 0 && request.body?.lng === 0) {
    return error(
      response,
      422,
      'outside_geofence',
      `You need to be at ${destination.name} to check in. You are about 2400 m outside the area.`,
      { distanceM: 2400, toleranceM: 200 },
    );
  }

  const id = randomUUID();
  const record = {
    id,
    status: 'pending',
    destinationId: destination.id,
    destinationName: destination.name,
    estimatedPoints: TIER_POINTS[destination.tier] + (destination.checkInCount === 0 ? 100 : 0),
    pointsAwarded: 0,
    appliedMultiplier: 1,
    needsReview: false,
    rejectionReason: null,
    submittedAt: new Date().toISOString(),
    deduplicated: false,
  };

  checkIns.set(id, record);
  idempotency.set(key, id);

  /*
   * Resolves to approved after four seconds, matching the PRD's ~4 s
   * auto-verification. The pending → approved transition is the part of the app
   * most likely to be built wrong, so the mock makes it happen every time.
   */
  setTimeout(() => {
    checkIns.set(id, {
      ...record,
      status: 'approved',
      pointsAwarded: record.estimatedPoints,
    });
  }, 4000);

  response.status(202).json(record);
});

v1.get('/check-ins/:id', (request, response) => {
  const record = checkIns.get(request.params.id);
  if (!record) return error(response, 404, 'not_found', 'No such check-in.');
  response.json(record);
});

v1.get('/me/check-ins', (_request, response) => {
  response.json({
    data: [...checkIns.values()].reverse(),
    meta: { nextCursor: null, limit: 20 },
  });
});

// ------------------------------------------------------- gamification
v1.get('/me/points', (_request, response) => {
  response.json({
    totalPoints: 1420,
    level: 2,
    levelName: 'Wanderer',
    nextLevelAt: 1500,
    nextLevelName: 'Pathfinder',
    pointsToNextLevel: 80,
    dailyCap: 600,
  });
});

v1.get('/me/points/ledger', (_request, response) => {
  response.json({
    data: [
      {
        id: 'led-1',
        delta: 150,
        reasonCode: 'check_in',
        refType: 'check_in',
        balanceAfter: 1420,
        createdAt: new Date().toISOString(),
        note: 'Verified check-in at Chandrehi Stepwell',
      },
      {
        id: 'led-2',
        delta: 100,
        reasonCode: 'pioneer_bonus',
        refType: 'check_in',
        balanceAfter: 1270,
        createdAt: new Date().toISOString(),
        note: 'First verified check-in at Chandrehi Stepwell',
      },
    ],
    meta: { nextCursor: null, limit: 20 },
  });
});

v1.get('/me/badges', (_request, response) => {
  response.json([
    {
      code: 'pioneer',
      name: 'Pioneer',
      description: 'First verified check-in at a destination',
      icon: 'flag',
      tier: 'gold',
      earnedAt: new Date().toISOString(),
      isEarned: true,
    },
    {
      code: 'off_the_map',
      name: 'Off the Map',
      description: '20 Tier-4 check-ins',
      icon: 'compass',
      tier: 'gold',
      earnedAt: null,
      isEarned: false,
    },
    {
      code: 'mp_explorer',
      name: 'Madhya Pradesh Explorer',
      description: '10 destinations in MP',
      icon: 'map',
      tier: 'silver',
      earnedAt: null,
      isEarned: false,
    },
  ]);
});

v1.get('/leaderboards', (request, response) => {
  const entries = [
    {
      rank: 1,
      userId: 'u1',
      username: 'trailhead_raj',
      displayName: 'Raj',
      avatarUrl: null,
      level: 4,
      points: 4820,
      isMe: false,
    },
    {
      rank: 2,
      userId: 'u2',
      username: 'meera_walks',
      displayName: 'Meera',
      avatarUrl: null,
      level: 4,
      points: 4410,
      isMe: false,
    },
    {
      rank: 3,
      userId: 'user-aarav',
      username: 'aarav_rides',
      displayName: 'Aarav',
      avatarUrl: null,
      level: 2,
      points: 1420,
      isMe: true,
    },
  ];
  response.json({
    scope: request.query.scope ?? 'national',
    scopeId: request.query.scopeId ?? null,
    period: request.query.period ?? 'month',
    periodKey: '2026-09',
    entries,
    me: entries[2],
    totalRanked: 1284,
    source: 'live',
  });
});

v1.get('/challenges', (_request, response) => {
  response.json([
    {
      id: 'ch-bundelkhand',
      slug: 'bundelkhand-fort-trail',
      title: 'Bundelkhand Fort Trail',
      description: 'Visit 5 of 7 Bundelkhand forts before 31 December.',
      scope: 'state',
      type: 'circuit',
      multiplier: '2.00',
      startsAt: new Date(Date.now() - 86_400_000 * 20).toISOString(),
      endsAt: new Date(Date.now() + 86_400_000 * 60).toISOString(),
      rewardPoints: 800,
      status: 'active',
    },
    {
      id: 'ch-offbeat',
      slug: 'three-off-the-map',
      title: 'Three Off the Map',
      description: 'Three Tier-4 destinations this month.',
      scope: 'national',
      type: 'discovery',
      multiplier: '1.50',
      startsAt: new Date(Date.now() - 86_400_000 * 5).toISOString(),
      endsAt: new Date(Date.now() + 86_400_000 * 25).toISOString(),
      rewardPoints: 300,
      status: 'active',
    },
  ]);
});

v1.get('/challenges/:id/progress', (request, response) => {
  response.json({
    challengeId: request.params.id,
    title: 'Bundelkhand Fort Trail',
    required: 5,
    completed: 3,
    visitedDestinationIds: ['dest-orchha', 'dest-bhojpur', 'dest-chandrehi'],
    completedAt: null,
    pointsAwarded: 0,
    endsAt: new Date(Date.now() + 86_400_000 * 60).toISOString(),
    multiplier: 2,
  });
});

// --------------------------------------------------------------- me
v1.get('/me/profile', (_request, response) => {
  response.json({
    userId: 'user-aarav',
    username: 'aarav_rides',
    displayName: 'Aarav',
    bio: 'Weekend rider. Forts and stepwells.',
    avatarUrl: null,
    homeStateId: 'st-mp',
    level: 2,
    levelName: 'Wanderer',
    totalPoints: 1420,
    trustScore: 58,
    isPhoneVerified: true,
    hideFromLeaderboards: false,
    stats: {
      approvedCheckIns: 11,
      pendingCheckIns: 1,
      destinationsVisited: 9,
      statesVisited: 1,
      offbeatShare: 0.64,
      reviewsWritten: 3,
    },
    stateProgress: [
      {
        stateCode: 'MP',
        stateName: 'Madhya Pradesh',
        destinationsVisited: 9,
        destinationsPublished: 150,
        completion: 0.06,
      },
    ],
  });
});

v1.patch('/me/profile', (request, response) =>
  response.json({ ...request.body, userId: 'user-aarav' }),
);

v1.get('/me/saved', (_request, response) => {
  response.json([
    {
      id: 'dest-chandrehi',
      slug: 'chandrehi-stepwell',
      name: 'Chandrehi Stepwell',
      tier: 4,
      stateCode: 'MP',
      note: null,
      addedAt: new Date().toISOString(),
      heroImageUrl: null,
    },
  ]);
});

v1.post('/me/saved', (request, response) =>
  response.json({ destinationId: request.body?.destinationId, saved: true }),
);

v1.delete('/me/saved/:destinationId', (_request, response) => response.status(204).send());

v1.get('/users/:username', (request, response) => {
  response.json({
    username: request.params.username,
    displayName: 'Aarav',
    bio: 'Weekend rider. Forts and stepwells.',
    avatarUrl: null,
    level: 2,
    levelName: 'Wanderer',
    totalPoints: 1420,
    memberSince: new Date(Date.now() - 86_400_000 * 120).toISOString(),
    stats: {
      approvedCheckIns: 11,
      destinationsVisited: 9,
      statesVisited: 1,
      offbeatShare: 0.64,
      reviewsWritten: 3,
      pendingCheckIns: 0,
    },
    stateProgress: [
      {
        stateCode: 'MP',
        stateName: 'Madhya Pradesh',
        destinationsVisited: 9,
        destinationsPublished: 150,
        completion: 0.06,
      },
    ],
    badges: [
      { code: 'pioneer', name: 'Pioneer', icon: 'flag', earned_at: new Date().toISOString() },
    ],
    isRestricted: false,
  });
});

// -------------------------------------------------------- user content
v1.post('/reviews', (request, response) => {
  response.status(201).json({
    id: randomUUID(),
    destinationId: request.body?.destinationId,
    rating: request.body?.rating,
    body: request.body?.body ?? null,
    tip: request.body?.tip ?? null,
    status: 'published',
    pointsAwarded: request.body?.mediaId && (request.body?.body?.length ?? 0) >= 100 ? 15 : 0,
    createdAt: new Date().toISOString(),
    photoUrl: null,
  });
});

v1.post('/reports', (_request, response) =>
  response.status(201).json({ id: randomUUID(), status: 'open' }),
);

// ------------------------------------------------------------- admin
v1.get('/admin/moderation/queue', (_request, response) => {
  response.json([
    {
      checkInId: randomUUID(),
      submittedAt: new Date(Date.now() - 3_600_000 * 5).toISOString(),
      ageHours: 5.0,
      isAuditSample: false,
      verificationScore: 65,
      user: {
        id: 'u9',
        username: 'new_explorer',
        trustScore: 40,
        level: 1,
        approvedCheckIns: 0,
        rejectedCheckIns: 0,
      },
      destination: {
        id: 'dest-chandrehi',
        name: 'Chandrehi Stepwell',
        slug: 'chandrehi-stepwell',
        tier: 4,
        lat: 24.2411,
        lng: 81.6033,
      },
      submission: {
        photoUrl: 'https://placehold.co/900x1200?text=Submission',
        lat: 24.2415,
        lng: 81.6029,
        accuracyM: 18.4,
        capturedAt: new Date(Date.now() - 3_600_000 * 5).toISOString(),
      },
      referencePhotoUrls: ['https://placehold.co/900x1200?text=Reference+1'],
      signals: {
        geo_pass: true,
        geo_distance_m: '0.00',
        time_pass: true,
        capture_lag_seconds: 41,
        mock_location: false,
        phash_distance: 14,
        velocity_kmh: '62.40',
        trust_score_at_submit: 40,
        raw: { reasons: ['near_duplicate_photo'], score: 65 },
      },
    },
  ]);
});

v1.get('/admin/moderation/queue/stats', (_request, response) =>
  response.json({ pending: 1, oldestWaitingHours: 5.0, auditSamples: 0, slaHours: 12 }),
);

v1.post('/admin/moderation/:checkInId/decide', (request, response) =>
  response.json({
    checkInId: request.params.checkInId,
    decision: request.body?.approve ? 'approved' : 'rejected',
    pointsAwarded: request.body?.approve ? 150 : 0,
  }),
);

v1.get('/admin/destinations', (_request, response) => {
  response.json({
    data: DESTINATIONS.map((destination) => ({
      id: destination.id,
      name: destination.name,
      slug: destination.slug,
      status: destination.tier === 4 ? 'draft' : 'published',
      tier: destination.tier,
      checkInCount: destination.checkInCount,
      publishedAt: destination.tier === 4 ? null : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stateCode: destination.stateCode,
      districtName: destination.districtName,
    })),
    total: DESTINATIONS.length,
    limit: 50,
    offset: 0,
  });
});

v1.post('/admin/destinations', (request, response) =>
  response.status(201).json({ id: randomUUID(), ...request.body, status: 'draft' }),
);

v1.post('/admin/destinations/:id/publish', (request, response) => {
  /* The publish gate is a real screen in the CMS, so the mock can fail it. */
  if (request.query.simulate === 'incomplete') {
    return error(
      response,
      422,
      'publish_requirements_unmet',
      'This destination is not ready to publish. Missing: heroMediaId, info.timings.',
      { missing: ['heroMediaId', 'info.timings'] },
    );
  }
  response.json({
    id: request.params.id,
    status: 'published',
    publishedAt: new Date().toISOString(),
  });
});

v1.get('/admin/analytics/redistribution', (_request, response) => {
  response.json({
    window: { from: '2026-06-01T00:00:00Z', to: '2026-09-01T00:00:00Z' },
    totalCheckIns: 4820,
    byTier: { 1: 610, 2: 1240, 3: 1890, 4: 1080 },
    tier34CheckIns: 2970,
    tier34Share: 0.616,
    destinationsWithCheckIns: 118,
    footfallGini: 0.412,
  });
});

v1.get('/admin/analytics/footfall', (_request, response) => {
  const days = 14;
  response.json(
    Array.from({ length: days }, (_value, index) => {
      const checkIns = 40 + Math.round(Math.sin(index / 2) * 18) + index;
      const tier34 = Math.round(checkIns * (0.5 + index * 0.01));
      return {
        bucket: new Date(Date.now() - 86_400_000 * (days - index)).toISOString(),
        checkIns,
        uniqueUsers: Math.round(checkIns * 0.7),
        tier34CheckIns: tier34,
        tier34Share: Number((tier34 / checkIns).toFixed(3)),
      };
    }),
  );
});

// ---------------------------------------------------------------- ops
v1.get('/health', (_request, response) => response.json({ status: 'ok', uptimeSeconds: 1 }));

app.use('/v1', v1);

app.use((request: Request, response: Response) => {
  error(
    response,
    404,
    'not_found',
    `The mock server has no handler for ${request.method} ${request.path}. ` +
      'Add one in src/openapi/mock-server.ts and tell the team.',
  );
});

const port = Number.parseInt(process.env.MOCK_PORT ?? '4010', 10);
app.listen(port, () => {
  console.log(`Mock API on http://localhost:${port}/v1`);
  console.log('  OTP code:            123456');
  console.log('  Outside geofence:    POST /v1/check-ins with lat=0, lng=0');
  console.log('  Pending → approved:  4 s after a successful POST /v1/check-ins');
  console.log('  Publish gate 422:    POST /v1/admin/destinations/:id/publish?simulate=incomplete');
});
