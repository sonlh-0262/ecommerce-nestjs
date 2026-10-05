export const NAME_MAX_LENGTH = 255;
export const SLUG_MAX_LENGTH = 280;

export const RATING_PRECISION = 3;
export const RATING_SCALE = 2;

export const PRODUCTS_CATEGORY_FK = 'FK_products_category';
export const PRODUCTS_PUBLISHED_CONDITION =
  "status = 'PUBLISHED' AND deleted_at IS NULL";
export const PRODUCTS_ALIVE_CONDITION = 'deleted_at IS NULL';

export const PRODUCTS_SEARCH_VECTOR_INDEX = 'IDX_products_search_vector';
export const PRODUCTS_PUBLIC_LIST_INDEX = 'IDX_products_public_list';
export const PRODUCTS_SOLD_COUNT_INDEX = 'IDX_products_sold_count';
export const PRODUCTS_RATING_INDEX = 'IDX_products_rating';
export const PRODUCTS_ADMIN_LIST_INDEX = 'IDX_products_admin_list';

export const PRODUCTS_PRICE_CHECK = 'CHK_products_price';
export const PRODUCTS_SALE_PRICE_CHECK = 'CHK_products_sale_price';
export const PRODUCTS_STOCK_CHECK = 'CHK_products_stock';
export const PRODUCTS_SOLD_COUNT_CHECK = 'CHK_products_sold_count';
export const PRODUCTS_RATING_CHECK = 'CHK_products_rating';
export const PRODUCTS_REVIEW_COUNT_CHECK = 'CHK_products_review_count';
export const PRODUCTS_ARCHIVED_CHECK = 'CHK_products_archived';

export const PRODUCTS_SEARCH_VECTOR_EXPRESSION =
  "setweight(to_tsvector('simple', immutable_unaccent(coalesce(name, ''))), 'A') || " +
  "setweight(to_tsvector('simple', immutable_unaccent(coalesce(description, ''))), 'B')";

export const PRODUCT_IMAGES_PRODUCT_FK = 'FK_product_images_product';
export const PRODUCT_IMAGES_ATTACHMENT_FK = 'FK_product_images_attachment';
export const UNIQUE_PRODUCT_IMAGES_ATTACHMENT_INDEX =
  'UQ_product_images_attachment';
export const UNIQUE_PRODUCT_IMAGES_POSITION_INDEX =
  'UQ_product_images_product_pos';
export const PRODUCT_IMAGES_POSITION_CHECK = 'CHK_product_images_position';
export const PRODUCT_IMAGES_POSITION_EXPRESSION = 'position >= 0';

export const UNIQUE_PRODUCTS_SLUG_INDEX = 'UQ_products_slug';
export const PRODUCTS_FEATURED_INDEX = 'IDX_products_featured';
export const PRODUCTS_FEATURED_CONDITION =
  "is_featured AND status = 'PUBLISHED' AND deleted_at IS NULL";

export const UNIQUE_PRODUCT_IMAGES_THUMBNAIL_INDEX =
  'UQ_product_images_thumbnail';
export const PRODUCT_IMAGES_THUMBNAIL_CONDITION = 'is_thumbnail';
