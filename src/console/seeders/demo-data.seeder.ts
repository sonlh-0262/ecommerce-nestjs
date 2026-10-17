import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Environment } from '../../config/env.validation';
import { SeedDemoOptions } from '../interfaces/seed-demo-options.interface';
import { isProduction } from '../production-guard';
import { AdminSeeder } from './admin.seeder';
import { CategoriesSeeder } from './categories.seeder';
import { DemoCatalogSeeder } from './demo-catalog.seeder';
import { DemoOrdersSeeder } from './demo-orders.seeder';
import { DemoUsersSeeder } from './demo-users.seeder';
import { ProductsSeeder } from './products.seeder';
import { SeedDataReset } from './seed-data-reset';

@Injectable()
export class DemoDataSeeder {
  constructor(
    private readonly configService: ConfigService,
    private readonly reset: SeedDataReset,
    private readonly admin: AdminSeeder,
    private readonly categories: CategoriesSeeder,
    private readonly products: ProductsSeeder,
    private readonly catalog: DemoCatalogSeeder,
    private readonly users: DemoUsersSeeder,
    private readonly orders: DemoOrdersSeeder,
  ) {}

  async seed({ fresh = false }: SeedDemoOptions = {}): Promise<void> {
    if (isProduction(this.configService)) {
      throw new Error(
        `Refusing to seed demo data with NODE_ENV=${Environment.Production}.`,
      );
    }

    if (fresh) {
      await this.reset.run();
    }

    const admin = await this.admin.seed();

    await this.categories.seed();
    await this.products.seed();
    await this.catalog.archiveDrafts();

    const buyers = await this.users.seed();

    await this.orders.seed(admin, buyers, await this.catalog.purchasable());
  }
}
