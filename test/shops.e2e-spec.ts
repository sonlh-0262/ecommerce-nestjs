import request from 'supertest';

import { MAIL_JOB } from '../src/mail/mail.constants';
import {
  AdminShopResponseDto,
  AdminShopsResponseDto,
  PublicShopResponseDto,
  ShopResponseDto,
} from '../src/shops/dto/shop.dto';
import { ShopStatus } from '../src/shops/enums/shop-status.enum';
import { UserRole } from '../src/users/enums/user-role.enum';
import { errorMessages } from './support/http';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import { actingAs } from './support/shopper';
import { createTestApp } from './support/test-app';
import {
  ADMIN_SHOPS_PATH,
  MY_SHOP_PATH,
  SHOPS_PATH,
  TEST_SHOP,
} from './support/test.constants';

const REASON = 'Thiếu giấy phép kinh doanh cho ngành sách';

describe('Shops (e2e)', () => {
  let ctx: TestContext;
  let owner: SeededUser;
  let admin: SeededUser;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    owner = await ctx.users.createAuthenticated();
    admin = await ctx.users.createAuthenticated({ role: UserRole.Admin });
  });

  afterEach(async () => {
    await ctx.reset();
  });

  const apply = async (as: SeededUser = owner) => {
    const response = await actingAs(ctx, as)
      .post(SHOPS_PATH)
      .send({ shop: TEST_SHOP })
      .expect(201);

    return (response.body as ShopResponseDto).shop;
  };

  const review = (id: string, shop: object, as: SeededUser = admin) =>
    actingAs(ctx, as).patch(`${ADMIN_SHOPS_PATH}/${id}/status`).send({ shop });

  describe('POST /shops', () => {
    it('opens a PENDING shop with a slug of its name', async () => {
      const shop = await apply();

      expect(shop).toMatchObject({
        ...TEST_SHOP,
        slug: 'nha-sach-ha-noi',
        description: null,
        status: ShopStatus.Pending,
        rejectionReason: null,
        reviewedAt: null,
      });
    });

    it('gives a second shop of the same name its own slug', async () => {
      await apply();
      const other = await apply(await ctx.users.createAuthenticated());

      expect(other.slug).toBe('nha-sach-ha-noi-2');
    });

    it('refuses a second shop for the same account', async () => {
      await apply();

      const response = await actingAs(ctx, owner)
        .post(`${SHOPS_PATH}?lang=vi`)
        .send({ shop: TEST_SHOP })
        .expect(409);

      expect(errorMessages(response.body)).toEqual(['Bạn đã có shop']);
    });

    it('is closed to an admin', async () => {
      await actingAs(ctx, admin)
        .post(SHOPS_PATH)
        .send({ shop: TEST_SHOP })
        .expect(403);
    });

    it('validates the phone number', async () => {
      const response = await actingAs(ctx, owner)
        .post(SHOPS_PATH)
        .send({ shop: { ...TEST_SHOP, phone: 'call me' } })
        .expect(400);

      expect(errorMessages(response.body)).toEqual([
        'shop.phone may only contain digits, spaces and + - ( )',
      ]);
    });
  });

  describe('GET /shops/me', () => {
    it('answers 404 before the account applies', async () => {
      await actingAs(ctx, owner).get(MY_SHOP_PATH).expect(404);
    });

    it('shows the owner its shop with the review', async () => {
      const { id } = await apply();

      const response = await actingAs(ctx, owner).get(MY_SHOP_PATH).expect(200);

      expect((response.body as ShopResponseDto).shop).toMatchObject({
        id,
        status: ShopStatus.Pending,
      });
    });
  });

  describe('PATCH /shops/me', () => {
    it('keeps the slug when the shop is renamed', async () => {
      await apply();

      const response = await actingAs(ctx, owner)
        .patch(MY_SHOP_PATH)
        .send({ shop: { name: 'Nhà Sách Hà Nội Mới' } })
        .expect(200);

      expect((response.body as ShopResponseDto).shop).toMatchObject({
        name: 'Nhà Sách Hà Nội Mới',
        slug: 'nha-sach-ha-noi',
      });
    });

    it('sends a rejected shop back for review', async () => {
      const { id } = await apply();
      await review(id, { status: ShopStatus.Rejected, reason: REASON }).expect(
        200,
      );

      const response = await actingAs(ctx, owner)
        .patch(MY_SHOP_PATH)
        .send({ shop: { description: 'Đã bổ sung giấy phép kinh doanh' } })
        .expect(200);

      expect((response.body as ShopResponseDto).shop).toMatchObject({
        status: ShopStatus.Pending,
        rejectionReason: null,
        reviewedAt: null,
      });
    });

    it('needs at least one field', async () => {
      await apply();

      await actingAs(ctx, owner)
        .patch(MY_SHOP_PATH)
        .send({ shop: {} })
        .expect(400);
    });
  });

  describe('GET /shops/:slug', () => {
    it('hides a shop until it is approved', async () => {
      const { id, slug } = await apply();

      await request(ctx.server()).get(`${SHOPS_PATH}/${slug}`).expect(404);
      await review(id, { status: ShopStatus.Active }).expect(200);

      const response = await request(ctx.server())
        .get(`${SHOPS_PATH}/${slug}`)
        .expect(200);

      expect((response.body as PublicShopResponseDto).shop).toEqual({
        id,
        name: TEST_SHOP.name,
        slug,
        description: null,
        createdAt: expect.any(String) as string,
      });
    });
  });

  describe('GET /admin/shops', () => {
    it('lists shops newest first with their owner, filtered by status', async () => {
      const active = await ctx.shops.shop(
        (await ctx.users.createAuthenticated()).user,
      );
      const { id } = await apply();

      const all = await actingAs(ctx, admin).get(ADMIN_SHOPS_PATH).expect(200);
      const pending = await actingAs(ctx, admin)
        .get(`${ADMIN_SHOPS_PATH}?status=${ShopStatus.Pending}`)
        .expect(200);

      expect(
        (all.body as AdminShopsResponseDto).shops.map((shop) => shop.id),
      ).toEqual([id, active.id]);
      expect(pending.body as AdminShopsResponseDto).toMatchObject({
        shopsCount: 1,
        shops: [
          {
            id,
            owner: { id: owner.user.id, email: owner.user.email },
            reviewedBy: null,
          },
        ],
      });
    });

    it('searches by name or slug', async () => {
      await apply();
      await ctx.shops.shop((await ctx.users.createAuthenticated()).user);

      const response = await actingAs(ctx, admin)
        .get(`${ADMIN_SHOPS_PATH}?q=SACH`)
        .expect(200);

      expect((response.body as AdminShopsResponseDto).shopsCount).toBe(1);
    });
  });

  describe('PATCH /admin/shops/:id/status', () => {
    it('approves a shop and emails its owner', async () => {
      const { id } = await apply();

      const response = await review(id, { status: ShopStatus.Active }).expect(
        200,
      );
      const [mail] = ctx.mail.sentTo(owner.user.email, MAIL_JOB.ShopReviewed);

      expect((response.body as AdminShopResponseDto).shop).toMatchObject({
        status: ShopStatus.Active,
        reviewedBy: admin.user.id,
      });
      expect(mail.payload).toMatchObject({
        shopName: TEST_SHOP.name,
        status: ShopStatus.Active,
        reason: null,
      });
    });

    it('rejects a shop with a reason the owner can read', async () => {
      const { id } = await apply();

      await review(id, { status: ShopStatus.Rejected, reason: REASON }).expect(
        200,
      );
      const mine = await actingAs(ctx, owner).get(MY_SHOP_PATH).expect(200);

      expect((mine.body as ShopResponseDto).shop).toMatchObject({
        status: ShopStatus.Rejected,
        rejectionReason: REASON,
      });
      expect(
        ctx.mail.sentTo(owner.user.email, MAIL_JOB.ShopReviewed)[0].payload
          .reason,
      ).toBe(REASON);
    });

    it('needs a reason to reject', async () => {
      const { id } = await apply();

      const response = await review(id, {
        status: ShopStatus.Rejected,
      }).expect(422);

      expect(errorMessages(response.body)).toEqual([
        'A reason of at least 10 characters is required to reject a shop',
      ]);
    });

    it('reviews a shop only once', async () => {
      const { id } = await apply();
      await review(id, { status: ShopStatus.Active }).expect(200);

      await review(id, { status: ShopStatus.Rejected, reason: REASON }).expect(
        422,
      );
    });

    it('accepts only ACTIVE or REJECTED', async () => {
      const { id } = await apply();

      await review(id, { status: ShopStatus.Pending }).expect(400);
    });

    it('answers 404 to an unknown shop', async () => {
      await review('7f1f0c3e-0000-4000-8000-000000000009', {
        status: ShopStatus.Active,
      }).expect(404);
    });
  });
});
