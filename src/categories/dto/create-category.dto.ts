import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import {
  CategoryNameField,
  IsActiveField,
  ParentIdField,
} from './category-fields.decorator';

export class CreateCategoryBodyDto {
  @CategoryNameField()
  name: string;

  @ParentIdField()
  parentId?: string;

  @IsActiveField()
  isActive?: boolean;
}

export class CreateCategoryDto {
  @ApiProperty({ type: CreateCategoryBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @ValidateNested()
  @Type(() => CreateCategoryBodyDto)
  category: CreateCategoryBodyDto;
}
