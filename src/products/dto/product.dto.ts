import { ApiProperty } from '@nestjs/swagger';

import {
  CategoryRefDto,
  toCategoryRef,
} from '../../categories/dto/category.dto';
import { Category } from '../../categories/entities/category.entity';
import { ShopRefDto, toShopRef } from '../../shops/dto/shop-ref.dto';
import { Shop } from '../../shops/entities/shop.entity';
import { ProductImage } from '../entities/product-image.entity';
import { Product } from '../entities/product.entity';
import { ProductStatus } from '../enums/product-status.enum';

export class ProductImageDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    example: '/api/v1/attachments/9b1f0c3e-0000-4000-8000-000000000001',
  })
  url: string;

  @ApiProperty()
  isThumbnail: boolean;

  @ApiProperty({ example: 0 })
  position: number;
}

export class ProductCategoryDto extends CategoryRefDto {
  @ApiProperty({ type: CategoryRefDto, nullable: true })
  parent: CategoryRefDto | null;
}

export class ProductFieldsDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Áo thun cotton basic' })
  name: string;

  @ApiProperty({ example: 'ao-thun-cotton-basic' })
  slug: string;

  @ApiProperty({ description: 'Regular price in VND.', example: 250000 })
  price: number;

  @ApiProperty({
    nullable: true,
    description: 'Discounted price in VND, always below `price`.',
    example: 199000,
  })
  salePrice: number | null;

  @ApiProperty({ example: 42 })
  stock: number;

  @ApiProperty({ enum: ProductStatus, enumName: 'ProductStatus' })
  status: ProductStatus;

  @ApiProperty()
  isFeatured: boolean;

  @ApiProperty({ example: 120 })
  soldCount: number;

  @ApiProperty({ example: 4.5 })
  averageRating: number;

  @ApiProperty({ example: 18 })
  reviewCount: number;

  @ApiProperty({
    nullable: true,
    description: 'URL of the thumbnail image, null until one is uploaded.',
    example: null,
  })
  thumbnailUrl: string | null;

  @ApiProperty({
    type: ShopRefDto,
    nullable: true,
    description: 'The shop selling it; null for a product of the platform.',
  })
  shop: ShopRefDto | null;

  @ApiProperty({ example: '2026-10-01T08:30:00.000Z' })
  createdAt: string;
}

export class ProductSummaryDto extends ProductFieldsDto {
  @ApiProperty({ type: CategoryRefDto })
  category: CategoryRefDto;
}

export class ProductDto extends ProductFieldsDto {
  @ApiProperty({ nullable: true, example: 'Vải cotton 100%, form regular.' })
  description: string | null;

  @ApiProperty({
    type: [ProductImageDto],
    description: 'Ordered by position.',
  })
  images: ProductImageDto[];

  @ApiProperty({ type: ProductCategoryDto })
  category: ProductCategoryDto;

  @ApiProperty({ example: '2026-10-01T08:30:00.000Z' })
  updatedAt: string;
}

export class ProductResponseDto {
  @ApiProperty({ type: ProductDto })
  product: ProductDto;
}

export class ProductsResponseDto {
  @ApiProperty({ type: [ProductSummaryDto] })
  products: ProductSummaryDto[];

  @ApiProperty({
    description: 'Products matching the filters, across every page.',
    example: 128,
  })
  productsCount: number;
}

export function toProductImageDto(image: ProductImage): ProductImageDto {
  return {
    id: image.id,
    url: image.attachment.url,
    isThumbnail: image.isThumbnail,
    position: image.position,
  };
}

function toProductFields(
  product: Product,
  thumbnailUrl: string | null,
  shop: Shop | null,
): ProductFieldsDto {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    salePrice: product.salePrice,
    stock: product.stock,
    status: product.status,
    isFeatured: product.isFeatured,
    soldCount: product.soldCount,
    averageRating: product.averageRating,
    reviewCount: product.reviewCount,
    thumbnailUrl,
    shop: toShopRef(shop),
    createdAt: product.createdAt.toISOString(),
  };
}

export function toProductSummary(
  product: Product,
  category: Category,
  thumbnailUrl: string | null,
  shop: Shop | null,
): ProductSummaryDto {
  return {
    ...toProductFields(product, thumbnailUrl, shop),
    category: toCategoryRef(category),
  };
}

export function toProductResponse(
  product: Product,
  category: Category,
  images: ProductImage[],
  shop: Shop | null,
): ProductResponseDto {
  const thumbnail = images.find((image) => image.isThumbnail);

  return {
    product: {
      ...toProductFields(product, thumbnail?.attachment.url ?? null, shop),
      description: product.description,
      images: images.map(toProductImageDto),
      category: {
        ...toCategoryRef(category),
        parent: category.parent ? toCategoryRef(category.parent) : null,
      },
      updatedAt: product.updatedAt.toISOString(),
    },
  };
}

export class ProductImagesResponseDto {
  @ApiProperty({
    type: [ProductImageDto],
    description: 'Every image of the product after the change, by position.',
  })
  images: ProductImageDto[];
}
