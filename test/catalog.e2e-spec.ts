import { randomUUID } from 'crypto';
import request from 'supertest';

import { PUBLIC_ATTACHMENT_CACHE_CONTROL } from '../src/attachments/attachments.constants';
import { CartItem } from '../src/cart/entities/cart-item.entity';
import { Cart } from '../src/cart/entities/cart.entity';
import {
  CategoriesResponseDto,
  CategoryDetailResponseDto,
  CategoryResponseDto,
} from '../src/categories/dto/category.dto';
import { Category } from '../src/categories/entities/category.entity';
import {
  ProductImagesResponseDto,
  ProductResponseDto,
  ProductsResponseDto,
} from '../src/products/dto/product.dto';
import { Product } from '../src/products/entities/product.entity';
import { ProductStatus } from '../src/products/enums/product-status.enum';
import { MAX_PRODUCT_IMAGES } from '../src/products/products.constants';
import { UserRole } from '../src/users/enums/user-role.enum';
import { bearer, errorMessages } from './support/http';
import { PNG_IMAGE } from './support/images';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import { createTestApp } from './support/test-app';
import {
  ADMIN_CATEGORIES_PATH,
  ADMIN_PRODUCTS_PATH,
  CATEGORIES_PATH,
  PRODUCTS_PATH,
} from './support/test.constants';

describe('Catalog (e2e)', () => {
  let ctx: TestContext;
  let admin: SeededUser;

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

  const asAdmin = () => ({
    post: (url: string) =>
      request(ctx.server())
        .post(url)
        .set(...bearer(admin.session.token)),
    patch: (url: string) =>
      request(ctx.server())
        .patch(url)
        .set(...bearer(admin.session.token)),
    delete: (url: string) =>
      request(ctx.server())
        .delete(url)
        .set(...bearer(admin.session.token)),
    get: (url: string) =>
      request(ctx.server())
        .get(url)
        .set(...bearer(admin.session.token)),
  });

  const createCategory = (category: Record<string, unknown>) =>
    asAdmin().post(ADMIN_CATEGORIES_PATH).send({ category });

  const createProduct = (product: Record<string, unknown>) =>
    asAdmin().post(ADMIN_PRODUCTS_PATH).send({ product });

  const uploadImages = (productId: string, count: number, query = '') => {
    let upload = asAdmin().post(
      `${ADMIN_PRODUCTS_PATH}/${productId}/images${query}`,
    );

    for (let index = 0; index < count; index += 1) {
      upload = upload.attach('files', PNG_IMAGE, `image-${index}.png`);
    }

    return upload;
  };

  const listProducts = (query: Record<string, string | number>) =>
    request(ctx.server()).get(PRODUCTS_PATH).query(query);

  const namesOf = (body: unknown) =>
    (body as ProductsResponseDto).products.map(({ name }) => name);

  describe('categories', () => {
    it('lists categories to a guest', async () => {
      const root = await ctx.catalog.category({ name: 'Thời trang nam' });
      await ctx.catalog.product(root);
      await ctx.catalog.product(root, { status: ProductStatus.Draft });

      const response = await request(ctx.server())
        .get(CATEGORIES_PATH)
        .expect(200);

      expect(response.body).toEqual({
        categories: [
          {
            id: root.id,
            name: 'Thời trang nam',
            slug: root.slug,
            parentId: null,
            isActive: true,
            productsCount: 1,
          },
        ],
        categoriesCount: 1,
      });
    });

    it('lists only the root categories for parentId=null', async () => {
      const root = await ctx.catalog.category();
      await ctx.catalog.category({ parentId: root.id });

      const response = await request(ctx.server())
        .get(CATEGORIES_PATH)
        .query({ parentId: 'null', isActive: 'true' })
        .expect(200);

      expect(
        (response.body as CategoriesResponseDto).categories.map(({ id }) => id),
      ).toEqual([root.id]);
    });

    it('refuses an account without the admin role with 403', async () => {
      const { session } = await ctx.users.createAuthenticated();

      await request(ctx.server())
        .post(ADMIN_CATEGORIES_PATH)
        .set(...bearer(session.token))
        .send({ category: { name: 'Áo nam' } })
        .expect(403);
    });

    it('lets an admin create, read, update and delete a category', async () => {
      const root = await createCategory({ name: 'Thời trang nam' }).expect(201);
      const rootId = (root.body as CategoryResponseDto).category.id;

      const child = await createCategory({
        name: 'Áo nam',
        parentId: rootId,
      }).expect(201);
      const childBody = (child.body as CategoryResponseDto).category;

      expect(childBody).toMatchObject({ slug: 'ao-nam', parentId: rootId });

      const detail = await request(ctx.server())
        .get(`${CATEGORIES_PATH}/thoi-trang-nam`)
        .expect(200);

      expect((detail.body as CategoryDetailResponseDto).category).toMatchObject(
        {
          id: rootId,
          parent: null,
          children: [{ id: childBody.id, slug: 'ao-nam', productsCount: 0 }],
        },
      );

      const renamed = await asAdmin()
        .patch(`${ADMIN_CATEGORIES_PATH}/${childBody.id}`)
        .send({ category: { name: 'Áo sơ mi nam', isActive: false } })
        .expect(200);

      expect((renamed.body as CategoryResponseDto).category).toMatchObject({
        name: 'Áo sơ mi nam',
        slug: 'ao-nam',
        isActive: false,
      });

      await asAdmin()
        .delete(`${ADMIN_CATEGORIES_PATH}/${childBody.id}`)
        .expect(204);
      await request(ctx.server()).get(`${CATEGORIES_PATH}/ao-nam`).expect(404);
    });

    it('suffixes the slug of a second category with the same name', async () => {
      const root = await ctx.catalog.category({ name: 'Đồ nam' });
      await ctx.catalog.category({ name: 'Áo', slug: 'ao' });

      const response = await createCategory({
        name: 'Áo',
        parentId: root.id,
      }).expect(201);

      expect((response.body as CategoryResponseDto).category.slug).toBe('ao-2');
    });

    it('answers a duplicate name under one parent with 409', async () => {
      await createCategory({ name: 'Áo nam' }).expect(201);

      const response = await createCategory({ name: 'áo nam' }).expect(409);

      expect(errorMessages(response.body)).toEqual([
        'A category with this name already exists at this level',
      ]);
    });

    it('refuses to delete a category that still has products with 409', async () => {
      const category = await ctx.catalog.category();
      await ctx.catalog.product(category, {
        status: ProductStatus.Archived,
        deletedAt: new Date(),
      });

      const response = await asAdmin()
        .delete(`${ADMIN_CATEGORIES_PATH}/${category.id}`)
        .expect(409);

      expect(errorMessages(response.body)).toEqual([
        'This category still has products',
      ]);
    });

    it('refuses to delete a category that still has sub-categories with 409', async () => {
      const root = await ctx.catalog.category();
      await ctx.catalog.category({ parentId: root.id });

      await asAdmin().delete(`${ADMIN_CATEGORIES_PATH}/${root.id}`).expect(409);
    });

    it('refuses a third level with a translated 422', async () => {
      const root = await ctx.catalog.category();
      const child = await ctx.catalog.category({ parentId: root.id });

      const response = await asAdmin()
        .post(`${ADMIN_CATEGORIES_PATH}?lang=vi`)
        .send({ category: { name: 'Áo thun', parentId: child.id } })
        .expect(422);

      expect(errorMessages(response.body)).toEqual([
        'Danh mục chỉ hỗ trợ tối đa 2 cấp',
      ]);
    });

    it('rejects null for isActive with 400', async () => {
      const category = await ctx.catalog.category();

      await asAdmin()
        .patch(`${ADMIN_CATEGORIES_PATH}/${category.id}`)
        .send({ category: { isActive: null } })
        .expect(400);
    });

    it('refreshes the category name on cached featured products', async () => {
      const category = await ctx.catalog.category({ name: 'Cũ' });
      await ctx.catalog.product(category, { isFeatured: true });
      await request(ctx.server()).get(`${PRODUCTS_PATH}/featured`).expect(200);

      await asAdmin()
        .patch(`${ADMIN_CATEGORIES_PATH}/${category.id}`)
        .send({ category: { name: 'Mới' } })
        .expect(200);

      const response = await request(ctx.server())
        .get(`${PRODUCTS_PATH}/featured`)
        .expect(200);

      expect(
        (response.body as ProductsResponseDto).products[0].category.name,
      ).toBe('Mới');
    });

    it('refuses to make a category its own parent with 422', async () => {
      const root = await ctx.catalog.category();

      await asAdmin()
        .patch(`${ADMIN_CATEGORIES_PATH}/${root.id}`)
        .send({ category: { parentId: root.id } })
        .expect(422);
    });

    it('serves the list from the cache until an admin changes it', async () => {
      const category = await ctx.catalog.category({ name: 'Cũ' });

      await request(ctx.server()).get(CATEGORIES_PATH).expect(200);
      await ctx.dataSource
        .getRepository(Category)
        .update({ id: category.id }, { name: 'Đổi thẳng trong DB' });

      const cached = await request(ctx.server())
        .get(CATEGORIES_PATH)
        .expect(200);

      expect((cached.body as CategoriesResponseDto).categories[0].name).toBe(
        'Cũ',
      );

      await asAdmin()
        .patch(`${ADMIN_CATEGORIES_PATH}/${category.id}`)
        .send({ category: { name: 'Mới' } })
        .expect(200);

      const fresh = await request(ctx.server())
        .get(CATEGORIES_PATH)
        .expect(200);

      expect((fresh.body as CategoriesResponseDto).categories[0].name).toBe(
        'Mới',
      );
    });
  });

  describe('public products', () => {
    let root: Category;
    let child: Category;

    beforeEach(async () => {
      root = await ctx.catalog.category({
        name: 'Thời trang',
        slug: 'thoi-trang',
      });
      child = await ctx.catalog.category({
        name: 'Áo',
        slug: 'ao',
        parentId: root.id,
      });
    });

    it('finds "Áo Thun" when searching "ao thun"', async () => {
      await ctx.catalog.product(child, { name: 'Áo Thun Nam' });
      await ctx.catalog.product(child, { name: 'Quần jean' });

      const response = await listProducts({ q: 'ao thun' }).expect(200);

      expect(namesOf(response.body)).toEqual(['Áo Thun Nam']);
    });

    it('answers a search for nonsense with an empty page', async () => {
      await ctx.catalog.product(child);

      const response = await listProducts({ q: '!!! ???' }).expect(200);

      expect(response.body).toEqual({ products: [], productsCount: 0 });
    });

    it('filters on the effective price', async () => {
      await ctx.catalog.product(child, {
        name: 'On sale',
        price: 500_000,
        salePrice: 150_000,
      });
      await ctx.catalog.product(child, { name: 'Full price', price: 300_000 });

      const response = await listProducts({
        minPrice: 100_000,
        maxPrice: 200_000,
      }).expect(200);

      expect(namesOf(response.body)).toEqual(['On sale']);
    });

    it('sorts by effective price ascending', async () => {
      await ctx.catalog.product(child, { name: 'B', price: 300_000 });
      await ctx.catalog.product(child, {
        name: 'A',
        price: 900_000,
        salePrice: 100_000,
      });
      await ctx.catalog.product(child, { name: 'C', price: 500_000 });

      const response = await listProducts({ sort: 'price_asc' }).expect(200);

      expect(namesOf(response.body)).toEqual(['A', 'B', 'C']);
    });

    it('includes the products of sub-categories when filtering by a root', async () => {
      await ctx.catalog.product(root, { name: 'In root' });
      await ctx.catalog.product(child, { name: 'In child' });
      await ctx.catalog.product(await ctx.catalog.category(), {
        name: 'Elsewhere',
      });

      const response = await listProducts({
        category: 'thoi-trang',
        sort: 'price_asc',
      }).expect(200);

      expect(namesOf(response.body).sort()).toEqual(['In child', 'In root']);
    });

    it('filters on stock and rating', async () => {
      await ctx.catalog.product(child, { name: 'Sold out', stock: 0 });
      await ctx.catalog.product(child, {
        name: 'Loved',
        averageRating: 4.5,
      });

      const soldOut = await listProducts({ inStock: 'false' }).expect(200);
      const loved = await listProducts({ minRating: 4 }).expect(200);

      expect(namesOf(soldOut.body)).toEqual(['Sold out']);
      expect(namesOf(loved.body)).toEqual(['Loved']);
    });

    it('answers 404 to a guest asking for a draft', async () => {
      const draft = await ctx.catalog.product(child, {
        status: ProductStatus.Draft,
      });

      await request(ctx.server())
        .get(`${PRODUCTS_PATH}/${draft.slug}`)
        .expect(404);
    });

    it('pages with limit and offset while counting every match', async () => {
      for (let index = 0; index < 12; index += 1) {
        await ctx.catalog.product(child);
      }

      const response = await listProducts({ limit: 5, offset: 5 }).expect(200);
      const body = response.body as ProductsResponseDto;

      expect(body.products).toHaveLength(5);
      expect(body.productsCount).toBe(12);
    });

    it('rejects a limit over the maximum with 400', async () => {
      await listProducts({ limit: 200 }).expect(400);
    });

    it('lists featured products, best sellers first', async () => {
      await ctx.catalog.product(child, {
        name: 'Featured slow',
        isFeatured: true,
        soldCount: 1,
      });
      await ctx.catalog.product(child, {
        name: 'Featured hit',
        isFeatured: true,
        soldCount: 50,
      });
      await ctx.catalog.product(child, { name: 'Plain', soldCount: 99 });

      const response = await request(ctx.server())
        .get(`${PRODUCTS_PATH}/featured`)
        .expect(200);

      expect(namesOf(response.body)).toEqual(['Featured hit', 'Featured slow']);
    });

    it('returns the detail with its category tree', async () => {
      const product = await ctx.catalog.product(child, {
        description: 'Cotton',
      });

      const response = await request(ctx.server())
        .get(`${PRODUCTS_PATH}/${product.slug}`)
        .expect(200);

      expect((response.body as ProductResponseDto).product).toMatchObject({
        id: product.id,
        description: 'Cotton',
        images: [],
        thumbnailUrl: null,
        category: {
          id: child.id,
          parent: { id: root.id, slug: 'thoi-trang' },
        },
      });
    });
  });

  describe('admin products', () => {
    let category: Category;

    beforeEach(async () => {
      category = await ctx.catalog.category();
    });

    const draft = async (name = 'Áo Thun Cotton') => {
      const response = await createProduct({
        name,
        price: 200_000,
        stock: 5,
        categoryId: category.id,
      }).expect(201);

      return (response.body as ProductResponseDto).product;
    };

    it('creates a draft with a slug from its name', async () => {
      const product = await draft();

      expect(product).toMatchObject({
        slug: 'ao-thun-cotton',
        status: ProductStatus.Draft,
        price: 200_000,
        salePrice: null,
        images: [],
      });
    });

    it('refuses a sale price above the price with 422', async () => {
      const response = await createProduct({
        name: 'Áo',
        price: 100_000,
        salePrice: 120_000,
        stock: 1,
        categoryId: category.id,
      }).expect(422);

      expect(errorMessages(response.body)).toEqual([
        'The sale price must be lower than the regular price',
      ]);
    });

    it.each(['status', 'isFeatured', 'price', 'name'])(
      'rejects null for %s with 400',
      async (field) => {
        const product = await draft();

        await asAdmin()
          .patch(`${ADMIN_PRODUCTS_PATH}/${product.id}`)
          .send({ product: { [field]: null } })
          .expect(400);
      },
    );

    it('keeps the featured route out of product slugs', async () => {
      const product = await draft('Featured');

      expect(product.slug).toBe('featured-2');
    });

    it('refuses an unknown category with 422', async () => {
      await createProduct({
        name: 'Áo',
        price: 100_000,
        stock: 1,
        categoryId: randomUUID(),
      }).expect(422);
    });

    it('refuses to publish a product without images with 422', async () => {
      const product = await draft();

      const response = await asAdmin()
        .patch(`${ADMIN_PRODUCTS_PATH}/${product.id}`)
        .send({ product: { status: ProductStatus.Published } })
        .expect(422);

      expect(errorMessages(response.body)).toEqual([
        'A product needs at least one image before it can be published',
      ]);
    });

    it('publishes once an image is uploaded, keeping the slug on rename', async () => {
      const product = await draft();
      await uploadImages(product.id, 1).expect(201);

      const response = await asAdmin()
        .patch(`${ADMIN_PRODUCTS_PATH}/${product.id}`)
        .send({
          product: { status: ProductStatus.Published, name: 'Áo mới' },
        })
        .expect(200);

      expect((response.body as ProductResponseDto).product).toMatchObject({
        status: ProductStatus.Published,
        name: 'Áo mới',
        slug: 'ao-thun-cotton',
      });
      await request(ctx.server())
        .get(`${PRODUCTS_PATH}/ao-thun-cotton`)
        .expect(200);
    });

    it('lists drafts to an admin, and deleted ones on request', async () => {
      await draft('Draft');
      await ctx.catalog.product(category, {
        name: 'Gone',
        status: ProductStatus.Archived,
        deletedAt: new Date(),
      });

      const drafts = await asAdmin()
        .get(`${ADMIN_PRODUCTS_PATH}?status=DRAFT`)
        .expect(200);
      const withDeleted = await asAdmin()
        .get(`${ADMIN_PRODUCTS_PATH}?includeDeleted=true&sort=price_asc`)
        .expect(200);

      expect(namesOf(drafts.body)).toEqual(['Draft']);
      expect(namesOf(withDeleted.body).sort()).toEqual(['Draft', 'Gone']);
    });

    it('soft deletes: archived, hidden from guests and taken out of carts', async () => {
      const product = await ctx.catalog.product(category);
      const { user } = await ctx.users.createAuthenticated();
      const cart = await ctx.dataSource
        .getRepository(Cart)
        .save({ userId: user.id });
      await ctx.dataSource
        .getRepository(CartItem)
        .save({ cartId: cart.id, productId: product.id, quantity: 2 });

      await asAdmin()
        .delete(`${ADMIN_PRODUCTS_PATH}/${product.id}`)
        .expect(204);

      await request(ctx.server())
        .get(`${PRODUCTS_PATH}/${product.slug}`)
        .expect(404);
      await expect(
        ctx.dataSource
          .getRepository(Product)
          .findOne({ where: { id: product.id }, withDeleted: true }),
      ).resolves.toMatchObject({
        status: ProductStatus.Archived,
        deletedAt: expect.any(Date) as Date,
      });
      await expect(
        ctx.dataSource.getRepository(CartItem).count(),
      ).resolves.toBe(0);
      await asAdmin()
        .delete(`${ADMIN_PRODUCTS_PATH}/${product.id}`)
        .expect(404);
    });

    it('lets a new product reuse the slug of a deleted one', async () => {
      const first = await draft();
      await asAdmin().delete(`${ADMIN_PRODUCTS_PATH}/${first.id}`).expect(204);

      const second = await draft();

      expect(second.slug).toBe(first.slug);
      expect(second.id).not.toBe(first.id);
    });

    it('clears the featured cache when a product changes', async () => {
      const featured = await ctx.catalog.product(category, {
        name: 'Featured',
        isFeatured: true,
      });

      await request(ctx.server()).get(`${PRODUCTS_PATH}/featured`).expect(200);
      await asAdmin()
        .patch(`${ADMIN_PRODUCTS_PATH}/${featured.id}`)
        .send({ product: { isFeatured: false } })
        .expect(200);

      const response = await request(ctx.server())
        .get(`${PRODUCTS_PATH}/featured`)
        .expect(200);

      expect(namesOf(response.body)).toEqual([]);
    });
  });

  describe('product images', () => {
    let product: Product;

    beforeEach(async () => {
      product = await ctx.catalog.product(await ctx.catalog.category(), {
        status: ProductStatus.Draft,
      });
    });

    const imagesOf = (body: unknown) =>
      (body as ProductImagesResponseDto).images;

    it('makes the first uploaded image the thumbnail', async () => {
      const response = await uploadImages(product.id, 2).expect(201);

      expect(imagesOf(response.body)).toEqual([
        expect.objectContaining({ position: 0, isThumbnail: true }),
        expect.objectContaining({ position: 1, isThumbnail: false }),
      ]);
      await expect(ctx.storedFiles()).resolves.toHaveLength(2);
    });

    it(`refuses ${MAX_PRODUCT_IMAGES + 1} images in one upload with 422`, async () => {
      const response = await uploadImages(
        product.id,
        MAX_PRODUCT_IMAGES + 1,
      ).expect(422);

      expect(errorMessages(response.body)).toEqual([
        `Send at most ${MAX_PRODUCT_IMAGES} files at once`,
      ]);
      await expect(ctx.storedFiles()).resolves.toHaveLength(0);
    });

    it(`refuses to go past ${MAX_PRODUCT_IMAGES} images in total with 422`, async () => {
      await uploadImages(product.id, 4).expect(201);

      const response = await uploadImages(product.id, 2, '?lang=vi').expect(
        422,
      );

      expect(errorMessages(response.body)).toEqual([
        `Mỗi sản phẩm chỉ có tối đa ${MAX_PRODUCT_IMAGES} ảnh`,
      ]);
      await expect(ctx.storedFiles()).resolves.toHaveLength(4);
    });

    it('moves the thumbnail on request', async () => {
      await uploadImages(product.id, 1).expect(201);

      const response = await uploadImages(product.id, 1)
        .field('isThumbnail', 'true')
        .expect(201);

      expect(
        imagesOf(response.body).map(({ isThumbnail }) => isThumbnail),
      ).toEqual([false, true]);
    });

    it('serves product images without a token, cached publicly', async () => {
      const upload = await uploadImages(product.id, 1).expect(201);

      const response = await request(ctx.server())
        .get(imagesOf(upload.body)[0].url)
        .expect(200);

      expect(response.headers['cache-control']).toBe(
        PUBLIC_ATTACHMENT_CACHE_CONTROL,
      );
    });

    it('promotes the next image when the thumbnail is deleted', async () => {
      const upload = await uploadImages(product.id, 2).expect(201);
      const [thumbnail, next] = imagesOf(upload.body);

      await asAdmin()
        .delete(`${ADMIN_PRODUCTS_PATH}/${product.id}/images/${thumbnail.id}`)
        .expect(204);

      const detail = await asAdmin()
        .get(`${ADMIN_PRODUCTS_PATH}?status=DRAFT`)
        .expect(200);

      expect(
        (detail.body as ProductsResponseDto).products[0].thumbnailUrl,
      ).toBe(next.url);
      await expect(ctx.storedFiles()).resolves.toHaveLength(1);
    });

    it('refuses to delete the last image of a published product with 422', async () => {
      const upload = await uploadImages(product.id, 1).expect(201);
      await ctx.dataSource
        .getRepository(Product)
        .update({ id: product.id }, { status: ProductStatus.Published });

      await asAdmin()
        .delete(
          `${ADMIN_PRODUCTS_PATH}/${product.id}/images/${imagesOf(upload.body)[0].id}`,
        )
        .expect(422);
    });

    it('answers 404 for an image of another product', async () => {
      await asAdmin()
        .delete(`${ADMIN_PRODUCTS_PATH}/${product.id}/images/${randomUUID()}`)
        .expect(404);
    });
  });
});
