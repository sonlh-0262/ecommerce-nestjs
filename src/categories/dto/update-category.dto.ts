import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { AtLeastOneField } from '../../common/validators/at-least-one-field.validator';
import {
  CategoryNameField,
  IsActiveField,
  ParentIdField,
} from './category-fields.decorator';

export class UpdateCategoryBodyDto {
  @CategoryNameField({ optional: true })
  name?: string;

  @ParentIdField({ nullable: true })
  parentId?: string | null;

  @IsActiveField()
  isActive?: boolean;
}

export class UpdateCategoryDto {
  @ApiProperty({ type: UpdateCategoryBodyDto })
  @IsObject(VALIDATION_MESSAGES.isObject)
  @AtLeastOneField(VALIDATION_MESSAGES.atLeastOneField)
  @ValidateNested()
  @Type(() => UpdateCategoryBodyDto)
  category: UpdateCategoryBodyDto;
}
