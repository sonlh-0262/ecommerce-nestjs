/**
 * Maps 1-to-1 onto the PostgreSQL `user_status` type.
 *
 * Distinct from `deleted_at`: `Inactive` is an account an admin locked, which
 * still exists and is still listed, while a soft-deleted row is treated as
 * though it never existed.
 */
export enum UserStatus {
  /** Registered but the email has not been confirmed yet - cannot log in. */
  Pending = 'PENDING',
  /** Confirmed and usable. The only status that may authenticate. */
  Active = 'ACTIVE',
  /** Locked by an admin - cannot log in, but remains visible to admins. */
  Inactive = 'INACTIVE',
}
