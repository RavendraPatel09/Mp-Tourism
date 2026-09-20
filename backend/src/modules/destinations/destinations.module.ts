import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Category,
  Destination,
  DestinationInfo,
  Itinerary,
  Media,
  State,
  ThingToDo,
} from 'src/entities';
import { MediaModule } from '../media/media.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { DestinationsService } from './destinations.service';
import { DestinationsController } from './destinations.controller';
import { AdminDestinationsService } from './admin-destinations.service';
import { AdminDestinationsController } from './admin-destinations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Destination,
      DestinationInfo,
      ThingToDo,
      Itinerary,
      Media,
      State,
      Category,
    ]),
    MediaModule,
    ReviewsModule,
  ],
  providers: [DestinationsService, AdminDestinationsService],
  controllers: [DestinationsController, AdminDestinationsController],
  exports: [DestinationsService],
})
export class DestinationsModule {}
