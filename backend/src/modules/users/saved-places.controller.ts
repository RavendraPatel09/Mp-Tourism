import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedList, SavedPlace } from 'src/entities';
import { CurrentUser } from 'src/common/decorators/auth.decorators';
import { MediaService } from '../media/media.service';
import { SaveDestinationDto } from './dto/user.dto';

/**
 * A single flat "Want to visit" list per user. Custom lists (PRD F8) are cut
 * from MVP per TEAM_PLAN, but the tables already model many lists per user, so
 * turning the feature on later is a UI change rather than a migration.
 */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me/saved')
export class SavedPlacesController {
  constructor(
    private readonly media: MediaService,
    @InjectRepository(SavedList) private readonly lists: Repository<SavedList>,
    @InjectRepository(SavedPlace) private readonly saved: Repository<SavedPlace>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Your saved destinations' })
  async list(@CurrentUser('id') userId: string) {
    const rows = await this.saved
      .createQueryBuilder('sp')
      .innerJoin('destinations', 'd', 'd.id = sp.destination_id')
      .innerJoin('states', 's', 's.id = d.state_id')
      .select([
        'd.id AS id',
        'd.slug AS slug',
        'd.name AS name',
        'd.tier AS tier',
        's.code AS "stateCode"',
        'sp.note AS note',
        'sp.added_at AS "addedAt"',
      ])
      .addSelect(`(SELECT m.storage_key FROM media m WHERE m.id = d.hero_media_id)`, 'heroKey')
      .where('sp.user_id = :userId', { userId })
      .orderBy('sp.added_at', 'DESC')
      .getRawMany<{
        id: string;
        slug: string;
        name: string;
        tier: number;
        stateCode: string;
        note: string | null;
        addedAt: Date;
        heroKey: string | null;
      }>();

    return rows.map((row) => ({
      ...row,
      heroKey: undefined,
      heroImageUrl: row.heroKey ? this.media.publicUrl(row.heroKey) : null,
    }));
  }

  @Post()
  @ApiOperation({
    summary: 'Save a destination',
    description: 'Idempotent — saving something already saved succeeds and changes nothing.',
  })
  async save(@Body() dto: SaveDestinationDto, @CurrentUser('id') userId: string) {
    const list = await this.defaultList(userId);

    await this.saved
      .createQueryBuilder()
      .insert()
      .values({
        listId: list.id,
        destinationId: dto.destinationId,
        userId,
        note: dto.note ?? null,
      })
      .orIgnore()
      .execute();

    return { destinationId: dto.destinationId, saved: true };
  }

  @Delete(':destinationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unsave a destination' })
  async remove(
    @Param('destinationId') destinationId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    await this.saved.delete({ userId, destinationId });
  }

  /** Created lazily: accounts that predate the list feature still work. */
  private async defaultList(userId: string): Promise<SavedList> {
    const existing = await this.lists.findOne({ where: { userId, isDefault: true } });
    if (existing) return existing;
    return this.lists.save(this.lists.create({ userId, name: 'Want to visit', isDefault: true }));
  }
}
