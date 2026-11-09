import { ShopStatus } from './enums/shop-status.enum';

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 100;
export const SLUG_MAX_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const REASON_MIN_LENGTH = 10;
export const REASON_MAX_LENGTH = 500;
export const SHOP_SEARCH_MAX_LENGTH = 100;
export const REQUIRED_TEXT_MIN_LENGTH = 1;

export const SHOPS_OWNER_FK = 'FK_shops_owner';
export const SHOPS_REVIEWER_FK = 'FK_shops_reviewer';
export const UNIQUE_SHOPS_OWNER_INDEX = 'UQ_shops_owner_id';
export const UNIQUE_SHOPS_SLUG_INDEX = 'UQ_shops_slug';
export const SHOPS_STATUS_INDEX = 'IDX_shops_status_created_at';
export const SHOPS_REVIEWED_CHECK = 'CHK_shops_reviewed';
export const SHOPS_REJECTION_REASON_CHECK = 'CHK_shops_rejection_reason';

export const SHOPS_REVIEWED_EXPRESSION =
  "(status = 'PENDING') = (reviewed_at IS NULL)";
export const SHOPS_REJECTION_REASON_EXPRESSION =
  "status <> 'REJECTED' OR rejection_reason IS NOT NULL";

export const MY_SHOP_SLUG = 'me';
export const RESERVED_SHOP_SLUGS = [MY_SHOP_SLUG];

export const SHOP_RESUBMISSION = {
  status: ShopStatus.Pending,
  rejectionReason: null,
  reviewedBy: null,
  reviewedAt: null,
};

export const SHOP_DECISIONS = [ShopStatus.Active, ShopStatus.Rejected] as const;

export type ShopDecision = (typeof SHOP_DECISIONS)[number];
