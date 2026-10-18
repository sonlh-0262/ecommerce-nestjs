import { applyDecorators } from '@nestjs/common';
import { IsISO8601, Matches } from 'class-validator';

import { VALIDATION_MESSAGES } from '../constants/validation-messages';

const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2}))?$/;

export const IsIsoInstant = () =>
  applyDecorators(
    IsISO8601({ strict: true }, VALIDATION_MESSAGES.isDate),
    Matches(ISO_INSTANT_PATTERN, VALIDATION_MESSAGES.isDate),
  );
