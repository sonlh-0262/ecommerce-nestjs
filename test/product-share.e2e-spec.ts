import request from 'supertest';

import { ProductShareResponseDto } from '../src/products/dto/product-share.dto';
import { ProductImagesResponseDto } from '../src/products/dto/product.dto';
import { Category } from '../src/categories/entities/category.entity';
import { ProductStatus } from '../src/products/enums/product-status.enum';
import { UserRole } from '../src/users/enums/user-role.enum';
import { errorMessages } from './support/http';
import { PNG_IMAGE } from './support/images';
import { TestContext } from './support/interfaces/test-context.interface';
import { actingAs } from './support/shopper';
import { createTestApp } from './support/test-app';
import {
  ADMIN_PRODUCTS_PATH,
  productSharePath,
} from './support/test.constants';

describe('Product sharing (e2e)', () => {
  const WEB_URL = 'http://localhost:3000';
  const API_URL = 'http://localhost:3001';

  let ctx: TestContext;
  let category: Category;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    category = await ctx.catalog.category();
  });

  afterEach(async () => {
    await ctx.reset();
  });

  const share = (slug: string, query = '') =>
    request(ctx.server()).get(`${productSharePath(slug)}${query}`);

  it('gives the page, the share links and the Open Graph fields', async () => {
    const product = await ctx.catalog.product(category, {
      name: 'Áo thun & quần short',
      slug: 'ao-thun-quan-short',
      description: 'Bộ đồ mặc nhà mùa hè, vải cotton thoáng mát.',
    });

    const response = await share(product.slug).expect(200);
    const page = `${WEB_URL}/products/ao-thun-quan-short`;

    expect((response.body as ProductShareResponseDto).share).toEqual({
      url: page,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(page)}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(page)}&text=%C3%81o+thun+%26+qu%E1%BA%A7n+short`,
      title: 'Áo thun & quần short',
      description: 'Bộ đồ mặc nhà mùa hè, vải cotton thoáng mát.',
      image: null,
    });
  });

  it('points the image at the thumbnail on the API origin', async () => {
    const admin = await ctx.users.createAuthenticated({
      role: UserRole.Admin,
    });
    const product = await ctx.catalog.product(category);
    const upload = await actingAs(ctx, admin)
      .post(`${ADMIN_PRODUCTS_PATH}/${product.id}/images`)
      .attach('files', PNG_IMAGE, 'photo.png')
      .expect(201);
    const [image] = (upload.body as ProductImagesResponseDto).images;

    const response = await share(product.slug).expect(200);
    const { share: shared } = response.body as ProductShareResponseDto;

    expect(shared.image).toBe(`${API_URL}${image.url}`);
    await request(ctx.server())
      .get(new URL(shared.image as string).pathname)
      .expect(200);
  });

  it('shortens a long description on a word boundary', async () => {
    const product = await ctx.catalog.product(category, {
      description: 'Vải cotton thoáng mát, giữ form tốt. '.repeat(10),
    });

    const response = await share(product.slug).expect(200);
    const { description } = (response.body as ProductShareResponseDto).share;

    expect(description?.length).toBeLessThanOrEqual(160);
    expect(description).toMatch(/[^ ]…$/);
  });

  it.each([ProductStatus.Draft, ProductStatus.Archived])(
    'cannot share a %s product',
    async (status) => {
      const product = await ctx.catalog.product(category, { status });

      const response = await share(product.slug, '?lang=vi').expect(404);

      expect(errorMessages(response.body)).toHaveLength(1);
    },
  );

  it('answers 404 for an unknown slug', async () => {
    await share('khong-ton-tai').expect(404);
  });
});
