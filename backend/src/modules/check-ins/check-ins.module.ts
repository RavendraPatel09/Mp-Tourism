import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckIn, Destination, Media, VerificationSignal } from 'src/entities';
import { PointsModule } from '../points/points.module';
import { BadgesModule } from '../badges/badges.module';
import { ChallengesModule } from '../challenges/challenges.module';
import { LeaderboardsModule } from '../leaderboards/leaderboards.module';
import { MediaModule } from '../media/media.module';
import { VerificationModule } from '../verification/verification.module';
import { CheckInsService } from './check-ins.service';
import { CheckInsController } from './check-ins.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CheckIn, Destination, Media, VerificationSignal]),
    PointsModule,
    BadgesModule,
    ChallengesModule,
    LeaderboardsModule,
    MediaModule,
    forwardRef(() => VerificationModule),
  ],
  providers: [CheckInsService],
  controllers: [CheckInsController],
  exports: [CheckInsService],
})
export class CheckInsModule {}
