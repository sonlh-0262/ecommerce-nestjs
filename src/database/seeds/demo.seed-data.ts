import { OrderStatus } from '../../orders/enums/order-status.enum';
import { PaymentMethod } from '../../orders/enums/payment-method.enum';
import { AdminSettableOrderStatus } from '../../orders/orders.constants';
import { UserStatus } from '../../users/enums/user-status.enum';
import { SeedDemoOrder } from './interfaces/seed-demo-order.interface';
import { SeedDemoUser } from './interfaces/seed-demo-user.interface';
import { DEMO_MAX_QUANTITY } from './seed.constants';

const user = (
  index: number,
  fullName: string,
  status: SeedDemoUser['status'] = UserStatus.Active,
): SeedDemoUser => ({
  email: `demo.user${index}@example.com`,
  username: `demo_user_${index}`,
  fullName,
  status,
});

export const DEMO_USERS: readonly SeedDemoUser[] = [
  user(1, 'Nguyễn Văn An'),
  user(2, 'Trần Thị Bình'),
  user(3, 'Lê Hoàng Cường'),
  user(4, 'Phạm Thu Dung'),
  user(5, 'Võ Minh Em', UserStatus.Pending),
];

export const DEMO_MIN_STOCK =
  DEMO_USERS.filter(({ status }) => status === UserStatus.Active).length *
  DEMO_MAX_QUANTITY;

const order = (
  status: OrderStatus,
  lines: number,
  paymentMethod = PaymentMethod.Cod,
  paid = false,
): SeedDemoOrder => ({ status, lines, paymentMethod, paid });

const { Pending, Confirmed, Shipping, Delivered, Rejected, Cancelled } =
  OrderStatus;
const { BankTransfer } = PaymentMethod;

export const DEMO_ORDERS: readonly SeedDemoOrder[] = [
  order(Delivered, 3),
  order(Delivered, 3, BankTransfer, true),
  order(Delivered, 3),
  order(Delivered, 3),
  order(Pending, 2),
  order(Confirmed, 2, BankTransfer, true),
  order(Shipping, 2),
  order(Rejected, 2),
  order(Delivered, 3),
  order(Delivered, 3, BankTransfer, true),
  order(Delivered, 3),
  order(Delivered, 3),
  order(Cancelled, 2),
  order(Pending, 2, BankTransfer),
  order(Confirmed, 2),
  order(Shipping, 2, BankTransfer, true),
  order(Delivered, 3),
  order(Delivered, 3),
  order(Rejected, 2, BankTransfer),
  order(Cancelled, 2),
];

export const DEMO_ADMIN_STEPS: Readonly<
  Record<OrderStatus, readonly AdminSettableOrderStatus[]>
> = {
  [Pending]: [],
  [Confirmed]: [Confirmed],
  [Shipping]: [Confirmed, Shipping],
  [Delivered]: [Confirmed, Shipping, Delivered],
  [Rejected]: [Rejected],
  [Cancelled]: [],
};

export const DEMO_REVIEW_COMMENTS: Readonly<Record<number, readonly string[]>> =
  {
    1: [
      'Hàng không giống mô tả, rất thất vọng.',
      'Chất lượng kém, dùng vài ngày đã hỏng.',
    ],
    2: [
      'Sản phẩm tạm được nhưng giao hàng chậm.',
      'Đóng gói sơ sài, sản phẩm hơi trầy.',
    ],
    3: [
      'Dùng ổn trong tầm giá, không có gì nổi bật.',
      'Chất lượng trung bình, đúng như mô tả.',
    ],
    4: [
      'Sản phẩm tốt, giao hàng nhanh, sẽ ủng hộ tiếp.',
      'Đóng gói cẩn thận, chất lượng tốt.',
    ],
    5: [
      'Tuyệt vời, chất lượng vượt mong đợi!',
      'Rất hài lòng, sẽ giới thiệu cho bạn bè.',
    ],
  };
