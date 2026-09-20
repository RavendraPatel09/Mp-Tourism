import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Destination, DestinationInfo, Itinerary, Media, ThingToDo } from 'src/entities';
import { DestinationStatus, MediaOwnerType, MediaStatus } from 'src/common/constants/enums';
import { TIER_BASE_POINTS, DestinationTier } from 'src/common/constants/points';
import { NotFoundException, UnprocessableException } from 'src/common/exceptions/app-exceptions';
import { Paginated, decodeCursor, encodeCursor, paginate } from 'src/common/dto/pagination.dto';
import { MediaService } from '../media/media.service';
import {
  DURATION_BUCKET_MAX_MIN,
  DestinationSort,
  ListDestinationsDto,
  NearbyDestinationsDto,
  SearchDto,
} from './dto/list-destinations.dto';

export interface DestinationListItem {
  id: string;
  slug: string;
  name: string;
  stateCode: string;
  districtName: string | null;
  tier: number;
  basePoints: number;
  difficulty: string;
  minDurationMin: number;
  recommendedDurationMin: number;
  crowdLevel: string;
  isEcoSensitive: boolean;
  ratingAvg: number | null;
  reviewCount: number;
  checkInCount: number;
  heroImageUrl: string | null;
  categories: string[];
  /** Metres from the supplied point. Null unless lat/lng was passed. */
  distanceM: number | null;
  lat: number;
  lng: number;
}

/**
 * Keyset pagination needs every sort key to point the same way, or a row-value
 * comparison silently returns the wrong page. Descending intents are therefore
 * expressed as ascending arithmetic (`4 - tier`), which keeps one comparison
 * operator for every sort instead of a hand-written WHERE per ordering.
 */
interface SortPlan {
  columns: { sql: string; alias: string }[];
  direction: 'ASC' | 'DESC';
  requiresPoint?: boolean;
}

/**
 * Written out in full wherever it is used, rather than referenced by its select
 * alias: Postgres allows an output alias in ORDER BY but not in WHERE or in
 * another select expression, and keyset pagination needs it in all three.
 */
const DISTANCE_EXPR = `ST_Distance(d.location::geography, ST_SetSRID(ST_MakePoint(:ptLng, :ptLat), 4326)::geography)`;

const SORT_PLANS: Record<DestinationSort, SortPlan> = {
  [DestinationSort.RECOMMENDED]: {
    // Rarest first, then least-visited, so the long tail leads the list.
    columns: [
      { sql: '(4 - d.tier)', alias: 'k_rarity' },
      { sql: 'd.check_in_count', alias: 'k_visits' },
      { sql: 'd.id', alias: 'k_id' },
    ],
    direction: 'ASC',
  },
  [DestinationSort.DISTANCE]: {
    columns: [
      { sql: DISTANCE_EXPR, alias: 'k_distance' },
      { sql: 'd.id', alias: 'k_id' },
    ],
    direction: 'ASC',
    requiresPoint: true,
  },
  [DestinationSort.POINTS]: {
    columns: [
      { sql: '(4 - d.tier)', alias: 'k_rarity' },
      { sql: 'd.id', alias: 'k_id' },
    ],
    direction: 'ASC',
  },
  [DestinationSort.RATING]: {
    columns: [
      { sql: '(5 - COALESCE(d.rating_avg, 0))', alias: 'k_rating' },
      { sql: 'd.id', alias: 'k_id' },
    ],
    direction: 'ASC',
  },
  [DestinationSort.NEWEST]: {
    columns: [
      { sql: 'd.published_at', alias: 'k_published' },
      { sql: 'd.id', alias: 'k_id' },
    ],
    direction: 'DESC',
  },
  [DestinationSort.NAME]: {
    columns: [
      { sql: 'd.name', alias: 'k_name' },
      { sql: 'd.id', alias: 'k_id' },
    ],
    direction: 'ASC',
  },
};

@Injectable()
export class DestinationsService {
  constructor(
    @InjectRepository(Destination) private readonly destinations: Repository<Destination>,
    @InjectRepository(DestinationInfo) private readonly info: Repository<DestinationInfo>,
    @InjectRepository(ThingToDo) private readonly thingsToDo: Repository<ThingToDo>,
    @InjectRepository(Itinerary) private readonly itineraries: Repository<Itinerary>,
    @InjectRepository(Media) private readonly media: Repository<Media>,
    private readonly mediaService: MediaService,
  ) {}

  async list(query: ListDestinationsDto): Promise<Paginated<DestinationListItem>> {
    const hasPoint = query.lat !== undefined && query.lng !== undefined;
    const plan = SORT_PLANS[query.sort];

    if (plan.requiresPoint && !hasPoint) {
      throw new UnprocessableException(
        'sort=distance requires lat and lng.',
        'missing_coordinates',
      );
    }
    if ((query.lat === undefined) !== (query.lng === undefined)) {
      throw new UnprocessableException(
        'lat and lng must be supplied together.',
        'missing_coordinates',
      );
    }

    const qb = this.baseListQuery(hasPoint ? { lat: query.lat!, lng: query.lng! } : undefined);

    if (query.state) {
      qb.andWhere('s.code = :stateCode', { stateCode: query.state });
    }
    if (query.district) {
      qb.andWhere('d.district_id = :districtId', { districtId: query.district });
    }
    if (query.categories?.length) {
      qb.andWhere(
        `EXISTS (
           SELECT 1 FROM destination_categories dc
           JOIN categories c ON c.id = dc.category_id
           WHERE dc.destination_id = d.id AND c.slug = ANY(:categorySlugs)
         )`,
        { categorySlugs: query.categories },
      );
    }
    if (query.duration) {
      qb.andWhere('d.min_duration_min <= :maxDuration', {
        maxDuration: DURATION_BUCKET_MAX_MIN[query.duration],
      });
    }
    if (query.difficulty?.length) {
      qb.andWhere('d.difficulty = ANY(:difficulty)', { difficulty: query.difficulty });
    }
    if (query.budget?.length) {
      qb.andWhere('d.avg_budget = ANY(:budget)', { budget: query.budget });
    }
    if (query.tier?.length) {
      qb.andWhere('d.tier = ANY(:tier)', { tier: query.tier });
    }
    if (query.season) {
      // `all_year` sites always match a season filter.
      qb.andWhere(`(:season = ANY(d.best_season) OR 'all_year' = ANY(d.best_season))`, {
        season: query.season,
      });
    }
    if (query.accessibleOnly) {
      qb.andWhere(`d.accessibility_flags ->> 'wheelchair' = 'true'`);
    }
    if (hasPoint) {
      /*
       * ST_DWithin on geography, not a bounding box: it uses the GiST index and
       * measures in metres on the spheroid, which matters at India's latitudes
       * where a degree of longitude is ~102 km, not 111.
       */
      qb.andWhere(
        `ST_DWithin(d.location::geography, ST_SetSRID(ST_MakePoint(:ptLng, :ptLat), 4326)::geography, :radiusM)`,
        { radiusM: query.radiusKm * 1000 },
      );
    }

    this.applyKeyset(qb, plan, query.cursor);

    const rows = await qb.limit(query.limit + 1).getRawMany<RawDestinationRow>();
    const items = rows.map((row) => this.toListItem(row));

    return paginate(items, query.limit, (item) => {
      const row = rows.find((candidate) => candidate.id === item.id)!;
      return encodeCursor(
        Object.fromEntries(plan.columns.map((column) => [column.alias, row[column.alias]])),
      );
    });
  }

  /**
   * "Nearby" is the redistribution engine (PRD F3), so it does not sort purely
   * by distance: lesser-known sites inside the radius come first. A Tier-4
   * stepwell 18 km away is the whole point; the famous fort 4 km away is
   * already on the user's list.
   */
  async nearby(idOrSlug: string, query: NearbyDestinationsDto): Promise<DestinationListItem[]> {
    const origin = await this.findPublished(idOrSlug);
    const [lng, lat] = origin.location.coordinates;

    const rows = await this.baseListQuery({ lat, lng })
      .andWhere('d.id <> :originId', { originId: origin.id })
      .andWhere(
        `ST_DWithin(d.location::geography, ST_SetSRID(ST_MakePoint(:ptLng, :ptLat), 4326)::geography, :radiusM)`,
        { radiusM: query.radiusKm * 1000 },
      )
      .orderBy('(4 - d.tier)', 'ASC')
      .addOrderBy(DISTANCE_EXPR, 'ASC')
      .limit(query.limit)
      .getRawMany<RawDestinationRow>();

    return rows.map((row) => this.toListItem(row));
  }

  /**
   * Typo-tolerant search (PRD F5). Two mechanisms, deliberately:
   *  - the weighted tsvector handles multi-word and stemmed matches
   *  - trigram similarity handles misspellings ("khajurao" → Khajuraho), which
   *    full-text search alone cannot, since a typo is simply a different lexeme
   */
  async search(query: SearchDto): Promise<DestinationListItem[]> {
    const term = query.q.trim();
    if (term.length < 2) return [];

    const qb = this.baseListQuery()
      .andWhere(
        `(
           d.search_vector @@ websearch_to_tsquery('simple', :term)
           OR d.name %> :term
           OR EXISTS (SELECT 1 FROM unnest(d.aliases) alias WHERE alias %> :term)
         )`,
        { term },
      )
      .addSelect(
        `GREATEST(
           ts_rank(d.search_vector, websearch_to_tsquery('simple', :term)) * 4,
           word_similarity(:term, d.name),
           COALESCE((SELECT MAX(word_similarity(:term, alias)) FROM unnest(d.aliases) alias), 0)
         )`,
        'relevance',
      )
      .orderBy('relevance', 'DESC')
      .addOrderBy('(4 - d.tier)', 'ASC')
      .limit(query.limit);

    if (query.state) {
      qb.andWhere('s.code = :stateCode', { stateCode: query.state });
    }

    const rows = await qb.getRawMany<RawDestinationRow>();
    return rows.map((row) => this.toListItem(row));
  }

  /** The detail page. One round trip per related collection, no N+1. */
  async detail(slug: string) {
    const destination = await this.findPublished(slug);

    const [info, thingsToDo, itinerary, gallery] = await Promise.all([
      this.info.findOne({ where: { destinationId: destination.id } }),
      this.thingsToDo.find({
        where: { destinationId: destination.id },
        order: { orderIndex: 'ASC' },
      }),
      this.itineraries.findOne({
        where: { destinationId: destination.id },
        relations: { stops: true },
        order: { createdAt: 'ASC' },
      }),
      this.media.find({
        where: {
          ownerType: MediaOwnerType.DESTINATION,
          ownerId: destination.id,
          status: MediaStatus.APPROVED,
        },
        order: { createdAt: 'DESC' },
        take: 20,
      }),
    ]);

    const categories = await this.destinations
      .createQueryBuilder('d')
      .select('c.slug', 'slug')
      .addSelect('c.name', 'name')
      .innerJoin('destination_categories', 'dc', 'dc.destination_id = d.id')
      .innerJoin('categories', 'c', 'c.id = dc.category_id')
      .where('d.id = :id', { id: destination.id })
      .orderBy('c.order_index', 'ASC')
      .getRawMany<{ slug: string; name: string }>();

    return {
      id: destination.id,
      slug: destination.slug,
      name: destination.name,
      aliases: destination.aliases,
      description: destination.description,
      story: destination.story,
      stateId: destination.stateId,
      districtId: destination.districtId,
      location: {
        lat: destination.location.coordinates[1],
        lng: destination.location.coordinates[0],
      },
      /** The radius the app should use for the check-in prompt. */
      geofenceRadiusM: destination.geofenceRadiusM,
      tier: destination.tier,
      basePoints: TIER_BASE_POINTS[destination.tier as DestinationTier],
      pointsExplainer: this.pointsExplainer(destination.tier as DestinationTier),
      bestSeason: destination.bestSeason,
      minDurationMin: destination.minDurationMin,
      recommendedDurationMin: destination.recommendedDurationMin,
      difficulty: destination.difficulty,
      avgBudget: destination.avgBudget,
      accessibilityFlags: destination.accessibilityFlags,
      crowdLevel: destination.crowdLevel,
      isEcoSensitive: destination.isEcoSensitive,
      hazards: destination.hazards,
      ratingAvg: destination.ratingAvg ? Number.parseFloat(destination.ratingAvg) : null,
      reviewCount: destination.reviewCount,
      checkInCount: destination.checkInCount,
      categories,
      thingsToDo,
      info,
      itinerary,
      heroImageUrl: destination.heroMediaId
        ? await this.mediaService.publicUrlForId(destination.heroMediaId)
        : null,
      gallery: gallery.map((item) => ({
        id: item.id,
        url: this.mediaService.publicUrl(item.storageKey),
        thumbUrl: item.thumbKey ? this.mediaService.publicUrl(item.thumbKey) : null,
        caption: item.caption,
        attribution: item.attribution,
        source: item.source,
      })),
    };
  }

  async itinerary(idOrSlug: string) {
    const destination = await this.findPublished(idOrSlug);
    const itinerary = await this.itineraries.findOne({
      where: { destinationId: destination.id },
      relations: { stops: true },
    });
    if (!itinerary) {
      throw new NotFoundException('No itinerary has been published for this destination yet.');
    }
    itinerary.stops?.sort((a, b) => a.day - b.day || a.orderIndex - b.orderIndex);
    return itinerary;
  }

  async photos(idOrSlug: string) {
    const destination = await this.findPublished(idOrSlug);
    const rows = await this.media.find({
      where: {
        ownerType: MediaOwnerType.DESTINATION,
        ownerId: destination.id,
        status: MediaStatus.APPROVED,
      },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return rows.map((item) => ({
      id: item.id,
      url: this.mediaService.publicUrl(item.storageKey),
      thumbUrl: item.thumbKey ? this.mediaService.publicUrl(item.thumbKey) : null,
      caption: item.caption,
      attribution: item.attribution,
      source: item.source,
      uploadedBy: item.source === 'official' ? null : item.uploadedBy,
    }));
  }

  /** Shared by the check-in service, which needs the row whatever its status. */
  async findPublished(idOrSlug: string): Promise<Destination> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const destination = await this.destinations.findOne({
      where: isUuid
        ? { id: idOrSlug, status: DestinationStatus.PUBLISHED }
        : { slug: idOrSlug, status: DestinationStatus.PUBLISHED },
    });
    if (!destination) throw new NotFoundException('No published destination matches that.');
    return destination;
  }

  private baseListQuery(point?: { lat: number; lng: number }): SelectQueryBuilder<Destination> {
    const qb = this.destinations
      .createQueryBuilder('d')
      .innerJoin('states', 's', 's.id = d.state_id')
      .leftJoin('districts', 'dist', 'dist.id = d.district_id')
      .select([
        'd.id AS id',
        'd.slug AS slug',
        'd.name AS name',
        'd.tier AS tier',
        'd.difficulty AS difficulty',
        'd.min_duration_min AS "minDurationMin"',
        'd.recommended_duration_min AS "recommendedDurationMin"',
        'd.crowd_level AS "crowdLevel"',
        'd.is_eco_sensitive AS "isEcoSensitive"',
        'd.rating_avg AS "ratingAvg"',
        'd.review_count AS "reviewCount"',
        'd.check_in_count AS "checkInCount"',
        'd.hero_media_id AS "heroMediaId"',
        's.code AS "stateCode"',
        'dist.name AS "districtName"',
        'ST_Y(d.location::geometry) AS lat',
        'ST_X(d.location::geometry) AS lng',
      ])
      .addSelect(
        `(SELECT COALESCE(array_agg(c.slug ORDER BY c.order_index), '{}')
            FROM destination_categories dc
            JOIN categories c ON c.id = dc.category_id
           WHERE dc.destination_id = d.id)`,
        'categories',
      )
      .addSelect(
        `(SELECT m.storage_key FROM media m WHERE m.id = d.hero_media_id)`,
        'heroStorageKey',
      )
      .where('d.status = :published', { published: DestinationStatus.PUBLISHED })
      // Ecologically stressed sites stay reachable by direct link but leave the lists.
      .andWhere('d.is_promotion_suppressed = false');

    if (point) {
      qb.addSelect(DISTANCE_EXPR, 'distance_m').setParameters({
        ptLat: point.lat,
        ptLng: point.lng,
      });
    } else {
      qb.addSelect('NULL::float8', 'distance_m');
    }

    return qb;
  }

  private applyKeyset(qb: SelectQueryBuilder<Destination>, plan: SortPlan, cursor?: string): void {
    for (const column of plan.columns) {
      qb.addSelect(column.sql, column.alias);
      qb.addOrderBy(
        column.sql,
        plan.direction,
        plan.direction === 'DESC' ? 'NULLS LAST' : 'NULLS FIRST',
      );
    }

    const decoded = decodeCursor<Record<string, unknown>>(cursor);
    if (!decoded) return;

    const values = plan.columns.map((column) => decoded[column.alias]);
    if (values.some((value) => value === undefined)) return;

    const placeholders = plan.columns.map((_, index) => `:cursor_${index}`).join(', ');
    const operator = plan.direction === 'ASC' ? '>' : '<';
    const parameters = Object.fromEntries(values.map((value, index) => [`cursor_${index}`, value]));

    qb.andWhere(
      `(${plan.columns.map((column) => column.sql).join(', ')}) ${operator} (${placeholders})`,
      parameters,
    );
  }

  private toListItem(row: RawDestinationRow): DestinationListItem {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      stateCode: row.stateCode,
      districtName: row.districtName,
      tier: row.tier,
      basePoints: TIER_BASE_POINTS[row.tier as DestinationTier],
      difficulty: row.difficulty,
      minDurationMin: row.minDurationMin,
      recommendedDurationMin: row.recommendedDurationMin,
      crowdLevel: row.crowdLevel,
      isEcoSensitive: row.isEcoSensitive,
      ratingAvg: row.ratingAvg !== null ? Number.parseFloat(String(row.ratingAvg)) : null,
      reviewCount: row.reviewCount,
      checkInCount: row.checkInCount,
      categories: row.categories ?? [],
      heroImageUrl: row.heroStorageKey ? this.mediaService.publicUrl(row.heroStorageKey) : null,
      distanceM: row.distance_m !== null ? Math.round(Number(row.distance_m)) : null,
      lat: Number(row.lat),
      lng: Number(row.lng),
    };
  }

  private pointsExplainer(tier: DestinationTier): string {
    return {
      1: 'Marquee site — everyone already comes here, so a check-in is worth the least.',
      2: 'Regionally well known. Worth a visit, modestly rewarded.',
      3: 'Lesser known. Real points for going somewhere most people skip.',
      4: 'Rare or remote. The highest award on the platform.',
    }[tier];
  }
}

interface RawDestinationRow {
  id: string;
  slug: string;
  name: string;
  tier: number;
  difficulty: string;
  minDurationMin: number;
  recommendedDurationMin: number;
  crowdLevel: string;
  isEcoSensitive: boolean;
  ratingAvg: string | null;
  reviewCount: number;
  checkInCount: number;
  heroMediaId: string | null;
  heroStorageKey: string | null;
  stateCode: string;
  districtName: string | null;
  categories: string[] | null;
  distance_m: number | null;
  lat: number;
  lng: number;
  [key: string]: unknown;
}
