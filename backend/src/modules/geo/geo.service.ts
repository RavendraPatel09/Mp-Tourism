import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category, District, State } from 'src/entities';
import { NotFoundException } from 'src/common/exceptions/app-exceptions';

export interface StateSummary {
  id: string;
  name: string;
  code: string;
  type: 'state' | 'ut';
  isLive: boolean;
  destinationCount: number;
  heroMediaId: string | null;
}

@Injectable()
export class GeoService {
  constructor(
    @InjectRepository(State) private readonly states: Repository<State>,
    @InjectRepository(District) private readonly districts: Repository<District>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
  ) {}

  /**
   * The state picker. Geometry is deliberately excluded — a state MultiPolygon
   * is hundreds of kilobytes and the client only needs a name and a count.
   * Boundaries are served as a static tileset by the web team instead.
   */
  async listStates(): Promise<StateSummary[]> {
    const rows = await this.states
      .createQueryBuilder('state')
      .select([
        'state.id AS id',
        'state.name AS name',
        'state.code AS code',
        'state.type AS type',
        'state.is_live AS "isLive"',
        'state.hero_media_id AS "heroMediaId"',
      ])
      .addSelect(
        `(SELECT COUNT(*) FROM destinations d
           WHERE d.state_id = state.id AND d.status = 'published')`,
        'destinationCount',
      )
      .orderBy('state.is_live', 'DESC')
      .addOrderBy('state.name', 'ASC')
      .getRawMany<StateSummary & { destinationCount: string }>();

    return rows.map((row) => ({
      ...row,
      destinationCount: Number.parseInt(String(row.destinationCount), 10),
    }));
  }

  async listDistricts(stateCode: string) {
    const state = await this.states.findOne({ where: { code: stateCode.toUpperCase() } });
    if (!state) throw new NotFoundException(`No state with code ${stateCode}.`);

    return this.districts
      .createQueryBuilder('district')
      .select(['district.id AS id', 'district.name AS name', 'district.slug AS slug'])
      .addSelect(
        `(SELECT COUNT(*) FROM destinations d
           WHERE d.district_id = district.id AND d.status = 'published')`,
        'destinationCount',
      )
      .where('district.state_id = :stateId', { stateId: state.id })
      .orderBy('district.name', 'ASC')
      .getRawMany();
  }

  listCategories() {
    return this.categories.find({ order: { orderIndex: 'ASC', name: 'ASC' } });
  }
}
