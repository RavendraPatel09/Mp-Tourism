import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/auth.decorators';
import { GeoService } from './geo.service';

@ApiTags('discovery')
@Controller()
@Public()
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('states')
  @ApiOperation({
    summary: 'List states and union territories',
    description:
      'Live states first. `isLive: false` states are shown in the picker but have ' +
      'no published destinations yet — MVP ships one pilot state.',
  })
  states() {
    return this.geo.listStates();
  }

  @Get('states/:code/districts')
  @ApiParam({
    name: 'code',
    example: 'MP',
    description: 'ISO 3166-2:IN code without the IN- prefix.',
  })
  @ApiOperation({ summary: 'List districts in a state' })
  districts(@Param('code') code: string) {
    return this.geo.listDistricts(code);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List interest categories' })
  categories() {
    return this.geo.listCategories();
  }
}
