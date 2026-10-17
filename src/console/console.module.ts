import { Module } from '@nestjs/common';

import { AppModule } from '../app.module';
import { CacheModule } from '../cache/cache.module';
import { CartModule } from '../cart/cart.module';
import { CategoriesModule } from '../categories/categories.module';
import { OrdersModule } from '../orders/orders.module';
import { ProductsModule } from '../products/products.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { UsersModule } from '../users/users.module';
import { SeedAdminCommand } from './commands/seed-admin.command';
import { SeedCategoriesCommand } from './commands/seed-categories.command';
import { SeedDemoCommand } from './commands/seed-demo.command';
import { SeedProductsCommand } from './commands/seed-products.command';
import { AdminSeeder } from './seeders/admin.seeder';
import { CategoriesSeeder } from './seeders/categories.seeder';
import { DemoCatalogSeeder } from './seeders/demo-catalog.seeder';
import { DemoDataSeeder } from './seeders/demo-data.seeder';
import { DemoOrdersSeeder } from './seeders/demo-orders.seeder';
import { DemoUsersSeeder } from './seeders/demo-users.seeder';
import { ProductsSeeder } from './seeders/products.seeder';
import { SeedDataReset } from './seeders/seed-data-reset';

@Module({
  imports: [
    AppModule,
    UsersModule,
    CategoriesModule,
    ProductsModule,
    CacheModule,
    CartModule,
    OrdersModule,
    ReviewsModule,
  ],
  providers: [
    SeedAdminCommand,
    SeedCategoriesCommand,
    SeedProductsCommand,
    SeedDemoCommand,
    AdminSeeder,
    CategoriesSeeder,
    ProductsSeeder,
    DemoDataSeeder,
    SeedDataReset,
    DemoCatalogSeeder,
    DemoUsersSeeder,
    DemoOrdersSeeder,
  ],
})
export class ConsoleModule {}
