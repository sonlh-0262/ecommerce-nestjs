import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

import { VALIDATION_MESSAGES } from '../../common/constants/validation-messages';
import { toBoolean } from '../../common/transforms/boolean';

export class AddProductImagesDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean(VALIDATION_MESSAGES.isBoolean)
  isThumbnail?: boolean;
}
