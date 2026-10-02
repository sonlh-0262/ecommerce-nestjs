/**
 * Maps 1-to-1 onto the PostgreSQL `user_role` type created by the
 * `CreateUsersTable` migration.
 *
 * Single source of truth: the entity column, the DTOs and the Swagger schema
 * all read from here, so adding a role means editing this enum and writing a
 * migration that alters the type.
 */
export enum UserRole {
  User = 'USER',
  Admin = 'ADMIN',
}
