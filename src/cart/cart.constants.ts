export const CARTS_USER_FK = 'FK_carts_user';
export const UNIQUE_CARTS_USER_INDEX = 'UQ_carts_user';

export const CART_ITEMS_CART_FK = 'FK_cart_items_cart';
export const CART_ITEMS_PRODUCT_FK = 'FK_cart_items_product';
export const UNIQUE_CART_ITEMS_CART_PRODUCT_INDEX =
  'UQ_cart_items_cart_product';
export const CART_ITEMS_QUANTITY_CHECK = 'CHK_cart_items_quantity';
export const CART_ITEMS_QUANTITY_EXPRESSION = 'quantity > 0';

export const CART_ITEM_MIN_QUANTITY = 1;
export const CART_ITEM_MAX_QUANTITY = 99;
