import { ApiProperty } from '@nestjs/swagger';

import { ProductShare } from '../interfaces/product-share.interface';
import { SHARE_DESCRIPTION_MAX_LENGTH } from '../products.constants';

export class ProductShareDto {
  @ApiProperty({
    description: 'Product page on the web front.',
    example: 'https://shop.example.com/products/ao-thun-cotton-basic',
  })
  url: string;

  @ApiProperty({
    example:
      'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fshop.example.com%2Fproducts%2Fao-thun-cotton-basic',
  })
  facebook: string;

  @ApiProperty({
    example:
      'https://twitter.com/intent/tweet?url=https%3A%2F%2Fshop.example.com%2Fproducts%2Fao-thun-cotton-basic&text=%C3%81o+thun',
  })
  twitter: string;

  @ApiProperty({ description: 'og:title', example: 'Áo thun cotton basic' })
  title: string;

  @ApiProperty({
    nullable: true,
    description: `og:description: the description cut to ${SHARE_DESCRIPTION_MAX_LENGTH} characters on a word boundary.`,
    example: 'Vải cotton 100%, form regular.',
  })
  description: string | null;

  @ApiProperty({
    nullable: true,
    description: 'og:image: absolute URL of the thumbnail.',
    example:
      'https://api.example.com/api/v1/attachments/9b1f0c3e-0000-4000-8000-000000000001',
  })
  image: string | null;
}

export class ProductShareResponseDto {
  @ApiProperty({ type: ProductShareDto })
  share: ProductShareDto;
}

export function toProductShareResponse(
  share: ProductShare,
): ProductShareResponseDto {
  return {
    share: {
      url: share.url,
      facebook: share.facebook,
      twitter: share.twitter,
      title: share.title,
      description: share.description,
      image: share.image,
    },
  };
}
