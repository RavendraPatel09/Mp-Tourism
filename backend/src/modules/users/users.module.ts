import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedList, SavedPlace, User, UserProfile } from 'src/entities';
import { MediaModule } from '../media/media.module';
import { LeaderboardsModule } from '../leaderboards/leaderboards.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { SavedPlacesController } from './saved-places.controller';
import { AdminUsersController } from './admin-users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserProfile, SavedList, SavedPlace]),
    MediaModule,
    LeaderboardsModule,
  ],
  providers: [UsersService],
  controllers: [UsersController, SavedPlacesController, AdminUsersController],
  exports: [UsersService],
})
export class UsersModule {}
