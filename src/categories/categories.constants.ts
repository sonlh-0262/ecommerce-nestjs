import { SECONDS_PER_MINUTE } from '../common/constants/time';

export const NAME_MIN_LENGTH = 1;
export const NAME_MAX_LENGTH = 100;
export const SLUG_MAX_LENGTH = 120;

export const MAX_DEPTH = 2;

export const UNIQUE_CATEGORIES_SLUG_INDEX = 'UQ_categories_slug';
export const CATEGORIES_PARENT_INDEX = 'IDX_categories_parent_id';
export const CATEGORIES_PARENT_FK = 'FK_categories_parent';
export const CATEGORIES_PARENT_NOT_SELF_CHECK =
  'CHK_categories_parent_not_self';
export const CATEGORIES_PARENT_NOT_SELF_EXPRESSION =
  'parent_id IS NULL OR parent_id <> id';

export const UNIQUE_CATEGORIES_NAME_PARENT_INDEX = 'UQ_categories_name_parent';

export const CATEGORY_UNIQUE_CONFLICTS: Record<string, string> = {
  [UNIQUE_CATEGORIES_NAME_PARENT_INDEX]: 'categories.NAME_TAKEN',
};

export const ROOT_CATEGORIES_FILTER = 'null';

export const CATEGORIES_CACHE_TTL_SECONDS = 5 * SECONDS_PER_MINUTE;
