import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/auth.decorators';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';

@ApiTags('user-content')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post()
  @ApiOperation({
    summary: 'Write a review',
    description:
      'Only available to users with an approved check-in at the destination ' +
      '(PRD F9). One review per user per destination.',
  })
  @ApiResponse({ status: 403, description: 'No verified check-in at this destination.' })
  create(@Body() dto: CreateReviewDto, @CurrentUser('id') userId: string) {
    return this.reviews.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit your review',
    description: 'The detailed-review bonus is never paid twice, however the text changes.',
  })
  update(@Param('id') id: string, @Body() dto: UpdateReviewDto, @CurrentUser('id') userId: string) {
    return this.reviews.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove your review' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.reviews.remove(id, userId);
  }
}
