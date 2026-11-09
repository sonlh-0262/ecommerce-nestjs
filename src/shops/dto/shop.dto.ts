import { ApiProperty } from '@nestjs/swagger';

import { paginated } from '../../common/helpers/paginated';
import { toUserRef, UserRefDto } from '../../users/dto/user-ref.dto';
import { Shop } from '../entities/shop.entity';
import { ShopStatus } from '../enums/shop-status.enum';
import {
  AdminShopPage,
  AdminShopView,
} from '../interfaces/shop-view.interface';

export class PublicShopDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Nhà Sách Hà Nội' })
  name: string;

  @ApiProperty({ example: 'nha-sach-ha-noi' })
  slug: string;

  @ApiProperty({
    nullable: true,
    example: 'Sách giáo khoa và văn phòng phẩm, giao trong ngày.',
  })
  description: string | null;

  @ApiProperty({ example: '2026-11-05T08:30:00.000Z' })
  createdAt: string;
}

export class PublicShopResponseDto {
  @ApiProperty({ type: PublicShopDto })
  shop: PublicShopDto;
}

export class ShopDto extends PublicShopDto {
  @ApiProperty({ example: '0901234567' })
  phone: string;

  @ApiProperty({ example: '12 Hang Bai, Ha Noi' })
  address: string;

  @ApiProperty({ enum: ShopStatus, enumName: 'ShopStatus' })
  status: ShopStatus;

  @ApiProperty({
    nullable: true,
    description: 'Why an admin rejected the application.',
    example: null,
  })
  rejectionReason: string | null;

  @ApiProperty({
    nullable: true,
    description: 'When an admin approved or rejected it (ISO 8601).',
    example: null,
  })
  reviewedAt: string | null;

  @ApiProperty({ example: '2026-11-05T08:30:00.000Z' })
  updatedAt: string;
}

export class ShopResponseDto {
  @ApiProperty({ type: ShopDto })
  shop: ShopDto;
}

export class AdminShopDto extends ShopDto {
  @ApiProperty({ type: UserRefDto, description: 'Who applied for the shop.' })
  owner: UserRefDto;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'Admin who reviewed it, null while PENDING.',
  })
  reviewedBy: string | null;
}

export class AdminShopResponseDto {
  @ApiProperty({ type: AdminShopDto })
  shop: AdminShopDto;
}

export class AdminShopsResponseDto {
  @ApiProperty({ type: [AdminShopDto], description: 'Newest first.' })
  shops: AdminShopDto[];

  @ApiProperty({
    description: 'Shops matching the filters, across every page.',
    example: 12,
  })
  shopsCount: number;
}

function toPublicShopDto(shop: Shop): PublicShopDto {
  return {
    id: shop.id,
    name: shop.name,
    slug: shop.slug,
    description: shop.description,
    createdAt: shop.createdAt.toISOString(),
  };
}

function toShopDto(shop: Shop): ShopDto {
  return {
    ...toPublicShopDto(shop),
    phone: shop.phone,
    address: shop.address,
    status: shop.status,
    rejectionReason: shop.rejectionReason,
    reviewedAt: shop.reviewedAt?.toISOString() ?? null,
    updatedAt: shop.updatedAt.toISOString(),
  };
}

function toAdminShopDto({ shop, owner }: AdminShopView): AdminShopDto {
  return {
    ...toShopDto(shop),
    owner: toUserRef(owner),
    reviewedBy: shop.reviewedBy,
  };
}

export function toPublicShopResponse(shop: Shop): PublicShopResponseDto {
  return { shop: toPublicShopDto(shop) };
}

export function toShopResponse(shop: Shop): ShopResponseDto {
  return { shop: toShopDto(shop) };
}

export function toAdminShopResponse(view: AdminShopView): AdminShopResponseDto {
  return { shop: toAdminShopDto(view) };
}

export function toAdminShopsResponse(
  page: AdminShopPage,
): AdminShopsResponseDto {
  return paginated('shops', page.shops.map(toAdminShopDto), page.total);
}
