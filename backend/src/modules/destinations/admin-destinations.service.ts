import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Category, Destination, DestinationInfo, ThingToDo } from 'src/entities';
import { DestinationStatus } from 'src/common/constants/enums';
import {
  ForbiddenException,
  NotFoundException,
  UnprocessableException,
} from 'src/common/exceptions/app-exceptions';
import { AuditService } from '../audit/audit.service';
import {
  AdminListDestinationsDto,
  CreateDestinationDto,
  UpdateDestinationDto,
} from './dto/admin-destination.dto';

/** Fields that must be filled before a destination may be published. */
const PUBLISH_REQUIREMENTS: {
  field: string;
  check: (d: Destination, info?: DestinationInfo | null, things?: number) => boolean;
}[] = [
  { field: 'description', check: (d) => d.description.trim().length >= 80 },
  { field: 'heroMediaId', check: (d) => Boolean(d.heroMediaId) },
  { field: 'districtId', check: (d) => Boolean(d.districtId) },
  { field: 'thingsToDo', check: (_d, _i, things) => (things ?? 0) >= 3 },
  { field: 'info.timings', check: (_d, info) => Object.keys(info?.timings ?? {}).length > 0 },
  { field: 'info.howToReach', check: (_d, info) => Boolean(info?.howToReach) },
];

/**
 * The CMS backend (PRD F22). Member C's admin dashboard is the only client.
 *
 * Two rules are enforced here rather than in the UI, because a UI check is a
 * suggestion:
 *  - a State Admin can only touch destinations in their own state
 *  - publishing requires the visitor information that makes a listing useful,
 *    since a published destination with no timings and no way to get there is
 *    worse than no listing at all
 */
@Injectable()
export class AdminDestinationsService {
  private readonly logger = new Logger(AdminDestinationsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    @InjectRepository(Destination) private readonly destinations: Repository<Destination>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
  ) {}

  async list(query: AdminListDestinationsDto, stateScope: string | null) {
    const qb = this.destinations
      .createQueryBuilder('d')
      .leftJoin('states', 's', 's.id = d.state_id')
      .leftJoin('districts', 'dist', 'dist.id = d.district_id')
      .select([
        'd.id AS id',
        'd.name AS name',
        'd.slug AS slug',
        'd.status AS status',
        'd.tier AS tier',
        'd.check_in_count AS "checkInCount"',
        'd.published_at AS "publishedAt"',
        'd.updated_at AS "updatedAt"',
        's.code AS "stateCode"',
        'dist.name AS "districtName"',
      ])
      .orderBy('d.updated_at', 'DESC')
      .limit(query.limit)
      .offset(query.offset);

    const scopedState = stateScope ?? query.stateId;
    if (scopedState) qb.andWhere('d.state_id = :stateId', { stateId: scopedState });
    if (query.status) qb.andWhere('d.status = :status', { status: query.status });
    if (query.q) {
      qb.andWhere('(d.name ILIKE :q OR d.slug ILIKE :q)', { q: `%${query.q}%` });
    }

    const [rows, total] = await Promise.all([
      qb.getRawMany(),
      this.destinations.count({
        where: {
          ...(scopedState ? { stateId: scopedState } : {}),
          ...(query.status ? { status: query.status } : {}),
        },
      }),
    ]);

    return { data: rows, total, limit: query.limit, offset: query.offset };
  }

  async create(dto: CreateDestinationDto, actorId: string, stateScope: string | null) {
    const stateId = stateScope ?? dto.stateId;
    if (stateScope && dto.stateId !== stateScope) {
      throw new ForbiddenException('You can only create destinations in your own state.');
    }

    return this.dataSource.transaction(async (manager) => {
      const destination = manager.getRepository(Destination).create({
        stateId,
        districtId: dto.districtId ?? null,
        name: dto.name,
        slug: await this.uniqueSlug(dto.name),
        aliases: dto.aliases ?? [],
        description: dto.description,
        story: dto.story ?? null,
        location: { type: 'Point', coordinates: [dto.lng, dto.lat] },
        geofence: this.toPolygon(dto.geofence?.ring),
        geofenceRadiusM: dto.geofence?.radiusM ?? 300,
        tier: (dto.tier ?? 3) as Destination['tier'],
        status: DestinationStatus.DRAFT,
        bestSeason: dto.bestSeason ?? [],
        isMonsoonOnly: dto.isMonsoonOnly ?? false,
        minDurationMin: dto.minDurationMin ?? 60,
        recommendedDurationMin: dto.recommendedDurationMin ?? 120,
        difficulty: dto.difficulty,
        avgBudget: dto.avgBudget,
        accessibilityFlags: dto.accessibilityFlags ?? {},
        crowdLevel: dto.crowdLevel,
        isEcoSensitive: dto.isEcoSensitive ?? false,
        hazards: dto.hazards ?? [],
        heroMediaId: dto.heroMediaId ?? null,
        annualVisitors: dto.annualVisitors ?? null,
        createdBy: actorId,
      });

      const saved = await manager.getRepository(Destination).save(destination);
      await this.replaceCategories(manager, saved.id, dto.categorySlugs);
      await this.replaceThingsToDo(manager, saved.id, dto.thingsToDo);
      await this.upsertInfo(manager, saved.id, dto.info);

      return saved;
    });
  }

  async update(id: string, dto: UpdateDestinationDto, actorId: string, stateScope: string | null) {
    const existing = await this.requireInScope(id, stateScope);

    const updated = await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Destination).update(id, {
        ...(dto.districtId !== undefined ? { districtId: dto.districtId } : {}),
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.aliases ? { aliases: dto.aliases } : {}),
        ...(dto.description ? { description: dto.description } : {}),
        ...(dto.story !== undefined ? { story: dto.story } : {}),
        ...(dto.lat !== undefined && dto.lng !== undefined
          ? {
              location: {
                type: 'Point' as const,
                coordinates: [dto.lng, dto.lat] as [number, number],
              },
            }
          : {}),
        ...(dto.geofence?.ring ? { geofence: this.toPolygon(dto.geofence.ring) } : {}),
        ...(dto.geofence?.radiusM ? { geofenceRadiusM: dto.geofence.radiusM } : {}),
        ...(dto.tier ? { tier: dto.tier as Destination['tier'], tierReviewedAt: new Date() } : {}),
        ...(dto.bestSeason ? { bestSeason: dto.bestSeason } : {}),
        ...(dto.isMonsoonOnly !== undefined ? { isMonsoonOnly: dto.isMonsoonOnly } : {}),
        ...(dto.minDurationMin ? { minDurationMin: dto.minDurationMin } : {}),
        ...(dto.recommendedDurationMin
          ? { recommendedDurationMin: dto.recommendedDurationMin }
          : {}),
        ...(dto.difficulty ? { difficulty: dto.difficulty } : {}),
        ...(dto.avgBudget ? { avgBudget: dto.avgBudget } : {}),
        ...(dto.accessibilityFlags ? { accessibilityFlags: dto.accessibilityFlags } : {}),
        ...(dto.crowdLevel ? { crowdLevel: dto.crowdLevel } : {}),
        ...(dto.isEcoSensitive !== undefined ? { isEcoSensitive: dto.isEcoSensitive } : {}),
        ...(dto.isPromotionSuppressed !== undefined
          ? { isPromotionSuppressed: dto.isPromotionSuppressed }
          : {}),
        ...(dto.hazards ? { hazards: dto.hazards } : {}),
        ...(dto.heroMediaId !== undefined ? { heroMediaId: dto.heroMediaId } : {}),
        ...(dto.annualVisitors !== undefined ? { annualVisitors: dto.annualVisitors } : {}),
      });

      if (dto.categorySlugs) await this.replaceCategories(manager, id, dto.categorySlugs);
      if (dto.thingsToDo) await this.replaceThingsToDo(manager, id, dto.thingsToDo);
      if (dto.info) await this.upsertInfo(manager, id, dto.info);

      return manager.getRepository(Destination).findOneOrFail({ where: { id } });
    });

    /*
     * A before/after diff, which the interceptor cannot produce — only this
     * service saw the pre-image. Content edits on a government-owned listing are
     * exactly what the audit log exists for.
     */
    await this.audit.record({
      actorId,
      action: 'destination.update',
      entity: 'destination',
      entityId: id,
      before: this.auditView(existing),
      after: this.auditView(updated),
    });

    return updated;
  }

  /**
   * Publishing gate. A listing goes live once, and it is the first impression
   * for a place that has never had digital visibility — so the required fields
   * are checked here rather than trusted to whoever filled the form.
   */
  async publish(id: string, actorId: string, stateScope: string | null) {
    const destination = await this.requireInScope(id, stateScope);

    const info = await this.dataSource
      .getRepository(DestinationInfo)
      .findOne({ where: { destinationId: id } });
    const thingsCount = await this.dataSource
      .getRepository(ThingToDo)
      .count({ where: { destinationId: id } });

    const missing = PUBLISH_REQUIREMENTS.filter(
      (requirement) => !requirement.check(destination, info, thingsCount),
    ).map((requirement) => requirement.field);

    if (missing.length) {
      throw new UnprocessableException(
        `This destination is not ready to publish. Missing: ${missing.join(', ')}.`,
        'publish_requirements_unmet',
        { missing },
      );
    }

    await this.destinations.update(id, {
      status: DestinationStatus.PUBLISHED,
      publishedAt: destination.publishedAt ?? new Date(),
    });

    await this.audit.record({
      actorId,
      action: 'destination.publish',
      entity: 'destination',
      entityId: id,
      before: { status: destination.status },
      after: { status: DestinationStatus.PUBLISHED },
    });

    this.logger.log(`Published destination ${destination.name} (${id})`);
    return this.destinations.findOne({ where: { id } });
  }

  async unpublish(id: string, actorId: string, stateScope: string | null, reason?: string) {
    const destination = await this.requireInScope(id, stateScope);

    await this.destinations.update(id, { status: DestinationStatus.UNPUBLISHED });
    await this.audit.record({
      actorId,
      action: 'destination.unpublish',
      entity: 'destination',
      entityId: id,
      before: { status: destination.status },
      after: { status: DestinationStatus.UNPUBLISHED, reason: reason ?? null },
    });

    return { id, status: DestinationStatus.UNPUBLISHED };
  }

  /**
   * Destinations are never hard-deleted once they have check-ins: the check-in
   * is the unit of every footfall report, and a destination row that disappears
   * takes a district's history with it. Drafts with no history can go.
   */
  async remove(id: string, actorId: string, stateScope: string | null) {
    const destination = await this.requireInScope(id, stateScope);

    if (destination.checkInCount > 0) {
      throw new UnprocessableException(
        'This destination has check-ins and cannot be deleted. Unpublish it instead.',
        'has_check_ins',
      );
    }

    await this.destinations.delete(id);
    await this.audit.record({
      actorId,
      action: 'destination.delete',
      entity: 'destination',
      entityId: id,
      before: this.auditView(destination),
      after: null,
    });

    return { id, deleted: true };
  }

  private async requireInScope(id: string, stateScope: string | null): Promise<Destination> {
    const destination = await this.destinations.findOne({ where: { id } });
    if (!destination) throw new NotFoundException('No such destination.');
    if (stateScope && destination.stateId !== stateScope) {
      throw new ForbiddenException('That destination belongs to another state.');
    }
    return destination;
  }

  private async replaceCategories(
    manager: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    destinationId: string,
    slugs?: string[],
  ): Promise<void> {
    if (!slugs) return;

    await manager.query(`DELETE FROM destination_categories WHERE destination_id = $1`, [
      destinationId,
    ]);
    if (!slugs.length) return;

    const found = await this.categories
      .createQueryBuilder('c')
      .where('c.slug = ANY(:slugs)', { slugs })
      .getMany();

    const unknown = slugs.filter((slug) => !found.some((category) => category.slug === slug));
    if (unknown.length) {
      throw new UnprocessableException(`Unknown category slugs: ${unknown.join(', ')}`);
    }

    await manager.query(
      `INSERT INTO destination_categories (destination_id, category_id)
       SELECT $1, id FROM categories WHERE slug = ANY($2)`,
      [destinationId, slugs],
    );
  }

  private async replaceThingsToDo(
    manager: {
      query: (sql: string, params?: unknown[]) => Promise<unknown>;
    },
    destinationId: string,
    things?: { title: string; description?: string; durationMin?: number }[],
  ): Promise<void> {
    if (!things) return;

    await manager.query(`DELETE FROM things_to_do WHERE destination_id = $1`, [destinationId]);
    for (const [index, thing] of things.entries()) {
      await manager.query(
        `INSERT INTO things_to_do (destination_id, title, description, duration_min, order_index)
         VALUES ($1, $2, $3, $4, $5)`,
        [destinationId, thing.title, thing.description ?? null, thing.durationMin ?? null, index],
      );
    }
  }

  private async upsertInfo(
    manager: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    destinationId: string,
    info?: Record<string, unknown>,
  ): Promise<void> {
    if (!info) return;

    await manager.query(
      `
      INSERT INTO destination_info (
        destination_id, timings, entry_fees, rules, facilities, how_to_reach,
        last_mile_notes, parking, best_time_of_day, official_url, emergency_contacts,
        leave_no_trace_tips
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (destination_id) DO UPDATE SET
        timings = EXCLUDED.timings,
        entry_fees = EXCLUDED.entry_fees,
        rules = EXCLUDED.rules,
        facilities = EXCLUDED.facilities,
        how_to_reach = EXCLUDED.how_to_reach,
        last_mile_notes = EXCLUDED.last_mile_notes,
        parking = EXCLUDED.parking,
        best_time_of_day = EXCLUDED.best_time_of_day,
        official_url = EXCLUDED.official_url,
        emergency_contacts = EXCLUDED.emergency_contacts,
        leave_no_trace_tips = EXCLUDED.leave_no_trace_tips
      `,
      [
        destinationId,
        JSON.stringify(info.timings ?? {}),
        JSON.stringify(info.entryFees ?? {}),
        (info.rules as string[]) ?? [],
        JSON.stringify(info.facilities ?? {}),
        info.howToReach ?? null,
        info.lastMileNotes ?? null,
        info.parking ?? null,
        info.bestTimeOfDay ?? null,
        info.officialUrl ?? null,
        JSON.stringify(info.emergencyContacts ?? {}),
        (info.leaveNoTraceTips as string[]) ?? [],
      ],
    );
  }

  private toPolygon(ring?: [number, number][]) {
    if (!ring?.length) return null;

    const closed = [...ring];
    const [first] = closed;
    const last = closed[closed.length - 1];
    // PostGIS requires a closed ring; the map tool does not always send one.
    if (first[0] !== last[0] || first[1] !== last[1]) closed.push(first);

    if (closed.length < 4) {
      throw new UnprocessableException(
        'A geofence polygon needs at least three distinct points.',
        'invalid_geofence',
      );
    }

    return { type: 'Polygon' as const, coordinates: [closed] };
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 180);

    const taken = await this.destinations
      .createQueryBuilder('d')
      .where('d.slug = :base OR d.slug LIKE :pattern', { base, pattern: `${base}-%` })
      .getCount();

    return taken === 0 ? base : `${base}-${taken + 1}`;
  }

  /** The subset worth diffing in the audit log. */
  private auditView(destination: Destination) {
    return {
      name: destination.name,
      status: destination.status,
      tier: destination.tier,
      districtId: destination.districtId,
      description: destination.description,
      geofenceRadiusM: destination.geofenceRadiusM,
      isPromotionSuppressed: destination.isPromotionSuppressed,
      hazards: destination.hazards,
    };
  }
}
