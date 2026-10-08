import { randomUUID } from 'crypto';
import request from 'supertest';
import { DeepPartial } from 'typeorm';

import { Order } from '../src/orders/entities/order.entity';
import { OrderStatus } from '../src/orders/enums/order-status.enum';
import { PaymentMethod } from '../src/orders/enums/payment-method.enum';
import { UserResponseDto } from '../src/users/dto/user.dto';
import {
  AdminUserResponseDto,
  UsersResponseDto,
} from '../src/users/dto/admin-user.dto';
import { User } from '../src/users/entities/user.entity';
import { UserRole } from '../src/users/enums/user-role.enum';
import { UserStatus } from '../src/users/enums/user-status.enum';
import { bearer, errorMessages } from './support/http';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import { createTestApp } from './support/test-app';
import { ADMIN_USERS_PATH, PROFILE_PATHS } from './support/test.constants';

describe('Admin users (e2e)', () => {
  let ctx: TestContext;
  let admin: SeededUser;
  let orderSequence = 0;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    admin = await ctx.users.createAuthenticated({ role: UserRole.Admin });
  });

  afterEach(async () => {
    await ctx.reset();
  });

  const asAdmin = (token = admin.session.token) => ({
    get: (url: string) =>
      request(ctx.server())
        .get(url)
        .set(...bearer(token)),
    patch: (url: string) =>
      request(ctx.server())
        .patch(url)
        .set(...bearer(token)),
  });

  const setStatus = (id: string, status: string, token?: string) =>
    asAdmin(token)
      .patch(`${ADMIN_USERS_PATH}/${id}/status`)
      .send({ user: { status } });

  const createOrder = (user: User, overrides: DeepPartial<Order> = {}) => {
    orderSequence += 1;

    return ctx.dataSource.getRepository(Order).save({
      code: `ORD-E2E-${orderSequence}`,
      userId: user.id,
      paymentMethod: PaymentMethod.Cod,
      receiverName: 'Receiver',
      receiverPhone: '0901234567',
      shippingAddress: '1 Nguyen Trai',
      subtotal: 100_000,
      shippingFee: 0,
      total: 100_000,
      ...overrides,
    });
  };

  describe('access', () => {
    it('refuses an account without the admin role with 403', async () => {
      const { session } = await ctx.users.createAuthenticated();

      const response = await asAdmin(session.token)
        .get(ADMIN_USERS_PATH)
        .expect(403);

      expect(errorMessages(response.body)).toEqual([
        'You do not have permission to perform this action',
      ]);
    });

    it('requires a token', async () => {
      await request(ctx.server()).get(ADMIN_USERS_PATH).expect(401);
    });
  });

  describe('GET /admin/users', () => {
    it('lists accounts newest first with the total', async () => {
      const older = await ctx.users.create({
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      const newer = await ctx.users.create({
        createdAt: new Date('2026-02-01T00:00:00Z'),
      });

      const response = await asAdmin()
        .get(`${ADMIN_USERS_PATH}?limit=2`)
        .expect(200);
      const { users, usersCount } = response.body as UsersResponseDto;

      expect(usersCount).toBe(3);
      expect(users.map(({ id }) => id)).toEqual([admin.user.id, newer.id]);
      expect(users[0]).not.toHaveProperty('passwordHash');

      const next = await asAdmin()
        .get(`${ADMIN_USERS_PATH}?limit=2&offset=2`)
        .expect(200);
      expect((next.body as UsersResponseDto).users.map(({ id }) => id)).toEqual(
        [older.id],
      );
    });

    it('searches email and username, case-insensitively', async () => {
      const match = await ctx.users.create({ username: 'Findable_One' });
      await ctx.users.create();

      const response = await asAdmin()
        .get(`${ADMIN_USERS_PATH}?q=findable`)
        .expect(200);
      const { users, usersCount } = response.body as UsersResponseDto;

      expect(usersCount).toBe(1);
      expect(users[0].id).toBe(match.id);
    });

    it('treats LIKE wildcards in the search as plain text', async () => {
      await ctx.users.create({ username: 'plain_name' });

      const response = await asAdmin()
        .get(`${ADMIN_USERS_PATH}?q=%25`)
        .expect(200);

      expect((response.body as UsersResponseDto).usersCount).toBe(0);
    });

    it('filters by status and role', async () => {
      const locked = await ctx.users.create({ status: UserStatus.Inactive });

      const response = await asAdmin()
        .get(
          `${ADMIN_USERS_PATH}?status=${UserStatus.Inactive}&role=${UserRole.User}`,
        )
        .expect(200);
      const { users, usersCount } = response.body as UsersResponseDto;

      expect(usersCount).toBe(1);
      expect(users[0].id).toBe(locked.id);
    });

    it('leaves soft-deleted accounts out', async () => {
      const gone = await ctx.users.create();
      await ctx.dataSource.getRepository(User).softDelete({ id: gone.id });

      const response = await asAdmin().get(ADMIN_USERS_PATH).expect(200);

      expect((response.body as UsersResponseDto).usersCount).toBe(1);
    });

    it.each([
      ['a limit above 100', 'limit=101'],
      ['a negative offset', 'offset=-1'],
      ['an unknown status', 'status=DELETED'],
      ['an unknown parameter', 'sort=name'],
    ])('rejects %s with 400', async (_case, query) => {
      await asAdmin().get(`${ADMIN_USERS_PATH}?${query}`).expect(400);
    });
  });

  describe('GET /admin/users/:id', () => {
    it('adds the order figures, counting only delivered spending', async () => {
      const customer = await ctx.users.create();
      await createOrder(customer, {
        status: OrderStatus.Delivered,
        deliveredAt: new Date(),
        subtotal: 250_000,
        total: 250_000,
      });
      const latest = await createOrder(customer, {
        status: OrderStatus.Pending,
        createdAt: new Date('2030-01-01T00:00:00Z'),
      });

      const response = await asAdmin()
        .get(`${ADMIN_USERS_PATH}/${customer.id}`)
        .expect(200);
      const { user } = response.body as AdminUserResponseDto;

      expect(user).toMatchObject({
        id: customer.id,
        ordersCount: 2,
        totalSpent: 250_000,
        lastOrderAt: latest.createdAt.toISOString(),
      });
    });

    it('reports zeros for an account without orders', async () => {
      const customer = await ctx.users.create();

      const response = await asAdmin()
        .get(`${ADMIN_USERS_PATH}/${customer.id}`)
        .expect(200);

      expect((response.body as AdminUserResponseDto).user).toMatchObject({
        ordersCount: 0,
        totalSpent: 0,
        lastOrderAt: null,
      });
    });

    it('answers an unknown id with a translated 404', async () => {
      const response = await asAdmin()
        .get(`${ADMIN_USERS_PATH}/${randomUUID()}?lang=vi`)
        .expect(404);

      expect(errorMessages(response.body)).toEqual([
        'Không tìm thấy người dùng',
      ]);
    });

    it('rejects an id that is not a uuid with 400', async () => {
      await asAdmin().get(`${ADMIN_USERS_PATH}/42`).expect(400);
    });
  });

  describe('PATCH /admin/users/:id/status', () => {
    it('locks an account, refusing its existing token at once', async () => {
      const target = await ctx.users.createAuthenticated();

      const response = await setStatus(
        target.user.id,
        UserStatus.Inactive,
      ).expect(200);

      expect((response.body as UserResponseDto).user.status).toBe(
        UserStatus.Inactive,
      );
      await request(ctx.server())
        .get(PROFILE_PATHS.me)
        .set(...bearer(target.session.token))
        .expect(403);
    });

    it('unlocks an account', async () => {
      const target = await ctx.users.createAuthenticated({
        status: UserStatus.Inactive,
      });

      await setStatus(target.user.id, UserStatus.Active).expect(200);

      await request(ctx.server())
        .get(PROFILE_PATHS.me)
        .set(...bearer(target.session.token))
        .expect(200);
    });

    it('treats the current status as a no-op', async () => {
      const target = await ctx.users.create();

      const response = await setStatus(target.id, UserStatus.Active).expect(
        200,
      );

      expect((response.body as UserResponseDto).user.status).toBe(
        UserStatus.Active,
      );
    });

    it('refuses to change the status of the calling admin with 422', async () => {
      const response = await setStatus(
        admin.user.id,
        UserStatus.Inactive,
      ).expect(422);

      expect(errorMessages(response.body)).toEqual([
        'You cannot change your own account status',
      ]);
    });

    it('refuses a pending account with 422', async () => {
      const pending = await ctx.users.create({
        status: UserStatus.Pending,
        emailVerifiedAt: null,
      });

      await setStatus(pending.id, UserStatus.Active).expect(422);
    });

    it('refuses PENDING as a target status with 400', async () => {
      const target = await ctx.users.create();

      await setStatus(target.id, UserStatus.Pending).expect(400);
    });

    it('answers an unknown id with 404', async () => {
      await setStatus(randomUUID(), UserStatus.Inactive).expect(404);
    });
  });
});
