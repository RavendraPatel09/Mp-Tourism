import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Cursor pagination (PRD §8 conventions). Offsets are not offered on public
 * lists: destination lists are sorted by distance or rank, which shifts between
 * requests, and an offset silently skips or repeats rows when it does.
 */
export class CursorPaginationDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor from the previous response’s `next_cursor`.',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class PageMeta {
  @ApiProperty({ nullable: true, description: 'Null when there are no further pages.' })
  nextCursor!: string | null;

  @ApiProperty()
  limit!: number;
}

export class Paginated<T> {
  @ApiProperty({ isArray: true })
  data!: T[];

  @ApiProperty({ type: PageMeta })
  meta!: PageMeta;
}

export function paginate<T>(
  rows: T[],
  limit: number,
  encodeCursor: (row: T) => string,
): Paginated<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return {
    data,
    meta: {
      limit,
      nextCursor: hasMore && data.length ? encodeCursor(data[data.length - 1]) : null,
    },
  };
}

/** Cursors are base64 so clients treat them as opaque and stop parsing them. */
export const encodeCursor = (value: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

export const decodeCursor = <T = Record<string, unknown>>(cursor?: string): T | null => {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
};
