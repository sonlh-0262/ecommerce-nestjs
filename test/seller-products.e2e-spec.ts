import request from 'supertest';

import { Category } from '../src/categories/entities/category.entity';
import {
  ProductImagesResponseDto,
  ProductResponseDto,
  ProductsResponseDto,
} from '../src/products/dto/product.dto';
import { ProductStatus } from '../src/products/enums/product-status.enum';
import { Shop } from '../src/shops/entities/shop.entity';
import { ShopStatus } from '../src/shops/enums/shop-status.enum';
import { UserRole } from '../src/users/enums/user-role.enum';
import { errorMessages } from './support/http';
import { PNG_IMAGE } from './support/images';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import { actingAs } from './support/shopper';
import { createTestApp } from './support/test-app';
import {
  ADMIN_PRODUCTS_PATH,
  PRODUCTS_PATH,
  SELLER_PRODUCTS_PATH,
} from './support/test.constants';

describe('Seller products (e2e)', () => {
  let ctx: TestContext;
  let seller: SeededUser;
  let shop: Shop;
  let category: Category;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    seller = await ctx.users.createAuthenticated();
    shop = await ctx.shops.shop(seller.user);
    category = await ctx.catalog.category();
  });

  afterEach(async () => {
    await ctx.reset();
  });

  const createProduct = async (as: SeededUser = seller) => {
    const response = await actingAs(ctx, as)
      .post(SELLER_PRODUCTS_PATH)
      .send({
        product: {
          name: 'Sách Toán lớp 1',
          price: 25_000,
          stock: 100,
          categoryId: category.id,
        },
      })
      .expect(201);

    return (response.body as ProductResponseDto).product;
  };

  const uploadImage = (id: string, as: SeededUser = seller) =>
    actingAs(ctx, as)
      .post(`${SELLER_PRODUCTS_PATH}/${id}/images`)
      .attach('files', PNG_IMAGE, 'cover.png');

  const SHOP_REF = () => ({ id: shop.id, name: shop.name, slug: shop.slug });

  describe('access', () => {
    it('is closed to an account without a shop', async () => {
      const customer = await ctx.users.createAuthenticated();

      const response = await actingAs(ctx, customer)
        .get(SELLER_PRODUCTS_PATH)
        .expect(403);

      expect(errorMessages(response.body)).toEqual([
        'You need an approved shop to do this',
      ]);
    });

    it('is closed to the owner of a shop waiting for review', async () => {
      const applicant = await ctx.users.createAuthenticated();
      await ctx.shops.shop(applicant.user, {
        status: ShopStatus.Pending,
        reviewedAt: null,
      });

      await actingAs(ctx, applicant).get(SELLER_PRODUCTS_PATH).expect(403);
    });

    it('is closed to an admin', async () => {
      const admin = await ctx.users.createAuthenticated({
        role: UserRole.Admin,
      });

      await actingAs(ctx, admin).get(SELLER_PRODUCTS_PATH).expect(403);
    });
  });

  describe('POST /seller/products', () => {
    it('adds a draft product to the shop of the caller', async () => {
      const product = await createProduct();

      expect(product).toMatchObject({
        status: ProductStatus.Draft,
        isFeatured: false,
        shop: SHOP_REF(),
      });
    });

    it('leaves featuring to the platform', async () => {
      const response = await actingAs(ctx, seller)
        .post(SELLER_PRODUCTS_PATH)
        .send({
          product: {
            name: 'Sách nổi bật',
            price: 25_000,
            stock: 1,
            categoryId: category.id,
            isFeatured: true,
          },
        })
        .expect(400);

      expect(errorMessages(response.body)).toEqual([
        'product.property isFeatured should not exist',
      ]);
    });
  });

  describe('publishing', () => {
    it('puts a published product of the shop on the public catalog', async () => {
      const { id, slug } = await createProduct();
      await uploadImage(id).expect(201);
      await actingAs(ctx, seller)
        .patch(`${SELLER_PRODUCTS_PATH}/${id}`)
        .send({ product: { status: ProductStatus.Published } })
        .expect(200);

      const list = await request(ctx.server())
        .get(`${PRODUCTS_PATH}?shop=${shop.slug}`)
        .expect(200);
      const detail = await request(ctx.server())
        .get(`${PRODUCTS_PATH}/${slug}`)
        .expect(200);

      expect(list.body as ProductsResponseDto).toMatchObject({
        productsCount: 1,
        products: [{ id, shop: SHOP_REF() }],
      });
      expect((detail.body as ProductResponseDto).product.shop).toEqual(
        SHOP_REF(),
      );
    });

    it('keeps platform products out of a shop listing', async () => {
      await ctx.catalog.product(category);

      const response = await request(ctx.server())
        .get(`${PRODUCTS_PATH}?shop=${shop.slug}`)
        .expect(200);

      expect((response.body as ProductsResponseDto).productsCount).toBe(0);
    });

    it('shows a platform product without a shop', async () => {
      const product = await ctx.catalog.product(category);

      const response = await request(ctx.server())
        .get(`${PRODUCTS_PATH}/${product.slug}`)
        .expect(200);

      expect((response.body as ProductResponseDto).product.shop).toBeNull();
    });
  });

  describe('GET /seller/products', () => {
    it('takes no shop filter, the shop is always the caller', async () => {
      await actingAs(ctx, seller)
        .get(`${SELLER_PRODUCTS_PATH}?shop=${shop.slug}`)
        .expect(400);
    });

    it('lists only the products of the shop, drafts included', async () => {
      const mine = await createProduct();
      const otherSeller = await ctx.users.createAuthenticated();
      await ctx.shops.shop(otherSeller.user);
      await createProduct(otherSeller);
      await ctx.catalog.product(category);

      const response = await actingAs(ctx, seller)
        .get(SELLER_PRODUCTS_PATH)
        .expect(200);

      expect(response.body as ProductsResponseDto).toMatchObject({
        productsCount: 1,
        products: [{ id: mine.id, status: ProductStatus.Draft }],
      });
    });
  });

  describe('products of someone else', () => {
    let otherSeller: SeededUser;

    beforeEach(async () => {
      otherSeller = await ctx.users.createAuthenticated();
      await ctx.shops.shop(otherSeller.user);
    });

    it('hides the product of another shop', async () => {
      const { id } = await createProduct(otherSeller);

      await actingAs(ctx, seller)
        .patch(`${SELLER_PRODUCTS_PATH}/${id}`)
        .send({ product: { price: 1 } })
        .expect(404);
      await actingAs(ctx, seller)
        .delete(`${SELLER_PRODUCTS_PATH}/${id}`)
        .expect(404);
      await uploadImage(id).expect(404);
    });

    it('hides a product of the platform', async () => {
      const product = await ctx.catalog.product(category);

      await actingAs(ctx, seller)
        .patch(`${SELLER_PRODUCTS_PATH}/${product.id}`)
        .send({ product: { price: 1 } })
        .expect(404);
    });

    it('hides the image of another shop', async () => {
      const { id } = await createProduct(otherSeller);
      const upload = await uploadImage(id, otherSeller).expect(201);
      const [image] = (upload.body as ProductImagesResponseDto).images;

      await actingAs(ctx, seller)
        .delete(`${SELLER_PRODUCTS_PATH}/${id}/images/${image.id}`)
        .expect(404);
    });
  });

  describe('DELETE /seller/products/:id', () => {
    it('archives a product of the shop', async () => {
      const { id } = await createProduct();

      await actingAs(ctx, seller)
        .delete(`${SELLER_PRODUCTS_PATH}/${id}`)
        .expect(204);

      const response = await actingAs(ctx, seller)
        .get(`${SELLER_PRODUCTS_PATH}?includeDeleted=true`)
        .expect(200);

      expect((response.body as ProductsResponseDto).products).toMatchObject([
        { id, status: ProductStatus.Archived },
      ]);
    });

    it('removes an image of a product of the shop', async () => {
      const { id } = await createProduct();
      const upload = await uploadImage(id).expect(201);
      const [image] = (upload.body as ProductImagesResponseDto).images;

      await actingAs(ctx, seller)
        .delete(`${SELLER_PRODUCTS_PATH}/${id}/images/${image.id}`)
        .expect(204);
    });
  });

  describe('moderation', () => {
    it('lets an admin still take down a product of a shop', async () => {
      const admin = await ctx.users.createAuthenticated({
        role: UserRole.Admin,
      });
      const { id } = await createProduct();

      await actingAs(ctx, admin)
        .delete(`${ADMIN_PRODUCTS_PATH}/${id}`)
        .expect(204);
    });
  });
});
