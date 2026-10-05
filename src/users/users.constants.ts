import {
  UNIQUE_USERS_EMAIL_INDEX,
  UNIQUE_USERS_USERNAME_INDEX,
} from './entities/user.entity.constants';
import { UserTokenType } from './enums/user-token-type.enum';

/**
 * Constants owned by the users module.
 *
 * Single source of truth for the shape of a user: the entity columns, the DTOs
 * that validate incoming payloads and the Swagger docs all read from here.
 *
 * These lengths mirror the columns created by the `CreateUsersTable` migration.
 * Widening one means writing a new migration as well as editing this file.
 */

export const EMAIL_MAX_LENGTH = 255;

export const USERNAME_MAX_LENGTH = 50;

/** Wide enough for any bcrypt hash (60 chars) plus room for a future algorithm. */
export const PASSWORD_HASH_MAX_LENGTH = 255;

export const FULL_NAME_MAX_LENGTH = 100;

export const PHONE_MAX_LENGTH = 20;

export const ADDRESS_MAX_LENGTH = 255;

export const TOKEN_HASH_LENGTH = 64;

export const USERNAME_MIN_LENGTH = 3;

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_MAX_LENGTH = 72;

export const PASSWORD_STRENGTH_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export const USER_TOKEN_BYTES = 32;

export const USER_TOKEN_PATTERN = new RegExp(
  `^[0-9a-f]{${USER_TOKEN_BYTES * 2}}$`,
);

export const USER_TOKEN_TTL_MINUTES: Record<UserTokenType, number> = {
  [UserTokenType.EmailVerify]: 24 * 60,
  [UserTokenType.ResetPassword]: 30,
};

export const USER_UNIQUE_CONFLICTS: Record<string, string> = {
  [UNIQUE_USERS_EMAIL_INDEX]: 'users.EMAIL_TAKEN',
  [UNIQUE_USERS_USERNAME_INDEX]: 'users.USERNAME_TAKEN',
};
