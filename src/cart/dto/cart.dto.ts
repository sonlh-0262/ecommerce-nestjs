import { ApiProperty } from '@nestjs/swagger';

import { ErrorBodyDto } from '../../common/dto/error-response.dto';
import { CartLine, CartView } from '../interfaces/cart-view.interface';

export class CartItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty({ example: 'Áo thun cotton basic' })
  name: string;

  @ApiProperty({ example: 'ao-thun-cotton-basic' })
  slug: string;

  @ApiProperty({ nullable: true, example: null })
  thumbnailUrl: string | null;

  @ApiProperty({
    description: 'Current price in VND: the sale price when there is one.',
    example: 150000,
  })
  unitPrice: number;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 300000 })
  lineTotal: number;

  @ApiProperty({ example: 10 })
  stock: number;

  @ApiProperty({
    description:
      'False when the product is no longer on sale or the stock is below ' +
      'the quantity. Such an item stays in the cart but cannot be ordered.',
  })
  available: boolean;
}

export class CartDto {
  @ApiProperty({ type: [CartItemDto], description: 'Oldest first.' })
  items: CartItemDto[];

  @ApiProperty({ description: 'Number of distinct items.', example: 1 })
  itemsCount: number;

  @ApiProperty({
    description: 'Sum of the line totals of the available items, in VND.',
    example: 300000,
  })
  subtotal: number;
}

export class CartResponseDto {
  @ApiProperty({ type: CartDto })
  cart: CartDto;
}

export class InsufficientStockErrorDto extends ErrorBodyDto {
  @ApiProperty({ example: 3 })
  availableStock: number;
}

export class InsufficientStockErrorResponseDto {
  @ApiProperty({ type: InsufficientStockErrorDto })
  errors: InsufficientStockErrorDto;
}

function toCartItemDto(line: CartLine): CartItemDto {
  const { item } = line;

  return {
    id: item.id,
    productId: item.productId,
    name: item.product.name,
    slug: item.product.slug,
    thumbnailUrl: line.thumbnailUrl,
    unitPrice: line.unitPrice,
    quantity: item.quantity,
    lineTotal: line.lineTotal,
    stock: item.product.stock,
    available: line.available,
  };
}

export function toCartResponse(view: CartView): CartResponseDto {
  return {
    cart: {
      items: view.lines.map(toCartItemDto),
      itemsCount: view.lines.length,
      subtotal: view.subtotal,
    },
  };
}
