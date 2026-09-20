import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { Challenge } from 'src/entities';
import { Audit, CurrentUser, Roles } from 'src/common/decorators/auth.decorators';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UserRole } from 'src/common/constants/roles.enum';
import { ChallengeScope, ChallengeStatus } from 'src/common/constants/enums';
import {
  ForbiddenException,
  NotFoundException,
  UnprocessableException,
} from 'src/common/exceptions/app-exceptions';
import { CreateChallengeDto, ListChallengesDto } from './dto/challenge.dto';

@ApiTags('admin/challenges')
@ApiBearerAuth()
@Controller('admin/challenges')
@UseGuards(RolesGuard)
@Roles(UserRole.STATE_ADMIN, UserRole.SUPER_ADMIN)
export class AdminChallengesController {
  constructor(@InjectRepository(Challenge) private readonly repo: Repository<Challenge>) {}

  @Get()
  @ApiOperation({ summary: 'List challenges, including drafts' })
  list(@Query() query: ListChallengesDto, @Req() request: Request) {
    const stateScope = (request as Request & { stateScope?: string | null }).stateScope;
    return this.repo.find({
      where: stateScope ? { stateId: stateScope } : {},
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  @Post()
  @Audit('challenge.create', 'challenge')
  @ApiOperation({
    summary: 'Create a challenge',
    description:
      'A State Admin may only create challenges in their own state; the scope is ' +
      'forced from the token rather than read from the payload.',
  })
  async create(
    @Body() dto: CreateChallengeDto,
    @CurrentUser('id') userId: string,
    @Req() request: Request,
  ) {
    const stateScope = (request as Request & { stateScope?: string | null }).stateScope;

    if (stateScope && dto.scope === ChallengeScope.NATIONAL) {
      throw new ForbiddenException(
        'Only a Super Admin can create a national challenge.',
        'scope_forbidden',
      );
    }

    const stateId = stateScope ?? dto.stateId ?? null;
    if (dto.scope === ChallengeScope.STATE && !stateId) {
      throw new UnprocessableException('A state-scoped challenge needs a stateId.');
    }
    if (new Date(dto.endsAt) <= new Date(dto.startsAt)) {
      throw new UnprocessableException('endsAt must be after startsAt.');
    }

    const challenge = this.repo.create({
      title: dto.title,
      slug: this.slugify(dto.title),
      description: dto.description,
      scope: dto.scope,
      stateId,
      type: dto.type,
      criteria: dto.criteria as Challenge['criteria'],
      multiplier: dto.multiplier.toFixed(2),
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      rewardPoints: dto.rewardPoints,
      status: dto.status ?? ChallengeStatus.DRAFT,
      createdBy: userId,
    });

    return this.repo.save(challenge);
  }

  @Patch(':id')
  @Audit('challenge.update', 'challenge')
  @ApiOperation({
    summary: 'Update a challenge',
    description:
      'Criteria and multiplier are frozen once a challenge is active — changing ' +
      'them mid-flight would silently rewrite progress that users already earned.',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateChallengeDto>,
    @Req() request: Request,
  ) {
    const stateScope = (request as Request & { stateScope?: string | null }).stateScope;
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('No such challenge.');
    if (stateScope && existing.stateId !== stateScope) {
      throw new ForbiddenException('That challenge belongs to another state.');
    }

    if (existing.status === ChallengeStatus.ACTIVE && (dto.criteria || dto.multiplier)) {
      throw new UnprocessableException(
        'Criteria and multiplier cannot change while a challenge is active.',
        'challenge_frozen',
      );
    }

    await this.repo.update(id, {
      ...(dto.title ? { title: dto.title } : {}),
      ...(dto.description ? { description: dto.description } : {}),
      ...(dto.criteria ? { criteria: dto.criteria as Challenge['criteria'] } : {}),
      ...(dto.multiplier ? { multiplier: dto.multiplier.toFixed(2) } : {}),
      ...(dto.startsAt ? { startsAt: new Date(dto.startsAt) } : {}),
      ...(dto.endsAt ? { endsAt: new Date(dto.endsAt) } : {}),
      ...(dto.rewardPoints !== undefined ? { rewardPoints: dto.rewardPoints } : {}),
      ...(dto.status ? { status: dto.status } : {}),
    });

    return this.repo.findOne({ where: { id } });
  }

  @Get(':id/participation')
  @ApiOperation({
    summary: 'Participation and completion counts',
    description: 'The numbers a tourism officer asks for after a campaign.',
  })
  async participation(@Param('id') id: string) {
    const rows = await this.repo.query<
      { participants: string; completions: string; points_paid: string }[]
    >(
      `
      SELECT COUNT(*) AS participants,
             COUNT(*) FILTER (WHERE completed_at IS NOT NULL) AS completions,
             COALESCE(SUM(points_awarded), 0) AS points_paid
        FROM challenge_progress
       WHERE challenge_id = $1
      `,
      [id],
    );

    const row = rows[0];
    const participants = Number.parseInt(row?.participants ?? '0', 10);
    const completions = Number.parseInt(row?.completions ?? '0', 10);

    return {
      participants,
      completions,
      completionRate: participants ? Number((completions / participants).toFixed(3)) : 0,
      pointsPaid: Number.parseInt(row?.points_paid ?? '0', 10),
    };
  }

  private slugify(title: string): string {
    return `${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 200)}-${Date.now().toString(36)}`;
  }
}
