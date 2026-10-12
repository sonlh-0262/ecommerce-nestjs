import { Module } from '@nestjs/common';

import { AppModule } from '../app.module';
import { CategoriesModule } from '../categories/categories.module';
import { ProductsModule } from '../products/products.module';
import { UsersModule } from '../users/users.module';
import { SeedAdminCommand } from './commands/seed-admin.command';
import { SeedCategoriesCommand } from './commands/seed-categories.command';
import { SeedProductsCommand } from './commands/seed-products.command';

@Module({
  imports: [AppModule, UsersModule, CategoriesModule, ProductsModule],
  providers: [SeedAdminCommand, SeedCategoriesCommand, SeedProductsCommand],
})
export class ConsoleModule {}
