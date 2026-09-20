import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Challenge, ChallengeProgress, Destination } from 'src/entities';
import { PointsModule } from '../points/points.module';
import { ChallengesService } from './challenges.service';
import { ChallengesController } from './challenges.controller';
import { AdminChallengesController } from './admin-challenges.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Challenge, ChallengeProgress, Destination]), PointsModule],
  providers: [ChallengesService],
  controllers: [ChallengesController, AdminChallengesController],
  exports: [ChallengesService],
})
export class ChallengesModule {}
