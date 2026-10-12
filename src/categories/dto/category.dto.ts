import { ApiProperty } from '@nestjs/swagger';

import { Category } from '../entities/category.entity';

export class CategoryRefDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Thời trang nam' })
  name: string;

  @ApiProperty({ example: 'thoi-trang-nam' })
  slug: string;
}

export class CategoryDto extends CategoryRefDto {
  @ApiProperty({ format: 'uuid', nullable: true, example: null })
  parentId: string | null;

  @ApiProperty({
    description: 'Hidden categories stay reachable; only menus skip them.',
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Published products filed directly under this category.',
    example: 12,
  })
  productsCount: number;
}

export class CategoryDetailDto extends CategoryDto {
  @ApiProperty({ type: CategoryRefDto, nullable: true })
  parent: CategoryRefDto | null;

  @ApiProperty({ type: [CategoryDto] })
  children: CategoryDto[];
}

export class CategoryResponseDto {
  @ApiProperty({ type: CategoryDto })
  category: CategoryDto;
}

export class CategoryDetailResponseDto {
  @ApiProperty({ type: CategoryDetailDto })
  category: CategoryDetailDto;
}

export class CategoriesResponseDto {
  @ApiProperty({ type: [CategoryDto] })
  categories: CategoryDto[];

  @ApiProperty({
    description: 'Categories matching the filters, across every page.',
    example: 8,
  })
  categoriesCount: number;
}

export function toCategoryRef({ id, name, slug }: Category): CategoryRefDto {
  return { id, name, slug };
}

export function toCategoryDto(
  category: Category,
  productsCount: number,
): CategoryDto {
  return {
    ...toCategoryRef(category),
    parentId: category.parentId,
    isActive: category.isActive,
    productsCount,
  };
}
