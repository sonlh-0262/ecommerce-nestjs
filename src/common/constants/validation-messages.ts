import { ValidationOptions } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

const translated = (key: string): ValidationOptions => ({
  message: i18nValidationMessage(`validation.${key}`),
});

export const VALIDATION_MESSAGES = {
  isString: translated('IS_STRING'),
  isInt: translated('IS_INT'),
  isNumber: translated('IS_NUMBER'),
  isBoolean: translated('IS_BOOLEAN'),
  isUuid: translated('IS_UUID'),
  isIn: translated('IS_IN'),
  isObject: translated('IS_OBJECT'),
  min: translated('MIN'),
  max: translated('MAX'),
  length: translated('LENGTH'),
  maxLength: translated('MAX_LENGTH'),
  atLeastOneField: translated('AT_LEAST_ONE_FIELD'),
} as const;
