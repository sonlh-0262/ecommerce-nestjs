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
