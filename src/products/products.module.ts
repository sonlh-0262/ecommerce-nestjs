import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AttachmentsModule } from '../attachments/attachments.module';
import { CacheModule } from '../cache/cache.module';
import { CategoriesModule } from '../categories/categories.module';
import { Category } from '../categories/entities/category.entity';
import { ProductImage } from './entities/product-image.entity';
import { Product } from './entities/product.entity';
import { ProductImagesAdminController } from './product-images-admin.controller';
import { ProductImagesService } from './product-images.service';
import { ProductsAdminController } from './products-admin.controller';
import { ProductsViewService } from './products-view.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductImage, Category]),
    CacheModule,
    CategoriesModule,
    AttachmentsModule,
  ],
  controllers: [
    ProductsController,
    ProductsAdminController,
    ProductImagesAdminController,
  ],
  providers: [ProductsService, ProductsViewService, ProductImagesService],
  exports: [ProductsService, ProductImagesService],
})
export class ProductsModule {}
