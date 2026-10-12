import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CacheModule } from '../cache/cache.module';
import { Product } from '../products/entities/product.entity';
import { CategoriesAdminController } from './categories-admin.controller';
import { CategoriesViewService } from './categories-view.service';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Product]), CacheModule],
  controllers: [CategoriesController, CategoriesAdminController],
  providers: [CategoriesService, CategoriesViewService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
