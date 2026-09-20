import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category, District, State } from 'src/entities';
import { GeoService } from './geo.service';
import { GeoController } from './geo.controller';

@Module({
  imports: [TypeOrmModule.forFeature([State, District, Category])],
  providers: [GeoService],
  controllers: [GeoController],
  exports: [GeoService],
})
export class GeoModule {}
