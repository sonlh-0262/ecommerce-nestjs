import request from 'supertest';

import { Category } from '../src/categories/entities/category.entity';
import { OrderResponseDto } from '../src/orders/dto/order.dto';
import { Order } from '../src/orders/entities/order.entity';
import { OrderStatus } from '../src/orders/enums/order-status.enum';
import { PaymentMethod } from '../src/orders/enums/payment-method.enum';
import { PaymentStatus } from '../src/orders/enums/payment-status.enum';
import {
  PaymentDto,
  PaymentResponseDto,
  PaymentsResponseDto,
} from '../src/payments/dto/payment.dto';
import { WebhookReceiptResponseDto } from '../src/payments/dto/webhook-receipt.dto';
import { PaymentEvent } from '../src/payments/entities/payment-event.entity';
import { Payment } from '../src/payments/entities/payment.entity';
import { PaymentAttemptStatus } from '../src/payments/enums/payment-attempt-status.enum';
import { PaymentProvider } from '../src/payments/enums/payment-provider.enum';
import {
  MOCK_SIGNATURE_HEADER,
  REFUND_RETRY_AFTER_MS,
} from '../src/payments/payments.constants';
import { PaymentsScheduler } from '../src/payments/payments.scheduler';
import { SimulatedIntentResponseDto } from '../src/payments/simulator/dto/simulated-intent.dto';
import { MockIntentStatus } from '../src/payments/simulator/enums/mock-intent-status.enum';
import { MockIntent } from '../src/payments/simulator/interfaces/mock-intent.interface';
import { MockIntentStore } from '../src/payments/simulator/mock-intent.store';
import { MockPaymentGateway } from '../src/payments/simulator/mock-payment.gateway';
import { Product } from '../src/products/entities/product.entity';
import { UserRole } from '../src/users/enums/user-role.enum';
import { errorMessages } from './support/http';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import { actingAs, changeStatus, placeOrder } from './support/shopper';
import { createTestApp } from './support/test-app';
import {
  ORDERS_PATH,
  orderPaymentsPath,
  PAYMENT_WEBHOOK_PATHS,
  REFUND_POLL_INTERVAL_MS,
  REFUND_POLL_TIMEOUT_MS,
  simulatorPath,
  TEST_CARD_EXPIRY,
  TEST_CARDS,
} from './support/test.constants';

const STOCK = 10;
const REASON = 'Sản phẩm này tạm hết ở kho Hà Nội';

describe('Card payments (e2e)', () => {
  let ctx: TestContext;
  let category: Category;
  let product: Product;
  let buyer: SeededUser;
  let admin: SeededUser;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    category = await ctx.catalog.category();
    product = await ctx.catalog.product(category, { stock: STOCK });
    buyer = await ctx.users.createAuthenticated();
    admin = await ctx.users.createAuthenticated({ role: UserRole.Admin });
  });

  afterEach(async () => {
    await ctx.reset();
  });

  const cardOrder = async (who = buyer): Promise<string> =>
    (await placeOrder(ctx, who, [[product, 1]], PaymentMethod.Card)).code;

  const start = (code: string, who = buyer) =>
    actingAs(ctx, who).post(orderPaymentsPath(code));

  const startPayment = async (code: string): Promise<PaymentDto> =>
    ((await start(code).expect(201)).body as PaymentResponseDto).payment;

  const confirm = (
    payment: PaymentDto,
    cardNumber: string,
    clientSecret = payment.clientSecret,
  ) =>
    request(ctx.server())
      .post(simulatorPath(payment.providerPaymentId, 'confirm'))
      .send({
        confirmation: { clientSecret, cardNumber, ...TEST_CARD_EXPIRY },
      });

  const authenticate = (payment: PaymentDto, approve: boolean) =>
    request(ctx.server())
      .post(simulatorPath(payment.providerPaymentId, 'authenticate'))
      .send({
        authentication: { clientSecret: payment.clientSecret, approve },
      });

  const pay = async (code: string): Promise<PaymentDto> => {
    const payment = await startPayment(code);

    await confirm(payment, TEST_CARDS.success).expect(200);

    return payment;
  };

  const orderOf = async (code: string) =>
    (
      (await actingAs(ctx, buyer).get(`${ORDERS_PATH}/${code}`).expect(200))
        .body as OrderResponseDto
    ).order;

  const paymentsOf = async (code: string) =>
    (
      (await actingAs(ctx, buyer).get(orderPaymentsPath(code)).expect(200))
        .body as PaymentsResponseDto
    ).payments;

  const intentOf = (payment: PaymentDto): Promise<MockIntent | null> =>
    ctx.app.get(MockIntentStore).find(payment.providerPaymentId);

  const eventually = async (
    paymentId: string,
    status: PaymentAttemptStatus,
  ): Promise<Payment> => {
    const deadline = Date.now() + REFUND_POLL_TIMEOUT_MS;
    const payments = ctx.dataSource.getRepository(Payment);

    for (;;) {
      const payment = await payments.findOneByOrFail({ id: paymentId });

      if (payment.status === status || Date.now() > deadline) {
        return payment;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, REFUND_POLL_INTERVAL_MS),
      );
    }
  };

  describe('POST /orders/:code/payments', () => {
    it('opens one attempt for the order total and hands out its secret', async () => {
      const code = await cardOrder();
      const payment = await startPayment(code);

      expect(payment).toMatchObject({
        provider: PaymentProvider.Mock,
        status: PaymentAttemptStatus.Pending,
        amount: (await orderOf(code)).total,
        currency: 'VND',
        cardLast4: null,
      });
      expect(payment.clientSecret).toMatch(
        new RegExp(`^${payment.providerPaymentId}_secret_`),
      );

      const again = await startPayment(code);

      expect(again.id).toBe(payment.id);
      expect(await paymentsOf(code)).toHaveLength(1);
    });

    it('refuses an order that is not paid by card', async () => {
      const { code } = await placeOrder(ctx, buyer, [[product, 1]]);

      const response = await start(code).expect(422);

      expect(errorMessages(response.body)).toEqual([
        'This order is not paid by card',
      ]);
    });

    it('answers 404 for the card order of somebody else', async () => {
      const code = await cardOrder(await ctx.users.createAuthenticated());

      await start(code).expect(404);
      await actingAs(ctx, buyer).get(orderPaymentsPath(code)).expect(404);
    });

    it('refuses a cancelled order', async () => {
      const code = await cardOrder();

      await actingAs(ctx, buyer)
        .post(`${ORDERS_PATH}/${code}/cancel`)
        .expect(200);

      await start(code).expect(422);
    });

    it('speaks Vietnamese', async () => {
      const { code } = await placeOrder(ctx, buyer, [[product, 1]]);

      const response = await actingAs(ctx, buyer)
        .post(`${orderPaymentsPath(code)}?lang=vi`)
        .expect(422);

      expect(errorMessages(response.body)).toEqual([
        'Đơn hàng này không thanh toán bằng thẻ',
      ]);
    });
  });

  describe('paying through the simulator', () => {
    it('marks the order paid once the test card succeeds', async () => {
      const code = await cardOrder();
      const payment = await startPayment(code);

      const response = await confirm(payment, TEST_CARDS.success).expect(200);

      expect((response.body as SimulatedIntentResponseDto).intent).toEqual({
        id: payment.providerPaymentId,
        status: MockIntentStatus.Succeeded,
        amount: payment.amount,
        currency: 'VND',
        nextAction: null,
        failureCode: null,
        failureMessage: null,
      });

      const order = await orderOf(code);

      expect(order.paymentStatus).toBe(PaymentStatus.Paid);
      expect(order.paidAt).not.toBeNull();
      expect(await paymentsOf(code)).toEqual([
        expect.objectContaining({
          id: payment.id,
          status: PaymentAttemptStatus.Succeeded,
          cardBrand: 'visa',
          cardLast4: '4242',
          clientSecret: null,
        }),
      ]);
      await start(code).expect(409);
    });

    it('keeps the decline and lets the customer try another card', async () => {
      const code = await cardOrder();
      const declined = await startPayment(code);

      const response = await confirm(declined, TEST_CARDS.declined).expect(200);

      expect(
        (response.body as SimulatedIntentResponseDto).intent,
      ).toMatchObject({
        status: MockIntentStatus.Failed,
        failureCode: 'card_declined',
      });
      expect((await orderOf(code)).paymentStatus).toBe(PaymentStatus.Unpaid);

      const retry = await startPayment(code);

      expect(retry.id).not.toBe(declined.id);

      await confirm(retry, TEST_CARDS.success).expect(200);

      expect((await orderOf(code)).paymentStatus).toBe(PaymentStatus.Paid);
      expect(
        (await paymentsOf(code)).map(({ status, failureCode }) => [
          status,
          failureCode,
        ]),
      ).toEqual([
        [PaymentAttemptStatus.Succeeded, null],
        [PaymentAttemptStatus.Failed, 'card_declined'],
      ]);
    });

    it('waits for 3D Secure, then pays once the cardholder approves', async () => {
      const code = await cardOrder();
      const payment = await startPayment(code);

      const challenged = await confirm(payment, TEST_CARDS.threeDSecure).expect(
        200,
      );

      expect(
        (challenged.body as SimulatedIntentResponseDto).intent,
      ).toMatchObject({
        status: MockIntentStatus.RequiresAction,
        nextAction: 'AUTHENTICATE',
      });

      const [waiting] = await paymentsOf(code);

      expect(waiting.status).toBe(PaymentAttemptStatus.RequiresAction);
      expect(waiting.clientSecret).toBe(payment.clientSecret);
      expect((await startPayment(code)).id).toBe(payment.id);

      await authenticate(payment, true).expect(200);

      expect((await orderOf(code)).paymentStatus).toBe(PaymentStatus.Paid);
    });

    it('fails the payment when the cardholder abandons 3D Secure', async () => {
      const code = await cardOrder();
      const payment = await startPayment(code);

      await confirm(payment, TEST_CARDS.threeDSecure).expect(200);
      await authenticate(payment, false).expect(200);

      const [failed] = await paymentsOf(code);

      expect(failed).toMatchObject({
        status: PaymentAttemptStatus.Failed,
        failureCode: 'authentication_failed',
      });
      expect((await orderOf(code)).paymentStatus).toBe(PaymentStatus.Unpaid);
    });

    it('answers 404 for a wrong client secret', async () => {
      const payment = await startPayment(await cardOrder());

      await confirm(
        payment,
        TEST_CARDS.success,
        `${payment.providerPaymentId}_secret_forged`,
      ).expect(404);
    });

    it('answers 409 when the intent is confirmed twice', async () => {
      const payment = await startPayment(await cardOrder());

      await confirm(payment, TEST_CARDS.success).expect(200);
      await confirm(payment, TEST_CARDS.success).expect(409);
      await authenticate(payment, true).expect(409);
    });

    it('rejects a card number that fails the checksum', async () => {
      const payment = await startPayment(await cardOrder());

      const response = await confirm(payment, '4242424242424241').expect(400);

      expect(errorMessages(response.body)).toEqual([
        'confirmation.cardNumber must be a valid card number',
      ]);
    });

    it('speaks Vietnamese', async () => {
      const response = await request(ctx.server())
        .post(`${simulatorPath('mock_pi_unknown', 'confirm')}?lang=vi`)
        .send({
          confirmation: {
            clientSecret: 'mock_pi_unknown_secret_x',
            cardNumber: TEST_CARDS.success,
            ...TEST_CARD_EXPIRY,
          },
        })
        .expect(404);

      expect(errorMessages(response.body)).toEqual([
        'Không tìm thấy phiên thanh toán',
      ]);
    });
  });

  describe('POST /payments/webhooks/:provider', () => {
    const signedSuccess = async (payment: PaymentDto) => {
      const intent = (await intentOf(payment)) as MockIntent;

      return ctx.app.get(MockPaymentGateway).sign(
        {
          ...intent,
          status: MockIntentStatus.Succeeded,
          card: { brand: 'mastercard', last4: '4444' },
        },
        'payment_intent.succeeded',
      );
    };

    const deliver = ({
      rawBody,
      signature,
    }: {
      rawBody: Buffer;
      signature: string;
    }) =>
      request(ctx.server())
        .post(PAYMENT_WEBHOOK_PATHS.mock)
        .set('Content-Type', 'application/json')
        .set(MOCK_SIGNATURE_HEADER, signature)
        .send(rawBody.toString());

    it('settles the order from an event delivered over HTTP, once', async () => {
      const code = await cardOrder();
      const payment = await startPayment(code);
      const event = await signedSuccess(payment);

      const first = await deliver(event).expect(200);
      const replay = await deliver(event).expect(200);

      expect((first.body as WebhookReceiptResponseDto).event.duplicate).toBe(
        false,
      );
      expect((replay.body as WebhookReceiptResponseDto).event.duplicate).toBe(
        true,
      );
      expect((await orderOf(code)).paymentStatus).toBe(PaymentStatus.Paid);
      expect(
        await ctx.dataSource
          .getRepository(PaymentEvent)
          .countBy({ paymentId: payment.id }),
      ).toBe(1);
    });

    it('refuses a forged signature', async () => {
      const payment = await startPayment(await cardOrder());
      const { rawBody } = await signedSuccess(payment);

      const response = await deliver({
        rawBody,
        signature: `t=${Math.floor(Date.now() / 1000)},v1=forged`,
      }).expect(400);

      expect(errorMessages(response.body)).toEqual([
        'The webhook signature or payload is invalid',
      ]);
    });

    it('refuses a request without a signature', async () => {
      await request(ctx.server())
        .post(PAYMENT_WEBHOOK_PATHS.mock)
        .send({ id: 'evt_1' })
        .expect(400);
    });

    it('acknowledges an event for an intent it never opened', async () => {
      const event = ctx.app.get(MockPaymentGateway).sign(
        {
          id: 'mock_pi_unknown',
          clientSecret: 'x',
          amount: 1,
          currency: 'VND',
          orderCode: 'ORD-20261110-9999',
          status: MockIntentStatus.Succeeded,
          card: null,
          failure: null,
          refundId: null,
        },
        'payment_intent.succeeded',
      );

      const response = await deliver(event).expect(200);

      expect((response.body as WebhookReceiptResponseDto).event.duplicate).toBe(
        false,
      );
    });

    it('answers 404 for a provider that is not configured', async () => {
      await request(ctx.server())
        .post(PAYMENT_WEBHOOK_PATHS.stripe)
        .set('stripe-signature', 't=1,v1=x')
        .send({})
        .expect(404);
    });
  });

  describe('confirming card orders', () => {
    it('waits for the payment before the order can be confirmed', async () => {
      const code = await cardOrder();

      const refused = await changeStatus(ctx, admin, code, {
        status: OrderStatus.Confirmed,
      }).expect(422);

      expect(errorMessages(refused.body)).toEqual([
        'A card order can only be confirmed once it is paid',
      ]);

      await pay(code);

      await changeStatus(ctx, admin, code, {
        status: OrderStatus.Confirmed,
      }).expect(200);
    });
  });

  describe('refunds', () => {
    it('refunds a paid order the customer cancels', async () => {
      const code = await cardOrder();
      const payment = await pay(code);

      await actingAs(ctx, buyer)
        .post(`${ORDERS_PATH}/${code}/cancel`)
        .expect(200);

      const refunded = await eventually(
        payment.id,
        PaymentAttemptStatus.Refunded,
      );

      expect(refunded.status).toBe(PaymentAttemptStatus.Refunded);
      expect(refunded.providerRefundId).toMatch(/^mock_re_/);
      expect(refunded.refundedAt).not.toBeNull();
      expect((await intentOf(payment))?.status).toBe(MockIntentStatus.Refunded);

      const order = await orderOf(code);

      expect(order.status).toBe(OrderStatus.Cancelled);
      expect(order.paymentStatus).toBe(PaymentStatus.Refunded);
    });

    it('refunds a paid order the shop rejects', async () => {
      const code = await cardOrder();
      const payment = await pay(code);

      await changeStatus(ctx, admin, code, {
        status: OrderStatus.Rejected,
        reason: REASON,
      }).expect(200);

      await eventually(payment.id, PaymentAttemptStatus.Refunded);

      expect((await orderOf(code)).paymentStatus).toBe(PaymentStatus.Refunded);
    });

    it('refunds a card that succeeds after the order was cancelled', async () => {
      const code = await cardOrder();
      const payment = await startPayment(code);

      await actingAs(ctx, buyer)
        .post(`${ORDERS_PATH}/${code}/cancel`)
        .expect(200);
      await confirm(payment, TEST_CARDS.success).expect(200);

      const refunded = await eventually(
        payment.id,
        PaymentAttemptStatus.Refunded,
      );

      expect(refunded.status).toBe(PaymentAttemptStatus.Refunded);

      const order = await orderOf(code);

      expect(order.status).toBe(OrderStatus.Cancelled);
      expect(order.paymentStatus).toBe(PaymentStatus.Unpaid);
    });

    it('picks up a refund whose job was lost', async () => {
      const code = await cardOrder();
      const payment = await pay(code);
      const stuckSince = new Date(Date.now() - 2 * REFUND_RETRY_AFTER_MS);

      await ctx.dataSource
        .getRepository(Order)
        .update({ code }, { status: OrderStatus.Cancelled });
      await ctx.dataSource.getRepository(Payment).update(
        { id: payment.id },
        {
          status: PaymentAttemptStatus.RefundPending,
          updatedAt: stuckSince,
        },
      );

      await expect(
        ctx.app.get(PaymentsScheduler).retryStaleRefunds(),
      ).resolves.toBe(true);

      const refunded = await eventually(
        payment.id,
        PaymentAttemptStatus.Refunded,
      );

      expect(refunded.status).toBe(PaymentAttemptStatus.Refunded);
      expect((await orderOf(code)).paymentStatus).toBe(PaymentStatus.Refunded);
    });

    it('leaves a cancelled unpaid card order without any refund', async () => {
      const code = await cardOrder();

      await startPayment(code);
      await actingAs(ctx, buyer)
        .post(`${ORDERS_PATH}/${code}/cancel`)
        .expect(200);

      const [open] = await paymentsOf(code);

      expect(open.status).toBe(PaymentAttemptStatus.Pending);
      expect((await orderOf(code)).paymentStatus).toBe(PaymentStatus.Unpaid);
    });
  });
});
