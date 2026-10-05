export const CONTENT_MIN_LENGTH = 10;
export const CONTENT_MAX_LENGTH = 1000;
export const RATING_MIN = 1;
export const RATING_MAX = 5;

export const REVIEWS_PRODUCT_FK = 'FK_reviews_product';
export const REVIEWS_USER_FK = 'FK_reviews_user';
export const REVIEWS_ORDER_FK = 'FK_reviews_order';
export const UNIQUE_REVIEWS_PRODUCT_USER_INDEX = 'UQ_reviews_product_user';
export const REVIEWS_LISTING_INDEX = 'IDX_reviews_product_created_at';
export const REVIEWS_RATING_INDEX = 'IDX_reviews_product_rating';
export const REVIEWS_RATING_CHECK = 'CHK_reviews_rating';
export const REVIEWS_CONTENT_CHECK = 'CHK_reviews_content';
