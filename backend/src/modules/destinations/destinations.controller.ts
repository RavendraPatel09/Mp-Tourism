import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/auth.decorators';
import { CursorPaginationDto } from 'src/common/dto/pagination.dto';
import { ReviewsService } from '../reviews/reviews.service';
import { DestinationsService } from './destinations.service';
import { ListDestinationsDto, NearbyDestinationsDto, SearchDto } from './dto/list-destinations.dto';

@ApiTags('discovery')
@Controller()
@Public()
export class DestinationsController {
  constructor(
    private readonly destinations: DestinationsService,
    private readonly reviews: ReviewsService,
  ) {}

  @Get('destinations')
  @ApiOperation({
    summary: 'List destinations',
    description:
      'Eight filter dimensions, all optional and all combinable. Cursor paginated.\n\n' +
      'The default sort is `recommended`, which puts the rarest and least-visited ' +
      'sites first — the product exists to move people off the same twelve landmarks, ' +
      'so the default ordering has to reflect that rather than showing the famous ' +
      'ones first and hoping people scroll.\n\n' +
      'Pass `lat`/`lng` to get `distanceM` on every row; `sort=distance` requires them.',
  })
  list(@Query() query: ListDestinationsDto) {
    return this.destinations.list(query);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search destinations',
    description:
      'Typo tolerant and alias aware — "khajurao" finds Khajuraho, and regional ' +
      'spellings registered on a destination match too. Not paginated: relevance ' +
      'past the first couple of dozen hits is noise.',
  })
  search(@Query() query: SearchDto) {
    return this.destinations.search(query);
  }

  @Get('destinations/:slug')
  @ApiParam({ name: 'slug', description: 'Slug or id.' })
  @ApiOperation({
    summary: 'Destination detail',
    description:
      'The core content unit: things to do, itinerary, full visitor info, hazards, ' +
      'accessibility, gallery, and what a check-in here is worth with the reason why.',
  })
  detail(@Param('slug') slug: string) {
    return this.destinations.detail(slug);
  }

  @Get('destinations/:id/nearby')
  @ApiOperation({
    summary: 'Nearby destinations',
    description:
      'The redistribution engine. Ordered by rarity first and distance second, ' +
      'not distance alone — the Tier-4 stepwell 18 km away is the point; the ' +
      'famous fort 4 km away is already on everyone’s list.',
  })
  nearby(@Param('id') id: string, @Query() query: NearbyDestinationsDto) {
    return this.destinations.nearby(id, query);
  }

  @Get('destinations/:id/itinerary')
  @ApiOperation({ summary: 'The suggested hour-by-hour itinerary' })
  itinerary(@Param('id') id: string) {
    return this.destinations.itinerary(id);
  }

  @Get('destinations/:id/photos')
  @ApiOperation({ summary: 'Approved gallery photos' })
  photos(@Param('id') id: string) {
    return this.destinations.photos(id);
  }

  @Get('destinations/:id/reviews')
  @ApiOperation({
    summary: 'Reviews for a destination',
    description: 'Every review here is from a verified visitor — that is enforced, not claimed.',
  })
  async reviewsFor(@Param('id') id: string, @Query() query: CursorPaginationDto) {
    const destination = await this.destinations.findPublished(id);
    return this.reviews.listForDestination(destination.id, query.limit, query.cursor);
  }
}
