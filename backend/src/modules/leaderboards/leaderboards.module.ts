import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaderboardSnapshot, UserProfile } from 'src/entities';
import { MediaModule } from '../media/media.module';
import { LeaderboardsService } from './leaderboards.service';
import { LeaderboardsController } from './leaderboards.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LeaderboardSnapshot, UserProfile]), MediaModule],
  providers: [LeaderboardsService],
  controllers: [LeaderboardsController],
  exports: [LeaderboardsService],
})
export class LeaderboardsModule {}
