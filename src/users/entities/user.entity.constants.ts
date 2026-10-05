/**
 * Names and expressions the `users` entity shares with the migration that
 * created the table.
 *
 * They live in their own file because both sides have to agree exactly: a
 * constraint the entity calls by a different name is one the schema builder
 * believes is missing, and would try to create a second time.
 */

export const UNIQUE_USERS_USERNAME_INDEX = 'UQ_users_username';

/** Serves the admin user list, which filters by status and pages by date. */
export const USERS_LISTING_INDEX = 'IDX_users_status_created_at';

/**
 * Condition on all three indexes: a soft-deleted account must not keep its
 * email and username reserved forever, and no listing ever wants those rows.
 */
export const USERS_ALIVE_CONDITION = 'deleted_at IS NULL';

export const USERS_VERIFIED_STATUS_CHECK = 'CHK_users_verified_status';

/**
 * An active account must have a verification date.
 *
 * Catches the "set `ACTIVE` but forgot `email_verified_at`" bug at the one
 * place it cannot be forgotten - seeders and admin status updates are exactly
 * where it tends to slip through.
 */
export const USERS_VERIFIED_STATUS_EXPRESSION =
  "status <> 'ACTIVE' OR email_verified_at IS NOT NULL";

export const USER_TOKENS_USER_FK = 'FK_user_tokens_user';

export const UNIQUE_USER_TOKENS_HASH_INDEX = 'UQ_user_tokens_token_hash';

export const USER_TOKENS_LOOKUP_INDEX = 'IDX_user_tokens_user_type';

export const USER_TOKENS_UNUSED_CONDITION = 'used_at IS NULL';

export const USER_TOKENS_EXPIRY_CHECK = 'CHK_user_tokens_expiry';

export const USER_TOKENS_EXPIRY_EXPRESSION = 'expires_at > created_at';

export const UNIQUE_USERS_EMAIL_INDEX = 'UQ_users_email';
