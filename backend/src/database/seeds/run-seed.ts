import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { randomBytes, scryptSync } from 'node:crypto';
import dataSource from '../data-source';
import {
  Badge,
  Category,
  Challenge,
  Destination,
  DestinationInfo,
  District,
  SavedList,
  State,
  ThingToDo,
  User,
  UserProfile,
} from 'src/entities';
import {
  ChallengeScope,
  ChallengeStatus,
  ChallengeType,
  DestinationStatus,
} from 'src/common/constants/enums';
import { UserRole } from 'src/common/constants/roles.enum';
import { CATEGORY_SEED, MP_DISTRICTS, STATE_SEED } from './data/states';
import { BADGE_SEED } from './data/badges';
import { DESTINATION_SEED } from './data/destinations';

/**
 * Idempotent seed. Safe to run against a database that already has data — every
 * insert is keyed on a natural unique column and skips what exists. That matters
 * because this runs on every staging deploy, not just on a fresh database.
 *
 *   npm run seed
 */

/** Matches PasswordService's format, without importing the Nest DI container. */
function hashPassword(password: string): string {
  const params = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 32, params);
  return `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

async function seedStatesAndDistricts(ds: DataSource): Promise<Map<string, string>> {
  const states = ds.getRepository(State);
  const districts = ds.getRepository(District);

  for (const state of STATE_SEED) {
    await states
      .createQueryBuilder()
      .insert()
      .values({
        name: state.name,
        code: state.code,
        type: state.type,
        isLive: state.isLive ?? false,
      })
      .orIgnore()
      .execute();
  }

  const mp = await states.findOneOrFail({ where: { code: 'MP' } });
  for (const name of MP_DISTRICTS) {
    await districts
      .createQueryBuilder()
      .insert()
      .values({
        stateId: mp.id,
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
      })
      .orIgnore()
      .execute();
  }

  const rows = await districts.find({ where: { stateId: mp.id } });
  console.log(`  states: ${STATE_SEED.length}, MP districts: ${rows.length}`);
  return new Map(rows.map((row) => [row.name, row.id]));
}

async function seedCategories(ds: DataSource): Promise<void> {
  const categories = ds.getRepository(Category);
  for (const [index, category] of CATEGORY_SEED.entries()) {
    await categories
      .createQueryBuilder()
      .insert()
      .values({ ...category, orderIndex: index })
      .orIgnore()
      .execute();
  }
  console.log(`  categories: ${CATEGORY_SEED.length}`);
}

async function seedBadges(ds: DataSource): Promise<void> {
  const badges = ds.getRepository(Badge);
  for (const badge of BADGE_SEED) {
    await badges.createQueryBuilder().insert().values(badge).orIgnore().execute();
  }
  console.log(`  badges: ${BADGE_SEED.length}`);
}

/**
 * Creates the accounts each of us needs to work. Passwords come from the
 * environment in staging; the defaults here are only ever reachable on a
 * developer's own machine and the script refuses to use them anywhere else.
 */
async function seedAdminUsers(ds: DataSource): Promise<void> {
  const isLocal = (process.env.NODE_ENV ?? 'development') === 'development';
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password && !isLocal) {
    console.warn('  admin users: skipped (set SEED_ADMIN_PASSWORD outside development)');
    return;
  }

  const mp = await ds.getRepository(State).findOneOrFail({ where: { code: 'MP' } });
  const accounts = [
    {
      email: 'super@yatrago.test',
      username: 'super_admin',
      role: UserRole.SUPER_ADMIN,
      stateId: null,
    },
    {
      email: 'state.mp@yatrago.test',
      username: 'mp_admin',
      role: UserRole.STATE_ADMIN,
      stateId: mp.id,
    },
    {
      email: 'moderator@yatrago.test',
      username: 'moderator_one',
      role: UserRole.MODERATOR,
      stateId: null,
    },
  ];

  for (const account of accounts) {
    const existing = await ds.getRepository(User).findOne({ where: { email: account.email } });
    if (existing) continue;

    await ds.transaction(async (manager) => {
      const user = await manager.getRepository(User).save(
        manager.getRepository(User).create({
          email: account.email,
          passwordHash: hashPassword(password ?? 'local-dev-password-1'),
          role: account.role,
          managedStateId: account.stateId,
        }),
      );
      await manager
        .getRepository(UserProfile)
        .insert({ userId: user.id, username: account.username, displayName: account.username });
      await manager
        .getRepository(SavedList)
        .insert({ userId: user.id, name: 'Want to visit', isDefault: true });
    });
  }

  console.log(
    `  admin users: ${accounts.length} (password ${password ? 'from SEED_ADMIN_PASSWORD' : 'local-dev-password-1'})`,
  );
}

async function seedDestinations(ds: DataSource, districtIds: Map<string, string>): Promise<void> {
  const mp = await ds.getRepository(State).findOneOrFail({ where: { code: 'MP' } });
  const creator = await ds.getRepository(User).findOne({
    where: { email: 'super@yatrago.test' },
  });

  let created = 0;
  for (const seed of DESTINATION_SEED) {
    const slug = seed.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const existing = await ds.getRepository(Destination).findOne({ where: { slug } });
    if (existing) continue;

    await ds.transaction(async (manager) => {
      const destination = await manager.getRepository(Destination).save(
        manager.getRepository(Destination).create({
          stateId: mp.id,
          districtId: districtIds.get(seed.district) ?? null,
          name: seed.name,
          slug,
          aliases: seed.aliases ?? [],
          description: seed.description,
          story: seed.story ?? null,
          location: { type: 'Point', coordinates: [seed.lng, seed.lat] },
          geofenceRadiusM: seed.geofenceRadiusM,
          tier: seed.tier,
          status: DestinationStatus.PUBLISHED,
          publishedAt: new Date(),
          bestSeason: seed.bestSeason as never,
          isMonsoonOnly: seed.isMonsoonOnly ?? false,
          minDurationMin: seed.minDurationMin,
          recommendedDurationMin: seed.recommendedDurationMin,
          difficulty: seed.difficulty as never,
          avgBudget: seed.avgBudget as never,
          crowdLevel: seed.crowdLevel as never,
          isEcoSensitive: seed.isEcoSensitive ?? false,
          accessibilityFlags: seed.accessibilityFlags ?? {},
          hazards: seed.hazards ?? [],
          annualVisitors: seed.annualVisitors ?? null,
          createdBy: creator?.id ?? null,
        }),
      );

      await manager.query(
        `INSERT INTO destination_categories (destination_id, category_id)
         SELECT $1, id FROM categories WHERE slug = ANY($2)
         ON CONFLICT DO NOTHING`,
        [destination.id, seed.categories],
      );

      for (const [index, thing] of seed.thingsToDo.entries()) {
        await manager.getRepository(ThingToDo).insert({
          destinationId: destination.id,
          title: thing.title,
          description: thing.description ?? null,
          durationMin: thing.durationMin ?? null,
          orderIndex: index,
        });
      }

      const info = seed.info;
      await manager.getRepository(DestinationInfo).insert({
        destinationId: destination.id,
        // Cast through `never`: TypeORM's partial-entity type cannot express jsonb.
        timings: (info.timings ?? {}) as never,
        entryFees: (info.entryFees ?? {}) as never,
        rules: (info.rules as string[]) ?? [],
        facilities: (info.facilities ?? {}) as never,
        howToReach: (info.howToReach as string) ?? null,
        lastMileNotes: (info.lastMileNotes as string) ?? null,
        parking: (info.parking as string) ?? null,
        bestTimeOfDay: (info.bestTimeOfDay as string) ?? null,
        officialUrl: (info.officialUrl as string) ?? null,
        emergencyContacts: (info.emergencyContacts ?? {}) as never,
        leaveNoTraceTips: (info.leaveNoTraceTips as string[]) ?? [],
      });

      created += 1;
    });
  }

  console.log(`  destinations: ${created} created, ${DESTINATION_SEED.length - created} existing`);
}

/** The three seeded challenges the MVP launches with (PRD §12.1). */
async function seedChallenges(ds: DataSource): Promise<void> {
  const mp = await ds.getRepository(State).findOneOrFail({ where: { code: 'MP' } });
  const tier4 = await ds.getRepository(Destination).find({ where: { tier: 4 } });
  const tier3 = await ds.getRepository(Destination).find({ where: { tier: 3 } });

  const now = new Date();
  const in60Days = new Date(now.getTime() + 60 * 86_400_000);

  const challenges = [
    {
      title: 'Three Off the Map',
      slug: 'three-off-the-map',
      description:
        'Check in at three Tier-4 destinations — the rarest places on the platform — ' +
        'before the window closes.',
      scope: ChallengeScope.NATIONAL,
      stateId: null,
      type: ChallengeType.DISCOVERY,
      criteria: { kind: 'tier_count' as const, min_tier: 4, required: 3 },
      multiplier: '1.50',
      rewardPoints: 300,
    },
    {
      title: 'Bundelkhand Beyond Khajuraho',
      slug: 'bundelkhand-beyond-khajuraho',
      description:
        'Visit two of the lesser-known sites in the Bundelkhand districts. The famous ' +
        'one does not count — that is the point.',
      scope: ChallengeScope.STATE,
      stateId: mp.id,
      type: ChallengeType.CIRCUIT,
      criteria: {
        kind: 'visit_set' as const,
        destination_ids: [...tier3, ...tier4].map((destination) => destination.id).slice(0, 4),
        required: 2,
      },
      multiplier: '2.00',
      rewardPoints: 500,
    },
    {
      title: 'Monsoon Madhya Pradesh',
      slug: 'monsoon-madhya-pradesh',
      description: 'Three waterfalls or monsoon-season sites while the rains last.',
      scope: ChallengeScope.STATE,
      stateId: mp.id,
      type: ChallengeType.SEASONAL,
      criteria: { kind: 'category_count' as const, category_slug: 'waterfalls', required: 3 },
      multiplier: '1.50',
      rewardPoints: 400,
    },
  ];

  let created = 0;
  for (const challenge of challenges) {
    const existing = await ds.getRepository(Challenge).findOne({ where: { slug: challenge.slug } });
    if (existing) continue;

    await ds.getRepository(Challenge).save(
      ds.getRepository(Challenge).create({
        ...challenge,
        startsAt: now,
        endsAt: in60Days,
        status: ChallengeStatus.ACTIVE,
      }),
    );
    created += 1;
  }

  console.log(`  challenges: ${created} created, ${challenges.length - created} existing`);
}

async function run(): Promise<void> {
  console.log('Seeding YatraGo…');
  const ds = await dataSource.initialize();

  try {
    const applied = await ds.query<{ name: string }[]>(
      `SELECT name FROM typeorm_migrations ORDER BY timestamp DESC LIMIT 1`,
    );
    if (!applied.length) {
      throw new Error('No migrations have been applied. Run `npm run migration:run` first.');
    }

    const districtIds = await seedStatesAndDistricts(ds);
    await seedCategories(ds);
    await seedBadges(ds);
    await seedAdminUsers(ds);
    await seedDestinations(ds, districtIds);
    await seedChallenges(ds);

    console.log('Done.');
  } finally {
    await ds.destroy();
  }
}

run().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
