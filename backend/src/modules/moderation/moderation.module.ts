import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckIn, Media, ModerationActionRecord, Report, Review, User } from 'src/entities';
import { CheckInsModule } from '../check-ins/check-ins.module';
import { MediaModule } from '../media/media.module';
import { LeaderboardsModule } from '../leaderboards/leaderboards.module';
import { ModerationService } from './moderation.service';
import { ModerationController } from './moderation.controller';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, ModerationActionRecord, CheckIn, Media, Review, User]),
    CheckInsModule,
    MediaModule,
    LeaderboardsModule,
  ],
  providers: [ModerationService],
  controllers: [ModerationController, ReportsController],
  exports: [ModerationService],
})
export class ModerationModule {}
