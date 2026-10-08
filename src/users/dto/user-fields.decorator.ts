import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { trim, trimLower } from '../../common/transforms/trim';
import {
  EMAIL_MAX_LENGTH,
  FULL_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_STRENGTH_PATTERN,
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

export const UsernameField = () =>
  applyDecorators(
    ApiProperty({
      example: 'sonlh',
      minLength: USERNAME_MIN_LENGTH,
      maxLength: USERNAME_MAX_LENGTH,
      pattern: USERNAME_PATTERN.source,
    }),
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

export const FullNameField = () =>
  applyDecorators(
    ApiPropertyOptional({
      example: 'Lanh Hung Son',
      maxLength: FULL_NAME_MAX_LENGTH,
    }),
    IsOptional(),
    IsString(IS_STRING),
    MaxLength(FULL_NAME_MAX_LENGTH, MAX_LENGTH),
    Transform(trim),
  );

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
