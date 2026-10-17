import { ConfigService } from '@nestjs/config';

import { APP_CONFIG_KEY } from '../../config/configuration';
import { Environment } from '../../config/env.validation';
import { Product } from '../../products/entities/product.entity';
import { buildUser } from '../../users/entities/user.fixture';
import { AdminSeeder } from './admin.seeder';
import { CategoriesSeeder } from './categories.seeder';
import { DemoCatalogSeeder } from './demo-catalog.seeder';
import { DemoDataSeeder } from './demo-data.seeder';
import { DemoOrdersSeeder } from './demo-orders.seeder';
import { DemoUsersSeeder } from './demo-users.seeder';
import { ProductsSeeder } from './products.seeder';
import { SeedDataReset } from './seed-data-reset';

describe('DemoDataSeeder', () => {
  const admin = buildUser({ id: 'admin' });
  const buyers = [buildUser({ id: 'buyer' })];
  const products = [{ id: 'product' } as Product];
  const steps: string[] = [];
  const step =
    <T>(name: string, value?: T) =>
    () => {
      steps.push(name);

      return Promise.resolve(value);
    };

  const resetMock = { run: jest.fn(step('reset')) };
  const adminMock = { seed: jest.fn(step('admin', admin)) };
  const categoriesMock = { seed: jest.fn(step('categories')) };
  const productsMock = { seed: jest.fn(step('products')) };
  const catalogMock = {
    archiveDrafts: jest.fn(step('archive')),
    purchasable: jest.fn(step('purchasable', products)),
  };
  const usersMock = { seed: jest.fn(step('users', buyers)) };
  const ordersMock = { seed: jest.fn(step('orders')) };

  const seeder = (nodeEnv = Environment.Development) =>
    new DemoDataSeeder(
      {
        getOrThrow: (key: string) =>
          key === APP_CONFIG_KEY ? { nodeEnv } : undefined,
      } as unknown as ConfigService,
      resetMock as unknown as SeedDataReset,
      adminMock as unknown as AdminSeeder,
      categoriesMock as unknown as CategoriesSeeder,
      productsMock as unknown as ProductsSeeder,
      catalogMock as unknown as DemoCatalogSeeder,
      usersMock as unknown as DemoUsersSeeder,
      ordersMock as unknown as DemoOrdersSeeder,
    );

  afterEach(() => {
    steps.length = 0;
    jest.clearAllMocks();
  });

  it('seeds the catalogue before the users and their orders', async () => {
    await seeder().seed();

    expect(steps).toEqual([
      'admin',
      'categories',
      'products',
      'archive',
      'users',
      'purchasable',
      'orders',
    ]);
    expect(ordersMock.seed).toHaveBeenCalledWith(admin, buyers, products);
  });

  it('empties everything first when asked for a fresh start', async () => {
    await seeder().seed({ fresh: true });

    expect(steps[0]).toBe('reset');
  });

  it('keeps existing data by default', async () => {
    await seeder().seed();

    expect(resetMock.run).not.toHaveBeenCalled();
  });

  it('refuses production before emptying anything', async () => {
    await expect(
      seeder(Environment.Production).seed({ fresh: true }),
    ).rejects.toThrow(/NODE_ENV=production/);

    expect(resetMock.run).not.toHaveBeenCalled();
    expect(steps).toEqual([]);
  });
});
