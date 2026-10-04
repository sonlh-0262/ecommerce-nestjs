export const CODE_MAX_LENGTH = 20;
export const RECEIVER_NAME_MAX_LENGTH = 100;
export const RECEIVER_PHONE_MAX_LENGTH = 20;
export const SHIPPING_ADDRESS_MAX_LENGTH = 255;
export const NOTE_MAX_LENGTH = 500;
export const REASON_MAX_LENGTH = 500;
export const REASON_MIN_LENGTH = 10;
export const PAYMENT_TRANSACTION_REF_MAX_LENGTH = 100;

export const ORDER_CODE_PREFIX = 'ORD';
export const ORDER_CODE_SEQ_PADDING = 4;

export const ORDERS_USER_FK = 'FK_orders_user';
export const UNIQUE_ORDERS_CODE_INDEX = 'UQ_orders_code';
export const ORDERS_USER_LISTING_INDEX = 'IDX_orders_user_created_at';
export const ORDERS_STATUS_LISTING_INDEX = 'IDX_orders_status_created_at';
export const ORDERS_DELIVERED_AT_INDEX = 'IDX_orders_delivered_at';

export const ORDERS_AMOUNTS_CHECK = 'CHK_orders_amounts';
export const ORDERS_REJECT_REASON_CHECK = 'CHK_orders_reject_reason';
export const ORDERS_DELIVERED_AT_CHECK = 'CHK_orders_delivered_at';
export const ORDERS_PAID_AT_CHECK = 'CHK_orders_paid_at';
export const ORDERS_TRANSACTION_REF_CHECK = 'CHK_orders_transaction_ref';

export const ORDER_ITEMS_ORDER_FK = 'FK_order_items_order';
export const ORDER_ITEMS_PRODUCT_FK = 'FK_order_items_product';
export const UNIQUE_ORDER_ITEMS_ORDER_PRODUCT_INDEX =
  'UQ_order_items_order_product';
export const ORDER_ITEMS_PRODUCT_INDEX = 'IDX_order_items_product_id';
export const ORDER_ITEMS_QUANTITY_CHECK = 'CHK_order_items_quantity';
export const ORDER_ITEMS_UNIT_PRICE_CHECK = 'CHK_order_items_unit_price';
export const ORDER_ITEMS_LINE_TOTAL_CHECK = 'CHK_order_items_line_total';

export const ORDER_STATUS_HISTORIES_ORDER_FK =
  'FK_order_status_histories_order';
export const ORDER_STATUS_HISTORIES_USER_FK = 'FK_order_status_histories_user';
export const ORDER_STATUS_HISTORIES_INDEX =
  'IDX_order_status_histories_order_created_at';
export const ORDER_STATUS_HISTORIES_TRANSITION_CHECK =
  'CHK_order_status_histories_transition';

export const ORDER_CODE_COUNTERS_SEQ_CHECK = 'CHK_order_code_counters_seq';
export const ORDER_CODE_COUNTERS_SEQ_EXPRESSION = 'last_seq >= 0';

export const ORDERS_DELIVERED_CONDITION = "status = 'DELIVERED'";
