import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID, ValidateIf } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { toBoolean } from '../../common/transforms/boolean';
import { ROOT_CATEGORIES_FILTER } from '../categories.constants';

export class CategoriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: `A parent id to list its sub-categories, or \`${ROOT_CATEGORIES_FILTER}\` for the root categories.`,
    example: ROOT_CATEGORIES_FILTER,
  })
  @IsOptional()
  @ValidateIf((_object, value) => value !== ROOT_CATEGORIES_FILTER)
  @IsUUID('all', VALIDATION_MESSAGES.isUuid)
  parentId?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean(VALIDATION_MESSAGES.isBoolean)
  isActive?: boolean;
}
