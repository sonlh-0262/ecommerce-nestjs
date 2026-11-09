import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AttachmentsModule } from '../attachments/attachments.module';
import { CacheModule } from '../cache/cache.module';
import { CategoriesModule } from '../categories/categories.module';
import { Category } from '../categories/entities/category.entity';
import { ShopsModule } from '../shops/shops.module';
import { ProductImage } from './entities/product-image.entity';
import { Product } from './entities/product.entity';
import { ProductImagesAdminController } from './product-images-admin.controller';
import { ProductImagesSellerController } from './product-images-seller.controller';
import { ProductImagesService } from './product-images.service';
import { ProductShareService } from './product-share.service';
import { ProductThumbnailsService } from './product-thumbnails.service';
import { ProductsAdminController } from './products-admin.controller';
import { ProductsSellerController } from './products-seller.controller';
import { ProductsViewService } from './products-view.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductImage, Category]),
    CacheModule,
    CategoriesModule,
    AttachmentsModule,
    ShopsModule,
  ],
  controllers: [
    ProductsController,
    ProductsAdminController,
    ProductImagesAdminController,
    ProductsSellerController,
    ProductImagesSellerController,
  ],
  providers: [
    ProductsService,
    ProductsViewService,
    ProductImagesService,
    ProductThumbnailsService,
    ProductShareService,
  ],
  exports: [ProductsService, ProductImagesService, ProductThumbnailsService],
})
export class ProductsModule {}
