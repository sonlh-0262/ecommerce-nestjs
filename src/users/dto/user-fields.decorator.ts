import { applyDecorators } from '@nestjs/common';
import {
  ApiProperty,
  ApiPropertyOptional,
  ApiPropertyOptions,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { trim, trimLower, trimToNull } from '../../common/transforms/trim';
import {
  ADDRESS_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  FULL_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_STRENGTH_PATTERN,
  PHONE_MAX_LENGTH,
  PHONE_PATTERN,
  USER_TOKEN_PATTERN,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
} from '../users.constants';

const IS_STRING = { message: i18nValidationMessage('validation.IS_STRING') };
const LENGTH = { message: i18nValidationMessage('validation.LENGTH') };
const MAX_LENGTH = { message: i18nValidationMessage('validation.MAX_LENGTH') };

export const EmailField = () =>
  applyDecorators(
    ApiProperty({
      example: 'son@example.com',
      format: 'email',
      maxLength: EMAIL_MAX_LENGTH,
    }),
    IsEmail({}, { message: i18nValidationMessage('validation.IS_EMAIL') }),
    MaxLength(EMAIL_MAX_LENGTH, MAX_LENGTH),
    Transform(trimLower),
  );

export const UsernameField = ({ optional = false } = {}) =>
  applyDecorators(
    ApiProperty({
      example: 'sonlh',
      minLength: USERNAME_MIN_LENGTH,
      maxLength: USERNAME_MAX_LENGTH,
      pattern: USERNAME_PATTERN.source,
      required: !optional,
    }),
    ValidateIf((_object, value) => !optional || value !== undefined),
    IsString(IS_STRING),
    Length(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, LENGTH),
    Matches(USERNAME_PATTERN, {
      message: i18nValidationMessage('validation.USERNAME_CHARACTERS'),
    }),
    Transform(trim),
  );

export const NewPasswordField = () =>
  applyDecorators(
    ApiProperty({
      example: 'Password@123',
      format: 'password',
      minLength: PASSWORD_MIN_LENGTH,
      maxLength: PASSWORD_MAX_LENGTH,
      description:
        'At least one lower case letter, one upper case letter and one digit.',
    }),
    IsString(IS_STRING),
    Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, LENGTH),
    Matches(PASSWORD_STRENGTH_PATTERN, {
      message: i18nValidationMessage('validation.PASSWORD_STRENGTH'),
    }),
  );

const NullableTextField = (
  doc: ApiPropertyOptions & { maxLength: number },
  ...rules: PropertyDecorator[]
) =>
  applyDecorators(
    ApiPropertyOptional({ ...doc, nullable: true }),
    IsOptional(),
    IsString(IS_STRING),
    MaxLength(doc.maxLength, MAX_LENGTH),
    ...rules,
    Transform(trimToNull),
  );

export const FullNameField = () =>
  NullableTextField({
    example: 'Lanh Hung Son',
    maxLength: FULL_NAME_MAX_LENGTH,
  });

export const PhoneField = () =>
  NullableTextField(
    {
      example: '0901234567',
      maxLength: PHONE_MAX_LENGTH,
      pattern: PHONE_PATTERN.source,
    },
    Matches(PHONE_PATTERN, {
      message: i18nValidationMessage('validation.PHONE_FORMAT'),
    }),
  );

export const AddressField = () =>
  NullableTextField({
    example: '1 Nguyen Trai, Ha Noi',
    maxLength: ADDRESS_MAX_LENGTH,
  });

export const UserTokenField = () =>
  applyDecorators(
    ApiProperty({
      description: 'The token from the link in the email.',
      pattern: USER_TOKEN_PATTERN.source,
    }),
    IsString(IS_STRING),
    Matches(USER_TOKEN_PATTERN, {
      message: i18nValidationMessage('validation.TOKEN_FORMAT'),
    }),
  );
